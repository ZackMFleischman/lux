# Prismatic Observatory

Created in creative Lux Studio at main c5bd2bdf27153ca92a3ca9f49911da830a5e376f.

The running scene links the reusable Library entry **Prismatic Observatory** (revision 1) to two instances of **Prism lens**. Each lens has independent spectral split, halo strength, and halo radius controls. The instrument has orbit speed, ring expansion, gimbal tilt, and spectrum controls.

Use **View > Open Graph** to inspect the three-node chain. Select a node for its own controls. Use **Library** to inspect the reusable instrument. The source component contains nested Three.js groups for its gimbals and orbiting satellites. This build does not support nested component graphs.

The visual is playing in Studio. Its complete source is preserved in `complete-source.json`; `working-source-and-state.json` also preserves library links and runtime controls. These are recovery/source documents, not saved Lux scene files. Use **File > Save** to save a `.lux-scene` when ready. Desktop UI automation was stopped at the user's request.

`preview.png` is an actual captured frame, with controls independently verified by MCP. The two prism nodes were set to split 0.001 and 0.003, halo strength 0.5 and 0.32, and radius 0.003 and 0.01 respectively. No runtime fault was reported.
