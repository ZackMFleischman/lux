# Isolated Dockview layout adapter

12 September 2026. Later-roadmap parallel spike; tracer export remains primary.
This adds an adapter and tests only. Current AuthoringApp/StudioApp are unchanged.

## Dependency decision

Pinned and checked locally: `dockview-react`, `dockview`, `dockview-core` **7.0.4**.
All three package manifests declare MIT. The versioned React manifest declares
`dockview: ^7.0.4` and accepts React 19; the coordinator pins the resolved closure
in the shared manifest/lockfile. This worktree does not modify dependencies.

Official evidence: [v7.0.4 React package manifest](https://github.com/mathuo/dockview/blob/v7.0.4/packages/dockview-react/package.json),
[package license matrix](https://github.com/dockview/dockview/blob/master/LICENCE.md),
[save API](https://dockview.dev/docs/core/state/save/),
[load API](https://dockview.dev/docs/core/state/load/).
Enterprise is a separate commercial package and is neither imported nor bundled.
The published packages inspected here contain package.json/README/dist, without
a separate LICENSE file; include the authoritative MIT notice in eventual product
third-party notices rather than assuming package packing already supplies it.

## Integration boundary

`apps/studio/src/layout/registry.ts` registers Preview, Source, Inspector and Jobs.
Inspector supports distinct panel IDs with independent `lockedTargetId` view
state. Additional real Library/Graph renderers can register their definitions;
they are not placeholder panels today. Each registered definition admits only its
small view-state schema. Source text, runtime instances, clocks, controls and
operations cannot be persisted through the supplied definitions.

`LuxDockLayout.tsx` is the optional React entry. Supply stable memoized `registry`,
`panels`, machine `storage`, a launch style `nonce`, and `onReady(adapter,result)`.
Every registry kind must have a real supplied React renderer. Bind closures above
this component to the existing client, source workspace/editor cache, application
operations and presentation leases. Remount the shell explicitly when switching
its registry/storage/default-mode configuration; normal runtime status updates
must not recreate those inputs. Put it inside a container with an explicit height.

The wrapper passes only panel ID and validated view state to renderers. Panel
unmount can release its own presentation subscription/lease but must not stop a
producer, discard the source workspace or reset animation. `renderer: always`
keeps tab-hidden content mounted in Dockview's in-window rendering model; this is
not proof of real GPU/context portability. The existing PreviewBinding remains
the application-owned surface handoff mechanism. Source's cache belongs above
panel mounts. Inspector resolves missing locked targets explicitly; Jobs subscribes
to the existing job store. No new runtime or source authority exists here.

Use adapter `open`, `close`, `move`, `save`, `restore`, `reset` for discoverable
View/Add Panel/Move/Layouts menu actions. `move` supports left/right/top/bottom/
center placement. Named Save/Restore are explicit; no autosave silently overwrites
an invalid layout. Desktop starts Preview dominant, Source left, Inspector right,
Jobs short below; laptop starts these four as tabs. Library and Graph can join
ordinary groups later, with no special reserved sidebars.

## Personal persistence and recovery

`personal-layout.ts` validates the version-1 `lux-personal-layout` envelope with
an exact Dockview version, name, dock grid and closed-panel view records. It caps
input at 128 KiB, 32 panels, bounded recursive depth/node count, supported plain
grid fields and finite dimensions. It checks all group/panel references, active
identities, duplicate singleton kinds and per-kind view schemas, canonicalizes
titles, and rejects arbitrary renderers, popout/floating/edge-group payloads.

`LayoutStorage` is the small synchronous `getItem/setItem/removeItem` interface;
application-owned browser Storage can provide machine-local persistence under
keys `lux.personal-layout.v1.<encoded-name>`. Do not pass SceneFileStore or release
storage. A future main-process machine-preferences adapter may expose an explicit
cached synchronous facade; do not quietly introduce asynchronous restore races.

Unknown versions/panel kinds, malformed bytes, unsupported window data, storage
read errors or Dockview load failures return a reason and load the chosen default.
Corrupt saved bytes are preserved until the user explicitly saves or resets.
Save errors propagate without changing the current layout. Reset applies the
default and removes only its named personal entry; a removal failure is reported.
Close/reopen retains validated panel view state, including across Save/Restore.
Adapter disposal removes its subscription; the React owner disposes Dockview.

## Verification and remaining integration gates

Run `node apps/studio/src/layout/test-cpu.mjs`. Four CPU tests cover defaults,
registry extension/singletons, malformed/versioned/state/reference/window rejection,
independent Inspector locks, and a **real Dockview 7.0.4 jsdom** lifecycle sequence
with move/save/restore/close/reopen/reset/storage-failure/disposal cases. The runner
also type-checks the adapter and bundles the React wrapper plus local CSS, asserting
that Enterprise is absent. No renderer/app/graphics process launches.

The React wrapper is compiled, not mounted in native Electron in this spike.
In-window drag/keyboard/focus/accessibility, maximum-layout performance, packaged
CSP and the actual Preview/Source components still need coordinator integration
tests. Floating groups are disabled; no popout URL/window action is exposed.
Monitor removal/window-bounds recovery and cross-document GPU presentation remain
the explicit U04/U05 gates in `docs/design/studio.md`. Do not infer them from
serialization or DOM-only testing. Fullscreen stays with existing native commands.
