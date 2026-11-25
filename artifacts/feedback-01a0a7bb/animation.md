User result: Animate every declared numeric control from the Inspector, whether it belongs to a scene or a component. Scene structure must not disable animation.
Why now: User encounters "Animation requires a component-based scene" during normal creative work. LUX-135 exposes the button but retains this restriction.
Acceptance:
- Use the same animation editor for scene and component controls, including exposed aliases.
- Preserve base values, reset, animation settings, save/reopen, playback and stale-runtime guards.
- Demonstrate a non-component scene and a component scene in the actual app, including save/reopen and invalid-edit preservation.
- Update the shipped authoring skill and validate/install it when behavior changes.
Checklist: implementation; focused regression checks; independent code and UI review; integration; real app demonstration.
Approved in task 01a0a7bb-ee60-76f1-bcd6-5d179614f551. Extend existing animation behavior rather than introduce a second animation system.
