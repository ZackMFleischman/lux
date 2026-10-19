# Scene soundtrack: real-app evidence

## Setup

- Tested source: branch `feature/one-more-dawn-audio`. `report.json` has the exact commit.
- Command: `node apps/studio/build.mjs && node scripts/test-studio-soundtrack.mjs "C:/Users/zFlei/repos/lux/assets/audio/One More Dawn - Disney Tones.mp3"`.
- Studio ran as Electron 44.3.0 from this worktree. It used an isolated `studioTestEnvironment()` profile and a 1360×860 window. Preview ran at 640×360 with the noise-sphere example.
- Playwright cannot drive the native file dialog. The test set the dialog's answer in the main process that the test launched. Every other action used real clicks and keys, or the Studio MCP bridge (`status`, `build`, `scene.save`, `scene.open`).
- The test closed only the Studio process that it launched. It did not touch the user's desktop Studio.

## What was checked (all passed)

Sync numbers come from `status.soundtrack`. `driftSeconds` is the position you hear (from the output timestamp) minus the song position for the current scene time.

| Step | Result |
| --- | --- |
| Link the MP3 | Decoded 323.2 s (5:23). |
| Play | Drift −1.8 ms. Chromium `webContents.isCurrentlyAudible()` is true. |
| Steady 3 s, 40 reads | Max drift 3.0 ms. 0 re-seeks. Output-latency lead 45.6 ms. |
| Pause | The source stops. Output is not audible. |
| Resume | Playback continues from the paused scene time. Drift −1.4 ms. |
| Reset | Clock epoch 1. The song restarts at about 0.8 s. Drift −4.3 ms. |
| Rebuild | Generation 3 → 4. The song follows the new clock. Drift −18.3 ms. |
| Offset 30 s | The song plays at 30 s plus scene time. Drift −1.8 ms. |
| Mute | Gain goes to 0 and the song stays in sync. Mute applies to this session only. |
| Save | The file stores `audio/dawn.mp3` (relative path), the absolute path, sha256, offset 30 and volume 1. |
| Reopen | The relative link loads and plays. Drift −0.5 ms. |
| Missing file | The preview keeps running. The transport shows an amber warning. The popover offers **Relink file…**. |
| 1024 px window | The control stays inside the transport row. |

## Screenshots

- `01-transport-no-soundtrack.png`: transport row before a soundtrack is linked.
- `02-soundtrack-popover-empty.png`: popover open, with no file linked.
- `03-soundtrack-popover-linked.png`: popover with the song linked. It shows offset, volume, session mute and the behavior hint.
- `04-transport-linked-playing.png`: closed control during playback, showing the file name and the mute button.
- `05-transport-muted.png`: muted state.
- `06-transport-missing-file.png`: closed control with the missing-file warning.
- `07-soundtrack-popover-missing.png`: warning text and the Relink action.
- `08-transport-missing-1024px.png`: the same row in a 1024 px window.

## Limits

- `isCurrentlyAudible()` shows that Chromium sends sound to the output device. Nobody listened to the sound during this test.
- The probe compares the heard position with the scene clock. The visual frame shows on the display about one frame later. That display delay is not measured.
- When a new runtime starts, one extra re-seek can occur in the first second. This happens if the first frame arrived late. Small differences settle to a 20 ms bound, and later differences use the 50 ms bound.
