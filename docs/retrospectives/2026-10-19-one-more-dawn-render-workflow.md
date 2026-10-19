# Retrospective: One More Dawn render and QA workflow (18–19 Oct 2026)

Scope: efficiency and usability of the workflow used to build the "One More
Dawn" opening (style loop, four parallel clip lanes, video renders). The
creative results are covered by the review records in the feature branch.

## What happened, in numbers

| Measure | Value |
| --- | --- |
| Isolated Studio launches for QA captures (3.8 h) | 343 |
| Failed launches | 253 (74%) |
| Compute spent in failed launches | ~257 min |
| Compute spent in successful launches | ~110 min |
| Median successful launch (typically 3–20 frames) | 62 s |
| First full video render (1,740 frames) | > 40 min, 3 crash/resume cycles, 11 frames impossible |

After the fix (same machine, same scene):

| Measure | Value |
| --- | --- |
| Cold job (compile + start + 3 frames) | 18.7 s |
| Warm job, 3 QA frames | 1.6 s |
| Warm job, 48 frames | 12.8 s |
| Full 1,740-frame video, warm pool | 3 min 17 s, 0 failures, 0 retries |
| One-command video with song mux | 4 min 9 s |

## Root causes (first principles)

The task was "render frame X of source S at time t". Everything the old path
did beyond that was overhead, and most of it repeated per request:

1. **Wrong host.** Each capture launched the full Studio app (Electron main,
   React/MUI/dockview UI, library store, agent bridge) only to use its
   preview worker.
2. **Unwanted startup work.** Studio auto-loads, compiles and plays its
   default noise-sphere scene on every launch before our build starts.
3. **No compile cache.** Every build ran the full chain (PowerShell job
   supervisor → Node → two `tsc` runs → PowerShell → Node → esbuild) even
   for identical source.
4. **No seek.** Time was faked with `pause` + `reset` + a `startAt` control
   change per frame (three MCP round trips), capped by the control's
   maximum (the last 0.5 s of the clip could not be rendered at all).
5. **Bulky transport.** Every PNG travelled as base64 through renderer →
   IPC → agent bridge → HTTP → MCP stdio.
6. **Cold-start contention.** Several lanes launched several full Electron
   apps at once; their shader compiles competed for one GPU and overran a
   hard-coded 5 s visual-initialisation deadline (`standalone-client.ts`).
7. **Retries that amplified the problem.** A timed-out build keeps running
   inside Studio; immediate retries collided with it ("A visual build is
   already running"), adding load. Long sessions also dropped their bridge
   ("fetch failed") and lost all progress because work was not chunked.
8. **Process gaps.** Parallel agents shared one scratch folder and overwrote
   each other's helper scripts; my resume script used a different rounding
   rule from the capture tool's filenames and re-rendered existing frames.

Patching the symptoms (build-slot gate, longer retries, chunking) reduced
failures but kept every root cause. They have been removed.

## Fix: warm headless render pool

`scripts/lux-render.mjs` + `apps/render-pool/`:

- **Host:** one long-lived Electron process with N hidden render windows
  (default 3). No Studio UI, library, bridge or default scene. Each window
  runs the *unchanged* Studio visual worker (bundled by
  `apps/render-pool/build.mjs`), so output matches Studio exactly.
- **True seek:** a new additive worker message, `render-frame`, draws at an
  exact time and returns the encoded PNG in one round trip. Playback state is
  untouched; Studio behaviour is unchanged (visual-worker tests 21/21).
- **Warm reuse:** a window keeps its initialised visual while the job key
  (source hash, linked hash, size, control values) is unchanged; a warm
  prepare takes ~0.1 s instead of ~6 s. The pool exits after 20 idle minutes.
- **Compile cache:** compile + link results are cached on disk by source
  content hash; repeat jobs skip compilation entirely.
- **Direct output:** PNG bytes go from the worker to the pool's main process
  and straight to disk. No base64, no MCP.
- **No arbitrary deadlines:** a single generous per-request timeout replaces
  the 5 s initialisation race; a failed visual is reported per frame and its
  window is reset, never silently retried.
- **One command for video:** `pnpm render video --src <dir> --out x.mp4
  --range 0:72.5:24 --audio <song> [--audio-start s]`.
- The isolated pool never touches the user's Studio or profile and
  serialises nothing on the GPU beyond the pool size.

## Follow-ups (not done here)

- **Studio's own 5 s initialisation deadline** is still hard-coded. Heavy
  scenes can still trip it in Studio itself; it should scale with compile
  progress (heartbeats already exist) rather than wall time.
- **Studio compile cache:** Studio could reuse the same content-hash cache so
  rebuilding unchanged source is instant.
- **Raw-frame video path:** for long renders, piping straight-sRGB RGBA into
  ffmpeg would skip PNG encode/decode (the remaining main cost).
- **Lane hygiene:** give every parallel agent its own scratch folder by
  default (done ad hoc mid-run).
- **Conductor:** the executable named in the global instructions does not
  exist on this machine, so nothing in this run was tracked; registration is
  unknown and needs the user's attention.
