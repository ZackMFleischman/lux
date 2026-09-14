---
name: start-lux
description: Use when the user invokes /start-lux or $start-lux, or asks to open Lux Studio and begin a creative session with its MCP-connected agent.
---

# Start Lux

Start or reuse the user's isolated creative Studio in this conversation. Load [lux-visual-creation](../lux-visual-creation/SKILL.md) first and delegate all creative work to it. Do not create another agent or task.

## Reserve and refresh the creative version

Use the user's specified Lux repository, otherwise the known local checkout `C:\Users\zFlei\repos\lux`. Follow its applicable instructions and use its pinned Node. Invoke:

```text
node scripts/studio-creative.mjs --prepare
```

This reserves `.worktrees/lux-creative` at the selected latest-main commit on first use and records the checkout and commit under the `creative` Studio profile. Resolve that target with the automatic refresh procedure before calling `--prepare`. If the source checkout is not already at the selected SHA, create a temporary detached source worktree at that SHA and run `--prepare` there; never move a development checkout to make the reservation. Read the returned paths rather than assuming the current development worktree is the creative runtime. The command itself neither upgrades an existing reservation nor changes its source. Before every later normal creative start, follow the automatic refresh procedure below. A missing or changed reservation is a concrete startup problem; preserve it rather than resetting it.

On first use, if the reserved checkout has no local dependencies, run `pnpm install --frozen-lockfile` **in that returned checkout**, using the project's pinned Node and pnpm. This is part of starting Lux, not a separate permission question. Keep its own `node_modules`; do not link development dependencies. Do not reinstall dependencies in an already prepared or running creative session.

Normal creative startup installs a missing pinned Electron runtime with the official checksum-verifying installer and shared download cache. No global Electron install is needed. `pnpm studio:setup` prepares or repairs the runtime explicitly; `pnpm studio:check` checks it without downloads. Run these in the reserved checkout. For an older reservation without those commands, use its documented `node node_modules/electron/install.js` setup without changing its pinned source. Preserve any concrete installation/provenance stop; do not substitute retained unverified binaries. An installer/network failure must be reported as a failed start, not readiness.

Run from the same source repository:

```text
node scripts/studio-creative.mjs
```

This reuses a responsive creative Studio, or builds the pinned checkout once and starts it with `LUX_STUDIO_PROFILE=creative`. The detached helper is hidden; Studio opens visibly. It returns the checkout, commit, adapter path and launch log. A launch receipt is not proof that Studio is ready. Do not use `pnpm studio` in a development checkout as a fallback.

## Connect the creative agent

Follow **lux-visual-creation** using the returned pinned adapter and `LUX_STUDIO_PROFILE=creative` in that adapter process's environment. Configured tools are usable only when discovery confirms this exact profile and checkout. Otherwise use the creative skill's local stdio client with that explicit environment; do not change global Codex configuration or environment variables.

Wait up to 60 seconds in short intervals for successful discovery and live read/status. Retain `studioSession.sessionId`; for later temporary adapter connections pass it as `LUX_STUDIO_SESSION_ID` so they cannot select a replacement process silently. If an existing process is unreachable, inspect its logs without launching duplicates or killing it. Keep credentials private.

Once ready, use **lux-visual-creation** to inspect the existing scene and preview. Carry out a supplied visual brief; otherwise confirm readiness and ask what the user wants to create. Preserve the scene and playback state during startup. Save creative scene files outside development/test artifact directories.

## Automatically refresh to latest main

The user has standing authorization to refresh the creative session on every normal start. Do not ask for permission. First starts select verified latest main before reserving it; later starts run this procedure before launch and upgrade whenever verified latest main differs from the reservation. `studio-creative.mjs` has no upgrade flag: do not invent one or reset its reservation blindly.

1. Fetch `origin/main` and compare its tip with local `main`: select whichever is a descendant of the other, and stop if they diverge. Record both hashes and the chosen target, then use that captured target for this whole startup; do not re-resolve it mid-upgrade. For an existing reservation, the target must descend from its recorded commit; never downgrade or silently select one side of a divergence. On first use, run `--prepare` from a clean source checkout at that target, creating a temporary detached source worktree when necessary, so the initial reservation is latest main rather than arbitrary HEAD.
2. Read the `creative` profile's `checkout.json`, build record, endpoint, and persistent profile/library data. If the target equals the recorded reservation commit, reuse the creative Studio directly: do not snapshot, save, close, or restart it. If the target differs and the endpoint PID is live, confirm its workspace equals the reserved checkout, then use the creative MCP adapter to retain the complete `read` bundle (including links and assets) and `status` state (including controls and playback). Before closing, verify that the current adapter can restore every retained working-scene state: MCP restoration covers the bundle, scalar controls, and playback, but may not cover animation bindings or unsaved file metadata. Preserve unavailable state through supported Save/Open only when UI use is authorized; otherwise report the concrete preservation blocker without seeking another upgrade approval. Keep snapshot bytes and private endpoint/profile data out of chat and logs. If the endpoint has no live PID, it is a valid closed session: do not require live `read` or `status`; back up its persistent profile and library data and continue only when the reserved tracked source is clean.
3. Before changing a differing reservation, retain the old `checkout.json` and archive the complete creative profile, library data, `build.json`, and built `apps/studio/dist` without exposing private tokens. Create and lock a separate `.worktrees/lux-creative-rollback-<shortsha>` checkout with `git worktree add --detach` at the old commit, and store the old build/profile archive with that rollback. Do not use `reset`, `clean`, or a mutable development checkout as the rollback copy.
4. For a live session, recheck the endpoint PID and workspace, then close only that verified creative Studio after its MCP snapshot and backup complete. Prefer its normal close path. If it remains alive, use host process control only for the revalidated endpoint PID; never terminate by process name or touch a test/development/other creative process. Verify it exited before changing the checkout.
5. Require a clean tracked reserved checkout for both live and closed sessions before unlocking it. Unlock only the known reservation, check out the recorded target SHA, and relock it with its creative-reservation reason. Align local dependencies with the pinned Node and `pnpm install --frozen-lockfile` when the target requires it; never reuse development `node_modules`. After the checkout and dependencies verify cleanly, write the active version-1 `checkout.json` with the canonical reserved path and target commit. Archive the old active `build.json` and remove or move the active one so the shipped launcher builds the target instead of trusting old hashes.
6. Run `pnpm studio:setup` in the upgraded reserved checkout when the Electron runtime is absent or invalid, then `node scripts/studio-creative.mjs` from that checkout. Confirm live discovery, `read`, and `status` through its returned `creative` adapter/session. For a live-session upgrade, restore the retained bundle with MCP, then reapply its recorded controls and playback state and verify them in `status`; report any unsupported restoration rather than claiming arbitrary unsaved file metadata survived. Keep the rollback copy until this verification succeeds; if any upgrade step fails, restore the recorded old checkout/build/profile and report the failure rather than declaring readiness.

Development agents must not modify, rebuild, update, test against or terminate the reserved creative checkout/instance outside this automatic creative-start refresh procedure. Studio tests use unique `test-*` profiles. GPU load still shares the machine and needs coordination.
