# Standard Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Studio profile one durable, growing component library backed by repository source files and seeded into desktop installations.

**Architecture:** `ComponentLibraryStore` owns a directory whose atomic catalog points to immutable component revision directories containing real TypeScript source files. Checkout sessions resolve that directory from Git's common directory. Desktop packages record that same marked repository root and use it when available; a standalone installation uses a visible app-data fallback seeded by the package, then merges nonconflicting fallback additions when the repository returns. A filesystem lock serializes migration, create, and update across Studio processes.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Electron Studio, Node test runner, esbuild desktop packaging.

**Spec:** Conductor ticket `LUX-137` revision 4.

## Global Constraints

- Preserve legacy profile entries, scene link revisions, saved source fallbacks, and fork behavior.
- Never select a winner silently when migration content conflicts or lose concurrent additions.
- Test stores use temporary library roots and never touch a user library.
- Keep ordinary scene save/build operations local; only explicit library create/update mutates the shared library.

---

### Task 1: Directory Store, Migration, and Concurrency

**Files:**
- Modify: `packages/core/src/component-library-store.ts`
- Modify: `tests/core/component-library.test.ts`

**Interfaces:**
- `new ComponentLibraryStore(root, { legacyPath?, seedRoots?, ... })`
- Existing `list`, `read`, `create`, and `update` contracts remain unchanged.

- [ ] Add failing tests for source-file persistence, two-store discovery, concurrent creates, concurrent update conflicts, successful legacy migration, and retained conflicting migrations.
- [ ] Run `node --test tests/core/component-library.test.ts` and confirm each new behavior fails for the missing directory store.
- [ ] Implement bounded catalog/revision reads, atomic catalog activation, a cross-process lock, seed merge, and legacy migration.
- [ ] Re-run the focused test until all cases pass.

### Task 2: Shared Studio Location and Desktop Seed

**Files:**
- Create: `apps/studio/src/standard-library.ts`
- Modify: `apps/studio/src/main.ts`
- Create: `tests/studio/standard-library.test.ts`
- Modify: `scripts/studio-package.mjs`
- Modify: `tests/studio/desktop-package.test.mjs`
- Create: `library/catalog.json`
- Create: `library/README.md`

**Interfaces:**
- `resolveStandardLibrary({ workspace, appData, desktop, overrideRoot?, canonicalRoot?, gitCommonDirectory? })` returns `{ root, kind, seedRoots }`.

- [ ] Add failing tests for Git-common-root sharing, installed canonical/fallback selection, override isolation, and packaging selection.
- [ ] Run the focused Studio and package tests and confirm the new expectations fail.
- [ ] Wire the resolver into Studio, retain the current profile JSON as a migration input, and include `library/` in desktop source packaging.
- [ ] Re-run focused tests and direct Studio TypeScript validation.

### Task 3: Authoring Guidance and Candidate Verification

**Files:**
- Modify: `skills/lux-visual-creation/SKILL.md`
- Modify: `skills/lux-visual-creation/references/visual-programming.md`

**Interfaces:**
- Document the existing explicit create/update boundary, shared repository behavior, packaged seed behavior, and cross-machine release/repository flow.

- [ ] Update the shipped skill text without describing planned behavior as available.
- [ ] Run focused store/package tests, Studio TypeScript validation, Studio build, and skill install/check.
- [ ] Inspect the final diff, commit the candidate, and submit exact evidence plus remaining native two-profile/packaged-app QA to LUX-137.
