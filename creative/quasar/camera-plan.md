# Quasar camera and depth

User result: orbit, pan, dolly and roll the 3D view with mouse gestures; reset only those offsets. Plan uses the existing Library and guarded Studio control-edit path.

- [ ] Replace the screen-space foreground/background planet crossfade with sphere and ring intersections along the same bent rays as the disk. Evaluate belt rocks only near their orbital plane. Preserve user tuning and broad disk waves.
- [ ] Publish a CameraController data component and camera helper. Camera-aware 3D visuals consume its additive pose; 2D image effects remain unaffected. Connect the quasar's ray basis to the same pose.
- [ ] Add trusted preview gestures through the existing parameter command path. Cancel gestures on pointer loss or runtime replacement, coalesce writes, and offer Reset Camera. Keep right-click menus elsewhere intact.
- [ ] Verify pure camera math, control mapping, gesture lifecycle and guarded writes. Review the actual changed app and Quasar frames; obtain real native interaction evidence where the host permits it. Preserve active scene and serialize app installation/GPU QA with coordinator.
- [ ] Save the scene and Library component, update authoring instructions, and commit only owned files after independent review.

No new dependencies, native binaries, or camera postprocessing fake. The current hardcoded quasar shader camera must become an actual 3D pose before mouse overrides are meaningful.
