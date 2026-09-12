# Completed standalone GPU transfer after discovery repair

Source: `619ab44`. Run: `c2171c69-a48d-4914-b84e-ad813a968251`.

`diagnostic.json` passed; both children exited 0 and `manifest.json` records
cleanupComplete true. Producer had 284 paint callbacks and no retained leases at
shutdown. Receiver recorded 92 completed consumptions and retained its final
image after producer shutdown. `final.png` is the final standalone RGBA readback
with rows flipped from OpenGL bottom-left order for display, not per-frame CPU
transport. No actual Resolume, 60 fps, latency or quantitative alpha/color
acceptance is claimed.

The regression replaced 500 worker iterations with steady-clock 500 ms discovery
deadlines. Independent review found no blocker to this run. The previous system
incident's root cause is still unconfirmed; this run was exclusive and supervised.
