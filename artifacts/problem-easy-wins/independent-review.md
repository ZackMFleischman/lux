# Independent review: bounded recurring remedies

Reviewed the 122 saved problem reports, ticket snapshots 1–2, and the saved
decision records. This is a filing recommendation only; no tracker state or
product source was changed.

## File or advance now

### 1. File a Studio typecheck-coverage bug

**User result:** ordinary pre-native validation catches a renderer TypeScript
mistake before a user reaches a Studio crash.

**Why this is current:** LUX-P91 note sequence 3034 records an actual
`StudioLayout` `ReferenceError: props is not defined`. Root typecheck and build
had passed, but the direct `apps/studio/tsconfig` check had not run. This is a
specific coverage hole, not a substitute for native graphical QA.

**Report ID:** LUX-P91, note seq 3034.

**Bounded ticket:** make the standard root typecheck include
`apps/studio/tsconfig.json`; retain existing checks; demonstrate a temporary
Studio-only type error fails that normal command and clean source passes after
removal. Update the documented normal command. No Electron launch, UI change, or
test-framework work.

### 2. Advance the existing runtime-replacement bug, LUX-140

**User result:** a Studio user can build, reopen, and repeatedly replace a visual
without an intermittent `Visual initialization stopped making progress` failure;
an invalid edit still leaves the last working preview intact.

**Why this is current:** LUX-140 already names this exact defect and has the right
acceptance boundary. Its evidence records a repeatable sixth-start failure after
five healthy admissions. LUX-P121 reports the same worker-stop symptom in fresh
Story native QA, before a separate readiness race; it explicitly keeps runtime
repair out of the Story UI slice. LUX-P91 also preserves a real initialization
failure from LUX-115, distinct from the harness selector failures that preceded
it.

**Report IDs:** LUX-P140 ticket evidence; LUX-P121; LUX-P91 (LUX-115 PID 35040
entry). Supporting historical signal: LUX-P97's later native-QA notes.

**Bounded next action:** claim LUX-140 rather than creating a duplicate. Reproduce
the repeated-replacement sequence with one isolated 640x360 fixture and exact
profile/source receipt; trace worker admission/cleanup only; then demonstrate
repeat build/reopen plus invalid-build preview retention. Do not expand Story,
GPU scheduling, or the generic test framework in this ticket.

### 3. File one workflow bug: make an exclusive GPU grant acknowledgement-safe

**User result:** a requested heavy capture does not wait behind a presumed global
GPU lock, and a genuinely exclusive run cannot start after its grant has been
revoked or reassigned.

**Why this is current:** the user superseded blanket serialization in LUX-P112 and
repeated that correction in LUX-P117. LUX-P122 then records an actual crossed
handoff: Story and Quasar acted on delayed grant/revocation messages. It does not
establish that the overlap caused Story's worker fault, so the remedy must remain
coordination-only and separate from LUX-140/P121.

**Report IDs:** LUX-P112, LUX-P117, LUX-P122.

**Bounded ticket:** replace the remaining exclusive-grant handoff wording/receipt
with a small state rule: routine 640x360 functional runs proceed after local
resource checks; only an explicitly named heavy/performance capture has a grant;
the coordinator changes that grant only after the holder acknowledges either
launch-and-ownership or cleanup/release. Delayed messages carry the grant ID and
cannot reactivate a prior grant. Validate one crossed-message simulation and one
concurrent low-resolution functional run. This is a workflow bug, not a new GPU
queue, daemon, or blanket scheduler.

### 4. File one small Studio-native-QA preflight/receipt bug, if no active owner
already covers it

**User result:** a native Studio QA run either reaches the intended app or fails
immediately with a usable receipt that says why; it never silently tests main or
reports a checkout mismatch caused only by Windows path case.

**Why this is recurring enough:** LUX-P90 launched main because the harness derived
source from the evidence-script location; LUX-P94 reached the intended commit but
could not build because that worktree lacked the approved read-only dependency
junction; LUX-P100 rejected the same Windows checkout due solely to path case.
Each has a local correction, but together they are a narrow common preflight
contract rather than three product defects. The existing LUX-P91 reporting gap is
separate: preserve its requirement to record native-QA failures in Conductor, but
do not make this ticket an automated tracker reporter.

**Report IDs:** LUX-P90, LUX-P94, LUX-P100, LUX-P121. Related reporting
requirement: LUX-P91. LUX-P96 is only generic worktree-provenance support, not
Studio native-QA evidence.

**Bounded ticket:** centralize only the existing native-QA launch assertions:
explicit intended checkout and commit, case-insensitive resolved-path comparison
on Windows, expected read-only dependency link, unique profile/endpoint, and a
`result.json` written on preflight failure as well as app exit. Test the three
failure modes with a disposable harness fixture. Keep browser actions, Story
readiness, worker repair, and creative-session behavior outside the change.

## Do not file as new tickets

### Windows `rg` / guessed-path errors: retain the existing Conductor remedy

LUX-P11, LUX-P45, LUX-P49, and LUX-P68 show a real recurring pattern (literal
Windows wildcard operands and guessed owner paths). The saved decisions already
track `powershell-rg-glob-operands` repeatedly (for example decision sequences
37, 79, 84, 105, and 111), with the correct bounded rule: inventory first, search
an existing directory, and use `rg -g` for a filename filter. This is operator
correction consumption, not a user-facing Lux bug. Do not create another product
or stage ticket; fold any improvement into the existing Conductor/worker guidance.

### Historical harness/setup noise: preserve, but do not group as a product bug

Several LUX-P91 notes describe wrong selectors, a popover toggled closed, a
misnamed fake-worker message, stale UI assumptions, missing worktree dependencies,
or a scoped-access failure. Later corrected runs passed in several cases. They are
useful receipt evidence, but they should not be counted as recurrence of the
runtime-replacement defect unless the exact isolated product failure is reproduced.
Likewise, LUX-P121's resolution-settlement race is a harness readiness condition,
not evidence that the Story UI requires a runtime rewrite.

### GPU policy: do not restore the old serialized lane

LUX-P122 needs acknowledgement-safe transitions; it does not justify reviving the
blanket one-test-at-a-time rule explicitly rejected in LUX-P112 and LUX-P117. CPU
work and low-resolution functional previews remain independent of an exclusive
heavy-capture grant.
