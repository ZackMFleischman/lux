# Lux voice copilot

A small local browser page with Start/Stop listening and speaker controls. The
Node process runs from this repository; no Electron UI or separate frontend build.

## Billing and authentication

- **Voice:** `gpt-live-1` uses `OPENAI_API_KEY` and incurs API charges while active.
- **Delegation:** local `codex exec --json` uses the saved **ChatGPT login** and
  subscription allowance. There is no Responses client or paid model fallback.
- Every Codex invocation forces `forced_login_method="chatgpt"` and
  `model_provider="openai"`. Global Codex settings and login are never modified.
- Run the app as the same OS user with the same `CODEX_HOME` used for `codex login`.
  Codex handles its own credential storage and refresh; this app never reads tokens.
- The child environment excludes `OPENAI_API_KEY`, `CODEX_API_KEY` (case insensitive)
  and all variables containing the voice key. Conflicting provider/auth settings,
  custom base URLs, automatic profiles and stored key injection fail closed.
- Per the user's authorization, all Lux MCP tools use invocation-scoped `approve`
  mode, including saved per-tool approval overrides. Other servers retain their
  permissions. A saved Lux enabled/disabled tool filter fails startup with an
  actionable message; the app does not silently advertise unavailable tools.
- Coding tasks can edit the workspace and run commands/tests. Global settings
  remain unchanged. No unrestricted sandbox or approval-bypass flags are used.
  The agent must obey the repository's prohibition on editing/rebuilding the
  reserved creative checkout. In this V1 that prohibition is instructional:
  `workspace-write` does not technically exclude nested `.worktrees` directories.
  A tested custom subtree permission profile stalled on this installed Windows
  runtime, so it is not shipped. Stronger subtree isolation remains a follow-up.

## Setup

Install the repository dependencies with its pinned package manager:

```powershell
npx --yes pnpm@10.33.0 install
codex --version
codex login status
codex mcp get lux-studio
```

Verified against Codex CLI **0.154.0**, OpenAI SDK **7.15.0**, Node **24.12.0**.
On Windows, `codex.exe` must be on PATH. A shell-only `codex.cmd` install is not
supported by this version. Keep normal USERPROFILE/APPDATA/credential-store access.

`codex login status` must say **Logged in using ChatGPT**. Exit code zero alone is
not accepted. If missing, expired or API-key authenticated, run these yourself:

```powershell
codex login status
codex logout
codex login
```

Choose ChatGPT login. The copilot will not change accounts automatically.

Put the voice key in the **gitignored** `.env.local` at the repository root:

```dotenv
OPENAI_API_KEY=replace-with-your-openai-api-key
```

Do not put this key in Codex configuration or an MCP environment. Existing keys in
`.env.local` are preserved. The file is loaded only by the trusted Node process;
no key or ephemeral credential is sent to the browser or Lux renderer.

## Lux MCP must match the running application

The app reads the existing `lux-studio` entry with `codex mcp get ... --json`.
It uses that same stdio command/profile for a read-only startup status check;
Codex performs all delegated MCP calls itself. It does not select another Lux
instance or rewrite your MCP configuration.

For a normal Studio launched from **this checkout**, the entry must run:

```text
node <absolute-path-to-this-checkout>/scripts/studio-mcp.mjs
```

An explicit `LUX_STUDIO_PROFILE` must match on both sides. Do not point development
checks at the reserved creative checkout. Keep the configuration and running
Studio paired; a different worktree is a different profile.

If the existing entry points at an obsolete checkout, update that entry yourself
with Codex's MCP configuration tools. Inspect `codex mcp add --help` first. For
example, replacing an obsolete entry (this changes your saved configuration):

```powershell
codex mcp remove lux-studio
codex mcp add lux-studio -- node C:\path\to\lux\scripts\studio-mcp.mjs
```

Remove Lux-only enabled/disabled tool filters if you want all tools available.
Organization requirements and non-Lux approvals still apply. An operation that
cannot run under those policies fails accurately; there is no paid fallback.

## Run

```powershell
# Terminal 1 — ordinary development Studio, from the matching checkout
npm run studio

# Terminal 2 — same checkout / OS user / Codex configuration
npm run copilot
```

