# Connect and operate Studio

## Connection

Use configured `lux.studio.*` tools when available. Tool search can discover a configured server; absence of those tools does not prove Lux lacks an adapter.

For a local coding agent with terminal access, locate the Lux checkout/build used to launch the current Studio. Use known launch context or inspect its process command line when needed; do not ask the user to reconfirm a path already established. Check that checkout for `scripts/studio-mcp.mjs`; do not assume a particular username, drive, or `.worktrees/tracer` directory exists. Launch that **adapter only**, with the project's installed Node version and dependencies:

```text
command: <absolute path to Node executable>
args: [<absolute Lux checkout>/scripts/studio-mcp.mjs]
cwd: <absolute Lux checkout>
transport: stdio
```

The checked project pins Node 24.12.0. The Windows adapter finds the already-running Studio through `%APPDATA%/Lux/Studio/agent-endpoint.json`. Keep its token private. Do not hand-edit the endpoint or copy it to another host. A remote/cloud agent cannot reach this local session merely by knowing the checkout path. If the checkout or running Studio is unavailable, explain the concrete missing connection; don't install packages or start test apps to work around it without that task being requested.

`discover` reads local adapter-checkout files and can succeed with Studio closed. It does not attest to the open app's build. Even the launching checkout can have changed since its last build. Pair the adapter with known launch/build evidence and actual `read`/`status`/operation results; when they disagree, preserve the source and report or investigate the version mismatch. A newer worktree's discovery does not upgrade the running app.

When no configured MCP client tool is available, a temporary `.mjs` script in the checkout can use the already-installed SDK. This skeleton establishes the connection and reads context; extend it to perform the authorized visual work. It is not necessary to persistently change Codex configuration.

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';

const client = new Client({ name: 'lux-visual-creator', version: '1.0.0' });
const call = async (name, args = {}) => {
  const result = await client.callTool(
    { name: `lux.studio.${name}`, arguments: args }, undefined,
    { timeout: 75000 }
  );
  if (result.isError) throw new Error(JSON.stringify(result.content));
  return result;
};
const json = result => JSON.parse(result.content.find(x => x.type === 'text').text);
try {
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [resolve('scripts/studio-mcp.mjs')], cwd: process.cwd()
  }));
  const discovery = json(await call('discover'));
  const current = json(await call('read'));
  // Inspect discovery and current; derive the authorized replacement from current.source.
} finally {
  await client.close(); // closes this adapter connection, not the Studio window
}
```

Run from the verified checkout with its installed Node. Keep a script outside the repo if preferred, resolving SDK imports against the checkout explicitly; merely changing cwd does not change ESM package resolution for a script elsewhere. For captures, retain the `image` content block and display it through the agent's image tool, or write its decoded PNG to an artifact and inspect that image. Text-only JSON output is not visual inspection.

## Current tool shapes

Read live tool schemas if available; these are the checked adapter's contracts. All tool names below have the `lux.studio.` prefix.

| Tool | Arguments and result |
| --- | --- |
| `discover` | `{}` → adapter-checkout SDK source, example, shared types, imports, declared capabilities. No running-app handshake; can succeed with Studio closed. |
| `read` | `{}` → `{ source, draftVersion, ..., status }`. Complete source; don't truncate assets/files when storing it for an edit. |
| `build` | `{ expectedDraftVersion, source }` → `{ draftVersion, status }` after compile/candidate promotion. This is a complete replacement. |
| `status` | `{}` → snapshot containing `authoring`, which is null before a working runtime exists. |
| `capture` | `{}` → PNG image block plus JSON metadata. Captures the current completed frame; it does not advance paused playback. |
| `playback` | `{ instanceId, expectedGeneration, action: 'play' | 'pause' | 'reset' }` → `{ applied, status }`. Reset preserves playing/paused state. |
| `parameters` | `{ instanceId, expectedGeneration, expectedRevisionId, expectedControlSchemaHash, values: { spikeHeight: 0.5 }, mode: 'live' }` → `{ applied, status }`. Use actual runtime `controlSchema` IDs/ranges and `controlSchemaHash`; the patch can change several keys atomically. Unknown keys and stale schemas are rejected. |
| `restart` | `{ instanceId, expectedGeneration }` → replacement runtime status; source and controls retained. Use for recovery when needed, not every edit. |

Obtain `instanceId`, `generation`, `revisionId`, and `playback` from `status.authoring` (or a tool response's `status.authoring`). Map `generation` to `expectedGeneration` and `revisionId` to `expectedRevisionId`; do not invent them. Restart replaces the generation, so refresh guards afterward. For rejected stale guards, reread state and reconsider the action instead of forcing it against an unrelated runtime.

For source edits, `structuredClone(current.source)` is a useful starting point. Modify only the intended entries in `.files`; preserve the remaining bundle. A complete-source build is atomic and version guarded. Typing through Playwright or streaming characters into the user's editor has different concurrency behavior and is not the creation path; token-by-token edit visualization is not exposed by the checked MCP API.

Current tools do not expose scene Save/Open, export, resolution changes or audio inputs. Numeric visual-defined controls are available; color/Boolean/enum controls are not yet supported. Do not claim a tool result performed those actions. Inspect updated discovery for newer capabilities before concluding they remain unavailable.

## Editor and scene commands

In the Source editor, Ctrl/Cmd+S builds and applies the complete edited source bundle to preview; it does not save a single file or the scene to disk. Ctrl/Cmd+Shift+S saves the scene. File Save and Save as remain explicit scene commands. Ctrl/Cmd+F opens editor search; shortcut hints are not permanently displayed. MCP `build` still performs the same complete-source replacement and is the supported agent edit path.

The Source panel's Import images, selected-image Replace and Remove commands change the draft; Build explicitly applies it. PNG/JPEG/BMP source assets also work in an offline Resolume export when the running app reports `assetExport: true`. File Export packages the scene's original image bytes and required runtime for offline playback. This is a UI workflow, not a new MCP export tool; creating a package does not install/register it or prove its behavior in Resolume. See [image assets](image-assets.md) before editing asset records.
