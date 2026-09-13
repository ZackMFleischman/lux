# Creative workflow checkpoint

The goal is to create a visual you actually want, iterate on it, and identify what makes that work awkward. This is an internal authoring checkpoint, not release acceptance. [Current priorities](current-priorities.md#active-order-creative-workflow-feedback-first) put this ahead of additional infrastructure.

## Start on this Windows host

The working integration checkout is `C:\Users\zFlei\repos\lux\.worktrees\tracer`. From that directory, `pnpm studio` builds and opens Studio. Use one Studio instance for the session. An already-running Studio can be used directly; starting a separate test app is unnecessary.

For an external agent, prefer configured `lux.studio.*` tools. If absent, the existing standalone MCP server uses:

- Command: `C:\Program Files\nodejs\node.exe`
- Argument: `C:\Users\zFlei\repos\lux\.worktrees\tracer\scripts\studio-mcp.mjs`

These paths were verified on this host; they are not a claim about another computer. The adapter connects to the current Studio and does not launch one. A client with shell access can use its installed MCP SDK stdio client, as the previous successful external session did. Do not print the private endpoint token or modify client/account settings merely to run the session.

## A real creation session

1. Describe one visual you want to make: its movement, shapes/materials, palette and intended feel. Start with procedural graphics; choose the actual brief rather than a prescribed test pattern.
2. Have the agent read SDK discovery and current source, build a first draft, capture the rendered image and inspect it. Building updates the preview; playback is controlled separately. The agent can explicitly play or pause through MCP when the task calls for it.
3. Give visual feedback in your own terms. Have the agent revise and capture again. Keep iterating on the result; checking off infrastructure tests is not the purpose of this session.
4. Try one small manual source edit and Build, then ask the agent for another revision. This tests whether manual and AI work fit together; the agent must read the latest draft before replacing it.
5. Save the `.lux-scene` using Studio's Save command, then reopen it. Keep the scene as the starting point for the next session. Save/open are Studio actions, not currently exposed MCP operations.

Copyable agent prompt, after starting Studio:

> Work with me on this visual in the running Lux Studio: [your visual brief]. Use the Lux Studio MCP adapter on this Windows host at C:\Users\zFlei\repos\lux\.worktrees\tracer\scripts\studio-mcp.mjs, or the configured lux.studio tools. Read discovery and current source first. Build actual executable visual code, capture the real output and inspect it, then iterate with my visual feedback. Preserve the latest draft version and use the guarded playback/parameter operations when needed. Do not launch another Studio, run automated Studio tests, change Resolume, or start infrastructure work. Keep explanations about what changed in the visual concise. Tell me when to save the result in Studio.

## Feedback that determines the next work

Record the action you were trying to take, what got in the way, and how you expected it to work. Prioritize lost work, blocked creative intent and slow/confusing iteration first; then repeated interaction friction; then visual polish. Save the actual scene alongside a short note so the next fix has a real example.

Current authoring supports multi-file TypeScript and one built-in Intensity control at fixed 1920×1080 output. General visual-specific controls, image imports, audio setup, a graph and multiple independent pane views are not complete. If the next useful visual needs one of these, that concrete need should promote its smallest coherent implementation slice; it should not trigger completion of every unrelated milestone first.

Existing native Studio and MCP regressions support this starting point. The compact UI patch has its own review/QA gate; the current working build remains usable while that patch is finished. Success here means real user iteration and actionable feedback, not a claim that all tracer, hardware or installed-release gates pass.

## Current implementation reconciliation — 13 September 2026 UTC

The earlier single-Intensity, missing-image-import and pending compact-UI statements describe historical gaps. SDK 0.2 now supports visual-specific code-declared numeric controls through the compact Inspector and guarded MCP operations. Scene save/open and cached restart preserve their values. PNG/JPEG imports, replacement and removal are integrated; Build applies source/asset changes while a failed build retains the last good visual. The compact controls and in-app discard confirmations have passed real Studio checks. See the [executed Studio evidence](../../evidence/tracer-0.1/parameters-images-studio/validation.md) and the [current SDK 0.2 export scope](tracer-export-scope.md#current-sdk-02-requirement-addendum--13-september-2026-utc).

Continue the creative workflow above using these delivered capabilities. Under [DEC-13](../decisions.md) and the [export workflow](tracer-export-scope.md#user-workflow), create and preview in Lux, then export independent immutable Resolume sources. This reconciliation does not add audio or graph functionality, waive any host/performance acceptance gate, or claim tracer completion; [PROGRESS](../../PROGRESS.md) records the remaining evidence.
