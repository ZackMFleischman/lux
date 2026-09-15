# Lux Copilot implementation checkpoint

The user's latest scope supersedes the initial native-audio/Responses plan:

1. Keep a small Start/Stop browser voice page served by the repository's Node CLI.
2. Verify saved ChatGPT Codex login and the existing lux-studio MCP entry before
   starting paid GPT-Live voice.
3. Use client delegation, reconstruct tasks from transcripts/application metadata,
   execute with local Codex and enforced auth/provider settings, then append results.
4. Fail closed on missing/API auth, limits, tool refusal, incomplete work and cancel.
5. Test owned adapters with mocks; separately report actual local/service checks.

Implementation is in tools/live-copilot. See its README for current behavior,
commands, billing separation and evidence limitations. Initial work began at
30922c2c49693db15f18551444e9715e580f5e12, branch feat/live-copilot-v1. Work tracked
as LUX-125. Scope correction receipt LUX-P106.
