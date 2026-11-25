LUX-150: Code and graph implementations now share defineComponent; defineVisual names the runnable graph. Legacy defineComposition and direct visuals remain supported without rewriting saved sources or identities. Direct visuals expose a view-only Visual node with the same Inspector controls.

Source candidate: df472683234847f426f594ccdd414889c2783c61. Application changes: 784a7d8d59d4872200f7f0e9578fbeb993da57fc and ccf7f8108500e36e0c2772f96d79f1470a586562; subsequent commits only maintain the native runner. Worktree: C:/Users/zFlei/repos/lux/.worktrees/component-model, codex/component-model.

Completed: design critique, implementation, compatibility/compiler/runtime/persistence/UI checks, source review, native direct/legacy/new graph workflows, skill source update. Existing target tuples and runtime/persistence formats remain intact. No audio implementation or LUX-7/LUX-59 policy change.

Remaining acceptance: final independent screenshot review, coordinator integration and shipped skill install/check. Evidence and precise native limitations are in evidence.md beside this summary. GPU released; all owned app processes exited.
