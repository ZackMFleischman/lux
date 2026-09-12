# Lux requirements baseline

This is an outcome index, not a replacement for the source acceptance procedures. `D` means [original design](../plans/ai-visual-workshop-design.md); `P` means [domain proposal](../plans/domain-and-workflow-proposal.md); `U` means user decisions in the planning conversation, captured below. Section references are stable source anchors. Technical implementation choices remain proposals until recorded in the decision log.

DEC-13 (12 September 2026) revises milestone routing: tracer must deliver the
[minimum reusable export workflow](implementation/tracer-export-scope.md), not
only a live bridge. Original source references remain preserved below.

## Tracer and non-negotiable boundaries

| ID | Required outcome | Stage | Source |
| --- | --- | --- | --- |
| T01 | External AI submits new or revised executable visual code, Lux compiles and renders it without manual copying; a fixed example alone is insufficient. | 0.1 | D 4.1 |
| T02 | AI receives actual full-output image content, examines it, revises code, and captures again. Capture identifies revision and animation time; a path alone is insufficient. | 0.1 | D 4.1 |
| T03 | One preview; continuous named parameter; play/pause/reset/restart; separate visual and UI measurements. | 0.1 | D 4.1 |
| T04 | Real FFGL source in selected Resolume host, continuous parameter visibly controls the same runtime visual, completed frames transfer on GPU with no normal per-frame CPU capture. | 0.1 | D 4.1 additional requirement |
| T05 | Host playback continues with Studio closed and cold-starts from installed sources with Studio absent; responsive host during renderer failure; first accepted recovery frame uses current host controls. | 0.1 | D 4.1 additional requirement; DEC-13 |
| T06 | Compilation/execution off UI path; actionable build/runtime errors; bad replacements retain last working result; supervisor recovers unresponsive code. | 0.1 | D 4.1, Appendix B |
| T07 | Record hardware/software and pass provisional delivery, CPU/GPU/UI, control latency, watchdog and recovery gates without silently reducing workload. Unavailable timing is not a pass. | 0.1 | D Appendix B |
| T08 | Prove orientation, color, alpha, transfer synchronization, and resource ownership using known image patterns. | 0.1 | D 4.1, 9 |
| T09 | Choose actual OS/GPU/runtime/host versions and connection; test riskiest GPU integration before broad SDK/editor work. | Start of 0.1 | D 4.4, Appendices A/C/E |
| T10 | Independent source/copy identity, parameters/state/resources; saved host composition cold-reopens correct versions/values; stable compatible control indices; resize/deactivation/reconnect lifecycle. | Minimum independence/reopen 0.1; wider lifecycle 0.2 | D 4.2; DEC-13 |
| T11 | Native audio modulation, MIDI continuous control and ordered repeated triggers; seeded stateful simulation, recovery and latency/event measurements. | 0.3 | D 4.3, Appendix B |
| B01 | Dynamic offline Resolume playback; no recorded-video substitute. Resolume owns show mixing, mapping, routing and transitions. | All | D 1, 1.3 |
| B02 | Same application operations for UI and external/embedded AI; generated code has no privileged desktop or in-host execution. | All | D 5, Appendix A |
| B03 | One selected authoring scene runs by default in Studio; no continuously animated library wall or mandatory decks. This does not limit independent exported sources playing together in Resolume. | All | D 1, 1.3; DEC-13 clarification |
| B04 | Proposed Windows/Electron/React/TypeScript/Three.js/TSL/WebGPU/FFGL/Spout stack must be validated; additional platforms are not ruled out. | 0.1 onward | D 4.4, Appendix A |

## Product and later milestones

