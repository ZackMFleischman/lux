# Recurring workflow easy wins

Reviewed LUX-P1 through LUX-P122 and their saved notes, existing Lux tickets, Conductor tickets, and retrospective decisions. Snapshot ends at problem event3428. The 59 pending events were given explicit dispositions; retrospective batch b03bfd76-148e-448b-8cd5-d702fcadab0a committed. Independent review: independent-review.md.

Filed, assigned to coordinator, ready; no implementation started:
1. LUX-216: Include Studio in standard typecheck. Smallest change; verified current command omits application code. P91seq3034 records a real escaped crash.
2. LUX-218: Remove stale GPU locks and clarify exceptional handoffs. P112/P117 user corrections contradict current one-test policy; P122 adds delayed-grant overlap. Keep routine tests concurrent when capacity allows and generic handoff guidance canonical.
3. LUX-217: Reuse existing QA startup/evidence helper. P90/P94/P100/P121 and P91 show recurring setup/readiness/receipt problems; P96 adds generic checkout provenance. Limit to existing helper plus two harness consumers, not a new framework.

Do not duplicate LUX-210 UI-review workflow, LUX-176/177/178 recording, CON-30 startup corrections, CON-38 continuity, or CON-50 message relevance. Existing LUX-140 remains the runtime-replacement follow-up; watchdog diagnosis is not proven by resource-overlap reports. Historical one-off fixture/command errors do not each need tickets.

Delivery and effectiveness remain distinct. Review after fresh use or by25 September2026; no claim these planned remedies have fixed the recurrence.
