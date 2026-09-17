# Trigger controls validation

Status: implemented and independently approved in the development worktree.
Product commits: `5c77d26c3dfdc2e4de53a0e76fea166f935d7ce5` and
`4a1742bd78d13e4c44d8dbbb57939ea272135e60`.

The Inspector exposes accessible action buttons, and `lux.studio.trigger` delivers
one acknowledged event per logical command. Same-ID retries return the original
receipt. Actions are excluded from values, saves, reset history and animation.

## Validation

Contract/compiler/component checks (116), worker checks (20), runtime routing
checks (18), UI trigger checks (3), typed UI regressions (11), and focused hostile
receipt checks passed. Root, SDK example and Studio TypeScript checks passed.
Studio test build and the actual authoring-boundary forwarding regression passed.
The shipped visual skill was installed and its installation check passed.

Native validation uses `scripts/test-studio-trigger-controls.mjs`, isolated test
profiles, native pointer/Enter/Space input, guarded MCP and a 640x360 preview.
Both relevant runs tested product `4a1742bd78d13e4c44d8dbbb57939ea272135e60`
with an empty tracked diff.

- `artifacts/studio-trigger-controls/native-1789647034497/result.json`: five
  completed criteria passed: native delivery and completed-frame receipts;
  idempotence; stale/unknown rejection; persistence/reset/build/restart without
  replay; alias/direct/selected-node isolation. Overall `ok:false` records a
  later harness race between explicit restart and automatic fault recovery.
- `artifacts/studio-trigger-controls/native-1789647267163/result.json`: focused
  fault/recovery tail passed (`ok:true`). Authored failure emits no receipt,
  rejects redelivery, preserves saved bytes, and recovers generation 3 to 4 with
  an empty ledger. Before/failure/recovery canvas PNGs are byte-identical SHA256
  `f0366541ef0f34ce422827c1e33dcbac8dff961e0949f47507e0edd40350959f`.

This is composite acceptance, not a claim of one fully green end-to-end run.
The final harness SHA256 is
`6da70f20117eb98ac4513a29cacf16b1ad12fcfcdc96753acdeb60f32212a1c3`.
All owned Studio processes exited. No user process was touched.

Independent reviewer `/root/review_typed_controls` approved source, contracts,
runtime, UI and this composite evidence with no actionable findings. Screenshots
in the main run include `wide-trigger-controls.png`, `narrow-trigger-controls.png`
and `component-trigger-isolation.png`. The 1360x900 and 820x720 views (242px
Inspector) passed hierarchy, readability, keyboard and overflow review.

## Delivery boundary

Development branch only; installed Studio and user scenes remain unchanged.
Numeric Resolume export remains supported; trigger schemas reject before packaging.
No remaining implementation QA is required for this slice. Integration is separate.
