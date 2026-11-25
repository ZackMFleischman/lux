# LUX168 compatibility evidence

Checkout: .worktrees/component-type-compatibility, branch codex/component-type-compatibility, base0b6d2055. Only SDK TypeScript declarations, compiler regressions and author guidance change; executable helper behavior is unchanged.

Before the fix, the restored original fixture `(definition:ComponentDefinition)=>definition.create` failed the pinned compiler with TS2339, Property 'create' does not exist on type 'GraphComponentDefinition'. The command was `node --test --test-name-pattern='SDK 0.4 preserves ImageInputs' tests/compiler/typed-composition.test.mjs`, using LUX_COMPILER_DEPENDENCIES=C:/Users/zFlei/repos/lux/node_modules. Tool execution0f486c returned exit1 with exactly this diagnostic. This is the original source form, without a new kind guard.

The fix retains ComponentDefinition<C,I,O> as the legacy code factory alias and adds AnyComponentDefinition<C,I,O> for code-or-graph annotations. Graph definitions and the overloaded helper's implementation signature use the new union; code and graph overload results retain their precise types. The regression now compiles and links the unchanged annotation. Modern graph authoring and typed named-port fan-out remain covered.

Root/examples typechecks and Studio typecheck passed (executionea91dd/session65839, exit0). git diff --check passed. No GPU test is necessary for erased type aliases; no runtime function or persisted source/identity was changed.

Post-fix compiler run passed14/14 (session46074, final execution0971d9, exit0): component-model.test.mjs, typed-composition.test.mjs and shader-field-composition.test.mjs. This includes unchanged legacy annotation compile/link, modern defineVisual named-port fan-out, invalid typed resource rejection and sealed legacy identities.

Related correction: LUX-P111 f4432601-29cb-4701-95ad-e3fd5e913037. LUX150 historical acceptance remains visible; this bug must be independently accepted before bundled release.
