# LUX-217 independent validation

Accepted source: `9ee16901e01ef241d02e3b119b5fb09d4ee98d7a`.

The independent review verified checkout/profile isolation, dependency and entry
provenance, bounded exact viewport readiness, per-attempt failure evidence, and
owned-process cleanup that records polling errors. The retained native smoke
receipt records a 640 by 360 viewport, a 640 by 191 preview canvas, screenshot,
and successful PID cleanup.

Main validation at `99ca85ca1bf9f8427b828bd520e204aa5382bdd1`: `node --test
tests/studio/qa-helper.test.mjs tests/studio/session-isolation.test.mjs` passed
8 tests, and `git diff --check` was clean.

Scope limit: the historical parameters suite remains unverified because its
initial visual build reported busy. This acceptance covers the focused helper
launch, viewport, render evidence, and cleanup demonstration.
