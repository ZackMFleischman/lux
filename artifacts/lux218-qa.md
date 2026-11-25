Independent reviewer steps:
1. Inspect landed Lux main fc2c9bd2 and candidate 3653e7213a3234fe32b856ab1141f6fd39556922.
2. Confirm that routine 640x360 isolated QA is concurrent by default and CPU work does not wait.
3. Confirm that exceptional grants are limited to measured conflict or performance work.
4. Confirm that a holder keeps a named grant through cleanup and release, and stale messages cannot start work.
5. Inspect canonical main e717f25124e02e8b31f167cc5e9d7f0b94ccefa1 and the setup receipts. Confirm that its follow-up preview has zero edits.
