---
name: start-lux
description: Use when the user invokes /start-lux or $start-lux, or asks to open Lux Studio and begin a creative session with its MCP-connected agent.
---

# Start Lux

Start or reuse the user's isolated creative Studio in this conversation. Load [lux-visual-creation](../lux-visual-creation/SKILL.md) first and delegate all creative work to it. Do not create another agent or task.

## Reserve a stable creative version

Use the user's specified Lux repository, otherwise the known local checkout `C:\Users\zFlei\repos\lux`. Follow its applicable instructions and use its pinned Node. Invoke:

```text
node scripts/studio-creative.mjs --prepare
```

This reserves `.worktrees/lux-creative` at the current committed HEAD on first use and records the checkout and commit under the `creative` Studio profile. Later starts keep that version. Read the returned paths rather than assuming the current development worktree is the creative runtime. The command neither upgrades an existing reservation nor changes its source. A missing or changed reservation is a concrete startup problem; preserve it rather than resetting it.

The pinned checkout needs its own dependencies from its frozen lockfile and the approved pinned Electron executable. Follow the project's setup instructions if these are missing. Do not link development `node_modules`, substitute another worktree's native binaries, or bypass an existing installation/provenance stop. Explain the missing prerequisite if setup is blocked.

Run from the same source repository:

```text
node scripts/studio-creative.mjs
```

This reuses a responsive creative Studio, or builds the pinned checkout once and starts it with `LUX_STUDIO_PROFILE=creative`. The detached helper is hidden; Studio opens visibly. It returns the checkout, commit, adapter path and launch log. A launch receipt is not proof that Studio is ready. Do not use `pnpm studio` in a development checkout as a fallback.

## Connect the creative agent

Follow **lux-visual-creation** using the returned pinned adapter and `LUX_STUDIO_PROFILE=creative` in that adapter process's environment. Configured tools are usable only when discovery confirms this exact profile and checkout. Otherwise use the creative skill's local stdio client with that explicit environment; do not change global Codex configuration or environment variables.

Wait up to 60 seconds in short intervals for successful discovery and live read/status. Retain `studioSession.sessionId`; for later temporary adapter connections pass it as `LUX_STUDIO_SESSION_ID` so they cannot select a replacement process silently. If an existing process is unreachable, inspect its logs without launching duplicates or killing it. Keep credentials private.

Once ready, use **lux-visual-creation** to inspect the existing scene and preview. Carry out a supplied visual brief; otherwise confirm readiness and ask what the user wants to create. Preserve the scene and playback state during startup. Save creative scene files outside development/test artifact directories.

Development agents must not modify, rebuild, update, test against or terminate the reserved creative checkout/instance. Studio tests use unique `test-*` profiles. GPU load still shares the machine and needs coordination. Creative upgrades require an explicit user request, preservation of current work, and a deliberate new reservation; startup never performs them.
