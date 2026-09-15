# Lux desktop installation

## User workflow

Double-click Lux on Desktop or in Start. This runs the installed build, including its compiler, SDK, Node runtime and matching MCP adapter. It does not build or read the development repository. `start-lux` prefers this app unless a branch checkout is explicitly requested.

Windows selects a free loopback port. Agents read `%LOCALAPPDATA%/Programs/Lux/installation.json` and use its bundled Node to run `<workspace>/scripts/studio-desktop.mjs --start` (or `--status` for a read-only check). The result contains the exact MCP command and instance ID. Credentials remain in private profile data.

This local desktop build does not include the policy-gated native Resolume export payload. The File menu marks Export as unavailable. Normal source editing, compilation, preview, controls and scene files remain available. This is a local unsigned build, not a signed distribution installer.

## Build and install

From the selected checkout, use pinned Node 24.12.0:

```text
node scripts/studio-package.mjs
node scripts/studio-desktop.mjs --activate <returned-directory>/installation.json
```

Packaging verifies the official Electron archive checksum, copies an independent pnpm dependency closure and the Node license, builds Studio, and stamps the Lux icon. Private scene files, credentials and test tooling are excluded. Desktop and Start shortcuts plus the discovery record activate together; conflicts preserve existing shortcuts. An older live desktop app must close normally before a different build is activated. No user process is terminated by installation.

Each build records its source commit and working-tree input digest. These identify provenance, not a signature. Existing installations stay untouched until activation. Development tests use unique test profiles and only close their owned process.

## Validation

Focused dependency relocation/closure, path selection, discovery and real Windows shortcut preflight tests; TypeScript check; real installed application with bundled MCP discover/read/build/capture; invalid-edit working-preview preservation; actual window/menu captures and independent source/UX review. A delayed-renderer probe verifies that the endpoint is published only after the main listener is ready.

Detailed run evidence: `.worktrees/_coordination/lux-desktop/` (package record, app-qa.json, delayed-ready.json, screenshots and logs). The source repository and installed app own separate scene/profile data.
