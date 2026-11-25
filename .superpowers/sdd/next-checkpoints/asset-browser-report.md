# Asset browser implementation

Base: 55372e1. Branch: codex/checkpoint-asset-browser. Worktree: C:/Users/zFlei/repos/lux/.worktrees/checkpoint-asset-browser.

Added an Assets group alongside Files in the existing Source pane. Rows show the logical name, dimensions, original BMP byte count, dirty marker and canvas thumbnail. Clicking or keyboard-activating a row shows a larger image and metadata without opening a TypeScript tab. CodeEditor stays mounted while hidden, preserving code drafts, selection and undo. Returning to a code tab/file restores that editor; diagnostic navigation also returns to code.

Asset selection is tied to document identity/current keys. Byte-only replacement refreshes pixels; removal and new documents cannot leave a stale image selected. Approved pure base64/BMP decoding supplies top-down RGBA to 2D canvas; no URL, browser codec, network or runtime is created. Malformed data displays a local unavailable state. Sidebar scrolling keeps both groups reachable in short panes. Compact CSS checkerboards sit beneath image and thumbnail; canvas alpha is unchanged. The current approved BMP24 decoder is opaque and transparency support is NOT claimed.

Validation:
- Red baseline: existing 9 editor tests passed, four initial asset regressions failed on missing UI.
- Final focused Source editor RTL suite: 14/14 passed (nine existing, five new), no test warnings. Includes two-image pixels, draft/undo round-trip, pixel-only refresh and dirty marker, removal/new document, v1 empty state, malformed image, keyboard activation/source tab return. Canvas mock captures RGBA delivered to the canvas boundary; it does not rasterize pixels or prove native rendering.
- Studio TypeScript check passed.
- CPU-only Studio build including browser renderer and test bundles passed; esbuild child spawning required approved escalation. No Electron/GPU/native/host launch.
- git diff --check passed.

Remaining controls: no import, replace or remove actions in this slice. They require the separately owned trusted file picker and workspace editing APIs. Existing whole-document open/MCP replacement remain the byte entry paths. Native sizing/focus/CSP/pixel QA and transparent codec coverage belong to subsequent coordinator work.

Native selectors: button `View assets/checker.bmp`; region `Asset preview`; canvas role img named `Image preview: assets/checker.bmp`; return button `Open visual.ts` or existing source tab. Thumbnail canvases are decorative.
