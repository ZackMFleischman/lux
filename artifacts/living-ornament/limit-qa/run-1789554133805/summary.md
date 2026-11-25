Ticket: LUX-170

Removed fixed composition-count ceilings from compiler extraction, runtime admission and planning, Studio authoring DTOs, library dependency/link resolution, saved node controls, and the authoring skill. Retained depth, raw data, canonical byte, compilation, planning-work, resource, and device limits. The separate 32-entry Library inventory cap is unchanged.

Tested commits:
- 025d41758f8af026e16a741257dd7b55a9b73362 — implementation, tests, skill text, and QA harness.
- cb086ec2c025f88fde86f67d09382954d0becc8f — routine-resolution initialization for the full-HD QA harness.

The 17-node real Studio scene passed exact pixels, controls, Graph fit, save/reopen, and failed-edit retention. Root owns independent review, main integration, and shipped-skill install/check.
