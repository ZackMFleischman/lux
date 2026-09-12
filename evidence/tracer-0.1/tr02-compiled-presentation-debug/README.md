# Compiled presentation failure

Run `252c3c38-7a88-4138-a9a9-2bfe95cfc9f7` failed its corrected evaluator.
Both processes exited normally and the Job confirmed complete cleanup.

The compiled source's first render used the host snapshot 0.6499999761581421,
rather than the saved scene value 0.91. `worker.png` is a diagnostic readback
of the intermediate render target. Worker heartbeats advance through frames,
but the compositor produced only one paint and the receiver consumed one black
frame. This is not successful compiled visual transport.

The manifest inventories the exact source and binaries used by this run. It
includes local paths for attribution; generated artifacts are not a portable
installation. Earlier runs with the previous evaluator incorrectly returned
success for a single frame; those outcomes do not establish animation.

The next diagnostic adds a capture of the output canvas to isolate presentation
from compositor delivery. This extra capture was not part of this run. GPU
testing was paused at the user's request while Studio was in use elsewhere.
