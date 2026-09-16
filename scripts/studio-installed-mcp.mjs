// Installed adapter always pairs with its own immutable application runtime.
const testing = process.env.LUX_STUDIO_MCP_TEST === '1' && /^test-[a-z0-9-]+$/.test(process.env.LUX_STUDIO_PROFILE || '');
process.env.LUX_STUDIO_PROFILE = testing ? process.env.LUX_STUDIO_PROFILE : 'desktop';
process.env.LUX_STUDIO_DESKTOP = '1';
if (!testing) { delete process.env.LUX_STUDIO_MCP_TEST; delete process.env.LUX_STUDIO_SMOKE; }
await import('./studio-mcp.mjs');
