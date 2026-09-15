---
name: start-lux
description: Use when the user invokes /start-lux or $start-lux, or asks to open Lux Studio and begin a creative session with its MCP-connected agent.
---

# Start Lux

Start or reuse Lux in this conversation. Load [lux-visual-creation](../lux-visual-creation/SKILL.md) for the creative work. Do not create another agent or task.

## Start

Use the user's selected branch checkout, otherwise the current Lux checkout (normally main; known local repository: C:\Users\zFlei\repos\lux). If a different branch is requested, use its existing checkout or a normal Git worktree; do not switch a checkout occupied by development. Use the project's pinned Node and installed dependencies.

Run one command in that checkout:

```text
node scripts/studio-creative.mjs
```

The launcher uses this checkout directly. It automatically selects a separate creative profile for the checkout, builds into a private output directory, and opens Studio with a hidden helper. A responsive session is reused without rebuilding or changing its scene. The next start after Studio closes builds the current app source. No fetch, reserved version, upgrade procedure, or rollback checkout is needed. Uncommitted source in the selected checkout is included.

If dependencies are missing, use the pinned package manager and frozen lockfile in an idle checkout. Do not reinstall dependencies under active development or a running Studio. The launcher installs a missing pinned Electron runtime with the official checksum-verifying installer. Report concrete startup failures; do not kill another process or launch duplicates around an unreachable live session.

## Connect

Read the returned `mcp` command, arguments, cwd and environment. Start that stdio MCP adapter using the local client described in **lux-visual-creation**, or use configured tools only when discovery confirms the returned profile and checkout. Do not hard-code `creative` or change global Codex configuration.

Wait up to 60 seconds in short intervals for discovery and live read/status. A launch receipt alone does not prove readiness. Retain `studioSession.sessionId` and pass it as `LUX_STUDIO_SESSION_ID` to later temporary adapter connections. A reused app retains its existing build; discovery describes the adapter's current checkout and is not an app-version handshake.

Inspect the existing scene and preview. Carry out the supplied visual brief, or confirm readiness and ask what to create. Preserve the scene and playback state. Save scenes outside development/test artifact directories.

The visual compiler still reads SDK/compiler source and dependencies from the selected checkout. Do development edits in another normal checkout while this Studio runs; private app output is not a self-contained installation. A standalone installed app is separate work.

Development tests use fresh `test-*` profiles and their own build outputs when sharing a checkout. Do not terminate the user's Studio or mutate its private build/profile. GPU load and dependency changes still require coordination. Existing legacy creative sessions and saved files stay untouched; they are not startup prerequisites.
