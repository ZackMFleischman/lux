import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export function canonicalWorkspace(workspace) {
  const path = realpathSync(workspace);
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

export function studioAppData(env = process.env) {
  if (process.platform === 'win32') {
    if (!env.APPDATA) throw Error('APPDATA is required for the Studio profile');
    return resolve(env.APPDATA);
  }
  return process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support')
    : resolve(env.XDG_CONFIG_HOME || join(homedir(), '.config'));
}

/** The same resolver is used before Electron's lock and by its matching adapter. */
export function resolveStudioSession({ workspace, env = process.env, appData = studioAppData(env) }) {
  workspace = canonicalWorkspace(workspace);
  const profile = env.LUX_STUDIO_PROFILE ?? `worktree-${createHash('sha256').update(workspace).digest('hex').slice(0, 24)}`;
  if (!/^[a-z][a-z0-9-]{0,79}$/.test(profile)) throw Error('Invalid Studio profile: use 1-80 lowercase letters, digits or hyphens');
  if ((env.LUX_STUDIO_MCP_TEST === '1' || env.LUX_STUDIO_SMOKE === '1') && !profile.startsWith('test-')) {
    throw Error('Studio automation requires a unique test profile');
  }
  const directory = join(appData, 'Lux', 'Studio', 'profiles', profile);
  return { profile, workspace, directory, endpointPath: join(directory, 'agent-endpoint.json'),
    expectedSessionId: env.LUX_STUDIO_SESSION_ID };
}

/** Always discard an inherited creative/worktree/test selection for a fresh run. */
export function studioTestEnvironment(parent = process.env) {
  const env = { ...parent, LUX_STUDIO_PROFILE: `test-${randomUUID()}`, LUX_STUDIO_MCP_TEST: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.LUX_STUDIO_SMOKE;
  delete env.LUX_STUDIO_SESSION_ID;
  return env;
}

function validateEndpoint(endpoint, session) {
  if (!endpoint || endpoint.version !== 1 || typeof endpoint.sessionId !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(endpoint.sessionId) || !Number.isSafeInteger(endpoint.pid) || endpoint.pid <= 0 ||
      typeof endpoint.token !== 'string' || endpoint.token.length < 16) throw Error('Invalid or legacy Studio endpoint');
  if (endpoint.profile !== session.profile || endpoint.workspace !== session.workspace) throw Error('Studio endpoint profile or checkout mismatch');
  if (session.expectedSessionId && endpoint.sessionId !== session.expectedSessionId) throw Error('Studio instance changed from the explicitly selected session');
  const url = new URL(endpoint.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/' ||
      !url.port || url.username || url.password || url.search || url.hash) throw Error('Invalid local Studio endpoint');
  return endpoint;
}

/** One adapter stays bound to one process lifetime, even if its endpoint is replaced. */
export function createStudioConnection(session, { timeoutMs = 75000 } = {}) {
  let bound;
  return async (method, params = {}) => {
    const endpoint = validateEndpoint(JSON.parse(await readFile(session.endpointPath, 'utf8')), session);
    if (bound && ['sessionId', 'pid', 'url', 'token'].some(key => bound[key] !== endpoint[key])) {
      throw Error('Studio instance changed. Reconnect the adapter to explicitly select the replacement.');
    }
    bound ??= Object.freeze(endpoint);
    // Use the bound credentials, not a second lookup that could select another app.
    const response = await fetch(bound.url, { method: 'POST',
      headers: { authorization: `Bearer ${bound.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id: randomUUID(), method, params }), signal: AbortSignal.timeout(timeoutMs) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw Error(result.error || `Studio request failed (${response.status})`);
    return result.result;
  };
}
