# LUX-158 independent review

## Verdict

No blocking findings remain in the reviewed shader-field slice against `c1c3e67b`.

## Source review

- The descriptor and snapshot normalizers require version 1, bounded slash-separated ABI identifiers, plain data records, valid Unicode fragment text, finite numeric values, exact field counts, and a 256 KiB aggregate payload limit. Admitted records are detached and frozen.
- Flat and nested graph validation require exact shader-field version and ABI equality.
- The runtime issues opaque resources through the existing scope authority, rejects forged and stale wrappers, shares one immutable snapshot across fan-out, and releases its ledger allocation without backend-image cleanup.
- The SDK brand and `EvaluationContext.shaderField` preserve authored-code provenance. Compiler dependencies include both runtime and declaration contracts, and discovery exposes the public snapshot type.
- `Organic Regions` publishes the two exact WGSL fragments and five live values required by `Living Painting`. The consumer checks the ABI and exact key sets, compiles the source once per instance, rejects fragment changes during that instance, and updates only numeric uniforms each frame.
- The composition keeps the prior public control aliases and ordering while moving Drift, Scale, Flowing bends, Region growth, and Variation to the region provider.
- The publisher now waits for a ready initial preview, rejects ambiguous or dependency-bearing leaf reuse, verifies the resolved revisions and every mounted source file, and saves without overwriting.

## Evidence reviewed

- `regions-comparison-18.json`: exact 1920x1080 RGBA match, zero changed channels.
- `regions-comparison-42.json`: exact 1920x1080 RGBA match, zero changed channels.
- `regions-after-18-retry/window.png`: explicit Scene root, readable region node and named-port wiring, preserved control hierarchy and values.
- `Reusable Regions-publication/result.json`: `ok: true`; exact Library readback, linked render, save/reopen, and invalid-edit preview preservation.
- `Reusable Regions-publication/window.png`: saved scene title, mounted Library source paths, correct four-node graph, and no visible diagnostics.
- Reported checks: 176 runtime/agent tests, four focused Library shader-field tests, both root TypeScript configurations, and a clean scoped `git diff --check`.

The ABI intentionally transports shader source rather than a rendered mask. Fragment validity is therefore established when a compatible consumer assembles and renders it; the actual publication exercise covers that path for `lux/organic-regions/v1`.
