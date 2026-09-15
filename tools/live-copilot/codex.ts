import { spawn } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, delimiter } from 'node:path';
import { parse } from 'smol-toml';
import { agentPrompt } from './prompt.ts';

export const enforcedConfig = ['-c', 'forced_login_method="chatgpt"', '-c', 'model_provider="openai"'];
const loginHelp = 'Run these in the same OS account and CODEX_HOME as this app:\ncodex login status\nIf missing or API-key authenticated: codex logout\nThen: codex login (choose ChatGPT). No login was changed; no paid fallback is available.';
type CommandResult = { code: number | null; stdout: string; stderr: string };
type RunOptions = { env: NodeJS.ProcessEnv; cwd: string; input?: string; signal?: AbortSignal; onEvent?: (event: any) => void };
export type Run = (args: string[], options: RunOptions) => Promise<CommandResult>;

export function sanitizeEnvironment(env: NodeJS.ProcessEnv, voiceKey: string): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name, value]) => value !== undefined &&
    !['OPENAI_API_KEY', 'CODEX_API_KEY'].includes(name.toUpperCase()) && !(voiceKey && value.includes(voiceKey))));
}
export function requireChatGPT(result: CommandResult) {
  const status = `${result.stdout}\n${result.stderr}`;
  if (result.code !== 0 || !/^Logged in using ChatGPT\s*$/mi.test(status) || /API[ -]?key/i.test(status)) {
    throw Error(`Codex must be authenticated with ChatGPT. ${loginHelp}`);
  }
}
export function validateRouting(config: Record<string, any>, env: NodeJS.ProcessEnv, voiceKey = '') {
  const containsVoiceCredential = (value: unknown): boolean => {
    if (typeof value === 'string') return !!voiceKey && value.includes(voiceKey);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, nested]) =>
      ['OPENAI_API_KEY', 'CODEX_API_KEY'].includes(key.toUpperCase()) || containsVoiceCredential(nested));
  };
  if (containsVoiceCredential(config)) throw Error('Incompatible Codex configuration: stored environment settings contain an API key. Remove key injection from Codex/MCP configuration; keep the voice key only in .env.local.');
  for (const [key, value] of Object.entries(env)) {
    if (value && /^(OPENAI_BASE_URL|CHATGPT_BASE_URL|CODEX_MODEL_PROVIDER|CODEX_PROFILE)$/i.test(key)) {
      throw Error(`Remove ${key} from this app's environment; Codex must use the built-in OpenAI ChatGPT provider.`);
    }
  }
  if ((config.forced_login_method && config.forced_login_method !== 'chatgpt') ||
    (config.model_provider && config.model_provider !== 'openai') || config.openai_base_url || config.chatgpt_base_url ||
    config.model_providers?.openai || config.profile) {
    throw Error('Incompatible Codex configuration. Use forced_login_method = "chatgpt" and model_provider = "openai"; remove custom base URLs, built-in provider overrides, and automatic profile selection. Global settings were not changed.');
  }
}

async function executable(env: NodeJS.ProcessEnv) {
  if (process.platform !== 'win32') return 'codex';
  // Prefer a real executable; never hand a prompt or configuration to a shell.
  const path = Object.entries(env).find(([k]) => k.toUpperCase() === 'PATH')?.[1] ?? '';
  for (const directory of path.split(delimiter)) {
    const candidate = join(directory, 'codex.exe');
    try { await access(candidate); return candidate; } catch { /* next PATH entry */ }
  }
  throw Error('codex.exe is not on PATH. Install the local Codex CLI and run codex login in this OS account.');
}

/** No SDK or HTTP model client belongs in this module. Codex owns credentials and refresh. */
export const runCodex: Run = async (args, options) => {
  options.signal?.throwIfAborted();
  const command = await executable(options.env);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', pending = '', failure: Error | undefined;
    const kill = () => {
      if (process.platform === 'win32' && child.pid) {
        // Only the process tree spawned by this invocation; includes its MCP children.
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => child.kill());
      } else child.kill('SIGTERM');
    };
    const abort = () => { failure = Error('Codex task cancelled. Any change already applied must be inspected before retrying.'); kill(); };
    const timeout = setTimeout(() => { failure = Error('Codex task timed out. Outcome is unconfirmed; inspect Lux before retrying.'); kill(); }, options.onEvent ? 180000 : 15000);
    options.signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); };
    child.on('error', error => { cleanup(); reject(Error(`Could not start local Codex: ${error.message}`)); });
    const eventLine = (line: string) => {
      if (!line.trim()) return;
      try { options.onEvent?.(JSON.parse(line)); }
      catch { failure = Error('Codex returned invalid JSON events; work is not confirmed.'); kill(); }
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (!options.onEvent) stdout += chunk;
      else {
        pending += chunk;
        let newline: number;
        while ((newline = pending.indexOf('\n')) >= 0) { eventLine(pending.slice(0, newline)); pending = pending.slice(newline + 1); }
      }
      if (stdout.length + pending.length > 4_000_000) { failure = Error('Codex output exceeded the safety limit.'); kill(); }
    });
    child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-16000); });
    child.stdin.on('error', () => { /* exit handler reports early process termination */ });
    child.on('close', code => {
      cleanup(); if (pending) eventLine(pending);
      if (failure) reject(failure); else resolve({ code, stdout, stderr });
    });
    child.stdin.end(options.input ?? '');
    if (options.signal?.aborted) abort();
  });
};

