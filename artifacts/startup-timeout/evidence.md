Implementation source: C:/Users/zFlei/.codex/worktrees/startup-timeout/lux
Base: 0e5758e2c4f460a830462d17749d2bb14fcc9abd
Production change: d59ff97aed60aa86c2e034d75f47c446494e8940
Test transport adaptation: 827a2c7301d1d7eaad09b1ff3cb08d28b31eec62
Identity: lux-startup-timeout-20261112 (82c1902e-4348-49f1-b079-f716cefb0010)
Session: 74663b73-55ee-4791-9fde-004a1f0220e3
Model: GPT-6.1 Sol high for cross-thread liveness analysis; independent GPT-6.1 Terra high for async lifecycle review, fresh focused context /root/startup_timeout/startup_review.

Source diagnosis: Three0.186 WebGPUPipelineUtils.js calls device.createRenderPipeline synchronously when its promises argument is null. compileAsync supplies promises and uses createRenderPipelineAsync. Lux ordinary context.renderer.render previously entered the synchronous route during first render; composition already had async preparation. User valid source create/update CPU timing was bounded, and the old GPU path could block same-worker heartbeat. This proves an unsafe call-path, not retrospective attribution of all observed installed failures.

Red/green: red.log reproduces ordinary renderer entering synchronous pipeline creation. stage-red.log proves pre-fix error did not report shader stage. New regression passes with pending async preparation while heartbeat still fires. draw drains first-frame rendering even if authored code ignores its returned promise; awaited multi-render calls preserve order. Startup progress messages carry fixed stage labels, never refresh liveness, and stop after first completed frame. No watchdog/activation threshold changes.

Verification:
- pnpm typecheck: pass all3 configurations (typecheck.log).
- node --test tests/studio/runtime-lifecycle.test.ts:39/39 pass (lifecycle-green.log).
- node --experimental-vm-modules --test tests/studio/visual-worker.test.mjs tests/studio/component-worker.test.mjs: visual suite23/23 pass;8 component transport failures caused by treating startup-progress as reply (worker-green.log). Test transport corrected in827a2c73; component suite11/11 pass (component-green.log).
- independent review final: scoped first-frame fix and diagnostics have no blocking finding. Independent lifecycle39/39 and focused new startup2/2 pass. One independent broad worker run hit a60s Story linking deadline; executor primary broad worker run passed that Story case.
- node apps/studio/test-cpu.mjs: app build passes; combined suite hit harness60s timeout and printed connected-view zero/stale-coverage/host-revision failure (studio-cpu.log).
- pnpm test:unit:414pass,6fail,1skip (unit.log). Failures: review revalidation source/binary mutation+expiry; CPU owner/deadline provenance;251-step boundary; cadence10s/30s supervision; native hang reviewed bounds/private marker; parameter export runtime-validation.cjs missing. None changes startup source; complete project suite is not clean.
- git diff --check:pass.

No native app was launched. Automatic approval review rejected isolated hidden Electron+HTTP repro under user's no-computer-use restriction; no bypass. Coordinator will use authorized installed app through MCP for hardware causal evidence.

Limits: first-frame compileAsync invokes Three onBeforeRender callbacks as well as normal render. Dependent scene mutations must await render promises (existing SDK contract and skills/lux-visual-creation/references/visual-programming.md:95 already require return). Ignored multiple render calls with intervening mutations may differ. Later dynamic pipeline compilation retains prior runtime path and can still stall. Avoiding per-frame compileAsync prevents repeated scene traversal, task yields and duplicate callbacks on every animation frame.

Delivery: coordinator owns fresh-save, exact process stop, inactive installation overlay of ONLY apps/studio/src/visual-worker.mjs and standalone-client.ts, combined audio-preserving rebuild/hash update, restart and MCP demonstration. This worker neither stops user app nor patches active installation.
