# LUX-218 independent policy review

**Verdict: request changes.** Reviewed Lux `e8c973f8158fdd5f5df1433bf92600fd528d9c69` and canonical Conductor `720013af012efdde9f4421c27675ef3f7b05f1fe` without launching native applications or changing either candidate.

## Findings

1. **P1 — Lux creates a new exclusive-window category.** The user-authorized exception is an uncontended measurement or an observed resource conflict. Lux instead permits an uncontended window for “heavy full-resolution work” by itself in `AGENTS.md:95-96`, `docs/conductor-orchestration.md:21-22`, and the validation case at `docs/conductor-onboarding/gpu-policy-validation.md:9`. A full-resolution functional capture therefore acquires exclusive access even when current observations show no contention and no measurement is being made. This reintroduces an over-broad lock and also conflicts with the narrower canonical rule in `skills/conductor-orchestrator/SKILL.md:23`. Remove that standalone category; retain performance measurements and observed conflicts.

2. **P1 — The required revoked-grant case is neither specified nor testable.** Every candidate says that a delayed, released, or superseded grant cannot authorize launch, but none defines revocation or how a recipient proves its grant is still current. A recipient holding an old message cannot distinguish it from a later-superseded message from the message alone. “Do not reassign its holder until cleanup and release” also conflicts with an unqualified “superseded” live grant. Define a current-authority check with an identified grant and explicit cancellation/release acknowledgement, and state that a live holder is not superseded before it has cleaned up and released. The validation document needs a revoked-before-launch scenario in addition to a delayed-after-release scenario.

3. **P1 — Lux duplicates the generic grant-handoff protocol outside canonical skills.** The assignment requires generic unique-grant handoff guidance only in canonical skills. Lux copies the grant shape, cleanup/release, current-check, and stale-message rules into `AGENTS.md:99-102`, `docs/conductor-orchestration.md:24-28`, the onboarding note, and the new validation document. Keep Lux documentation limited to the project-specific policy: routine isolated low-resolution checks can run concurrently; exceptional access is only for the permitted conditions; use the canonical resource-handoff procedure. The generic procedure belongs in the reviewed Conductor skills.

## Scenario reasoning

| Scenario | Result | Reason |
| --- | --- | --- |
| Two routine isolated 640x360 functional checks | Pass | Both are allowed after current resource observations; CPU work is not gated. |
| Actual observed contention or an uncontended performance measurement | Pass in principle | The canonical candidate limits exclusive access to these cases and preserves cleanup before release. |
| Heavy full-resolution capture without contention or measurement | Fail | Lux alone allows an exclusive window, expanding the permitted exception. |
| Delayed grant after release | Incomplete | It is declared invalid, but the document needs the explicit authoritative current-grant check that makes rejection actionable. |
| Revoked/superseded grant before launch | Fail | No revocation protocol or validation case exists; “superseded” conflicts with retaining a holder through cleanup/release unless limited to a pre-start proposal. |

## Checks

- `git diff --check e8c973f8158fdd5f5df1433bf92600fd528d9c69^ e8c973f8158fdd5f5df1433bf92600fd528d9c69` passed.
- `git diff --check 720013af012efdde9f4421c27675ef3f7b05f1fe^ 720013af012efdde9f4421c27675ef3f7b05f1fe` passed.
- This was a documentation-policy review. No product mutation, skill installation, Go build, or native launch was performed.

## Final review — revised candidates

**Content verdict: pass.** Reviewed Lux `3653e7213a3234fe32b856ab1141f6fd39556922` and canonical Conductor `3ccebc4e07e073c525b9e4314f57697a9abe792c` against the findings above.

- Lux now reserves exclusive access only for an uncontended performance measurement or an observed conflict, and it delegates the generic handoff procedure to the canonical skills.
- The canonical skills now bind replies to a unique grant ID and require cancellation acknowledgement, stopped/not-started state, owned cleanup, and release before regrant. An uncertain recipient makes one direct check and does not poll.
- The Lux scenario document covers routine concurrent 640x360 QA, the permitted exceptional cases, and delayed/cancelled grants. It is validation evidence rather than a second handoff procedure.

Fresh `git diff --check` passed for both revised commits. No native application was launched and no candidate source was changed by this review.

### Integration caveat

The canonical candidate is based on an old Conductor checkout with schema 3, while
the installed/runtime target is schema 4 and current main is
`db47a4f`. Do not install the old-base candidate. A skill-only transplant onto
current main needs a separate final diff review; that review is pending.

### Final integration review — current Conductor main

**Verdict: pass.** Reviewed canonical `6659ab21fbf88f44ba6b34089cb17c006ce83295`
against current-main base `db47a4f8bcdd602ae6a3a8fb6031064927058147`.

- The base is an ancestor and the transplant changes only the three intended
  canonical skills: `conductor-orchestrator`, `conductor-work`, and
  `conductor-worker`; current schema-4 guidance remains intact.
- It preserves the corrected boundary: exclusive access is only for demonstrated
  conflict or an uncontended measurement. Routine isolated low-resolution work
  remains outside the grant path.
- It carries the required cancellation sequence: grant ID on replies, holder
  acknowledgement of stopped/not-started plus owned cleanup before regrant, and
  terminal stale/released/superseded grants. An uncertain worker checks once and
  does not poll.

`git diff --check` from the current-main base passed. The prior old-base candidate
remains unsuitable for installation; this verdict applies only to the current-main
transplant. Build and installation verification are owned by the coordinator.

### Pre-install preservation review — combined canonical main

**Verdict: pass.** Compared installed `C:/Users/zFlei/.agents/skills` with
canonical main `e717f25124e02e8b31f167cc5e9d7f0b94ccefa1`.

- The installed-to-source differences are the intended LUX-218 additions in only
  `conductor-orchestrator`, `conductor-work`, and `conductor-worker`.
- The recipient-relevance guidance from `fbe797a` is retained in canonical
  `conductor-orchestrator` and `conductor-worker`; it is not replaced by the
  resource-handoff paragraphs.
- The combined source keeps the exceptional-resource boundary and cancellation
  protocol reviewed above. No behavior-changing source difference beyond those
  LUX-218 additions was found. The worker skill contains one harmless extra blank
  line adjacent to the inserted paragraph.
