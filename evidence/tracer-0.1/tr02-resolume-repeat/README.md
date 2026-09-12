# Visually confirmed reconnect and normal host removal

Run `cf98718d-b6ea-4dcf-b035-75580f8f0edd` repeats the unchanged reviewed producer
against the existing source in Avenue PID 8360. Automated checks passed with
853 additional completed receiver consumptions. Producer exited normally and
the Job confirmed cleanup.

User confirmed: "it moved and then froze as expected, then i cleared the clip and
closed resolume". Subsequent process inspection confirms PID 8360 is absent.
The current host context's log contains no `failure` or
`bounded-unload-unsupported` records. `teardown.json` records this check. This
confirms normal source-removal/host-close behavior for this test, not recovery
from a stalled GPU/driver or a diagnosis of the earlier system crash.
