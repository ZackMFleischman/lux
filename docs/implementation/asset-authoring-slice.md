# Asset authoring preservation checkpoint

Implemented and independently reviewed 12 September 2026, integrated as55372e1
alongside the [versioned compiler pipeline](asset-pipeline-slice.md). This slice
preserves assets; it does not itself enable image rendering or offline export.

Workspace equality includes source format and every asset descriptor. Byte-only
changes, additions and removals affect document dirty state and running-source
agreement. `dirtyFiles` remains TypeScript-only; `dirtyAssets` includes changed and
removed logical image paths. Failed replacement retains the prior source;
successful replacement and its undo preserve the complete admitted snapshot.
Text edits retain assets. Asset diagnostics cannot open a TypeScript location.

The pure `scene-document.ts` helper selects matching version1/legacy or
version2/asset source documents. Session save/open/export and smoke-save use it;
the browser imports no Node filesystem implementation. An opened scene retains
its file binding and document controls even if preview activation fails.

MCP build uses the shared source schema and remains a complete-source
replacement guarded by draft version. V2 requires the assets field; read returns
all bytes. Discovery distinguishes per-image and aggregate limits through shared
asset constants. The local bridge bounds requests at8MiB, decodes UTF-8 once
with fatal errors after assembling chunks, and bounds serialized responses at
16MiB. The MCP read tool independently bounds its escaped content representation
at16MiB; neither layer drops asset bytes to fit.

At integration, explicit gates in preview/client compile and export preparation
reject unsupported v2 activation instead of silently creating a legacy payload.
The preview implementation removes only preview gates when the complete linked
payload is verified and consumed. Export gates remain until versioned transport,
runtime closure and installed playback support are complete.

Validation: four workspace/session/diagnostic regressions and four MCP/boundary
regressions pass. Integrated73 Studio plus9 editor CPU tests, root/Studio
typechecks, and16 asset/fixture checks pass. The consuming image fixture compiles
through actual pinned SDK/Three imports and preserves its exact bytes through
linking. Native six-region captures, asset browser interactions and offline
asset playback remain subsequent checkpoints. See the live
[checklist](next-checkpoints.md#parallel-asset-delivery-order).
