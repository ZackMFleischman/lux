# System failure during native probe experiment

User reports the computer crashed and required a restart. The probe visual remained on an otherwise empty screen at its former Resolume location. Exact failure mode and root cause are unconfirmed.

Windows records Kernel-Power 41 and EventLog 6008 for an unclean shutdown. Initial event queries did not return a display-driver reset or bugcheck record. This does not establish the cause or exclude a GPU hang. Final saved baseline records repeat callbacks=29500, intensity=0.65; the counter ceased advancing while log records continued. The shared TEMP log may also contain earlier standalone records and must be attributed by PID/context.

Hardware experiments paused. Do not treat earlier successful context initialization as stability acceptance. Preserve evidence and inspect baseline/context lifetime and concurrently running experiments before any reproduction. No automatic restart or rerun of the probe.
