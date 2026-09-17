# Two reference-inspired visuals — source-only handoff

Branch: `codex/fiber-optic-heart`.
Worktree: `C:/Users/zFlei/repos/lux/.worktrees/fiber-optic-heart`.
Base: `b4f327bdd5f44b5285fd278fe31ffdd15ebd406d`.
Author: `fiber-optic-heart-author`, Conductor agent `05b32b88-79d3-4649-b556-adf58ba11e96`.

The user explicitly requested blind code authoring and deferred execution to a
later agent. Neither scene was compiled, tested, launched or visually inspected.
Do not present these as working or usable. No merge, Library publication,
installation, shared SDK change or user-session mutation was performed.

| Draft | Source | Handoff | Tracker |
| --- | --- | --- | --- |
| Fiber-Optic Heart | `examples/components/fiber-optic-heart/composition.ts` | [Details](../../examples/components/fiber-optic-heart/HANDOFF.md) | LUX-191 |
| Pigment Rivers | `examples/components/pigment-rivers/composition.ts` | [Analysis and details](../../examples/components/pigment-rivers/HANDOFF.md) | LUX-192 |

Reference images are stored beside the drafts as `reference.png`. These are user
inputs, not screenshots of implemented behavior and not runtime textures.

## Source-only preparation commands for the later tester

```powershell
node scripts/prepare-reference-visual-bundle.mjs fiber-optic-heart artifacts/fiber-optic-heart-source.json
node scripts/prepare-reference-visual-bundle.mjs pigment-rivers artifacts/pigment-rivers-source.json
```

The script is unexecuted. It only copies a fixed source manifest into an SDK 0.4
source envelope and refuses overwrites. Its output is not a `.lux-scene` file.
Read each detailed handoff before compiling or launching anything. Follow current
profile isolation, GPU coordination and screenshot evidence rules.

## Deferred acceptance

- [ ] TypeScript and Lux source compilation for both complete bundles.
- [ ] Authored CPU tests and relevant contract checks.
- [ ] Independent code review and actual screenshot/interaction review.
- [ ] Control behavior, aspect ratios, alpha, pause/reset, motion and performance.
- [ ] Save/reopen and invalid-edit preservation.
- [ ] Decide whether to publish components or merge only after testing.

No testing agent was launched by this author. Use this document as its assignment
when the user is ready to test. The new components use current SDK contracts and
add no SDK capability; the shipped authoring skills and Library were not changed.
