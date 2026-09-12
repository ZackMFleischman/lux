# Actual Resolume WebGPU transfer and Intensity test

Source: `048fa8d`; native DLL built from `619ab44`, SHA256
`af739bc0d4f26db6d83416ab47fcf5d245f3241ce767dea80d091ab782fe540a`.
Run: `33558649-2ffd-44c8-b0c5-194c75a15c62`.

User loaded one Lux TR02 Probe in an empty composition. Read-only module
inspection verified Avenue PID 8360 loaded the staged DLL from the configured
Extra Effects directory; the review included that file and Avenue.exe hashes.

The 15-second producer generated 877 paint callbacks. The evaluator observed
866 completed receiver consumptions before its final sample. Subsequent live
host counters reached 868 while repeating the final image. Producer reported
WebGPU ready, closed true, no failure, no held/uncertain textures and no telemetry
loss. The job finished normally with cleanupComplete true. It supervised the
producer, not user-owned Resolume.

103 host-control changes were observed by the producer, spanning 0 through 1.
User explicitly confirmed movement, image color response to Intensity, and a
frozen final frame after producer shutdown. This proves the diagnostic's actual
WebGPU -> Electron shared texture -> native D3D -> FFGL/Resolume image path and
the reverse host control path on this machine.

It does not establish production integration, full frame/control provenance,
numeric color/alpha tolerances, five-minute 1080p60 performance, host unload,
multiple instances, resize, or device-loss recovery. The previous crash's root
cause remains unconfirmed.

The first launch request was refused before process creation because PowerShell
JSON conversion removed a trailing zero from the host creation timestamp. The
review record was normalized back to CIM's round-trip timestamp text; source and
binaries were unchanged. This refusal is not a failed GPU run.
