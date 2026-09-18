# GPU coordination policy validation

Run these cases in fresh agent contexts. Use isolated test profiles. Do not start
or stop a user application.

| Case | Setup and action | Expected result |
| --- | --- | --- |
| Routine concurrent QA | Start two isolated 640x360 functional checks after each records current resource observations. | Both checks may run. Neither waits for a global GPU grant. CPU work continues. |
| Measured contention | A current observation shows contention, or the work needs an uncontended performance measurement. The coordinator issues one named grant. | Only the named recipient starts the exceptional work. The holder keeps the grant until it acknowledges stopped or not-started, completes owned cleanup, and explicitly releases it. |
| Delayed grant | Send an old grant after cancellation or release, or after a later grant for the same resource. | The recipient rejects the old message and does not launch. Cancellation does not permit regrant until the holder's acknowledgement and cleanup. An uncertain recipient asks once; it does not poll. |

These are policy checks. They do not claim GPU capacity, performance, or host
acceptance. LUX-P112 and LUX-P117 supersede blanket serialization; LUX-P122
requires acknowledgement-safe exceptional handoffs.
