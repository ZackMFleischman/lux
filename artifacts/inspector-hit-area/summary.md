LUX-166 verifies that Inspector numeric entry, Animate and Reset remain pointer-clickable when a slider thumb sits directly below them. The minimal shared heading stacking fix already exists in audio commit82cce9e8; this work reuses it and adds focused native regression coverage instead of duplicating production CSS.

Candidate47ccc6a3e6accaf6b76ca3fe39713d3853b925de passed native real-pointer, drag and keyboard checks at wide/narrow viewport sizes with640x360 preview. Exact source, commands, original failed observation and screenshots are in evidence.md. All owned app processes exited and GPU is released.

Remaining: fresh independent source/UI review and coordinator integration. No installation or skill changes are required by this test-only slice.
