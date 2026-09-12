# Tracer outcome: create in Lux, use in Resolume

Status: user-approved scope revision, 12 September 2026. Planning only; this
document does not claim that export or installed playback has been implemented.

The user defines tracer success as: **use Lux to create visuals, export them as
reusable Resolume sources, and use them without Lux Studio running.** This moves
the minimum release, installation, independent-instance and composition-reopen
requirements into tracer 0.1. They are no longer deferred to 0.2 or milestone 5.
See DEC-13 in [decisions](../decisions.md).

## User workflow

1. Create, preview and revise a visual in Lux, including through the external AI
   source/image loop. Save the editable source with the existing basic save/open
   workflow; a durable revision journal is not required yet.
2. Choose **Export for Resolume** for a validated revision. Export produces a
   named, immutable source package with its code, required assets, exact runtime
   dependencies and fixed control schema. Invalid or incomplete exports fail
   without replacing an installed source.
3. Use the supplied install action or helper to place the source and its runtime
   in supported locations. A basic guided helper is enough; a polished signed
   installer is not required. The playback machine needs no development checkout,
   Node/pnpm setup, compiler, terminal command or manually started producer.
4. Close Lux Studio. Open Resolume and load the exported source when needed.
   The source starts its installed background rendering service automatically.
   That runtime is allowed to run; Lux Studio, AI and a development server are not
   playback prerequisites. No network access is required after installation.
5. Use multiple sources at once with independent controls. Save the Resolume
   composition, close everything, and reopen it with the same source versions and
   saved values. Animation may start from its defined initial state; exact
   continuation of simulation time across application shutdown is not required.
6. Continue editing in Lux without changing installed sources. Exporting a new
   revision creates a separate release. Selecting an update is explicit; retain
   old installed versions so existing compositions do not silently change.

## Minimum tracer scope

- Reference platform remains Windows x64 and the pinned Resolume/GPU tuple.
- One fixed continuous `intensity` control per exported visual, using the existing
  schema/default contract. Arbitrary control publishing remains milestone 2.
- Two different exported visuals must run together. In a separate test, two
  copies of the same source must have independent animation and control state.
  This is a minimum concurrency test, not an unlimited capacity promise.
- Each release has stable installed identity; each loaded copy has separate
  runtime identity. A single global sender or mutable "currently selected scene"
  binding cannot satisfy tracer.
- Package the complete code/asset/runtime closure. A versioned shared installed
  runtime is acceptable if included/provisioned by the install helper and pinned
  by the source. References to the author's repository, scratch registry, asset
  library or development cache do not count as an export.
- Cold start is mandatory: after Studio and all Lux background processes have
  exited, opening the saved Resolume composition must start the required runtime.
  Keep native scanning lightweight; do not execute generated code in Resolume.
- Apply the current authoritative host control snapshot before accepting the
  first frame on attach or recovery. Brief use of a default followed by eventual
  correction does not satisfy this requirement.
- Removing one source must not stop another. Closing Resolume must release its
  instances and allow the background runtime to exit after its documented idle
  period. Missing/incompatible packages must produce an actionable error.

## Completion evidence

TR-06 delivers export/install and installed host lifecycle; TR-07 signs off the
actual end-to-end test in [acceptance](tracer-acceptance.md). Use two visibly
different user/AI-authored scenes, for example Particles and Tunnel. Prove:

1. Both export and install from Lux through the user workflow.
2. With Studio closed, both appear as reusable Resolume sources and run together.
3. Their controls are independent; duplicate-source copies are also independent.
4. Save/close/reopen restores the correct release IDs and values with all Lux
   processes initially stopped, network disabled, and the authoring checkout and
   source asset paths unavailable. No terminal or reactivation command is used.
5. An authoring revision does not change installed playback. A failed export or
   install leaves the previous release usable; a new release can coexist with it.
6. Producer restart restores the current host values on the first accepted frame;
   source removal and host shutdown do not leave a stuck host or orphan workload.

Keep the existing single-source 1080p60 timing, GPU ownership, color/alpha and
provenance gates. Record the two-source workload and resource use separately;
do not infer twice the rendering capacity from a single-source benchmark.

## What stays later

0.2 broadens host compatibility, resize, capacity/resource management and upgrade
cases. 0.3 adds host audio/MIDI event workflows. Milestones 1–4 add durable editing,
graphs/control publishing, richer inspection and the full Studio. Milestone 5
hardens the already usable export path with polished installation/distribution,
runtime upgrades/migration, full asset/look/input coverage, broad workloads and
the 60-minute soak. It is no longer the first offline export milestone.

This scope supersedes older single-host, scratch-only, developer-activation and
"installed releases later" exclusions in the subsystem proposals. Their frame,
security, control and ownership contracts still apply. Historical plans and
review results remain preserved; implementation coordinators must reconcile old
DTO examples with durable release IDs before coding the export step.
