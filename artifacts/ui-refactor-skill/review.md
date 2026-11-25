# Independent forward review — `improve-ui`

**Verdict: approve with two small clarifications before installation.** The workflow is usefully proportional: it requires evidence from the actual UI, preserves critique-only scope, avoids automatic virtualization, and treats interaction failures as product evidence rather than a reason to force a test through.

## 1. Cramped 2,000-item asset browser

Treat the installed-app screenshot as a baseline only. Inspect the worktree implementation and shared disclosure's other usages, then diagnose the enclosing layout, scroll owner, and realistic long-label/dense-content state. Preserve the person's unsaved work: do not restart, save, import into, or attach an adapter to their running profile. Launch the changed worktree only with an isolated test profile and representative non-user data. Reuse the disclosure if it fits; change shared code only after checking affected consumers. Investigate list rendering and scrolling, but add virtualization only after measured evidence that it is necessary.

Evidence: baseline screenshot annotated by source/profile mismatch; exact worktree/build/profile for the test; populated narrow and ordinary-width captures; real scroll, disclosure, selection, search/filter (if present), and keyboard/focus observations; focused regressions. Stop if no isolated build can be run, the only data is user-owned unsaved content, or the installed screenshot cannot be tied to the worktree; report a provisional diagnosis rather than validation. The skill implies this correctly, but should state more directly that a user profile must never be used as the representative-data source.

## 2. Screenshot critique only

Inspect the supplied settings screenshot and give an issue-to-outcome critique covering hierarchy, density, labels, contrast, grouping, action placement, clipping, and likely keyboard/focus risks. Label all non-visible behavior as hypothesis. Do not edit files, launch a process, change settings, create tests, or open a tracker item. Stop after the critique; say that responsive, interaction, and runtime conclusions require a representative running capture.

This is handled explicitly by the opening "Respect critique-only" rule. A useful clarification would make the no-write/no-launch boundary explicit so critique does not accidentally expand into baseline collection.

## 3. CSS checks pass; file list is tiny; clear action is offscreen

Treat the screenshot and failed real click as the decisive finding: the panel is still unusable. Inspect the first meaningful failure and the full layout chain—panel height allocation, flex min-size, overflow/scroll ownership, header/action placement, breakpoints, and focus visibility. Verify the exact running build and viewport. Correct the layout only after locating the constraint, then recapture the dense list and exercise Clear with real pointer and keyboard input, including scrolling/reachability and focus. Passing CSS tests remain supporting evidence only.

Stop retries when the same test failure has no changed condition. If Clear is reachable in the product but the harness cannot scroll or target it, classify that as a harness limitation and retain the missing QA evidence; if it is offscreen in the product, retain it as an unresolved defect until the visual and interaction checks pass. Do not dispatch a synthetic click or force styles to manufacture a pass.

## Omissions and overengineering check

- Add a direct rule for active unsaved sessions: never use their profile, document, or assets as test fixtures; make a disposable representative fixture/profile first.
- Add a direct critique-only stop boundary: no code, process, or tracker mutation unless separately authorized.
- For 2,000-item lists, the existing measured-evidence rule is good. Do not prescribe virtualization, caching, a new design system, or broad test scaffolding.
- "Fresh reviewer" is appropriate for substantive refactors, but could define the trigger with a brief example (shared component, changed interaction, or multi-state layout) to prevent routine spacing fixes from acquiring unnecessary process.
