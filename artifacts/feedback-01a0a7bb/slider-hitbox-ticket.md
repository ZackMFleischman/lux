Keep numeric, Animate and Reset controls clickable at every slider value. Native LUX150 QA found the expanded MUI slider-thumb hit area intercepting Animate above it at value0.8 in a narrow Inspector. This predates the component-model change; keyboard activation works but is not a mouse fix.

Make the smallest shared control-row hit-area/stacking correction without changing values, dragging, keyboard behavior or density unnecessarily. Coordinate with LUX151 ParameterInspector ownership. Verify real pointer activation of Animate, Reset and numeric entry at aligned thumb positions, plus slider dragging and keyboard access in narrow/wide Inspector. Capture actual UI evidence and independently review before integration.

Evidence: .worktrees/component-model/artifacts/component-model/native-1789542533949/result.json and failure.png. Preserve the failed native observation. No forced clicks or synthetic DOM activation as mouse proof.
