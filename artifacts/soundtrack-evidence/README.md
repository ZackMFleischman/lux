# Scene soundtrack: real-app evidence

## Setup

- Tested source: branch `feature/one-more-dawn-audio`, which includes the review fixes. `report.json` records the parent commit (`source`), because the evidence is committed with the fixes.
- Command: `node apps/studio/build.mjs && node scripts/test-studio-soundtrack.mjs "C:/Users/zFlei/repos/lux/assets/audio/One More Dawn - Disney Tones.mp3"`.
- Studio ran as Electron 44.3.0 from this worktree. It used an isolated `studioTestEnvironment()` profile and a 1360×860 window, then a 1024×760 window. Preview ran at 640×360 with the noise-sphere example.
- Playwright cannot drive the native file dialog. The test set the dialog's answer in the main process that the test launched. Every other action used real clicks and keys, or the Studio MCP bridge (`status`, `build`, `scene.save`, `scene.open`).
- The test closed only the Studio process that it launched. It did not touch the user's desktop Studio.

## What was checked (all passed)

Sync numbers come from `status.soundtrack`. `driftSeconds` is the position you hear (from the output timestamp) minus the song position for the current scene time.

| Step | Result |
| --- | --- |
| Link the MP3 | Decoded 323.2 s (5:23), within the 20 min and 1.5 GB decoded limit. |
| Play | Drift −0.7 ms. Chromium `webContents.isCurrentlyAudible()` is true. |
| Steady 3 s, 40 reads | Max drift 1.8 ms. 0 re-seeks. Output-latency lead 52.4 ms. |
| Pause | The source fades out over 15 ms and stops. Output is not audible. |
| Resume | Playback continues from the paused scene time. Drift −3.5 ms. |
| Reset | Clock epoch 1. The song restarts at about 0.9 s. Drift −11.3 ms. |
| Rebuild | Generation 3 → 4. The song follows the new clock. Drift −18.7 ms. |
| Offset 30 s | The song plays at 30 s plus scene time. Drift −0.2 ms. |
| Mute | Gain goes to 0 and the song stays in sync. Mute applies to this session only. |
| Save | The file stores `audio/dawn.mp3` (relative path), the absolute path, sha256, offset 30 and volume 1. |
| Reopen | The relative link loads and plays. Drift 0.2 ms. |
| File removed | The preview keeps running. The single "File unavailable" warning names the file and its folder. The full path is in a tooltip. The popover offers **Relink file…**. |
| 1024 px window | The transport row ends inside the window. The page has no horizontal overflow (`scrollWidth` 1024). |

## Behavior notes

- **Story scenes:** the song follows the global scene clock (`timeSeconds`). Story beat seek, replay and loop do not move it.
- **Looks:** loading a Look removes the soundtrack, because a Look becomes a new untitled scene.
- **Missing or changed files:** missing, unreadable and changed files give one combined status. A scene therefore cannot reveal which paths exist.
- **Fades:** every start, stop and drift re-seek uses a 15 ms gain fade.

## Screenshots

- `01-transport-no-soundtrack.png`: transport row before a soundtrack is linked.
- `02-soundtrack-popover-empty.png`: popover open, with no file linked.
- `03-soundtrack-popover-linked.png`: popover with the song linked. It shows offset, volume, session mute and the behavior hint.
- `04-transport-linked-playing.png`: closed control during playback, with more space between the mute and "…" buttons.
- `05-transport-muted.png`: muted state.
- `06-transport-missing-file.png`: closed control with the warning.
- `07-soundtrack-popover-missing.png`: the short warning, the folder name with the path in a tooltip, and Relink.
- `08-window-1024px.png`: the full 1024 px window.
- `09-transport-1024px.png`: the transport row at 1024 px.

## Limits

- `isCurrentlyAudible()` shows that Chromium sends sound to the output device. Nobody listened to the sound during this test.
- The probe compares the heard position with the scene clock. The visual frame shows on the display about one frame later. That display delay is not measured.
- When a new runtime starts, one extra re-seek can occur in the first second. This happens if the first frame arrived late. Small differences settle to a 20 ms bound, and later differences use the 50 ms bound.
- The decoded-size limit is checked after decoding. A file that is too long is decoded once, rejected and released.
- The invalid-offset message on the field is covered by the DOM test, not by this real-app run.
