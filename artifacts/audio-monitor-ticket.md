User result: While Lux captures VB-CABLE as an audio input, press Monitor to hear the same active capture through the default system output.

Why now: The live creative session needs audible system audio while its analyzer continues to receive the connected input.

Acceptance:
- Add a compact Monitor toggle beside the Studio audio input control.
- Reuse the active capture stream. Do not request a second microphone stream.
- Route the active stream to AudioContext.destination only while monitoring is on.
- Start off. Turn off on disconnect or monitor failure. Keep the button state truthful.
- Preserve analyzer input and existing cleanup.

Excluded: OS output changes, virtual-device rejection by name, feedback detection, and a broader audio framework.

Delivery checklist: implement; focused compile/check; independent review and native smoke by coordinator; serial integration.
