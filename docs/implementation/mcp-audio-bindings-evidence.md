# MCP audio bindings delivery evidence

User result: an agent can bind any discovered numeric visual control to the shared audio bands or kick response, using the existing animation engine. The user later explicitly authorized listing inputs and reconnecting their chosen CABLE Output source through MCP.

The generic `lux.studio.animation` command preserves runtime, revision, schema and binding identity guards. `lux.studio.audio.inputs`, `audio.connect`, and `audio.disconnect` use the existing audio provider and permission broker. The new running-app capabilities prevent a newer adapter from sending these commands to an older app. Read-only `status.audioInput` reports availability and normalized bands; it contains no device IDs or raw audio.

## Source and review

- Worktree: `C:/Users/zFlei/.codex/worktrees/mcp-audio-bindings/lux`; base `0e5758e2c4f460a830462d17749d2bb14fcc9abd`.
- Ticket LUX-221; material user correction recorded once as LUX-P123.
- Independent reviewer: native agent `/root/mcp_audio/audio_review`, GPT-6.1 Terra medium, selected for focused protocol and permission review. Initial device-label finding was fixed and independently rechecked.
- Runtime now tracks the exact active input in local memory so an MCP connection cannot leave a different device name displayed. No device identity is saved into scenes.

## Validation by implementation worker

- `node node_modules/typescript/bin/tsc -p apps/studio/tsconfig.json --noEmit`: pass.
- Final focused audio provider/runtime, animation transport/dispatch and real MCP registration tests: 29 pass. Earlier broader focused run included Story/composition regressions: 37 pass.
- Built React interaction suite: 55 pass, including external audio connection and disconnect state.
- Source visual skill installed with `node scripts/install-visual-skill.mjs`; `--check` reports current with no missing/changed/unexpected files.
- Full general unit run: 417 pass, 3 fail, 1 skip. Native cadence and native stop option tests lack their built executable in this fresh worktree. Parameter-export lacks generated `tools/gpu-spike/runtime-validation.cjs`. These are not a passing full suite.
- Isolated MCP app test failed before its first explicit build with `Studio is busy or command is unsupported` during automatic startup. It did not exercise the new binding call. Live installed activation and connected music response remain separate QA owned by the main agent.

Raw local logs and installation receipt: `artifacts/mcp-audio-bindings/` in this worktree. No physical input was acquired by the implementation worker, and no computer automation was used.

## Staged installation handoff

`C:/Users/zFlei/AppData/Local/Programs/Lux/builds/0e5758e2-f34cb8d0/installation.json` contains the inactive matching app and adapter. After packaging, source was refreshed with the reviewed input-label fix, the installed app was rebuilt, and the package source digest was recomputed using the package input algorithm. The main agent owns activation, reopening the saved user scene, exact input selection, binding and music-response demonstration. The existing user process was never stopped by this worker.

This package also carries the current asset limits: 32 MiB per original image and 8192 pixels per side. The full-resolution texture JPEG (637494 bytes, 1774 by 887) passed actual asset admission and decode. The 2709029-byte original PNG passed the size budget but its `caBX` ancillary metadata chunk is unsupported by the decoder. Do not attribute that format rejection to the size limit.

## Remaining live QA

Read running capabilities and fresh guards. Reopen the saved scene, list audio inputs, select the exact authorized CABLE Output label, connect using the existing analyzer configuration, then bind the declared numeric parameters. Check separated `status.audioInput` samples and `authoring.effectiveControls`, plus completed-frame captures, with music playing and paused. Confirm save/reopen retains portable bindings and requires a fresh physical connection. No CPU result alone demonstrates an actual music input.
