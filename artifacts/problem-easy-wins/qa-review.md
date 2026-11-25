# LUX-217 independent review

Reviewed candidate `e11c1884df3e183aa1d55457736c357cad441341` against LUX-217.

## Required corrections

1. Persist an attempt manifest before Electron dependency preflight. A preflight error must be recorded in that manifest; the candidate throws before its first `persist()`.
2. Treat a package resolution through a legitimate pnpm junction or shared content store as valid. Validate the selected checkout, isolated profile, and launch inputs; do not require the resolved Electron executable to be physically beneath the checkout.
3. Record the meaningful preflight/launch resolution in evidence. The candidate's `resolution` field currently contains only the Electron executable path.
4. Replace the default visible-`Build` wait with a bounded ready condition that requires the Build action to be enabled and the requested resize to have settled. A timeout must stay a failed attempt, never an accepted startup.
5. Do not mark cleanup complete after swallowed `exit` and `close` errors. Retain those errors and mark completion only after the owned PID is verified stopped.
6. Do not describe a tracked-diff hash as complete source state. Include untracked inputs in provenance or name the field accurately.

No native/GPU launch was performed for this review. Re-review is required after the corrective patch and a real successful isolated harness receipt are available.

## Corrective-patch recheck

The working patch now persists preflight failures, accepts shared pnpm resolution,
and includes a worktree-status hash. It remains incomplete:

1. Its canvas predicate proves only a nonzero width. It does not prove that the
   requested resize settled.
2. The attempted isolated `APPDATA` is not used by the Studio main process.
   The latest parameters receipt still fails while creating the Roaming profile.
   The main source obtains `app.getPath('appData')` before it resolves the profile.
3. Cleanup checks `child.exitCode` immediately after close. It must await the
   owned child exit, with a bounded failure state, before marking cleanup complete.

The latest receipt is a correctly retained failed attempt. It is not evidence of
a successful isolated native harness run.

## Smoke receipt recheck

The later smoke receipt proves that the selected process can start and capture a
screen. It does not close the two remaining acceptance gaps. The smoke callback
overrides the helper default, checks only nonzero window dimensions, and accepts
any size at or below 640 by 360. It does not prove the requested viewport or
preview canvas resize settled. The helper also reads `child.exitCode` immediately
after close instead of awaiting the owned child exit. The receipt must not claim
completed cleanup until that bounded observation succeeds.

The focused unit test passed, but it does not exercise either condition.

## Final candidate status

The smoke receipt now records a 640 by 360 requested and actual viewport, a 640
by 191 rendered canvas, screenshot, executable and entry provenance, and an
owned PID with successful bounded cleanup. This supports scoped helper acceptance.

One error path still needs a minimal repair before acceptance: a non-`ESRCH`
error from cleanup PID polling throws before the final manifest persist. Cleanup
must record that error, force `ok` false, and persist in a `finally` path.
The historical parameters suite remains unverified because its selectors and busy
readiness are outside this ticket's focused proof.

## Acceptance

Approved candidate `9ee16901e01ef241d02e3b119b5fb09d4ee98d7a` for scoped LUX-217
acceptance. It catches cleanup polling failures, records them, and forces a failed
attempt. The focused helper test passed. The retained native smoke receipt proves
isolated startup, exact 640 by 360 viewport, 640 by 191 rendered canvas,
screenshot capture, launch provenance, and owned-process cleanup. Historical
parameters-suite behavior remains out of scope and unverified.
