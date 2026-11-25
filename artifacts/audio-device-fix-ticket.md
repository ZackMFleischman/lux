User result: Studio lists available system audio input endpoints before the first connection. The user can select the virtual SonoBus-fed input and connect it.

Why now: The current control only refreshes devices after a successful default-device connection. A failed default connection leaves only "Default" visible and blocks every explicit input.

Acceptance:
- Discover trusted main-frame audio input endpoints before provider activation, using an explicit narrow permission path. Keep the existing trusted-frame and audio-only security boundary.
- Refresh the list when devices change. Release every temporary discovery stream and listener.
- Acquire the exact selected device. If a saved device is missing, show an actionable error and do not silently use the default input.
- Preserve normal default-device connection when the user selects Default.
- Add focused automated tests for discovery, selection, failure, cleanup, and permission checks.
- Run Studio in an isolated test profile. Show the input selector populated with real Windows endpoints, including CABLE Output when present, and verify selection/connect behavior without changing OS routing, recording audio, or transmitting audio.

Excluded: MIDI, recording, export QA, OS device configuration, SonoBus configuration, network transmission, installed-app integration, and merge.