| ID | Required outcome | Stage | Source |
| --- | --- | --- | --- |
| A01 | Atomic saved projects, durable revisions and restoration, stable IDs, optimistic revision conflicts, serial scene-changing jobs, cancellation/status, compatible parameter preservation. | 1 | D 5; P 4,7 |
| A02 | Successful validated AI changes appear automatically; one request is one undoable change with summary; autosave; failed candidate preserves working result; exported release changes only on explicit replacement. | 1 | D agreed authoring UX; P 4; user accepted |
| G01 | Declared typed graph with branches, shared dependencies, feedback rules and meaningful components; no reconstruction of arbitrary code; shared 3D world supported. | 2 | D 6; P 2,3 |
| G02 | Select parts, inspect/edit controls, reorder/insert/remove/bypass effects, effect amount, saved chains, publish selected controls; actions reflect component capabilities and bypass avoids unnecessary cost. | 2 | D 6 |
| G03 | Explicit compositing semantics, linear premultiplied boundaries, color/numeric distinction and no accidental double contribution of raw plus processed image. | 2 | P 5 (resolves D 6 ambiguous example) |
| C01 | Final/component/diagnostic capture, normalized rectangle, dimensions/aspect policy, timed sequences with actual times, live/controlled modes and bounded requests. | 3 | D 7 |
| C02 | Inspection scope distinct from edit scope; region does not imply object identity; controlled captures use proper simulation stepping and replay inputs; preserve live performance instance. | 3 | D 7; P 4 |
| C03 | Useful diagnostics, including at least one supported bounded particle position/trail sample for AI inspection; analytical support is optional per other component, not optional for this acceptance fixture. Provenance includes revision/time/input/settings; capture downsize distinct from render override. | 3 | D 7 required work/completion steps 7–9 |
| S01 | Embedded chat and external AI have equivalent operations; selection/captures attach to chat. | 4 | D 8 |
| S02 | Audio/MIDI source selection, recorded/synthetic replay inputs, continuous signals and discrete events, tempo/phase/LFO/curves, macros with range/smoothing. | 4 (host subset 0.3) | D 8 |
| S03 | Clear base/macro/modulation authority and event queue policies; host owns published controls in performance; no assumed raw audio/raw MIDI FFGL access or automatic studio mapping transfer. | 0.3/4/5 | D 8, Appendix C; P 10 |
| S04 | Named looks, controls/seed/modulation persistence and comparison without concurrent animated previews. Terminology chosen in decision log. | 4 | D 8; P 1 |
| S05 | Frame-step advances a paused authoring instance by one declared runtime step, remains paused, preserves revision and host independence, and uses explicit input-sampling rules through shared UI/AI operations. | 4 | D 8 required work |
| M01 | AI-generated/edited images and sprites through discover/generate-or-import/validate/register/connect/render/revise; durable files and provenance; no generation dependency in playback. | 4, offline proof 5 | D 1; P 8 |
| M02 | Validate media dimensions/alpha/color/sprite layout; failed replacement retains prior asset; consented reference use; credentials outside project/export. | 4 | D 1; P 8 |
| P01 | Project-local components and pinned library versions, explicit publishing/updating, reusable assets/components/templates, self-contained project archive and release. | Basic save/open and release closure 0.1; complete 1–5 staged | P 1,6,7; DEC-13 |
| P02 | Graph data/custom source distinction, stable node/component identity, local overrides, saved data separate from transient render state and UI layout. | 1/2 | P 2,3,6,7 |
| R01 | Immutable installed release includes exact visual/assets/control schema/runtime; runs without Studio, AI, Git/library services, network or manual developer commands. Later looks/features join the same complete closure when supported. | Minimum export/install/offline playback 0.1; full feature/distribution coverage 5 | D 9; P 10; DEC-13 |
| R02 | Installed host lifecycle, independent instances, compatible updates, failure recovery and current host values; initial source plugin, incoming-image effects deferred. | Basic cold start/instances/reopen/recovery 0.1; wider compatibility 0.2; full hardening 5 | D 9; DEC-13 |
| R03 | Shader/simulation/particles/3D/effects performance coverage, extreme controls, repeated replacements, diagnostic overhead and 60-minute resource/queue soak with reproducible evidence. | 5 | D 9, Appendix B |

## Accepted UI decisions from this conversation

User requested a Unity-style flexible dock layout using open-source off-the-shelf libraries, a large preview, popout/fullscreen, independent library/inspectors, and explicit settings/resolution/audio setup. User accepted the following elaboration. These are product requirements, not a demand to build the complete editor in 0.1.

| ID | Accepted behavior | Stage |
| --- | --- | --- |
| U01 | Each dock region can contain a chosen panel; tabs can be dragged, split, resized and restored using saved layouts and Reset Layout. | Shell early; complete 4 |
| U02 | Ultrawide default shows Graph and Preview together, giving Preview more space. Laptop default puts them in one tab group; user can freely rearrange. | Graph 2; complete 4 |
| U03 | Compact independent Library and Inspector; inspector follows selection and can lock to a target. | 2/4 |
| U04 | Preview supports workspace maximize, separate window, monitor fullscreen and return to prior layout; same running scene survives panel moves/tab switches. | Establish lifecycle 0.1; full UI 4 |
| U05 | Save personal layouts/window placement outside project content; recover detached windows onto available screens after monitor removal. | 4 |
| U06 | Selecting a graph node updates Inspector without replacing final preview; explicit preview-output action exposes intermediate output; retain graph pan/zoom/selection across tab switches. | 2/3 |
| U07 | Separate preview fit/zoom/render scale, scene output dimensions/aspect/FPS/seed, advanced simulation resolution, and app preferences; pane resizing never silently changes output resolution. | Minimal 0.1; complete 4 |
| U08 | Dockable Inputs panel separates source/device/status/meter, signal analysis/tuning, and mapping to visible resulting values; small persistent audio status; explicit monitoring toggle. | 4 |
| U09 | Device choices belong to machine; creative mappings to scene/look; show export mapping limits and preserve separate host authority. | 4/5 |

## Scope and terminology decisions for coordinator

User authorized the coordinator to resolve routine planning choices. Explicitly record adopting or rejecting P's Scene/Look/Component/Node/Asset/Library/Release vocabulary and graph-data-plus-code approach. Resolve D 6's compositing example against P 5 rather than preserving two incompatible recipes. Do not erase source text. Keep future marketplace, cloud rendering, collaboration, incoming-image plugins, object tracking and recorded-video export out of the tracer.

## Coverage maintenance

The roadmap must map every ID to a design and milestone. Tracer plan must map T01–T09, promoted T10/minimum P/R export outcomes and applicable B/U constraints to task IDs and evidence. Later stages may use milestone-level acceptance detail; tracer tasks require concrete contracts, failure checks and evidence procedures, with implementation file targets reconciled against current code before work starts.
