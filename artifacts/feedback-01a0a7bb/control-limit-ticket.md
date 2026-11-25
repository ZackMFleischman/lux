Allow authored Studio visuals and components to declare more than32 controls. The user rejected the arbitrary count limit while building a creative visual.

Remove count ceilings from shared authoring schemas, Studio parameter writes and local animation bindings. Keep metadata byte/shape checks and the existing native Resolume protocol compatibility boundary explicit at export; do not silently truncate controls or change native ABI.

Acceptance:64-control scene and component/compiler metadata pass; late controls are editable/animatable and survive save/reopen; over32 simultaneous values and animation bindings work; byte/invalid-data guards remain. Capture actual isolated native UI evidence. Independently review, integrate serially, refresh author skill, and verify rebuilt package. Preserve active user session.
