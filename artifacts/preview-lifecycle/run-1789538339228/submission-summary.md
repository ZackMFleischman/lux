Ticket: LUX-143
Scope and criteria completed: normal Studio startup builds and plays the initial visual; Build runs behind the current preview while controls, animations, and Play/Pause remain live; promotion waits for exact acknowledged state and transfers compatible flat/composition values and animation bindings; saved Scene/Open state remains authoritative; invalid candidates preserve the working visual and edits; file operations retain exclusive protection.
Tested source commit: c7660fd06eb40230436463a53b727960378dfdf0
Validation: typecheck, complete Studio CPU suite, focused lifecycle/concurrency suites, independent source review, and isolated Electron/GPU demonstration passed.
Remaining QA: independent Conductor validation and serial integration by the coordinator. The coordinator owns the shared installed visual-skill write/check because concurrent skill work exists.
Delivery: isolated branch codex/preview-lifecycle; no merge or push performed.

