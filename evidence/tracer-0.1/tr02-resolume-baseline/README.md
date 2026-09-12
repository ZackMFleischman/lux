# Actual Resolume native diagnostic

User triggered Lux TR02 Probe in Resolume and reported a white vertical line moving left to right over a gradient, four colored rectangles in the corners, and a horizontal alpha stripe in the middle.

Live Avenue process PID: 30464. Matching context records report NVIDIA GeForce RTX 2070/PCIe/SSE2, sharedContext=true and nvInterop=true. Callback counters advance; recorded intensity is 0.65.

Staged DLL SHA256: 505782a9bd82215c60d17e88d1e2834aaef295e96035e032eba94661b94697aa.

host.jsonl is a snapshot starting at the first actual Avenue context record. Earlier standalone PID13176 records were excluded. This verifies native source rendering and shared-context creation in the actual host, not browser texture transport or performance acceptance.
