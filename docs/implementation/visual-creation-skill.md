# Repo-shipped visual-creation skill

The maintained skill lives in [`skills/lux-visual-creation`](../../skills/lux-visual-creation/SKILL.md). It teaches the Lux visual lifecycle, Three/TSL primitives, complete-source editing, guarded MCP operations, playback and actual capture inspection. A procedural noise sphere supplies a concrete starting point. It does not implement missing SDK features.

## Install and keep current

Run from the checkout whose skill should be installed:

```sh
node scripts/install-visual-skill.mjs
node scripts/install-visual-skill.mjs --check
```

The default destination is `CODEX_HOME/skills/lux-visual-creation`, or `~/.codex/skills/lux-visual-creation` when `CODEX_HOME` is unset. `--check` reads only and fails on missing, changed or extra content. Reinstall updates changed files. Unexpected old or personal files are left untouched and reported for review; the installer does not silently delete them or modify other skills. `--destination` accepts the exact skill folder when a different installation location is needed.

Use `$lux-visual-creation` in a Codex task to request the skill. The repository's `AGENTS.md` requires updates, validation and reinstallation whenever author-facing SDK, assets or MCP behavior changes. Maintain examples against supported APIs, and record any local installation step that could not be completed. This is a development completion requirement, not an autonomous background updater.

## Validation and boundaries

- Skill Creator's frontmatter validator passed for the initial skill.
- The initial noise sphere passed the actual contained Lux CPU compiler without diagnostics. This establishes source/API acceptance; GPU appearance, motion and performance have not been inspected for that template.
- An independent read-only scenario review covered the noisy sphere brief, concurrent edits, preserved helpers/assets and a paused final state. It checked the skill against SDK, worker, source-workspace and MCP implementation. It found that discovery describes the adapter checkout rather than negotiating the running application's version; the skill was corrected accordingly.
- A baseline scenario without the skill already handled many constraints correctly. The new skill packages those contracts and creative examples for discoverability; no unsupported claim of measured behavioral improvement is made.
- Installer CPU tests exercise first install, repeat install, changed bytes, drift checks and preservation/rejection of unexpected or linked content. Run with `node --test tests/unit/install-visual-skill.test.mjs`.

Delivery record, 12 September 2026: skill428b2de, reviewed discovery correction6b7afb0, installer11428ce. Coordinator independently reran the real sphere compilation (`ok: true`, no diagnostics) and all eight installer tests. Installed to `C:/Users/zFlei/.codex/skills/lux-visual-creation`; `--check` reports no missing, changed or unexpected entries, and the installed skill passes Skill Creator validation. No running-task skill refresh or GPU appearance is claimed by these checks.

Current tracer constraints remain explicit: fixed Intensity is temporary; future parameters belong to the visual's own code. PNG/JPEG/alpha and asset playback must not be claimed from a pending branch or merely from the existence of an asset map. Pair the adapter with the Studio build and verify actual operation results. No live Studio, MCP mutation, GPU test or Resolume change is needed to install this skill.
