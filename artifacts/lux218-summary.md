LUX-218 updates the current Lux GPU QA policy.

Completed criteria:
- Routine isolated low-resolution functional QA may run concurrently after current resource checks.
- Uncontended windows are limited to performance work or observed conflicts.
- Exceptional handoffs use unique grants retained through owned cleanup and explicit release.
- Delayed, released, and superseded grants cannot authorize a launch.
- Historical onboarding policy remains present and is marked superseded.

Source candidate: 3653e7213a3234fe32b856ab1141f6fd39556922.
Landed Lux main: fc2c9bd2.

Canonical main: e717f25124e02e8b31f167cc5e9d7f0b94ccefa1. Normal setup applied
after independent review and preserved the newer recipient-relevance guidance.
