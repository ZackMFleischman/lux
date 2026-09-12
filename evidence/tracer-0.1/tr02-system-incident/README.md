# System failure during native probe experiment

User reports the computer crashed and required a restart. The probe visual remained on an otherwise empty screen at its former Resolume location. Exact failure mode and root cause are unconfirmed.

Windows records Kernel-Power 41 and EventLog 6008 for an unclean shutdown. Initial event queries did not return a display-driver reset or bugcheck record. This does not establish the cause or exclude a GPU hang. Final saved baseline records repeat callbacks=29500, intensity=0.65; the counter ceased advancing while log records continued. The shared TEMP log may also contain earlier standalone records and must be attributed by PID/context.

Hardware experiments paused. Do not treat earlier successful context initialization as stability acceptance. Preserve evidence and inspect baseline/context lifetime and concurrently running experiments before any reproduction. No automatic restart or rerun of the probe.

## Offline follow-up

Experimental DLL renamed in place to LuxTracerTR02.dll.disabled after checking Resolume was closed and verifying the recorded SHA256. No GPU workload was launched during investigation.

Standalone test file timestamps overlap the baseline logging window: run02 started 21:36:06 and finished 21:36:31; baseline log last write was 21:36:42 with repeated callback count29500. Run03 artifacts span21:38:46–21:40:00. These establish other test activity near the failure, not the exact instant or cause of the freeze. Logs lack sufficient wall-clock/process-lifecycle correlation for precise attribution.

Post-reboot Application WER events include historical dump names (2025-09-02 and2026-06-16). Their report submission times must not be mistaken for current crash times. No current incident dump was identified by the initial metadata queries.

The staged baseline predates committed receiver72e2369. Exact baseline source provenance remains unresolved. Saved receiver-uncommitted.patch preserves later tracked edits for offline review; it is not the source of the staged DLL.

Before any next hardware run: recover or replace baseline with a fully attributable build; resolve offline ownership/cleanup findings; serialize all experiments, with actual host and standalone mutually exclusive; default diagnostic duration5–10seconds, record source/DLL hashes and PID start/end timestamps, detect stalled progress and fail with evidence. Timeout supervision cannot recover a system-level GPU freeze. Long performance runs remain gated on reviewed short-run stability.
