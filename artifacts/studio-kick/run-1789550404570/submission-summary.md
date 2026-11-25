Ticket: LUX-152
Scope and criteria completed: Studio users can add a kick-transient binding beside existing LFO and continuous audio bindings; tune sensitivity, retrigger interval, linear/exponential attack-release envelope, and amount; preserve manual bases and save/reopen settings; share the one portable analyzer configuration; fence paused/reset/disabled events; and release on disconnect. No BPM, host FFT, MIDI, raw audio, or saved device identity was added.
Tested commits: c19af9350ef9f6b3ae47b71671f72a2a61489230 (independently reviewed application source) and 85ec7c6019b8097b1c154d936337499a06a6ecfb (native-harness-only follow-up and final tested tree).
Delivery: cherry-pick the reviewed application commit and its one-file harness follow-up. Root owns main integration and shipped-skill installation/check.

