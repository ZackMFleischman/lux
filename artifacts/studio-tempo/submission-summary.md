Implemented manual and tap tempo in Studio with persisted BPM, beat-position control modulation, exact guarded runtime/MCP operations, and compact BPM/Tap controls. Background builds synchronize only the incumbent's latest acknowledged BPM into a fresh candidate phase/history; failed builds keep the working preview. Scene v1-v5 migration emits BPM while runtime phase, anchors, and tap history remain ephemeral. Existing LFO, audio-band, and kick bindings retain their exact shapes.

Tested commits: `5a1dc1d7bddc2ca98a61df107651d552cf70967d`, `b34f2a186bce717b9c66a9aeacf64348e2b60638`, and final `2eaee8b78b4fe499419cf2e748c0bb2ad75285a4`.

Remaining delivery: root integrates the reviewed commits to main, installs/checks the shipped visual skill, and performs combined post-integration validation. Automatic audio beat estimation and Resolume host/export tempo behavior remain explicitly excluded.