Open the printed `http://127.0.0.1:<port>` URL in Chrome or Edge. Press **Start
listening**, allow microphone access, and use the default speaker output.
Check the browser microphone indicator and the `Microphone active` log. If audio
autoplay is blocked, press Play in the speaker controls. Headphones reduce echo.

Before any paid voice session is created, startup verifies ChatGPT authentication
and a live Lux MCP status response. Each Start rechecks these. A model/task failure
or subscription limit is returned to GPT-Live as a failure, never retried with API
credentials. Stop releases the microphone immediately, ends Live, and cancels the
local task. Cancellation cannot undo a Lux change that already applied.

```powershell
npm run copilot -- --check-mcp  # authentication + real MCP status, no voice charge
npm run copilot -- --debug      # event names, not raw audio or API keys
npm run test:copilot
```

## Manual smoke test

1. Start matching Lux and run `--check-mcp`. Expect ChatGPT login verified and Lux
   MCP connected. Resolve login, configuration or approval failures first.
2. Start the copilot page. Say **What can you change in Lux?** Expect local Codex
   delegation, an actual MCP inspection and a short truthful spoken answer.
3. Say **Make the current visual faster.** Check that an MCP change actually
   applies to the visible visual before accepting the spoken confirmation.
4. Say **That's too much. Back it off a little.** Check the relative adjustment.
5. Interrupt speech, continue with another turn, then Stop. Confirm the browser's
   microphone indicator goes away. Start again without restarting the Node app.
6. Press Ctrl+C. Check no copilot/Codex/MCP child processes remain.
7. Ask for a small repository file edit and verification. Check the resulting
   diff/file and command output. Software summaries come from the local agent,
   backed by completed command/file events; the adapter cannot independently
   prove the semantic correctness of arbitrary code changes.

Speech fragments append to the current speaker's paragraph, including when tool
activity arrives between fragments. A speaker change, pause, or new session starts
a new paragraph. Activity remains on separate lines.

## Verification performed and limits

**Real checks:** Codex 0.154.0 confirmed ChatGPT login. The complete delegation
adapter successfully invoked `lux.studio.status` against the running creative
Studio and returned a verified inspection summary. A separate coding invocation
wrote `artifacts/copilot-write-smoke.txt` and read back its exact contents. No paid
model fallback was used. The user confirmed live voice conversation works; a
post-fix voice-driven visual change still requires the manual smoke test.

The running creative session was paired using invocation-scoped MCP command,
working directory, profile and session overrides in the local launch helper
`artifacts/start-creative-copilot.mjs`. The saved global entry still points to the
old tracer checkout; normal `npm run copilot` requires correcting that entry as
described above. Global configuration was not changed.

The final MCP startup wrapper also passed against an isolated test-owned Studio (12 tools, successful status read); that test process was closed. This does not prove delegated model execution or a visual change.

**Mocked checks:** authentication classification, missing/API-key login rejection,
key sanitization, enforced invocation flags, limits, completion/error handling,
MCP-backed JSONL output, client delegation transcript/context and result routing,
cancellation, cross-origin control rejection, and preflight-before-voice ordering.
The actual browser client was also checked with simulated audio/network transport:
streamed fragments rendered as paragraphs with one speaker label and separate
activity lines. This UI check did not use the microphone or a paid voice session.

V1 uses one browser session, no persisted conversational memory and no `--last`.
Each task gets a fresh Codex run plus recent transcripts, the preceding verified
result and startup capability metadata. It reads fresh state through MCP. This is
slower than a persistent agent. Transcript fragments can arrive late; when a new
request has no available transcript it asks for repetition instead of replaying
an old command. Model access, microphone playback, service-side billing totals,
real interruptions and final visual changes still require the smoke test above.

## Official references

- [Codex authentication](https://learn.chatgpt.com/docs/auth)
- [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Non-interactive execution and JSONL](https://learn.chatgpt.com/docs/non-interactive-mode)
- [GPT-Live client delegation](https://developers.openai.com/api/docs/guides/live-delegation)
- [Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)
