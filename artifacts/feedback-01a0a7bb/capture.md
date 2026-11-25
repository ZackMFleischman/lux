User result: From the Preview menu, save a frame as an image or start/stop a video clip of the rendered output at the designated resolution.
Why now: The user explicitly requests image and video capture as part of the normal creative workflow.
Acceptance:
- Add Save frame and Record/Stop recording actions to the Preview menu, with save destination selection and visible recording status.
- Capture only visual output at the selected output width/height, independent of panel size, display scaling, docking or fullscreen. Use the existing PNG capture path for stills where applicable.
- Produce a playable video; choose and document a supported format after checking the installed runtime. Report failures clearly; preserve the working scene and preview.
- Keep clip dimensions fixed during recording and handle stop, cancellation, runtime replacement and app close without corrupting existing files.
- Demonstrate still and video capture in the actual app. Verify decoded dimensions and clip playback, including a preview smaller than the output resolution.
Checklist: implementation; focused checks; independent code/UI review; integration; real capture demonstration.
Requested in task 01a0a7bb-ee60-76f1-bcd6-5d179614f551. This is output video capture, separate from live-input event recording.
