import type { InputEnvelope, TimelineDefinition, SourceAuthority } from './timeline.mjs';
import type { TimedMappingPlan, InputValue } from './mapping.mjs';

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
  mapping: TimedMappingPlan; authority: 'studio'; base: readonly InputValue[];
  definition: TimelineDefinition;
  sourceConfigs: readonly ReplaySourceConfig[];
  operations: readonly ScriptedReplayOperation[];
}>;
export type EncodedReplayFixture = Readonly<{
  fixture: ScriptedReplayFixture; json: string; sha256: string;
}>;
/** Revalidates plain data; detached frozen results confer no execution authority. */
export function normalizeScriptedReplayFixture(input: unknown): ScriptedReplayFixture;
/** Captures all input synchronously before asynchronous SHA-256 identity. */
export function encodeScriptedReplayFixture(input: unknown): Promise<EncodedReplayFixture>;
/** Requires exact canonical UTF-8 JSON and verifies the caller's expected hash. */
export function decodeScriptedReplayFixture(json: string, expectedSha256: string): Promise<EncodedReplayFixture>;
export const replayFixtureLimits: Readonly<{
  bytes: 8388608; values: 250000; depth: 16; operations: 8192;
  durationMs: 600000; sourceConfigs: 256; configEntries: 32; configStringChars: 256;
}>;
