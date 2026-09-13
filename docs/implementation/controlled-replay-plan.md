# Controlled input replay implementation plan

> One fresh assigned conductor-worker uses executing-plans and test-driven development for each reviewed leaf. Root owns dispatch, independent review and serial integration. This plan creates no additional team or graphics session.

**Goal:** give controlled input jobs an immutable, bounded fixture whose exact bytes, seed, mapping plan and source transitions can be reproduced without live queue loss.

**Architecture:** first admit a portable scripted operation tape and bind its identity to canonical UTF-8 bytes. A following cursor leaf executes its intervals with complete delivery. Live-capture import is a distinct format and evidence gate because live ingress order and consumption times cannot be reconstructed from timestamp sorting or coalesced state.

**Tech stack:** existing JavaScript ESM, readonly `.d.mts`, Web Crypto SHA-256 available in the existing Node24.12.0 test host, Node tests and TypeScript7.0.2. No dependency installation.

**Baseline:** LUX-39 specification2, main `5b1749e91de13085521c7148e921998cccc0b15f`; I02b integrated/accepted as LUX-36. Governing specs: [creative inputs I02](creative-inputs-plan.md), [timed mapping](input-timeline-plan.md), [live timeline and retained replay gates](live-input-timeline-plan.md), [runtime clock](../design/runtime.md#clock-scheduling-and-bounds). Root authored this plan; independent critique is required before implementation.

## Current code and design choice

`mapping.mjs` owns numeric target/schema normalization and all shaping/smoothing math. `createTimedMappingState` uses exact normalized-plan JSON as an equality key, explicitly not a cryptographic identity. `timeline.mjs` owns live admission, source authority, receipt ingress, coalescing, 100ms event lateness, 32 events per step and 500ms sample freshness. Those live policies must not silently discard a controlled fixture. `RuntimeClock` owns injected time; `SeededRandom` accepts an unsigned32-bit seed. Neither module owns fixtures, cursors, recording or an installed asset store.

Three approaches were considered. Replaying envelopes through the live queue would incorrectly retain live overflow/lateness loss. Serializing only the final coalesced state loses event multiplicity and continuous trajectories. The selected design stores every scripted input and authority transition, admitting an exact operation order once; subsequent cursor execution has a separate complete-delivery contract. A live recording needs additional original receipt and effective consumption evidence, so scripted version1 cannot masquerade as a live capture.

## Delivery leaves and non-goals

| Leaf | Independently reviewable result | Required next gate |
| --- | --- | --- |
| I02c1, detailed here | Strict scripted fixture admission, canonical encoding/decoding/hash verification, ordered immutable operation tape and provenance | Fresh source review and exact main integration |
| I02c2 | Pure controlled cursor, reset/seek-by-replay, complete interval delivery and mapping integration | A separate current-code plan freezes cursor DTOs, subinterval evaluation and bounded job accounting before coding |
| I02c3 | Live recording/import retaining original receipts, rejection/discard outcomes and effective consumption placement | A separately versioned reviewed format and independent reconciliation against actual I02b operations |

Completing I02c1 is not completion of I02c or runtime replay. Do not add playback, capture, devices, synthetic generators, SDK exports, Studio/MCP, filesystem persistence, native transport, graph adapters or a scheduler to the first leaf. No public author capability changes, so no visual-creation skill installation belongs to it. Later author-facing work must update/install/check the repository skill.

## I02c1 exact files

Create only `packages/inputs/src/replay-fixture.mjs`, `replay-fixture.d.mts`, `tests/unit/replay-fixture.test.mjs`, and `tests/unit/replay-fixture-admission.test.mjs`. Existing mapping/timeline/runtime/SDK/config/barrel files remain read-only. Reuse exported `normalizeTimedMappingPlan` and `createLiveInputState` for the nested owners' authoritative admission; do not copy numeric schema rules or widen their limits. This fixture's own descriptor preflight precedes those calls and handles its larger bounded tape.

## Exported contract

All data is deeply readonly; returned objects and arrays are detached and recursively frozen. `InputEnvelope`, `TimelineDefinition`, `SourceAuthority` and `TimedMappingPlan` are imported from existing declarations.

```ts
export type FixtureConfigValue = string | number | boolean | null;
export type FixtureConfig = Readonly<Record<string, FixtureConfigValue>>;
export type ReplaySourceConfig = Readonly<{
  sourceId: string; calibrationId: string; configuration: FixtureConfig;
}>;
export type ScriptedReplayOperation =
  Readonly<{ kind: 'input'; atMs: number; envelope: InputEnvelope }> |
  Readonly<{ kind: 'sources'; atMs: number; sources: readonly SourceAuthority[] }>;
export type ScriptedReplayFixture = Readonly<{
  version: 1; mode: 'scripted'; durationMs: number; originEpoch: number; seed: number;
  generator: Readonly<{ id: string; version: string; configuration: FixtureConfig }>;
  mapping: TimedMappingPlan; definition: TimelineDefinition;
  sourceConfigs: readonly ReplaySourceConfig[];
  operations: readonly ScriptedReplayOperation[];
}>;
export type EncodedReplayFixture = Readonly<{
  fixture: ScriptedReplayFixture; json: string; sha256: string;
}>;
export function normalizeScriptedReplayFixture(input: unknown): ScriptedReplayFixture;
export function encodeScriptedReplayFixture(input: unknown): Promise<EncodedReplayFixture>;
export function decodeScriptedReplayFixture(json: string, expectedSha256: string): Promise<EncodedReplayFixture>;
export const replayFixtureLimits: Readonly<{
  bytes: 8388608; values: 250000; depth: 16; operations: 8192;
  durationMs: 600000; sourceConfigs: 256; configEntries: 32; configStringChars: 256;
}>;
```

The module exposes no cursor, live recorder, trusted wrapper, private mutable handles, device access or file writes. Normalized data is not an authority token. All public functions admit their inputs afresh; passing a frozen clone confers no provenance.

## Admission, bounds and exact ordering

1. Preflight all input as plain own enumerable data before constructing normalized descendants. Reject accessors without invoking them, symbols, sparse arrays, extra array keys, exotic prototypes, cycles, undefined/functions/bigints and non-finite numbers. Accept ordinary or null-prototype records. Shared acyclic values may be copied independently; charge every occurrence. Bound raw JSON-equivalent UTF-8 bytes to8MiB, visited values to250000, depth to16, array length to8192, record fields to32 and property names to64 code units. Count before copying offending descendants. This is not proxy-trap immunity or protection against already modified intrinsics.
2. Root and every DTO use exact fields. Version must be1 and mode exactly `scripted`; reject any live-capture marker, unknown field or future version. Duration is finite `[0,600000]`ms. Origin epoch is a nonnegative safe integer; seed an unsigned32-bit integer. Normalize negative zero to positive zero everywhere numeric, without rounding fractional milliseconds or values.
3. Normalize mapping with its existing public normalizer, preserving all existing target/binding/range/smoothing quotas. Definition must pass `createLiveInputState(definition, originEpoch, 0)`; reconstruct only its defined `version/sources/signals` fields from the admitted empty state, without persisting that state. Empty catalogues and empty tapes are valid. Do not call live admission for scripted envelopes.
4. Generator id uses the existing logical identifier grammar `[a-z][A-Za-z0-9_]{0,63}`, excluding `constructor`, `prototype`, `__proto__`. Generator version is a nonempty1–64-character ASCII token matching `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`. These are declared provenance, not proof a generator ran. Configuration is a flat record with at most32 keys using the logical grammar and finite scalar values; strings have at most256 UTF-16 code units. Sort configuration keys by exact code-unit order when normalizing. No nested objects or automatic interpretation. Config content should describe portable analysis/clock calibration, not OS device grants or paths; the format does not claim to recognize a physical identifier hidden in an arbitrary string.
5. SourceConfigs has at most256 entries, unique by structured `(sourceId,calibrationId)` pair using exact logical IDs. Require exactly the set of pairs referenced by initial authorities and every later authority snapshot, including disconnected sources; reject missing and unused entries. Normalize sourceConfigs by sourceId then calibrationId exact code-unit order. Same calibrationId under different sources is distinct. Rebinding configuration requires a new calibrationId; a shared pair cannot carry contradictory values. The descriptor records already-calibrated fixture time provenance, not an executed conversion or permission to open hardware.
6. Operations retain array order exactly; array index is the immutable operation identity. Each atMs is finite in `[0,durationMs]`, nondecreasing globally. Equal times are legal and preserve explicit order. Never sort operations by source, sequence or payload. Authority changes at the same time take effect according to this array order. All input records retain their original envelope fields and multiplicity; no deduplication, coalescing, lateness rejection or event cap32. At most8192 operations total; an8193rd rejects the whole fixture before returning any accepted prefix.
7. Input envelopes use I02b's exact version1 union, logical IDs, source tuple, safe sequence/generation/epoch, finite timestamp/value and event payload(type plus at most16 finite numeric values). Require envelope.epoch==originEpoch and envelope.timestampMs==operation.atMs. This equality intentionally restricts scripted version1; original receipt time and later effective placement belong to live-capture versioning. The source/signal must be declared with the matching kind, current source connected, current generation and calibration exact. Each source has one sequence/timestamp cursor across all its signals: sequence strictly increases, timestamp is nondecreasing. A later equal-payload event with a new sequence remains a distinct operation. No automatic authority promotion.
8. Sources operations provide the complete current source list in original definition order with exactly those source IDs. A same generation requires identical connected/calibration values; any changed authority requires strictly greater generation, and lower generation rejects. A changed source clears only its sequence/timestamp cursor; unchanged sources retain theirs. A snapshot with no changes is valid. Reuse `changeLiveInputSources` on a separate empty live authority state if useful for these exact semantics; it must never be used to admit, coalesce or discard tape inputs. Each operation's effect is simulated during validation; initial definition stays unchanged in the returned fixture.
9. No source catalogue change or epoch reset occurs inside version1. Such edits split recordings/jobs at an explicit new fixture boundary. Generations may be chosen freely in the initial definition and then only advance under the rule above. A mapped logical source may be undeclared or absent: the existing mapping policy permits unresolved sources; do not invent a requirement that every binding must have a supplied signal. Declared signals may likewise be unused by mappings.
10. Canonical output has the DTO field order shown above; nested envelopes/authorities have their existing declaration order; mapping has its authoritative normalizer's constructed field order; definition preserves declared source/signal order; configs sort keys; operations preserve order. Recompute normalized byte length and enforce8MiB. Bound errors with code `INVALID_REPLAY_FIXTURE`, path at most200 code units and message at most512; preserve owners' failures as bounded fixture errors identifying the nested path. Missing Web Crypto is `REPLAY_HASH_UNAVAILABLE` and no identity result is returned.

## Exact bytes and asynchronous identity

Canonical bytes are UTF-8 of `JSON.stringify(normalizedFixture)`, with no BOM, whitespace or trailing newline. SHA-256 is64 lower-case hex characters. The identity binds all fixture fields: mapping definitions and labels, seed, generator/config metadata, source calibration, origin epoch, duration and every operation. It is distinct from `TimedMappingState.planKey`; never replace that equality key or accept a supplied digest as proof of executable/source authority.

`encodeScriptedReplayFixture` synchronously normalizes and detaches the complete input before its first `await`, constructs canonical JSON and bytes, then calls captured available `crypto.subtle.digest('SHA-256', bytes)`. Mutation of caller objects immediately after the function returns its Promise cannot alter that operation's fixture/json/hash. After hashing, return a frozen wrapper with the frozen captured fixture. Do not defer access to caller data until after asynchronous work.

`decodeScriptedReplayFixture` requires primitive JSON string and exact lowercase expected digest. Check string length<=8MiB code units before allocating UTF-8, then actual UTF-8 bytes<=8MiB before parsing. A malformed JSON text yields bounded fixture error. After normalization, require JSON.stringify(normalizedFixture) to equal the provided string exactly. Thus duplicate keys, alternate number spelling, whitespace, different field order, escaped aliases and negative-zero spellings are rejected rather than silently hashed under a different representation. This is canonical-file admission, not a forgiving editor parser. Verify SHA-256 of these exact supplied bytes equals expected; mismatch yields bounded fixture error and no result. The caller supplies the expected digest from its authorized asset/job context; this module does not establish that external trust.

Roundtrip invariant: `decode(await encode(x).json, encoded.sha256)` reproduces exactly the same normalized fixture, string and hash. Equal normalized inputs including differently ordered config keys have equal identities. Reordering equal-time operations changes identity and may change admission. Reordering declared sources/signals remains represented and changes identity. A valid but differently labeled mapping conservatively changes identity. Cryptographic byte identity does not promise cross-GPU determinism or a trusted generator.

## Controlled cursor and live-capture gates retained

I02c2 must consume this immutable tape with a caller-supplied nonnegative runtime epoch, explicit previous/next interval and bounded job budget. Its separate plan must freeze how source transitions and continuous changes partition mapping evaluation. It must preserve every intermediate piecewise trajectory and generation reset: sampling only the last value of a long interval is insufficient. It may call only the existing timed evaluator for math. It must specify complete returned event identities `(fixtureHash,operationIndex)`, originals plus remapped runtime epoch, exact `(previous,next]` boundaries and one separately consumed time-zero batch. A repeated-time redraw emits no events. It must not apply I02b's100ms late-drop/32-event policy. Refuse a bounded job rather than truncate events, clamp time or claim completion when an intermediate interval remains.

Reset/seek must invalidate old runtime epochs, recreate mapping state and replay from zero through all required intermediate steps. No shortcut copying old smoothing state into a different fixture/seed/epoch. The eventual job reports actual executed intervals/events and fixture/plan/seed identities. Seed ownership stays with the runtime; this module does not instantiate randomness. Cancellation/deadline checks and real frame/capture pairing belong to I03 adapters, and CPU cursor tests cannot certify those setups.

I02c3 must define a different explicit version/mode. A live capture retains every original envelope/receipt, accepted ingress order, rejections and discards, every original continuous sample before coalescing, generation/calibration changes and actual effective consumption step. For example live A timestamp20 admitted before B timestamp10 can consume B first at step10; serializing/sorting originals cannot reconstruct that execution. Reconcile capture outcomes against actual I02b operations and retain incomplete/pending/dropped outcomes explicitly. Neither an admitted-event count nor a final coalesced snapshot proves full recording. Do not relabel a live tape as scripted by replacing original timestamps or discarding receipt data.

## Implementation steps and evidence contract

- [ ] Create failing tests importing the three functions and limits; retain a baseline absent-module red. Then add concrete behavior tests before implementing each admission/encoding case. No stub export followed by tests that merely echo its outputs.
- [ ] Implement bounded descriptor capture, exact DTO normalization and operation authority simulation in replay-fixture.mjs; declarations mirror all exported readonly unions. Keep existing owners untouched.
- [ ] Implement canonical bytes/hash capture and verified decode; add immediate caller mutation and canonical corruption regressions before their fixes. Use real SHA-256, with an independently calculated known fixture digest in test expectations.
- [ ] Run both new suites plus existing timeline/mapping/parameter suites, strict explicit-file type audit, whitespace and four-path scope checks. Commit the tested source, map every criterion to raw results/exact checkout/commit/executor, submit for fresh review and stop the worker session.

Minimal first valid fixture uses empty mapping `{version:2,mapping:{version:1,targets:[],bindings:[]},smoothing:[]}`, definition `{version:1,sources:[],signals:[]}`, no sourceConfigs/operations, duration0, originEpoch0, seed1, generator `{id:'test',version:'1',configuration:{}}`. It must normalize, encode and decode unchanged. Add a declared source A generation0/calibration `cal0`, event tuple `a/note`, sourceConfigs pair `a/cal0`, then two input operations at0 with equal payload `[60,0.5]` and sequence0/1; both must survive canonical roundtrip in order.

Root planning probe against the actual mapping/timeline owners computed the empty fixture digest `6fe6b41ca6a3926d8800c74e54aa9ab03a079b183f5ae21a72b055390f77880e`. Its8192-note fixture has1,916,314 UTF-8 bytes,155,685 visited values and depth6, so the operation-count boundary is reachable below the proposed byte/value/depth limits. Script and exact canonical string are retained in MAIN-root `.worktrees/_coordination/LUX-39/feasibility.mjs` and `feasibility.json`. These establish plan feasibility and an independent hash expectation, not a passing implementation test.

| Criterion/precondition | Concrete observation required | Executor and evidence |
| --- | --- | --- |
| Reproducible exact identity | Encode known empty fixture; compare JSON to a literal canonical string and SHA to an independent Node `createHash` calculation/literal digest. Config insertion order normalizes identically; seed, one event value, mapping label, duration or same-time operation permutation changes hash when admission remains valid. | Worker/red-green then independent reviewer known-answer probe at exact source SHA |
| Original repeated event identities | Two equal notes at0 seq0/1 preserved, roundtrip exact order;8192 legal small note operations survive and8193 rejects. No live queue call or overflow count substitutes for tape preservation. | Both suites; exact fixture byte/value counts prove count bound reachable below other caps |
| Source-wide ordering | Continuous seq5 then note seq4 rejects; tied timestamp seq6 accepts; generation1 envelope cannot promote current0. Explicit sources change to1 resets cursor so seq0 passes; old0 fails. Same-generation disconnect fails, increased generation disconnect rejects subsequent input, later reconnect requires another increase. | Independent expected outcomes plus unchanged caller input |
| Simultaneous transition order | At10, old-gen event then generation change is legal; change then old-gen event rejects. New-gen event after change at10 passes. Different source cursors independent; operations at9 after global10 reject. | Exact per-operation path/result; no sorting repair |
| Bounds/provenance | Missing/unused/duplicate config pair rejects; changed calibration requires matching config. Source64/65 and signal256/257 preserve owner bounds. Payload16/17, seed0/0xffffffff/outside, duration600000/above, raw bytes/value/depth exact boundary and next unit. | Worker documents any stricter-cap dominance and constructs reachable boundary fixtures |
| Hostile data/canonical parsing | Getter counter stays0, sparse/symbol/exotic/cycle/nonfinite rejected; duplicates/unknown fields rejected. Decode whitespace/newline/BOM/duplicate keys/alternate numbers/uppercase hash/wrong digest fail without returning a fixture. | Retain exact corrupt strings and bounded code/path/message assertions |
| Async snapshot | Start encode with valid mutable fixture; immediately replace operations/seed/config before awaiting. Result matches pre-call detached content and independent hash. Frozen output cannot mutate nested data. | Real asynchronous digest with explicit before/after snapshots |
| Owner compatibility/types | Existing78 tests remain green; strict `.mts` fixture imports all types/functions, narrows operation unions and tests readonly/wrong-version fields. Both encode/decode result types agree. | Pinned Node24.12.0 and TS7.0.2 commands/raw outputs; no shared config edits |

Focused combined command adds `tests/unit/replay-fixture.test.mjs tests/unit/replay-fixture-admission.test.mjs` to the existing seven-file I02b timeline/mapping/parameters Node `--test` command in live-input-timeline-plan.md. A separate ignored strict declaration fixture must resolve the executing checkout. With actual TS7.0.2 explicit files use `--ignoreConfig --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022`; ordinary project config builds are unchanged. If resolving the native compiler through getExePath.js, inspect its actual default export and require a successful nonempty path.

Independent review checks full first-leaf coverage and preserves the subsequent cursor/live-capture/runtime gates. Root integration compares all four accepted hashes and reruns focused tests plus a fixture explicitly resolving landed main. No passing CPU command proves real device provenance, trusted installation, runtime deadline, capture pixels or full I02c completion.
