Source worktree:C:/Users/zFlei/.codex/worktrees/startup-timeout/lux
Commit:77dcee90088ca0b6698817cf155da40bd973381f
Identity:82c1902e-4348-49f1-b079-f716cefb0010
Session:671b59e8-2149-4fbf-a5bd-d8b94fc16a3e
Model:GPT-6.1 Sol high for liveness and source tracing. Independent reviewer:/root/startup_timeout/startup_review, GPT-6.1 Terra high, fresh focused context and no implementation participation.

Corrected diagnosis:parent's installed MCP build on sourceDigest080860269258468c6b5f1f3a1cb955006088ea0dc3015d208e3253674857a7b6 failed with Visual initialization stopped making progress(stage:admission). This is before shader preparation. LUX-223's asynchronous shader patch was not the cause-specific fix for this actual failure; its stage instrumentation localized the failure.

Exact asset CPU timing (admission-timing.mjs and admission-timing.json):512x256JPEG112826bytes verify138.2ms/admission161.9ms;1774x887JPEG637494bytes verify630.9ms/admission1284.0ms. prepareAuthoredModule calls verifyLinked, which synchronously decodes JPEG via verifyDerivedAssets; it then calls verifyDerivedAssets a second time and decodes it again. The first worker heartbeat starts only after this trusted admission and control preparation. Thus valid admission can exceed the prior1250ms deadline before authored code runs. Installed512case also failed admission perparent; CPU timing isolates a threshold hazard rather than proving exact browser timing.

User's later explicit instruction:'just load the thing as long as it takes' superseded retaining a five-second cap. Final code removes the activation timer and only evaluates heartbeat/frame watchdogs once ready===true. It publishes validated startup-progress stages in current initializing job summaries. No new cancellation UI; app close remains escape for nonresponsive candidate. Existing compiler/linker process deadlines and outer MCP operation bounds are separate and unchanged.

Validation:
- no-cap-red.log:before policy change, slow candidate and stage-progress tests fail because candidate is stopped.
- node --test tests/studio/runtime-lifecycle.test.ts:39/39pass (no-cap-green.log). Tests cover20/30s preparation without termination, accepted preview retention, explicit startup failure, loading-stage summary, and accepted runtime1250ms watchdog.
- scene-open fixture wait was corrected from20 immediate callbacks to bounded real5ms polling, since asynchronous hash completion need not finish within20immediates; no production change for this test fixture correction.
- independent review:3focused new policy tests pass; no blocking finding. Reviewer verified no activation timer/missing-heartbeat stop in start before promotion. No native launch.
- pnpm exec tsc -p apps/studio/tsconfig.json --noEmit:see no-cap-typecheck.log and executor completion.
- git diff --check:pass.

Earlier broad unrelated suite limits remain recorded in evidence.md; not rerun to delay this focused user policy change. No native app launch or installed mutation by this worker. Coordinator owns exact user-app close, inactive source overlay/rebuild/digest update, restart and fulltexturedMCP demonstration.
