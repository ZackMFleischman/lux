# Producer reconnect to an existing Resolume source

Run `9562564a-b8e4-410c-b202-f848cf33a542` used the same source/DLL and same
still-loaded Avenue PID 8360 as the first actual-host test. A new producer PID
9300 advertised a new ring generation; the receiver attached and consumed 863
additional completed frames. Producer generated 873 paint callbacks and drained
all ownership; normal exit and Job cleanup passed. User was not watching this
run, so visual reconnect confirmation is not claimed from it.

The producer first reported its default Intensity 0.65, then the host's retained
value 0.4527473747730255 approximately 60 ms later. This demonstrates eventual
host-value restoration, not first-frame control correctness. Production transport
must wait for the authoritative host snapshot and prove its association with the
first accepted frame; do not hide this gap by claiming reconnect fully accepted.

The actual host remained responsive after the run. Manual source removal and
normal host shutdown are checked separately.
