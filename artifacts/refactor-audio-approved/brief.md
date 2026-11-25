# Approved component and audio direction

User approved implementation in coordinator task 01a09baf-3806-7eb0-8bed-48b8b7f771cf on 2026-09-15. This brief records the approved proposal; it is not completion evidence.

## User results

- A component instance is a graph node. Components use code or an internal graph. A visual is the runnable graph with external inputs, final image output and public controls. A scene persists the visual and settings.
- Keep defineComponent and defineVisual as the primary author API. Preserve defineComposition and legacy direct visuals through compatibility adapters. Existing saved scenes and library sources must continue to work without rewriting user files.
- Select an audio input in Studio. Bind bass to one component control and highs to another. Tune amount, attack and release in the existing compact modulation editor. Base controls remain editable. Save and reopen retains mappings. Disconnect removes the audio contribution smoothly and leaves manual control usable.
- Later use the same mappings with verified Resolume FFT and tempo. An image input determines source versus effect export; audio reactivity does not turn a source into an effect.

## Implementation constraints from current code

- sdk-composition.ts already supports nested component definitions and explicit control exposures. Extend its working compiler/runtime rather than create a parallel evaluator.
- ControlAnimationBinding already targets nodePath, definitionHash, schemaHash and controlId. Empty paths address flat scene controls. Preserve these saved identities and guards during normalization; display names and array positions are not identities.
- Current composition-profile.mjs admits only a linear image chain and rejects disconnected nodes. Do not insert audio signal nodes into that image validator or weaken its guarantees. Separate typed signal dependencies from image-chain admission, with only the minimum contract required by the audio demonstration.
- Reuse the existing LFO evaluation/binding path. Add a versioned, validated audio source variant with explicit migration of old bindings. Preserve unresolved incompatible bindings as disabled with explanation; never silently retarget.
- Device acquisition belongs to the host/session, not a component renderer. Share analysis per input/configuration, release owned resources, and preserve user process/device selection. No recording or network transmission of audio is implied.
- Device IDs stay local. Saved source requirements and analyzer/binding settings are portable.
- Current native export has a separate 32-parameter ring boundary and no image-input or audio adapter. The Studio cap removal did not remove this boundary.
- Keep LUX7/LUX59 policy/provenance blockers. A CPU test is not native host/audio proof.

## Ticket boundaries

1. One author/runtime component model with compatibility, scene/node control identity, library and animation preservation. Demonstrate legacy and graph-authored scenes with the same Graph/Inspector behavior.
2. Studio audio-reactive controls: provider, shared band analysis, compact bindings, persistence and disconnect behavior as one usable vertical feature. Preparation and independent interface review are checklist items.
3. Kick transient response with sensitivity, retrigger interval and shaped envelope; distinguish detection from tempo estimation.
4. Tempo-driven controls using manual/tap clock and host BPM/phase when available; automatic audio tempo inference is deferred.
5. Resolume audio parity: actual host FFT/tempo acquisition, mapping and runtime cleanup, gated by permitted native setup and verified SDK capability.
6. External image input and source/effect export using the same visual interface; preview provider separate from exported graph.

Do a bounded duplicate search and reuse existing suitable tickets. Assign every new ticket. Do not dispatch all later features merely because tickets exist. Preserve current UI delivery and serialize shared integration/native graphics.

## Acceptance evidence

Independent review checks migration, state ownership and scheduling before integration. Actual Studio evidence must show two independent bindings, live response, manual base edits, save/reopen, failed build retention and disconnect. Use permitted prerecorded fixtures for repeatable analyzer tests plus an authorized real input test. Host parity requires real Resolume evidence and declared version/setup; missing host prerequisites remain explicit blockers. Update and install/check shipped skills alongside public API/MCP changes.
