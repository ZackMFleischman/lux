# Host-created shared-context checkpoint

Source `5da9f1a`, independently reviewed native repairs `89ee249` and `64eb3b2`. Coordinator rebuilt Release native targets and verified all seven CPU CTests before execution.

Context-only run `61f7426b-787a-43b3-b60a-89dd4547f3ef` created the shared context on the host thread/DC, activated it on the worker-owned DC, and exited 0 with confirmed job cleanup. Both contexts report NVIDIA RTX 2070. No producer or Resolume was launched.

Paired run `a618071e-2a58-4c4f-a1de-e55522f5ad14` used a five-second producer and ten-second standalone receiver. Both children exited 0 with confirmed job cleanup, but acceptance correctly failed: no completed receiver consumption. Producer observed WebGPU ready, 249 paint events, closed=true, held=0, uncertain=0; native ring filled without a receiver attachment. Both sides report adapter LUID 0:70744. Context creation and activation passed again. The rendezvous polling/attachment path is being investigated offline before another run.

These results do not pass TR-02, demonstrate actual Resolume transfer, or establish the cause of the earlier whole-system crash. Exact source/binary review inventories and process manifests remain in ignored artifacts/experiments under the run IDs. The installed Resolume probe remains disabled.
