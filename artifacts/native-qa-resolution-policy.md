# Native QA resource adjustment

User requested evaluation and mitigation of possible GPU/memory contention on 2026-09-16.

Observed snapshot: 50.09 GiB free of 63.83 GiB RAM; NVIDIA RTX 2070 reported 845 MiB of 8192 MiB GPU memory and 25% utilization. No top-level Lux/Electron processes were found at that instant. This does not establish historical peak use or disprove earlier contention.

Existing Studio DEFAULT_OUTPUT is 1920x1080 at 60fps; ordinary harnesses inherit it. Do not change production defaults.

Routine UI, graph, control and audio mapping tests should set actual render output to 640x360 using the existing Preview resolution scale, then verify and record runtime output size. Keep application windows at representative desktop/narrow sizes for layout review. A smaller window alone does not reduce offscreen rendering work.

Retain native startup/default assertions at the true default. Explicit capture/output-dimension, resolution and performance requirements retain their required settings; switch up for those phases and down afterward. Low-resolution success does not prove high-resolution performance. At 640x360 there are one ninth as many pixels as 1920x1080; CPU/geometry work and total GPU memory will not necessarily shrink proportionally.

Only one active owned GPU/native test. Waiting agents must not prelaunch renderers. Close and verify exit of only test-owned PIDs. Preserve user sessions. No new scheduler, default-output change, broad benchmark or unrelated retesting is required.