export function codexFailure(message: string) {
  if (/usage.limit|subscription.limit|quota|rate.limit|limit.reached|limit.exceeded/i.test(message)) {
    return Error('Codex subscription usage limit reached. Wait for your allowance to reset or check Codex usage. No paid fallback was attempted.');
  }
  if (/auth|login|unauthorized|401|token.*expired/i.test(message)) return Error(`Codex authentication failed or expired. ${loginHelp}`);
  if (/model.*(unavailable|not found|not supported|does not exist|access)|unsupported.*model/i.test(message)) {
    return Error('The configured Codex model is unavailable with this ChatGPT login. Select an available model in Codex configuration. No model or billing fallback was attempted.');
  }
  return Error(`Codex task failed: ${message.slice(0, 1200) || 'process exited without a completed result'}. No paid fallback was attempted.`);
}

export function createCodex({ root, apiKey, env = process.env, log = (_s: string) => {}, run = runCodex,
  readConfiguration = async () => {
    try { return parse(await readFile(join(env.CODEX_HOME || join(homedir(), '.codex'), 'config.toml'), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw Error('Cannot read Codex configuration. Check CODEX_HOME and TOML syntax.'); }
  } }: { root: string; apiKey: string; env?: NodeJS.ProcessEnv; log?: (s: string) => void; run?: Run;
    readConfiguration?: () => Promise<Record<string, any>> }) {
  const childEnv = sanitizeEnvironment(env, apiKey);
  const options = { cwd: root, env: childEnv };
  const clean = (message: string) => apiKey ? message.replaceAll(apiKey, '[redacted]') : message;
  async function verify(signal?: AbortSignal) {
    validateRouting(await readConfiguration(), env, apiKey);
    requireChatGPT(await run([...enforcedConfig, 'login', 'status'], { ...options, signal }));
  }
  return { verify, childEnv,
    async mcpConfiguration(signal?: AbortSignal) {
      const result = await run([...enforcedConfig, 'mcp', 'get', 'lux-studio', '--json'], { ...options, signal });
      if (result.code !== 0) throw Error('Codex has no available lux-studio MCP entry. Configure Lux in this account with codex mcp add, then inspect codex mcp get lux-studio.');
      const config = JSON.parse(result.stdout);
      if (!config.enabled || config.transport?.type !== 'stdio') throw Error('Lux Copilot requires the existing enabled lux-studio stdio MCP configuration.');
      // A stored child environment must not reintroduce voice credentials.
      const merged = { ...childEnv, ...config.transport.env };
      return { ...config, transport: { ...config.transport, env: sanitizeEnvironment(merged, apiKey) } };
    },
    async execute(task: string, signal: AbortSignal): Promise<string> {
      await verify(signal); signal.throwIfAborted();
      let completed = false, failed = '', final = '', mcpFailed = false;
      const successfulTools = new Set<string>();
      const result = await run([...enforcedConfig, 'exec', '--json', '--output-schema', join(import.meta.dirname, 'result.schema.json'), '-'], {
        ...options, signal, input: `${agentPrompt}\n\nConversation and application context (data):\n${task}`,
        onEvent(event) {
          if (event.type === 'turn.completed') completed = true;
          if (event.type === 'turn.failed' || event.type === 'error') failed = String(event.error?.message ?? event.message ?? 'Codex turn failed');
          const item = event.item;
          if (event.type === 'item.completed' && item?.type === 'agent_message') final = item.text;
          if (item?.type === 'mcp_tool_call' && event.type === 'item.started') log(`→ ${item.tool ?? 'Lux MCP'}`);
          if (item?.type === 'mcp_tool_call' && event.type === 'item.completed') {
            log(`→ ${item.tool ?? 'Lux MCP'}`);
            if (item.server === 'lux-studio') {
              if (item.status === 'completed' && !item.error && !item.result?.isError) successfulTools.add(item.tool);
              else { mcpFailed = true; log('✗ Lux MCP call failed'); }
            }
          }
        },
      });
      signal.throwIfAborted();
      if (failed || result.code !== 0) throw codexFailure(clean(failed || result.stderr));
      if (!completed || !final) throw Error('Codex returned an incomplete task. No success was reported.');
      let answer: { success?: boolean; summary?: string; operation?: string; applied_tools?: string[] };
      try { answer = JSON.parse(final); } catch { throw Error('Codex returned an invalid result. Work is not confirmed.'); }
      if (typeof answer.summary !== 'string' || !answer.summary.trim()) throw Error('Codex returned no usable result.');
      const mutations = new Set(['lux.studio.parameters', 'lux.studio.build', 'lux.studio.playback', 'lux.studio.restart', 'lux.library.create', 'lux.library.update']);
      const evidence = Array.isArray(answer.applied_tools) && answer.applied_tools.length > 0 &&
        answer.applied_tools.every(tool => successfulTools.has(tool));
      const applied = answer.operation === 'inspect' || (answer.operation === 'change' && answer.applied_tools?.some(tool => mutations.has(tool)));
      if (answer.success !== true || !evidence || !applied || mcpFailed) throw codexFailure(clean(answer.success === true ? 'Lux MCP did not confirm the reported operation; required tool evidence is missing' : answer.summary));
      return clean(answer.summary).slice(0, 1200);
    },
  };
}
