---
name: improve-ui
description: Inspect and refactor an existing application UI for its real use cases, then validate the running result. Use for requests to improve a UI area, streamline a panel, fix layout or density, or turn screenshot feedback into implemented UX improvements. Respect critique-only requests; do not implement when the user asks only for analysis.
---

# Improve an existing UI

Turn the user's chosen area into a better working interface. Inspect, diagnose, implement, and verify within the authorized scope. Do not stop at recommendations when implementation was requested. Keep the plan proportional; a small panel does not need a new design system or a long approval cycle. For critique-only requests, inspect and report without product edits, new tickets, or launches that alter user state unless separately authorized.

## Establish the real task and baseline

- Identify what people accomplish here, their frequent actions, expected content volume, and how this area relates to the rest of the application. Infer from the request and existing product before asking questions.
- Inspect the running UI and relevant implementation. Record the source/build and profile; a screenshot from an older installation cannot validate a changed checkout. Protect active user sessions and saved data. Never use an active unsaved document or its live profile/assets as a mutable test fixture; use a disposable profile and representative copies or generated data.
- Capture a baseline with enough surrounding UI to judge space allocation. Use representative content, including realistic dense data and long labels. Choose the states that could change the design: empty/populated, expanded/collapsed, narrow/wide panel, loading/error, selection, or search. Do not test every combination mechanically.
- If the application cannot run, use supplied images and code for provisional findings. State that runtime validation remains incomplete; do not present a mockup as implementation evidence.

## Diagnose the whole layout

Write a short issue-to-outcome list. Distinguish observed problems from hypotheses. Inspect the entire relevant ancestor/child layout and CSS cascade, not only the visibly broken element: padding, gap, flex sizing, min/max dimensions, overflow, breakpoints, specificity, and scroll ownership.

Assess hierarchy, readable type, contrast, action placement, discoverability, selection feedback, keyboard focus, and access to hidden content. For dense tools, default to compact spacing while preserving readable labels and usable hit targets. Avoid making each control look like a spacious standalone card. Judge how much useful content fits at the real panel width.

Look for unnecessary chrome and duplicated information. Consider header actions with accessible names and tooltips, progressive disclosure, search/filtering, and useful empty/error states when they solve the actual task. Do not hide essential meaning solely to save space.

Inspect existing shared controls, tokens, and patterns first. Reuse suitable ones. Change or extract a shared component only when the affected usages justify it; check those usages for regressions. Avoid a new abstraction for one local spacing fix.

Separate layout efficiency from runtime performance. Inspect expensive rendering, measurement, list volume, or asset loading when there is evidence of a performance problem. Measure before claiming a speed improvement. Do not add virtualization or caching merely because a panel contains a list.

## Implement the shortest useful change

State the intended visible result and a few acceptance checks, then implement. Preserve existing actions, user content, selection, values, and persistence unless the request changes them. Trace dynamic UI to its live data producer; a plausible field or successful compilation does not prove a working feature.

Keep scope tight. Delegate only concrete independent work when authorized, with task-appropriate model/effort and relevant context. A tiny change may be faster locally. Keep independent review where required; for a substantive refactor, have a fresh reviewer assess both code and actual UI evidence.

Reuse the project's working launch and test path. Use an isolated test profile, track owned processes, and clean them up. Coordinate shared graphics resources according to current project policy. A lower rendering resolution can reduce test load without shrinking the UI viewport; verify the actual resolution rather than assuming the command worked.

## Validate behavior and visual result together

- Run focused checks for changed behavior and relevant regressions. Do not build a large test framework for static spacing or write tests that simply repeat CSS declarations.
- Capture the changed application at relevant sizes and states, preferably comparable to the baseline. Verify the source/build actually running. Inspect screenshots yourself; passing geometry assertions can still hide a poor design.
- Exercise affected actions using real pointer and keyboard input. For docking/resizing, use supported layout operations. Do not force styles, dispatch synthetic clicks, or bypass visibility checks to claim an interaction is usable.
- Check dense content, long labels, clipping, scroll reachability, collapse/expand, focus, and state preservation where affected. For live values, verify both active and unavailable states from real runtime data.
- Have review assess whether the result supports the use case, not just whether requested CSS changed. Fix actionable findings and refresh evidence after material changes.
- When a harness fails, distinguish harness/setup errors from product defects. Inspect the first meaningful failure; bound retries to known transient conditions. Do not keep repeating an unchanged failing run or claim intended setup as observed fact.

Keep the final source, screenshots, checks, and review aligned. Submit completion only after the last material fix. If merging, installing, or restarting is authorized, perform it and verify the delivered build; otherwise clearly separate implemented, reviewed, merged, installed, and running states.

## Report

Briefly explain what improved for the user, show the relevant actual-app screenshots, and state checks and remaining limits. Avoid equating ticket closure or test counts with usability. Do not claim permanent workflow effectiveness from one successful use. Record recurring workflow failures through the project's existing process, without creating another reporting system.

