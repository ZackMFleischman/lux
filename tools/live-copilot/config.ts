export function readConfig(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const supported = new Set(['--debug', '--check-mcp', '--help']);
  for (const arg of args) if (!supported.has(arg)) throw Error(`Unknown option: ${arg}`);
  const config = { debug: args.includes('--debug'), checkMcp: args.includes('--check-mcp'),
    help: args.includes('--help'), apiKey: env.OPENAI_API_KEY?.trim() };
  if (!config.help && !config.checkMcp && (!config.apiKey || /replace-with|placeholder|your[-_]openai/i.test(config.apiKey))) {
    throw Error('Set OPENAI_API_KEY in .env.local at the repository root, or in your environment. Replace the placeholder with a real key.');
  }
  return config;
}
