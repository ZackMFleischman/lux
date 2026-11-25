Completed QA:
1. Deterministic silence, steady-noise, one sustained onset, two separated onsets, peak latching through stalled acknowledgement, retrigger, finite linear/exponential envelopes, generation reset, pause/reset/disabled fences, and disconnect release all pass in CPU tests.
2. Strict legacy LFO and continuous audio records remain valid and exact; the new kick record rejects extra or out-of-range fields.
3. Native Studio at 640x360 connected one real OS input, showed a kick response beside a continuous highs response, saved/reopened exact settings without device identity, and released both contributions on disconnect.
4. Independent source and screenshot/UX/evidence reviews pass.

Remaining integration QA:
- Root must cherry-pick onto current main, reinstall the shipped `lux-visual-creation` skill from that checkout, run its install check, and run the normal combined checks after integration.
