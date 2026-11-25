User result: Read the selected audio device clearly while audio is connected.

Observed: The top-bar audio selector shows overlapping lines of device text when connected. The label is hard to read and appears to include text beneath the friendly device name. See the attached user screenshot.

Acceptance:
- Render one legible device label in the connected selector.
- Keep long names on one line with clean truncation and a tooltip containing the full friendly name.
- Preserve input selection, connection state, Monitor, and Disconnect behavior.
- Check disconnected and connected states with VB-Audio CABLE Output and a long device name in the actual app.
- Include before/after screenshots and independent UI review before merge.

Evidence: artifacts/audio-selector-overlap/reported.png
Likely surface: apps/studio/src/audio/AudioInputControl.tsx and shared Select styles. Root cause is not yet established.
Scope: Bug report only. Do not dispatch implementation yet.
