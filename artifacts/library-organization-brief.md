# Library organization and responsive browsing

User authorized design, tickets and delegated delivery after the first usable Studio audio milestone. No overnight feedback is needed. Resolume export testing is deferred. Preserve existing library files and ongoing work.

## Visible result

Find a reusable component by folder, tag or search; recognize it from a thumbnail; inspect it without clipped content; reuse the existing supported action. The Library must work as a narrow dock as well as a wide panel.

## UX decisions

- Compact toolbar: search, filter control and list/grid toggle. Search names, descriptions and tags. Show active filter chips and one Clear action. Alphabetical and Recently updated sorts are enough initially.
- Logical folders organize entries without relocating source files or changing component IDs. Start with All, Unfiled and user folders. One folder per component; multiple tags. Folder rename/move/delete must preserve entries; removing a folder returns entries to Unfiled. Avoid a deep tree or drag/drop requirement for the first path.
- Wide panel: optional folder sidebar, results, selected-item details. Narrow panel: folder selector and a single results view; opening details replaces results with a Back action instead of stacking a source reader far below the list.
- Results show a small thumbnail, readable name, at most two description lines, and concise tags. Full description appears in details. Use shared typography/control components and restrained spacing. Internal revision IDs and storage paths belong in details, not every card.
- Details lead with thumbnail, name, description, tags/folder and the existing reuse action. Source code and revision/history are secondary disclosures. Do not label Copy agent request as Insert unless actual insertion exists.
- Thumbnails are optional static previews tied to the component revision. Reuse a verified frame where available; do not execute every library component merely to populate the browser. Show a neutral placeholder for missing or stale preview. Explicit thumbnail capture must use isolated serialized rendering and never show an unrelated whole-scene frame as proof of a component preview.
- Search/filter/selection remain keyboard accessible. Keep action labels/tooltips readable and focus visible. Empty results explain how to clear filters. Avoid horizontal panel scrolling; source code may scroll within its own region.

## Existing code constraints

LibraryPanel.tsx currently mixes result list and source inspection, reads the full selected component, and shows storage path/revision detail prominently. studio.css stacks the source view under the list below 650px; intrinsic widths and unwrapped card content can still overflow. Check actual layout rather than only adding overflow:hidden.

LibraryComponent/Summary validation currently permits exact fields only. Introduce backward-compatible organization metadata with independent update semantics so a tag/folder edit does not falsely advertise a new executable component revision. Preserve old catalogs, linked-scene updates, concurrent writes and package/fallback transfer. Thumbnails must be bounded non-source assets with safe paths; update packaging intentionally (LUX157 handles cataloged source files).

Expose appropriate organization metadata through existing library MCP APIs and compact default catalog, without dumping large tag inventories or preview bytes into agent context. Update shipped guidance and install/check normally.

## Ticket split and order

1. Responsive Library browsing bug: resolve clipping and cramped text, make narrow details navigable, preserve current operations. Capture before/after at narrow and wide panel sizes; independent UX review.
2. Library organization feature: folders, tags, search/filter/sort and thumbnail-backed browsing, with safe persistence and agent metadata. Demonstrate organizing an existing component, locating it, reopening Studio, and retaining linked-scene behavior. Include independent source and actual UI review.

Both are scheduled after the first usable audio demonstration, not after all future audio/export work. Design/review may run earlier only with actual spare capacity and no interference. Do not start Resolume export QA for this work. Preserve all current user components and test fixtures separately.

## Approved redesign detail — 17 September 2026

Primary workflow: find something useful, understand what it does and looks like, then tell the AI how to use it. Scale to large collections of components with different types and use cases. Condensed by default. Source browsing is secondary.

### Browse and organize
- Default dense list: roughly 48px thumbnail, readable name, one useful description line, concise type, favorite action. Optional thumbnail grid.
- Compact search across names, descriptions, tags and use cases. Support intent such as flowing ribbons, distort an image, or audio-reactive background without requiring an AI search backend for the first delivery.
- Filters: component type, input/output compatibility, tags, favorites, Used in this scene. Visible active filters and one clear action; alphabetical/recently updated sorts initially.
- Shallow logical folders for deliberate organization; multiple tags for cross-cutting uses. Preserve component IDs and source locations. Folder removal must not delete components.
- Saved collections retain useful queries/filters such as Image effects or Audio-reactive favorites. Deliver after the basic browser.
- Hide revision numbers, paths and large tag inventories from result rows. Keep scrolling and results responsive for large catalogs; avoid loading every source bundle or preview eagerly.

### Details and responsive layout
Selecting an entry leads with its visual and purpose: larger thumbnail, brief What it does and Good for text, required inputs/output, example looks or presets, Use with AI, favorite and organization actions. Code, technical details and revision history are collapsed secondary content.
Narrow dock: details replace results with Back, retaining search/filter/scroll state. Wide panel: results and selected details side by side, optional folder sidebar. No horizontal panel scrolling; compact spacing and keyboard access throughout.

### Thumbnails and demos
Every entry gets a meaningful bounded revision-associated thumbnail or honest placeholder. Sources show output; effects use representative before/after imagery; path/geometry/non-image components use a labeled example that visualizes their result. Do not present an unrelated full scene as the component preview.
Run demo is explicit and on demand, inside selected-item details. Use a sample image/animation for effects and an example consumer for data components. Show which example/input is used and expose a small useful control set/presets. Only one live demo runs at once; selecting another entry/stopping/closing releases its resources. Preserve the current scene, playback, files and controls. Do not animate all thumbnails or require Resolume QA.

### Direct the AI
Select one or multiple entries into a small removable selection tray. Use with AI attaches compact stable component references to the composer so the user can add intent, for example: Use these ribbons as the background. Apply this distortion gently and expose its strength.
References should convey identity/revision, purpose and relevant compatibility without dumping source or thumbnail bytes into agent context. Fetch source only when needed. If direct composer attachment is unavailable, label the actual action Copy request; do not imply insertion, automatic wiring or sending. User initiates sending the request.

### Delivery and acceptance
1. First usable path: dense thumbnail browser, search and filters, useful details, AI selection/reuse. Include basic folders/tags and favorites alongside this path where practical; integrate the existing LUX-164 clipping fix rather than duplicating it.
2. Then isolated demos and saved collections. Keep these in this feature's scope; split concrete feature/bug tickets only when dispatch needs it, not review/landing tickets.
Demonstrate finding a component by use case, organizing and reopening it, understanding its inputs/output, selecting it for an AI request, and preserving linked-scene behavior. Demonstrate effect and non-image examples when demos ship. Validate compact narrow/wide UI with actual screenshots and independent design/code review.
Retain the earlier storage safety constraints: organization changes do not create executable revisions; backward-compatible catalogs, concurrent updates, package/fallback transfer and user source/history remain intact. Update shipped Lux agent guidance and install/check it when APIs/metadata change. Existing work is preserved. This update records approved design; it does not dispatch implementation.
