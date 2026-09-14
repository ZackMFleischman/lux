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

## Upgrade the creative version on an explicit request

An explicit user request to upgrade the creative session authorizes this procedure; do not ask again before carrying it out. Ordinary startup remains pinned and never upgrades. `studio-creative.mjs` has no upgrade flag: do not invent one or reset its reservation blindly.

1. Discover the `creative` profile and read its `checkout.json`, `build.json`, endpoint, live `status`, and complete scene bundle. Confirm the endpoint workspace equals the reserved checkout and retain its session ID and PID. Save the current scene through Studio's supported file workflow, outside test artifacts, and keep its path. If the current work cannot be saved or the endpoint, checkout, or scene state cannot be verified, stop and report the concrete problem.
2. Record the reservation's current commit and fetch `origin/main`. Compare the fetched tip with local `main`: select whichever is a descendant of the other, and stop if they diverge. The selected target must also descend from the reserved commit; never downgrade or silently select one side of a divergence. Record both commit hashes and the chosen target.
3. Preserve rollback before changing the reservation: retain the old reservation record, source commit, and build record. Create and lock a separate `.worktrees/lux-creative-rollback-<shortsha>` checkout with `git worktree add --detach` at the old commit, then copy the reserved checkout's `apps/studio/dist` into it as the old build. Do not use `reset`, `clean`, or a mutable development checkout as the rollback copy.
4. Recheck the endpoint PID and workspace, then close only that verified creative Studio after its scene and state are preserved. Prefer its normal close path. If it remains alive, use host process control only for the revalidated endpoint PID; never terminate by process name or touch a test/development/other creative process. Verify it exited before changing the checkout.
5. Require a clean tracked reserved checkout. Unlock only that known reservation, check out the recorded target SHA, then relock it with its creative-reservation reason. Align its local dependencies using the pinned Node and `pnpm install --frozen-lockfile` when the target requires it; never reuse development `node_modules`. Replace the creative reservation and build records only after the target checkout and dependencies verify cleanly.
6. Run `pnpm studio:setup` in the upgraded reserved checkout when the Electron runtime is absent or invalid, then `node scripts/studio-creative.mjs` from that checkout. Confirm live discovery, `read`, and `status` through its returned `creative` adapter/session. Reopen the saved scene with Studio's supported workflow and verify the preserved source and controls. Keep the rollback copy until this verification succeeds; if any upgrade step fails, restore the recorded old checkout/build and report the failure rather than declaring readiness.

Development agents must not modify, rebuild, update, test against or terminate the reserved creative checkout/instance outside this explicit-user-request upgrade procedure. Studio tests use unique `test-*` profiles. GPU load still shares the machine and needs coordination.
