---
name: lux-visual-creation
description: Create and revise procedural visuals in Lux Studio through its visual SDK and MCP tools. Use for visual briefs, animation, materials, geometry, and feedback on the running preview.
---

# Lux visual creation

Turn the user's visual brief into working Lux source, inspect the actual preview, and iterate from feedback. Match the requested look and movement; use creative judgment when the brief leaves room. A technical plan or a code listing alone does not complete a request to create a visual in Studio.

## Connect and inspect

Prefer available `lux.studio.*` MCP tools. Otherwise read [connection and tools](references/studio-tools.md) for the local stdio adapter. Use the existing Studio session; ordinary visual creation does not call for launching extra Studio instances, running integration tests, modifying infrastructure, or installing/exporting to Resolume.

Call `discover`, then `read`. Discovery supplies the adapter checkout's SDK contract, example, allowed imports, versions, and declared capabilities; `runningStudio` separately reports the running app's capabilities and compatibility. Require compatibility for SDK 0.2. Use the adapter from the checkout/build that launched the current Studio when known, and verify actual `read`, `status`, and operation results. Read returns the **complete source bundle**, draft version, and current preview status. A newer adapter can describe features absent from an already-open build; investigate that mismatch rather than trusting either this skill's snapshot or discovery alone. Do not print connection credentials.

## Create and revise

Read [visual programming](references/visual-programming.md) before the first implementation. For procedural displacement, read [noise and meaningful parameters](references/noise-and-parameters.md); its [sphere template](assets/noise-sphere.ts) illustrates a CPU-compiled starting point, not a visually approved finished design.

- Preserve existing files and assets unless the requested change removes them. Build replaces the **entire bundle**, not one file or a patch. Preserve `sourceVersion` and `assets` on v2 documents.
- Submit with the `expectedDraftVersion` from the read you based the edit on. If a user or another agent has edited meanwhile, reread and merge the intended change into the latest source. Do not replay the old bundle with a newly fetched version number.
- Parameters belong to each visual's code. Use the discovered declaration/control schema; Intensity is not a required global semantic. SDK 0.2 declares numeric `controls` directly in `defineVisual`; use the actual runtime schema/hash for guarded MCP patches. Legacy 0.1 retains its compatibility Intensity. If an old running app cannot use 0.2, report the mismatch. Continue the useful visual work without changing the SDK.
- Build the authorized creative edit, inspect diagnostics, and correct source errors. Failed builds preserve the previous working preview. A timeout or lost response is uncertain: read the actual source/status before resubmitting. Bound recovery; report a persistent service/runtime failure instead of repeatedly restarting it.

## Check the result

Capture the actual completed frame and inspect its composition, silhouette, palette, and visible defects. A successful compile is not a successful visual. Capture metadata identifies the revision, frame, and control state; verify it corresponds to the intended build.

Respect the user's play/pause state. A paused preview can be captured immediately; waiting does not make it animate. When animation verification is needed and consistent with the user's intent, use the playback tool and inspect separated frames. Restore a pause changed only for testing. Do not substitute frame count for visual judgment.

Briefly report what changed, which controls are live versus source settings, and what was actually inspected. Save/Open and export are Studio UI workflows unless discovery provides newer tools. A successful build does **not** imply the scene was saved to disk or exported.
