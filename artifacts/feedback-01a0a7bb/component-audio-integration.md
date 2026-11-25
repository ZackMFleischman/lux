# Component and audio integration

Release correction: the ComponentDefinition union described below is NOT backward source compatible. The older unguarded create annotation must keep compiling; adapting the test was insufficient. LUX168 and LUX-P111 supersede the blanket release pass until the compatibility alias is restored and independently reviewed. LUX150's historical done record cannot be reopened by installed Conductor; LUX151 audio behavior remains independently accepted.

Main merges: component `cd8931f4`, audio `72bdcfa9`. Original candidates: component `df472683234847f426f594ccdd414889c2783c61`, audio `75178a50569d7b923ff6ed3073ac6bdb77b97adc`.

Conflict resolutions retain typed paths2d/shader-field graph admission and runtime resources, the unified code/graph component authoring calls, typed Graph edge layout, revision-aware Library reads and audio output persistence. Code factories use the three-generic CodeComponentDefinition. The general ComponentDefinition is a discriminated union; the earlier type assertion now narrows its kind before accessing create. A new compile/link case covers modern defineVisual with typed named-port fan-out.

Validation: root/examples and Studio typechecks passed. Compiler component-model, typed-composition and shader-field-composition suites passed14/14. Studio CPU runner passed all phases:214,25,17,8,11,4,28,21. Audio MJS suites passed15/15. Full log: combined-component-audio-cpu.log; audio log: combined-audio-unit.log. Original native component and audio receipts remain in their worktree evidence, independently reviewed. Main visual skill installed and --check returned current:true.

Package verification remains a release step. Preserve the user's newer tracer commits, uncommitted Library entry/catalog addition and unrelated copilot edits. No GPU tests ran during integration;166 owns the lane, then tracer, then root combined package.
