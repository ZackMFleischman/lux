var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// packages/runtime-contracts/src/parameters.mjs
function invalid(path, message) {
  throw Object.assign(new Error(`${path}: ${message}`), { code: "INVALID_PARAMETERS", path });
}
function record(input, path) {
  if (!input || typeof input !== "object") invalid(path, "expected a plain data record");
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== null && prototype !== Object.prototype) invalid(path, "expected a plain data record");
  const result = /* @__PURE__ */ Object.create(null);
  for (const key2 of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key2);
    if (typeof key2 !== "string" || !descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) invalid(path, "expected enumerable own data properties");
    result[key2] = descriptor.value;
  }
  return result;
}
function denseArray(input, path) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) invalid(path, "expected a plain array");
  const length = Object.getOwnPropertyDescriptor(input, "length")?.value;
  if (!Number.isSafeInteger(length) || Reflect.ownKeys(input).length !== length + 1) invalid(path, "expected a dense own data array");
  const result = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) invalid(path, "expected dense own data array elements");
    result.push(descriptor.value);
  }
  return result;
}
function stableId(id3, path) {
  if (typeof id3 !== "string" || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(id3) || reservedIds.has(id3)) invalid(path, "invalid ID");
  return id3;
}
function controlId(id3) {
  return stableId(id3, "controls");
}
function text(value, path, maximum) {
  if (typeof value !== "string" || !value.isWellFormed() || /[\u0000-\u001f\u007f-\u009f]/.test(value)) invalid(path, "expected valid Unicode without control characters");
  const normalized = value.trim();
  if (!normalized || [...normalized].length > maximum) invalid(path, `expected 1\u2013${maximum} code points`);
  return normalized;
}
function finite(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(path, "expected a finite number");
  return Object.is(value, -0) ? 0 : value;
}
function optionalMetadata(raw, result, path) {
  if (Object.hasOwn(raw, "description")) result.description = text(raw.description, `${path}.description`, parameterLimits.description);
  if (Object.hasOwn(raw, "group")) result.group = text(raw.group, `${path}.group`, parameterLimits.group);
}
function enumOptions(input, path) {
  const rows = denseArray(input, path);
  if (rows.length < 2 || rows.length > 64) invalid(path, "expected 2\u201364 enum options");
  const result = [], ids = /* @__PURE__ */ new Set();
  for (let index = 0; index < rows.length; index++) {
    const optionPath = `${path}.${index}`, raw = record(rows[index], optionPath);
    for (const key2 of ["id", "label"]) if (!Object.hasOwn(raw, key2)) invalid(optionPath, `missing field ${key2}`);
    for (const key2 of Object.keys(raw)) if (!["id", "label", "description"].includes(key2)) invalid(optionPath, `unsupported field ${key2.slice(0, 80)}`);
    const id3 = stableId(raw.id, `${optionPath}.id`);
    if (ids.has(id3)) invalid(path, `duplicate option ID ${id3}`);
    ids.add(id3);
    const option = { id: id3, label: text(raw.label, `${optionPath}.label`, parameterLimits.label) };
    if (Object.hasOwn(raw, "description")) option.description = text(raw.description, `${optionPath}.description`, parameterLimits.description);
    result.push(Object.freeze(option));
  }
  return Object.freeze(result);
}
function definition(id3, input, normalizedRow) {
  const path = `controls.${controlId(id3)}`, raw = record(input, path);
  for (const key2 of [...normalizedRow ? ["id"] : [], ...commonRequiredFields, ...normalizedRow ? ["changeCost"] : []]) if (!Object.hasOwn(raw, key2)) invalid(path, `missing field ${key2}`);
  if (normalizedRow && raw.changeCost !== "live") invalid(path, "changeCost must be live");
  const type = raw.type;
  const kindFields = type === "number" ? numberFields : type === "boolean" || type === "trigger" ? [] : type === "enum" ? enumFields : null;
  if (!kindFields) invalid(`${path}.type`, "expected number, boolean, enum, or trigger");
  const requiredKindFields = type === "number" ? ["default", "min", "max"] : type === "boolean" ? ["default"] : type === "enum" ? ["default", "options"] : [];
  for (const key2 of requiredKindFields) if (!Object.hasOwn(raw, key2)) invalid(path, `missing field ${key2}`);
  const allowed = [...normalizedRow ? ["id", "changeCost"] : [], ...commonRequiredFields, ...type === "trigger" ? [] : ["default"], ...commonOptionalFields, ...kindFields];
  for (const key2 of Object.keys(raw)) if (!allowed.includes(key2)) invalid(path, `unsupported field ${key2.slice(0, 80)}`);
  const label = text(raw.label, `${path}.label`, parameterLimits.label);
  if (type === "trigger") {
    const result2 = { id: id3, type: "trigger", label };
    optionalMetadata(raw, result2, path);
    result2.changeCost = "live";
    return Object.freeze(result2);
  }
  if (type === "number") {
    const minimum = finite(raw.min, `${path}.min`), maximum = finite(raw.max, `${path}.max`), value = finite(raw.default, `${path}.default`);
    if (!(minimum < maximum) || !Number.isFinite(maximum - minimum)) invalid(path, "min must be below max with a finite range");
    if (value < minimum || value > maximum) invalid(`${path}.default`, `expected a number from ${minimum} to ${maximum}`);
    const result2 = { id: id3, type: "number", label, default: value, min: minimum, max: maximum };
    if (Object.hasOwn(raw, "step")) {
      const step = finite(raw.step, `${path}.step`);
      if (step <= 0 || step > maximum - minimum) invalid(`${path}.step`, "expected a positive increment no greater than the range");
      result2.step = step;
    }
    if (Object.hasOwn(raw, "unit")) result2.unit = text(raw.unit, `${path}.unit`, parameterLimits.unit);
    optionalMetadata(raw, result2, path);
    result2.changeCost = "live";
    return Object.freeze(result2);
  }
  if (type === "boolean") {
    if (typeof raw.default !== "boolean") invalid(`${path}.default`, "expected a boolean");
    const result2 = { id: id3, type: "boolean", label, default: raw.default };
    optionalMetadata(raw, result2, path);
    result2.changeCost = "live";
    return Object.freeze(result2);
  }
  const options = enumOptions(raw.options, `${path}.options`);
  if (typeof raw.default !== "string" || !options.some((option) => option.id === raw.default)) invalid(`${path}.default`, "expected an admitted enum option ID");
  const presentation = Object.hasOwn(raw, "presentation") ? raw.presentation : "dropdown";
  if (!enumPresentations.has(presentation)) invalid(`${path}.presentation`, "expected segmented, radio, or dropdown");
  const result = { id: id3, type: "enum", label, default: raw.default, options, presentation };
  optionalMetadata(raw, result, path);
  result.changeCost = "live";
  return Object.freeze(result);
}
function finishSchema(rows) {
  if (encoder.encode(JSON.stringify(rows)).byteLength > parameterLimits.metadataBytes) invalid("controls", "schema exceeds 32 KiB UTF-8");
  return Object.freeze(rows);
}
function normalizeControlDeclarations(input) {
  const raw = record(input, "controls");
  return finishSchema(Object.keys(raw).map((id3) => definition(id3, raw[id3], false)));
}
function normalizeControlSchema(input) {
  const values2 = denseArray(input, "controls"), rows = [], ids = /* @__PURE__ */ new Set();
  for (let index = 0; index < values2.length; index++) {
    const raw = record(values2[index], `controls[${index}]`), id3 = controlId(raw.id);
    if (ids.has(id3)) invalid("controls", `duplicate control ID ${id3}`);
    ids.add(id3);
    rows.push(definition(id3, raw, true));
  }
  return finishSchema(rows);
}
function canonicalControlSchemaJson(schema3) {
  return JSON.stringify(normalizeControlSchema(schema3));
}
function defaultControlValues(schema3) {
  return Object.freeze(Object.fromEntries(normalizeControlSchema(schema3).filter((control) => control.type !== "trigger").map((control) => [control.id, control.default])));
}
function isNumberControlDefinition(value) {
  return value.type === "number";
}
function admittedValue(control, input, path) {
  if (control.type === "trigger") throw Object.assign(new Error("Trigger controls use the trigger command."), { code: "INVALID_PARAMETERS", path });
  if (control.type === "number") {
    const value = finite(input, path);
    if (value < control.min || value > control.max) invalid(path, `expected a number from ${control.min} to ${control.max}`);
    return value;
  }
  if (control.type === "boolean") {
    if (typeof input !== "boolean") invalid(path, "expected a boolean");
    return input;
  }
  if (typeof input !== "string" || !control.options.some((option) => option.id === input)) invalid(path, "expected an admitted enum option ID");
  return input;
}
function values(schema3, input, complete) {
  const definitions = normalizeControlSchema(schema3), raw = record(input, "values"), keys = Object.keys(raw);
  if (!complete && !keys.length) invalid("values", "expected a nonempty parameter patch");
  const known = new Map(definitions.map((control) => [control.id, control]));
  for (const id3 of keys) if (!known.has(id3)) invalid(`values.${id3.slice(0, 64)}`, "unknown parameter ID");
  for (const id3 of keys) if (known.get(id3).type === "trigger") admittedValue(known.get(id3), raw[id3], `values.${id3}`);
  const result = {};
  for (const control of definitions) {
    if (control.type === "trigger") continue;
    const path = `values.${control.id}`;
    if (!Object.hasOwn(raw, control.id)) {
      if (complete) invalid(path, "missing parameter in full snapshot");
      continue;
    }
    result[control.id] = admittedValue(control, raw[control.id], path);
  }
  return Object.freeze(result);
}
function validateControlPatch(schema3, input) {
  return values(schema3, input, false);
}
function validateControlSnapshot(schema3, input) {
  return values(schema3, input, true);
}
var parameterLimits, commonRequiredFields, commonOptionalFields, numberFields, enumFields, reservedIds, enumPresentations, encoder;
var init_parameters = __esm({
  "packages/runtime-contracts/src/parameters.mjs"() {
    "use strict";
    parameterLimits = Object.freeze({ metadataBytes: 32768, id: 64, label: 80, unit: 24, description: 512, group: 80 });
    commonRequiredFields = ["type", "label"];
    commonOptionalFields = ["description", "group"];
    numberFields = ["min", "max", "step", "unit"];
    enumFields = ["options", "presentation"];
    reservedIds = /* @__PURE__ */ new Set(["constructor", "prototype", "__proto__"]);
    enumPresentations = /* @__PURE__ */ new Set(["segmented", "radio", "dropdown"]);
    encoder = new TextEncoder();
  }
});

// packages/runtime-contracts/src/components.mjs
function invalid2(path, message) {
  throw Object.assign(new Error(`${path}: ${message}`), { code: "INVALID_COMPONENT_METADATA", path });
}
function record2(input, path, expected) {
  if (!input || typeof input !== "object") invalid2(path, "expected a plain data record");
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== null && prototype !== Object.prototype) invalid2(path, "expected a plain data record");
  const result = /* @__PURE__ */ Object.create(null);
  for (const key2 of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key2);
    if (typeof key2 !== "string" || !descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      invalid2(path, "expected enumerable own data properties");
    }
    if (expected && !expected.includes(key2)) invalid2(path, "unsupported field");
    result[key2] = descriptor.value;
  }
  if (expected) {
    for (const key2 of expected) if (!Object.hasOwn(result, key2)) invalid2(path, `missing field ${key2}`);
  }
  return result;
}
function text2(value, path, maximum) {
  if (typeof value !== "string" || !value.isWellFormed() || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    invalid2(path, "expected valid Unicode without control characters");
  }
  if (!value || value.trim() !== value || [...value].length > maximum) {
    invalid2(path, `expected 1\u2013${maximum} code points without edge whitespace`);
  }
  return value;
}
function portId(value, path) {
  if (!/^[a-z][A-Za-z0-9_]{0,63}$/.test(value) || reservedIds2.has(value)) invalid2(path, "invalid port ID");
  return value;
}
function portType(input, path) {
  const raw = record2(input, path);
  if (raw.kind === "signal") {
    record2(raw, path, ["kind", "value", "unit", "clock"]);
    if (raw.value !== "number" || raw.clock !== "frame") invalid2(path, "expected number signal with frame clock");
    const unit = raw.unit === null ? null : text2(raw.unit, `${path}.unit`, componentMetadataLimits.signalUnit);
    return Object.freeze({ kind: "signal", value: "number", unit, clock: "frame" });
  }
  if (raw.kind === "image") {
    record2(raw, path, ["kind", "colorSpace", "alphaMode"]);
    if (raw.colorSpace !== "linear-srgb" || raw.alphaMode !== "premultiplied") invalid2(path, "expected linear-srgb premultiplied image");
    return Object.freeze({ kind: "image", colorSpace: "linear-srgb", alphaMode: "premultiplied" });
  }
  if (raw.kind === "paths2d") {
    record2(raw, path, ["kind", "version", "coordinateSpace"]);
    if (raw.version !== 1 || raw.coordinateSpace !== "canvas-height") invalid2(path, "expected paths2d version 1 in canvas-height coordinates");
    return Object.freeze({ kind: "paths2d", version: 1, coordinateSpace: "canvas-height" });
  }
  if (raw.kind === "shader-field") {
    record2(raw, path, ["kind", "version", "abi"]);
    if (raw.version !== 1 || typeof raw.abi !== "string" || raw.abi.length > 96 || !/^[a-z][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)+$/.test(raw.abi)) invalid2(path, "expected shader-field version 1 with a bounded slash-separated ABI identifier");
    return Object.freeze({ kind: "shader-field", version: 1, abi: raw.abi });
  }
  invalid2(path, "unsupported port type");
}
function ports(input, path, maximum) {
  const raw = record2(input, path), keys = Object.keys(raw).sort();
  if (keys.length > maximum) invalid2(path, `at most ${maximum} ports are supported`);
  return Object.freeze(Object.fromEntries(keys.map((key2) => {
    const location = `${path}.${portId(key2, path)}`;
    const port = record2(raw[key2], location, ["type", "label", "description"]);
    return [key2, Object.freeze({
      type: portType(port.type, `${location}.type`),
      label: text2(port.label, `${location}.label`, componentMetadataLimits.label),
      description: text2(port.description, `${location}.description`, componentMetadataLimits.description)
    })];
  })));
}
function tags(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) invalid2("tags", "expected a plain array");
  const length = Object.getOwnPropertyDescriptor(input, "length").value;
  if (length > componentMetadataLimits.tags) invalid2("tags", "at most 16 raw tags are supported");
  if (Reflect.ownKeys(input).length !== length + 1) invalid2("tags", "unexpected array properties");
  const values2 = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) invalid2("tags", "expected dense own data array elements");
    values2.push(text2(descriptor.value, `tags[${i}]`, componentMetadataLimits.tag));
  }
  return Object.freeze([...new Set(values2)].sort());
}
function serialize(metadata) {
  return JSON.stringify({ ...metadata, controls: JSON.parse(canonicalControlSchemaJson(metadata.controls)) });
}
function normalize(input, normalizedControls) {
  const raw = record2(input, "component", fields);
  if (raw.declarationVersion !== 1) invalid2("declarationVersion", "expected version 1");
  if (typeof raw.key !== "string" || raw.key.length > componentMetadataLimits.key || !/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test(raw.key)) {
    invalid2("key", "expected a bounded namespace/name declaration key");
  }
  const controls = normalizedControls ? normalizeControlSchema(raw.controls) : normalizeControlDeclarations(raw.controls);
  const descriptions = record2(raw.controlDescriptions, "controlDescriptions");
  if (Object.keys(descriptions).length !== controls.length || controls.some((control) => !Object.hasOwn(descriptions, control.id))) {
    invalid2("controlDescriptions", "expected exactly one description per control");
  }
  const controlDescriptions = Object.freeze(Object.fromEntries(Object.keys(descriptions).sort().map((key2) => [key2, text2(descriptions[key2], `controlDescriptions.${key2}`, componentMetadataLimits.description)])));
  const lifecycle = record2(raw.lifecycle, "lifecycle", ["state", "reset"]);
  if (!["stateless", "stateful"].includes(lifecycle.state) || lifecycle.reset !== "seed") invalid2("lifecycle", "unsupported state or reset");
  const result = Object.freeze({
    declarationVersion: 1,
    key: raw.key,
    label: text2(raw.label, "label", componentMetadataLimits.label),
    description: text2(raw.description, "description", componentMetadataLimits.description),
    tags: tags(raw.tags),
    inputs: ports(raw.inputs, "inputs", componentMetadataLimits.inputs),
    outputs: ports(raw.outputs, "outputs", componentMetadataLimits.outputs),
    controls,
    controlDescriptions,
    lifecycle: Object.freeze({ state: lifecycle.state, reset: lifecycle.reset })
  });
  if (encoder2.encode(serialize(result)).byteLength > componentMetadataLimits.metadataBytes) invalid2("component", "metadata exceeds 64 KiB UTF-8");
  return result;
}
function normalizeComponentDeclaration(input) {
  return normalize(input, false);
}
function normalizeComponentMetadata(input) {
  return normalize(input, true);
}
var componentMetadataLimits, encoder2, reservedIds2, fields;
var init_components = __esm({
  "packages/runtime-contracts/src/components.mjs"() {
    "use strict";
    init_parameters();
    componentMetadataLimits = Object.freeze({
      registryEntries: 128,
      inputs: 16,
      outputs: 16,
      tags: 16,
      tag: 32,
      key: 96,
      portId: parameterLimits.id,
      label: 80,
      description: 512,
      signalUnit: 24,
      metadataBytes: 65536,
      registryBytes: 1048576
    });
    encoder2 = new TextEncoder();
    reservedIds2 = /* @__PURE__ */ new Set(["constructor", "prototype", "__proto__"]);
    fields = ["declarationVersion", "key", "label", "description", "tags", "inputs", "outputs", "controls", "controlDescriptions", "lifecycle"];
  }
});

// packages/assets/src/limits.mjs
var MiB, assetLimits, assetJsonBytes;
var init_limits = __esm({
  "packages/assets/src/limits.mjs"() {
    "use strict";
    MiB = 1048576;
    assetLimits = Object.freeze({ count: 64, imageBytes: 32 * MiB, totalBytes: 128 * MiB, rgbaBytes: 512 * MiB, dimension: 8192, pathCharacters: 240 });
    assetJsonBytes = Math.ceil(assetLimits.totalBytes / 3) * 4 + assetLimits.count * 1024;
  }
});

// packages/assets/src/png.mjs
import { decode as decodeFastPng } from "fast-png";
import zlib from "pako/lib/zlib/inflate.js";
import ZStream from "pako/lib/zlib/zstream.js";
var maxChunks, typedArrayByteLength, typedArraySet, crcTable;
var init_png = __esm({
  "packages/assets/src/png.mjs"() {
    "use strict";
    init_limits();
    maxChunks = Math.ceil(assetLimits.imageBytes / 1024) + 256;
    typedArrayByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
    typedArraySet = Uint8Array.prototype.set;
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let n = i;
      for (let bit = 0; bit < 8; bit++) n = n >>> 1 ^ (n & 1 ? 3988292384 : 0);
      crcTable[i] = n;
    }
  }
});

// packages/assets/src/jpeg.mjs
import decodeJpegJs from "jpeg-js/lib/decoder.js";
var decoderBudget, typedArrayByteLength2, typedArraySet2;
var init_jpeg = __esm({
  "packages/assets/src/jpeg.mjs"() {
    "use strict";
    init_limits();
    decoderBudget = Object.freeze({ megapixels: assetLimits.dimension ** 2 / 1e6, memoryMiB: Math.ceil(assetLimits.dimension ** 2 * 24 / 1048576) });
    typedArrayByteLength2 = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
    typedArraySet2 = Uint8Array.prototype.set;
  }
});

// packages/assets/src/index.mjs
var alphabet, sourceFields, derivedFields, base64Values;
var init_src = __esm({
  "packages/assets/src/index.mjs"() {
    "use strict";
    init_limits();
    init_png();
    init_jpeg();
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    sourceFields = ["mediaType", "encoding", "data"];
    derivedFields = [...sourceFields, "byteLength", "sha256", "width", "height"];
    base64Values = new Int16Array(128).fill(-1);
    for (let i = 0; i < alphabet.length; i++) base64Values[alphabet.charCodeAt(i)] = i;
  }
});

// packages/runtime-contracts/src/story.mjs
var storyLimits, storyLifecycleLimits;
var init_story = __esm({
  "packages/runtime-contracts/src/story.mjs"() {
    "use strict";
    storyLimits = Object.freeze({ beats: 128, occurrences: 1024, id: 128, label: 160 });
    storyLifecycleLimits = Object.freeze({
      sceneBytes: 234881024,
      aggregateSourceTextBytes: 16777216,
      linkedEnvelopeBytes: 195799724,
      aggregateLinkedEnvelopeBytes: 268435456,
      scheduleMetadataBytes: 1048576,
      visuals: 8,
      slotsPerGeneration: 2,
      generationsPerClient: 2,
      pendingCreatesPerGeneration: 1,
      readyInactiveSlotsPerGeneration: 1,
      lookaheadSeconds: 5,
      preparationMs: 5e3,
      commandReceiptMs: 8e3,
      cleanupMs: 5e3,
      assetBackingPerGeneration: 1342177280,
      assetBackingPerClient: 2684354560,
      assetStagingPerClient: 671088640,
      storyTargetBytesPerGeneration: 201326592,
      storyTargetBytesPerClient: 402653184,
      readbackBytesPerClient: 33554432,
      pngBytes: 41943040
    });
  }
});

// apps/build-worker/src/sdk-selection.mjs
var entries;
var init_sdk_selection = __esm({
  "apps/build-worker/src/sdk-selection.mjs"() {
    "use strict";
    entries = Object.freeze({ "0.1.0": "index.ts", "0.2.0": "sdk-v2.ts", "0.3.0": "sdk-components.ts", "0.4.0": "sdk-composition.ts" });
  }
});

// apps/build-worker/src/source-policy.mjs
var MiB2, sourceBytes, codeOutputBytes, sourceJsonBytes, compileMs, linkMs, limits;
var init_source_policy = __esm({
  "apps/build-worker/src/source-policy.mjs"() {
    "use strict";
    init_src();
    init_story();
    init_sdk_selection();
    MiB2 = 1048576;
    sourceBytes = 4 * MiB2;
    codeOutputBytes = 16 * MiB2;
    sourceJsonBytes = assetJsonBytes + 6 * sourceBytes;
    compileMs = 12e4;
    linkMs = 6e4;
    limits = Object.freeze({
      sourceBytes,
      files: 128,
      diagnosticBytes: 131072,
      compileMs,
      linkMs,
      /** Studio compile+link child deadline; agent and MCP waits extend it. */
      buildMs: compileMs + linkMs + 3e4,
      /** One Studio agent operation (bridge/MCP): a full build plus Studio-side admission. */
      agentOperationMs: compileMs + linkMs + 6e4,
      outputBytes: assetJsonBytes + codeOutputBytes,
      linkedBytes: storyLifecycleLimits.linkedEnvelopeBytes,
      sourceJsonBytes,
      requestBytes: sourceJsonBytes + 2 * MiB2,
      /** Single-visual Scene v2–v6 JSON (one source plus settings/controls) and its file. */
      sceneJsonBytes: sourceJsonBytes + MiB2,
      sceneFileBytes: sourceJsonBytes + 2 * MiB2,
      /** Isolated compiler/linker child processes hold the whole request, parsed copy and decoded images. */
      // The Job Object supervisor accepts at most 4 GiB (scripts/experiment-job.cs).
      workerHeapMiB: 2048,
      workerMemoryBytes: 4 * 1024 * MiB2,
      /** Scene v7 shared linking: every visual's artifact, and the sealed capsule, stay within the aggregate linked budget. */
      sharedCapsuleBytes: storyLifecycleLimits.aggregateLinkedEnvelopeBytes,
      sharedRequestBytes: storyLifecycleLimits.aggregateLinkedEnvelopeBytes + 8 * MiB2
    });
    if (limits.outputBytes !== limits.linkedBytes) throw Error("Linked envelope budget must equal the artifact budget");
  }
});

// packages/runtime-contracts/src/index.ts
import { z } from "zod";
var SDK_VERSION, sourceSdkVersionSchema, hashSchema, runtimeKeySchema, outputSettingsSchema, DEFAULT_OUTPUT, controlDefinitionSchema, INTENSITY_CONTROL, controlValuesSchema, legacySourceBundleSchema, sourceAssetSchema, assetSourceBundleSchema, sourceBundleSchema, compileRequestSchema, compileDiagnosticSchema, legacyCompiledArtifactSchema, derivedAssetSchema, assetCompiledArtifactSchema, parameterNumberControlDefinitionSchema, parameterBooleanControlDefinitionSchema, parameterEnumOptionSchema, parameterEnumControlDefinitionSchema, parameterTriggerControlDefinitionSchema, parameterControlDefinitionSchema, parameterCompiledArtifactSchema, storyIdSchema, storyBeatCapabilitySchema, storyCompiledArtifactSchema, componentPortSchema, componentMetadataDtoSchema, componentCompiledArtifactSchema, compositionCompiledArtifactSchema, compiledArtifactSchema, compileFailureCodeSchema, compileResultSchema;
var init_src2 = __esm({
  "packages/runtime-contracts/src/index.ts"() {
    "use strict";
    SDK_VERSION = "0.1.0";
    sourceSdkVersionSchema = z.enum(["0.1.0", "0.2.0", "0.3.0", "0.4.0"]);
    hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
    runtimeKeySchema = z.object({ instanceId: z.string().uuid(), generation: z.number().int().nonnegative().safe() }).strict();
    outputSettingsSchema = z.object({
      width: z.number().int().min(1).max(1920),
      height: z.number().int().min(1).max(1080),
      fps: z.number().finite().positive().max(240),
      seed: z.number().int().min(0).max(4294967295)
    }).strict();
    DEFAULT_OUTPUT = Object.freeze({ width: 1920, height: 1080, fps: 60, seed: 0 });
    controlDefinitionSchema = z.object({
      id: z.literal("intensity"),
      type: z.literal("number"),
      label: z.literal("Intensity"),
      default: z.literal(0.5),
      min: z.literal(0),
      max: z.literal(1),
      changeCost: z.literal("live")
    }).strict();
    INTENSITY_CONTROL = Object.freeze({
      id: "intensity",
      type: "number",
      label: "Intensity",
      default: 0.5,
      min: 0,
      max: 1,
      changeCost: "live"
    });
    controlValuesSchema = z.object({ intensity: z.number().finite().min(0).max(1) }).strict();
    legacySourceBundleSchema = z.object({ entry: z.string().min(1), files: z.record(z.string()), sdkVersion: sourceSdkVersionSchema }).strict();
    sourceAssetSchema = z.object({ mediaType: z.enum(["image/bmp", "image/png", "image/jpeg"]), encoding: z.literal("base64"), data: z.string().min(1) }).strict();
    assetSourceBundleSchema = legacySourceBundleSchema.extend({ sourceVersion: z.literal(2), assets: z.record(sourceAssetSchema) }).strict();
    sourceBundleSchema = z.union([legacySourceBundleSchema, assetSourceBundleSchema]);
    compileRequestSchema = z.object({ source: sourceBundleSchema }).strict();
    compileDiagnosticSchema = z.object({
      code: z.string(),
      message: z.string(),
      file: z.string().optional(),
      line: z.number().int().positive().optional(),
      column: z.number().int().positive().optional()
    }).strict();
    legacyCompiledArtifactSchema = z.object({
      sourceHash: hashSchema,
      bundleHash: hashSchema,
      entry: z.string().min(1),
      modules: z.record(z.string()),
      sourceMaps: z.record(z.string()),
      dependencyHashes: z.record(hashSchema),
      sdkVersion: z.literal(SDK_VERSION),
      compilerVersion: z.string().min(1)
    }).strict();
    derivedAssetSchema = sourceAssetSchema.extend({ byteLength: z.number().int().positive(), sha256: hashSchema, width: z.number().int().min(1).max(8192), height: z.number().int().min(1).max(8192) }).strict();
    assetCompiledArtifactSchema = legacyCompiledArtifactSchema.extend({ artifactVersion: z.literal(2), assets: z.record(derivedAssetSchema), assetSetHash: hashSchema }).strict();
    parameterNumberControlDefinitionSchema = z.object({
      id: z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/),
      type: z.literal("number"),
      label: z.string().min(1),
      default: z.number().finite(),
      min: z.number().finite(),
      max: z.number().finite(),
      step: z.number().finite().positive().optional(),
      unit: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      group: z.string().min(1).optional(),
      changeCost: z.literal("live")
    }).strict();
    parameterBooleanControlDefinitionSchema = z.object({
      id: z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/),
      type: z.literal("boolean"),
      label: z.string().min(1),
      default: z.boolean(),
      description: z.string().min(1).optional(),
      group: z.string().min(1).optional(),
      changeCost: z.literal("live")
    }).strict();
    parameterEnumOptionSchema = z.object({
      id: z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/),
      label: z.string().min(1),
      description: z.string().min(1).optional()
    }).strict();
    parameterEnumControlDefinitionSchema = z.object({
      id: z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/),
      type: z.literal("enum"),
      label: z.string().min(1),
      default: z.string(),
      options: z.array(parameterEnumOptionSchema).min(2).max(64),
      presentation: z.enum(["segmented", "radio", "dropdown"]),
      description: z.string().min(1).optional(),
      group: z.string().min(1).optional(),
      changeCost: z.literal("live")
    }).strict();
    parameterTriggerControlDefinitionSchema = z.object({
      id: z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/),
      type: z.literal("trigger"),
      label: z.string().min(1),
      description: z.string().min(1).optional(),
      group: z.string().min(1).optional(),
      changeCost: z.literal("live")
    }).strict();
    parameterControlDefinitionSchema = z.discriminatedUnion("type", [
      parameterNumberControlDefinitionSchema,
      parameterBooleanControlDefinitionSchema,
      parameterEnumControlDefinitionSchema,
      parameterTriggerControlDefinitionSchema
    ]);
    parameterCompiledArtifactSchema = assetCompiledArtifactSchema.extend({
      artifactVersion: z.literal(3),
      sdkVersion: z.literal("0.2.0"),
      controls: z.array(parameterControlDefinitionSchema),
      controlSchemaHash: hashSchema
    }).strict();
    storyIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/).refine((id3) => !["constructor", "prototype", "__proto__"].includes(id3));
    storyBeatCapabilitySchema = z.discriminatedUnion("kind", [
      z.object({ id: storyIdSchema, kind: z.literal("sustained"), seek: z.literal("none") }).strict(),
      z.object({ id: storyIdSchema, kind: z.literal("timed"), seek: z.literal("direct") }).strict()
    ]);
    storyCompiledArtifactSchema = parameterCompiledArtifactSchema.extend({
      artifactVersion: z.literal(6),
      sdkVersion: z.literal("0.2.0"),
      storyCapability: z.object({ version: z.literal(1), beats: z.array(storyBeatCapabilitySchema).min(1).max(128).refine((beats) => new Set(beats.map((beat) => beat.id)).size === beats.length) }).strict(),
      storyCapabilityHash: hashSchema
    }).strict();
    componentPortSchema = z.object({
      type: z.union([
        z.object({ kind: z.literal("image"), colorSpace: z.literal("linear-srgb"), alphaMode: z.literal("premultiplied") }).strict(),
        z.object({ kind: z.literal("signal"), value: z.literal("number"), unit: z.string().nullable(), clock: z.literal("frame") }).strict(),
        z.object({ kind: z.literal("paths2d"), version: z.literal(1), coordinateSpace: z.literal("canvas-height") }).strict(),
        z.object({ kind: z.literal("shader-field"), version: z.literal(1), abi: z.string().max(96).regex(/^[a-z][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)+$/) }).strict()
      ]),
      label: z.string(),
      description: z.string()
    }).strict();
    componentMetadataDtoSchema = z.object({
      declarationVersion: z.literal(1),
      key: z.string(),
      label: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      inputs: z.record(componentPortSchema),
      outputs: z.record(componentPortSchema),
      controls: z.array(parameterControlDefinitionSchema),
      controlDescriptions: z.record(z.string()),
      lifecycle: z.object({ state: z.enum(["stateless", "stateful"]), reset: z.literal("seed") }).strict()
    }).strict();
    componentCompiledArtifactSchema = parameterCompiledArtifactSchema.extend({
      artifactVersion: z.literal(4),
      sdkVersion: z.literal("0.3.0"),
      executionModel: z.literal("single-image-source-v1"),
      component: componentMetadataDtoSchema,
      componentMetadataHash: hashSchema
    }).strict();
    compositionCompiledArtifactSchema = parameterCompiledArtifactSchema.extend({
      artifactVersion: z.literal(5),
      sdkVersion: z.literal("0.4.0"),
      executionModel: z.enum(["image-chain-v1", "typed-image-graph-v1"]),
      composition: z.unknown(),
      compositionHash: hashSchema
    }).strict();
    compiledArtifactSchema = z.union([legacyCompiledArtifactSchema, assetCompiledArtifactSchema, parameterCompiledArtifactSchema, componentCompiledArtifactSchema, compositionCompiledArtifactSchema, storyCompiledArtifactSchema]);
    compileFailureCodeSchema = z.enum(["SOURCE_BOUNDARY_VIOLATION", "COMPILE_FAILED", "QUOTA_EXCEEDED", "TIMEOUT", "SERVICE_UNAVAILABLE"]);
    compileResultSchema = z.discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), artifact: compiledArtifactSchema, diagnostics: z.array(compileDiagnosticSchema) }).strict(),
      z.object({ ok: z.literal(false), code: compileFailureCodeSchema, diagnostics: z.array(compileDiagnosticSchema) }).strict()
    ]);
  }
});

// packages/runtime-contracts/src/identities.ts
import { z as z2 } from "zod";
var projectIdSchema, sceneIdSchema, componentIdSchema, assetIdSchema, projectRevisionIdSchema, sceneRevisionIdSchema, uuidSchema, readableGraphId, graphIdSchema, nodeIdSchema, edgeIdSchema;
var init_identities = __esm({
  "packages/runtime-contracts/src/identities.ts"() {
    "use strict";
    projectIdSchema = z2.string().uuid().brand();
    sceneIdSchema = z2.string().uuid().brand();
    componentIdSchema = z2.string().uuid().brand();
    assetIdSchema = z2.string().uuid().brand();
    projectRevisionIdSchema = z2.string().uuid().brand();
    sceneRevisionIdSchema = z2.string().uuid().brand();
    uuidSchema = z2.string().uuid();
    readableGraphId = /^[a-z][a-z0-9._-]{0,95}$/;
    graphIdSchema = z2.string().refine(
      (value) => readableGraphId.test(value) || uuidSchema.safeParse(value).success,
      { message: "Invalid graph identifier" }
    );
    nodeIdSchema = graphIdSchema.brand();
    edgeIdSchema = graphIdSchema.brand();
  }
});

// packages/core/src/component-library.ts
var init_component_library = __esm({
  "packages/core/src/component-library.ts"() {
    "use strict";
    init_identities();
    init_source_policy();
  }
});

// packages/runtime-contracts/src/audio-input.mjs
var objectPrototype, finite2, safe;
var init_audio_input = __esm({
  "packages/runtime-contracts/src/audio-input.mjs"() {
    "use strict";
    objectPrototype = Object.prototype;
    finite2 = Number.isFinite;
    safe = Number.isSafeInteger;
  }
});

// packages/runtime-contracts/src/control-animation.mjs
var objectPrototype2, arrayPrototype, finite3, RuntimeSet, call, hasOwn, setHas, setAdd, regexTest, arrayPush, encoder3, encode, shapes, envelopes, distributions;
var init_control_animation = __esm({
  "packages/runtime-contracts/src/control-animation.mjs"() {
    "use strict";
    init_audio_input();
    objectPrototype2 = Object.prototype;
    arrayPrototype = Array.prototype;
    finite3 = Number.isFinite;
    RuntimeSet = Set;
    call = Function.prototype.call;
    hasOwn = call.bind(Object.prototype.hasOwnProperty);
    setHas = call.bind(Set.prototype.has);
    setAdd = call.bind(Set.prototype.add);
    regexTest = call.bind(RegExp.prototype.test);
    arrayPush = call.bind(Array.prototype.push);
    encoder3 = new TextEncoder();
    encode = call.bind(TextEncoder.prototype.encode);
    shapes = new RuntimeSet(["sine", "triangle", "saw", "square"]);
    envelopes = new RuntimeSet(["linear", "exponential"]);
    distributions = new RuntimeSet(["random", "centered", "spread"]);
  }
});

// packages/runtime-contracts/src/tempo.mjs
var freeze, finite4, objectPrototype3, hasOwn2, DEFAULT_TEMPO_SETTINGS;
var init_tempo = __esm({
  "packages/runtime-contracts/src/tempo.mjs"() {
    "use strict";
    freeze = Object.freeze;
    finite4 = Number.isFinite;
    objectPrototype3 = Object.prototype;
    hasOwn2 = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
    DEFAULT_TEMPO_SETTINGS = freeze({ bpm: 120 });
  }
});

// packages/core/src/scene-soundtrack.ts
var soundtrackExtensions, soundtrackByteLimit;
var init_scene_soundtrack = __esm({
  "packages/core/src/scene-soundtrack.ts"() {
    "use strict";
    init_source_policy();
    soundtrackExtensions = Object.freeze(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac"]);
    soundtrackByteLimit = 200 * 1024 * 1024;
  }
});

// packages/core/src/story-scene-v2.ts
var encoder4;
var init_story_scene_v2 = __esm({
  "packages/core/src/story-scene-v2.ts"() {
    "use strict";
    init_src2();
    init_source_policy();
    init_src();
    init_parameters();
    init_control_animation();
    init_tempo();
    init_story();
    init_scene_soundtrack();
    encoder4 = new TextEncoder();
  }
});

// packages/core/src/scene-document.ts
import { z as z3 } from "zod";
var legacySchema, schema;
var init_scene_document = __esm({
  "packages/core/src/scene-document.ts"() {
    "use strict";
    init_src2();
    init_source_policy();
    init_src();
    init_parameters();
    init_identities();
    init_component_library();
    init_control_animation();
    init_tempo();
    init_story();
    init_story_scene_v2();
    init_scene_soundtrack();
    legacySchema = z3.object({ format: z3.literal("lux-scene"), version: z3.literal(1), source: legacySourceBundleSchema.extend({ sdkVersion: z3.literal("0.1.0") }), settings: outputSettingsSchema, controls: controlValuesSchema }).strict();
    schema = z3.discriminatedUnion("version", [legacySchema, legacySchema.extend({ version: z3.literal(2), source: assetSourceBundleSchema.extend({ sdkVersion: z3.literal("0.1.0") }) }).strict()]);
  }
});

// apps/studio/src/controls/control-state.ts
async function sha256(bytes2) {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes2));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
var LEGACY_CONTROL_SCHEMA, LEGACY_CONTROL_SCHEMA_HASH;
var init_control_state = __esm({
  "apps/studio/src/controls/control-state.ts"() {
    "use strict";
    init_parameters();
    init_source_policy();
    init_scene_document();
    LEGACY_CONTROL_SCHEMA = normalizeControlSchema([{ id: "intensity", type: "number", label: "Intensity", default: 0.5, min: 0, max: 1, changeCost: "live" }]);
    LEGACY_CONTROL_SCHEMA_HASH = "2f686a688523e2aa6e5368cd286974b87b324cfa4c67507563658b25cadd5a87";
  }
});

// apps/studio/src/visual-model.ts
function visualSelection(runtime, path) {
  return path?.length === 0 && runtime?.sdkVersion === "0.4.0" ? null : path;
}
function profileOccurrence(profile, path) {
  let definitionHash = profile.graph.rootDefinitionHash;
  for (const nodeId of path) {
    const definition3 = profile.definitions[definitionHash];
    if (definition3?.kind !== "graph") return void 0;
    const node2 = definition3.body.nodes.find((row) => row.id === nodeId);
    if (!node2) return void 0;
    definitionHash = node2.definitionHash;
  }
  const definition2 = profile.definitions[definitionHash];
  return definition2 ? { nodePath: [...path], definitionHash, definition: definition2, metadata: definition2.metadata } : void 0;
}
function directOccurrence(runtime) {
  const schema3 = runtime.controlSchema ?? LEGACY_CONTROL_SCHEMA, definitionHash = runtime.controlSchemaHash ?? LEGACY_CONTROL_SCHEMA_HASH;
  const metadata = { declarationVersion: 1, key: "lux/direct-visual", label: "Visual", description: "Direct visual component", tags: [], inputs: {}, outputs: { image: { type: { kind: "image", colorSpace: "linear-srgb", alphaMode: "premultiplied" }, label: "Image", description: "Final image" } }, controls: schema3, controlDescriptions: Object.fromEntries(schema3.filter((control) => control.description).map((control) => [control.id, control.description])), lifecycle: { state: "stateful", reset: "seed" } };
  return { nodePath: [], definitionHash, definition: { kind: "code", metadata }, metadata };
}
function compositionOccurrence(runtime, path) {
  return runtime?.composition ? profileOccurrence(runtime.composition, path) : runtime && runtime.sdkVersion !== "0.4.0" && path.length === 0 ? directOccurrence(runtime) : void 0;
}
function children(profile, focus) {
  const definition2 = profileOccurrence(profile, focus)?.definition;
  if (definition2?.kind !== "graph") return [];
  return definition2.body.nodes.map((node2) => {
    const child = profile.definitions[node2.definitionHash], nodePath = [...focus, node2.id], siblings = definition2.body.nodes.filter((row) => row.definitionHash === node2.definitionHash), index = siblings.findIndex((row) => row.id === node2.id);
    return { ...node2, nodePath, definition: child, metadata: child.metadata, label: child.metadata.label + (siblings.length > 1 ? ` ${index + 1}` : "") };
  });
}
function compositionNodes(runtime) {
  const profile = runtime?.composition;
  if (!profile) {
    const occurrence = compositionOccurrence(runtime, []);
    return occurrence ? [{ ...occurrence, id: "", controlDefaults: {}, label: occurrence.metadata.label }] : [];
  }
  const current = profile, result = [];
  function visit(path) {
    for (const node2 of children(current, path)) {
      result.push(node2);
      if (node2.definition.kind === "graph") visit(node2.nodePath);
    }
  }
  visit([]);
  return result;
}
function orderedChildren(profile, focus) {
  const nodes = children(profile, focus);
  const definition2 = profileOccurrence(profile, focus)?.definition;
  if (definition2?.kind !== "graph") return nodes;
  const remaining = new Set(nodes.map((node2) => node2.id));
  const ordered = [];
  while (remaining.size) {
    const next = nodes.find((node2) => remaining.has(node2.id) && !definition2.body.edges.some((edge2) => edge2.to.nodeId === node2.id && remaining.has(edge2.from.nodeId)));
    if (!next) return nodes;
    ordered.push(next);
    remaining.delete(next.id);
  }
  return ordered;
}
function compositionControlTarget(runtime, path, controlId2) {
  let occurrence = compositionOccurrence(runtime, path), targetPath = [...path], targetControl = controlId2;
  while (occurrence?.definition.kind === "graph") {
    const refs = occurrence.definition.body.controlBindings[targetControl];
    if (refs?.length !== 1) return void 0;
    targetPath = [...targetPath, refs[0].nodeId];
    targetControl = refs[0].controlId;
    occurrence = compositionOccurrence(runtime, targetPath);
  }
  return occurrence?.definition.kind === "code" && occurrence.metadata.controls.some((control) => control.id === targetControl) ? { nodePath: targetPath, controlId: targetControl } : void 0;
}
function visualControlNode(runtime, path) {
  if (runtime.sdkVersion === "0.4.0") return runtime.nodeControls?.nodes.find((node2) => nodeKey(node2.nodePath) === nodeKey(path));
  if (path.length) return void 0;
  const schemaHash = runtime.controlSchemaHash ?? LEGACY_CONTROL_SCHEMA_HASH;
  return { nodePath: [], definitionHash: schemaHash, schemaHash, schema: runtime.controlSchema ?? LEGACY_CONTROL_SCHEMA, values: runtime.controls ?? { intensity: runtime.intensity } };
}
function compositionNodeLabel(runtime, path) {
  if (!path.length) return compositionOccurrence(runtime, [])?.metadata.label ?? "Composition";
  const parent = path.slice(0, -1);
  return runtime?.composition ? children(runtime.composition, parent).find((node2) => nodeKey(node2.nodePath) === nodeKey(path))?.label ?? compositionOccurrence(runtime, path)?.metadata.label ?? "Component" : "Component";
}
var nodeKey;
var init_visual_model = __esm({
  "apps/studio/src/visual-model.ts"() {
    "use strict";
    init_control_state();
    nodeKey = (path) => JSON.stringify(path);
  }
});

// apps/studio/src/InspectorBreadcrumb.tsx
var InspectorBreadcrumb_exports = {};
__export(InspectorBreadcrumb_exports, {
  InspectorBreadcrumb: () => InspectorBreadcrumb
});
import { useRef, useState } from "react";
import { Button, Menu, MenuItem } from "@mui/material";
import { jsx, jsxs } from "react/jsx-runtime";
function InspectorBreadcrumb({ runtime, path, onSelect }) {
  const [anchor, setAnchor] = useState(null);
  const currentButton = useRef(null);
  const selectedParent = useRef(false);
  const parents = (path ?? []).slice(0, -1).map((_, index) => path.slice(0, index + 1));
  const hasComponent = path !== void 0;
  const available = !hasComponent || !!compositionOccurrence(runtime, path);
  const label = available ? compositionNodeLabel(runtime, path ?? []) : "Unavailable component";
  if (!hasComponent) return null;
  return /* @__PURE__ */ jsxs("nav", { className: "inspector-breadcrumb", "aria-label": "Inspector controls path", children: [
    /* @__PURE__ */ jsxs("ol", { children: [
      /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(
        Button,
        {
          color: "inherit",
          ref: hasComponent ? void 0 : currentButton,
          "aria-label": "Scene controls",
          "aria-current": !hasComponent ? "page" : void 0,
          onClick: (event) => {
            event.currentTarget.closest("details")?.querySelector("summary")?.focus();
            onSelect(null);
          },
          children: "Scene"
        }
      ) }),
      parents.length > 0 && /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(
        Button,
        {
          color: "inherit",
          "aria-label": "Parent controls",
          title: "Parent controls",
          "aria-haspopup": "menu",
          "aria-expanded": !!anchor,
          onClick: (event) => {
            selectedParent.current = false;
            setAnchor(event.currentTarget);
          },
          children: "\u2026"
        }
      ) }),
      hasComponent && /* @__PURE__ */ jsx("li", { className: "inspector-current", children: /* @__PURE__ */ jsx(
        Button,
        {
          color: "inherit",
          ref: currentButton,
          disabled: !available,
          "aria-label": `Controls for ${label}`,
          "aria-current": "page",
          title: label,
          onClick: (event) => {
            event.currentTarget.focus();
            onSelect(path);
          },
          children: /* @__PURE__ */ jsx("span", { children: label })
        }
      ) })
    ] }),
    /* @__PURE__ */ jsx(
      Menu,
      {
        anchorEl: anchor,
        open: !!anchor,
        onClose: () => setAnchor(null),
        disableRestoreFocus: selectedParent.current,
        slotProps: { list: { dense: true, "aria-label": "Parent controls" }, transition: { onExited: () => {
          if (selectedParent.current) currentButton.current?.focus();
        } } },
        children: parents.map((parent) => /* @__PURE__ */ jsx(
          MenuItem,
          {
            disabled: !compositionOccurrence(runtime, parent),
            sx: { fontSize: 12, minHeight: 28 },
            onClick: () => {
              selectedParent.current = true;
              setAnchor(null);
              onSelect(parent);
            },
            children: compositionNodeLabel(runtime, parent)
          },
          nodeKey(parent)
        ))
      }
    )
  ] });
}
var init_InspectorBreadcrumb = __esm({
  "apps/studio/src/InspectorBreadcrumb.tsx"() {
    "use strict";
    init_visual_model();
  }
});

// apps/studio/src/GraphPanel.tsx
var GraphPanel_exports = {};
__export(GraphPanel_exports, {
  GraphPanel: () => GraphPanel,
  compositionControlTarget: () => compositionControlTarget,
  compositionNodeLabel: () => compositionNodeLabel,
  compositionNodes: () => compositionNodes,
  compositionOccurrence: () => compositionOccurrence,
  nodeKey: () => nodeKey
});
import { useEffect, useMemo, useRef as useRef2, useState as useState2 } from "react";
import { Button as Button2 } from "@mui/material";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function GraphPanel({ runtime, selected, onSelect }) {
  const profile = runtime?.composition;
  const viewport = useRef2(null);
  const [focus, setFocus] = useState2([]);
  const [view, setView] = useState2({ x: 24, y: 40, zoom: 1 });
  const viewRef = useRef2(view);
  const [panning, setPanning] = useState2(false);
  const suppressClick = useRef2(false);
  const drag = useRef2(null);
  function updateView(next) {
    viewRef.current = next;
    setView(next);
  }
  const focusOccurrence = compositionOccurrence(runtime, focus), activeFocus = focusOccurrence?.definition.kind === "graph" ? focus : [];
  useEffect(() => {
    if (nodeKey(activeFocus) !== nodeKey(focus)) setFocus(activeFocus);
  }, [profile, focus, activeFocus]);
  const nodes = useMemo(() => profile ? orderedChildren(profile, activeFocus) : compositionNodes(runtime), [profile, runtime?.controlSchema, runtime?.controlSchemaHash, runtime?.sceneName, nodeKey(activeFocus)]), definition2 = compositionOccurrence(runtime, activeFocus)?.definition, body = definition2?.kind === "graph" ? definition2.body : null, output = body?.outputBindings.image;
  const selectedNode = nodes.find((node2) => nodeKey(node2.nodePath) === selected), canOpen = selectedNode?.definition.kind === "graph", width = Math.max(240, (nodes.length + 1) * 250 - 30), height = Math.max(180, 190 + (body?.edges.length ?? 0) * 12);
  function fit() {
    const box = viewport.current?.getBoundingClientRect();
    if (!box) return;
    const zoom2 = Math.max(0.2, Math.min(1, (box.width - 48) / width, (box.height - 48) / height));
    updateView({ x: (box.width - width * zoom2) / 2, y: Math.max(24, (box.height - height * zoom2) / 2), zoom: zoom2 });
  }
  function zoom(factor, point) {
    const box = viewport.current?.getBoundingClientRect();
    if (!box) return false;
    const current = viewRef.current;
    const nextZoom = Math.max(0.2, Math.min(2, current.zoom * factor));
    if (nextZoom === current.zoom) return false;
    const anchor = point ?? { x: box.width / 2, y: box.height / 2 };
    const ratio = nextZoom / current.zoom;
    updateView({ x: anchor.x - (anchor.x - current.x) * ratio, y: anchor.y - (anchor.y - current.y) * ratio, zoom: nextZoom });
    return true;
  }
  useEffect(() => {
    const canvas = viewport.current;
    if (!canvas) return;
    const wheel = (event) => {
      const box = canvas.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
      const delta = Math.max(-1e3, Math.min(1e3, event.deltaY * unit));
      event.preventDefault();
      zoom(Math.exp(-delta * 2e-3), { x: event.clientX - box.left, y: event.clientY - box.top });
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [!!body]);
  function endPan(event, cancel = false) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    drag.current = null;
    setPanning(false);
    suppressClick.current = !cancel && gesture.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && !gesture.moved) onSelect(null);
  }
  function enter(path) {
    if (compositionOccurrence(runtime, path)?.definition.kind === "graph") setFocus([...path]);
  }
  const parent = activeFocus.slice(0, -1), crumbs = activeFocus.map((_, index) => activeFocus.slice(0, index + 1));
  return /* @__PURE__ */ jsxs2("section", { className: "graph-panel", "aria-label": "Composition graph", children: [
    /* @__PURE__ */ jsxs2("div", { className: "graph-toolbar", children: [
      /* @__PURE__ */ jsx2(Button2, { onClick: () => onSelect(null), "aria-pressed": selected === null, children: "Scene controls" }),
      /* @__PURE__ */ jsxs2("nav", { className: "graph-breadcrumb", "aria-label": "Component breadcrumb", children: [
        /* @__PURE__ */ jsx2(Button2, { onClick: () => setFocus([]), children: "Scene" }),
        crumbs.map((path) => /* @__PURE__ */ jsxs2("span", { children: [
          /* @__PURE__ */ jsx2("span", { "aria-hidden": "true", children: "\u203A" }),
          /* @__PURE__ */ jsx2(Button2, { "aria-current": nodeKey(path) === nodeKey(activeFocus) ? "page" : void 0, onClick: () => setFocus(path), children: compositionNodeLabel(runtime, path) })
        ] }, nodeKey(path)))
      ] }),
      activeFocus.length > 0 && /* @__PURE__ */ jsx2(Button2, { onClick: () => setFocus(parent), "aria-label": `Back to ${compositionNodeLabel(runtime, parent)}`, children: "Back" }),
      canOpen && /* @__PURE__ */ jsx2(Button2, { onClick: () => selectedNode && enter(selectedNode.nodePath), children: "View inside" }),
      /* @__PURE__ */ jsx2(Button2, { onClick: () => zoom(1 / 1.2), "aria-label": "Zoom out", children: "\u2212" }),
      /* @__PURE__ */ jsxs2("span", { children: [
        Math.round(view.zoom * 100),
        "%"
      ] }),
      /* @__PURE__ */ jsx2(Button2, { onClick: () => zoom(1.2), "aria-label": "Zoom in", children: "+" }),
      /* @__PURE__ */ jsx2(Button2, { onClick: fit, children: "Fit" })
    ] }),
    !runtime ? /* @__PURE__ */ jsx2("p", { className: "hint", children: "Build a visual to see its composition." }) : /* @__PURE__ */ jsx2(
      "div",
      {
        className: `graph-viewport${panning ? " graph-panning" : ""}`,
        ref: viewport,
        "aria-label": "Graph canvas",
        onPointerDown: (event) => {
          if (drag.current) return;
          suppressClick.current = false;
          if (event.button !== 0 || event.isPrimary === false || event.target.closest("button")) return;
          event.preventDefault();
          const current = viewRef.current;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: current.x, top: current.y, moved: false };
          setPanning(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove: (event) => {
          const gesture = drag.current;
          if (!gesture || gesture.id !== event.pointerId) return;
          const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
          if (Math.hypot(dx, dy) > 4) gesture.moved = true;
          if (gesture.moved) updateView({ ...viewRef.current, x: gesture.left + dx, y: gesture.top + dy });
        },
        onPointerUp: (event) => endPan(event),
        onPointerCancel: (event) => endPan(event, true),
        onLostPointerCapture: (event) => endPan(event, true),
        onClickCapture: (event) => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        },
        children: /* @__PURE__ */ jsxs2("div", { className: "graph-content", style: { width, height, transform: `translate(${view.x}px,${view.y}px) scale(${view.zoom})` }, children: [
          /* @__PURE__ */ jsx2("svg", { className: "graph-wires", width, height, "aria-label": "Node connections", children: body?.edges.map((edge2, edgeIndex) => {
            const from = nodes.findIndex((node2) => node2.id === edge2.from.nodeId);
            const to = nodes.findIndex((node2) => node2.id === edge2.to.nodeId);
            const highlighted = selected === nodeKey(nodes[from].nodePath) || selected === nodeKey(nodes[to].nodePath);
            const fromX = (from + 1) * 250 + 220, toX = (to + 1) * 250;
            const fromY = 82 + Object.keys(nodes[from].metadata.outputs).indexOf(edge2.from.portId) * 20;
            const toY = 82 + Object.keys(nodes[to].metadata.inputs).indexOf(edge2.to.portId) * 20;
            const detour = Math.abs(to - from) > 1;
            const laneY = 166 + edgeIndex * 12;
            const path = detour ? `M ${fromX} ${fromY} C ${fromX + 18} ${fromY},${fromX + 18} ${laneY},${fromX + 30} ${laneY} L ${toX - 30} ${laneY} C ${toX - 18} ${laneY},${toX - 18} ${toY},${toX} ${toY}` : `M ${fromX} ${fromY} C ${fromX + 15} ${fromY},${toX - 15} ${toY},${toX} ${toY}`;
            return /* @__PURE__ */ jsxs2("g", { className: `graph-connection${highlighted ? " graph-connection-selected" : ""}`, children: [
              /* @__PURE__ */ jsxs2("title", { children: [
                nodes[from]?.label,
                " ",
                edge2.from.portId,
                " to ",
                nodes[to]?.label,
                " ",
                edge2.to.portId
              ] }),
              /* @__PURE__ */ jsx2("path", { d: path }),
              /* @__PURE__ */ jsx2("polygon", { points: `${toX - 8},${toY - 4} ${toX - 2},${toY} ${toX - 8},${toY + 4}` })
            ] }, edge2.id);
          }) }),
          /* @__PURE__ */ jsxs2("button", { type: "button", className: "graph-node graph-scene-root", style: { left: 0 }, "aria-pressed": selected === null, onClick: () => onSelect(null), children: [
            /* @__PURE__ */ jsx2("strong", { children: "Scene" }),
            /* @__PURE__ */ jsx2("span", { className: "graph-node-kind", children: "Scene" })
          ] }),
          nodes.map((node2, index) => /* @__PURE__ */ jsxs2("button", { type: "button", className: "graph-node", style: { left: (index + 1) * 250 }, "aria-pressed": selected === nodeKey(node2.nodePath), onClick: () => onSelect(node2.nodePath), onDoubleClick: () => enter(node2.nodePath), onKeyDown: (event) => {
            if (event.key === "Enter" && node2.definition.kind === "graph") {
              event.preventDefault();
              onSelect(node2.nodePath);
              enter(node2.nodePath);
            }
          }, children: [
            /* @__PURE__ */ jsx2("strong", { children: node2.label }),
            /* @__PURE__ */ jsx2("span", { className: "graph-node-kind", children: node2.definition.kind === "graph" ? "Component" : Object.keys(node2.metadata.inputs).length ? "Effect" : "Source" }),
            /* @__PURE__ */ jsxs2("span", { className: "graph-ports", children: [
              /* @__PURE__ */ jsx2("span", { children: Object.entries(node2.metadata.inputs).map(([id3, port]) => /* @__PURE__ */ jsxs2("span", { className: "graph-port graph-port-input", title: `${port.label} input`, children: [
                /* @__PURE__ */ jsx2("span", { className: "graph-port-anchor", "aria-hidden": "true" }),
                /* @__PURE__ */ jsx2("span", { children: port.label })
              ] }, id3)) }),
              /* @__PURE__ */ jsx2("span", { children: Object.entries(node2.metadata.outputs).map(([id3, port]) => /* @__PURE__ */ jsxs2("span", { className: "graph-port graph-port-output", title: `${port.label} output`, children: [
                /* @__PURE__ */ jsx2("span", { children: port.label }),
                /* @__PURE__ */ jsx2("span", { className: "graph-port-anchor", "aria-hidden": "true" })
              ] }, id3)) })
            ] }),
            (output?.nodeId === node2.id || !profile) && /* @__PURE__ */ jsx2("span", { className: "graph-final-output", children: "Final output \xB7 image" })
          ] }, nodeKey(node2.nodePath)))
        ] })
      }
    )
  ] });
}
var init_GraphPanel = __esm({
  "apps/studio/src/GraphPanel.tsx"() {
    "use strict";
    init_visual_model();
    init_visual_model();
  }
});

// apps/studio/src/theme.ts
import { createTheme } from "@mui/material/styles";
var studioTheme;
var init_theme = __esm({
  "apps/studio/src/theme.ts"() {
    "use strict";
    studioTheme = createTheme({
      palette: {
        mode: "dark",
        primary: { main: "#b4a4e9", contrastText: "#211b33" },
        background: { default: "#111217", paper: "#1b1c24" },
        text: { primary: "#e1e2ec", secondary: "#959bb0" },
        divider: "#30323d",
        error: { main: "#e4a2b3" }
      },
      typography: {
        fontFamily: 'Inter, "Segoe UI", sans-serif',
        fontSize: 13,
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightBold: 500,
        button: { textTransform: "none", fontWeight: 400 },
        h1: { fontWeight: 500 },
        h2: { fontWeight: 500 },
        h3: { fontWeight: 500 },
        h4: { fontWeight: 500 },
        h5: { fontWeight: 500 },
        h6: { fontWeight: 500 },
        subtitle1: { fontWeight: 500 },
        subtitle2: { fontWeight: 500 }
      },
      shape: { borderRadius: 5 },
      components: {
        MuiButton: { defaultProps: { size: "small", variant: "text", disableElevation: true }, styleOverrides: { root: { whiteSpace: "nowrap", minWidth: 0 } } },
        MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: "none" } } },
        MuiChip: { defaultProps: { size: "small", variant: "outlined" }, styleOverrides: { root: { fontSize: 9, letterSpacing: 1, borderRadius: 3, height: 23 } } },
        MuiSlider: { defaultProps: { size: "small" } },
        MuiMenuItem: { styleOverrides: { root: { fontWeight: 400 } } },
        MuiTooltip: { styleOverrides: { tooltip: { fontSize: "12px", fontWeight: 400, lineHeight: 1.45 } } }
      }
    });
  }
});

// packages/runtime-contracts/src/nested-graph.ts
var nestedGraphLimits;
var init_nested_graph = __esm({
  "packages/runtime-contracts/src/nested-graph.ts"() {
    "use strict";
    nestedGraphLimits = Object.freeze({
      graphLevels: 8,
      resolutionSteps: 65536,
      rawBytes: 2097152,
      rawValues: 1e5,
      rawDepth: 16,
      metadataBytes: 1048576,
      bodyBytes: 262144,
      allBodyBytes: 1048576,
      overrideBytes: 262144,
      outputBytes: 4194304
    });
  }
});

// packages/runtime/src/graph/nested-validate.ts
function comparePaths(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const c = compare(a[i], b[i]);
    if (c) return c;
  }
  return a.length - b.length;
}
function compatibleControlDomain(publicControl, target) {
  if (publicControl.type !== target.type || publicControl.changeCost !== target.changeCost) return false;
  if (publicControl.type === "number") return target.type === "number" && publicControl.unit === target.unit && publicControl.min === target.min && publicControl.max === target.max && publicControl.step === target.step;
  if (publicControl.type === "boolean") return target.type === "boolean";
  if (publicControl.type === "trigger") return target.type === "trigger";
  return target.type === "enum" && publicControl.presentation === target.presentation && publicControl.options.length === target.options.length && publicControl.options.every((option, index) => option.id === target.options[index]?.id);
}
function invalid3(path, rule) {
  const bounded = (s, n) => s.length > n ? `${s.slice(0, n - 3)}...` : s;
  const location = bounded(path, 384);
  throw Object.assign(new Error(`${location}: ${bounded(rule, 380)}`), { code: "INVALID_NESTED_GRAPH", path: location });
}
function freeze2(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze2(child);
    Object.freeze(value);
  }
  return value;
}
function checked(fn, path) {
  try {
    return fn();
  } catch (error) {
    invalid3(path, error instanceof Error && "code" in error ? error.message.slice(0, 300) : "invalid identity or metadata");
  }
}
function record3(value, path, fields2) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid3(path, "expected record");
  const row = value;
  if (fields2) {
    for (const k of Object.keys(row)) if (!fields2.includes(k)) invalid3(path, "unsupported field");
    for (const k of fields2) if (!Object.hasOwn(row, k)) invalid3(path, `missing field ${k}`);
  }
  return row;
}
function bytes(value) {
  return encoder5.encode(stringify(value)).byteLength;
}
function publish(value, path) {
  if (bytes(value) > nestedGraphLimits.outputBytes) invalid3(path, "output byte budget exceeded");
  return freeze2(value);
}
function snapshot(values2, names2, byteLimit = nestedGraphLimits.rawBytes, wrapped = true) {
  const seen = /* @__PURE__ */ new WeakSet(), inspected = /* @__PURE__ */ new WeakMap();
  let count = 0, total = wrapped ? values2.length + 1 : 0;
  const add = (n, p) => {
    total += n;
    if (total > byteLimit) invalid3(p, "raw JSON byte budget exceeded");
  };
  function stringBytes(s, p) {
    if (s.length > byteLimit) invalid3(p, "raw string byte bound exceeded");
    if (/[\uD800-\uDFFF]/u.test(s)) invalid3(p, "expected well-formed Unicode");
    return encoder5.encode(stringify(s)).byteLength;
  }
  function length(v, p, max) {
    if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) invalid3(p, "expected plain dense array");
    const d = Object.getOwnPropertyDescriptor(v, "length");
    if (!d || !Object.hasOwn(d, "value") || !Number.isSafeInteger(d.value) || d.value < 0) invalid3(p, "expected own array length");
    if (d.value > max) invalid3(p, `at most ${max} raw array values`);
    return d.value;
  }
  function inspect(v, p, depth) {
    if (depth > nestedGraphLimits.rawDepth) invalid3(p, "raw depth exceeds 16");
    if (++count > nestedGraphLimits.rawValues) invalid3(p, "raw value budget exceeded");
    if (v === null) {
      add(4, p);
      return;
    }
    if (typeof v === "string") {
      add(stringBytes(v, p), p);
      return;
    }
    if (typeof v === "boolean") {
      add(v ? 4 : 5, p);
      return;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) invalid3(p, "expected finite number");
      add(stringify(v).length, p);
      return;
    }
    if (typeof v !== "object") invalid3(p, "expected JSON data");
    if (seen.has(v)) invalid3(p, "cycles and repeated aliases unsupported");
    seen.add(v);
    const array2 = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array2 ? proto !== Array.prototype : proto !== null && proto !== Object.prototype) invalid3(p, "expected plain data container");
    const n = array2 ? length(v, p, nestedGraphLimits.rawValues) : 0, keys = Reflect.ownKeys(v);
    if (keys.length > (array2 ? n + 1 : nestedGraphLimits.rawValues)) invalid3(p, "raw property count exceeded");
    if (array2 && keys.length !== n + 1) invalid3(p, "expected dense array");
    const entries2 = [];
    add(2, p);
    for (const k of array2 ? Array.from({ length: n }, (_, i) => String(i)) : keys) {
      if (typeof k !== "string") invalid3(p, "expected string data key");
      const d = Object.getOwnPropertyDescriptor(v, k);
      if (!d?.enumerable || !Object.hasOwn(d, "value")) invalid3(p, "expected enumerable own data property");
      if (entries2.length) add(1, p);
      if (!array2) add(stringBytes(k, p) + 1, p);
      entries2.push([k, d.value]);
      inspect(d.value, `${p}.${k.length <= 96 ? k : "[field]"}`, depth + 1);
    }
    inspected.set(v, { array: array2, entries: entries2 });
  }
  values2.forEach((v, i) => inspect(v, names2[i], 0));
  function copy(v) {
    if (v === null || typeof v !== "object") return v;
    const r = inspected.get(v);
    return r.array ? r.entries.map(([, x]) => copy(x)) : Object.fromEntries(r.entries.map(([k, x]) => [k, copy(x)]));
  }
  return values2.map(copy);
}
function matches(a, b) {
  if (a.kind === "signal") return b.kind === "signal" && a.unit === b.unit && a.clock === b.clock && a.value === b.value;
  if (a.kind === "image") return b.kind === "image" && a.colorSpace === b.colorSpace && a.alphaMode === b.alphaMode;
  if (a.kind === "shader-field") return b.kind === "shader-field" && a.version === b.version && a.abi === b.abi;
  return b.kind === "paths2d" && a.version === b.version && a.coordinateSpace === b.coordinateSpace;
}
function ref(v, p) {
  const r = record3(v, p, ["nodeId", "portId"]);
  if (typeof r.portId !== "string") invalid3(p, "expected port ID");
  return { nodeId: checked(() => nodeIdSchema.parse(r.nodeId), p), portId: r.portId };
}
function patch(schema3, v, p, empty = true) {
  const r = record3(v, p);
  if (Object.keys(r).length === 0) {
    if (!empty) invalid3(p, "expected nonempty control patch");
    return {};
  }
  return checked(() => validateControlPatch(schema3, r), p);
}
function sameKeys(actual, expected, p) {
  const keys = Object.keys(actual).sort(compare);
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected.slice().sort(compare)[i])) invalid3(p, "binding keys must exactly equal metadata interface");
}
function localBody(raw, metadata, defs, p) {
  const r = record3(raw, p, ["nodes", "edges", "inputBindings", "outputBindings", "controlBindings"]);
  if (!Array.isArray(r.nodes) || !r.nodes.length || !Array.isArray(r.edges)) invalid3(p, "expected nonempty nodes and edges array");
  const nodes = r.nodes.map((v, i) => {
    const n = record3(v, `${p}.nodes.${i}`, ["id", "definitionHash", "controlDefaults"]);
    const id3 = checked(() => nodeIdSchema.parse(n.id), p), hash2 = checked(() => hashSchema.parse(n.definitionHash), p);
    const d = defs[hash2];
    if (!d) invalid3(p, "missing definition hash");
    return { id: id3, definitionHash: hash2, controlDefaults: patch(d.metadata.controls, n.controlDefaults, p) };
  }).sort((a, b) => compare(a.id, b.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length) invalid3(p, "duplicate node ID");
  const lookup = (target, direction) => {
    const n = byId.get(target.nodeId);
    if (!n) invalid3(p, "missing immediate node");
    const ports2 = defs[n.definitionHash].metadata[direction];
    if (!Object.hasOwn(ports2, target.portId)) invalid3(p, `missing ${direction} port`);
    return ports2[target.portId].type;
  };
  const edges2 = r.edges.map((v) => {
    const e = record3(v, p, ["id", "from", "to", "delay"]);
    if (e.delay !== "none") invalid3(p, "only delay none supported");
    return { id: checked(() => edgeIdSchema.parse(e.id), p), from: ref(e.from, p), to: ref(e.to, p), delay: "none" };
  }).sort((a, b) => compare(a.id, b.id));
  if (new Set(edges2.map((e) => e.id)).size !== edges2.length) invalid3(p, "duplicate edge ID");
  const writers = /* @__PURE__ */ new Set(), links = [];
  const write = (to) => {
    const key2 = stringify([to.nodeId, to.portId]);
    if (writers.has(key2)) invalid3(p, "input has duplicate writer");
    writers.add(key2);
  };
  for (const e of edges2) {
    if (!matches(lookup(e.from, "outputs"), lookup(e.to, "inputs"))) invalid3(p, "port type mismatch");
    write(e.to);
    links.push([e.from.nodeId, e.to.nodeId]);
  }
  const inputRaw = record3(r.inputBindings, p), outputRaw = record3(r.outputBindings, p), controlRaw = record3(r.controlBindings, p);
  sameKeys(inputRaw, Object.keys(metadata.inputs), p);
  sameKeys(outputRaw, Object.keys(metadata.outputs), p);
  sameKeys(controlRaw, metadata.controls.map((c) => c.id), p);
  if (!Object.keys(metadata.outputs).length) invalid3(p, "graph must expose an output");
  const sortRefs = (a, b) => compare(a.nodeId, b.nodeId) || compare(a.portId, b.portId);
  const inputBindings = Object.fromEntries(Object.keys(inputRaw).sort(compare).map((id3) => {
    const targets = inputRaw[id3];
    if (!Array.isArray(targets) || !targets.length) invalid3(p, "input binding needs targets");
    const refs = targets.map((v) => ref(v, p)).sort(sortRefs);
    for (const t of refs) {
      if (!matches(metadata.inputs[id3].type, lookup(t, "inputs"))) invalid3(p, "input binding type mismatch");
      write(t);
    }
    return [id3, refs];
  }));
  const outputBindings = Object.fromEntries(Object.keys(outputRaw).sort(compare).map((id3) => {
    const t = ref(outputRaw[id3], p);
    if (!matches(metadata.outputs[id3].type, lookup(t, "outputs"))) invalid3(p, "output binding type mismatch");
    return [id3, t];
  }));
  const controlWriters = /* @__PURE__ */ new Set();
  const controlBindings = Object.fromEntries(Object.keys(controlRaw).sort(compare).map((id3) => {
    const targets = controlRaw[id3], publicControl = metadata.controls.find((c) => c.id === id3);
    if (!Array.isArray(targets) || !targets.length) invalid3(p, "control binding needs targets");
    const refs = targets.map((v) => {
      const t = record3(v, p, ["nodeId", "controlId"]);
      if (typeof t.controlId !== "string") invalid3(p, "expected control ID");
      return { nodeId: checked(() => nodeIdSchema.parse(t.nodeId), p), controlId: t.controlId };
    }).sort((a, b) => compare(a.nodeId, b.nodeId) || compare(a.controlId, b.controlId));
    for (const t of refs) {
      const n = byId.get(t.nodeId), target = n && defs[n.definitionHash].metadata.controls.find((c) => c.id === t.controlId);
      if (!target) invalid3(p, "missing immediate control target");
      if (!compatibleControlDomain(publicControl, target)) invalid3(p, "control binding schema mismatch");
      const key2 = stringify([t.nodeId, t.controlId]);
      if (controlWriters.has(key2)) invalid3(p, "duplicate control binding writer");
      controlWriters.add(key2);
    }
    return [id3, refs];
  }));
  for (const n of nodes) for (const id3 of Object.keys(defs[n.definitionHash].metadata.inputs)) if (!writers.has(stringify([n.id, id3]))) invalid3(p, `missing required input writer ${id3}`);
  topological(nodes.map((n) => n.id), links, p);
  const body = { nodes, edges: edges2, inputBindings, outputBindings, controlBindings };
  if (bytes(body) > nestedGraphLimits.bodyBytes) invalid3(p, "canonical body byte budget exceeded");
  return body;
}
function topological(keys, links, p) {
  const outgoing = new Map(keys.map((k) => [k, /* @__PURE__ */ new Set()])), degrees = new Map(keys.map((k) => [k, 0]));
  for (const [from, to] of links) {
    const destinations = outgoing.get(from);
    if (!destinations.has(to)) {
      destinations.add(to);
      degrees.set(to, degrees.get(to) + 1);
    }
  }
  const ready = keys.filter((k) => degrees.get(k) === 0), result = [];
  while (ready.length) {
    ready.sort(compare);
    const k = ready.shift();
    result.push(k);
    for (const t of outgoing.get(k)) {
      const d = degrees.get(t) - 1;
      degrees.set(t, d);
      if (!d) ready.push(t);
    }
  }
  if (result.length !== keys.length) invalid3(p, "same-step cycle");
  return result;
}
function cardinalities(defs) {
  const done = /* @__PURE__ */ new Map(), active = /* @__PURE__ */ new Set();
  function visit(hash2) {
    const cached = done.get(hash2);
    if (cached) return cached;
    if (active.has(hash2)) invalid3(hash2, "recursive graph definition");
    active.add(hash2);
    const d = defs[hash2];
    let s;
    if (d.kind === "code") s = { levels: 0, controls: Object.fromEntries(d.metadata.controls.map((c) => [c.id, 1])), stateful: d.metadata.lifecycle.state === "stateful" };
    else {
      s = { levels: 1, controls: {}, stateful: false };
      const children2 = new Map(d.body.nodes.map((n) => [n.id, visit(n.definitionHash)]));
      for (const c of children2.values()) {
        s.levels = Math.max(s.levels, c.levels + 1);
        s.stateful ||= c.stateful;
      }
      for (const [id3, refs] of Object.entries(d.body.controlBindings)) {
        let count = 0;
        for (const r of refs) count += children2.get(r.nodeId).controls[r.controlId];
        s.controls[id3] = count;
      }
      if (s.levels > nestedGraphLimits.graphLevels) invalid3(hash2, "graph level budget exceeded");
      if (d.metadata.lifecycle.state !== (s.stateful ? "stateful" : "stateless")) invalid3(hash2, "graph lifecycle must match all descendant code");
    }
    active.delete(hash2);
    done.set(hash2, s);
    return s;
  }
  for (const hash2 of Object.keys(defs)) visit(hash2);
}
function workCounter() {
  let count = 0;
  return () => {
    if (++count > nestedGraphLimits.resolutionSteps) invalid3("expansion", "resolution work budget exceeded");
  };
}
function expand(defs, rootHash, charge) {
  const occurrences = /* @__PURE__ */ new Map(), leaves = /* @__PURE__ */ new Map(), edges2 = [], writers = /* @__PURE__ */ new Set();
  const targetKey = (a) => stringify([a.nodePath, a.portId]);
  function input(o, id3) {
    charge();
    const d2 = defs[o.hash];
    if (d2.kind === "code") return [{ nodePath: o.path, portId: id3 }];
    const result = [];
    for (const r of d2.body.inputBindings[id3]) {
      charge();
      result.push(...input(o.children.get(r.nodeId), r.portId));
    }
    return result;
  }
  function output(o, id3) {
    charge();
    const d2 = defs[o.hash];
    if (d2.kind === "code") return { nodePath: o.path, portId: id3 };
    const r = d2.body.outputBindings[id3];
    charge();
    return output(o.children.get(r.nodeId), r.portId);
  }
  function apply(o, values2) {
    for (const [id3, value] of Object.entries(values2)) for (const t of o.controls[id3]) {
      charge();
      leaves.get(pathKey(t.nodePath)).values[t.controlId] = value;
    }
  }
  function place(hash2, path) {
    charge();
    const d2 = defs[hash2], o = { path, hash: hash2, children: /* @__PURE__ */ new Map(), controls: {} };
    occurrences.set(pathKey(path), o);
    if (d2.kind === "code") {
      leaves.set(pathKey(path), { path, hash: hash2, values: { ...defaultControlValues(d2.metadata.controls) } });
      for (const c of d2.metadata.controls) o.controls[c.id] = [{ nodePath: path, controlId: c.id }];
    } else {
      for (const n of d2.body.nodes) {
        const child = place(n.definitionHash, [...path, n.id]);
        o.children.set(n.id, child);
        apply(child, n.controlDefaults);
      }
      const bound = /* @__PURE__ */ new Set();
      for (const [id3, refs] of Object.entries(d2.body.controlBindings)) {
        const targets = [];
        for (const r of refs) {
          charge();
          for (const target of o.children.get(r.nodeId).controls[r.controlId]) {
            charge();
            const key2 = stringify([target.nodePath, target.controlId]);
            if (bound.has(key2)) invalid3(pathKey(path), "expanded control writers overlap");
            bound.add(key2);
            targets.push(target);
          }
        }
        o.controls[id3] = targets.sort((a, b) => comparePaths(a.nodePath, b.nodePath) || compare(a.controlId, b.controlId));
      }
      apply(o, defaultControlValues(d2.metadata.controls));
      for (const e of d2.body.edges) {
        const from = output(o.children.get(e.from.nodeId), e.from.portId);
        for (const to of input(o.children.get(e.to.nodeId), e.to.portId)) {
          charge();
          const key2 = targetKey(to);
          if (writers.has(key2)) invalid3(pathKey(path), "expanded input duplicate writer");
          writers.add(key2);
          edges2.push({ from, to });
        }
      }
    }
    return o;
  }
  const root = place(rootHash, []), d = defs[rootHash];
  for (const id3 of Object.keys(d.metadata.inputs)) for (const target of input(root, id3)) {
    charge();
    const key2 = targetKey(target);
    if (writers.has(key2)) invalid3("expansion", "expanded boundary duplicate writer");
    writers.add(key2);
  }
  for (const leaf of leaves.values()) for (const id3 of Object.keys(defs[leaf.hash].metadata.inputs)) if (!writers.has(targetKey({ nodePath: leaf.path, portId: id3 }))) invalid3("expansion", "missing expanded input writer");
  for (const e of edges2) {
    const a = leaves.get(pathKey(e.from.nodePath)), b = leaves.get(pathKey(e.to.nodePath));
    if (!matches(defs[a.hash].metadata.outputs[e.from.portId].type, defs[b.hash].metadata.inputs[e.to.portId].type)) invalid3("expansion", "expanded port type mismatch");
  }
  topological([...leaves.keys()], edges2.map((e) => [pathKey(e.from.nodePath), pathKey(e.to.nodePath)]), "expansion");
  return { root, occurrences, leaves, edges: edges2 };
}
function resolveOutput(defs, o, id3, charge) {
  charge();
  const d = defs[o.hash];
  if (d.kind === "code") return { nodePath: o.path, portId: id3 };
  const r = d.body.outputBindings[id3];
  charge();
  return resolveOutput(defs, o.children.get(r.nodeId), r.portId, charge);
}
function validateNestedGraph(graph, definitions) {
  const [g, ds] = snapshot([graph, definitions], ["graph", "definitions"]);
  const r = record3(g, "graph", ["version", "rootDefinitionHash", "outputPort"]);
  if (r.version !== 2) invalid3("graph", "expected version 2");
  const hash2 = checked(() => hashSchema.parse(r.rootDefinitionHash), "graph");
  if (typeof r.outputPort !== "string") invalid3("graph", "expected output port");
  const rows = record3(ds, "definitions"), defs = {}, rawBodies = /* @__PURE__ */ new Map();
  let metadataBytes = 0, bodyBytes = 0;
  for (const key2 of Object.keys(rows).sort(compare)) {
    checked(() => hashSchema.parse(key2), "definitions");
    const row = record3(rows[key2], key2);
    if (row.kind !== "code" && row.kind !== "graph") invalid3(key2, "expected code or graph kind");
    record3(row, key2, row.kind === "code" ? ["kind", "metadata"] : ["kind", "metadata", "body"]);
    const metadata = checked(() => normalizeComponentMetadata(row.metadata), key2);
    metadataBytes += bytes(metadata);
    if (metadataBytes > nestedGraphLimits.metadataBytes) invalid3(key2, "aggregate metadata byte budget exceeded");
    defs[key2] = row.kind === "code" ? { kind: "code", metadata } : { kind: "graph", metadata, body: void 0 };
    if (row.kind === "graph") rawBodies.set(key2, row.body);
  }
  for (const [key2, raw] of rawBodies) {
    const metadata = defs[key2].metadata, body = localBody(raw, metadata, defs, key2);
    bodyBytes += bytes(body);
    if (bodyBytes > nestedGraphLimits.allBodyBytes) invalid3(key2, "aggregate body byte budget exceeded");
    defs[key2] = { kind: "graph", metadata, body };
  }
  const root = defs[hash2];
  if (!root || root.kind !== "graph") invalid3("graph", "root must name a graph definition");
  if (Object.keys(root.metadata.inputs).length) invalid3("graph", "root public inputs must be empty");
  if (!Object.hasOwn(root.metadata.outputs, r.outputPort) || root.metadata.outputs[r.outputPort].type.kind !== "image") invalid3("graph", "root selected output must be image");
  cardinalities(defs);
  const charge = workCounter();
  for (const [key2, d] of Object.entries(defs)) if (d.kind === "graph") expand(defs, key2, charge);
  const result = publish({ graph: { version: 2, rootDefinitionHash: hash2, outputPort: r.outputPort }, definitions: defs }, "graph");
  authenticated.add(result);
  return result;
}
function isValidatedNestedGraph(v) {
  return v !== null && typeof v === "object" && authenticated.has(v);
}
var authenticated, encoder5, stringify, compare, pathKey;
var init_nested_validate = __esm({
  "packages/runtime/src/graph/nested-validate.ts"() {
    "use strict";
    init_identities();
    init_src2();
    init_components();
    init_parameters();
    init_nested_graph();
    authenticated = /* @__PURE__ */ new WeakSet();
    encoder5 = new TextEncoder();
    stringify = JSON.stringify;
    compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    pathKey = (path) => stringify(path);
  }
});

// packages/runtime/src/graph/nested-plan.ts
function planNestedGraph(value, overrides) {
  if (!isValidatedNestedGraph(value)) throw new TypeError("Expected validated nested graph");
  const raw = snapshot([overrides ?? []], ["overrides"], nestedGraphLimits.overrideBytes, false)[0];
  if (!Array.isArray(raw)) invalid3("overrides", "expected array");
  const charge = workCounter(), defs = value.definitions, expanded = expand(defs, value.graph.rootDefinitionHash, charge);
  const paths = /* @__PURE__ */ new Set(), writers = /* @__PURE__ */ new Set();
  for (const v of raw) {
    const r = record3(v, "overrides", ["nodePath", "values"]);
    if (!Array.isArray(r.nodePath) || r.nodePath.length > nestedGraphLimits.graphLevels) invalid3("overrides", "invalid node path");
    const path = r.nodePath.map((id3) => checked(() => nodeIdSchema.parse(id3), "overrides.nodePath")), key2 = pathKey(path);
    if (paths.has(key2)) invalid3("overrides", "duplicate override path");
    paths.add(key2);
    const o = expanded.occurrences.get(key2);
    if (!o) invalid3("overrides", "unknown node path");
    const values2 = patch(defs[o.hash].metadata.controls, r.values, "overrides.controls", false);
    for (const [id3, n] of Object.entries(values2)) for (const t of o.controls[id3]) {
      charge();
      const target = JSON.stringify([t.nodePath, t.controlId]);
      if (writers.has(target)) invalid3("overrides", "explicit control writers overlap");
      writers.add(target);
      expanded.leaves.get(pathKey(t.nodePath)).values[t.controlId] = n;
    }
  }
  const final = resolveOutput(defs, expanded.root, value.graph.outputPort, charge);
  const incoming = new Map([...expanded.leaves.keys()].map((k) => [k, []]));
  for (const e of expanded.edges) incoming.get(pathKey(e.to.nodePath)).push({ portId: e.to.portId, source: { nodePath: e.from.nodePath, portId: e.from.portId } });
  const reachable = /* @__PURE__ */ new Set(), pending = [pathKey(final.nodePath)];
  while (pending.length) {
    const key2 = pending.pop();
    if (reachable.has(key2)) continue;
    reachable.add(key2);
    for (const i of incoming.get(key2)) pending.push(pathKey(i.source.nodePath));
  }
  const outgoing = new Map([...reachable].map((k) => [k, /* @__PURE__ */ new Set()])), degrees = new Map([...reachable].map((k) => [k, 0]));
  for (const e of expanded.edges) {
    const to = pathKey(e.to.nodePath), from = pathKey(e.from.nodePath);
    if (!reachable.has(to)) continue;
    const targets = outgoing.get(from);
    if (!targets.has(to)) {
      targets.add(to);
      degrees.set(to, degrees.get(to) + 1);
    }
  }
  const ready = [...reachable].filter((k) => degrees.get(k) === 0), nodes = [];
  const compareKeys = (a, b) => comparePaths(expanded.leaves.get(a).path, expanded.leaves.get(b).path);
  while (ready.length) {
    ready.sort(compareKeys);
    const key2 = ready.shift(), leaf = expanded.leaves.get(key2);
    nodes.push({ nodePath: [...leaf.path], definitionHash: leaf.hash, inputs: incoming.get(key2).sort((a, b) => compare(a.portId, b.portId)).map((i) => ({ portId: i.portId, source: { nodePath: [...i.source.nodePath], portId: i.source.portId } })), initialControls: Object.fromEntries(defs[leaf.hash].metadata.controls.map((c) => [c.id, leaf.values[c.id]])) });
    for (const to of outgoing.get(key2)) {
      const n = degrees.get(to) - 1;
      degrees.set(to, n);
      if (!n) ready.push(to);
    }
  }
  const definitions = Object.fromEntries([...new Set(nodes.map((n) => n.definitionHash))].sort(compare).map((h4) => [h4, { kind: "code", metadata: normalizeComponentMetadata(defs[h4].metadata) }]));
  const rootMetadata = normalizeComponentMetadata(defs[value.graph.rootDefinitionHash].metadata);
  const publicControlBindings = Object.fromEntries(rootMetadata.controls.map((c) => [c.id, expanded.root.controls[c.id].map((t) => ({ nodePath: [...t.nodePath], controlId: t.controlId, active: reachable.has(pathKey(t.nodePath)) }))]));
  const prunedNodePaths = [...expanded.leaves].filter(([key2]) => !reachable.has(key2)).map(([, leaf]) => [...leaf.path]).sort(comparePaths);
  const result = { version: 2, nodes, definitions, finalOutput: { nodePath: [...final.nodePath], portId: final.portId }, publicControls: rootMetadata.controls, publicControlBindings, prunedNodePaths };
  return publish(result, "plan");
}
var init_nested_plan = __esm({
  "packages/runtime/src/graph/nested-plan.ts"() {
    "use strict";
    init_identities();
    init_components();
    init_nested_graph();
    init_nested_validate();
  }
});

// packages/runtime-contracts/src/composition-profile.mjs
function bad(message) {
  throw Error("image-chain-v1: " + message);
}
function record4(value, fields2, label, optional = []) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) bad(label + " must be a record");
  const keys = Reflect.ownKeys(value), allowed = [...fields2, ...optional];
  if (keys.some((k) => typeof k !== "string" || !allowed.includes(k)) || fields2.some((k) => !Object.hasOwn(value, k))) bad(label + " fields mismatch");
  const result = {};
  for (const key2 of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key2);
    if (!d?.enumerable || !Object.hasOwn(d, "value")) bad(label + " requires data properties");
    result[key2] = d.value;
  }
  return result;
}
function openRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) bad(label + " must be a record");
  const result = {};
  for (const key2 of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key2);
    if (typeof key2 !== "string" || !d?.enumerable || !Object.hasOwn(d, "value")) bad(label + " requires string data properties");
    result[key2] = d.value;
  }
  return result;
}
function array(value, max, label, min = 1) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < min || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) bad(label + " must be a dense bounded array");
  return value;
}
function id(value, label) {
  if (typeof value !== "string" || !uuid2.test(value) && !readableId.test(value)) bad("invalid " + label);
  return value.toLowerCase();
}
function name(value, label) {
  if (typeof value !== "string" || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(value)) bad("invalid " + label);
  return value;
}
function portRef(value, label, version = 1) {
  const row = record4(value, ["nodeId", "portId"], label);
  if (version === 1 && row.portId !== "image") bad(label + " must name image");
  return Object.freeze({ nodeId: id(row.nodeId, label + ".nodeId"), portId: version === 1 ? "image" : name(row.portId, label + ".portId") });
}
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function edges(value) {
  return [...value].sort((a, b) => a.id.localeCompare(b.id));
}
function declaration(input, label, version = 1) {
  const raw = record4(input, ["definitions", "nodes", "edges", "output", "expose"], label, ["input", "inputs", "label"]);
  if (Object.hasOwn(raw, "input") && Object.hasOwn(raw, "inputs")) bad("input and inputs are mutually exclusive");
  const definitionPaths = openRecord(raw.definitions, label + ".definitions"), definitions = {};
  for (const [key2, value] of Object.entries(definitionPaths)) {
    name(key2, "definition name");
    if (typeof value !== "string" || !value.endsWith(".ts")) bad("invalid definition module path");
    definitions[key2] = value;
  }
  const nodes = array(raw.nodes, Infinity, label + ".nodes").map((value, index) => {
    const row = record4(value, ["id", "definition"], `${label}.nodes[${index}]`);
    if (typeof row.definition !== "string" || !Object.hasOwn(definitions, row.definition)) bad("unknown node definition");
    return Object.freeze({ id: id(row.id, "node id"), definition: row.definition });
  });
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length) bad("duplicate node id");
  const byNode = new Set(nodes.map((n) => n.id));
  const edges2 = array(raw.edges, Infinity, label + ".edges", 0).map((value, index) => {
    const row = record4(value, ["id", "from", "to", "delay"], `${label}.edges[${index}]`), from = portRef(row.from, "edge.from", version), to = portRef(row.to, "edge.to", version);
    if (row.delay !== "none" || !byNode.has(from.nodeId) || !byNode.has(to.nodeId)) bad("invalid edge");
    return Object.freeze({ id: id(row.id, "edge id"), from, to, delay: "none" });
  });
  if (new Set(edges2.map((e) => e.id)).size !== edges2.length) bad("duplicate edge id");
  const boundaryInput = Object.hasOwn(raw, "input") ? portRef(raw.input, label + ".input", version) : void 0;
  if (boundaryInput && !byNode.has(boundaryInput.nodeId)) bad("unknown input node");
  let boundaryInputs;
  if (Object.hasOwn(raw, "inputs")) {
    const values2 = openRecord(raw.inputs, label + ".inputs"), result = {};
    for (const [key2, value] of Object.entries(values2)) {
      name(key2, "input port");
      const target = portRef(value, label + ".inputs." + key2, version);
      if (!byNode.has(target.nodeId)) bad("unknown input node");
      result[key2] = target;
    }
    boundaryInputs = Object.freeze(result);
  }
  const output = portRef(raw.output, label + ".output", version);
  if (!byNode.has(output.nodeId)) bad("unknown output node");
  const expose = array(raw.expose, Infinity, label + ".expose", 0).map((value, index) => {
    const row = record4(value, ["id", "nodeId", "controlId"], `${label}.expose[${index}]`);
    const exposed = name(row.id, "exposed control"), nodeId = id(row.nodeId, "expose node");
    if (!byNode.has(nodeId) || typeof row.controlId !== "string") bad("invalid exposed control target");
    return Object.freeze({ id: exposed, nodeId, controlId: row.controlId });
  });
  if (new Set(expose.map((e) => e.id)).size !== expose.length) bad("duplicate exposed control id");
  let displayLabel;
  if (Object.hasOwn(raw, "label")) {
    if (typeof raw.label !== "string" || raw.label.trim() !== raw.label || raw.label.length < 1 || raw.label.length > 80) bad("invalid composition label");
    displayLabel = raw.label;
  }
  return Object.freeze({ definitions: Object.freeze(definitions), nodes: Object.freeze(nodes), edges: Object.freeze(edges2), ...boundaryInput ? { input: boundaryInput } : {}, ...boundaryInputs ? { inputs: boundaryInputs } : {}, output, expose: Object.freeze(expose), ...displayLabel ? { label: displayLabel } : {} });
}
function names(input, label) {
  const raw = openRecord(input, label), result = {};
  for (const [key2, value] of Object.entries(raw)) {
    name(key2, "definition name");
    if (typeof value !== "string" || !sha.test(value)) bad("invalid definition identity");
    result[key2] = value;
  }
  return Object.freeze(result);
}
function checkLinear(plan) {
  if (plan.nodes.length < 1) bad("flattened image chain must contain at least one component");
  if (plan.prunedNodePaths.length) bad("graph must not contain nodes outside the selected linear image chain");
  for (let i = 0; i < plan.nodes.length; i++) {
    const inputs = plan.nodes[i].inputs;
    if (inputs.length !== (i ? 1 : 0) || i && (!same(inputs[0].source.nodePath, plan.nodes[i - 1].nodePath) || inputs[0].portId !== "image" || inputs[0].source.portId !== "image")) bad("graph must be one linear image chain");
  }
  if (!same(plan.finalOutput.nodePath, plan.nodes.at(-1).nodePath) || plan.finalOutput.portId !== "image") bad("output must reach every node");
}
function checkTyped(plan, definitions) {
  if (plan.nodes.length < 1) bad("typed image graph must contain at least one component");
  if (plan.prunedNodePaths.length) bad("typed image graph must not contain unreachable nodes");
  const final = plan.nodes.find((node2) => same(node2.nodePath, plan.finalOutput.nodePath)), type = final && definitions[final.definitionHash]?.metadata.outputs[plan.finalOutput.portId]?.type;
  if (type?.kind !== "image") bad("typed image graph final output must be image");
}
function checkModule(hash2, module, definitions) {
  const graph = definitions[hash2];
  if (graph?.kind !== "graph") bad("module declaration must name a graph definition");
  const body = graph.body, byNode = new Map(body.nodes.map((node2) => [node2.id, node2]));
  if (Object.keys(module.definitionNames).length !== Object.keys(module.declaration.definitions).length || Object.keys(module.definitionNames).some((key2) => !Object.hasOwn(module.declaration.definitions, key2))) bad("module definition names mismatch");
  for (const node2 of module.declaration.nodes) if (byNode.get(node2.id)?.definitionHash !== module.definitionNames[node2.definition]) bad("module node definition mismatch");
  if (byNode.size !== module.declaration.nodes.length) bad("module node count mismatch");
  if (!same(edges(body.edges), edges(module.declaration.edges))) bad("module edges mismatch");
  const expectedInputs = module.declaration.input ? { image: [module.declaration.input] } : Object.fromEntries(Object.entries(module.declaration.inputs ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key2, value]) => [key2, [value]]));
  if (!same(body.inputBindings, expectedInputs) || !same(body.outputBindings, { image: module.declaration.output })) bad("module port binding mismatch");
  const expectedControls = Object.fromEntries([...module.declaration.expose].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((exposed) => [exposed.id, [{ nodeId: exposed.nodeId, controlId: exposed.controlId }]]));
  if (!same(body.controlBindings, expectedControls)) bad("module control binding mismatch");
  if (graph.metadata.label !== (module.declaration.label ?? "Image composition") || Object.keys(graph.metadata.inputs).length !== Object.keys(expectedInputs).length) bad("module metadata mismatch");
}
function normalizeImageCompositionProfile(input) {
  const raw = record4(input, ["version", "declaration", "definitionNames", "graph", "definitions", "publicControls", "publicControlBindings", "nodes"], "composition", ["moduleDeclarations"]);
  if (raw.version !== 1 && raw.version !== 2) bad("expected profile version 1 or 2");
  const version = raw.version, rootDeclaration = declaration(raw.declaration, "declaration", version), definitionNames = names(raw.definitionNames, "definitionNames");
  if (Object.keys(definitionNames).length !== Object.keys(rootDeclaration.definitions).length || Object.keys(definitionNames).some((key2) => !Object.hasOwn(rootDeclaration.definitions, key2))) bad("root definition names mismatch");
  let admitted, plan;
  try {
    admitted = validateNestedGraph(raw.graph, raw.definitions);
    plan = planNestedGraph(admitted);
  } catch (error) {
    bad(error.message);
  }
  let moduleDeclarations;
  if (Object.hasOwn(raw, "moduleDeclarations")) {
    const modules = openRecord(raw.moduleDeclarations, "moduleDeclarations"), normalized = {};
    for (const [hash2, value] of Object.entries(modules)) {
      if (!sha.test(hash2)) bad("invalid module declaration hash");
      const row = record4(value, ["modulePath", "definitionNames", "declaration"], "module declaration");
      if (typeof row.modulePath !== "string" || !row.modulePath.endsWith(".ts")) bad("invalid module path");
      normalized[hash2] = Object.freeze({ modulePath: row.modulePath, definitionNames: names(row.definitionNames, "module definitionNames"), declaration: declaration(row.declaration, "module declaration", version) });
    }
    const graphHashes = Object.entries(admitted.definitions).filter(([, value]) => value.kind === "graph").map(([hash2]) => hash2).sort(), moduleHashes = Object.keys(normalized).sort();
    if (!same(graphHashes, moduleHashes)) bad("module declaration catalog mismatch");
    for (const hash2 of graphHashes) checkModule(hash2, normalized[hash2], admitted.definitions);
    moduleDeclarations = Object.freeze(normalized);
  } else {
    for (const hash2 of Object.values(definitionNames)) if (admitted.definitions[hash2]?.kind !== "code") bad("legacy definition name does not resolve to code");
  }
  const rootHash = admitted.graph.rootDefinitionHash;
  if (moduleDeclarations) {
    const root = moduleDeclarations[rootHash];
    if (!root || !same(root.declaration, rootDeclaration) || !same(root.definitionNames, definitionNames)) bad("root module declaration mismatch");
  } else {
    const body = admitted.definitions[rootHash].body;
    if (!same(body.nodes, rootDeclaration.nodes.map((node2) => ({ id: node2.id, definitionHash: definitionNames[node2.definition], controlDefaults: {} }))) || !same(edges(body.edges), edges(rootDeclaration.edges))) bad("legacy root graph mismatch");
  }
  const publicControls = normalizeControlSchema(raw.publicControls);
  if (canonicalControlSchemaJson(publicControls) !== canonicalControlSchemaJson(plan.publicControls)) bad("public controls disagree with exposure");
  const bindingRaw = openRecord(raw.publicControlBindings, "publicControlBindings"), publicControlBindings = {};
  if (Object.keys(bindingRaw).length !== publicControls.length) bad("public binding count mismatch");
  for (const control of publicControls) {
    const list = array(bindingRaw[control.id], 1, "public binding"), target = record4(list[0], ["nodePath", "controlId", "active"], "public binding");
    if (!Array.isArray(target.nodePath) || target.nodePath.length < 1 || target.nodePath.length > 8 || target.nodePath.some((value) => typeof value !== "string" || !uuid2.test(value) && !readableId.test(value)) || typeof target.controlId !== "string" || target.active !== true) bad("invalid public binding");
    publicControlBindings[control.id] = Object.freeze([Object.freeze({ nodePath: Object.freeze(target.nodePath.map((value) => value.toLowerCase())), controlId: target.controlId, active: true })]);
  }
  if (!same(publicControlBindings, plan.publicControlBindings)) bad("public binding mismatch");
  if (version === 1) checkLinear(plan);
  else checkTyped(plan, admitted.definitions);
  const profileNodes = array(raw.nodes, Infinity, "profile nodes").map((value, index) => {
    const row = record4(value, ["nodePath", "definitionHash", "schema", "schemaHash"], `profile nodes[${index}]`);
    if (!Array.isArray(row.nodePath) || row.nodePath.length < 1 || row.nodePath.length > 8 || row.nodePath.some((value2) => typeof value2 !== "string" || !uuid2.test(value2) && !readableId.test(value2)) || !sha.test(row.definitionHash) || !sha.test(row.schemaHash)) bad("invalid profile node identity");
    const schema3 = normalizeControlSchema(row.schema);
    if (canonicalControlSchemaJson(schema3) !== canonicalControlSchemaJson(admitted.definitions[row.definitionHash]?.metadata.controls)) bad("profile node schema mismatch");
    return Object.freeze({ nodePath: Object.freeze(row.nodePath.map((value2) => value2.toLowerCase())), definitionHash: row.definitionHash, schema: schema3, schemaHash: row.schemaHash });
  });
  if (profileNodes.length !== plan.nodes.length || profileNodes.some((node2, index) => !same(node2.nodePath, plan.nodes[index].nodePath) || node2.definitionHash !== plan.nodes[index].definitionHash)) bad("profile nodes disagree with nested plan");
  return Object.freeze({ version, declaration: rootDeclaration, definitionNames, ...moduleDeclarations ? { moduleDeclarations } : {}, graph: admitted.graph, definitions: admitted.definitions, publicControls, publicControlBindings: Object.freeze(publicControlBindings), nodes: Object.freeze(profileNodes) });
}
var uuid2, readableId, sha;
var init_composition_profile = __esm({
  "packages/runtime-contracts/src/composition-profile.mjs"() {
    "use strict";
    init_components();
    init_parameters();
    init_nested_validate();
    init_nested_plan();
    uuid2 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    readableId = /^[a-z][a-z0-9._-]{0,95}$/;
    sha = /^[a-f0-9]{64}$/;
  }
});

// packages/runtime/src/components/composition-controls.ts
function controlSchema(profile, nodePath) {
  let hash2 = profile.graph.rootDefinitionHash;
  for (let index = 0; index < nodePath.length; index++) {
    const nodeId = nodePath[index], definition3 = profile.definitions[hash2];
    if (definition3?.kind !== "graph") throw new RuntimeError("Unknown composition node path");
    const node2 = arrayFind(definition3.body.nodes, (row) => row.id === nodeId);
    if (!node2) throw new RuntimeError("Unknown composition node path");
    hash2 = node2.definitionHash;
  }
  const definition2 = profile.definitions[hash2];
  if (!definition2) throw new RuntimeError("Unknown composition node path");
  return definition2.metadata.controls;
}
function compositionControlSchema(input, nodePath) {
  return controlSchema(normalizeImageCompositionProfile(input), nodePath);
}
function resolveControl(profile, nodePath, controlId2) {
  let hash2 = profile.graph.rootDefinitionHash, path = [];
  for (let index = 0; index < nodePath.length; index++) {
    const nodeId = nodePath[index], definition3 = profile.definitions[hash2];
    if (definition3?.kind !== "graph") throw new RuntimeError("Unknown composition node path");
    const node2 = arrayFind(definition3.body.nodes, (row) => row.id === nodeId);
    if (!node2) throw new RuntimeError("Unknown composition node path");
    hash2 = node2.definitionHash;
    path = freeze3(arrayConcat(path, [nodeId]));
  }
  let definition2 = profile.definitions[hash2], id3 = controlId2;
  if (!definition2 || !arrayFind(definition2.metadata.controls, (row) => row.id === id3)) throw new RuntimeError("Composition control is unavailable");
  while (definition2.kind === "graph") {
    const refs = definition2.body.controlBindings[id3];
    if (!refs || refs.length !== 1) throw new RuntimeError("Unsupported composition control binding");
    const ref2 = refs[0], node2 = arrayFind(definition2.body.nodes, (row) => row.id === ref2.nodeId);
    if (!node2) throw new RuntimeError("Invalid composition control binding");
    path = freeze3(arrayConcat(path, [ref2.nodeId]));
    hash2 = node2.definitionHash;
    id3 = ref2.controlId;
    definition2 = profile.definitions[hash2];
  }
  const leaf = arrayFind(profile.nodes, (row) => key(row.nodePath) === key(path)), control = arrayFind(definition2.metadata.controls, (row) => row.id === id3);
  if (!leaf || !control) throw new RuntimeError("Composition control target is unavailable");
  return freeze3({ nodePath: freeze3(arraySlice(path, 0)), controlId: id3, definitionHash: leaf.definitionHash, schemaHash: leaf.schemaHash, type: control.type });
}
function resolveCompositionControlTarget(input, nodePath, controlId2) {
  return resolveControl(normalizeImageCompositionProfile(input), nodePath, controlId2);
}
var freeze3, stringify2, objectPrototype4, finite5, RuntimeError, call2, arrayFind, arrayMap, arraySlice, arrayConcat, mapGet, mapSet, hasOwn3, key;
var init_composition_controls = __esm({
  "packages/runtime/src/components/composition-controls.ts"() {
    "use strict";
    init_composition_profile();
    init_parameters();
    freeze3 = Object.freeze;
    stringify2 = JSON.stringify;
    objectPrototype4 = Object.prototype;
    finite5 = Number.isFinite;
    RuntimeError = Error;
    call2 = Function.prototype.call;
    arrayFind = call2.bind(Array.prototype.find);
    arrayMap = call2.bind(Array.prototype.map);
    arraySlice = call2.bind(Array.prototype.slice);
    arrayConcat = call2.bind(Array.prototype.concat);
    mapGet = call2.bind(Map.prototype.get);
    mapSet = call2.bind(Map.prototype.set);
    hasOwn3 = call2.bind(Object.prototype.hasOwnProperty);
    key = (path) => stringify2(path);
  }
});

// apps/studio/src/service-client.ts
var service_client_exports = {};
__export(service_client_exports, {
  StudioController: () => StudioController,
  createDisconnectedClient: () => createDisconnectedClient,
  getRuntimeControlState: () => getRuntimeControlState,
  isUncertainStoryError: () => isUncertainStoryError,
  isUncertainTriggerError: () => isUncertainTriggerError,
  runtimeEditSignature: () => runtimeEditSignature
});
function isUncertainTriggerError(error) {
  return !!error && typeof error === "object" && "code" in error && error.code === "TRIGGER_TIMEOUT";
}
function isUncertainStoryError(error) {
  return !!error && typeof error === "object" && "code" in error && error.code === "STORY_TIMEOUT";
}
function getRuntimeControlState(runtime) {
  const schema3 = normalizeControlSchema(runtime.controlSchema ?? LEGACY_CONTROL_SCHEMA);
  const controls = validateControlSnapshot(schema3, runtime.controls ?? { intensity: runtime.intensity });
  return Object.freeze({
    sdkVersion: runtime.sdkVersion ?? "0.1.0",
    controlSchema: schema3,
    controlSchemaHash: runtime.controlSchemaHash ?? LEGACY_CONTROL_SCHEMA_HASH,
    controls,
    ...runtime.effectiveControls ? { effectiveControls: validateControlSnapshot(schema3, runtime.effectiveControls) } : {},
    controlSequence: runtime.controlSequence ?? 0,
    controlAnimations: runtime.controlAnimations ?? Object.freeze([]),
    controlAnimationIssues: runtime.controlAnimationIssues ?? Object.freeze([]),
    animationSequence: runtime.animationSequence ?? 0,
    ...runtime.sdkVersion === "0.4.0" && runtime.nodeControls ? {
      nodeControls: runtime.nodeControls,
      ...runtime.effectiveNodeControls ? { effectiveNodeControls: runtime.effectiveNodeControls } : {}
    } : {}
  });
}
function runtimeEditSignature(runtime) {
  if (!runtime) return null;
  if (runtime.visualStates) return JSON.stringify({ visuals: runtime.visualStates.map((row) => ({ visualId: row.visualId, controls: row.controls, animations: row.controlAnimations ?? [] })), tempo: { bpm: runtime.tempo?.bpm ?? 120 }, output: runtime.output });
  const state = getRuntimeControlState(runtime);
  return JSON.stringify({
    controls: state.controls,
    nodes: state.nodeControls?.nodes,
    animations: state.controlAnimations ?? [],
    tempo: { bpm: runtime.tempo?.bpm ?? 120 },
    output: runtime.output
  });
}
function createDisconnectedClient() {
  return {
    getSnapshot: () => disconnected,
    subscribe: () => () => {
    },
    invoke: async () => {
      throw Error("Authoring service unavailable");
    }
  };
}
var disconnected, StudioController;
var init_service_client = __esm({
  "apps/studio/src/service-client.ts"() {
    "use strict";
    init_parameters();
    init_control_state();
    init_composition_controls();
    disconnected = Object.freeze({
      connection: "disconnected",
      message: "The authoring service is not connected.",
      receivedAtMs: null,
      authoring: null,
      host: null,
      jobs: Object.freeze([]),
      visualFps: null,
      uiFps: null
    });
    StudioController = class {
      client;
      requestId;
      latestParameters = null;
      parameterDrain = null;
      constructor(client, requestId = () => crypto.randomUUID()) {
        this.client = client;
        this.requestId = requestId;
      }
      target() {
        const snapshot2 = this.client.getSnapshot();
        if (snapshot2.connection !== "connected" || !snapshot2.authoring) throw Error("Authoring service unavailable");
        if (snapshot2.authoring.authority !== "studio") throw Error("Authority conflict: Studio cannot control a host instance");
        return snapshot2.authoring;
      }
      async setIntensity(value) {
        if (!Number.isFinite(value) || value < 0 || value > 1) throw Error("Intensity must be a finite number from 0 to 1");
        return this.setParameters({ intensity: value });
      }
      async setNodeParameters(nodePath, values2) {
        const target = this.target();
        const node2 = target.nodeControls?.nodes.find((row) => JSON.stringify(row.nodePath) === JSON.stringify(nodePath));
        if (target.sdkVersion !== "0.4.0" || !node2) throw Error("Composition node is unavailable");
        const patch2 = validateControlPatch(node2.schema, values2);
        return this.client.invoke({ name: "lux.node.parameters.set", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          expectedControlSchemaHash: node2.schemaHash,
          nodePath: [...node2.nodePath],
          values: patch2,
          mode: "live"
        } });
      }
      async setNodeAnimation(nodePath, controlId2, animation, restart = false) {
        const target = this.target(), state = getRuntimeControlState(target), node2 = target.nodeControls?.nodes.find((row) => JSON.stringify(row.nodePath) === JSON.stringify(nodePath));
        const flat = nodePath.length === 0 && state.sdkVersion !== "0.4.0";
        const definition2 = (flat ? state.controlSchema : node2?.schema)?.find((row) => row.id === controlId2);
        if (!flat && (target.sdkVersion !== "0.4.0" || !node2 || !definition2)) throw Error("Composition node control is unavailable");
        if (flat && !definition2) throw Error("Scene control is unavailable");
        if (animation && !isNumberControlDefinition(definition2)) throw Error("Only number controls can be animated");
        const definitionHash = flat ? state.controlSchemaHash : node2.definitionHash, schemaHash = flat ? state.controlSchemaHash : node2.schemaHash;
        if (animation && (JSON.stringify(animation.nodePath) !== JSON.stringify(nodePath) || animation.controlId !== controlId2 || animation.definitionHash !== definitionHash || animation.schemaHash !== schemaHash)) throw Error("Animation target identity changed");
        return this.client.invoke({ name: "lux.node.animation.set", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          expectedControlSchemaHash: schemaHash,
          ...target.selectedVisualId ? { visualId: target.selectedVisualId } : {},
          nodePath: [...nodePath],
          controlId: controlId2,
          animation,
          ...restart ? { restart: true } : {}
        } });
      }
      async setNodeVariation(nodePath, controlId2, variation) {
        const target = this.target(), state = getRuntimeControlState(target), node2 = target.nodeControls?.nodes.find((row) => JSON.stringify(row.nodePath) === JSON.stringify(nodePath));
        const flat = nodePath.length === 0 && state.sdkVersion !== "0.4.0";
        const definition2 = (flat ? state.controlSchema : node2?.schema)?.find((row) => row.id === controlId2);
        if (!flat && (target.sdkVersion !== "0.4.0" || !node2 || !definition2)) throw Error("Composition node control is unavailable");
        if (flat && !definition2) throw Error("Scene control is unavailable");
        if (variation && !isNumberControlDefinition(definition2)) throw Error("Only number controls support per-instance variation");
        const schemaHash = flat ? state.controlSchemaHash : node2.schemaHash;
        return this.client.invoke({ name: "lux.node.variation.set", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          expectedControlSchemaHash: schemaHash,
          ...target.selectedVisualId ? { visualId: target.selectedVisualId } : {},
          nodePath: [...nodePath],
          controlId: controlId2,
          variation
        } });
      }
      async setParameters(values2) {
        const target = this.target();
        const state = getRuntimeControlState(target), patch2 = validateControlPatch(state.controlSchema, values2);
        const pending = this.latestParameters?.input;
        if (pending && (pending.instanceId !== target.instanceId || pending.expectedGeneration !== target.generation || pending.expectedRevisionId !== target.revisionId || pending.expectedControlSchemaHash !== (state.sdkVersion !== "0.1.0" ? state.controlSchemaHash : void 0) || pending.visualId !== target.selectedVisualId)) throw Error("Runtime target changed while parameters were queued");
        this.latestParameters = { name: "lux.parameters.set", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          ...state.sdkVersion !== "0.1.0" ? { expectedControlSchemaHash: state.controlSchemaHash } : {},
          ...target.selectedVisualId ? { visualId: target.selectedVisualId } : {},
          values: { ...pending?.values, ...patch2 },
          mode: "live"
        } };
        return this.startParameterDrain();
      }
      async fireTrigger(controlId2, commandId) {
        const target = this.target(), state = getRuntimeControlState(target), definition2 = state.controlSchema.find((row) => row.id === controlId2);
        if (!definition2 || definition2.type !== "trigger") throw Error("Scene trigger is unavailable");
        const activation = target.storySchedule?.committed;
        if (target.selectedVisualId && activation?.visualId !== target.selectedVisualId) throw Error("Triggers require the active Story visual");
        return this.client.invoke({ name: "lux.trigger.fire", input: {
          requestId: this.requestId(),
          commandId,
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          expectedControlSchemaHash: state.controlSchemaHash,
          controlId: controlId2,
          ...target.selectedVisualId ? { visualId: target.selectedVisualId, activationId: activation.activationId } : {}
        } });
      }
      async fireNodeTrigger(nodePath, controlId2, commandId) {
        const target = this.target();
        if (target.sdkVersion !== "0.4.0" || !target.composition) throw Error("Composition node trigger is unavailable");
        const schema3 = compositionControlSchema(target.composition, nodePath), definition2 = schema3.find((row) => row.id === controlId2), resolved = resolveCompositionControlTarget(target.composition, nodePath, controlId2);
        if (!definition2 || definition2.type !== "trigger" || resolved.type !== "trigger") throw Error("Composition node trigger is unavailable");
        const schemaHash = await sha256(new TextEncoder().encode(canonicalControlSchemaJson(schema3)));
        return this.client.invoke({ name: "lux.node.trigger.fire", input: {
          requestId: this.requestId(),
          commandId,
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          expectedControlSchemaHash: schemaHash,
          nodePath: [...nodePath],
          controlId: controlId2
        } });
      }
      async storyTransport(action, commandId, expectedStoryRevision) {
        const target = this.target(), story = target.storySchedule ?? target.story;
        if (!story) throw Error("This visual has no Story");
        return this.client.invoke({ name: "lux.story.transport", input: {
          requestId: this.requestId(),
          commandId,
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          expectedStoryHash: story.storyHash,
          expectedStoryRevision: expectedStoryRevision ?? story.storyRevision,
          ...action
        } });
      }
      startParameterDrain() {
        if (!this.parameterDrain) this.parameterDrain = this.drainParameters().then(() => {
          this.parameterDrain = null;
          if (this.latestParameters) return this.startParameterDrain();
        }, (error) => {
          this.parameterDrain = null;
          this.latestParameters = null;
          throw error;
        });
        return this.parameterDrain;
      }
      async drainParameters() {
        while (this.latestParameters) {
          const operation = this.latestParameters;
          this.latestParameters = null;
          await this.client.invoke(operation);
        }
      }
      async playback(action) {
        const target = this.target();
        return this.client.invoke({ name: "lux.playback", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          action
        } });
      }
      async setTempoBpm(bpm) {
        if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) throw Error("Tempo BPM must be from 20 through 300");
        const target = this.target();
        return this.client.invoke({ name: "lux.tempo.set", input: { requestId: this.requestId(), instanceId: target.instanceId, expectedGeneration: target.generation, expectedRevisionId: target.revisionId, bpm } });
      }
      async tapTempo() {
        const target = this.target();
        return this.client.invoke({ name: "lux.tempo.tap", input: { requestId: this.requestId(), instanceId: target.instanceId, expectedGeneration: target.generation, expectedRevisionId: target.revisionId } });
      }
      async restart() {
        const target = this.target();
        return this.client.invoke({ name: "lux.runtime.restart", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation
        } });
      }
      async resize(width, height) {
        const target = this.target();
        return this.client.invoke({ name: "lux.preview.resize", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          width,
          height
        } });
      }
    };
  }
});

// apps/studio/src/controls/ParameterInspector.tsx
var ParameterInspector_exports = {};
__export(ParameterInspector_exports, {
  ParameterInspector: () => ParameterInspector,
  parameterOwner: () => parameterOwner
});
import { useEffect as useEffect2, useId, useRef as useRef3, useState as useState3 } from "react";
import { Button as Button3, Checkbox, ClickAwayListener, Divider, FormControlLabel, IconButton, MenuItem as MenuItem2, Paper, Popper, Radio, RadioGroup, Select, Slider, Switch, TextField, Tooltip } from "@mui/material";
import { Fragment, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function parameterOwner(runtime, nodePath) {
  return runtime?.authority === "studio" ? JSON.stringify([runtime.instanceId, runtime.generation, runtime.revisionId, runtime.controlSchemaHash, nodePath ?? null]) : null;
}
function EnumMenuOption({ help, ...props }) {
  return /* @__PURE__ */ jsx3(Tooltip, { describeChild: true, title: help, placement: "left-start", disableInteractive: true, children: /* @__PURE__ */ jsx3(MenuItem2, { ...props }) });
}
function ParameterRow({ definition: definition2, controlId: controlId2, description, displayLabel, applied, effective, owner, available, client, controller, onError, edits, nodePath, node: node2, animation, issue, animationUnavailable, playback, open, onOpen, onClose }) {
  const [value, setValue] = useState3(applied), [text3, setText] = useState3(String(applied));
  const [optimistic, setOptimistic] = useState3(animation), [period, setPeriod] = useState3(String(!animation?.kind ? animation?.periodSeconds ?? 2 : 2)), [beats, setBeats] = useState3(String(animation?.kind === "tempo" ? animation.beatsPerCycle : 1));
  const [amount, setAmount] = useState3(String(animation?.amount ?? Math.max(definition2.step ?? 0, (definition2.max - definition2.min) / 10))), [phase, setPhase] = useState3(String(animation && (!animation.kind || animation.kind === "tempo") ? animation.phase : 0));
  const [attack, setAttack] = useState3(String(animation?.kind === "audio" || animation?.kind === "kick" ? animation.attackMs : 50)), [release, setRelease] = useState3(String(animation?.kind === "audio" || animation?.kind === "kick" ? animation.releaseMs : 400));
  const [sensitivity, setSensitivity] = useState3(String(animation?.kind === "kick" ? animation.sensitivity : 0.5)), [retrigger, setRetrigger] = useState3(String(animation?.kind === "kick" ? animation.retriggerMs : 120));
  const intent = useRef3(null), editing = useRef3(false), selecting = useRef3(false), button = useRef3(null), row = useRef3(null), editor = useRef3(null), undo = useRef3([]), drafting = useRef3(/* @__PURE__ */ new Set()), animationKey = animation ? JSON.stringify(animation) : "", animationDescriptionId = useId();
  useEffect2(() => {
    if (!intent.current) {
      setValue(applied);
      if (!editing.current) setText(String(applied));
    }
  }, [applied]);
  useEffect2(() => {
    setOptimistic(animation);
    if (animation) {
      if (!drafting.current.has("amount")) setAmount(String(animation.amount));
      if (animation.kind === "audio" || animation.kind === "kick") {
        if (!drafting.current.has("attack")) setAttack(String(animation.attackMs));
        if (!drafting.current.has("release")) setRelease(String(animation.releaseMs));
        if (animation.kind === "kick") {
          if (!drafting.current.has("sensitivity")) setSensitivity(String(animation.sensitivity));
          if (!drafting.current.has("retrigger")) setRetrigger(String(animation.retriggerMs));
        }
      } else if (animation.kind !== "variation") {
        if (animation.kind === "tempo" && !drafting.current.has("beats")) setBeats(String(animation.beatsPerCycle));
        if (!animation.kind && !drafting.current.has("period")) setPeriod(String(animation.periodSeconds));
        if (!drafting.current.has("phase")) setPhase(String(animation.phase));
      }
    }
  }, [animationKey]);
  useEffect2(() => () => {
    intent.current = null;
  }, []);
  useEffect2(() => {
    if (open) requestAnimationFrame(() => editor.current?.focus());
  }, [open]);
  async function change(next) {
    if (!available || !owner || parameterOwner(client.getSnapshot().authoring, nodePath) !== owner || !Number.isFinite(next) || next < definition2.min || next > definition2.max) return;
    const pending = {};
    intent.current = pending;
    setValue(next);
    setText(String(next));
    onError(null);
    edits?.changed();
    try {
      const write = nodePath?.length ? controller.setNodeParameters(nodePath, { [controlId2]: next }) : controller.setParameters({ [controlId2]: next });
      edits?.track(write);
      await write;
    } catch (error) {
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring, nodePath) === owner) onError(String(error));
    } finally {
      if (intent.current === pending) {
        intent.current = null;
        const current = client.getSnapshot();
        if (parameterOwner(current.authoring, nodePath) === owner && current.authoring) {
          const confirmed = (nodePath?.length ? current.authoring.nodeControls?.nodes.find((row2) => samePath(row2.nodePath, nodePath))?.values[controlId2] : getRuntimeControlState(current.authoring).controls[controlId2]) ?? applied;
          if (typeof confirmed === "number") {
            setValue(confirmed);
            if (!editing.current) setText(String(confirmed));
          }
        }
      }
    }
  }
  function commitText() {
    editing.current = false;
    const next = text3.trim() === "" ? NaN : Number(text3);
    if (!Number.isFinite(next) || next < definition2.min || next > definition2.max) {
      setText(String(value));
      onError(`${displayLabel} must be between ${definition2.min} and ${definition2.max}.`);
      return;
    }
    if (next !== value) void change(next);
  }
  async function setAnimation(next, record5 = true) {
    if (!available || !owner || !nodePath || !node2 || parameterOwner(client.getSnapshot().authoring, nodePath) !== owner) return;
    const pending = {};
    if (record5) undo.current.push({ prior: optimistic ?? null, token: pending });
    intent.current = pending;
    setOptimistic(next);
    onError(null);
    edits?.changed();
    const write = controller.setNodeAnimation(nodePath, controlId2, next ?? null);
    edits?.track(write);
    try {
      await write;
    } catch (error) {
      if (record5) {
        const index = undo.current.findIndex((entry) => entry.token === pending);
        if (index >= 0) undo.current.splice(index, 1);
      }
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring, nodePath) === owner) {
        setOptimistic(animation);
        setPeriod(String(!animation?.kind ? animation?.periodSeconds ?? 2 : 2));
        setBeats(String(animation?.kind === "tempo" ? animation.beatsPerCycle : 1));
        setAmount(String(animation?.amount ?? Math.max(definition2.step ?? 0, (definition2.max - definition2.min) / 10)));
        setPhase(String(animation && (!animation.kind || animation.kind === "tempo") ? animation.phase : 0));
        setAttack(String(animation?.kind === "audio" || animation?.kind === "kick" ? animation.attackMs : 50));
        setRelease(String(animation?.kind === "audio" || animation?.kind === "kick" ? animation.releaseMs : 400));
        setSensitivity(String(animation?.kind === "kick" ? animation.sensitivity : 0.5));
        setRetrigger(String(animation?.kind === "kick" ? animation.retriggerMs : 120));
        onError(String(error));
      }
    } finally {
      if (intent.current === pending) intent.current = null;
    }
  }
  const active = optimistic ?? animation;
  const lfo = LfoBinding(active), audio = AudioBinding(active), kick = KickBinding(active), tempo = TempoBinding(active), variation = VariationBinding(active), reactive = audio ?? kick, waveform = lfo ?? tempo, defaultAmount = Math.max(definition2.step ?? 0, (definition2.max - definition2.min) / 10);
  const addLfo = () => setAnimation({ nodePath: [...nodePath], definitionHash: node2.definitionHash, schemaHash: node2.schemaHash, controlId: controlId2, shape: "sine", periodSeconds: 2, amount: defaultAmount, phase: 0, enabled: true });
  const addAudio = () => setAnimation({ kind: "audio", nodePath: [...nodePath], definitionHash: node2.definitionHash, schemaHash: node2.schemaHash, controlId: controlId2, source: { kind: "audio-band", logicalInputId: "primary-audio", band: "bass", analyzer: { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 } }, amount: defaultAmount, attackMs: 50, releaseMs: 400, enabled: true });
  const addKick = () => setAnimation({ kind: "kick", nodePath: [...nodePath], definitionHash: node2.definitionHash, schemaHash: node2.schemaHash, controlId: controlId2, source: { kind: "audio-kick", logicalInputId: "primary-audio", analyzer: { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 } }, amount: defaultAmount, attackMs: 0, releaseMs: 300, sensitivity: 0.5, retriggerMs: 120, envelope: "exponential", enabled: true });
  const addTempo = () => setAnimation({ kind: "tempo", nodePath: [...nodePath], definitionHash: node2.definitionHash, schemaHash: node2.schemaHash, controlId: controlId2, shape: "sine", beatsPerCycle: 1, amount: defaultAmount, phase: 0, enabled: true });
  const addVariation = () => setAnimation({ kind: "variation", nodePath: [...nodePath], definitionHash: node2.definitionHash, schemaHash: node2.schemaHash, controlId: controlId2, distribution: "spread", amount: defaultAmount, enabled: true });
  function LfoBinding(value2) {
    return value2?.kind ? void 0 : value2;
  }
  function AudioBinding(value2) {
    return value2?.kind === "audio" ? value2 : void 0;
  }
  function KickBinding(value2) {
    return value2?.kind === "kick" ? value2 : void 0;
  }
  function TempoBinding(value2) {
    return value2?.kind === "tempo" ? value2 : void 0;
  }
  function VariationBinding(value2) {
    return value2?.kind === "variation" ? value2 : void 0;
  }
  const updateLfo = (patch2) => {
    if (!lfo) return;
    const next = { ...lfo, ...patch2 };
    if (JSON.stringify(next) !== JSON.stringify(lfo)) void setAnimation(next);
  };
  const updateAudio = (patch2) => {
    if (!audio) return;
    const next = { ...audio, ...patch2 };
    if (JSON.stringify(next) !== JSON.stringify(audio)) void setAnimation(next);
  };
  const updateKick = (patch2) => {
    if (!kick) return;
    const next = { ...kick, ...patch2 };
    if (JSON.stringify(next) !== JSON.stringify(kick)) void setAnimation(next);
  };
  const updateTempo = (patch2) => {
    if (!tempo) return;
    const next = { ...tempo, ...patch2 };
    if (JSON.stringify(next) !== JSON.stringify(tempo)) void setAnimation(next);
  };
  const updateVariation = (patch2) => {
    if (!variation) return;
    const next = { ...variation, ...patch2 };
    if (JSON.stringify(next) !== JSON.stringify(variation)) void setAnimation(next);
  };
  async function restartAnimation() {
    if (!available || !owner || !nodePath || !active || parameterOwner(client.getSnapshot().authoring, nodePath) !== owner) return;
    const pending = {};
    intent.current = pending;
    onError(null);
    const write = controller.setNodeAnimation(nodePath, controlId2, active, true);
    edits?.track(write);
    try {
      await write;
    } catch (error) {
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring, nodePath) === owner) onError(String(error));
    } finally {
      if (intent.current === pending) intent.current = null;
    }
  }
  const commitDraft = (kind) => {
    if (!active) return;
    const raw = kind === "period" ? period : kind === "beats" ? beats : kind === "amount" ? amount : kind === "phase" ? phase : kind === "attack" ? attack : kind === "release" ? release : kind === "sensitivity" ? sensitivity : retrigger, next = Number(raw), valid = raw.trim() !== "" && Number.isFinite(next) && (kind === "period" ? next >= 0.05 && next <= 3600 : kind === "beats" ? next >= 0.25 && next <= 64 : kind === "amount" ? next >= 0 : kind === "phase" || kind === "sensitivity" ? next >= 0 && next <= 1 : kind === "retrigger" ? Number.isSafeInteger(next) && next >= 0 && next <= 2e3 : Number.isSafeInteger(next) && next >= 0 && next <= 6e4);
    if (!valid) {
      onError(kind === "period" ? "Period must be between 0.05 and 3600 seconds." : kind === "beats" ? "Beats per cycle must be between 0.25 and 64." : kind === "amount" ? "Amount must be zero or greater." : kind === "phase" ? "Phase must be between 0 and 1." : kind === "sensitivity" ? "Sensitivity must be between 0 and 1." : kind === "retrigger" ? "Retrigger must be a whole number from 0 to 2000 milliseconds." : `${kind === "attack" ? "Attack" : "Release"} must be a whole number from 0 to 60000 milliseconds.`);
      setPeriod(String(lfo?.periodSeconds ?? 2));
      setBeats(String(tempo?.beatsPerCycle ?? 1));
      setAmount(String(active.amount));
      setPhase(String(waveform?.phase ?? 0));
      setAttack(String(reactive?.attackMs ?? 50));
      setRelease(String(reactive?.releaseMs ?? 400));
      setSensitivity(String(kick?.sensitivity ?? 0.5));
      setRetrigger(String(kick?.retriggerMs ?? 120));
      return;
    }
    if (kind === "amount") {
      if (next !== active.amount) {
        if (audio) updateAudio({ amount: next });
        else if (kick) updateKick({ amount: next });
        else if (tempo) updateTempo({ amount: next });
        else if (variation) updateVariation({ amount: next });
        else updateLfo({ amount: next });
      }
    } else if (kind === "period" && lfo && next !== lfo.periodSeconds) updateLfo({ periodSeconds: next });
    else if (kind === "beats" && tempo && next !== tempo.beatsPerCycle) updateTempo({ beatsPerCycle: next });
    else if (kind === "phase" && waveform && next !== waveform.phase) {
      if (tempo) updateTempo({ phase: next });
      else updateLfo({ phase: next });
    } else if (kind === "attack" && reactive && next !== reactive.attackMs) {
      if (audio) updateAudio({ attackMs: next });
      else updateKick({ attackMs: next });
    } else if (kind === "release" && reactive && next !== reactive.releaseMs) {
      if (audio) updateAudio({ releaseMs: next });
      else updateKick({ releaseMs: next });
    } else if (kind === "sensitivity" && kick && next !== kick.sensitivity) updateKick({ sensitivity: next });
    else if (kind === "retrigger" && kick && next !== kick.retriggerMs) updateKick({ retriggerMs: next });
  };
  const minimum = Math.max(definition2.min, applied - (active?.amount ?? 0)), maximum = Math.min(definition2.max, applied + (active?.amount ?? 0)), limited = !!active && (applied - active.amount < definition2.min || applied + active.amount > definition2.max), span = definition2.max - definition2.min, blocked = !!issue, animating = active?.enabled === true && !blocked, format = (number) => String(Number(number.toFixed(definition2.step && definition2.step >= 1 ? 0 : 3)));
  const controlDescription = definition2.description ?? description, animationAvailable = available && !!nodePath && !!node2, animationTitle = animationUnavailable ?? (issue ? "Animation unavailable" : active ? "Edit animation" : "Animate this control");
  const label = /* @__PURE__ */ jsxs3("label", { className: "parameter-name", htmlFor: `parameter-${definition2.id}`, ...controlDescription ? { tabIndex: 0 } : { title: `${displayLabel}${definition2.unit ? ` (${definition2.unit})` : ""}` }, children: [
    displayLabel,
    definition2.unit && /* @__PURE__ */ jsxs3("small", { children: [
      " ",
      definition2.unit
    ] })
  ] });
  return /* @__PURE__ */ jsxs3("div", { ref: row, className: "parameter-row", "data-control-id": definition2.id, "data-applied-value": applied, children: [
    /* @__PURE__ */ jsxs3("div", { className: "parameter-heading", children: [
      controlDescription ? /* @__PURE__ */ jsx3(Tooltip, { title: controlDescription, placement: "left-start", disableInteractive: true, slotProps: { tooltip: { className: "control-description-tooltip" } }, children: label }) : label,
      /* @__PURE__ */ jsx3(TextField, { id: `parameter-${definition2.id}`, className: "parameter-number", size: "small", type: "number", value: text3, disabled: !available, slotProps: { htmlInput: { "aria-label": `${displayLabel} value`, min: definition2.min, max: definition2.max, step: definition2.step ?? "any" } }, onChange: (event) => {
        editing.current = true;
        setText(event.target.value);
        edits?.changed();
      }, onBlur: commitText, onKeyDown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitText();
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          editing.current = false;
          setText(String(value));
        }
      } }),
      /* @__PURE__ */ jsxs3("span", { className: "parameter-actions", children: [
        !animationAvailable && /* @__PURE__ */ jsx3("span", { id: animationDescriptionId, hidden: true, children: animationTitle }),
        /* @__PURE__ */ jsx3(Tooltip, { title: animationTitle, children: /* @__PURE__ */ jsx3("span", { ...!animationAvailable ? { role: "button", tabIndex: 0, "aria-label": `Animate ${displayLabel}`, "aria-describedby": animationDescriptionId, "aria-disabled": true } : {}, children: /* @__PURE__ */ jsxs3(IconButton, { ref: button, size: "small", disabled: !animationAvailable, "aria-hidden": !animationAvailable || void 0, "aria-label": `Animate ${displayLabel}`, "aria-pressed": animationAvailable ? animating : void 0, onClick: onOpen, children: [
          /* @__PURE__ */ jsx3("span", { "aria-hidden": "true", children: "\u223F" }),
          active && /* @__PURE__ */ jsx3("small", { className: "animation-on", children: animating ? "ON" : "OFF" })
        ] }) }) }),
        /* @__PURE__ */ jsx3(Tooltip, { title: "Reset to default", children: /* @__PURE__ */ jsx3("span", { children: /* @__PURE__ */ jsx3(IconButton, { size: "small", disabled: !available, "aria-label": `Reset ${displayLabel} to default`, onClick: () => void change(definition2.default), children: "\u21BA" }) }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx3(Slider, { size: "small", "aria-label": displayLabel, min: definition2.min, max: definition2.max, step: definition2.step ?? span / 100, value, disabled: !available, onChange: (_e, next) => {
      if (typeof next === "number") void change(next);
    } }),
    animating && /* @__PURE__ */ jsxs3("div", { className: "animation-range", "aria-label": `${displayLabel} animation range ${format(minimum)} to ${format(maximum)}; current ${format(effective)}`, children: [
      /* @__PURE__ */ jsx3("span", { style: { left: `${100 * (minimum - definition2.min) / span}%`, right: `${100 * (definition2.max - maximum) / span}%` } }),
      /* @__PURE__ */ jsx3("i", { style: { left: `${100 * (effective - definition2.min) / span}%` } })
    ] }),
    /* @__PURE__ */ jsx3(Popper, { open, anchorEl: row.current, placement: "bottom-end", modifiers: animationModifiers, className: "animation-popper", children: /* @__PURE__ */ jsx3(ClickAwayListener, { onClickAway: () => {
      if (!selecting.current) onClose();
    }, children: /* @__PURE__ */ jsxs3(Paper, { ref: editor, role: "dialog", "aria-label": `Animate ${displayLabel}`, tabIndex: -1, onKeyDown: (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        button.current?.focus();
      }
    }, className: "animation-editor", children: [
      /* @__PURE__ */ jsx3("header", { children: /* @__PURE__ */ jsxs3("strong", { children: [
        "Animate or vary ",
        displayLabel
      ] }) }),
      issue && /* @__PURE__ */ jsx3("p", { role: "alert", children: issue }),
      playback === "paused" && active?.kind !== "variation" && /* @__PURE__ */ jsx3("p", { className: "hint", children: "Press Play to animate." }),
      !active ? /* @__PURE__ */ jsxs3(Fragment, { children: [
        /* @__PURE__ */ jsx3("p", { className: "hint", children: "Move this control over time or vary it across visual instances." }),
        /* @__PURE__ */ jsx3(Button3, { variant: "contained", onClick: addVariation, children: "Vary instances" }),
        /* @__PURE__ */ jsx3(Button3, { onClick: addLfo, children: "Add LFO" }),
        /* @__PURE__ */ jsx3(Button3, { onClick: addTempo, children: "Add Tempo" }),
        /* @__PURE__ */ jsx3(Button3, { onClick: addAudio, children: "Add Audio" }),
        /* @__PURE__ */ jsx3(Button3, { onClick: addKick, children: "Add Kick" }),
        /* @__PURE__ */ jsx3(Divider, {}),
        /* @__PURE__ */ jsx3(Button3, { onClick: () => void change(definition2.default), children: "Reset base to default" }),
        undo.current.length > 0 && /* @__PURE__ */ jsx3(Button3, { onClick: () => {
          const prior = undo.current.pop()?.prior;
          if (prior) void setAnimation(prior, false);
        }, children: "Undo remove" })
      ] }) : /* @__PURE__ */ jsxs3(Fragment, { children: [
        /* @__PURE__ */ jsx3(FormControlLabel, { control: /* @__PURE__ */ jsx3(Checkbox, { checked: animating, disabled: blocked, onChange: (event) => {
          if (audio) updateAudio({ enabled: event.target.checked });
          else if (kick) updateKick({ enabled: event.target.checked });
          else if (tempo) updateTempo({ enabled: event.target.checked });
          else if (variation) updateVariation({ enabled: event.target.checked });
          else updateLfo({ enabled: event.target.checked });
        } }), label: blocked ? "Unavailable" : animating ? "On" : "Off" }),
        variation && /* @__PURE__ */ jsxs3("label", { children: [
          "Distribution",
          /* @__PURE__ */ jsx3(Select, { size: "small", value: variation.distribution, disabled: blocked, inputProps: { "aria-label": "Instance variation distribution" }, onOpen: () => {
            selecting.current = true;
          }, onClose: () => {
            setTimeout(() => {
              selecting.current = false;
            }, 0);
          }, onChange: (event) => updateVariation({ distribution: event.target.value }), children: ["spread", "random", "centered"].map((distribution) => /* @__PURE__ */ jsx3(MenuItem2, { value: distribution, children: distribution === "centered" ? "Center-weighted" : distribution[0].toUpperCase() + distribution.slice(1) }, distribution)) })
        ] }),
        waveform && /* @__PURE__ */ jsxs3("label", { children: [
          "Shape",
          /* @__PURE__ */ jsx3(Select, { size: "small", value: waveform.shape, disabled: blocked, onOpen: () => {
            selecting.current = true;
          }, onClose: () => {
            setTimeout(() => {
              selecting.current = false;
            }, 0);
          }, onChange: (event) => {
            const shape = event.target.value;
            if (tempo) updateTempo({ shape });
            else updateLfo({ shape });
          }, children: ["sine", "triangle", "saw", "square"].map((shape) => /* @__PURE__ */ jsx3(MenuItem2, { value: shape, children: shape[0].toUpperCase() + shape.slice(1) }, shape)) })
        ] }),
        lfo && /* @__PURE__ */ jsxs3(Fragment, { children: [
          /* @__PURE__ */ jsxs3("label", { children: [
            "Period ",
            /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: period, disabled: blocked, slotProps: { htmlInput: { min: 0.05, max: 3600, step: 0.05, "aria-label": "Animation period seconds" } }, onFocus: () => drafting.current.add("period"), onChange: (event) => setPeriod(event.target.value), onBlur: () => {
              commitDraft("period");
              drafting.current.delete("period");
            }, onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft("period");
              }
            } }),
            " s"
          ] }),
          /* @__PURE__ */ jsx3(Slider, { size: "small", "aria-label": "Animation period", disabled: blocked, min: 0.05, max: Math.min(10, 3600), step: 0.05, value: Math.min(10, Math.max(0.05, Number(period) || 0.05)), onChange: (_e, next) => setPeriod(String(next)), onChangeCommitted: (_e, next) => {
            if (typeof next === "number") void updateLfo({ periodSeconds: next });
          } })
        ] }),
        tempo && /* @__PURE__ */ jsxs3("label", { children: [
          "Beats / cycle ",
          /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: beats, disabled: blocked, slotProps: { htmlInput: { min: 0.25, max: 64, step: 0.25, "aria-label": "Tempo beats per cycle" } }, onFocus: () => drafting.current.add("beats"), onChange: (event) => setBeats(event.target.value), onBlur: () => {
            commitDraft("beats");
            drafting.current.delete("beats");
          }, onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft("beats");
            }
          } })
        ] }),
        audio && /* @__PURE__ */ jsx3(Fragment, { children: /* @__PURE__ */ jsxs3("label", { children: [
          "Band",
          /* @__PURE__ */ jsx3(Select, { size: "small", value: audio.source.band, disabled: blocked, inputProps: { "aria-label": "Audio band" }, onOpen: () => {
            selecting.current = true;
          }, onClose: () => {
            setTimeout(() => {
              selecting.current = false;
            }, 0);
          }, onChange: (event) => updateAudio({ source: { ...audio.source, band: event.target.value } }), children: ["level", "bass", "mids", "highs"].map((band) => /* @__PURE__ */ jsx3(MenuItem2, { value: band, children: band[0].toUpperCase() + band.slice(1) }, band)) })
        ] }) }),
        kick && /* @__PURE__ */ jsxs3(Fragment, { children: [
          /* @__PURE__ */ jsxs3("label", { children: [
            "Sensitivity ",
            /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: sensitivity, disabled: blocked, slotProps: { htmlInput: { min: 0, max: 1, step: 0.01, "aria-label": "Kick sensitivity" } }, onFocus: () => drafting.current.add("sensitivity"), onChange: (event) => setSensitivity(event.target.value), onBlur: () => {
              commitDraft("sensitivity");
              drafting.current.delete("sensitivity");
            } })
          ] }),
          /* @__PURE__ */ jsxs3("label", { children: [
            "Retrigger ",
            /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: retrigger, disabled: blocked, slotProps: { htmlInput: { min: 0, max: 2e3, step: 1, "aria-label": "Kick retrigger milliseconds" } }, onFocus: () => drafting.current.add("retrigger"), onChange: (event) => setRetrigger(event.target.value), onBlur: () => {
              commitDraft("retrigger");
              drafting.current.delete("retrigger");
            } }),
            " ms"
          ] }),
          /* @__PURE__ */ jsxs3("label", { children: [
            "Envelope",
            /* @__PURE__ */ jsx3(Select, { size: "small", value: kick.envelope, disabled: blocked, inputProps: { "aria-label": "Kick envelope" }, onOpen: () => {
              selecting.current = true;
            }, onClose: () => {
              setTimeout(() => {
                selecting.current = false;
              }, 0);
            }, onChange: (event) => updateKick({ envelope: event.target.value }), children: ["linear", "exponential"].map((shape) => /* @__PURE__ */ jsx3(MenuItem2, { value: shape, children: shape[0].toUpperCase() + shape.slice(1) }, shape)) })
          ] })
        ] }),
        reactive && /* @__PURE__ */ jsxs3(Fragment, { children: [
          /* @__PURE__ */ jsxs3("label", { children: [
            "Attack ",
            /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: attack, disabled: blocked, slotProps: { htmlInput: { min: 0, max: 6e4, step: 1, "aria-label": "Audio attack milliseconds" } }, onFocus: () => drafting.current.add("attack"), onChange: (event) => setAttack(event.target.value), onBlur: () => {
              commitDraft("attack");
              drafting.current.delete("attack");
            } }),
            " ms"
          ] }),
          /* @__PURE__ */ jsxs3("label", { children: [
            "Release ",
            /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: release, disabled: blocked, slotProps: { htmlInput: { min: 0, max: 6e4, step: 1, "aria-label": "Audio release milliseconds" } }, onFocus: () => drafting.current.add("release"), onChange: (event) => setRelease(event.target.value), onBlur: () => {
              commitDraft("release");
              drafting.current.delete("release");
            } }),
            " ms"
          ] })
        ] }),
        /* @__PURE__ */ jsxs3("label", { children: [
          "Amount ",
          /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: amount, disabled: blocked, slotProps: { htmlInput: { min: 0, step: definition2.step ?? "any", "aria-label": "Animation amount" } }, onFocus: () => drafting.current.add("amount"), onChange: (event) => setAmount(event.target.value), onBlur: () => {
            commitDraft("amount");
            drafting.current.delete("amount");
          }, onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft("amount");
            }
          } })
        ] }),
        /* @__PURE__ */ jsx3(Slider, { size: "small", "aria-label": "Animation amount range", disabled: blocked, min: 0, max: span, step: definition2.step ?? span / 100, value: Math.min(span, Math.max(0, Number(amount) || 0)), onChange: (_e, next) => setAmount(String(next)), onChangeCommitted: (_e, next) => {
          if (typeof next === "number") {
            if (audio) updateAudio({ amount: next });
            else if (kick) updateKick({ amount: next });
            else if (tempo) updateTempo({ amount: next });
            else if (variation) updateVariation({ amount: next });
            else updateLfo({ amount: next });
          }
        } }),
        animating ? /* @__PURE__ */ jsxs3("div", { className: "animation-range-label", children: [
          /* @__PURE__ */ jsx3("span", { children: format(minimum) }),
          /* @__PURE__ */ jsx3("strong", { children: format(effective) }),
          /* @__PURE__ */ jsx3("span", { children: format(maximum) })
        ] }) : /* @__PURE__ */ jsx3("p", { className: "hint", children: blocked ? "Animation is disabled until this control is compatible again." : `Off \xB7 Output uses base ${format(applied)}.` }),
        animating && limited && /* @__PURE__ */ jsx3("p", { className: "hint", children: "Limited by control range." }),
        /* @__PURE__ */ jsx3(Divider, {}),
        /* @__PURE__ */ jsxs3("details", { children: [
          /* @__PURE__ */ jsx3("summary", { children: "More" }),
          waveform && /* @__PURE__ */ jsxs3("label", { children: [
            "Start phase ",
            /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: phase, disabled: blocked, slotProps: { htmlInput: { min: 0, max: 1, step: 0.01, "aria-label": "Animation start phase" } }, onFocus: () => drafting.current.add("phase"), onChange: (event) => setPhase(event.target.value), onBlur: () => {
              commitDraft("phase");
              drafting.current.delete("phase");
            } })
          ] }),
          !tempo && !variation && /* @__PURE__ */ jsx3(Button3, { disabled: blocked, onClick: () => void restartAnimation(), children: reactive ? "Reset response" : "Restart animation" }),
          /* @__PURE__ */ jsx3(Button3, { onClick: () => void change(definition2.default), children: "Reset base to default" }),
          /* @__PURE__ */ jsx3(Button3, { color: "error", onClick: () => void setAnimation(void 0), children: "Remove animation" })
        ] }),
        /* @__PURE__ */ jsx3(Button3, { disabled: undo.current.length === 0, onClick: () => {
          const prior = undo.current.pop()?.prior;
          void setAnimation(prior ?? void 0, false);
        }, children: "Undo animation change" })
      ] })
    ] }) }) })
  ] });
}
function TriggerParameterRow({ definition: definition2, controlId: controlId2, description, displayLabel, owner, available, disabledReason, client, controller, onError, nodePath }) {
  const [state, setState] = useState3("ready"), retryCommandId = useRef3(null), intent = useRef3(null);
  const disabledDescriptionId = useId();
  useEffect2(() => () => {
    intent.current = null;
  }, []);
  async function activate() {
    if (intent.current || state === "pending" || !available || !owner || disabledReason || parameterOwner(client.getSnapshot().authoring, nodePath) !== owner) return;
    const commandId = retryCommandId.current ?? crypto.randomUUID(), pending = {};
    intent.current = pending;
    setState("pending");
    onError(null);
    try {
      if (nodePath?.length) await controller.fireNodeTrigger(nodePath, controlId2, commandId);
      else await controller.fireTrigger(controlId2, commandId);
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring, nodePath) === owner) {
        retryCommandId.current = null;
        setState("ready");
      }
    } catch (error) {
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring, nodePath) === owner) {
        const uncertain = isUncertainTriggerError(error);
        retryCommandId.current = uncertain ? commandId : null;
        setState(uncertain ? "retry" : "ready");
        onError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (intent.current === pending) intent.current = null;
    }
  }
  const controlDescription = definition2.description ?? description;
  const label = /* @__PURE__ */ jsx3("span", { className: "parameter-name", ...controlDescription ? { tabIndex: 0 } : { title: displayLabel }, children: displayLabel });
  const describedLabel = controlDescription ? /* @__PURE__ */ jsx3(Tooltip, { title: controlDescription, placement: "left-start", disableInteractive: true, slotProps: { tooltip: { className: "control-description-tooltip" } }, children: label }) : label;
  const verb = state === "pending" ? "Running" : state === "retry" ? "Retry" : "Run";
  return /* @__PURE__ */ jsxs3("div", { className: "parameter-row parameter-row-trigger", "data-control-id": definition2.id, children: [
    /* @__PURE__ */ jsxs3("div", { className: "parameter-heading", children: [
      describedLabel,
      /* @__PURE__ */ jsx3(Button3, { className: "parameter-trigger-button", size: "small", variant: "outlined", disabled: !available || !owner || !!disabledReason, "aria-label": `${verb} ${displayLabel}`, "aria-busy": state === "pending" || void 0, "aria-disabled": state === "pending" || !!disabledReason || void 0, "aria-describedby": disabledReason ? disabledDescriptionId : void 0, onClick: () => void activate(), children: state === "pending" ? "Running\u2026" : state === "retry" ? "Retry" : "Run" })
    ] }),
    disabledReason && /* @__PURE__ */ jsx3("p", { className: "hint parameter-trigger-disabled", id: disabledDescriptionId, children: disabledReason })
  ] });
}
function TypedParameterRow({ definition: definition2, controlId: controlId2, description, displayLabel, applied, owner, available, client, controller, onError, edits, nodePath }) {
  const [value, setValue] = useState3(applied), intent = useRef3(null), optionRefs = useRef3(/* @__PURE__ */ new Map());
  const [focusId, setFocusId] = useState3(definition2.type === "enum" ? String(applied) : "");
  const controlDescription = definition2.description ?? description, optionDescriptionPrefix = useId();
  useEffect2(() => {
    if (!intent.current) setValue(applied);
  }, [applied]);
  useEffect2(() => {
    if (!intent.current && definition2.type === "enum" && definition2.options.some((option) => option.id === String(applied))) setFocusId(String(applied));
  }, [applied, definition2]);
  useEffect2(() => () => {
    intent.current = null;
  }, []);
  async function change(next) {
    if (!available || !owner || parameterOwner(client.getSnapshot().authoring, nodePath) !== owner) return;
    if (definition2.type === "boolean" ? typeof next !== "boolean" : typeof next !== "string" || !definition2.options.some((option) => option.id === next)) return;
    const pending = {};
    intent.current = pending;
    setValue(next);
    onError(null);
    edits?.changed();
    try {
      const write = nodePath?.length ? controller.setNodeParameters(nodePath, { [controlId2]: next }) : controller.setParameters({ [controlId2]: next });
      edits?.track(write);
      await write;
    } catch (error) {
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring, nodePath) === owner) onError(String(error));
    } finally {
      if (intent.current === pending) {
        intent.current = null;
        const current = client.getSnapshot(), confirmed = nodePath?.length ? current.authoring?.nodeControls?.nodes.find((row) => samePath(row.nodePath, nodePath))?.values[controlId2] : current.authoring ? getRuntimeControlState(current.authoring).controls[controlId2] : void 0;
        if (parameterOwner(current.authoring, nodePath) === owner) {
          if (definition2.type === "boolean" && typeof confirmed === "boolean") setValue(confirmed);
          else if (definition2.type === "enum" && typeof confirmed === "string") {
            setValue(confirmed);
            setFocusId(confirmed);
          }
        }
      }
    }
  }
  const label = /* @__PURE__ */ jsx3("span", { className: "parameter-name", ...controlDescription ? { tabIndex: 0 } : { title: displayLabel }, children: displayLabel });
  const describedLabel = controlDescription ? /* @__PURE__ */ jsx3(Tooltip, { title: controlDescription, placement: "left-start", disableInteractive: true, slotProps: { tooltip: { className: "control-description-tooltip" } }, children: label }) : label;
  const reset = /* @__PURE__ */ jsx3(Tooltip, { title: "Reset to default", children: /* @__PURE__ */ jsx3("span", { children: /* @__PURE__ */ jsx3(IconButton, { size: "small", disabled: !available, "aria-label": `Reset ${displayLabel} to default`, onClick: () => void change(definition2.default), children: "\u21BA" }) }) });
  const optionHelp = (option) => option.description ? `${option.label} \u2014 ${option.description}` : option.label;
  if (definition2.type === "boolean") return /* @__PURE__ */ jsx3("div", { className: "parameter-row parameter-row-boolean", "data-control-id": definition2.id, "data-applied-value": String(applied), children: /* @__PURE__ */ jsxs3("div", { className: "parameter-heading", children: [
    /* @__PURE__ */ jsx3(FormControlLabel, { className: "parameter-boolean", labelPlacement: "start", control: /* @__PURE__ */ jsx3(Switch, { size: "small", checked: value === true, disabled: !available, slotProps: { input: { "aria-label": displayLabel } }, onChange: (event) => void change(event.target.checked) }), label: describedLabel }),
    /* @__PURE__ */ jsx3("span", { className: "parameter-actions parameter-actions-reset", children: reset })
  ] }) });
  const selectFocus = (id3) => {
    setFocusId(id3);
    optionRefs.current.get(id3)?.focus();
  };
  const moveFocus = (id3, key2, select) => {
    const index = definition2.options.findIndex((option2) => option2.id === id3), last = definition2.options.length - 1;
    let next = index;
    if (key2 === "ArrowRight" || key2 === "ArrowDown") next = (index + 1) % definition2.options.length;
    else if (key2 === "ArrowLeft" || key2 === "ArrowUp") next = (index + last) % definition2.options.length;
    else if (key2 === "Home") next = 0;
    else if (key2 === "End") next = last;
    else return false;
    const option = definition2.options[next];
    selectFocus(option.id);
    if (select) void change(option.id);
    return true;
  };
  return /* @__PURE__ */ jsxs3("div", { className: `parameter-row parameter-row-enum parameter-enum-${definition2.presentation}`, "data-control-id": definition2.id, "data-applied-value": String(applied), children: [
    /* @__PURE__ */ jsxs3("div", { className: "parameter-heading", children: [
      describedLabel,
      /* @__PURE__ */ jsx3("span", { className: "parameter-actions parameter-actions-reset", children: reset })
    ] }),
    definition2.presentation === "dropdown" ? /* @__PURE__ */ jsx3(Select, { className: "parameter-enum-select", size: "small", fullWidth: true, value: String(value), disabled: !available, inputProps: { "aria-label": `${displayLabel} value` }, onChange: (event) => void change(event.target.value), children: definition2.options.map((option) => /* @__PURE__ */ jsx3(EnumMenuOption, { value: option.id, help: optionHelp(option), children: option.label }, option.id)) }) : definition2.presentation === "segmented" ? /* @__PURE__ */ jsx3("div", { className: "parameter-segments", role: "group", "aria-label": `${displayLabel} value`, children: definition2.options.map((option) => {
      const descriptionId = `${optionDescriptionPrefix}-${option.id}`;
      return /* @__PURE__ */ jsx3(Tooltip, { id: descriptionId, describeChild: true, title: optionHelp(option), placement: "left-start", disableInteractive: true, children: /* @__PURE__ */ jsx3("span", { className: "parameter-segment-wrap", children: /* @__PURE__ */ jsx3("button", { ref: (element) => {
        if (element) optionRefs.current.set(option.id, element);
        else optionRefs.current.delete(option.id);
      }, type: "button", "aria-pressed": value === option.id, "aria-label": option.label, "aria-describedby": descriptionId, tabIndex: focusId === option.id ? 0 : -1, disabled: !available, onFocus: () => setFocusId(option.id), onClick: () => void change(option.id), onKeyDown: (event) => {
        if (moveFocus(option.id, event.key, false)) {
          event.preventDefault();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void change(option.id);
        }
      }, children: /* @__PURE__ */ jsx3("span", { children: option.label }) }) }) }, option.id);
    }) }) : /* @__PURE__ */ jsx3(RadioGroup, { className: "parameter-radios", "aria-label": `${displayLabel} value`, value: String(value), onChange: (event) => void change(event.target.value), onKeyDown: (event) => {
      const target = event.target, index = definition2.options.findIndex((option2) => option2.id === target.value), last = definition2.options.length - 1;
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % definition2.options.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + last) % definition2.options.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = last;
      else return;
      event.preventDefault();
      const option = definition2.options[next];
      setFocusId(option.id);
      event.currentTarget.querySelectorAll('input[type="radio"]')[next]?.focus();
      void change(option.id);
    }, children: definition2.options.map((option) => {
      const descriptionId = `${optionDescriptionPrefix}-${option.id}`;
      return /* @__PURE__ */ jsx3(Tooltip, { id: descriptionId, describeChild: true, title: optionHelp(option), placement: "left-start", disableInteractive: true, children: /* @__PURE__ */ jsx3(FormControlLabel, { value: option.id, label: option.label, control: /* @__PURE__ */ jsx3(Radio, { size: "small", disabled: !available, onFocus: () => setFocusId(option.id), slotProps: { input: { tabIndex: focusId === option.id ? 0 : -1, "aria-describedby": descriptionId } } }) }) }, option.id);
    }) })
  ] });
}
function ParameterInspector({ runtime, available, client, controller, onError, edits, nodePath }) {
  const [openId, setOpenId] = useState3(null), [groupOpen, setGroupOpen] = useState3({}), [query, setQuery] = useState3(""), selectionOwner = parameterOwner(runtime, nodePath);
  useEffect2(() => {
    setOpenId(null);
    setGroupOpen({});
    setQuery("");
  }, [selectionOwner]);
  if (!runtime) return /* @__PURE__ */ jsx3("p", { className: "hint", children: "Build a visual to see its controls." });
  const occurrence = nodePath ? compositionOccurrence(runtime, nodePath) : void 0;
  if (nodePath && !occurrence) {
    const issues = runtime.controlAnimationIssues?.filter((row) => samePath(row.nodePath, nodePath)) ?? [];
    return /* @__PURE__ */ jsxs3(Fragment, { children: [
      /* @__PURE__ */ jsx3("p", { className: "hint", children: "This node is no longer available. Select another node." }),
      issues.map((row) => /* @__PURE__ */ jsxs3("p", { role: "alert", children: [
        "Animation for ",
        row.controlId,
        " is disabled. ",
        row.message
      ] }, `${row.controlId}:${row.index}`))
    ] });
  }
  const publicState = getRuntimeControlState(runtime), schema3 = nodePath ? occurrence?.metadata.controls ?? [] : publicState.controlSchema, unselectedIssues = nodePath ? [] : runtime.controlAnimationIssues ?? [];
  const committedVisual = runtime.storySchedule?.committed?.visualId, triggerDisabledReason = !nodePath?.length && runtime.storySchedule && runtime.selectedVisualId && committedVisual !== runtime.selectedVisualId ? committedVisual ? `Triggers require the active Story visual (${committedVisual}). Select that source to run this action.` : "Triggers are unavailable until a Story visual is active." : void 0;
  const counts = /* @__PURE__ */ new Map();
  for (const definition2 of schema3) counts.set(definition2.label, (counts.get(definition2.label) ?? 0) + 1);
  const display = (d) => counts.get(d.label) > 1 ? `${d.id} \xB7 ${d.label}` : d.label;
  const renderControl = (definition2) => {
    const target = compositionControlTarget(runtime, nodePath ?? [], definition2.id), targetNode = target ? visualControlNode(runtime, target.nodePath) : void 0, effectiveNode = target ? runtime.effectiveNodeControls?.nodes.find((row) => samePath(row.nodePath, target.nodePath)) : void 0;
    if (nodePath && (!target || !targetNode)) return /* @__PURE__ */ jsx3("p", { className: "hint", children: "This control is no longer available. Rebuild or select another node." }, definition2.id);
    const controlId2 = target?.controlId ?? definition2.id, owner = parameterOwner(runtime, target?.nodePath);
    if (definition2.type === "trigger") return /* @__PURE__ */ jsx3(TriggerParameterRow, { definition: definition2, controlId: controlId2, description: occurrence?.metadata.controlDescriptions[definition2.id], displayLabel: display(definition2), owner, available, disabledReason: triggerDisabledReason, client, controller, onError, nodePath: target?.nodePath }, `${selectionOwner}:${definition2.id}`);
    const applied = targetNode?.values[controlId2] ?? publicState.controls[definition2.id], animation = runtime.controlAnimations?.find((row) => !!target && samePath(row.nodePath, target.nodePath) && row.controlId === controlId2), issue = runtime.controlAnimationIssues?.find((row) => !!target && samePath(row.nodePath, target.nodePath) && row.controlId === controlId2)?.message;
    const animationUnavailable = target ? void 0 : "Animation is unavailable because this control does not map to one component control.";
    if (definition2.type !== "number") return /* @__PURE__ */ jsx3(TypedParameterRow, { definition: definition2, controlId: controlId2, description: occurrence?.metadata.controlDescriptions[definition2.id], displayLabel: display(definition2), applied, owner, available, client, controller, onError, edits, nodePath: target?.nodePath }, `${selectionOwner}:${definition2.id}`);
    return /* @__PURE__ */ jsx3(ParameterRow, { definition: definition2, controlId: controlId2, description: occurrence?.metadata.controlDescriptions[definition2.id], displayLabel: display(definition2), applied, effective: effectiveNode?.values[controlId2] ?? runtime.effectiveControls?.[controlId2] ?? applied, owner, available, client, controller, onError, edits, nodePath: target?.nodePath, node: targetNode, animation, issue, animationUnavailable, playback: runtime.playback, open: openId === definition2.id, onOpen: () => setOpenId((current) => current === definition2.id ? null : definition2.id), onClose: () => setOpenId((current) => current === definition2.id ? null : current) }, `${selectionOwner}:${definition2.id}`);
  };
  const grouped = /* @__PURE__ */ new Map();
  for (const definition2 of schema3) if (definition2.group) grouped.set(definition2.group, [...grouped.get(definition2.group) ?? [], definition2]);
  const setAllGroups = (open) => {
    setQuery("");
    setOpenId(null);
    setGroupOpen(Object.fromEntries([...grouped.keys()].map((group2) => [group2, open])));
  };
  const needle = query.trim().toLocaleLowerCase(), matches2 = (definition2) => !needle || [definition2.id, definition2.label, definition2.group ?? ""].some((value) => value.toLocaleLowerCase().includes(needle));
  const renderedGroups = /* @__PURE__ */ new Set(), content = schema3.flatMap((definition2) => {
    if (!definition2.group) return matches2(definition2) ? [renderControl(definition2)] : [];
    if (renderedGroups.has(definition2.group)) return [];
    renderedGroups.add(definition2.group);
    const group2 = definition2.group, definitions = grouped.get(group2), visible = group2.toLocaleLowerCase().includes(needle) ? definitions : definitions.filter(matches2);
    return visible.length ? [/* @__PURE__ */ jsxs3("details", { className: "parameter-group", open: needle ? true : groupOpen[group2] ?? true, onToggle: (event) => {
      if (event.target === event.currentTarget) {
        if (needle) {
          event.currentTarget.open = true;
          return;
        }
        const open = event.currentTarget.open;
        setGroupOpen((current) => ({ ...current, [group2]: open }));
        if (!open) setOpenId((current) => definitions.some((definition3) => definition3.id === current) ? null : current);
      }
    }, children: [
      /* @__PURE__ */ jsx3("summary", { children: group2 }),
      /* @__PURE__ */ jsx3("div", { className: "parameter-group-controls", children: visible.map(renderControl) })
    ] }, `${selectionOwner}:group:${group2}`)] : [];
  });
  return /* @__PURE__ */ jsxs3(Fragment, { children: [
    unselectedIssues.map((row) => /* @__PURE__ */ jsxs3("p", { role: "alert", children: [
      "Animation for ",
      row.controlId,
      " is disabled. ",
      row.message
    ] }, `${row.index}:${row.controlId}`)),
    schema3.length === 0 ? /* @__PURE__ */ jsx3("p", { className: "hint", children: "This visual defines no live controls." }) : /* @__PURE__ */ jsxs3(Fragment, { children: [
      /* @__PURE__ */ jsxs3("div", { className: "parameter-filter", children: [
        /* @__PURE__ */ jsx3(TextField, { fullWidth: true, size: "small", value: query, placeholder: "Filter controls", slotProps: { htmlInput: { "aria-label": "Filter controls" } }, onChange: (event) => setQuery(event.target.value) }),
        /* @__PURE__ */ jsx3(IconButton, { size: "small", "aria-label": "Clear control filter", disabled: !query, onClick: () => setQuery(""), children: "\xD7" }),
        grouped.size > 0 && /* @__PURE__ */ jsxs3(Fragment, { children: [
          /* @__PURE__ */ jsx3(Tooltip, { title: "Collapse all control groups", children: /* @__PURE__ */ jsx3(IconButton, { size: "small", "aria-label": "Collapse all control groups", onClick: () => setAllGroups(false), children: "\u2212" }) }),
          /* @__PURE__ */ jsx3(Tooltip, { title: "Expand all control groups", children: /* @__PURE__ */ jsx3(IconButton, { size: "small", "aria-label": "Expand all control groups", onClick: () => setAllGroups(true), children: "+" }) })
        ] })
      ] }),
      content.length ? content : /* @__PURE__ */ jsxs3("p", { className: "hint", children: [
        "No controls match \u201C",
        query,
        "\u201D."
      ] })
    ] })
  ] });
}
var samePath, animationModifiers;
var init_ParameterInspector = __esm({
  "apps/studio/src/controls/ParameterInspector.tsx"() {
    "use strict";
    init_service_client();
    init_visual_model();
    samePath = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    animationModifiers = [{ name: "offset", options: { offset: [0, 8] } }, { name: "preventOverflow", options: { padding: 8 } }];
  }
});

// apps/studio/src/performance/PerformanceStatus.tsx
import { memo } from "react";
import { jsxs as jsxs4 } from "react/jsx-runtime";
var duration, PerformanceStatus;
var init_PerformanceStatus = __esm({
  "apps/studio/src/performance/PerformanceStatus.tsx"() {
    "use strict";
    duration = (metric) => metric?.p95 === void 0 ? "pending" : `${metric.p95.toFixed(2)} ms p95`;
    PerformanceStatus = memo(function PerformanceStatus2({ performance: value }) {
      const worker = value?.worker;
      const incomplete = worker && (worker.mode === "routine" && worker.cpuCall.validity === "incomplete" || worker.gpu.timestampQueryEnabled && worker.gpu.validity === "incomplete" || worker.intervalLostRecords > 0 || worker.intervalInvalidRecords > 0);
      const detail = worker ? [
        `Mode: ${worker.mode}. Completed worker frames: ${worker.produced.sampleCount}; duration samples: ${worker.retainedRecords}; lost: ${worker.lostRecords}; invalid: ${worker.invalidRecords}.`,
        `Update ${duration(worker.update)}; synchronous render ${duration(worker.renderCall)}; render await ${duration(worker.renderAwait)}; queue completion wait ${duration(worker.queueWait)}.`,
        worker.cpuCall.reason ?? "",
        worker.gpu.reason ?? "",
        `Timestamp query support: ${worker.gpu.timestampQuerySupported === null ? "unknown" : worker.gpu.timestampQuerySupported ? "yes" : "no"}; enabled: ${worker.gpu.timestampQueryEnabled ? "yes" : "no"}.`,
        `GPU samples ${worker.gpu.sampleCount}/${worker.gpu.expectedCount} eligible frames; ${worker.gpu.samplingPolicy}; failed ${worker.gpu.failedSamples}; dropped ${worker.gpu.droppedSamples}; pending ${worker.gpu.pendingSamples}.`,
        "Hardware budgets are not evaluated."
      ].join(" ") : "Waiting for runtime telemetry. Hardware budgets are not evaluated.";
      return /* @__PURE__ */ jsxs4("div", { "aria-label": "Live performance", title: detail, style: { display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "inherit" }, children: [
        /* @__PURE__ */ jsxs4("span", { children: [
          "Worker ",
          worker?.produced.value === void 0 ? "pending" : `${worker.produced.value.toFixed(1)} fps`
        ] }),
        /* @__PURE__ */ jsxs4("span", { children: [
          "CPU calls ",
          worker?.mode === "baseline" ? "disabled (baseline)" : duration(worker?.cpuCall)
        ] }),
        /* @__PURE__ */ jsxs4("span", { children: [
          "GPU passes ",
          worker?.mode === "baseline" ? "disabled (baseline)" : worker?.gpu.timestampQueryEnabled ? `${duration(worker.gpu)} \xB7 sampled` : "unavailable"
        ] }),
        /* @__PURE__ */ jsxs4("span", { children: [
          value?.status ?? "pending",
          incomplete ? " \xB7 incomplete" : ""
        ] })
      ] });
    });
  }
});

// apps/studio/src/presentation.ts
var PreviewBinding;
var init_presentation = __esm({
  "apps/studio/src/presentation.ts"() {
    "use strict";
    PreviewBinding = class {
      port;
      lease = null;
      revision = 0;
      queue = Promise.resolve();
      constructor(port) {
        this.port = port;
      }
      move(target, runtimeKey) {
        const revision = ++this.revision;
        return this.enqueue(async () => {
          await this.release();
          if (revision !== this.revision) return;
          this.lease = await this.port.attach({ target, runtimeKey: { ...runtimeKey } });
          if (revision !== this.revision) await this.release();
        });
      }
      close() {
        ++this.revision;
        return this.enqueue(() => this.release());
      }
      async release() {
        if (!this.lease) return;
        await this.lease.detach();
        this.lease = null;
      }
      enqueue(operation) {
        const next = this.queue.then(operation, operation);
        this.queue = next;
        return next;
      }
    };
  }
});

// apps/studio/src/preview-camera-controller.ts
function cameraPort(port) {
  if (!port || typeof port !== "object") return false;
  const type = port.type;
  return !!type && typeof type === "object" && type.kind === "shader-field" && type.version === 1 && type.abi === CAMERA_CONTROLLER_ABI;
}
function connectedCameraPaths(profile) {
  const candidates = [];
  const activePaths = profile.nodes.map((node2) => node2.nodePath);
  const resolveOutput2 = (definitionHash, nodePath, portId2) => {
    const definition2 = profile.definitions[definitionHash];
    if (!definition2) return null;
    if (definition2.kind === "code") return { nodePath, definitionHash, portId: portId2 };
    const target = definition2.body.outputBindings[portId2];
    if (!target) return null;
    const child = definition2.body.nodes.find((node2) => node2.id === target.nodeId);
    return child ? resolveOutput2(child.definitionHash, [...nodePath, child.id], target.portId) : null;
  };
  const resolveInputs = (definitionHash, nodePath, portId2) => {
    const definition2 = profile.definitions[definitionHash];
    if (!definition2) return [];
    if (definition2.kind === "code") return [{ nodePath, definitionHash, portId: portId2 }];
    return (definition2.body.inputBindings[portId2] ?? []).flatMap((target) => {
      const child = definition2.body.nodes.find((node2) => node2.id === target.nodeId);
      return child ? resolveInputs(child.definitionHash, [...nodePath, child.id], target.portId) : [];
    });
  };
  const visit = (definitionHash, parentPath) => {
    const definition2 = profile.definitions[definitionHash];
    if (!definition2 || definition2.kind !== "graph") return;
    const nodes = new Map(definition2.body.nodes.map((node2) => [node2.id, node2]));
    for (const edge2 of definition2.body.edges) {
      const fromNode = nodes.get(edge2.from.nodeId);
      const toNode = nodes.get(edge2.to.nodeId);
      if (!fromNode || !toNode) continue;
      const producerPath = [...parentPath, fromNode.id];
      const consumerPath = [...parentPath, toNode.id];
      const producer = resolveOutput2(fromNode.definitionHash, producerPath, edge2.from.portId);
      if (!producer) continue;
      const producerDefinition = profile.definitions[producer.definitionHash];
      if (producerDefinition?.kind !== "code" || !cameraPort(producerDefinition.metadata.outputs[producer.portId]) || !activePaths.some((path) => samePath2(path, producer.nodePath))) continue;
      const controls = producerDefinition.metadata.controls;
      if (controls.length !== CAMERA_CONTROLLER_CONTROL_IDS.length || !CAMERA_CONTROLLER_CONTROL_IDS.every((id3) => controls.some((control) => control.id === id3 && control.type === "number"))) continue;
      for (const consumer of resolveInputs(toNode.definitionHash, consumerPath, edge2.to.portId)) {
        const consumerDefinition = profile.definitions[consumer.definitionHash];
        if (consumerDefinition?.kind === "code" && cameraPort(consumerDefinition.metadata.inputs[consumer.portId]) && activePaths.some((path) => samePath2(path, consumer.nodePath))) candidates.push(producer.nodePath);
      }
    }
    for (const node2 of definition2.body.nodes) {
      if (profile.definitions[node2.definitionHash]?.kind === "graph") visit(node2.definitionHash, [...parentPath, node2.id]);
    }
  };
  visit(profile.graph.rootDefinitionHash, []);
  return candidates.filter((path, index) => candidates.findIndex((candidate) => samePath2(candidate, path)) === index);
}
function cameraControllerBinding(runtime) {
  if (!runtime || runtime.sdkVersion !== "0.4.0" || !runtime.composition || !runtime.controlSchemaHash) return null;
  const paths = connectedCameraPaths(runtime.composition);
  if (paths.length !== 1) return null;
  const nodePath = paths[0];
  const aliases = {};
  const values2 = {};
  for (const controlId2 of CAMERA_CONTROLLER_CONTROL_IDS) {
    const matchingAliases = Object.entries(runtime.composition.publicControlBindings).filter(([, targets]) => targets.length === 1 && targets[0].active && targets[0].controlId === controlId2 && samePath2(targets[0].nodePath, nodePath)).map(([alias2]) => alias2);
    if (matchingAliases.length !== 1) return null;
    const alias = matchingAliases[0];
    const definition2 = runtime.controlSchema.find((control) => control.id === alias);
    const value = runtime.controls[alias];
    if (!definition2 || definition2.type !== "number" || typeof value !== "number" || !Number.isFinite(value)) return null;
    aliases[controlId2] = alias;
    values2[controlId2] = value;
  }
  const key2 = JSON.stringify({
    instanceId: runtime.instanceId,
    generation: runtime.generation,
    revisionId: runtime.revisionId,
    schemaHash: runtime.controlSchemaHash,
    nodePath,
    aliases
  });
  return Object.freeze({ nodePath, aliases: Object.freeze(aliases), values: Object.freeze(values2), controlSequence: runtime.controlSequence, key: key2 });
}
function attachPreviewCameraController(element, options) {
  const binding = cameraControllerBinding(options.getRuntime());
  if (!binding) return null;
  const schedule = options.scheduleFrame ?? ((callback) => requestAnimationFrame(callback));
  const cancel = options.cancelFrame ?? ((id3) => cancelAnimationFrame(id3));
  let values2 = { ...binding.values };
  let scheduled = null;
  let observedControlSequence = binding.controlSequence;
  let issuedSequenceFloor = binding.controlSequence;
  let optimistic = false;
  let writeVersion = 0;
  let completedWriteVersion = 0;
  let unsubmitted = false;
  let needsResync = false;
  let disposed = false;
  let active = null;
  const patch2 = (source) => Object.fromEntries(
    CAMERA_CONTROLLER_CONTROL_IDS.map((id3) => [binding.aliases[id3], source[id3]])
  );
  const report = (reason) => {
    if (!disposed && sameBinding(cameraControllerBinding(options.getRuntime()), binding)) options.onError(reason);
  };
  const acknowledge = (result, submitted, version, expectedSequence) => {
    const acknowledged = cameraControllerBinding(result);
    const acknowledgedSequence = sameBinding(acknowledged, binding) ? acknowledged.controlSequence : expectedSequence;
    observedControlSequence = Math.max(observedControlSequence, acknowledgedSequence);
    issuedSequenceFloor = Math.max(issuedSequenceFloor, acknowledgedSequence);
    completedWriteVersion = Math.max(completedWriteVersion, version);
    if (version === writeVersion && !unsubmitted && sameValues(values2, submitted) && sameBinding(acknowledged, binding)) {
      values2 = { ...acknowledged.values };
      optimistic = false;
      needsResync = false;
    }
  };
  const flush = () => {
    scheduled = null;
    if (disposed || !sameBinding(cameraControllerBinding(options.getRuntime()), binding)) return;
    const submitted = { ...values2 };
    const version = ++writeVersion;
    const expectedSequence = ++issuedSequenceFloor;
    optimistic = true;
    unsubmitted = false;
    needsResync = false;
    void options.write(patch2(submitted)).then((result) => acknowledge(result, submitted, version, expectedSequence)).catch((reason) => {
      if (version === writeVersion && sameValues(values2, submitted)) {
        optimistic = false;
        issuedSequenceFloor = observedControlSequence;
        needsResync = true;
      }
      report(reason);
    });
  };
  const queue = () => {
    optimistic = true;
    unsubmitted = true;
    if (scheduled === null) scheduled = schedule(flush);
  };
  const sync = () => {
    const live = cameraControllerBinding(options.getRuntime());
    if (!sameBinding(live, binding)) return false;
    if (live.controlSequence < observedControlSequence) return true;
    if (live.controlSequence !== observedControlSequence || needsResync) {
      const newerCompletedState = live.controlSequence > observedControlSequence && completedWriteVersion === writeVersion && !unsubmitted;
      observedControlSequence = live.controlSequence;
      issuedSequenceFloor = Math.max(issuedSequenceFloor, observedControlSequence);
      needsResync = false;
      if (sameValues(live.values, values2)) optimistic = false;
      else if (!optimistic || newerCompletedState) {
        values2 = { ...live.values };
        optimistic = false;
      }
    }
    return true;
  };
  const pointerDown = (event) => {
    if (disposed || !sync()) return;
    const eventTarget = event.target;
    if (eventTarget?.closest?.("[data-camera-controller-ignore]")) return;
    const mode = event.button === 2 || event.button === 0 && event.shiftKey ? "pan" : event.button === 0 && event.altKey ? "roll" : event.button === 0 ? "orbit" : null;
    if (!mode) return;
    event.preventDefault();
    active = { pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY };
    element.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event) => {
    if (!active || active.pointerId !== event.pointerId || disposed) return;
    const bounds = element.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    active.x = event.clientX;
    active.y = event.clientY;
    if (active.mode === "orbit") {
      values2.yaw = wrapAngle(values2.yaw - dx / width * Math.PI * 2);
      values2.pitch = clamp(values2.pitch - dy / height * Math.PI, -1.553, 1.553);
    } else if (active.mode === "pan") {
      values2.panX = clamp(values2.panX - dx / width * 2, -2, 2);
      values2.panY = clamp(values2.panY + dy / height * 2, -2, 2);
    } else {
      values2.roll = wrapAngle(values2.roll + dx / width * Math.PI * 2);
    }
    event.preventDefault();
    queue();
  };
  const endPointer = (event) => {
    if (!active || active.pointerId !== event.pointerId) return;
    active = null;
    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
    }
  };
  const wheel = (event) => {
    if (disposed || !sync()) return;
    const eventTarget = event.target;
    if (eventTarget?.closest?.("[data-camera-controller-ignore]")) return;
    const height = Math.max(1, element.getBoundingClientRect().height);
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    values2.dolly = clamp(values2.dolly + pixels / height, -0.95, 4);
    event.preventDefault();
    queue();
  };
  const contextMenu = (event) => {
    if (!disposed) event.preventDefault();
  };
  element.addEventListener("pointerdown", pointerDown);
  element.addEventListener("pointermove", pointerMove);
  element.addEventListener("pointerup", endPointer);
  element.addEventListener("pointercancel", endPointer);
  element.addEventListener("lostpointercapture", endPointer);
  element.addEventListener("wheel", wheel, { passive: false });
  element.addEventListener("contextmenu", contextMenu);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    active = null;
    if (scheduled !== null) cancel(scheduled);
    scheduled = null;
    element.removeEventListener("pointerdown", pointerDown);
    element.removeEventListener("pointermove", pointerMove);
    element.removeEventListener("pointerup", endPointer);
    element.removeEventListener("pointercancel", endPointer);
    element.removeEventListener("lostpointercapture", endPointer);
    element.removeEventListener("wheel", wheel);
    element.removeEventListener("contextmenu", contextMenu);
  };
  const reset = async () => {
    if (disposed) return;
    active = null;
    if (scheduled !== null) cancel(scheduled);
    scheduled = null;
    unsubmitted = false;
    values2 = zeros();
    if (!sameBinding(cameraControllerBinding(options.getRuntime()), binding)) return;
    const submitted = { ...values2 };
    const version = ++writeVersion;
    const expectedSequence = ++issuedSequenceFloor;
    optimistic = true;
    needsResync = false;
    try {
      const result = await options.write(patch2(submitted));
      acknowledge(result, submitted, version, expectedSequence);
    } catch (reason) {
      if (version === writeVersion && sameValues(values2, submitted)) {
        optimistic = false;
        issuedSequenceFloor = observedControlSequence;
        needsResync = true;
      }
      report(reason);
    }
  };
  return Object.freeze({ reset, dispose });
}
var CAMERA_CONTROLLER_ABI, CAMERA_CONTROLLER_CONTROL_IDS, samePath2, clamp, wrapAngle, zeros, sameBinding, sameValues;
var init_preview_camera_controller = __esm({
  "apps/studio/src/preview-camera-controller.ts"() {
    "use strict";
    CAMERA_CONTROLLER_ABI = "lux/camera-controller/v1";
    CAMERA_CONTROLLER_CONTROL_IDS = ["yaw", "pitch", "panX", "panY", "dolly", "roll"];
    samePath2 = (left, right) => left.length === right.length && left.every((id3, index) => id3 === right[index]);
    clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    wrapAngle = (value) => {
      const wrapped = ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      return Object.is(wrapped, -0) ? 0 : wrapped;
    };
    zeros = () => ({ yaw: 0, pitch: 0, panX: 0, panY: 0, dolly: 0, roll: 0 });
    sameBinding = (left, right) => left?.key === right.key;
    sameValues = (left, right) => CAMERA_CONTROLLER_CONTROL_IDS.every((id3) => left[id3] === right[id3]);
  }
});

// apps/studio/src/preview-camera-controller.css
var init_preview_camera_controller2 = __esm({
  "apps/studio/src/preview-camera-controller.css"() {
  }
});

// apps/studio/src/preview.tsx
import { useEffect as useEffect3, useRef as useRef4, useState as useState4 } from "react";
import { Button as Button4 } from "@mui/material";
import { jsx as jsx4, jsxs as jsxs5 } from "react/jsx-runtime";
function Preview({ runtime, port, moved, onDock, onError, onCameraParameters }) {
  const target = useRef4(null);
  const runtimeRef = useRef4(runtime);
  runtimeRef.current = runtime;
  const cameraWriteRef = useRef4(onCameraParameters);
  cameraWriteRef.current = onCameraParameters;
  const errorRef = useRef4(onError);
  errorRef.current = onError;
  const cameraRef = useRef4(null);
  const portRef2 = useRef4(port);
  portRef2.current = port;
  const bindingRef = useRef4(null);
  if (!bindingRef.current) bindingRef.current = new PreviewBinding({ attach: (request) => {
    if (!portRef2.current) return Promise.reject(Error("Presentation service unavailable"));
    return portRef2.current.attach(request);
  } });
  const [state, setState] = useState4("waiting");
  const [error, setError] = useState4(null);
  useEffect3(() => {
    if (!runtime || !port || moved || !target.current) {
      setState("waiting");
      return;
    }
    let active = true;
    const binding = bindingRef.current;
    setState("attaching");
    setError(null);
    void binding.move(target.current, { instanceId: runtime.instanceId, generation: runtime.generation }).then(() => {
      if (active) setState("attached");
    }).catch((reason) => {
      if (active) {
        setState("failed");
        setError(String(reason));
      }
    });
    return () => {
      active = false;
      void binding.close().catch((reason) => {
        onError(`Preview consumer detach failed: ${String(reason)}`);
      });
    };
  }, [runtime?.instanceId, runtime?.generation, port, moved, onError]);
  const cameraBinding = cameraControllerBinding(runtime);
  useEffect3(() => {
    cameraRef.current?.dispose();
    cameraRef.current = null;
    if (!cameraBinding || state !== "attached" || moved || !target.current || !cameraWriteRef.current) return;
    const control = attachPreviewCameraController(target.current, {
      getRuntime: () => runtimeRef.current,
      write: (values2) => cameraWriteRef.current(values2),
      onError: (reason) => errorRef.current(reason instanceof Error ? reason.message : String(reason))
    });
    cameraRef.current = control;
    return () => {
      control?.dispose();
      if (cameraRef.current === control) cameraRef.current = null;
    };
  }, [cameraBinding?.key, state, moved]);
  const output = runtime?.output ?? DEFAULT_OUTPUT;
  return /* @__PURE__ */ jsxs5("div", { className: "preview-area", children: [
    /* @__PURE__ */ jsxs5(
      "div",
      {
        className: `preview-surface${cameraBinding && state === "attached" && !moved ? " camera-controller-active" : ""}`,
        ref: target,
        "aria-label": "Final authoring output",
        "data-output-width": output.width,
        "data-output-height": output.height,
        "data-camera-controller": cameraBinding && state === "attached" && !moved ? "enabled" : void 0,
        children: [
          state !== "attached" && /* @__PURE__ */ jsxs5("div", { className: "preview-empty", children: [
            /* @__PURE__ */ jsx4("div", { className: "preview-mark", "aria-hidden": "true", children: "L" }),
            /* @__PURE__ */ jsx4("h1", { children: moved ? "Preview in separate window" : state === "attaching" ? "Attaching preview" : state === "failed" ? "Preview unavailable" : "Awaiting runtime" }),
            /* @__PURE__ */ jsx4("p", { children: moved ? "Your authoring instance stays with the service." : error ?? "Completed output will appear here when the authoring service connects." }),
            moved ? /* @__PURE__ */ jsx4(Button4, { onClick: onDock, children: "Return preview here" }) : /* @__PURE__ */ jsx4("span", { className: "empty-caption", children: "FINAL OUTPUT \xB7 FIT TO VIEW" })
          ] }),
          cameraBinding && state === "attached" && !moved && /* @__PURE__ */ jsx4(
            Button4,
            {
              className: "preview-camera-reset",
              size: "small",
              variant: "outlined",
              "aria-label": "Reset Camera",
              title: "Left drag: orbit \xB7 Shift-left or right drag: pan \xB7 Wheel: dolly \xB7 Alt-left drag: roll",
              "data-camera-controller-ignore": true,
              onClick: () => void cameraRef.current?.reset(),
              children: "Reset Camera"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs5("div", { className: "preview-caption", children: [
      /* @__PURE__ */ jsxs5("span", { children: [
        runtime ? "Output" : "Reference output",
        " ",
        /* @__PURE__ */ jsxs5("b", { children: [
          output.width,
          " \xD7 ",
          output.height
        ] })
      ] }),
      /* @__PURE__ */ jsx4("span", { children: "Fit \xB7 render scale 1.0" })
    ] })
  ] });
}
var init_preview = __esm({
  "apps/studio/src/preview.tsx"() {
    "use strict";
    init_src2();
    init_presentation();
    init_preview_camera_controller();
    init_preview_camera_controller2();
  }
});

// apps/studio/src/story/StoryPanel.tsx
var StoryPanel_exports = {};
__export(StoryPanel_exports, {
  StoryPanel: () => StoryPanel,
  storyStatusLabel: () => storyStatusLabel
});
import { useEffect as useEffect4, useRef as useRef5, useState as useState5 } from "react";
import { Button as Button5, FormControlLabel as FormControlLabel2, Switch as Switch2, Tooltip as Tooltip2 } from "@mui/material";
import { Fragment as Fragment2, jsx as jsx5, jsxs as jsxs6 } from "react/jsx-runtime";
function storyStatusLabel(status) {
  if (!status) return "Unavailable";
  const frame = "scheduleHash" in status ? status.committed?.frame : status.frame;
  if (!frame) return "scheduleHash" in status && status.pendingPreparation ? `Preparing ${status.pendingPreparation.visualId}` : "Preparing Story";
  if (frame.state === "normal") return "Normal";
  if (status.sequence.state === "ended") return "Sequence ended";
  if (status.sequence.awaitingCue) return "Awaiting cue";
  return status.definition.beats.find((beat) => beat.id === frame.beatId)?.label ?? frame.beatId;
}
function StoryPanel({ status: statusInput, available, controller, onError, previewPlayback }) {
  const schedule = statusInput && "scheduleHash" in statusInput ? statusInput : void 0, frame = scheduleFrame(statusInput);
  const preparationFailure = schedule?.preparationFailure, preparationFailureMessage = preparationFailure ? `Could not prepare source ${preparationFailure.visualId}${preparationFailure.beatId ? ` for ${schedule.definition.beats.find((beat) => beat.id === preparationFailure.beatId)?.label ?? preparationFailure.beatId}` : ""}. ${preparationFailure.message}` : void 0;
  const activeBeatId = frame?.state === "active" ? frame.beatId : null;
  const [selectedBeatId, setSelectedBeatId] = useState5(activeBeatId ?? statusInput?.definition.beats[0]?.id ?? null);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState5(statusInput?.sequence.occurrenceId ?? statusInput?.definition.sequence[0]?.id ?? null);
  const [pending, setPending] = useState5(null), [retry, setRetry] = useState5(null), commandInFlight = useRef5(false);
  const currentStatus = useRef5(statusInput);
  currentStatus.current = statusInput;
  const scrub = useRef5({ inFlight: false, queued: null, revision: statusInput?.storyRevision ?? 0, lastAcknowledged: frame?.state === "active" ? frame.localTimeSeconds ?? 0 : 0, identity: frame?.state === "active" ? `${frame.beatId}:${frame.activationId}` : "" });
  const scrubGeneration = useRef5(0), pointerGesture = useRef5({ active: false, cancelled: false });
  const [scrubValue, setScrubValue] = useState5(scrub.current.lastAcknowledged), [scrubBusy, setScrubBusy] = useState5(false);
  useEffect4(() => {
    if (!statusInput) return;
    if (!statusInput.definition.beats.some((beat) => beat.id === selectedBeatId)) setSelectedBeatId(activeBeatId ?? statusInput.definition.beats[0]?.id ?? null);
    if (!statusInput.definition.sequence.some((row) => row.id === selectedOccurrenceId)) setSelectedOccurrenceId(statusInput.sequence.occurrenceId ?? statusInput.definition.sequence[0]?.id ?? null);
  }, [statusInput?.storyHash, activeBeatId, selectedBeatId, selectedOccurrenceId]);
  useEffect4(() => {
    const identity = frame?.state === "active" ? `${frame.beatId}:${frame.activationId}` : "";
    if (identity !== scrub.current.identity) {
      scrubGeneration.current++;
      scrub.current = { inFlight: false, queued: null, revision: statusInput?.storyRevision ?? 0, lastAcknowledged: frame?.state === "active" ? frame.localTimeSeconds ?? 0 : 0, identity };
      pointerGesture.current = { active: false, cancelled: false };
      setScrubBusy(false);
      setRetry((current) => current?.kind === "seek" ? null : current);
    }
    if (statusInput && !scrub.current.inFlight) {
      scrub.current.revision = statusInput.storyRevision;
      if (frame?.state === "active" && frame.localTimeSeconds !== null) {
        scrub.current.lastAcknowledged = frame.localTimeSeconds;
        setScrubValue(frame.localTimeSeconds);
      }
    }
  }, [statusInput?.storyRevision, frame]);
  if (!statusInput) return /* @__PURE__ */ jsxs6("section", { className: "story-panel story-unavailable", "aria-label": "Story", children: [
    /* @__PURE__ */ jsx5("h2", { children: "Story" }),
    /* @__PURE__ */ jsx5("p", { className: "hint", children: "Build a Story-aware visual to use beat transport." })
  ] });
  if (!frame) return /* @__PURE__ */ jsxs6("section", { className: "story-panel", "aria-label": "Story", children: [
    /* @__PURE__ */ jsxs6("header", { className: "story-header", children: [
      /* @__PURE__ */ jsxs6("div", { children: [
        /* @__PURE__ */ jsx5("span", { className: "eyebrow", children: "STORY" }),
        /* @__PURE__ */ jsx5("h2", { children: storyStatusLabel(statusInput) })
      ] }),
      /* @__PURE__ */ jsx5("span", { className: "story-state", children: "Preparing" })
    ] }),
    preparationFailureMessage && /* @__PURE__ */ jsx5("p", { className: "story-preparation-failure", role: "alert", children: preparationFailureMessage }),
    schedule?.pendingPreparation && /* @__PURE__ */ jsxs6("p", { role: "status", children: [
      schedule.pendingPreparation.phase === "ready" ? "Ready to show" : "Preparing",
      " source ",
      schedule.pendingPreparation.visualId,
      "."
    ] }),
    Object.values(statusInput.disabledReasons).find((reason) => /CAPACITY|RESOURCE|SLOT/i.test(reason.code)) && /* @__PURE__ */ jsx5("p", { className: "hint", children: Object.values(statusInput.disabledReasons).find((reason) => /CAPACITY|RESOURCE|SLOT/i.test(reason.code)).message })
  ] });
  const status = schedule ? Object.assign({}, schedule, { frame, resumeCandidates: Object.freeze([]) }) : statusInput;
  const beats = new Map(status.definition.beats.map((beat) => [beat.id, beat])), activeBeat = activeBeatId ? beats.get(activeBeatId) : void 0, selectedBeat = selectedBeatId ? beats.get(selectedBeatId) : void 0;
  const selectedOccurrence = status.definition.sequence.find((row) => row.id === selectedOccurrenceId), selectedOccurrenceIndex = selectedOccurrence ? status.definition.sequence.findIndex((row) => row.id === selectedOccurrence.id) : -1;
  const disabled = (action) => status.disabledReasons[action]?.message;
  const capabilityFor = (visualId, beatId) => visualId && beatId ? schedule?.visualCapabilities.find((row) => row.visualId === visualId)?.storyCapability?.beats.find((beat) => beat.id === beatId) : void 0;
  const capabilityReason = (visualId, beatId) => schedule && !capabilityFor(visualId, beatId) ? `Source ${visualId ?? "unknown"} does not expose ${beatId ?? "this beat"}.` : void 0;
  const activeVisualId = schedule?.committed?.visualId, activeSeekReason = schedule && activeBeat?.timing.kind === "timed" && capabilityFor(activeVisualId, activeBeat.id)?.seek !== "direct" ? `Source ${activeVisualId} does not support direct seek for ${activeBeat.label}.` : void 0;
  const capacityReason = Object.values(status.disabledReasons).find((reason) => /CAPACITY|RESOURCE|SLOT/i.test(reason.code));
  async function runAction(action, label, retryIntent) {
    if (commandInFlight.current || scrub.current.inFlight || !available) return;
    const reason = disabled(actionKey(action));
    if (reason) {
      onError(reason);
      return;
    }
    const intent = retryIntent ?? { action, commandId: crypto.randomUUID(), revision: currentStatus.current.storyRevision, label, kind: "command" };
    commandInFlight.current = true;
    setPending(label);
    setRetry(null);
    try {
      await controller.storyTransport(intent.action, intent.commandId, intent.revision);
    } catch (error) {
      if (isUncertainStoryError(error)) setRetry(intent);
      onError(errorText(error));
    } finally {
      commandInFlight.current = false;
      setPending(null);
    }
  }
  async function sendSeek(target, revision, commandId = crypto.randomUUID()) {
    if (!available || commandInFlight.current) return;
    const identity = scrub.current.identity, generation = scrubGeneration.current, intent = { action: { action: "seek", localTimeSeconds: target }, commandId, revision, label: `seek to ${seconds(target)}`, kind: "seek" };
    scrub.current.inFlight = true;
    setScrubBusy(true);
    setRetry(null);
    let next = null;
    try {
      const result = await controller.storyTransport(intent.action, intent.commandId, intent.revision);
      const acknowledged = result.currentStatus, frame2 = scheduleFrame(acknowledged), ackIdentity = frame2?.state === "active" ? `${frame2.beatId}:${frame2.activationId}` : "";
      if (generation !== scrubGeneration.current || scrub.current.identity !== identity || ackIdentity !== identity) return;
      scrub.current.revision = acknowledged.storyRevision;
      if (frame2?.state === "active" && frame2.localTimeSeconds !== null) {
        scrub.current.lastAcknowledged = frame2.localTimeSeconds;
        setScrubValue(frame2.localTimeSeconds);
      }
      next = scrub.current.queued;
      scrub.current.queued = null;
    } catch (error) {
      if (generation !== scrubGeneration.current || scrub.current.identity !== identity) return;
      scrub.current.queued = null;
      const latest = currentStatus.current, latestFrame = scheduleFrame(latest), latestIdentity = latestFrame?.state === "active" ? `${latestFrame.beatId}:${latestFrame.activationId}` : "";
      if (latest && latestIdentity === identity) {
        scrub.current.revision = latest.storyRevision;
        if (latestFrame?.state === "active" && latestFrame.localTimeSeconds !== null) {
          scrub.current.lastAcknowledged = latestFrame.localTimeSeconds;
          setScrubValue(latestFrame.localTimeSeconds);
        }
      } else setScrubValue(scrub.current.lastAcknowledged);
      if (isUncertainStoryError(error)) setRetry(intent);
      onError(errorText(error));
    } finally {
      if (generation !== scrubGeneration.current || scrub.current.identity !== identity) return;
      scrub.current.inFlight = false;
      setScrubBusy(false);
      if (next !== null && next !== scrub.current.lastAcknowledged) void sendSeek(next, scrub.current.revision);
    }
  }
  function queueSeek(value) {
    if (commandInFlight.current) return;
    setScrubValue(value);
    if (scrub.current.inFlight) scrub.current.queued = value;
    else void sendSeek(value, scrub.current.revision);
  }
  function retryLast() {
    if (!retry) return;
    if (retry.kind === "seek") void sendSeek(retry.action.localTimeSeconds, retry.revision, retry.commandId);
    else void runAction(retry.action, retry.label, retry);
  }
  const blocked = !available || !!pending || scrubBusy;
  const selectedMoveAction = selectedOccurrence ? status.frame.state === "active" && status.sequence.state === "detached" ? { action: "resume", occurrenceId: selectedOccurrence.id } : { action: "start", occurrenceId: selectedOccurrence.id } : void 0;
  const selectedOccurrenceVisual = selectedOccurrence && "visualId" in selectedOccurrence ? selectedOccurrence.visualId : void 0;
  const selectedMoveReason = selectedMoveAction ? capabilityReason(selectedOccurrenceVisual, selectedOccurrence?.beatId) ?? disabled(selectedMoveAction.action) : void 0;
  return /* @__PURE__ */ jsxs6("section", { className: "story-panel", "aria-label": "Story", children: [
    /* @__PURE__ */ jsxs6("header", { className: "story-header", children: [
      /* @__PURE__ */ jsxs6("div", { className: "story-heading", children: [
        /* @__PURE__ */ jsx5("h2", { title: storyStatusLabel(status), children: storyStatusLabel(status) }),
        /* @__PURE__ */ jsx5("span", { className: `story-state story-state-${status.frame.state}`, children: status.frame.state === "normal" ? "Normal" : status.phase === "running" ? "Running" : "Paused" })
      ] }),
      /* @__PURE__ */ jsxs6("div", { className: "story-primary-actions", children: [
        status.definition.sequence.length > 0 && status.frame.state === "normal" && /* @__PURE__ */ jsx5(Button5, { variant: "contained", disabled: blocked || !!disabled("start"), title: disabled("start"), onClick: () => void runAction({ action: "start" }, "start story"), children: "Start story" }),
        status.frame.state === "active" && /* @__PURE__ */ jsxs6(Fragment2, { children: [
          /* @__PURE__ */ jsx5(Button5, { disabled: blocked || !!disabled(status.phase === "running" ? "pause" : "play"), title: disabled(status.phase === "running" ? "pause" : "play"), onClick: () => void runAction({ action: status.phase === "running" ? "pause" : "play" }, status.phase === "running" ? "pause story" : "play story"), children: status.phase === "running" ? "Pause story" : "Play story" }),
          /* @__PURE__ */ jsx5(Button5, { disabled: blocked || !!disabled("return-normal"), title: disabled("return-normal"), onClick: () => void runAction({ action: "return-normal" }, "return to normal"), children: "Return to normal" })
        ] })
      ] }),
      status.frame.state === "active" && status.sequence.state !== "detached" && /* @__PURE__ */ jsxs6("div", { className: "story-follow-actions", children: [
        /* @__PURE__ */ jsx5(Tooltip2, { title: disabled("set-auto-advance") ?? "", children: /* @__PURE__ */ jsx5("span", { children: /* @__PURE__ */ jsx5(FormControlLabel2, { label: "Auto-advance", control: /* @__PURE__ */ jsx5(Switch2, { size: "small", checked: status.autoAdvance, disabled: blocked || !!disabled("set-auto-advance"), slotProps: { input: { "aria-label": "Auto-advance" } }, onChange: (event) => void runAction({ action: "set-auto-advance", enabled: event.target.checked }, event.target.checked ? "enable auto-advance" : "disable auto-advance") }) }) }) }),
        /* @__PURE__ */ jsx5(Button5, { disabled: blocked || !!disabled("advance"), title: disabled("advance"), onClick: () => void runAction({ action: "advance" }, "advance story"), children: "Advance" })
      ] })
    ] }),
    retry && /* @__PURE__ */ jsxs6("div", { className: "story-retry", role: "alert", children: [
      /* @__PURE__ */ jsx5("span", { children: "The last Story command may still have applied." }),
      /* @__PURE__ */ jsxs6(Button5, { size: "small", onClick: retryLast, children: [
        "Retry ",
        retry.label
      ] })
    ] }),
    preparationFailureMessage && /* @__PURE__ */ jsx5("p", { className: "story-preparation-failure", role: "alert", children: preparationFailureMessage }),
    schedule?.pendingPreparation && /* @__PURE__ */ jsxs6("p", { className: "story-preparation", role: "status", children: [
      schedule.pendingPreparation.phase === "ready" ? "Ready to show" : "Preparing",
      " source ",
      schedule.pendingPreparation.visualId,
      schedule.pendingPreparation.beatId ? ` for ${beats.get(schedule.pendingPreparation.beatId)?.label ?? schedule.pendingPreparation.beatId}` : "",
      "."
    ] }),
    schedule?.outgoing && schedule.crossfadeProgress !== null && /* @__PURE__ */ jsxs6("p", { className: "story-crossfade", role: "status", children: [
      "Transitioning from source ",
      schedule.outgoing.visualId,
      " to ",
      schedule.committed?.visualId,
      " \xB7 ",
      Math.round(schedule.crossfadeProgress * 100),
      "%"
    ] }),
    capacityReason && /* @__PURE__ */ jsx5("p", { className: "hint", children: capacityReason.message }),
    status.definition.sequence.length > 0 && /* @__PURE__ */ jsxs6("section", { className: "story-sequence", "aria-labelledby": "story-sequence-heading", children: [
      /* @__PURE__ */ jsxs6("div", { className: "story-section-heading", children: [
        /* @__PURE__ */ jsxs6("h3", { id: "story-sequence-heading", children: [
          "Sequence ",
          /* @__PURE__ */ jsxs6("span", { className: "story-count", children: [
            status.definition.sequence.length,
            " steps"
          ] })
        ] }),
        /* @__PURE__ */ jsx5("span", { children: status.sequence.state === "detached" ? "Detached" : status.sequence.state === "ended" ? "Ended" : "Attached" })
      ] }),
      /* @__PURE__ */ jsx5("ol", { className: "story-ribbon", "aria-label": "Story sequence", children: status.definition.sequence.map((occurrence, index) => {
        const beat = beats.get(occurrence.beatId), name2 = `${beat?.label ?? occurrence.beatId} \u2014 occurrence ${index + 1} of ${status.definition.sequence.length}`, current = status.sequence.occurrenceId === occurrence.id && status.sequence.state !== "detached", selected = selectedOccurrenceId === occurrence.id, after2 = occurrence.follow.kind === "after", progress = current && after2 ? Math.min(100, Math.max(0, status.sequence.dwellElapsedSeconds / occurrence.follow.seconds * 100)) : 0;
        return /* @__PURE__ */ jsxs6("li", { className: `${selected ? "story-occurrence-selected " : ""}${current ? "story-occurrence-current " : ""}${after2 ? "story-occurrence-timed" : "story-occurrence-manual"}`, style: { "--story-dwell-weight": after2 ? Math.min(4, Math.max(1, occurrence.follow.seconds / 4)) : 1, "--story-progress": `${progress}%` }, children: [
          /* @__PURE__ */ jsxs6("button", { type: "button", title: `${name2} \xB7 ${occurrence.id}${"visualId" in occurrence ? ` \xB7 source ${occurrence.visualId}` : ""} \xB7 ${after2 ? `${seconds(occurrence.follow.seconds)} dwell` : "Manual cue"}`, "aria-label": `${name2} \xB7 ${occurrence.id}`, "aria-description": after2 ? `${seconds(occurrence.follow.seconds)} dwell` : "Manual cue", "aria-pressed": selected, "aria-current": current ? "step" : void 0, onClick: () => setSelectedOccurrenceId(occurrence.id), children: [
            /* @__PURE__ */ jsx5("span", { children: beat?.label ?? occurrence.beatId }),
            /* @__PURE__ */ jsxs6("small", { children: [
              index + 1,
              "visualId" in occurrence ? ` \xB7 ${occurrence.visualId}` : ""
            ] }),
            /* @__PURE__ */ jsx5("span", { className: "story-occurrence-timing", children: after2 ? seconds(occurrence.follow.seconds) : "Manual cue" }),
            current && /* @__PURE__ */ jsx5("i", { "aria-hidden": "true", className: "story-cursor" })
          ] }),
          current && after2 && /* @__PURE__ */ jsxs6(Fragment2, { children: [
            /* @__PURE__ */ jsx5("span", { className: "story-dwell-progress", role: "progressbar", "aria-label": `Dwell for ${name2}`, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(progress), children: /* @__PURE__ */ jsx5("i", { style: { width: `${progress}%` } }) }),
            /* @__PURE__ */ jsx5("small", { className: "story-dwell-label", children: status.sequence.dwellRemainingSeconds === null ? "Dwell" : `${seconds(status.sequence.dwellRemainingSeconds)} remaining` })
          ] }),
          current && !after2 && /* @__PURE__ */ jsx5("small", { className: "story-dwell-label", children: "Awaiting cue" })
        ] }, occurrence.id);
      }) }),
      /* @__PURE__ */ jsxs6("div", { className: "story-selection", children: [
        selectedOccurrence && /* @__PURE__ */ jsxs6("span", { className: "story-selected-detail", title: selectedOccurrence.id, children: [
          "Selected ",
          selectedOccurrenceIndex + 1,
          " \xB7 ",
          beats.get(selectedOccurrence.beatId)?.label ?? selectedOccurrence.beatId,
          selectedOccurrenceVisual ? ` \xB7 ${selectedOccurrenceVisual}` : ""
        ] }),
        selectedOccurrence && selectedMoveAction && /* @__PURE__ */ jsx5(Button5, { "aria-label": `${selectedMoveAction.action === "resume" ? "Resume here" : "Start here"}: ${beats.get(selectedOccurrence.beatId)?.label ?? selectedOccurrence.beatId} \u2014 occurrence ${selectedOccurrenceIndex + 1} of ${status.definition.sequence.length}`, className: "story-start-here", disabled: blocked || !!selectedMoveReason, title: selectedMoveReason, onClick: () => void runAction(selectedMoveAction, `${selectedMoveAction.action === "resume" ? "resume" : "start"} here`), children: selectedMoveAction.action === "resume" ? "Resume here" : "Start here" }),
        status.frame.state === "active" && status.sequence.state === "detached" && status.resumeCandidates.length === 1 && /* @__PURE__ */ jsx5(Button5, { disabled: blocked || !!disabled("resume"), title: disabled("resume"), onClick: () => void runAction({ action: "resume", occurrenceId: status.resumeCandidates[0] }, "resume story"), children: "Resume story" })
      ] })
    ] }),
    status.frame.state === "active" && /* @__PURE__ */ jsxs6("div", { className: "story-active-summary", children: [
      /* @__PURE__ */ jsxs6("div", { className: "story-transition", "aria-live": "polite", children: [
        /* @__PURE__ */ jsxs6("strong", { children: [
          "Live: ",
          activeBeat?.label ?? status.frame.beatId
        ] }),
        activeVisualId && /* @__PURE__ */ jsxs6("span", { children: [
          "Source ",
          activeVisualId
        ] }),
        /* @__PURE__ */ jsx5("span", { children: status.phase === "running" ? "Running" : "Paused" }),
        activeBeat?.timing.kind === "sustained" && /* @__PURE__ */ jsx5("span", { children: "Staying on beat" }),
        status.sequence.awaitingCue && /* @__PURE__ */ jsx5("span", { children: "Awaiting cue" }),
        status.sequence.state === "ended" && /* @__PURE__ */ jsx5("span", { children: "Sequence ended" }),
        status.phase === "running" && previewPlayback && previewPlayback !== "playing" && /* @__PURE__ */ jsx5("span", { children: "Story ready \xB7 Preview paused" }),
        status.sequence.state !== "detached" && !status.autoAdvance && /* @__PURE__ */ jsx5("span", { children: "Auto-advance off" }),
        status.sequence.nextOccurrenceId && /* @__PURE__ */ jsxs6("span", { children: [
          "Next: ",
          beats.get(status.definition.sequence.find((row) => row.id === status.sequence.nextOccurrenceId)?.beatId ?? "")?.label ?? status.sequence.nextOccurrenceId
        ] })
      ] }),
      /* @__PURE__ */ jsxs6("span", { children: [
        seconds(status.frame.elapsedSeconds),
        " active"
      ] })
    ] }),
    status.frame.state === "active" && activeBeat?.timing.kind === "timed" && /* @__PURE__ */ jsxs6("section", { className: "story-local-time", "aria-label": "Timed beat position", children: [
      /* @__PURE__ */ jsxs6("div", { children: [
        /* @__PURE__ */ jsx5("strong", { children: activeBeat.label }),
        /* @__PURE__ */ jsxs6("span", { children: [
          seconds(scrubValue),
          " / ",
          seconds(activeBeat.timing.durationSeconds)
        ] })
      ] }),
      /* @__PURE__ */ jsx5("input", { type: "range", "aria-label": `Local time for ${activeBeat.label}`, title: activeSeekReason ?? disabled("seek"), min: 0, max: activeBeat.timing.durationSeconds, step: activeBeat.timing.durationSeconds / 100 || Number.MIN_VALUE, value: scrubValue, disabled: !available || !!pending || !!activeSeekReason || !!disabled("seek"), onPointerDown: (event) => {
        pointerGesture.current = { active: true, cancelled: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }, onPointerUp: (event) => {
        pointerGesture.current = { active: false, cancelled: false };
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }, onPointerCancel: () => {
        pointerGesture.current = { active: false, cancelled: false };
      }, onChange: (event) => {
        if (!pointerGesture.current.cancelled) queueSeek(Number(event.target.value));
      }, onKeyDown: (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          scrub.current.queued = null;
          if (pointerGesture.current.active) pointerGesture.current.cancelled = true;
          setScrubValue(scrub.current.lastAcknowledged);
        }
      } }),
      /* @__PURE__ */ jsxs6("div", { children: [
        /* @__PURE__ */ jsx5(Button5, { "aria-label": `Replay ${activeBeat.label}`, disabled: blocked || !!disabled("replay"), onClick: () => void runAction({ action: "replay", beatId: activeBeat.id }, `replay ${activeBeat.label}`), children: "Replay" }),
        /* @__PURE__ */ jsx5(Button5, { "aria-label": `Loop ${activeBeat.label}`, disabled: blocked || !!disabled("loop"), "aria-pressed": status.loop, onClick: () => void runAction({ action: "loop", beatId: activeBeat.id }, `loop ${activeBeat.label}`), children: "Loop" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs6("section", { className: "story-beats", "aria-labelledby": "story-beats-heading", children: [
      /* @__PURE__ */ jsx5("h3", { id: "story-beats-heading", children: "Launch beat" }),
      /* @__PURE__ */ jsx5("ul", { children: status.definition.beats.map((beat) => {
        const active = activeBeatId === beat.id, selected = selectedBeatId === beat.id, visualId = "visualId" in beat ? beat.visualId : void 0, sourceReason = capabilityReason(visualId, beat.id), capability = capabilityFor(visualId, beat.id);
        return /* @__PURE__ */ jsxs6("li", { className: `${active ? "story-beat-active " : ""}${selected ? "story-beat-selected" : ""}`, children: [
          /* @__PURE__ */ jsxs6("button", { type: "button", className: "story-beat-select", "aria-pressed": selected, "aria-current": active ? "true" : void 0, onClick: () => setSelectedBeatId(beat.id), children: [
            /* @__PURE__ */ jsx5("span", { title: beat.label, children: beat.label }),
            /* @__PURE__ */ jsxs6("small", { title: beat.id, children: [
              beat.timing.kind === "sustained" ? "Sustained" : seconds(beat.timing.durationSeconds),
              " \xB7 ",
              beat.id,
              visualId ? ` \xB7 source ${visualId}${capability ? ` \xB7 ${capability.kind}` : ""}` : ""
            ] })
          ] }),
          /* @__PURE__ */ jsx5(Button5, { "aria-label": `Launch ${beat.label}`, className: "story-launch", disabled: blocked || !!sourceReason || !!disabled("launch"), title: sourceReason ?? disabled("launch") ?? `Launch ${beat.label}`, onClick: () => void runAction({ action: "launch", beatId: beat.id }, `launch ${beat.label}`), children: /* @__PURE__ */ jsx5("span", { "aria-hidden": "true", children: "\u25B6" }) })
        ] }, beat.id);
      }) })
    ] }),
    selectedBeat && selectedBeat.id !== activeBeat?.id && selectedBeat.timing.kind === "timed" && /* @__PURE__ */ jsxs6("p", { className: "hint", children: [
      selectedBeat.label,
      " is timed (",
      seconds(selectedBeat.timing.durationSeconds),
      "). Launch it to scrub its local time."
    ] })
  ] });
}
var actionKey, errorText, seconds, scheduleFrame;
var init_StoryPanel = __esm({
  "apps/studio/src/story/StoryPanel.tsx"() {
    "use strict";
    init_service_client();
    actionKey = (action) => action.action;
    errorText = (error) => error instanceof Error ? error.message : String(error);
    seconds = (value) => {
      const safe2 = Math.max(0, value);
      return safe2 > 0 && safe2 < 1 ? `${Number((safe2 * 1e3).toPrecision(3))}ms` : `${safe2.toFixed(1)}s`;
    };
    scheduleFrame = (status) => status && ("scheduleHash" in status ? status.committed?.frame : status.frame);
  }
});

// apps/studio/src/StudioMenu.tsx
import { createContext, useContext, useId as useId2, useRef as useRef6, useState as useState6 } from "react";
import { Button as Button6, ClickAwayListener as ClickAwayListener2, MenuList, Paper as Paper2, Popper as Popper2 } from "@mui/material";
import { jsx as jsx6, jsxs as jsxs7 } from "react/jsx-runtime";
function useMenuState() {
  return useState6(null);
}
function StudioMenu({ label, children: children2, buttonRef, className = "" }) {
  const local = useMenuState();
  const [active, setActive] = useContext(MenuContext) ?? local;
  const ownRef = useRef6(null);
  const trigger = buttonRef ?? ownRef;
  const id3 = useId2();
  const open = active === id3;
  function close(restoreFocus = false) {
    setActive((current) => current === id3 ? null : current);
    if (restoreFocus) trigger.current?.focus();
  }
  function adjacent(direction) {
    const buttons = [...trigger.current?.closest("header")?.querySelectorAll("[data-studio-menu]") ?? []];
    const next = buttons[(buttons.indexOf(trigger.current) + direction + buttons.length) % buttons.length];
    if (next && next !== trigger.current) {
      next.focus();
      next.click();
    }
  }
  return /* @__PURE__ */ jsx6(ClickAwayListener2, { onClickAway: () => close(), children: /* @__PURE__ */ jsxs7("div", { className: `studio-menu ${className}`, children: [
    /* @__PURE__ */ jsx6(
      Button6,
      {
        ref: trigger,
        "data-studio-menu": true,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? id3 : void 0,
        className: "studio-menu-trigger",
        color: "inherit",
        onClick: () => setActive((current) => current === id3 ? null : id3),
        onKeyDown: (event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(id3);
          }
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            adjacent(event.key === "ArrowRight" ? 1 : -1);
          }
        },
        children: label
      }
    ),
    /* @__PURE__ */ jsx6(Popper2, { open, anchorEl: trigger.current, placement: "bottom-start", sx: { zIndex: 1300 }, children: /* @__PURE__ */ jsx6(Paper2, { className: "studio-menu-paper", children: /* @__PURE__ */ jsx6(
      MenuList,
      {
        id: id3,
        "aria-label": label,
        autoFocus: true,
        autoFocusItem: true,
        dense: true,
        onClick: (event) => {
          if (event.target.closest('[role="menuitem"]:not([aria-disabled="true"])')) close();
        },
        onKeyDown: (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }
          if (event.key === "Tab") {
            event.preventDefault();
            close(true);
          }
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            adjacent(event.key === "ArrowRight" ? 1 : -1);
          }
        },
        children: children2
      }
    ) }) })
  ] }) });
}
var MenuContext;
var init_StudioMenu = __esm({
  "apps/studio/src/StudioMenu.tsx"() {
    "use strict";
    MenuContext = createContext(null);
  }
});

// apps/studio/src/layout/registry.ts
import { z as z4 } from "zod";
function createStudioPanelRegistry(additional = []) {
  return new PanelRegistry([
    define("preview", "Preview", z4.object({ fit: z4.enum(["contain", "actual"]).optional(), zoom: z4.number().finite().min(0.1).max(8).optional() }).strict()),
    define("source", "Source", z4.object({ selectedFile: z4.string().max(240).regex(/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/).optional() }).strict()),
    define("library", "Library", z4.object({ selectedComponentId: z4.string().uuid().optional(), selectedFile: z4.string().max(240).optional() }).strict()),
    define("inspector", "Inspector", z4.object({ lockedTargetId: z4.string().min(1).max(128).nullable().optional() }).strict(), true),
    define("story", "Story", z4.object({}).strict()),
    define("diagnostics", "Diagnostics", z4.object({}).strict()),
    define("graph", "Graph", z4.object({}).strict()),
    define("jobs", "Jobs", z4.object({ filter: z4.enum(["all", "failed", "running"]).optional() }).strict()),
    ...additional
  ]);
}
var isReservedPanelKey, PanelRegistry, define;
var init_registry = __esm({
  "apps/studio/src/layout/registry.ts"() {
    "use strict";
    isReservedPanelKey = (key2) => ["__proto__", "constructor", "prototype"].includes(key2);
    PanelRegistry = class {
      definitions = /* @__PURE__ */ new Map();
      constructor(definitions) {
        for (const definition2 of definitions) {
          if (!/^[a-z][a-z0-9-]{0,31}$/.test(definition2.kind) || isReservedPanelKey(definition2.kind) || this.definitions.has(definition2.kind)) throw Error("Invalid or duplicate panel kind");
          this.definitions.set(definition2.kind, Object.freeze({ ...definition2 }));
        }
      }
      list() {
        return [...this.definitions.values()];
      }
      get(kind) {
        const value = this.definitions.get(kind);
        if (!value) throw Error("Unavailable panel: " + kind);
        return value;
      }
    };
    define = (kind, title, schema3, multiple = false) => ({
      kind,
      title,
      multiple,
      parseViewState: (value) => schema3.parse(value ?? {})
    });
  }
});

// apps/studio/src/layout/personal-layout.ts
import { z as z5 } from "zod";
function validatePersonalLayout(value, registry) {
  const stack = [{ value, depth: 0 }];
  let entries2 = 0;
  while (stack.length) {
    const item = stack.pop();
    if (++entries2 > 4096 || item.depth > 32) throw Error("Layout is too complex");
    if (["function", "symbol", "bigint"].includes(typeof item.value) || typeof item.value === "number" && !Number.isFinite(item.value)) throw Error("Layout must contain JSON data");
    if (item.value && typeof item.value === "object") for (const [key2, child] of Object.entries(item.value)) {
      if (["__proto__", "constructor", "prototype"].includes(key2)) throw Error("Unsafe layout key");
      stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  const result = schema2.parse(value);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > LAYOUT_BYTE_LIMIT) throw Error("Layout exceeds 128 KiB");
  if (Object.keys(result.dock.panels).length + Object.keys(result.closedPanels).length > 32) throw Error("Too many panels");
  const counts = /* @__PURE__ */ new Map(), seenPanels = /* @__PURE__ */ new Set(), seenGroups = /* @__PURE__ */ new Set();
  for (const [panelId, record5] of [...Object.entries(result.dock.panels), ...Object.entries(result.closedPanels)]) {
    if (record5.id !== panelId) throw Error("Panel identity mismatch");
    const definition2 = registry.get(record5.contentComponent), count = (counts.get(definition2.kind) ?? 0) + 1;
    if (!definition2.multiple && count > 1) throw Error("Duplicate singleton panel: " + definition2.kind);
    counts.set(definition2.kind, count);
    if ((record5.minimumWidth ?? 0) > (record5.maximumWidth ?? 32768) || (record5.minimumHeight ?? 0) > (record5.maximumHeight ?? 32768)) throw Error("Inconsistent panel size constraints");
    record5.params = { viewState: definition2.parseViewState(record5.params?.viewState) };
    record5.title = definition2.title;
    record5.renderer = "always";
  }
  if (Object.keys(result.closedPanels).some((panelId) => Object.hasOwn(result.dock.panels, panelId))) throw Error("Panel is both open and closed");
  function walk(current, depth) {
    if (depth > 12) throw Error("Layout grid is too deep");
    if (current.type === "branch") {
      for (const child of current.data) walk(child, depth + 1);
      return;
    }
    if (seenGroups.has(current.data.id)) throw Error("Duplicate group identity");
    seenGroups.add(current.data.id);
    for (const panelId of current.data.views) {
      if (!Object.hasOwn(result.dock.panels, panelId) || seenPanels.has(panelId)) throw Error("Invalid panel reference");
      seenPanels.add(panelId);
    }
    if (current.data.activeView && !current.data.views.includes(current.data.activeView)) throw Error("Invalid active panel");
  }
  walk(result.dock.grid.root, 0);
  if (seenPanels.size !== Object.keys(result.dock.panels).length) throw Error("Unreachable panel");
  if (result.dock.activeGroup && !seenGroups.has(result.dock.activeGroup)) throw Error("Invalid active group");
  return result;
}
function parsePersonalLayout(text3, registry) {
  if (new TextEncoder().encode(text3).byteLength > LAYOUT_BYTE_LIMIT) throw Error("Layout exceeds 128 KiB");
  return validatePersonalLayout(JSON.parse(text3), registry);
}
function defaultPersonalLayout(registry, mode) {
  const panels = Object.fromEntries(["preview", "source", "graph", "library", "inspector", "diagnostics", "jobs"].map((kind) => [kind, { id: kind, contentComponent: kind, title: registry.get(kind).title, renderer: "always", params: { viewState: {} } }]));
  const leaf = (id3, views, size2) => ({ type: "leaf", size: size2, data: { id: id3, views, activeView: views[0] } });
  const root = mode === "laptop" ? { type: "branch", data: [leaf("workspace", Object.keys(panels), 900)] } : {
    type: "branch",
    data: [
      { type: "branch", size: 1200, data: [
        { type: "branch", size: 600, data: [leaf("source-group", ["source", "library"], 400), leaf("preview-group", ["preview"], 800)] },
        leaf("jobs-group", ["graph", "jobs", "diagnostics"], 300)
      ] },
      leaf("inspector-group", ["inspector"], 240)
    ]
  };
  return validatePersonalLayout({
    format: "lux-personal-layout",
    version: 1,
    dockviewVersion: DOCKVIEW_VERSION,
    name: mode === "desktop" ? "Desktop" : "Laptop",
    dock: { grid: { root, width: mode === "desktop" ? 1440 : 900, height: 900, orientation: "HORIZONTAL" }, panels, activeGroup: mode === "desktop" ? "preview-group" : "workspace" }
  }, registry);
}
var DOCKVIEW_VERSION, LAYOUT_BYTE_LIMIT, id2, size, group, node, panel, schema2;
var init_personal_layout = __esm({
  "apps/studio/src/layout/personal-layout.ts"() {
    "use strict";
    DOCKVIEW_VERSION = "7.0.4";
    LAYOUT_BYTE_LIMIT = 131072;
    id2 = z5.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
    size = z5.number().finite().min(0).max(32768);
    group = z5.object({
      id: id2,
      views: z5.array(id2).min(1).max(32),
      activeView: id2.optional(),
      locked: z5.literal(false).optional(),
      hideHeader: z5.literal(false).optional(),
      headerPosition: z5.enum(["top", "bottom", "left", "right"]).optional()
    }).strict();
    node = z5.lazy(() => z5.union([
      z5.object({ type: z5.literal("leaf"), data: group, size: size.optional(), visible: z5.literal(true).optional() }).strict(),
      z5.object({ type: z5.literal("branch"), data: z5.array(node).max(64), size: size.optional() }).strict()
    ]));
    panel = z5.object({
      id: id2,
      contentComponent: z5.string().min(1).max(32),
      tabComponent: z5.undefined().optional(),
      title: z5.string().max(80).optional(),
      renderer: z5.literal("always").optional(),
      params: z5.object({ viewState: z5.record(z5.unknown()) }).strict().optional(),
      minimumWidth: size.optional(),
      minimumHeight: size.optional(),
      maximumWidth: size.optional(),
      maximumHeight: size.optional()
    }).strict();
    schema2 = z5.object({
      format: z5.literal("lux-personal-layout"),
      version: z5.literal(1),
      dockviewVersion: z5.literal(DOCKVIEW_VERSION),
      name: z5.string().trim().min(1).max(80),
      dock: z5.object({
        grid: z5.object({ root: node, height: size, width: size, orientation: z5.enum(["HORIZONTAL", "VERTICAL"]) }).strict(),
        panels: z5.record(panel),
        activeGroup: id2.optional(),
        floatingGroups: z5.array(z5.never()).max(0).optional(),
        popoutGroups: z5.array(z5.never()).max(0).optional()
      }).strict(),
      closedPanels: z5.record(panel).default({})
    }).strict();
  }
});

// apps/studio/src/layout/dockview-adapter.ts
var LuxDockviewAdapter;
var init_dockview_adapter = __esm({
  "apps/studio/src/layout/dockview-adapter.ts"() {
    "use strict";
    init_registry();
    init_personal_layout();
    LuxDockviewAdapter = class {
      api;
      registry;
      storage;
      mode;
      closed = {};
      applying = false;
      disposed = false;
      subscription;
      constructor(api, registry, storage2, mode) {
        this.api = api;
        this.registry = registry;
        this.storage = storage2;
        this.mode = mode;
        this.subscription = api.onDidRemovePanel((panel2) => {
          if (!this.applying && !this.disposed) this.closed[panel2.id] = structuredClone(panel2.toJSON());
        });
      }
      live() {
        if (this.disposed) throw Error("Layout adapter is disposed");
      }
      key(name2) {
        if (!name2.trim() || name2.length > 80) throw Error("Invalid layout name");
        return "lux.personal-layout.v1." + encodeURIComponent(name2);
      }
      apply(layout) {
        this.applying = true;
        try {
          this.api.fromJSON(layout.dock, { reuseExistingPanels: true });
          this.closed = structuredClone(layout.closedPanels);
        } finally {
          this.applying = false;
        }
      }
      capture(name2) {
        this.live();
        const closedPanels = Object.fromEntries(Object.entries(this.closed).filter(([id3]) => !this.api.getPanel(id3)));
        return validatePersonalLayout({ format: "lux-personal-layout", version: 1, dockviewVersion: DOCKVIEW_VERSION, name: name2, dock: this.api.toJSON(), closedPanels }, this.registry);
      }
      save(name2) {
        this.live();
        const layout = this.capture(name2);
        this.storage.setItem(this.key(name2), JSON.stringify(layout));
      }
      restore(name2) {
        this.live();
        try {
          const text3 = this.storage.getItem(this.key(name2));
          if (text3 === null) {
            this.apply(defaultPersonalLayout(this.registry, this.mode));
            return { restored: false, reason: "No saved personal layout" };
          }
          this.apply(parsePersonalLayout(text3, this.registry));
          return { restored: true };
        } catch (error) {
          this.apply(defaultPersonalLayout(this.registry, this.mode));
          return { restored: false, reason: "Saved layout unavailable or incompatible: " + String(error) };
        }
      }
      reset(name2, mode = this.mode) {
        this.live();
        this.mode = mode;
        this.apply(defaultPersonalLayout(this.registry, this.mode));
        this.storage.removeItem(this.key(name2));
      }
      groupTarget(id3) {
        this.live();
        const group2 = this.api.getGroup(id3);
        if (!group2) throw Error("Target group no longer exists");
        return group2;
      }
      groupAction(kind, group2) {
        const panel2 = this.api.getPanel(kind);
        return !panel2 ? "Open" : panel2.group === group2 ? "Focus" : "Move";
      }
      openInGroup(kind, group2) {
        this.live();
        if (this.api.getGroup(group2.id) !== group2) throw Error("Target group no longer exists");
        const existing = this.api.getPanel(kind);
        if (existing) {
          if (existing.group !== group2) existing.api.moveTo({ group: group2, position: "center" });
          existing.api.setActive();
        } else this.open(kind, kind, group2);
        group2.focus();
      }
      open(kind, id3 = kind, group2) {
        this.live();
        const definition2 = this.registry.get(kind);
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(id3) || isReservedPanelKey(id3)) throw Error("Invalid panel identity");
        const existing = this.api.getPanel(id3);
        if (existing) {
          if (existing.view.contentComponent !== kind) throw Error("Panel identity already belongs to another kind");
          existing.api.setActive();
          existing.group.focus();
          return;
        }
        if (!definition2.multiple && this.api.panels.some((panel2) => panel2.view.contentComponent === kind)) throw Error("Panel is already open");
        if (!definition2.multiple && Object.entries(this.closed).some(([key2, panel2]) => key2 !== id3 && !this.api.getPanel(key2) && panel2.contentComponent === kind)) throw Error("Reopen the existing panel identity to preserve its view state");
        const previous = this.closed[id3];
        if (previous && previous.contentComponent !== kind) throw Error("Closed panel identity belongs to another kind");
        if (this.api.panels.length + Object.keys(this.closed).filter((key2) => !this.api.getPanel(key2)).length >= 32 && !previous) throw Error("Too many panels");
        this.api.addPanel({ ...group2 ? { position: { referenceGroup: group2, direction: "within" } } : {}, id: id3, component: kind, title: definition2.title, renderer: "always", params: { viewState: definition2.parseViewState(previous?.params?.viewState) } });
        delete this.closed[id3];
        const opened = this.api.getPanel(id3);
        opened?.api.setActive();
        opened?.group.focus();
      }
      toggle(kind) {
        this.live();
        const existing = this.api.panels.find((panel2) => panel2.view.contentComponent === kind);
        if (existing) {
          this.api.removePanel(existing);
          return false;
        }
        this.open(kind);
        return true;
      }
      close(id3) {
        this.live();
        const panel2 = this.api.getPanel(id3);
        if (panel2) this.api.removePanel(panel2);
      }
      openBeside(kind, referenceId) {
        this.live();
        const reference = this.api.getPanel(referenceId);
        this.open(kind);
        const panel2 = this.api.getPanel(kind);
        if (reference && panel2 && panel2 !== reference && panel2.group === reference.group) panel2.api.moveTo({ group: reference.group, position: "right" });
      }
      openInToolGroup(kind) {
        this.live();
        if (this.api.getPanel(kind)) {
          this.open(kind);
          return;
        }
        const preview = this.api.getPanel("preview");
        const reference = ["graph", "jobs", "diagnostics"].map((id3) => this.api.getPanel(id3)).find((panel3) => panel3 && (!preview || panel3.group !== preview.group));
        if (reference) {
          this.open(kind, kind, reference.group);
          return;
        }
        this.open(kind);
        const panel2 = this.api.getPanel(kind);
        if (preview && panel2 && panel2 !== preview) panel2.api.moveTo({ group: preview.group, position: "bottom" });
      }
      move(id3, referenceId, position) {
        this.live();
        const panel2 = this.api.getPanel(id3), target = this.api.getPanel(referenceId);
        if (!panel2 || !target || panel2 === target) throw Error("Choose two different open panels");
        panel2.api.moveTo({ group: target.group, position });
      }
      setViewState(id3, value) {
        this.live();
        const panel2 = this.api.getPanel(id3);
        if (!panel2) throw Error("Panel is not open");
        panel2.api.updateParameters({ viewState: this.registry.get(panel2.view.contentComponent).parseViewState(value) });
      }
      dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.subscription.dispose();
      }
    };
  }
});

// apps/studio/src/layout/LuxDockLayout.tsx
import { useEffect as useEffect5, useMemo as useMemo2, useRef as useRef7, useState as useState7, useId as useId3 } from "react";
import { Button as Button7, Menu as Menu2, MenuItem as MenuItem3, Tooltip as Tooltip3 } from "@mui/material";
import { DockviewReact, themeDark } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { Fragment as Fragment3, jsx as jsx7, jsxs as jsxs8 } from "react/jsx-runtime";
function LuxDockLayout({ registry, panels, storage: storage2, name: name2 = "Default", mode = "desktop", nonce, onReady, onActivePanelChange }) {
  const adapter = useRef7(null);
  const activePanelSubscription = useRef7(null);
  const components = useMemo2(() => Object.fromEntries(registry.list().map((definition2) => {
    const Panel = panels[definition2.kind];
    if (!Panel) throw Error("Missing real panel renderer: " + definition2.kind);
    const Component = (props) => /* @__PURE__ */ jsx7(
      Panel,
      {
        panelId: props.api.id,
        viewState: definition2.parseViewState(props.params?.viewState),
        setViewState: (value) => props.api.updateParameters({ viewState: definition2.parseViewState(value) })
      }
    );
    return [definition2.kind, Component];
  })), [registry, panels]);
  const HeaderActions = useMemo2(() => function GroupActions({ group: group2, activePanel, containerApi }) {
    const [anchor, setAnchor] = useState7(null), [error, setError] = useState7("");
    const id3 = useId3(), selected = useRef7(false);
    return /* @__PURE__ */ jsxs8(Fragment3, { children: [
      /* @__PURE__ */ jsx7(Tooltip3, { title: "Add pane", children: /* @__PURE__ */ jsx7(
        Button7,
        {
          className: "pane-add",
          "aria-label": `Add pane to ${activePanel?.title ?? "empty"} group`,
          "aria-haspopup": "menu",
          "aria-expanded": !!anchor,
          "aria-controls": anchor ? id3 : void 0,
          onPointerDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            selected.current = false;
            setError("");
            setAnchor(event.currentTarget);
          },
          children: "+"
        }
      ) }),
      /* @__PURE__ */ jsxs8(
        Menu2,
        {
          id: id3,
          anchorEl: anchor,
          open: !!anchor,
          disableRestoreFocus: selected.current,
          slotProps: { transition: { onExited: () => {
            if (selected.current && containerApi.getGroup(group2.id) === group2) group2.focus();
          } } },
          onClose: () => setAnchor(null),
          onKeyDown: (event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setAnchor(null);
            }
          },
          children: [
            registry.list().map((definition2) => {
              const action = adapter.current?.groupAction(definition2.kind, group2) ?? "Open";
              return /* @__PURE__ */ jsx7(MenuItem3, { onClick: () => {
                try {
                  adapter.current?.openInGroup(definition2.kind, group2);
                  selected.current = true;
                  setAnchor(null);
                } catch (reason) {
                  setError(String(reason));
                }
              }, children: action === "Move" ? `Move ${definition2.title} here` : `${action} ${definition2.title}` }, definition2.kind);
            }),
            error && /* @__PURE__ */ jsx7("li", { role: "alert", children: error })
          ]
        }
      )
    ] });
  }, [registry]);
  useEffect5(() => () => {
    activePanelSubscription.current?.dispose();
    activePanelSubscription.current = null;
    adapter.current?.dispose();
    adapter.current = null;
  }, []);
  if (!/^[A-Za-z0-9+/=]{24,64}$/.test(nonce)) throw Error("Studio style nonce unavailable");
  return /* @__PURE__ */ jsx7(
    DockviewReact,
    {
      rightHeaderActionsComponent: HeaderActions,
      components,
      theme: themeDark,
      nonce,
      disableFloatingGroups: true,
      dndStrategy: "pointer",
      onReady: (event) => {
        activePanelSubscription.current?.dispose();
        adapter.current?.dispose();
        const current = new LuxDockviewAdapter(event.api, registry, storage2, mode);
        adapter.current = current;
        const result = current.restore(name2);
        onActivePanelChange?.(event.api.activePanel?.view.contentComponent ?? null);
        activePanelSubscription.current = event.api.onDidActivePanelChange((change) => onActivePanelChange?.(change.panel?.view.contentComponent ?? null));
        onReady?.(current, result);
      }
    }
  );
}
var init_LuxDockLayout = __esm({
  "apps/studio/src/layout/LuxDockLayout.tsx"() {
    "use strict";
    init_dockview_adapter();
  }
});

// apps/studio/src/studio-shortcuts.ts
function shortcutCommand(event) {
  const key2 = event.key.toLowerCase();
  const primary = event.ctrlKey !== event.metaKey && (event.ctrlKey || event.metaKey);
  if (event.altKey) return null;
  if ((event.key === "?" || event.key === "/") && event.shiftKey && !event.ctrlKey && !event.metaKey) return "shortcut-reference";
  if (event.key === "F11" && !event.ctrlKey && !event.metaKey && !event.shiftKey) return "fullscreen";
  if (!primary) return null;
  if (event.shiftKey) {
    if (key2 === "m") return "maximize-panel";
    if (key2 === "i") return "toggle-inspector";
    if (key2 === "p") return "save-frame";
    if (key2 === "r") return "toggle-recording";
    if (key2 === "s") return "save-as";
    if (key2 === "e") return "export";
    return null;
  }
  if (key2 === "s") return "save";
  if (event.key === "Enter") return "build";
  return null;
}
function isTextEntryTarget(target) {
  if (!(target instanceof Element)) return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]');
}
function blocksTextEntry(command) {
  return command === "maximize-panel" || command === "toggle-inspector" || command === "fullscreen" || command === "shortcut-reference";
}
var shortcutHint, shortcutReference;
var init_studio_shortcuts = __esm({
  "apps/studio/src/studio-shortcuts.ts"() {
    "use strict";
    shortcutHint = Object.freeze({
      "maximize-panel": "Ctrl+Shift+M",
      fullscreen: "F11",
      "toggle-inspector": "Ctrl+Shift+I",
      "save-frame": "Ctrl+Shift+P",
      "toggle-recording": "Ctrl+Shift+R",
      save: "Ctrl+S",
      "save-as": "Ctrl+Shift+S",
      export: "Ctrl+Shift+E",
      build: "Ctrl+Enter",
      "shortcut-reference": "?"
    });
    shortcutReference = [
      { command: "build", label: "Build preview" },
      { command: "save", label: "Save scene" },
      { command: "save-as", label: "Save scene as" },
      { command: "export", label: "Export for Resolume" },
      { command: "save-frame", label: "Save frame PNG" },
      { command: "toggle-recording", label: "Start or stop recording" },
      { command: "toggle-inspector", label: "Toggle Inspector" },
      { command: "maximize-panel", label: "Maximize or restore focused panel" },
      { command: "fullscreen", label: "Toggle Preview fullscreen" },
      { command: "shortcut-reference", label: "Show keyboard shortcuts" }
    ];
  }
});

// apps/studio/src/layout/StudioDockShell.tsx
import { useLayoutEffect, useMemo as useMemo3, useRef as useRef8, useState as useState8 } from "react";
import { createPortal } from "react-dom";
import { Alert, Button as Button8, TextField as TextField2, MenuItem as MenuItem4, Divider as Divider2, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { jsx as jsx8, jsxs as jsxs9 } from "react/jsx-runtime";
function StudioDockShell({ compact, expandedPanel = "preview", showInspector, toolsHost, onOpenPanelReady, onTogglePanelReady, onActivePanelChange, onShortcutsHelp, ...content }) {
  const [mode] = useState8(() => window.innerWidth < 1100 ? "laptop" : "desktop");
  const [name2, setName] = useState8("Default"), [message, setMessage] = useState8("");
  const [layoutsOpen, setLayoutsOpen] = useState8(false);
  const viewButton = useRef8(null);
  const adapter = useRef8(null), expanded = useRef8(null);
  const hosts = useMemo3(() => Object.fromEntries(kinds.map((kind) => {
    const host = document.createElement("div");
    host.className = `studio-pane-host studio-pane-${kind}`;
    host.dataset.studioPaneKind = kind;
    return [kind, host];
  })), []);
  const slots = useRef8({});
  const registry = useMemo3(() => new PanelRegistry(createStudioPanelRegistry().list().map((definition2) => ({ ...definition2, multiple: false }))), []);
  const panels = useMemo3(() => Object.fromEntries(kinds.map((kind) => [kind, function PaneSlot() {
    const slot = useRef8(null);
    useLayoutEffect(() => {
      slots.current[kind] = slot.current;
      slot.current.append(hosts[kind]);
      return () => {
        delete slots.current[kind];
        if (hosts[kind].parentElement === slot.current) hosts[kind].remove();
      };
    }, []);
    return /* @__PURE__ */ jsx8("div", { ref: slot, className: "studio-pane-slot" });
  }])), [hosts]);
  useLayoutEffect(() => {
    for (const kind of kinds) {
      const alongsidePreview = compact && expandedPanel === "preview" && showInspector && kind === "inspector";
      const destination = compact && (kind === expandedPanel || alongsidePreview) ? expanded.current : slots.current[kind];
      if (destination) destination.append(hosts[kind]);
      else hosts[kind].remove();
    }
  }, [compact, expandedPanel, hosts, showInspector]);
  function action(run) {
    try {
      if (!adapter.current) throw Error("Layout is loading");
      run(adapter.current);
    } catch (reason) {
      setMessage(String(reason));
    }
  }
  function openViewPanel(value, kind) {
    if (kind === "story") value.openInToolGroup(kind);
    else value.open(kind);
  }
  function openRequestedPanel(value, kind) {
    if (kind === "inspector") value.openBeside(kind, "graph");
    else openViewPanel(value, kind);
  }
  function noteFocusedPanel(target) {
    if (!(target instanceof Element)) return;
    const hostKind = target.closest("[data-studio-pane-kind]")?.dataset.studioPaneKind;
    const tabTitle = target.closest(".dv-tab")?.textContent?.trim();
    const kind = kinds.find((value) => value === hostKind || registry.get(value).title === tabTitle);
    if (kind) onActivePanelChange?.(kind);
  }
  useLayoutEffect(() => () => {
    onOpenPanelReady?.(null);
    onTogglePanelReady?.(null);
  }, [onOpenPanelReady, onTogglePanelReady]);
  function reset(next) {
    action((value) => {
      value.reset(name2, next);
      setMessage(`Reset to ${next} layout`);
    });
  }
  const nonce = document.querySelector('meta[name="style-nonce"]')?.content ?? "";
  const tools = /* @__PURE__ */ jsxs9("div", { className: "layout-tools", hidden: compact, children: [
    /* @__PURE__ */ jsxs9(StudioMenu, { label: "View", buttonRef: viewButton, children: [
      kinds.map((kind) => /* @__PURE__ */ jsxs9(MenuItem4, { onClick: () => action((value) => openViewPanel(value, kind)), children: [
        /* @__PURE__ */ jsx8("span", { children: registry.get(kind).title }),
        kind === "inspector" && /* @__PURE__ */ jsx8("span", { className: "studio-shortcut-hint", "aria-hidden": "true", children: shortcutHint["toggle-inspector"] })
      ] }, kind)),
      /* @__PURE__ */ jsx8(Divider2, {}),
      /* @__PURE__ */ jsx8(MenuItem4, { onClick: () => setLayoutsOpen(true), children: "Layouts\u2026" }),
      /* @__PURE__ */ jsxs9(MenuItem4, { onClick: () => onShortcutsHelp?.(viewButton.current), children: [
        /* @__PURE__ */ jsx8("span", { children: "Keyboard shortcuts" }),
        /* @__PURE__ */ jsx8("span", { className: "studio-shortcut-hint", "aria-hidden": "true", children: shortcutHint["shortcut-reference"] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs9(
      Dialog,
      {
        open: layoutsOpen,
        onClose: () => setLayoutsOpen(false),
        "aria-labelledby": "workspace-layouts-title",
        maxWidth: "xs",
        fullWidth: true,
        slotProps: { transition: { onExited: () => viewButton.current?.focus() } },
        onKeyDown: (event) => {
          if (event.key === "Escape") event.stopPropagation();
        },
        children: [
          /* @__PURE__ */ jsx8(DialogTitle, { id: "workspace-layouts-title", children: "Workspace layouts" }),
          /* @__PURE__ */ jsxs9(DialogContent, { children: [
            /* @__PURE__ */ jsxs9("div", { className: "layout-actions", children: [
              /* @__PURE__ */ jsx8(TextField2, { size: "small", label: "Layout name", value: name2, onChange: (event) => setName(event.target.value) }),
              /* @__PURE__ */ jsx8(Button8, { onClick: () => action((value) => {
                value.save(name2);
                setMessage(`Saved layout: ${name2}`);
              }), children: "Save layout" }),
              /* @__PURE__ */ jsx8(Button8, { onClick: () => action((value) => {
                const result = value.restore(name2);
                setMessage(result.restored ? `Restored layout: ${name2}` : result.reason ?? "Default layout restored");
              }), children: "Restore layout" }),
              /* @__PURE__ */ jsx8(Button8, { onClick: () => reset("desktop"), children: "Reset desktop layout" }),
              /* @__PURE__ */ jsx8(Button8, { onClick: () => reset("laptop"), children: "Reset laptop layout" })
            ] }),
            message && /* @__PURE__ */ jsx8(Alert, { severity: "info", role: "status", children: message })
          ] }),
          /* @__PURE__ */ jsx8(DialogActions, { children: /* @__PURE__ */ jsx8(Button8, { onClick: () => setLayoutsOpen(false), children: "Done" }) })
        ]
      }
    )
  ] });
  return /* @__PURE__ */ jsxs9("div", { className: `studio-dock-shell ${compact ? "dock-compact" : ""}`, onFocusCapture: (event) => noteFocusedPanel(event.target), onPointerDownCapture: (event) => noteFocusedPanel(event.target), children: [
    toolsHost ? createPortal(tools, toolsHost) : tools,
    message && !layoutsOpen && /* @__PURE__ */ jsx8(Alert, { severity: "info", role: "status", onClose: () => setMessage(""), children: message }),
    /* @__PURE__ */ jsx8("div", { className: "studio-dock-grid", hidden: compact, children: /* @__PURE__ */ jsx8(
      LuxDockLayout,
      {
        registry,
        panels,
        storage,
        nonce,
        mode,
        onActivePanelChange: (kind) => {
          if (kinds.includes(kind)) onActivePanelChange?.(kind);
        },
        onReady: (value, result) => {
          adapter.current = value;
          onOpenPanelReady?.((kind) => openRequestedPanel(value, kind));
          onTogglePanelReady?.((kind) => {
            value.toggle(kind);
          });
          if (result.reason && result.reason !== "No saved personal layout") setMessage(result.reason);
        }
      }
    ) }),
    /* @__PURE__ */ jsx8("div", { className: `studio-expanded-pane ${showInspector ? "studio-expanded-with-inspector" : ""}`, hidden: !compact, ref: expanded }),
    kinds.map((kind) => createPortal(content[kind], hosts[kind], kind))
  ] });
}
var kinds, storage;
var init_StudioDockShell = __esm({
  "apps/studio/src/layout/StudioDockShell.tsx"() {
    "use strict";
    init_StudioMenu();
    init_LuxDockLayout();
    init_registry();
    init_studio_shortcuts();
    kinds = ["preview", "source", "library", "inspector", "story", "diagnostics", "jobs", "graph"];
    storage = {
      getItem: (key2) => window.localStorage.getItem(key2),
      setItem: (key2, value) => window.localStorage.setItem(key2, value),
      removeItem: (key2) => window.localStorage.removeItem(key2)
    };
  }
});

// apps/studio/src/renderer-snapshot.ts
function urgentStoryFrame(frame) {
  return frame.state === "active" ? (({ elapsedSeconds: _elapsedSeconds, localTimeSeconds: _localTimeSeconds, progress: _progress, ...identity }) => identity)(frame) : frame;
}
function urgentStory(story) {
  const { frame, sequence, effectiveAdvancing: _effectiveAdvancing, ...state } = story;
  const { dwellElapsedSeconds: _dwellElapsedSeconds, dwellRemainingSeconds: _dwellRemainingSeconds, ...sequenceState } = sequence;
  return { ...state, frame: urgentStoryFrame(frame), sequence: sequenceState };
}
function urgentStorySchedule(story) {
  const { committed, outgoing, incoming, crossfadeProgress: _crossfadeProgress, sequence, effectiveAdvancing: _effectiveAdvancing, ...state } = story;
  const activation = (value) => value ? { ...value, frame: urgentStoryFrame(value.frame) } : null;
  const { dwellElapsedSeconds: _dwellElapsedSeconds, dwellRemainingSeconds: _dwellRemainingSeconds, ...sequenceState } = sequence;
  return { ...state, committed: activation(committed), outgoing: activation(outgoing), incoming: activation(incoming), sequence: sequenceState };
}
function urgentVisualStates(states) {
  return states.map(({ effectiveControls: _effectiveControls, effectiveNodeControls: _effectiveNodeControls, ...state }) => state);
}
function urgentState(snapshot2) {
  const { receivedAtMs, visualFps, uiFps, performance, authoring, ...state } = snapshot2;
  const runtime = authoring ? (({ frameId, timeSeconds, effectiveControls, effectiveNodeControls, tempo, story, storySchedule: storySchedule2, visualStates, ...rest }) => ({
    ...rest,
    ...tempo ? { tempo: { bpm: tempo.bpm, tempoSequence: tempo.tempoSequence } } : {},
    ...story ? { story: urgentStory(story) } : {},
    ...storySchedule2 ? { storySchedule: urgentStorySchedule(storySchedule2) } : {},
    ...visualStates ? { visualStates: urgentVisualStates(visualStates) } : {}
  }))(authoring) : null;
  return JSON.stringify({ ...state, authoring: runtime });
}
function createRendererSnapshot(client) {
  let current = client.getSnapshot(), signature = urgentState(current);
  let timer;
  let detach;
  const listeners = /* @__PURE__ */ new Set();
  function cancel() {
    clearTimeout(timer);
    timer = void 0;
  }
  function publish2() {
    cancel();
    const next = client.getSnapshot();
    if (next === current) return;
    current = next;
    signature = urgentState(next);
    for (const listener of listeners) listener();
  }
  function changed() {
    const next = client.getSnapshot();
    if (next === current) return;
    if (urgentState(next) !== signature) publish2();
    else timer ??= setTimeout(publish2, 100);
  }
  return {
    // Do not bypass the cache here: React reads again during commit consistency
    // checks, which would otherwise reintroduce per-frame synchronous renders.
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      if (!detach) {
        detach = client.subscribe(changed);
        publish2();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          detach?.();
          detach = void 0;
          cancel();
        }
      };
    }
  };
}
var init_renderer_snapshot = __esm({
  "apps/studio/src/renderer-snapshot.ts"() {
    "use strict";
  }
});

// apps/studio/src/Disclosure.tsx
import { useState as useState9 } from "react";
import { jsx as jsx9, jsxs as jsxs10 } from "react/jsx-runtime";
function Disclosure({ title, badge, defaultOpen = false, className = "", children: children2 }) {
  const [open, setOpen] = useState9(defaultOpen);
  return /* @__PURE__ */ jsxs10(
    "details",
    {
      className: `studio-disclosure ${className}`,
      open,
      onToggle: (event) => setOpen(event.currentTarget.open),
      children: [
        /* @__PURE__ */ jsxs10("summary", { children: [
          title,
          badge && /* @__PURE__ */ jsx9("span", { className: "disclosure-badge", children: badge })
        ] }),
        children2
      ]
    }
  );
}
var init_Disclosure = __esm({
  "apps/studio/src/Disclosure.tsx"() {
    "use strict";
  }
});

// apps/studio/src/source/source-equality.ts
var init_source_equality = __esm({
  "apps/studio/src/source/source-equality.ts"() {
    "use strict";
  }
});

// apps/studio/src/source/diagnostics.ts
function diagnosticTarget(diagnostic, snapshot2) {
  const path = diagnostic.file;
  if (diagnostic.candidateOnly || diagnostic.draftVersion !== snapshot2.version || !path || !Object.hasOwn(snapshot2.source.files, path)) return null;
  const text3 = snapshot2.source.files[path], lines = text3.split("\n");
  const position = (value) => value !== void 0 && Number.isFinite(value) ? Math.max(0, Math.floor(value) - 1) : 0;
  const line = Math.min(position(diagnostic.line), lines.length - 1);
  const lineText = lines[line].replace(/\r$/, "");
  let offset = Math.min(position(diagnostic.column), lineText.length);
  for (let index = 0; index < line; index++) offset += lines[index].length + 1;
  return { path, offset, ...diagnostic.visualId ? { visualId: diagnostic.visualId } : {} };
}
var init_diagnostics = __esm({
  "apps/studio/src/source/diagnostics.ts"() {
    "use strict";
    init_source_equality();
  }
});

// apps/studio/src/source/ProblemsPanel.tsx
import { Button as Button9 } from "@mui/material";
import { jsx as jsx10, jsxs as jsxs11 } from "react/jsx-runtime";
function ProblemsPanel({ diagnostics, snapshot: snapshot2, visualSnapshots, onNavigate }) {
  if (!diagnostics.length) return null;
  return /* @__PURE__ */ jsxs11("section", { "aria-label": "Source diagnostics", children: [
    /* @__PURE__ */ jsx10("h3", { children: "Source diagnostics" }),
    /* @__PURE__ */ jsx10("ul", { children: diagnostics.map((diagnostic, index) => {
      const diagnosticSnapshot = (diagnostic.visualId ? visualSnapshots?.[diagnostic.visualId] : void 0) ?? snapshot2;
      const target = diagnosticTarget(diagnostic, diagnosticSnapshot), stale = diagnostic.draftVersion !== diagnosticSnapshot.version;
      return /* @__PURE__ */ jsxs11("li", { children: [
        /* @__PURE__ */ jsxs11(Button9, { disabled: !target, onClick: () => target && onNavigate(target), children: [
          diagnostic.file ? `${diagnostic.file}:${diagnostic.line ?? ""}:${diagnostic.column ?? ""} ` : "",
          diagnostic.message
        ] }),
        diagnostic.candidateOnly ? /* @__PURE__ */ jsx10("span", { children: "Diagnostic belongs to a rejected candidate; the displayed source is unchanged." }) : stale ? /* @__PURE__ */ jsx10("span", { children: "Stale diagnostic: source has changed. Build again to refresh." }) : !target && /* @__PURE__ */ jsx10("span", { children: "Location unavailable in this source bundle." })
      ] }, index);
    }) })
  ] });
}
var init_ProblemsPanel = __esm({
  "apps/studio/src/source/ProblemsPanel.tsx"() {
    "use strict";
    init_diagnostics();
  }
});

// apps/studio/src/renderer.tsx
var renderer_exports = {};
__export(renderer_exports, {
  StudioApp: () => StudioApp,
  metricText: () => metricText,
  studioStatus: () => studioStatus
});
import { useCallback, useEffect as useEffect6, useMemo as useMemo4, useRef as useRef9, useState as useState10, useSyncExternalStore } from "react";
import { Alert as Alert2, Button as Button10, Chip, CssBaseline, Paper as Paper3, ThemeProvider, IconButton as IconButton2, Tooltip as Tooltip4, Menu as Menu4, MenuItem as MenuItem5, Dialog as Dialog2, DialogTitle as DialogTitle2, DialogContent as DialogContent2, DialogActions as DialogActions2, TextField as TextField3 } from "@mui/material";
import { Fragment as Fragment4, jsx as jsx11, jsxs as jsxs12 } from "react/jsx-runtime";
function metricText(metric, nowMs) {
  if (!metric || !Number.isFinite(metric.value) || metric.value < 0 || !Number.isFinite(metric.sampledAtMs) || !Number.isFinite(metric.coverage) || metric.coverage <= 0 || metric.coverage > 1 || metric.sampledAtMs > nowMs) {
    return { value: "Unavailable", detail: "No observed samples" };
  }
  const age = nowMs - metric.sampledAtMs;
  return { value: `${metric.value.toFixed(1)} fps`, detail: `${age > 2e3 ? "Stale \xB7 " : ""}${Math.round(metric.coverage * 100)}% coverage \xB7 ${(age / 1e3).toFixed(1)}s ago` };
}
function MetricView({ label, metric, nowMs }) {
  const text3 = metricText(metric, nowMs);
  return /* @__PURE__ */ jsxs12("div", { className: "metric", children: [
    /* @__PURE__ */ jsx11("span", { children: label }),
    /* @__PURE__ */ jsx11("strong", { children: text3.value }),
    /* @__PURE__ */ jsx11("small", { children: text3.detail })
  ] });
}
function StudioApp(props) {
  return /* @__PURE__ */ jsxs12(ThemeProvider, { theme: studioTheme, children: [
    /* @__PURE__ */ jsx11(CssBaseline, {}),
    /* @__PURE__ */ jsx11(StudioLayout, { ...props })
  ] });
}
function controlOwner(snapshot2) {
  const runtime = snapshot2.authoring;
  return snapshot2.connection === "connected" && runtime?.authority === "studio" ? parameterOwner(runtime) : null;
}
function sentenceCase(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}
function sourceDiagnosticFault(fault, sourceDiagnostics) {
  return !!fault && fault.includes("SourceCompileError:") && sourceDiagnostics.length > 0 && sourceDiagnostics.every((diagnostic) => fault.includes(diagnostic.message));
}
function studioStatus(snapshot2, sourceProblemCount = 0) {
  const jobs = [...snapshot2.jobs];
  const latest = jobs.at(-1), active = jobs.findLast((job) => activeJobStates.has(job.state.toLowerCase()));
  const build = active?.summary ?? (latest?.state.toLowerCase() === "failed" ? "Build failed" : latest?.state.toLowerCase() === "succeeded" ? "Build ready" : "Build idle");
  const problems = sourceProblemCount + (snapshot2.authoring?.fault ? 1 : 0) + jobs.filter((job) => !!job.fault || job.state.toLowerCase() === "failed").length;
  const runtime = snapshot2.connection === "connecting" ? "Connecting" : snapshot2.connection !== "connected" ? "Disconnected" : snapshot2.authoring?.fault || snapshot2.authoring?.playback === "failed" ? "Failed" : snapshot2.authoring ? sentenceCase(snapshot2.authoring.playback) : "No runtime";
  return { build, building: !!active, problems, runtime };
}
function StudioLayout({ client, presentation, windows, previewOnly = false, nowMs, sourcePanel, sourceDiagnostics, libraryPanel, appCommands, fileMenu, previewActions, transportActions, shortcutActions, appError, controlEdits, sourceChanged, controlsAvailable, selectedVisualId }) {
  const [toolsHost, setToolsHost] = useState10(null);
  const [transportMenu, setTransportMenu] = useState10(null);
  const view = useMemo4(() => createRendererSnapshot(client), [client]);
  const snapshot2 = useSyncExternalStore(view.subscribe, view.getSnapshot, view.getSnapshot);
  const owner = controlOwner(snapshot2);
  const controller = useMemo4(() => new StudioController(client), [client, owner]);
  const [windowState, setWindowState] = useState10({ detached: false, fullscreen: false });
  const [focusedPanel, setFocusedPanel] = useState10("preview");
  const [maximizedPanel, setMaximizedPanel] = useState10(null);
  const [maximizedInspector, setMaximizedInspector] = useState10(false);
  const [shortcutsOpen, setShortcutsOpen] = useState10(false);
  const [pendingCommands, setPendingCommands] = useState10(0);
  const transportPending = useRef9(false);
  const jobsRef = useRef9(null), openPanelRef = useRef9(null), togglePanelRef = useRef9(null);
  const bindOpenPanel = useCallback((action) => {
    openPanelRef.current = action;
  }, []);
  const bindTogglePanel = useCallback((action) => {
    togglePanelRef.current = action;
  }, []);
  const panelFocus = useRef9(null), fullscreenFocus = useRef9(null), previousFullscreen = useRef9(false);
  const shortcutsFocus = useRef9(null);
  const [jobsRequest, setJobsRequest] = useState10(0), [storyRequest, setStoryRequest] = useState10(0);
  useEffect6(() => {
    if (!jobsRequest) return;
    if (openPanelRef.current) openPanelRef.current("jobs");
    else jobsRef.current?.focus();
  }, [jobsRequest]);
  useEffect6(() => {
    if (storyRequest) openPanelRef.current?.("story");
  }, [storyRequest]);
  const [fullscreenHint, setFullscreenHint] = useState10(false);
  const busy = pendingCommands > 0;
  const [error, setError] = useState10(null);
  const [clock, setClock] = useState10(() => nowMs ?? Date.now());
  const runtime = snapshot2.authoring;
  const [tempoDraft, setTempoDraft] = useState10("120"), tempoEditing = useRef9(false);
  useEffect6(() => {
    if (!tempoEditing.current) setTempoDraft(String(runtime?.tempo?.bpm ?? 120));
  }, [runtime?.tempo?.bpm, runtime?.instanceId, runtime?.generation]);
  const sourceProblemCount = sourceDiagnostics?.items.length ?? 0;
  const matchingSourceFaults = snapshot2.jobs.filter((job) => sourceDiagnosticFault(job.fault, sourceDiagnostics?.items ?? [])).length;
  const baseStatus = studioStatus(snapshot2, sourceProblemCount);
  const status = { ...baseStatus, problems: Math.max(0, baseStatus.problems - matchingSourceFaults) };
  useEffect6(() => {
    setError(null);
  }, [runtime?.instanceId, runtime?.generation]);
  const [graphSelection, setGraphSelection] = useState10(null);
  const selectedGraphSelection = visualSelection(runtime, graphSelection);
  const selectedNodePath = selectedGraphSelection ?? void 0;
  useEffect6(() => {
    if (selectedGraphSelection !== graphSelection) setGraphSelection(selectedGraphSelection);
  }, [selectedGraphSelection, graphSelection]);
  function selectGraphNode(path) {
    setGraphSelection(path ? [...path] : null);
    openPanelRef.current?.("inspector");
  }
  const available = snapshot2.connection === "connected" && runtime?.authority === "studio" && controlsAvailable !== false;
  useEffect6(() => {
    if (nowMs !== void 0) return;
    const timer = setInterval(() => setClock(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, [nowMs]);
  useEffect6(() => {
    if (!windows) return;
    let active = true, receivedEvent = false;
    const unsubscribe = windows.subscribe((state) => {
      receivedEvent = true;
      if (active) setWindowState(state);
    });
    void windows.getState().then((state) => {
      if (active && !receivedEvent) setWindowState(state);
    }).catch((reason) => {
      if (active) setError(String(reason));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [windows]);
  function rememberFocus(target) {
    target.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  function restoreFocus(target) {
    const element = target.current;
    target.current = null;
    queueMicrotask(() => {
      if (element?.isConnected) element.focus();
    });
  }
  function toggleMaximized(panel2 = focusedPanel) {
    if (maximizedPanel) {
      setMaximizedPanel(null);
      restoreFocus(panelFocus);
      return;
    }
    rememberFocus(panelFocus);
    setMaximizedPanel(panel2);
  }
  function toggleFullscreen() {
    if (!windows) return;
    if (!windowState.fullscreen) rememberFocus(fullscreenFocus);
    windowAction(() => windows.fullscreen(!windowState.fullscreen));
  }
  function toggleInspector() {
    if (maximizedPanel === "preview" && !windowState.fullscreen) {
      setMaximizedInspector((value) => !value);
      return;
    }
    if (maximizedPanel === "inspector") {
      setMaximizedPanel(null);
      restoreFocus(panelFocus);
    }
    togglePanelRef.current?.("inspector");
  }
  function openShortcutReference(returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
    shortcutsFocus.current = returnFocus;
    setShortcutsOpen(true);
  }
  function closeShortcutReference() {
    setShortcutsOpen(false);
  }
  useEffect6(() => {
    const escape = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (windows) void windows.fullscreen(false).catch((reason) => setError(String(reason)));
      if (!windowState.fullscreen && maximizedPanel) {
        setMaximizedPanel(null);
        restoreFocus(panelFocus);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [windows, windowState.fullscreen, maximizedPanel]);
  useEffect6(() => {
    if (previousFullscreen.current && !windowState.fullscreen) restoreFocus(fullscreenFocus);
    previousFullscreen.current = windowState.fullscreen;
  }, [windowState.fullscreen]);
  const shortcutActionsRef = useRef9(shortcutActions);
  shortcutActionsRef.current = shortcutActions;
  useEffect6(() => {
    const keydown = (event) => {
      const shortcut = shortcutCommand(event);
      if (!shortcut || event.defaultPrevented || event.isComposing) return;
      if (shortcut === "shortcut-reference" && event.repeat) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        if (shortcut !== "shortcut-reference") event.preventDefault();
        return;
      }
      if (blocksTextEntry(shortcut) && isTextEntryTarget(event.target)) {
        if (shortcut !== "shortcut-reference") event.preventDefault();
        return;
      }
      event.preventDefault();
      if (event.repeat) return;
      if (shortcut === "maximize-panel") {
        if (!previewOnly) toggleMaximized();
        return;
      }
      if (shortcut === "fullscreen") {
        toggleFullscreen();
        return;
      }
      if (shortcut === "toggle-inspector") {
        if (!previewOnly) toggleInspector();
        return;
      }
      if (shortcut === "shortcut-reference") {
        openShortcutReference();
        return;
      }
      const action = shortcutActionsRef.current?.[shortcut];
      if (!action || action.disabled) return;
      void action.run();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [focusedPanel, maximizedPanel, previewOnly, windowState.fullscreen, windows]);
  useEffect6(() => {
    setFullscreenHint(windowState.fullscreen);
    if (!windowState.fullscreen) return;
    const timer = setTimeout(() => setFullscreenHint(false), 3500);
    return () => clearTimeout(timer);
  }, [windowState.fullscreen]);
  async function command(action, transport = true) {
    if (transport && transportPending.current) return;
    if (transport) {
      transportPending.current = true;
      setPendingCommands((count) => count + 1);
    }
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (transport) {
        transportPending.current = false;
        setPendingCommands((count) => count - 1);
      }
    }
  }
  function commitTempo() {
    tempoEditing.current = false;
    const bpm = Number(tempoDraft);
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) {
      setTempoDraft(String(runtime?.tempo?.bpm ?? 120));
      setError("Tempo must be between 20 and 300 BPM.");
      return;
    }
    if (bpm === (runtime?.tempo?.bpm ?? 120)) return;
    const write = controller.setTempoBpm(bpm);
    controlEdits?.track(write);
    void command(() => write);
  }
  function tapTempo() {
    const write = controller.tapTempo();
    controlEdits?.track(write);
    void command(() => write);
  }
  const writeCameraParameters = useCallback((values2) => {
    const write = controller.setParameters(values2);
    controlEdits?.track(write);
    return write.then(() => client.getSnapshot().authoring);
  }, [client, controller, controlEdits]);
  function windowAction(action) {
    void action().catch((reason) => setError(String(reason)));
  }
  const compact = previewOnly || maximizedPanel !== null || windowState.fullscreen;
  const expandedPanel = previewOnly || windowState.fullscreen ? "preview" : maximizedPanel ?? "preview";
  const showMaximizedInspector = maximizedPanel === "preview" && maximizedInspector && !windowState.fullscreen;
  const previewOutput = runtime?.output;
  const workerFps = snapshot2.performance?.worker?.produced;
  const previewFpsValue = runtime?.playback === "playing" && snapshot2.performance?.status === "live" && workerFps?.availability === "available" && workerFps.value !== void 0 ? `${workerFps.value.toFixed(1)} FPS` : "\u2014 FPS";
  const previewFpsDetail = runtime?.playback !== "playing" ? "Paused" : snapshot2.performance?.status === "live" && workerFps?.availability === "available" ? "Measured worker FPS" : "Worker FPS unavailable or stale";
  const presetValue = previewOutput && [[1280, 720], [1920, 1080], [2560, 1440]].some(([width, height]) => width === previewOutput.width && height === previewOutput.height) ? `${previewOutput.width}x${previewOutput.height}` : "custom";
  const resizePreview = (height) => {
    if (!previewOutput) return;
    const width = Math.round(height * previewOutput.width / previewOutput.height);
    void command(() => controller.resize(width, height));
  };
  const previewPane = /* @__PURE__ */ jsxs12(Paper3, { component: "main", square: true, className: "preview-panel", children: [
    /* @__PURE__ */ jsxs12("div", { className: "panel-toolbar", hidden: windowState.fullscreen, children: [
      /* @__PURE__ */ jsxs12("div", { className: "preview-actions", children: [
        previewActions,
        !previewOnly && /* @__PURE__ */ jsx11(Button10, { "aria-pressed": maximizedPanel === "preview", title: `${maximizedPanel === "preview" ? "Restore workspace" : "Maximize preview"} (${shortcutHint["maximize-panel"]})`, onClick: () => toggleMaximized("preview"), children: maximizedPanel === "preview" ? /* @__PURE__ */ jsxs12(Fragment4, { children: [
          "Restore workspace ",
          /* @__PURE__ */ jsx11("span", { className: "studio-shortcut-hint", "aria-hidden": "true", children: shortcutHint["maximize-panel"] })
        ] }) : "Maximize" }),
        maximizedPanel === "preview" && !windowState.fullscreen && /* @__PURE__ */ jsx11(Button10, { "aria-pressed": maximizedInspector, title: `${maximizedInspector ? "Hide Inspector" : "Show Inspector"} (${shortcutHint["toggle-inspector"]})`, onClick: toggleInspector, children: maximizedInspector ? "Hide Inspector" : "Show Inspector" }),
        (previewOnly || windowState.detached || windows?.popout) && /* @__PURE__ */ jsx11(Button10, { disabled: !windows, onClick: () => windows && windowAction(() => previewOnly || windowState.detached ? windows.dock() : windows.popout()), children: previewOnly || windowState.detached ? "Dock preview" : "Pop out" }),
        /* @__PURE__ */ jsx11(Button10, { disabled: !windows, title: `${windowState.fullscreen ? "Exit fullscreen" : "Fullscreen"} (${shortcutHint.fullscreen})`, onClick: toggleFullscreen, children: windowState.fullscreen ? "Exit fullscreen" : "Fullscreen" })
      ] }),
      /* @__PURE__ */ jsxs12("div", { className: "preview-resolution-controls", children: [
        /* @__PURE__ */ jsxs12("label", { className: "preview-resolution", children: [
          "Resolution",
          /* @__PURE__ */ jsxs12("select", { "aria-label": "Preview resolution preset", disabled: !available || busy, value: presetValue, onChange: (event) => {
            const parts = event.target.value.split("x");
            const width = Number(parts[0]), height = Number(parts[1]);
            if (Number.isInteger(width) && Number.isInteger(height)) void command(() => controller.resize(width, height));
          }, children: [
            /* @__PURE__ */ jsx11("option", { value: "custom", children: "Custom" }),
            /* @__PURE__ */ jsx11("option", { value: "1280x720", children: "1280 \xD7 720" }),
            /* @__PURE__ */ jsx11("option", { value: "1920x1080", children: "1920 \xD7 1080" }),
            /* @__PURE__ */ jsx11("option", { value: "2560x1440", children: "2560 \xD7 1440" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs12("label", { className: "preview-resolution-scale", children: [
          "Scale ",
          /* @__PURE__ */ jsx11("input", { "aria-label": "Preview resolution scale", type: "range", min: "360", max: "2160", step: "90", disabled: !available || busy || !previewOutput, value: previewOutput ? Math.min(2160, Math.max(360, previewOutput.height)) : 1080, onChange: (event) => resizePreview(Number(event.target.value)) })
        ] }),
        previewOutput && /* @__PURE__ */ jsxs12("span", { className: "preview-resolution-value", "aria-live": "polite", children: [
          previewOutput.width,
          " \xD7 ",
          previewOutput.height
        ] }),
        /* @__PURE__ */ jsx11("span", { className: "preview-fps", "aria-label": `Worker frame rate ${previewFpsValue}`, title: previewFpsDetail, children: previewFpsValue })
      ] })
    ] }),
    /* @__PURE__ */ jsx11(
      Preview,
      {
        runtime,
        port: presentation,
        moved: !previewOnly && windowState.detached,
        onError: setError,
        onCameraParameters: writeCameraParameters,
        onDock: () => windows && windowAction(() => windows.dock())
      }
    ),
    runtime?.fault && /* @__PURE__ */ jsxs12(Alert2, { severity: "error", children: [
      /* @__PURE__ */ jsx11("strong", { children: runtime.fault.code }),
      " \xB7 ",
      runtime.fault.message
    ] }),
    error && /* @__PURE__ */ jsx11(Alert2, { severity: "error", role: "alert", children: error }),
    /* @__PURE__ */ jsx11("div", { className: "transport", hidden: windowState.fullscreen, "aria-busy": busy, children: /* @__PURE__ */ jsxs12("div", { className: "transport-actions", children: [
      /* @__PURE__ */ jsx11(Tooltip4, { title: runtime?.playback === "playing" ? "Pause" : "Play", children: /* @__PURE__ */ jsx11("span", { children: /* @__PURE__ */ jsx11(
        IconButton2,
        {
          className: "playback-toggle",
          "aria-label": runtime?.playback === "playing" ? "Pause" : "Play",
          disabled: !available,
          onClick: () => void command(() => controller.playback(runtime?.playback === "playing" ? "pause" : "play")),
          children: /* @__PURE__ */ jsx11("svg", { viewBox: "0 0 24 24", width: "18", height: "18", "aria-hidden": "true", children: /* @__PURE__ */ jsx11("path", { fill: "currentColor", d: runtime?.playback === "playing" ? "M6 4h4v16H6zm8 0h4v16h-4z" : "M6 3l15 9-15 9z" }) })
        }
      ) }) }),
      /* @__PURE__ */ jsx11(Tooltip4, { title: "Reset", children: /* @__PURE__ */ jsx11("span", { children: /* @__PURE__ */ jsx11(IconButton2, { "aria-label": "Reset", disabled: !available, onClick: () => void command(() => controller.playback("reset")), children: /* @__PURE__ */ jsx11("svg", { viewBox: "0 0 24 24", width: "18", height: "18", "aria-hidden": "true", children: /* @__PURE__ */ jsx11("path", { fill: "none", stroke: "currentColor", strokeWidth: "2", d: "M4 10a8 8 0 1 1 0 5M4 4v6h6" }) }) }) }) }),
      /* @__PURE__ */ jsx11("span", { className: "tempo-label", children: "BPM" }),
      /* @__PURE__ */ jsx11(TextField3, { className: "tempo-bpm", size: "small", type: "number", value: tempoDraft, disabled: !available, onFocus: () => {
        tempoEditing.current = true;
      }, onChange: (event) => {
        tempoEditing.current = true;
        setTempoDraft(event.target.value);
      }, onBlur: commitTempo, onKeyDown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitTempo();
        } else if (event.key === "Escape") {
          tempoEditing.current = false;
          setTempoDraft(String(runtime?.tempo?.bpm ?? 120));
        }
      }, slotProps: { htmlInput: { min: 20, max: 300, step: 0.1, "aria-label": "Tempo BPM" } } }),
      /* @__PURE__ */ jsx11(Button10, { size: "small", "aria-label": "Tap tempo", disabled: !available, onClick: tapTempo, children: "Tap" }),
      transportActions,
      /* @__PURE__ */ jsx11(Tooltip4, { title: "More playback actions", children: /* @__PURE__ */ jsx11(IconButton2, { "aria-label": "More playback actions", "aria-haspopup": "menu", "aria-expanded": !!transportMenu, onClick: (event) => setTransportMenu(event.currentTarget), children: "..." }) }),
      /* @__PURE__ */ jsx11(Menu4, { anchorEl: transportMenu, open: !!transportMenu, onClose: () => setTransportMenu(null), onKeyDown: (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setTransportMenu(null);
        }
      }, children: /* @__PURE__ */ jsx11(MenuItem5, { disabled: !available, onClick: () => {
        setTransportMenu(null);
        void command(() => controller.restart());
      }, children: "Restart runtime" }) })
    ] }) })
  ] });
  const inspectorPane = /* @__PURE__ */ jsx11(Paper3, { component: "aside", square: true, className: "inspector", "aria-label": "Scene controls", children: /* @__PURE__ */ jsx11("section", { children: /* @__PURE__ */ jsxs12(Disclosure, { title: "Controls", defaultOpen: true, className: "controls-section", badge: /* @__PURE__ */ jsxs12("span", { className: "controls-badges", children: [
    /* @__PURE__ */ jsx11(Chip, { label: "LIVE" }),
    selectedVisualId ? /* @__PURE__ */ jsx11(Chip, { className: "selected-visual-chip", label: `Source ${selectedVisualId}` }) : null
  ] }), children: [
    /* @__PURE__ */ jsx11(InspectorBreadcrumb, { runtime, path: selectedNodePath, onSelect: setGraphSelection }),
    /* @__PURE__ */ jsx11(ParameterInspector, { nodePath: selectedNodePath, runtime, available: !!available, client, controller, onError: setError, edits: controlEdits })
  ] }) }) });
  const diagnosticsPane = /* @__PURE__ */ jsxs12(Paper3, { component: "aside", square: true, className: "diagnostics-pane", "aria-label": "Diagnostics", children: [
    /* @__PURE__ */ jsx11("section", { children: /* @__PURE__ */ jsxs12(Disclosure, { title: "Performance", children: [
      /* @__PURE__ */ jsx11(PerformanceStatus, { performance: snapshot2.performance }),
      /* @__PURE__ */ jsx11(MetricView, { label: "Visual delivery", metric: snapshot2.visualFps, nowMs: nowMs ?? clock }),
      /* @__PURE__ */ jsx11(MetricView, { label: "UI cadence", metric: snapshot2.uiFps, nowMs: nowMs ?? clock }),
      /* @__PURE__ */ jsx11("p", { className: "hint", children: "Delivery and interface cadence are measured separately." })
    ] }) }),
    /* @__PURE__ */ jsx11("section", { children: /* @__PURE__ */ jsx11(Disclosure, { title: "Runtime", children: /* @__PURE__ */ jsxs12("dl", { className: "identity", children: [
      /* @__PURE__ */ jsx11("dt", { children: "Authoring revision" }),
      /* @__PURE__ */ jsx11("dd", { children: runtime?.revisionId ?? "Unavailable" }),
      /* @__PURE__ */ jsx11("dt", { children: "Instance" }),
      /* @__PURE__ */ jsx11("dd", { children: runtime?.instanceId ?? "Unavailable" }),
      /* @__PURE__ */ jsx11("dt", { children: "Generation / clock epoch" }),
      /* @__PURE__ */ jsx11("dd", { children: runtime ? `${runtime.generation} / ${runtime.clockEpoch}` : "Unavailable" }),
      /* @__PURE__ */ jsx11("dt", { children: "Completed frame" }),
      /* @__PURE__ */ jsx11("dd", { children: runtime?.frameId ?? "Unavailable" })
    ] }) }) }),
    /* @__PURE__ */ jsx11("section", { children: /* @__PURE__ */ jsxs12(Disclosure, { title: "Host output", children: [
      /* @__PURE__ */ jsx11("p", { className: "host-revision", children: snapshot2.host?.revisionId ?? "No host status available" }),
      /* @__PURE__ */ jsx11("p", { className: "hint", children: "Authoring changes do not update a pinned host revision." })
    ] }) })
  ] });
  const storyStatus2 = runtime?.storySchedule ?? runtime?.story;
  const storyPane = /* @__PURE__ */ jsx11(Paper3, { component: "aside", square: true, className: "story-pane", children: /* @__PURE__ */ jsx11(StoryPanel, { status: storyStatus2, previewPlayback: runtime?.playback, available: !!available, controller, onError: (message) => setError(message) }, `${runtime?.instanceId ?? "none"}:${runtime?.generation ?? 0}:${storyStatus2?.storyHash ?? "none"}`) });
  const openStory = () => {
    setMaximizedPanel(null);
    setStoryRequest((value) => value + 1);
  };
  const openJobs = () => {
    setMaximizedPanel(null);
    setJobsRequest((value) => value + 1);
  };
  const jobsPane = /* @__PURE__ */ jsxs12("section", { ref: jobsRef, tabIndex: -1, className: "diagnostics", "aria-label": "Jobs and diagnostics", children: [
    /* @__PURE__ */ jsxs12("div", { className: "section-heading", children: [
      /* @__PURE__ */ jsx11("h2", { children: "Jobs & diagnostics" }),
      /* @__PURE__ */ jsxs12("span", { className: "subtle", children: [
        snapshot2.jobs.length,
        " jobs \xB7 ",
        sourceProblemCount,
        " diagnostics"
      ] })
    ] }),
    runtime?.fault && /* @__PURE__ */ jsxs12("p", { className: "error", role: "alert", children: [
      /* @__PURE__ */ jsx11("strong", { children: runtime.fault.code }),
      " \xB7 ",
      runtime.fault.message
    ] }),
    snapshot2.jobs.map((job) => /* @__PURE__ */ jsxs12("p", { className: job.fault ? "error" : "", children: [
      /* @__PURE__ */ jsx11("span", { className: "tag", children: job.state }),
      " ",
      job.summary,
      job.fault && !sourceDiagnosticFault(job.fault, sourceDiagnostics?.items ?? []) && ` \xB7 ${job.fault}`
    ] }, job.jobId)),
    sourceDiagnostics && /* @__PURE__ */ jsx11(ProblemsPanel, { diagnostics: sourceDiagnostics.items, snapshot: sourceDiagnostics.snapshot, visualSnapshots: sourceDiagnostics.visualSnapshots, onNavigate: (target) => {
      sourceDiagnostics.onNavigate(target);
      openPanelRef.current?.("source");
    } }),
    !runtime?.fault && snapshot2.jobs.length === 0 && !sourceProblemCount && /* @__PURE__ */ jsx11("p", { children: snapshot2.message ?? "No jobs reported." })
  ] });
  return /* @__PURE__ */ jsxs12(Fragment4, { children: [
    /* @__PURE__ */ jsxs12(
      Dialog2,
      {
        open: shortcutsOpen,
        onClose: closeShortcutReference,
        "aria-labelledby": "shortcut-reference-title",
        maxWidth: "sm",
        fullWidth: true,
        slotProps: { transition: { onExited: () => restoreFocus(shortcutsFocus) } },
        onKeyDown: (event) => {
          if (event.key === "Escape") event.stopPropagation();
        },
        children: [
          /* @__PURE__ */ jsx11(DialogTitle2, { id: "shortcut-reference-title", children: "Keyboard shortcuts" }),
          /* @__PURE__ */ jsx11(DialogContent2, { children: /* @__PURE__ */ jsx11("dl", { className: "shortcut-reference-list", children: shortcutReference.map((item) => /* @__PURE__ */ jsxs12("div", { children: [
            /* @__PURE__ */ jsx11("dt", { children: item.label }),
            /* @__PURE__ */ jsxs12("dd", { children: [
              /* @__PURE__ */ jsx11("kbd", { children: shortcutHint[item.command] }),
              item.command === "shortcut-reference" && /* @__PURE__ */ jsx11("small", { children: "Shift+/" })
            ] })
          ] }, item.command)) }) }),
          /* @__PURE__ */ jsx11(DialogActions2, { children: /* @__PURE__ */ jsx11(Button10, { onClick: closeShortcutReference, children: "Done" }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs12("div", { className: `studio ${compact ? "studio-expanded" : ""} ${windowState.fullscreen ? "studio-preview-fullscreen" : ""}`, children: [
      windowState.fullscreen && fullscreenHint && /* @__PURE__ */ jsx11("div", { className: "fullscreen-hint", role: "status", children: "Press Escape to exit fullscreen" }),
      /* @__PURE__ */ jsxs12("header", { className: "app-bar", hidden: windowState.fullscreen, children: [
        /* @__PURE__ */ jsx11("div", { className: "brand", children: /* @__PURE__ */ jsx11("strong", { children: "LUX" }) }),
        fileMenu,
        /* @__PURE__ */ jsx11("span", { className: "view-tools-host", ref: setToolsHost }),
        appCommands ?? /* @__PURE__ */ jsxs12("div", { className: "scene-heading", children: [
          /* @__PURE__ */ jsx11("span", { className: "eyebrow", children: "AUTHORING" }),
          /* @__PURE__ */ jsx11("span", { children: runtime?.sceneName ?? "No scene connected" })
        ] }),
        maximizedPanel && maximizedPanel !== "preview" && !windowState.fullscreen && /* @__PURE__ */ jsxs12(Button10, { color: "inherit", title: `Restore workspace (${shortcutHint["maximize-panel"]})`, onClick: () => toggleMaximized(), children: [
          "Restore workspace ",
          /* @__PURE__ */ jsx11("span", { className: "studio-shortcut-hint", "aria-hidden": "true", children: shortcutHint["maximize-panel"] })
        ] })
      ] }),
      appError && /* @__PURE__ */ jsx11(Alert2, { severity: "error", children: appError }),
      /* @__PURE__ */ jsx11("div", { className: "workspace", children: sourcePanel ? /* @__PURE__ */ jsx11(StudioDockShell, { onOpenPanelReady: bindOpenPanel, onTogglePanelReady: bindTogglePanel, onActivePanelChange: setFocusedPanel, onShortcutsHelp: openShortcutReference, toolsHost, compact, expandedPanel, showInspector: showMaximizedInspector, preview: previewPane, source: sourcePanel, library: libraryPanel ?? /* @__PURE__ */ jsx11("section", { "aria-label": "Shared component library", children: "Library unavailable." }), inspector: inspectorPane, story: storyPane, diagnostics: diagnosticsPane, jobs: jobsPane, graph: /* @__PURE__ */ jsx11(GraphPanel, { runtime, selected: selectedNodePath ? nodeKey(selectedNodePath) : null, onSelect: selectGraphNode }) }) : /* @__PURE__ */ jsxs12(Fragment4, { children: [
        previewPane,
        (!compact || showMaximizedInspector) && inspectorPane,
        (!compact || showMaximizedInspector) && diagnosticsPane
      ] }) }),
      !sourcePanel && !compact && jobsPane,
      /* @__PURE__ */ jsxs12("footer", { className: "status-bar", hidden: windowState.fullscreen || previewOnly, "aria-label": "Studio status", children: [
        /* @__PURE__ */ jsxs12("button", { type: "button", className: `status-item status-build ${status.build === "Build failed" ? "status-error" : ""}`, "aria-busy": status.building, "aria-label": `Build status: ${status.build}. Open Jobs and diagnostics`, onClick: openJobs, children: [
          /* @__PURE__ */ jsx11("span", { "aria-hidden": "true", className: status.building ? "status-spinner" : "status-build-icon", children: status.building ? "" : "\u21BB" }),
          /* @__PURE__ */ jsx11("span", { "aria-live": "polite", children: status.build })
        ] }),
        /* @__PURE__ */ jsxs12("button", { type: "button", className: `status-item ${status.problems ? "status-error" : ""}`, "aria-label": `Problems: ${status.problems}. Open Jobs and diagnostics`, onClick: openJobs, children: [
          /* @__PURE__ */ jsx11("span", { "aria-hidden": "true", children: "!" }),
          /* @__PURE__ */ jsxs12("span", { children: [
            status.problems,
            " ",
            status.problems === 1 ? "problem" : "problems"
          ] })
        ] }),
        sourceChanged && /* @__PURE__ */ jsx11("span", { className: "status-item", title: "Build to apply the source edits to Preview", children: "Source changed \xB7 Build to update" }),
        storyStatus2 && /* @__PURE__ */ jsxs12("button", { type: "button", className: "status-item status-story", "aria-label": `Story status: ${storyStatusLabel(storyStatus2)}. Open Story`, onClick: openStory, children: [
          /* @__PURE__ */ jsx11("span", { "aria-hidden": "true", children: "Story" }),
          /* @__PURE__ */ jsx11("span", { "aria-live": "polite", children: storyStatusLabel(storyStatus2) })
        ] }),
        ["Connecting", "Disconnected", "Failed"].includes(status.runtime) && /* @__PURE__ */ jsx11("button", { type: "button", className: "status-item status-runtime status-error", "aria-label": `Runtime status: ${status.runtime}. Open Jobs and diagnostics`, onClick: openJobs, children: status.runtime })
      ] })
    ] })
  ] });
}
var activeJobStates;
var init_renderer = __esm({
  "apps/studio/src/renderer.tsx"() {
    "use strict";
    init_InspectorBreadcrumb();
    init_GraphPanel();
    init_visual_model();
    init_theme();
    init_ParameterInspector();
    init_PerformanceStatus();
    init_preview();
    init_StoryPanel();
    init_service_client();
    init_StudioDockShell();
    init_renderer_snapshot();
    init_Disclosure();
    init_ProblemsPanel();
    init_studio_shortcuts();
    activeJobStates = /* @__PURE__ */ new Set(["queued", "pending", "running", "compiling", "initializing"]);
  }
});

// apps/studio/src/Confirmation.tsx
var Confirmation_exports = {};
__export(Confirmation_exports, {
  useDiscardConfirmation: () => useDiscardConfirmation
});
import { useCallback as useCallback2, useEffect as useEffect7, useRef as useRef10, useState as useState11 } from "react";
import { Button as Button11, Dialog as Dialog3, DialogActions as DialogActions3, DialogContent as DialogContent3, DialogContentText, DialogTitle as DialogTitle3 } from "@mui/material";
import { jsx as jsx12, jsxs as jsxs13 } from "react/jsx-runtime";
function useDiscardConfirmation() {
  const [action, setAction] = useState11(null);
  const pending = useRef10(null);
  const answer = useRef10(false);
  const settle = useCallback2((value) => {
    answer.current = value;
    setAction(null);
  }, []);
  const finish = useCallback2(() => {
    const resolve = pending.current;
    pending.current = null;
    resolve?.(answer.current);
  }, []);
  const confirm = useCallback2((next) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setAction(next);
    });
  }, []);
  useEffect7(() => () => {
    pending.current?.(false);
    pending.current = null;
  }, []);
  const dialog = /* @__PURE__ */ jsxs13(Dialog3, { open: action !== null, onClose: () => settle(false), slotProps: { transition: { onExited: finish } }, "aria-labelledby": "discard-title", onKeyDown: (event) => {
    if (event.key === "Escape") event.stopPropagation();
  }, children: [
    /* @__PURE__ */ jsx12(DialogTitle3, { id: "discard-title", children: "Discard unsaved changes?" }),
    /* @__PURE__ */ jsx12(DialogContent3, { children: /* @__PURE__ */ jsx12(DialogContentText, { children: action === "close" ? "Your unsaved changes will be lost when Lux closes." : action === "load-look" ? "Load this look and discard your unsaved scene changes?" : "Your unsaved changes will be lost if you open another scene." }) }),
    /* @__PURE__ */ jsxs13(DialogActions3, { children: [
      /* @__PURE__ */ jsx12(Button11, { autoFocus: true, onClick: () => settle(false), children: "Keep editing" }),
      /* @__PURE__ */ jsx12(Button11, { color: "error", onClick: () => settle(true), children: action === "close" ? "Discard and close" : action === "load-look" ? "Discard and load look" : "Discard and open" })
    ] })
  ] });
  return { confirm, dialog, isPending: () => pending.current !== null };
}
var init_Confirmation = __esm({
  "apps/studio/src/Confirmation.tsx"() {
    "use strict";
  }
});

// apps/studio/src/audio/AudioInputControl.tsx
var AudioInputControl_exports = {};
__export(AudioInputControl_exports, {
  AudioInputControl: () => AudioInputControl
});
import { Button as Button12, MenuItem as MenuItem6, Select as Select2 } from "@mui/material";
import { useEffect as useEffect8, useRef as useRef11, useState as useState12 } from "react";
import { jsx as jsx13, jsxs as jsxs14 } from "react/jsx-runtime";
function AudioInputControl({ provider, onError, configuration = defaultConfiguration }) {
  const [phase, setPhase] = useState12("disconnected");
  const [monitoring, setMonitoring] = useState12(() => provider.getMonitoring());
  const [devices, setDevices] = useState12([]);
  const [device, setDevice] = useState12(() => {
    try {
      return localStorage.getItem(devicePreference) ?? "";
    } catch {
      return "";
    }
  });
  const configurationKey = JSON.stringify(configuration), priorConfiguration = useRef11(configurationKey), currentConfiguration = useRef11(configurationKey), operation = useRef11(0), currentDevice = useRef11(device);
  currentConfiguration.current = configurationKey;
  currentDevice.current = device;
  useEffect8(() => provider.subscribe(() => {
    const snapshot2 = provider.getSnapshot();
    if (snapshot2.available && provider.getConnectedInputId) {
      const id3 = provider.getConnectedInputId() ?? "";
      setDevice(id3);
      currentDevice.current = id3;
    }
    setPhase((current) => snapshot2.available ? "connected" : current === "connected" ? "unavailable" : current);
    setMonitoring(provider.getMonitoring());
  }), [provider]);
  useEffect8(() => () => {
    operation.current++;
    void provider.dispose();
  }, [provider]);
  useEffect8(() => {
    let disposed = false, refreshId = 0;
    const refresh = async () => {
      const id3 = ++refreshId;
      try {
        const inputs = await provider.listInputs();
        if (disposed || id3 !== refreshId) return;
        setDevices(inputs);
        if (currentDevice.current && !inputs.some((row) => row.id === currentDevice.current)) onError("Previously selected audio input is unavailable. Choose another input.");
      } catch (error) {
        if (!disposed && id3 === refreshId) onError(`Audio inputs are unavailable. ${String(error)}`);
      }
    };
    const unsubscribe = provider.subscribeDevices(() => {
      void refresh();
    });
    void refresh();
    return () => {
      disposed = true;
      refreshId++;
      unsubscribe();
    };
  }, [provider, onError]);
  useEffect8(() => {
    if (priorConfiguration.current === configurationKey) return;
    priorConfiguration.current = configurationKey;
    const token = ++operation.current;
    void provider.disconnect().then(() => {
      if (token === operation.current) setPhase("disconnected");
    }).catch((error) => {
      if (token === operation.current) {
        setPhase("unavailable");
        onError(String(error));
      }
    });
  }, [configurationKey, provider, onError]);
  async function connect() {
    const token = ++operation.current, key2 = configurationKey;
    if (device && !devices.some((row) => row.id === device)) {
      setPhase("unavailable");
      onError("Previously selected audio input is unavailable. Choose another input.");
      return;
    }
    setPhase("connecting");
    onError("");
    try {
      await provider.connect(configuration, device || void 0);
      if (token !== operation.current || key2 !== currentConfiguration.current) return;
      setPhase("connected");
    } catch (error) {
      if (token === operation.current) {
        setPhase("unavailable");
        onError(String(error));
      }
    }
  }
  async function disconnect() {
    const token = ++operation.current;
    onError("");
    try {
      await provider.disconnect();
      if (token === operation.current) setPhase("disconnected");
    } catch (error) {
      if (token === operation.current) {
        setPhase("unavailable");
        onError(String(error));
      }
    }
  }
  async function toggleMonitoring() {
    try {
      setMonitoring(await provider.setMonitoring(!monitoring));
    } catch (error) {
      setMonitoring(provider.getMonitoring());
      onError(String(error));
    }
  }
  const label = phase === "connecting" ? "Connecting\u2026" : phase === "connected" ? "Connected" : phase === "unavailable" ? "Unavailable" : "Disconnected";
  const deviceLabel = devices.find((row) => row.id === device)?.label || (device ? "Previously selected input (unavailable)" : "Default input");
  return /* @__PURE__ */ jsxs14("span", { className: "audio-input-control", "aria-label": `Audio input ${label}`, children: [
    /* @__PURE__ */ jsx13("span", { className: "document-label", children: "Audio" }),
    /* @__PURE__ */ jsxs14(Select2, { title: deviceLabel, size: "small", value: device, disabled: phase === "connecting" || phase === "connected", "aria-label": "Audio input device", displayEmpty: true, onChange: (event) => {
      const next = String(event.target.value);
      setDevice(next);
      setPhase((current) => current === "unavailable" ? "disconnected" : current);
      onError("");
      try {
        if (next) localStorage.setItem(devicePreference, next);
        else localStorage.removeItem(devicePreference);
      } catch {
      }
    }, children: [
      /* @__PURE__ */ jsx13(MenuItem6, { value: "", children: "Default input" }),
      device && !devices.some((row) => row.id === device) ? /* @__PURE__ */ jsx13(MenuItem6, { value: device, disabled: true, children: "Previously selected input (unavailable)" }) : null,
      devices.map((row) => /* @__PURE__ */ jsx13(MenuItem6, { value: row.id, children: row.label }, row.id))
    ] }),
    phase === "connected" ? /* @__PURE__ */ jsx13(Button12, { size: "small", color: "inherit", "aria-pressed": monitoring, title: "Monitor audio through default speakers", onClick: () => void toggleMonitoring(), children: monitoring ? "Monitor on" : "Monitor" }) : null,
    /* @__PURE__ */ jsx13("span", { className: `audio-input-status ${phase}`, role: "status", "aria-live": "polite", "aria-label": "Audio input status", children: label }),
    phase === "connected" ? /* @__PURE__ */ jsx13(Button12, { size: "small", color: "inherit", onClick: () => void disconnect(), children: "Disconnect" }) : /* @__PURE__ */ jsx13(Button12, { size: "small", color: "inherit", disabled: phase === "connecting", onClick: () => void connect(), children: devices.length ? "Connect" : "Connect audio" })
  ] });
}
var defaultConfiguration, devicePreference;
var init_AudioInputControl = __esm({
  "apps/studio/src/audio/AudioInputControl.tsx"() {
    "use strict";
    defaultConfiguration = Object.freeze({ logicalInputId: "primary-audio", analyzer: Object.freeze({ version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 }) });
    devicePreference = "lux.audio.primary-device";
  }
});

// tests/studio/interactions.test.tsx
import test, { afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// tests/runtime/nested-graph-fixtures.ts
init_components();

// tests/runtime/graph-fixtures.ts
init_components();
var h = "a".repeat(64);
var h2 = "b".repeat(64);
var h3 = "c".repeat(64);
var image = { kind: "image", colorSpace: "linear-srgb", alphaMode: "premultiplied" };
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// tests/runtime/nested-graph-fixtures.ts
function meta(inputs = {}, outputs = { image }, controls = {}) {
  const ports2 = (types) => Object.fromEntries(Object.entries(types).map(([id3, type]) => [id3, { type, label: id3, description: id3 }]));
  return normalizeComponentDeclaration(clone({ declarationVersion: 1, key: "test/nested", label: "Nested", description: "Fixture", tags: [], inputs: ports2(inputs), outputs: ports2(outputs), controls, controlDescriptions: Object.fromEntries(Object.keys(controls).map((id3) => [id3, id3])), lifecycle: { state: "stateless", reset: "seed" } }));
}

// tests/studio/interactions.test.tsx
import { Fragment as Fragment5, jsx as jsx14, jsxs as jsxs15 } from "react/jsx-runtime";
var dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "http://studio.test/" });
for (const name2 of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "ShadowRoot", "DocumentFragment", "Event", "KeyboardEvent", "MouseEvent", "getComputedStyle"]) {
  Object.defineProperty(globalThis, name2, { configurable: true, value: dom.window[name2] });
}
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: dom.window.localStorage });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true });
var { render: renderUI, screen, cleanup, waitFor, fireEvent, act, within } = await import("@testing-library/react");
var { CacheProvider } = await import("@emotion/react");
var { default: createCache } = await import("@emotion/cache");
var createStyleCache = () => createCache({ key: "studio-test", container: document.head, speedy: false });
var styleCache = createStyleCache();
var render = (ui) => renderUI(/* @__PURE__ */ jsx14(CacheProvider, { value: styleCache, children: ui }));
var { userEvent } = await import("@testing-library/user-event");
var { StudioApp: StudioApp2 } = await Promise.resolve().then(() => (init_renderer(), renderer_exports));
var { createDisconnectedClient: createDisconnectedClient2 } = await Promise.resolve().then(() => (init_service_client(), service_client_exports));
var { useDiscardConfirmation: useDiscardConfirmation2 } = await Promise.resolve().then(() => (init_Confirmation(), Confirmation_exports));
afterEach(() => {
  cleanup();
  styleCache.sheet.flush();
  styleCache = createStyleCache();
});
after(() => dom.window.close());
test("RTL: frame bursts leave Performance responsive and applied controls publish immediately", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const fixture = service();
    render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
    const initialFrame = fixture.client.getSnapshot().authoring.frameId;
    await act(async () => {
      for (let frame = 100; frame <= 159; frame++) fixture.publish({ frameId: String(frame) });
    });
    assert.ok(screen.getByText(initialFrame));
    assert.equal(screen.queryByText("159"), null, "worker observations must not synchronously render the full UI");
    const summary = screen.getByText("Performance");
    fireEvent.click(summary);
    assert.equal(summary.parentElement.hasAttribute("open"), true);
    fireEvent.click(summary);
    assert.equal(summary.parentElement.hasAttribute("open"), false);
    await act(async () => context.mock.timers.tick(100));
    assert.ok(screen.getByText("159"));
    await act(async () => {
      fixture.publish({ frameId: "160" });
      fixture.publish({ intensity: 0.8 });
    });
    assert.equal(screen.getByRole("slider", { name: "Intensity" }).value, "0.8");
    assert.ok(screen.getByText("160"));
  } finally {
    context.mock.timers.reset();
  }
});
test("RTL: discard confirmation is an accessible in-app dialog with safe cancel, Escape and explicit approval", async () => {
  const answers = [];
  function Fixture() {
    const confirmation = useDiscardConfirmation2();
    return /* @__PURE__ */ jsxs15(Fragment5, { children: [
      confirmation.dialog,
      /* @__PURE__ */ jsx14("button", { onClick: () => void confirmation.confirm("open").then((answer) => answers.push(answer)), children: "Choose another scene" })
    ] });
  }
  const user = userEvent.setup({ document });
  render(/* @__PURE__ */ jsx14(Fixture, {}));
  await user.click(screen.getByRole("button", { name: "Choose another scene" }));
  assert.ok(screen.getByRole("dialog", { name: "Discard unsaved changes?" }));
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  await waitFor(() => assert.deepEqual(answers, [false]));
  assert.equal(screen.queryByRole("dialog"), null);
  await user.click(screen.getByRole("button", { name: "Choose another scene" }));
  await user.keyboard("{Escape}");
  await waitFor(() => assert.deepEqual(answers, [false, false]));
  assert.equal(screen.queryByRole("dialog"), null);
  await user.click(screen.getByRole("button", { name: "Choose another scene" }));
  await user.click(screen.getByRole("button", { name: "Discard and open" }));
  await waitFor(() => assert.deepEqual(answers, [false, false, true]));
});
test("RTL: code-defined controls expose independent values, numeric entry and defaults without Intensity", async () => {
  const fixture = service();
  const schema3 = [
    { id: "spikeHeight", type: "number", label: "Spike height", min: 0, max: 4, default: 1, step: 0.1, changeCost: "live" },
    { id: "noiseScale", type: "number", label: "Noise scale", min: 1, max: 20, default: 5, changeCost: "live" }
  ];
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: schema3, controlSchemaHash: "a".repeat(64), controls: { spikeHeight: 2, noiseScale: 7 }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  assert.equal(screen.queryByRole("slider", { name: "Intensity" }), null);
  assert.equal(within(document.querySelector(".inspector")).getAllByRole("slider").length, 2);
  for (const label of ["Spike height", "Noise scale"]) {
    const animate = screen.getByRole("button", { name: `Animate ${label}` });
    assert.equal(animate.disabled, false, "scene controls support animation without a component target");
    assert.equal(screen.getByRole("button", { name: `Reset ${label} to default` }).disabled, false);
  }
  fireEvent.change(screen.getByRole("spinbutton", { name: "Noise scale value" }), { target: { value: "12" } });
  fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Noise scale value" }), { key: "Enter" });
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  assert.deepEqual(fixture.calls[0]?.input, { requestId: fixture.calls[0]?.input.requestId, instanceId: "44ff55f0-8ea6-4fbf-89d5-665923f65cad", expectedGeneration: 2, expectedRevisionId: "revision-2", expectedControlSchemaHash: "a".repeat(64), values: { noiseScale: 12 }, mode: "live" });
  fireEvent.click(screen.getByRole("button", { name: "Reset Spike height to default" }));
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  assert.deepEqual(fixture.calls[1].input.values, { spikeHeight: 1 });
});
test("RTL: Boolean and dropdown controls expose typed values, descriptions and defaults without animation", async () => {
  const fixture = service();
  const schema3 = [
    { id: "trail", type: "boolean", label: "Trail", default: false, description: "Keep earlier frames visible.", changeCost: "live" },
    { id: "direction", type: "enum", label: "Direction", default: "forward", presentation: "dropdown", options: [
      { id: "forward", label: "Forward" },
      { id: "reverse", label: "Reverse", description: "Move back through the path." }
    ], changeCost: "live" }
  ];
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: schema3, controlSchemaHash: "c".repeat(64), controls: { trail: true, direction: "reverse" }, controlSequence: 0 });
  const user = userEvent.setup({ document });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const trail = screen.getByRole("switch", { name: "Trail" });
  assert.equal(trail.checked, true);
  assert.equal(screen.queryByRole("button", { name: "Animate Trail" }), null);
  assert.equal(screen.queryByRole("button", { name: "Animate Direction" }), null);
  assert.equal(screen.getByText("Trail").getAttribute("tabindex"), "0", "descriptions stay keyboard reachable");
  await user.click(trail);
  await waitFor(() => assert.deepEqual(fixture.calls[0].input.values, { trail: false }));
  await user.click(screen.getByRole("combobox", { name: "Direction value" }));
  const reverse = screen.getByRole("option", { name: "Reverse" });
  fireEvent.focus(reverse);
  assert.ok(await screen.findByRole("tooltip", { name: /Move back through the path/ }));
  await act(async () => {
    fireEvent.blur(reverse);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await user.click(screen.getByRole("option", { name: "Forward" }));
  await waitFor(() => assert.deepEqual(fixture.calls[1].input.values, { direction: "forward" }));
  await user.click(screen.getByRole("button", { name: "Reset Trail to default" }));
  await waitFor(() => assert.deepEqual(fixture.calls[2].input.values, { trail: false }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
});
test("RTL: trigger actions use one native button, isolate pending state and never mark persistent edits", async () => {
  const fixture = service(), pending = [], dirty = [];
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((resolve) => pending.push({ resolve }));
  };
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [
    { id: "regenerate", type: "trigger", label: "Regenerate flock", description: "Create a fresh flock arrangement.", changeCost: "live" },
    { id: "shufflePalette", type: "trigger", label: "Shuffle palette", changeCost: "live" }
  ], controlSchemaHash: "3".repeat(64), controls: {}, controlSequence: 0 });
  const user = userEvent.setup({ document });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3, controlEdits: { changed: () => dirty.push("changed"), track: () => dirty.push("track") } }));
  const regenerate = screen.getByRole("button", { name: "Run Regenerate flock" });
  const shuffle = screen.getByRole("button", { name: "Run Shuffle palette" });
  assert.equal(screen.queryByRole("button", { name: "Reset Regenerate flock to default" }), null);
  assert.equal(screen.queryByRole("button", { name: "Animate Regenerate flock" }), null);
  const regenerateLabel = screen.getByText("Regenerate flock");
  await act(async () => regenerateLabel.focus());
  assert.equal(document.activeElement, regenerateLabel);
  assert.ok(await screen.findByRole("tooltip", { name: /Create a fresh flock arrangement/ }));
  await act(async () => {
    fireEvent.blur(screen.getByText("Regenerate flock"));
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await user.click(regenerate);
  await waitFor(() => assert.equal(pending.length, 1));
  assert.equal(document.activeElement, regenerate, "pending must preserve the action focus");
  assert.equal(regenerate.getAttribute("aria-busy"), "true");
  assert.equal(regenerate.getAttribute("aria-disabled"), "true");
  assert.equal(shuffle.disabled, false, "another trigger remains available");
  assert.deepEqual(dirty, [], "commands never enter ControlEdits persistence tracking");
  const first = fixture.calls[0].input.commandId;
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  await user.click(regenerate);
  await user.keyboard("{Enter}");
  await user.keyboard("[Space]");
  assert.equal(fixture.calls.length, 1, "pending pointer and keyboard activation cannot duplicate the command");
  await act(async () => pending[0].resolve({ result: "applied" }));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "Run Regenerate flock" })));
  assert.equal(screen.queryByRole("status"), null, "an applied command has no optimistic or persistent success UI");
  regenerate.focus();
  await user.keyboard("{Enter}");
  await waitFor(() => assert.equal(pending.length, 2));
  await act(async () => pending[1].resolve({ result: "applied" }));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "Run Regenerate flock" })));
  regenerate.focus();
  await user.keyboard("[Space]");
  await waitFor(() => assert.equal(pending.length, 3));
  assert.equal(fixture.calls.length, 3, "pointer, Enter and Space each dispatch exactly once");
  assert.notEqual(fixture.calls[1].input.commandId, first);
  assert.notEqual(fixture.calls[2].input.commandId, fixture.calls[1].input.commandId);
  await act(async () => pending[2].resolve({ result: "applied" }));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "Run Regenerate flock" })));
  await user.click(screen.getByRole("button", { name: "Run Regenerate flock" }));
  await waitFor(() => assert.equal(pending.length, 4));
  await act(async () => fixture.update());
  const replacement = screen.getByRole("button", { name: "Run Regenerate flock" });
  assert.equal(replacement.getAttribute("aria-busy"), null, "a replaced runtime cancels obsolete pending UI");
  await act(async () => pending[3].resolve({ result: "applied" }));
  assert.equal(screen.getByRole("button", { name: "Run Regenerate flock" }), replacement);
  assert.deepEqual(dirty, []);
});
test("RTL: a trigger visibly requires the selected source to be the active Story visual", async () => {
  const fixture = service();
  fixture.publish({
    sdkVersion: "0.2.0",
    intensity: void 0,
    controlSchema: [
      { id: "regenerate", type: "trigger", label: "Regenerate flock", changeCost: "live" }
    ],
    controlSchemaHash: "5".repeat(64),
    controls: {},
    controlSequence: 0,
    selectedVisualId: "ambient",
    storySchedule: { committed: { visualId: "lead", activationId: 3 } }
  });
  const { ParameterInspector: ParameterInspector2 } = await Promise.resolve().then(() => (init_ParameterInspector(), ParameterInspector_exports)), { StudioController: StudioController2 } = await Promise.resolve().then(() => (init_service_client(), service_client_exports));
  const controller = new StudioController2(fixture.client), view = render(/* @__PURE__ */ jsx14(ParameterInspector2, { runtime: fixture.client.getSnapshot().authoring, available: true, client: fixture.client, controller, onError: () => {
  } }));
  let action = screen.getByRole("button", { name: "Run Regenerate flock" });
  assert.equal(action.disabled, true);
  const explanation = screen.getByText("Triggers require the active Story visual (lead). Select that source to run this action.");
  assert.equal(action.getAttribute("aria-describedby"), explanation.id);
  fireEvent.click(action);
  assert.equal(fixture.calls.length, 0);
  fixture.publish({ selectedVisualId: "lead" });
  view.rerender(/* @__PURE__ */ jsx14(CacheProvider, { value: styleCache, children: /* @__PURE__ */ jsx14(ParameterInspector2, { runtime: fixture.client.getSnapshot().authoring, available: true, client: fixture.client, controller, onError: () => {
  } }) }));
  action = screen.getByRole("button", { name: "Run Regenerate flock" });
  assert.equal(action.disabled, false);
  assert.equal(screen.queryByText("Triggers require the active Story visual (lead). Select that source to run this action."), null);
});
test("RTL: an uncertain trigger failure retries manually with the same command ID", async () => {
  const fixture = service(), outcomes = [], errors = [];
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((resolve, reject) => outcomes.push({ resolve, reject }));
  };
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [
    { id: "burst", type: "trigger", label: "Burst particles", changeCost: "live" }
  ], controlSchemaHash: "4".repeat(64), controls: {}, controlSequence: 0 });
  const { ParameterInspector: ParameterInspector2 } = await Promise.resolve().then(() => (init_ParameterInspector(), ParameterInspector_exports)), { StudioController: StudioController2 } = await Promise.resolve().then(() => (init_service_client(), service_client_exports));
  const user = userEvent.setup({ document });
  render(/* @__PURE__ */ jsx14(ParameterInspector2, { runtime: fixture.client.getSnapshot().authoring, available: true, client: fixture.client, controller: new StudioController2(fixture.client), onError: (error) => errors.push(error) }));
  await user.click(screen.getByRole("button", { name: "Run Burst particles" }));
  await waitFor(() => assert.equal(outcomes.length, 1));
  const uncertainId = fixture.calls[0].input.commandId;
  await act(async () => outcomes[0].reject(Object.assign(Error("Receipt timed out."), { code: "TRIGGER_TIMEOUT" })));
  const retry = await screen.findByRole("button", { name: "Retry Burst particles" });
  assert.equal(fixture.calls.length, 1, "timeout never auto-retries");
  assert.match(errors.at(-1) ?? "", /Receipt timed out/);
  await user.click(retry);
  await waitFor(() => assert.equal(outcomes.length, 2));
  assert.equal(fixture.calls[1].input.commandId, uncertainId, "manual retry preserves idempotency identity");
  await act(async () => outcomes[1].resolve({ result: "applied" }));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "Run Burst particles" })));
  await user.click(screen.getByRole("button", { name: "Run Burst particles" }));
  await waitFor(() => assert.equal(outcomes.length, 3));
  const rejectedId = fixture.calls[2].input.commandId;
  await act(async () => outcomes[2].reject(Object.assign(Error("Trigger rejected."), { code: "TRIGGER_REJECTED" })));
  const runAgain = await screen.findByRole("button", { name: "Run Burst particles" });
  await user.click(runAgain);
  await waitFor(() => assert.equal(outcomes.length, 4));
  assert.notEqual(fixture.calls[3].input.commandId, rejectedId, "a definite failure starts a fresh activation");
  await act(async () => outcomes[3].resolve({ result: "applied" }));
});
test("RTL: a selected component trigger targets its canonical node without a persisted value", async () => {
  const fixture = service(), leafMetadata = meta({}, { image }, { reseed: { type: "trigger", label: "Reseed component" } }), trigger = leafMetadata.controls[0];
  const errors = [];
  const rootHash = "a".repeat(64), leafHash = "b".repeat(64), schemaHash = "c".repeat(64), nodeId = "11111111-1111-4111-8111-111111111111";
  const rootMetadata = meta({}, { image });
  fixture.publish({
    sdkVersion: "0.4.0",
    intensity: void 0,
    controlSchema: [],
    controlSchemaHash: "d".repeat(64),
    controls: {},
    controlSequence: 0,
    composition: { version: 2, declaration: { definitions: { leaf: "./leaf.ts" }, nodes: [{ id: nodeId, definition: "leaf" }], edges: [], output: { nodeId, portId: "image" }, expose: [] }, definitionNames: { leaf: leafHash }, graph: { version: 2, rootDefinitionHash: rootHash, outputPort: "image" }, definitions: {
      [rootHash]: { kind: "graph", metadata: rootMetadata, body: { nodes: [{ id: nodeId, definitionHash: leafHash, controlDefaults: {} }], edges: [], inputBindings: {}, outputBindings: { image: { nodeId, portId: "image" } }, controlBindings: {} } },
      [leafHash]: { kind: "code", metadata: leafMetadata }
    }, publicControls: [], publicControlBindings: {}, nodes: [{ nodePath: [nodeId], definitionHash: leafHash, schema: [trigger], schemaHash }] },
    nodeControls: { sourceHash: "revision-2", nodes: [{ nodePath: [nodeId], definitionHash: leafHash, schema: [trigger], schemaHash, values: {} }] }
  });
  const { ParameterInspector: ParameterInspector2 } = await Promise.resolve().then(() => (init_ParameterInspector(), ParameterInspector_exports)), { StudioController: StudioController2 } = await Promise.resolve().then(() => (init_service_client(), service_client_exports));
  render(/* @__PURE__ */ jsx14(ParameterInspector2, { runtime: fixture.client.getSnapshot().authoring, available: true, client: fixture.client, controller: new StudioController2(fixture.client), onError: (error) => errors.push(error), nodePath: [nodeId] }));
  const action = screen.getByRole("button", { name: "Run Reseed component" });
  fireEvent.click(action);
  await waitFor(() => assert.ok(fixture.calls.length || errors.some(Boolean)));
  assert.deepEqual(errors.filter(Boolean), []);
  assert.equal(fixture.calls[0]?.name, "lux.node.trigger.fire");
  assert.deepEqual(fixture.calls[0].input.nodePath, [nodeId]);
  assert.equal(fixture.calls[0].input.controlId, "reseed");
  assert.deepEqual(fixture.client.getSnapshot().authoring?.nodeControls?.nodes[0]?.values, {});
});
function storyStatus(overrides = {}) {
  const beats = [{ id: "arrival", label: "Arrival", timing: { kind: "timed", durationSeconds: 10 } }, { id: "hold", label: "Hold", timing: { kind: "sustained" } }];
  const sequence = [{ id: "arrival-a", beatId: "arrival", follow: { kind: "after", seconds: 4 } }, { id: "hold-a", beatId: "hold", follow: { kind: "manual" } }, { id: "hold-b", beatId: "hold", follow: { kind: "after", seconds: 5 } }];
  return {
    definition: { version: 1, beats, sequence },
    storyHash: "a".repeat(64),
    storyRevision: 4,
    frame: { state: "normal", storyEpoch: 1 },
    phase: "paused",
    autoAdvance: false,
    loop: false,
    effectiveAdvancing: false,
    sequence: { state: "detached", occurrenceId: null, index: null, nextOccurrenceId: null, dwellElapsedSeconds: 0, dwellRemainingSeconds: null, awaitingCue: false },
    resumeCandidates: [],
    disabledReasons: {},
    ...overrides
  };
}
function storySchedule(overrides = {}) {
  const definition2 = {
    version: 2,
    normalVisualId: "lead",
    crossfadeSeconds: 0.35,
    beats: [{ id: "arrival", label: "Arrival", timing: { kind: "timed", durationSeconds: 10 }, visualId: "ambient" }, { id: "hold", label: "Hold", timing: { kind: "sustained" }, visualId: "lead" }],
    sequence: [{ id: "arrival-a", beatId: "arrival", follow: { kind: "manual" }, visualId: "ambient" }]
  };
  const committed = {
    slotId: "slot-in",
    visualId: "ambient",
    beatId: "arrival",
    occurrenceId: "arrival-a",
    activationId: 3,
    storyEpoch: 2,
    frame: { state: "active", storyEpoch: 2, beatId: "arrival", activationId: 3, occurrenceId: "arrival-a", elapsedSeconds: 2, localTimeSeconds: 2, progress: 0.2 }
  };
  return {
    instanceId: "instance",
    generation: 2,
    scheduleHash: "b".repeat(64),
    capsuleHash: "c".repeat(64),
    definition: definition2,
    storyHash: "a".repeat(64),
    storyRevision: 5,
    visualCapabilities: [{ visualId: "lead", storyCapability: { version: 1, beats: [{ id: "hold", kind: "sustained", seek: "none" }] } }, { visualId: "ambient", storyCapability: { version: 1, beats: [{ id: "arrival", kind: "timed", seek: "direct" }] } }],
    phase: "running",
    autoAdvance: true,
    loop: false,
    effectiveAdvancing: true,
    committed,
    outgoing: null,
    incoming: null,
    crossfadeProgress: null,
    pendingPreparation: null,
    dueNext: null,
    preparationFailure: null,
    sequence: { state: "attached", occurrenceId: "arrival-a", index: 0, nextOccurrenceId: null, dwellElapsedSeconds: 0, dwellRemainingSeconds: null, awaitingCue: true },
    disabledReasons: {},
    resources: { slots: 2, slotStates: { preparing: 0, ready: 0, active: 1, retiring: 0, unsettled: 0 }, pendingCreates: 0, storyTargetBytes: 1, assetLeases: 0, assetLeaseBytes: 0, assetStagingJobs: 0, assetStagingBytes: 0, pendingImports: 0, ownedModuleURLs: 0, pendingCallbacks: 0, gpuSubmissions: 0, readbackGrants: 0, readbackBytes: 0 },
    ...overrides
  };
}
test("RTL: Story v2 exposes source-specific capabilities, overlap and preparation state", async () => {
  const outgoing = { slotId: "slot-out", visualId: "lead", beatId: "hold", occurrenceId: null, activationId: 2, storyEpoch: 1, frame: { state: "active", storyEpoch: 1, beatId: "hold", activationId: 2, occurrenceId: null, elapsedSeconds: 5, localTimeSeconds: null, progress: null } };
  const status = storySchedule({ outgoing, crossfadeProgress: 0.4, disabledReasons: { launch: { code: "STORY_CAPACITY", message: "Wait for a Story slot to retire." } } });
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  const view = render(/* @__PURE__ */ jsx14(StoryPanel2, { status, available: true, controller: { storyTransport: async () => ({}) }, onError: () => {
  } }));
  assert.ok(screen.getByText("Source ambient"));
  assert.ok(screen.getByText(/Transitioning from source lead to ambient · 40%/));
  assert.ok(screen.getByText(/source ambient · timed/));
  assert.ok(screen.getByText(/source lead · sustained/));
  assert.ok(screen.getByText("Wait for a Story slot to retire."));
  assert.equal(screen.getByRole("button", { name: "Launch Arrival" }).disabled, true);
  view.rerender(/* @__PURE__ */ jsx14(CacheProvider, { value: styleCache, children: /* @__PURE__ */ jsx14(StoryPanel2, { status: storySchedule({ committed: null, pendingPreparation: { token: "prepare-1", phase: "preparing", visualId: "ambient", beatId: "arrival", occurrenceId: "arrival-a", commandId: null, cancelled: false } }), available: true, controller: { storyTransport: async () => ({}) }, onError: () => {
  } }) }));
  assert.ok(screen.getByText("Preparing ambient"));
  assert.ok(screen.getByText("Preparing source ambient."));
});
test("RTL: Story v2 reports a failed next-source preparation while keeping the committed preview active", async () => {
  const status = storySchedule({ preparationFailure: { visualId: "lead", beatId: "hold", occurrenceId: null, code: "STORY_PREPARATION_FAILED", message: "Shader compilation failed." } });
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  render(/* @__PURE__ */ jsx14(StoryPanel2, { status, available: true, controller: { storyTransport: async () => ({}) }, onError: () => {
  } }));
  assert.ok(screen.getByRole("alert").textContent?.includes("Could not prepare source lead for Hold. Shader compilation failed."));
  assert.ok(screen.getByText("Source ambient"), "the committed source remains the active preview status");
  assert.ok(screen.getByText("2.0s active"));
  assert.equal(screen.queryByRole("button", { name: /Retry/ }), null, "preparation failure does not invent a retry command");
  assert.ok(screen.getByRole("button", { name: "Launch Hold" }), "the normal launch action remains the explicit retry path");
});
test("RTL: Story ribbon keeps selection separate from the attached occurrence and shows sustained dwell", async () => {
  const status = storyStatus({
    frame: { state: "active", storyEpoch: 2, beatId: "hold", activationId: 3, occurrenceId: "hold-a", elapsedSeconds: 12, localTimeSeconds: null, progress: null },
    phase: "running",
    autoAdvance: true,
    effectiveAdvancing: true,
    sequence: { state: "attached", occurrenceId: "hold-a", index: 1, nextOccurrenceId: "hold-b", dwellElapsedSeconds: 0, dwellRemainingSeconds: null, awaitingCue: true }
  });
  const calls = [];
  const controller = { storyTransport: async (...args) => {
    calls.push(args);
    return {};
  } };
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  render(/* @__PURE__ */ jsx14(StoryPanel2, { status, available: true, controller, onError: () => {
  } }));
  const ribbon = screen.getByRole("list", { name: "Story sequence" }), rows = within(ribbon).getAllByRole("button");
  assert.equal(rows.length, 3);
  assert.equal(rows[1].getAttribute("aria-current"), "step");
  assert.equal(rows[1].getAttribute("aria-pressed"), "true");
  fireEvent.click(rows[2]);
  assert.equal(rows[2].getAttribute("aria-pressed"), "true", "selection moves without moving output");
  assert.equal(rows[1].getAttribute("aria-current"), "step", "the transport cursor remains on the attached occurrence");
  assert.equal(calls.length, 0);
  assert.ok(screen.getAllByText("Awaiting cue").length >= 2);
  assert.ok(screen.getByText("Staying on beat"));
  assert.ok(screen.getByText("Auto-advance"), "the sequence switch has a visible label");
  const announcement = document.querySelector('.story-transition[aria-live="polite"]');
  assert.ok(announcement);
  assert.doesNotMatch(announcement.textContent ?? "", /12\.0s active/, "advancing elapsed time stays outside the live transition announcement");
  assert.ok(screen.getByText("12.0s active"));
  assert.equal(screen.queryByRole("slider", { name: /Local time/ }), null, "sustained beats have no fabricated local timeline");
  assert.ok(screen.getByRole("button", { name: /Start here: Hold — occurrence 3 of 3/ }));
  assert.ok(screen.getByRole("button", { name: "Return to normal" }));
});
test("RTL: Story ribbon shows scheduled dwell progress independently of a sustained beat", async () => {
  const status = storyStatus({
    frame: { state: "active", storyEpoch: 2, beatId: "hold", activationId: 3, occurrenceId: "hold-b", elapsedSeconds: 20, localTimeSeconds: null, progress: null },
    phase: "running",
    autoAdvance: true,
    effectiveAdvancing: true,
    sequence: { state: "attached", occurrenceId: "hold-b", index: 2, nextOccurrenceId: null, dwellElapsedSeconds: 2, dwellRemainingSeconds: 3, awaitingCue: false }
  });
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  render(/* @__PURE__ */ jsx14(StoryPanel2, { status, available: true, controller: { storyTransport: async () => ({}) }, onError: () => {
  } }));
  const progress = screen.getByRole("progressbar", { name: "Dwell for Hold \u2014 occurrence 3 of 3" });
  assert.equal(progress.getAttribute("aria-valuenow"), "40");
  assert.ok(screen.getByText("3.0s remaining"));
  assert.ok(screen.getByText("Staying on beat"));
});
test("RTL: uncertain Story transport exposes an explicit exact retry", async () => {
  const status = storyStatus(), calls = [], pending = [];
  const controller = { storyTransport: (...args) => {
    calls.push(args);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  } };
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  render(/* @__PURE__ */ jsx14(StoryPanel2, { status, available: true, controller, onError: () => {
  } }));
  fireEvent.click(screen.getByRole("button", { name: "Start story" }));
  await waitFor(() => assert.equal(calls.length, 1));
  await act(async () => pending[0].reject(Object.assign(Error("Story receipt timed out."), { code: "STORY_TIMEOUT" })));
  assert.equal(calls.length, 1, "an uncertain command is never retried automatically");
  fireEvent.click(await screen.findByRole("button", { name: "Retry start story" }));
  await waitFor(() => assert.equal(calls.length, 2));
  assert.deepEqual(calls[1], calls[0], "explicit retry preserves action, command ID and expected revision");
  await act(async () => pending[1].resolve({ receipt: {}, currentStatus: status }));
});
test("RTL: timed Story scrub admits one seek and replaces the queued target with the latest position", async () => {
  let status = storyStatus({ storyRevision: 7, frame: { state: "active", storyEpoch: 2, beatId: "arrival", activationId: 4, occurrenceId: null, elapsedSeconds: 2, localTimeSeconds: 2, progress: 0.2 }, phase: "running" });
  const calls = [], pending = [];
  const controller = { storyTransport: (...args) => {
    calls.push(args);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  } };
  const errors = [];
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  render(/* @__PURE__ */ jsx14(StoryPanel2, { status, available: true, controller, onError: (error) => errors.push(error) }));
  const slider = screen.getByRole("slider", { name: "Local time for Arrival" });
  const local = document.querySelector(".story-local-time"), beats = document.querySelector(".story-beats");
  assert.ok(local.compareDocumentPosition(beats) & Node.DOCUMENT_POSITION_FOLLOWING, "active timed controls precede the full Beats list");
  fireEvent.change(slider, { target: { value: "3" } });
  fireEvent.change(slider, { target: { value: "6" } });
  fireEvent.change(slider, { target: { value: "8" } });
  await waitFor(() => assert.equal(calls.length, 1));
  assert.deepEqual(calls[0][0], { action: "seek", localTimeSeconds: 3 });
  assert.equal(calls[0][2], 7);
  status = storyStatus({ ...status, storyRevision: 8, frame: { ...status.frame, localTimeSeconds: 3, progress: 0.3 } });
  await act(async () => pending[0].resolve({ result: "applied", commandId: calls[0][1], action: calls[0][0], storyRevision: 8, frameId: "11", timeSeconds: 2, story: status.frame, currentStatus: status }));
  await waitFor(() => assert.equal(calls.length, 2));
  assert.deepEqual(calls[1][0], { action: "seek", localTimeSeconds: 8 });
  assert.equal(calls[1][2], 8);
  fireEvent.pointerDown(slider, { pointerId: 1 });
  fireEvent.change(slider, { target: { value: "9" } });
  fireEvent.keyDown(slider, { key: "Escape" });
  fireEvent.change(slider, { target: { value: "7" } });
  fireEvent.pointerUp(slider, { pointerId: 1 });
  status = storyStatus({ ...status, storyRevision: 9, frame: { ...status.frame, localTimeSeconds: 8, progress: 0.8 } });
  await act(async () => pending[1].resolve({ result: "applied", commandId: calls[1][1], action: calls[1][0], storyRevision: 9, frameId: "12", timeSeconds: 2, story: status.frame, currentStatus: status }));
  await act(async () => {
  });
  assert.equal(calls.length, 2, "Escape clears the unsent target");
  assert.equal(slider.value, "8");
  assert.deepEqual(errors, []);
});
test("RTL: an acknowledgement from an earlier Story activation cannot overwrite the current scrub", async () => {
  const first = storyStatus({ storyRevision: 7, frame: { state: "active", storyEpoch: 2, beatId: "arrival", activationId: 4, occurrenceId: null, elapsedSeconds: 2, localTimeSeconds: 2, progress: 0.2 }, phase: "running" });
  const second = storyStatus({ storyRevision: 8, frame: { state: "active", storyEpoch: 2, beatId: "arrival", activationId: 5, occurrenceId: null, elapsedSeconds: 6, localTimeSeconds: 6, progress: 0.6 }, phase: "running" });
  const calls = [], pending = [];
  const controller = { storyTransport: (...args) => {
    calls.push(args);
    return new Promise((resolve) => pending.push({ resolve }));
  } };
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  const view = render(/* @__PURE__ */ jsx14(StoryPanel2, { status: first, available: true, controller, onError: () => {
  } }));
  fireEvent.change(screen.getByRole("slider", { name: "Local time for Arrival" }), { target: { value: "3" } });
  await waitFor(() => assert.equal(calls.length, 1));
  view.rerender(/* @__PURE__ */ jsx14(CacheProvider, { value: styleCache, children: /* @__PURE__ */ jsx14(StoryPanel2, { status: second, available: true, controller, onError: () => {
  } }) }));
  const current = screen.getByRole("slider", { name: "Local time for Arrival" });
  assert.equal(current.value, "6");
  const acknowledged = storyStatus({ ...first, storyRevision: 9, frame: { ...first.frame, localTimeSeconds: 3, progress: 0.3 } });
  await act(async () => pending[0].resolve({ receipt: {}, currentStatus: acknowledged }));
  assert.equal(current.value, "6", "the old activation acknowledgement cannot replace the new activation position");
  fireEvent.change(current, { target: { value: "7" } });
  await waitFor(() => assert.equal(calls.length, 2));
  assert.deepEqual(calls[1][0], { action: "seek", localTimeSeconds: 7 });
  assert.equal(calls[1][2], 8);
});
test("RTL: a rejected seek reconciles a newer revision on the same Story activation", async () => {
  const first = storyStatus({ storyRevision: 7, frame: { state: "active", storyEpoch: 2, beatId: "arrival", activationId: 4, occurrenceId: null, elapsedSeconds: 2, localTimeSeconds: 2, progress: 0.2 }, phase: "running" });
  const newer = storyStatus({ storyRevision: 8, frame: { state: "active", storyEpoch: 2, beatId: "arrival", activationId: 4, occurrenceId: null, elapsedSeconds: 6, localTimeSeconds: 6, progress: 0.6 }, phase: "paused" });
  const calls = [], pending = [];
  const controller = { storyTransport: (...args) => {
    calls.push(args);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  } }, errors = [];
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  const view = render(/* @__PURE__ */ jsx14(StoryPanel2, { status: first, available: true, controller, onError: (error) => errors.push(error) }));
  fireEvent.change(screen.getByRole("slider", { name: "Local time for Arrival" }), { target: { value: "3" } });
  await waitFor(() => assert.equal(calls.length, 1));
  view.rerender(/* @__PURE__ */ jsx14(CacheProvider, { value: styleCache, children: /* @__PURE__ */ jsx14(StoryPanel2, { status: newer, available: true, controller, onError: (error) => errors.push(error) }) }));
  await act(async () => pending[0].reject(Object.assign(Error("Story changed."), { code: "STORY_CHANGED" })));
  const slider = screen.getByRole("slider", { name: "Local time for Arrival" });
  assert.equal(slider.value, "6", "a failed stale seek restores the latest authoritative position");
  fireEvent.change(slider, { target: { value: "7" } });
  await waitFor(() => assert.equal(calls.length, 2));
  assert.deepEqual(calls[1][0], { action: "seek", localTimeSeconds: 7 });
  assert.equal(calls[1][2], 8, "the next seek uses the latest rendered revision");
  assert.deepEqual(errors, ["Story changed."]);
});
test("RTL: a sub-10ms timed Story beat retains a usable local-time step and readable position", async () => {
  const tiny = storyStatus({ definition: { version: 1, beats: [{ id: "spark", label: "Spark", timing: { kind: "timed", durationSeconds: 5e-3 } }], sequence: [] }, frame: { state: "active", storyEpoch: 2, beatId: "spark", activationId: 1, occurrenceId: null, elapsedSeconds: 25e-4, localTimeSeconds: 25e-4, progress: 0.5 } });
  const calls = [], controller = { storyTransport: (...args) => {
    calls.push(args);
    return new Promise(() => {
    });
  } };
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  render(/* @__PURE__ */ jsx14(StoryPanel2, { status: tiny, available: true, controller, onError: () => {
  } }));
  const slider = screen.getByRole("slider", { name: "Local time for Spark" });
  assert.equal(slider.max, "0.005");
  assert.equal(slider.step, "0.00005");
  assert.ok(screen.getByText("2.5ms / 5ms"));
  fireEvent.change(slider, { target: { value: ".003" } });
  await waitFor(() => assert.equal(calls.length, 1));
  assert.deepEqual(calls[0][0], { action: "seek", localTimeSeconds: 3e-3 });
});
test("RTL: segmented enum uses one roving tab stop and keyboard selection by stable option ID", async () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [{
    id: "pattern",
    type: "enum",
    label: "Pattern",
    default: "dots",
    presentation: "segmented",
    options: [{ id: "dots", label: "Dots" }, { id: "lines", label: "Lines" }, { id: "grid", label: "A very long grid label", description: "A regular grid." }],
    changeCost: "live"
  }], controlSchemaHash: "d".repeat(64), controls: { pattern: "lines" }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const group2 = screen.getByRole("group", { name: "Pattern value" });
  const choices = within(group2).getAllByRole("button");
  assert.deepEqual(choices.map((choice) => choice.tabIndex), [-1, 0, -1]);
  choices[1].focus();
  fireEvent.keyDown(choices[1], { key: "End" });
  assert.equal(document.activeElement, choices[2]);
  assert.ok(await screen.findByRole("tooltip", { name: /A regular grid/ }));
  assert.ok(screen.getByRole("button", { name: "A very long grid label", description: /A regular grid/ }));
  fireEvent.keyDown(choices[2], { key: "Enter" });
  await waitFor(() => assert.deepEqual(fixture.calls[0].input.values, { pattern: "grid" }));
  await act(async () => {
  });
  assert.ok(screen.getByRole("button", { name: "A very long grid label" }));
  await act(async () => {
    fireEvent.blur(choices[2]);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
});
test("RTL: radio enum exposes a radiogroup and arrow keys select the next stable option ID", async () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [{
    id: "quality",
    type: "enum",
    label: "Quality",
    default: "balanced",
    presentation: "radio",
    options: [{ id: "fast", label: "Fast" }, { id: "balanced", label: "Balanced" }, { id: "fine", label: "Fine", description: "Use the highest detail." }],
    changeCost: "live"
  }], controlSchemaHash: "e".repeat(64), controls: { quality: "balanced" }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const group2 = screen.getByRole("radiogroup", { name: "Quality value" });
  const radios = within(group2).getAllByRole("radio");
  assert.deepEqual(radios.map((radio) => radio.tabIndex), [-1, 0, -1]);
  fireEvent.focus(radios[1]);
  fireEvent.keyDown(radios[1], { key: "ArrowRight" });
  assert.ok(await screen.findByRole("tooltip", { name: /Use the highest detail/ }));
  assert.ok(screen.getByRole("radio", { name: "Fine", description: /Use the highest detail/ }));
  await waitFor(() => assert.deepEqual(fixture.calls[0].input.values, { quality: "fine" }));
  await act(async () => {
  });
  assert.equal(document.activeElement, radios[2]);
  await act(async () => {
    fireEvent.blur(radios[2]);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
});
test("RTL: an older Boolean acknowledgement cannot revert a newer local edit", async () => {
  const fixture = service(), pending = [];
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((resolve) => pending.push({ resolve }));
  };
  const schema3 = [{ id: "trail", type: "boolean", label: "Trail", default: false, changeCost: "live" }];
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: schema3, controlSchemaHash: "f".repeat(64), controls: { trail: true }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const trail = screen.getByRole("switch", { name: "Trail" });
  fireEvent.click(trail);
  await waitFor(() => assert.equal(pending.length, 1));
  fireEvent.click(trail);
  assert.equal(trail.checked, true);
  await act(async () => {
    fixture.publish({ controls: { trail: false }, controlSequence: 1 });
    pending[0].resolve({ accepted: true });
  });
  await waitFor(() => assert.equal(pending.length, 2));
  assert.equal(trail.checked, true, "the first applied value must not overwrite the second pending intent");
  await act(async () => {
    fixture.publish({ controls: { trail: true }, controlSequence: 2 });
    pending[1].resolve({ accepted: true });
  });
  assert.equal(trail.checked, true);
});
for (const presentation of ["segmented", "radio"]) test(`RTL: an older acknowledgement preserves a newer ${presentation} enum selection and roving tab stop`, async () => {
  const fixture = service(), pending = [];
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((resolve) => pending.push({ resolve }));
  };
  fixture.publish({
    sdkVersion: "0.2.0",
    intensity: void 0,
    controlSchema: [{
      id: "pattern",
      type: "enum",
      label: "Pattern",
      default: "lines",
      presentation,
      options: [{ id: "dots", label: "Dots" }, { id: "lines", label: "Lines" }, { id: "grid", label: "Grid" }],
      changeCost: "live"
    }],
    controlSchemaHash: "1".repeat(64),
    controls: { pattern: "lines" },
    controlSequence: 0
  });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const group2 = screen.getByRole(presentation === "radio" ? "radiogroup" : "group", { name: "Pattern value" }), role = presentation === "radio" ? "radio" : "button";
  const options = within(group2).getAllByRole(role);
  fireEvent.focus(options[2]);
  fireEvent.click(options[2]);
  await waitFor(() => assert.equal(pending.length, 1));
  fireEvent.focus(options[0]);
  fireEvent.click(options[0]);
  const selected = (element) => presentation === "radio" ? element.checked : element.getAttribute("aria-pressed") === "true";
  assert.equal(selected(options[0]), true);
  assert.deepEqual(options.map((option) => option.tabIndex), [0, -1, -1]);
  await act(async () => {
    fixture.publish({ controls: { pattern: "grid" }, controlSequence: 1 });
    pending[0].resolve({ accepted: true });
  });
  await waitFor(() => assert.equal(pending.length, 2));
  assert.equal(selected(options[0]), true, "the first applied value must not overwrite the second pending enum intent");
  assert.deepEqual(options.map((option) => option.tabIndex), [0, -1, -1], "the old acknowledgement must not move the roving tab stop");
  await act(async () => {
    fixture.publish({ controls: { pattern: "dots" }, controlSequence: 2 });
    pending[1].resolve({ accepted: true });
  });
});
for (const presentation of ["segmented", "radio"]) test(`RTL: a rejected ${presentation} enum edit restores its confirmed selection and roving tab stop`, async () => {
  const fixture = service();
  fixture.fail();
  fixture.publish({
    sdkVersion: "0.2.0",
    intensity: void 0,
    controlSchema: [{
      id: "pattern",
      type: "enum",
      label: "Pattern",
      default: "lines",
      presentation,
      options: [{ id: "dots", label: "Dots" }, { id: "lines", label: "Lines" }, { id: "grid", label: "Grid" }],
      changeCost: "live"
    }],
    controlSchemaHash: "2".repeat(64),
    controls: { pattern: "lines" },
    controlSequence: 0
  });
  const { ParameterInspector: ParameterInspector2 } = await Promise.resolve().then(() => (init_ParameterInspector(), ParameterInspector_exports)), { StudioController: StudioController2 } = await Promise.resolve().then(() => (init_service_client(), service_client_exports));
  render(/* @__PURE__ */ jsx14(ParameterInspector2, { runtime: fixture.client.getSnapshot().authoring, available: true, client: fixture.client, controller: new StudioController2(fixture.client), onError: () => {
  } }));
  const group2 = screen.getByRole(presentation === "radio" ? "radiogroup" : "group", { name: "Pattern value" }), role = presentation === "radio" ? "radio" : "button";
  const options = within(group2).getAllByRole(role), selected = (element) => presentation === "radio" ? element.checked : element.getAttribute("aria-pressed") === "true";
  fireEvent.focus(options[2]);
  fireEvent.click(options[2]);
  await waitFor(() => assert.equal(selected(options[1]), true));
  assert.deepEqual(fixture.calls[0].input.values, { pattern: "grid" });
  assert.deepEqual(options.map((option) => option.tabIndex), [-1, 0, -1]);
});
test("RTL: a flat control can add the strict shared-audio binding", async () => {
  const fixture = service(), priorAnimationFrame = globalThis.requestAnimationFrame, user = userEvent.setup({ document });
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  try {
    render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
    fireEvent.click(screen.getByRole("button", { name: "Animate Intensity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Audio" }));
    await waitFor(() => assert.equal(fixture.calls[0]?.name, "lux.node.animation.set"));
    const operation = fixture.calls[0];
    if (operation?.name !== "lux.node.animation.set") assert.fail("expected animation write");
    assert.deepEqual(operation.input.animation, {
      kind: "audio",
      nodePath: [],
      definitionHash: operation.input.expectedControlSchemaHash,
      schemaHash: operation.input.expectedControlSchemaHash,
      controlId: "intensity",
      source: {
        kind: "audio-band",
        logicalInputId: "primary-audio",
        band: "bass",
        analyzer: { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 }
      },
      amount: 0.1,
      attackMs: 50,
      releaseMs: 400,
      enabled: true
    });
    await user.click(screen.getByRole("combobox", { name: "Audio band" }));
    await user.click(screen.getByRole("option", { name: "Highs" }));
    await waitFor(() => assert.equal(fixture.calls.length, 2));
    assert.equal(fixture.calls[1].input.animation.source.band, "highs");
    await user.keyboard("{Escape}");
    await waitFor(() => assert.equal(screen.queryByRole("dialog", { name: "Animate Intensity" }), null));
  } finally {
    globalThis.requestAnimationFrame = priorAnimationFrame;
  }
});
test("RTL: a flat control can configure stable per-instance variation", async () => {
  const fixture = service(), priorAnimationFrame = globalThis.requestAnimationFrame, user = userEvent.setup({ document });
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  try {
    render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
    fireEvent.click(screen.getByRole("button", { name: "Animate Intensity" }));
    fireEvent.click(screen.getByRole("button", { name: "Vary instances" }));
    await waitFor(() => assert.equal(fixture.calls[0]?.name, "lux.node.animation.set"));
    const variation = fixture.calls[0].input.animation;
    assert.equal(variation.kind, "variation");
    assert.equal(variation.distribution, "spread");
    assert.equal(variation.amount, 0.1);
    await user.click(screen.getByRole("combobox", { name: "Instance variation distribution" }));
    await user.click(screen.getByRole("option", { name: "Center-weighted" }));
    await waitFor(() => assert.equal(fixture.calls.length, 2));
    assert.equal(fixture.calls[1].input.animation.distribution, "centered");
  } finally {
    globalThis.requestAnimationFrame = priorAnimationFrame;
  }
});
test("RTL: a flat control can add and tune the strict kick binding", async () => {
  const fixture = service(), priorAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  try {
    render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
    fireEvent.click(screen.getByRole("button", { name: "Animate Intensity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Kick" }));
    await waitFor(() => assert.equal(fixture.calls.length, 1));
    const animation = fixture.calls[0].input.animation;
    assert.deepEqual(animation, {
      kind: "kick",
      nodePath: [],
      definitionHash: fixture.calls[0].input.expectedControlSchemaHash,
      schemaHash: fixture.calls[0].input.expectedControlSchemaHash,
      controlId: "intensity",
      source: { kind: "audio-kick", logicalInputId: "primary-audio", analyzer: { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 } },
      amount: 0.1,
      attackMs: 0,
      releaseMs: 300,
      sensitivity: 0.5,
      retriggerMs: 120,
      envelope: "exponential",
      enabled: true
    });
    const sensitivity = screen.getByRole("spinbutton", { name: "Kick sensitivity" });
    fireEvent.focus(sensitivity);
    fireEvent.change(sensitivity, { target: { value: ".8" } });
    fireEvent.blur(sensitivity);
    await waitFor(() => assert.equal(fixture.calls.length, 2));
    assert.equal(fixture.calls[1].input.animation.sensitivity, 0.8);
    assert.ok(screen.getByRole("combobox", { name: "Kick envelope" }));
    assert.ok(screen.getByRole("spinbutton", { name: "Kick retrigger milliseconds" }));
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Animate Intensity" }), { key: "Escape" });
    await waitFor(() => assert.equal(screen.queryByRole("dialog", { name: "Animate Intensity" }), null));
  } finally {
    globalThis.requestAnimationFrame = priorAnimationFrame;
  }
});
test("RTL: audio configuration changes cancel an in-flight connection and ignore its stale completion", async () => {
  const { AudioInputControl: AudioInputControl2 } = await Promise.resolve().then(() => (init_AudioInputControl(), AudioInputControl_exports));
  let resolveConnect;
  const calls = [];
  const provider = {
    listInputs: async () => [],
    subscribeDevices: () => () => {
    },
    connect: async () => {
      calls.push("connect");
      await new Promise((resolve) => {
        resolveConnect = resolve;
      });
    },
    disconnect: async () => {
      calls.push("disconnect");
    },
    dispose: async () => {
    },
    getMonitoring: () => false,
    setMonitoring: async (value) => value,
    getSnapshot: () => ({ generation: 0, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0, kickSequence: 0, kickStrength: 0 }),
    subscribe: () => () => {
    }
  };
  const first = { logicalInputId: "primary-audio", analyzer: { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 } };
  const second = { logicalInputId: "primary-audio", analyzer: { version: 1, fftSize: 2048, minDecibels: -90, maxDecibels: -20 } };
  const view = render(/* @__PURE__ */ jsx14(AudioInputControl2, { provider, onError: () => {
  }, configuration: first }));
  fireEvent.click(screen.getByRole("button", { name: "Connect audio" }));
  await waitFor(() => assert.deepEqual(calls, ["connect"]));
  view.rerender(/* @__PURE__ */ jsx14(CacheProvider, { value: styleCache, children: /* @__PURE__ */ jsx14(AudioInputControl2, { provider, onError: () => {
  }, configuration: second }) }));
  await waitFor(() => assert.deepEqual(calls, ["connect", "disconnect"]));
  resolveConnect();
  await act(async () => {
  });
  assert.ok(screen.getByRole("status", { name: "Audio input status" }));
  assert.match(screen.getByRole("status").textContent ?? "", /Disconnected|Unavailable/);
});
test("RTL: a failed default connection keeps the prelisted CABLE input available for an exact retry", async () => {
  const { AudioInputControl: AudioInputControl2 } = await Promise.resolve().then(() => (init_AudioInputControl(), AudioInputControl_exports));
  const calls = [], errors = [];
  const provider = {
    listInputs: async () => {
      calls.push("list");
      return [{ id: "cable", label: "CABLE Output (VB-Audio Virtual Cable)" }];
    },
    subscribeDevices: () => () => {
    },
    connect: async (_configuration, id3) => {
      calls.push(`connect:${id3}`);
      if (!id3) throw Error("default input failed");
    },
    disconnect: async () => {
    },
    dispose: async () => {
    },
    getMonitoring: () => false,
    setMonitoring: async (value) => value,
    getSnapshot: () => ({ generation: 0, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0, kickSequence: 0, kickStrength: 0 }),
    subscribe: () => () => {
    }
  };
  const user = userEvent.setup({ document });
  localStorage.clear();
  render(/* @__PURE__ */ jsx14(AudioInputControl2, { provider, onError: (error) => errors.push(error) }));
  await waitFor(() => assert.deepEqual(calls, ["list"]));
  await user.click(await screen.findByRole("button", { name: "Connect" }));
  await waitFor(() => assert.match(errors.at(-1) ?? "", /default input failed/));
  await user.click(screen.getByRole("combobox", { name: "Audio input device" }));
  await user.click(screen.getByRole("option", { name: "CABLE Output (VB-Audio Virtual Cable)" }));
  await user.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() => assert.deepEqual(calls, ["list", "connect:undefined", "connect:cable"]));
  assert.equal(screen.getByRole("status").textContent, "Connected");
});
test("RTL: a missing saved audio input blocks connection until the user chooses an available device", async () => {
  const { AudioInputControl: AudioInputControl2 } = await Promise.resolve().then(() => (init_AudioInputControl(), AudioInputControl_exports));
  const calls = [], errors = [];
  const provider = {
    listInputs: async () => [{ id: "cable", label: "CABLE Output (VB-Audio Virtual Cable)" }],
    subscribeDevices: () => () => {
    },
    connect: async (_configuration, id3) => {
      calls.push(`connect:${id3}`);
    },
    disconnect: async () => {
    },
    dispose: async () => {
    },
    getMonitoring: () => false,
    setMonitoring: async (value) => value,
    getSnapshot: () => ({ generation: 0, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0, kickSequence: 0, kickStrength: 0 }),
    subscribe: () => () => {
    }
  };
  const user = userEvent.setup({ document });
  localStorage.setItem("lux.audio.primary-device", "missing-device");
  render(/* @__PURE__ */ jsx14(AudioInputControl2, { provider, onError: (error) => errors.push(error) }));
  await screen.findByRole("button", { name: "Connect" });
  await user.click(screen.getByRole("combobox", { name: "Audio input device" }));
  assert.ok(screen.getByRole("option", { name: "Previously selected input (unavailable)" }));
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() => assert.match(errors.at(-1) ?? "", /previously selected audio input is unavailable/i));
  assert.deepEqual(calls, []);
  await user.click(screen.getByRole("combobox", { name: "Audio input device" }));
  await user.click(screen.getByRole("option", { name: "CABLE Output (VB-Audio Virtual Cable)" }));
  await user.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() => assert.deepEqual(calls, ["connect:cable"]));
  localStorage.clear();
});
test("RTL: an audio device change refreshes inputs and unmount removes the listener", async () => {
  const { AudioInputControl: AudioInputControl2 } = await Promise.resolve().then(() => (init_AudioInputControl(), AudioInputControl_exports));
  let listener, unsubscribed = false, lists = 0;
  const provider = {
    listInputs: async () => ++lists === 1 ? [] : [{ id: "cable", label: "CABLE Output (VB-Audio Virtual Cable)" }],
    subscribeDevices: (next) => {
      listener = next;
      return () => {
        unsubscribed = true;
      };
    },
    connect: async () => {
    },
    disconnect: async () => {
    },
    dispose: async () => {
    },
    getMonitoring: () => false,
    setMonitoring: async (value) => value,
    getSnapshot: () => ({ generation: 0, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0, kickSequence: 0, kickStrength: 0 }),
    subscribe: () => () => {
    }
  };
  localStorage.clear();
  const view = render(/* @__PURE__ */ jsx14(AudioInputControl2, { provider, onError: () => {
  } }));
  await waitFor(() => assert.equal(lists, 1));
  await act(async () => listener?.());
  await waitFor(() => assert.equal(lists, 2));
  const user = userEvent.setup({ document });
  await user.click(screen.getByRole("combobox", { name: "Audio input device" }));
  assert.ok(screen.getByRole("option", { name: "CABLE Output (VB-Audio Virtual Cable)" }));
  view.unmount();
  assert.equal(unsubscribed, true);
});
test("RTL: direct component selection edits flat controls and keeps empty-path animation identity", async () => {
  const { useState: useState13 } = await import("react");
  const { GraphPanel: GraphPanel2, nodeKey: nodeKey2 } = await Promise.resolve().then(() => (init_GraphPanel(), GraphPanel_exports));
  const { InspectorBreadcrumb: InspectorBreadcrumb2 } = await Promise.resolve().then(() => (init_InspectorBreadcrumb(), InspectorBreadcrumb_exports));
  const { ParameterInspector: ParameterInspector2 } = await Promise.resolve().then(() => (init_ParameterInspector(), ParameterInspector_exports));
  const { StudioController: StudioController2 } = await Promise.resolve().then(() => (init_service_client(), service_client_exports));
  const fixture = service(), runtime = fixture.client.getSnapshot().authoring, controller = new StudioController2(fixture.client);
  const initial = JSON.stringify(runtime), priorAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  try {
    let Fixture2 = function() {
      const [path, setPath] = useState13(null);
      return /* @__PURE__ */ jsxs15(Fragment5, { children: [
        /* @__PURE__ */ jsx14(GraphPanel2, { runtime, selected: path ? nodeKey2(path) : null, onSelect: setPath }),
        /* @__PURE__ */ jsx14(InspectorBreadcrumb2, { runtime, path: path ?? void 0, onSelect: setPath }),
        /* @__PURE__ */ jsx14(ParameterInspector2, { runtime, available: true, client: fixture.client, controller, onError: () => {
        }, nodePath: path ?? void 0 })
      ] });
    };
    var Fixture = Fixture2;
    render(/* @__PURE__ */ jsx14(Fixture2, {}));
    const visual = screen.getByRole("button", { name: /^Visual Source Image Final output/ });
    fireEvent.click(visual);
    assert.equal(visual.getAttribute("aria-pressed"), "true");
    assert.ok(screen.getByRole("button", { name: "Controls for Visual" }));
    assert.equal(screen.queryByRole("button", { name: "View inside" }), null);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Intensity value" }), { target: { value: ".7" } });
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Intensity value" }), { key: "Enter" });
    await waitFor(() => assert.equal(fixture.calls[0]?.name, "lux.parameters.set"));
    assert.equal("nodePath" in fixture.calls[0].input, false);
    fireEvent.click(screen.getByRole("button", { name: "Animate Intensity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add LFO" }));
    await waitFor(() => assert.equal(fixture.calls[1]?.name, "lux.node.animation.set"));
    const animation = fixture.calls[1];
    if (animation?.name === "lux.node.animation.set") {
      assert.deepEqual(animation.input.nodePath, []);
      assert.equal(animation.input.animation?.definitionHash, animation.input.animation?.schemaHash);
    }
    assert.equal(JSON.stringify(runtime), initial);
    assert.equal(runtime.nodeControls, void 0);
    assert.equal(runtime.composition, void 0);
    fireEvent.click(screen.getAllByRole("button", { name: "Scene controls" })[0]);
    assert.equal(visual.getAttribute("aria-pressed"), "false");
  } finally {
    globalThis.requestAnimationFrame = priorAnimationFrame;
  }
});
test("RTL: control descriptions appear on hover and keyboard focus without creating empty help", async () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [
    { id: "samplingRadius", type: "number", label: "Source sampling radius", description: "Expands the area sampled from the source image before mirroring.", min: 0, max: 4, default: 1, changeCost: "live" },
    { id: "spiralTwist", type: "number", label: "Spiral twist", min: -4, max: 4, default: 0, changeCost: "live" }
  ], controlSchemaHash: "d".repeat(64), controls: { samplingRadius: 1, spiralTwist: 0 }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const described = screen.getByText("Source sampling radius");
  fireEvent.mouseOver(described);
  const tooltip = await screen.findByRole("tooltip", { name: /Expands the area sampled/ });
  assert.ok(tooltip.querySelector(".MuiTooltip-tooltipPlacementLeft"), "help must open toward Preview");
  assert.ok(tooltip.querySelector(".control-description-tooltip"), "description tooltip keeps its product styling hook");
  fireEvent.change(screen.getByRole("slider", { name: "Source sampling radius" }), { target: { value: "2" } });
  await waitFor(() => assert.deepEqual(fixture.calls[0].input.values, { samplingRadius: 2 }));
  fireEvent.mouseOut(described);
  fireEvent.focus(described);
  assert.ok(await screen.findByRole("tooltip", { name: /Expands the area sampled/ }));
  assert.equal(document.querySelectorAll('[role="tooltip"]').length, 1);
  assert.equal(screen.getByText("Spiral twist").getAttribute("tabindex"), null);
});
test("RTL: duplicate component labels show and announce their public aliases", () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.4.0", intensity: void 0, controlSchema: [
    { id: "segmentsA", type: "number", label: "Segments", min: 2, max: 16, default: 6, changeCost: "live" },
    { id: "segmentsB", type: "number", label: "Segments", min: 2, max: 16, default: 6, changeCost: "live" }
  ], controlSchemaHash: "c".repeat(64), controls: { segmentsA: 6, segmentsB: 6 }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  assert.ok(screen.getByText("segmentsA \xB7 Segments"));
  assert.ok(screen.getByText("segmentsB \xB7 Segments"));
  assert.ok(screen.getByRole("slider", { name: "segmentsA \xB7 Segments" }));
  assert.ok(screen.getByRole("spinbutton", { name: "segmentsB \xB7 Segments value" }));
});
test("RTL: grouped controls use independent keyboard disclosures and preserve live values while collapsed", async () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [
    { id: "exposure", type: "number", label: "Exposure", min: 0, max: 2, default: 1, changeCost: "live" },
    { id: "speed", type: "number", label: "Speed", group: "Motion", min: 0, max: 4, default: 1, changeCost: "live" },
    { id: "phase", type: "number", label: "Phase", group: "Motion", min: 0, max: 1, default: 0, changeCost: "live" },
    { id: "segments", type: "number", label: "Segments", group: "Kaleidoscope", min: 2, max: 16, default: 6, changeCost: "live" }
  ], controlSchemaHash: "e".repeat(64), controls: { exposure: 1, speed: 1, phase: 0, segments: 6 }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const motion = screen.getByText("Motion").closest("summary");
  const kaleidoscope = screen.getByText("Kaleidoscope").closest("summary");
  assert.ok(motion);
  assert.ok(kaleidoscope);
  assert.equal(motion.tabIndex, 0);
  const motionDetails = motion.closest("details");
  const kaleidoscopeDetails = kaleidoscope.closest("details");
  assert.equal(motionDetails.open, true);
  assert.equal(kaleidoscopeDetails.open, true);
  assert.deepEqual([...document.querySelectorAll(".parameter-row")].map((row) => row.getAttribute("data-control-id")), ["exposure", "speed", "phase", "segments"]);
  fireEvent.click(motion);
  assert.equal(motionDetails.open, false);
  assert.equal(kaleidoscopeDetails.open, true);
  await act(async () => fixture.publish({ controls: { exposure: 1, speed: 3, phase: 0, segments: 6 }, playback: "playing" }));
  fireEvent.click(motion);
  assert.equal(screen.getByRole("slider", { name: "Speed" }).value, "3");
  assert.ok(screen.getByRole("button", { name: "Pause" }), "collapsing a group must not change playback");
  assert.ok(screen.getByRole("slider", { name: "Exposure" }), "ungrouped controls remain available");
});
test("RTL: Inspector filtering matches control and group names without changing values", () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [
    { id: "perchDuration", type: "number", label: "Perch duration", group: "Bird Personality", min: 1, max: 90, default: 10, changeCost: "live" },
    { id: "sociability", type: "number", label: "Sociability", group: "Bird Personality", min: 0, max: 1, default: 0.5, changeCost: "live" },
    { id: "wingSpeed", type: "number", label: "Wing speed", group: "Bird Flight", min: 0, max: 8, default: 1, changeCost: "live" },
    { id: "plumage", type: "number", label: "Plumage palette", group: "Bird Appearance", min: 0, max: 1, default: 0.5, changeCost: "live" }
  ], controlSchemaHash: "f".repeat(64), controls: { perchDuration: 10, sociability: 0.5, wingSpeed: 1, plumage: 0.5 }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const filter = screen.getByRole("textbox", { name: "Filter controls" });
  const personality = screen.getByText("Bird Personality").closest("details");
  fireEvent.click(screen.getByText("Bird Personality").closest("summary"));
  assert.equal(personality.open, false);
  fireEvent.change(filter, { target: { value: "flight" } });
  assert.ok(screen.getByText("Bird Flight"));
  assert.ok(screen.getByRole("slider", { name: "Wing speed" }));
  assert.equal(screen.queryByText("Bird Personality"), null);
  assert.equal(screen.queryByRole("slider", { name: "Perch duration" }), null);
  fireEvent.change(filter, { target: { value: "soci" } });
  assert.ok(screen.getByText("Bird Personality"));
  assert.equal(screen.getByText("Bird Personality").closest("details").open, true);
  assert.ok(screen.getByRole("slider", { name: "Sociability" }));
  assert.equal(screen.queryByRole("slider", { name: "Perch duration" }), null);
  fireEvent.change(filter, { target: { value: "missing" } });
  assert.ok(screen.getByText("No controls match \u201Cmissing\u201D."));
  fireEvent.change(filter, { target: { value: "" } });
  assert.equal(document.querySelectorAll(".parameter-group").length, 3);
  assert.equal(personality.open, false);
  assert.deepEqual(fixture.client.getSnapshot().authoring?.controls, { perchDuration: 10, sociability: 0.5, wingSpeed: 1, plumage: 0.5 });
});
test("RTL: Inspector group actions clear filters and apply to every group without changing values", () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [
    { id: "perchDuration", type: "number", label: "Perch duration", group: "Bird Personality", min: 1, max: 90, default: 10, changeCost: "live" },
    { id: "wingSpeed", type: "number", label: "Wing speed", group: "Bird Flight", min: 0, max: 8, default: 1, changeCost: "live" }
  ], controlSchemaHash: "g".repeat(64), controls: { perchDuration: 10, wingSpeed: 1 }, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const filter = screen.getByRole("textbox", { name: "Filter controls" });
  fireEvent.change(filter, { target: { value: "flight" } });
  fireEvent.click(screen.getByRole("button", { name: "Collapse all control groups" }));
  assert.equal(filter.value, "");
  assert.ok([...document.querySelectorAll(".parameter-group")].every((group2) => !group2.open));
  fireEvent.click(screen.getByRole("button", { name: "Expand all control groups" }));
  assert.ok([...document.querySelectorAll(".parameter-group")].every((group2) => group2.open));
  assert.deepEqual(fixture.client.getSnapshot().authoring?.controls, { perchDuration: 10, wingSpeed: 1 });
});
test("RTL: an empty authored schema has no invented control", () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [], controlSchemaHash: "b".repeat(64), controls: {}, controlSequence: 0 });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  assert.equal(within(document.querySelector(".inspector")).queryByRole("slider"), null);
  assert.ok(screen.getByText("This visual defines no live controls."));
});
test("RTL: typing and pending control writes mark unsaved intent before acknowledgement", async () => {
  const fixture = service();
  let dirty = 0;
  const writes = [];
  let complete;
  fixture.client.invoke = () => new Promise((resolve) => {
    complete = () => resolve({});
  });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3, controlEdits: { changed: () => {
    dirty++;
  }, track: (write) => {
    writes.push(write);
  } } }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Intensity value" }), { target: { value: "0.7" } });
  assert.equal(dirty, 1, "unsubmitted visible input must protect close");
  fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Intensity value" }), { key: "Enter" });
  assert.equal(dirty, 2);
  assert.equal(writes.length, 1, "save can await the actual write");
  await act(async () => {
    complete();
    await Promise.all(writes);
  });
});
test("RTL: merely focusing numeric input cannot overwrite a later agent parameter change", async () => {
  const fixture = service();
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const input = screen.getByRole("spinbutton", { name: "Intensity value" });
  fireEvent.focus(input);
  await act(async () => fixture.publish({ intensity: 0.2 }));
  assert.equal(input.value, "0.2");
  fireEvent.blur(input);
  assert.equal(fixture.calls.length, 0);
});
function service() {
  let snapshot2 = {
    connection: "connected",
    message: null,
    receivedAtMs: 1e3,
    authoring: {
      instanceId: "44ff55f0-8ea6-4fbf-89d5-665923f65cad",
      generation: 2,
      revisionId: "revision-2",
      sceneName: "Test fixture",
      authority: "studio",
      playback: "paused",
      clockEpoch: 1,
      frameId: "10",
      intensity: 0.5,
      output: { width: 1920, height: 1080 },
      fault: null
    },
    host: null,
    jobs: [],
    visualFps: null,
    uiFps: null
  };
  const calls = [], listeners = /* @__PURE__ */ new Set();
  let fail = false;
  const client = {
    getSnapshot: () => snapshot2,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    invoke: async (operation) => {
      calls.push(operation);
      if (fail) throw Error("Runtime unavailable. Retry after reconnecting.");
      return { accepted: true };
    }
  };
  return { client, calls, fail: () => {
    fail = true;
  }, publish: (values2) => {
    snapshot2 = { ...snapshot2, authoring: { ...snapshot2.authoring, ...values2 } };
    for (const listener of listeners) listener();
  }, update: () => {
    snapshot2 = { ...snapshot2, authoring: { ...snapshot2.authoring, generation: 3, playback: "playing" } };
    for (const listener of listeners) listener();
  } };
}
test("RTL: disconnected controls refuse input while workspace remains operable", async () => {
  const user = userEvent.setup({ document });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: createDisconnectedClient2(), nowMs: 1e3 }));
  assert.equal(screen.getByRole("button", { name: "Play" }).disabled, true);
  assert.equal(within(document.querySelector(".inspector")).queryByRole("slider"), null);
  await user.click(screen.getByRole("button", { name: "Maximize" }));
  assert.ok(screen.getByRole("button", { name: "Restore workspace" }));
  assert.ok(screen.getByRole("heading", { name: "Awaiting runtime" }));
  await user.keyboard("{Escape}");
  assert.ok(screen.getByRole("button", { name: "Maximize" }));
});
test("RTL: playback and intensity invoke guarded shared operations and wait for applied state", async () => {
  const fixture = service(), user = userEvent.setup({ document });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  await user.click(screen.getByRole("button", { name: "Play" }));
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  assert.equal(fixture.calls[0]?.name, "lux.playback");
  assert.equal(fixture.calls[0]?.input.expectedGeneration, 2);
  assert.equal(screen.queryByRole("button", { name: "Pause" }), null);
  fireEvent.change(screen.getByRole("slider", { name: "Intensity" }), { target: { value: "0.8" } });
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  const write = fixture.calls[1];
  assert.equal(write?.name, "lux.parameters.set");
  if (write?.name === "lux.parameters.set") assert.deepEqual(write.input.values, { intensity: 0.8 });
  assert.equal(document.querySelector('[data-control-id="intensity"]')?.getAttribute("data-applied-value"), "0.5");
  await act(async () => fixture.update());
  await user.click(screen.getByRole("button", { name: "Pause" }));
  await waitFor(() => assert.equal(fixture.calls.length, 3));
  assert.equal(fixture.calls[2]?.input.expectedGeneration, 3);
});
test("RTL: failed runtime command shows actionable error without a successful-state claim", async () => {
  const fixture = service(), user = userEvent.setup({ document });
  fixture.fail();
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  await user.click(screen.getByRole("button", { name: "More playback actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Restart runtime" }));
  await waitFor(() => assert.match(screen.getByRole("alert").textContent ?? "", /Runtime unavailable/));
  assert.equal(screen.queryByText("Request accepted. Awaiting applied runtime status."), null);
  assert.ok(screen.getByText("revision-2"));
  await act(async () => fixture.publish({ generation: 3, revisionId: "revision-3", fault: null }));
  assert.ok(!screen.queryByRole("alert"), "A new working runtime clears the previous command error");
});
test("RTL: pending playback preserves button styling and ignores duplicate transport commands", async () => {
  const fixture = service(), user = userEvent.setup({ document });
  let finishPlay, finishIntensity;
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((resolve) => {
      if (operation.name === "lux.playback") finishPlay = () => resolve({});
      else finishIntensity = () => resolve({});
    });
  };
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  await user.click(screen.getByRole("button", { name: "Play" }));
  fireEvent.change(screen.getByRole("slider", { name: "Intensity" }), { target: { value: "0.8" } });
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  assert.ok(screen.getByRole("button", { name: "Play" }));
  await act(async () => finishIntensity());
  assert.equal(screen.getByRole("button", { name: "Play" }).disabled, false);
  await user.click(screen.getByRole("button", { name: "More playback actions" }));
  assert.notEqual(screen.getByRole("menuitem", { name: "Restart runtime" }).getAttribute("aria-disabled"), "true");
  fireEvent.click(screen.getByRole("menuitem", { name: "Restart runtime" }));
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  assert.equal(fixture.calls.length, 2);
  await act(async () => finishPlay());
  assert.equal(screen.getByRole("button", { name: "Play" }).disabled, false);
  assert.ok(screen.getByRole("button", { name: "Play" }));
  await act(async () => fixture.update());
  assert.ok(screen.getByRole("button", { name: "Pause" }));
});
test("RTL: intensity writes do not disable transport or insert a success alert", async () => {
  const fixture = service();
  let finish;
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((resolve) => {
      finish = () => resolve({});
    });
  };
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  fireEvent.change(screen.getByRole("slider", { name: "Intensity" }), { target: { value: "0.8" } });
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  for (const name2 of ["Play", "Reset", "More playback actions"]) assert.equal(screen.getByRole("button", { name: name2 }).disabled, false);
  assert.equal(screen.queryByText("Sending request\u2026"), null);
  await act(async () => finish());
  assert.equal(screen.queryByText("Request accepted. Awaiting applied runtime status."), null);
  assert.equal(screen.queryByRole("alert"), null);
});
test("RTL: delayed applied values never pull a slider away from the latest input", async () => {
  const fixture = service();
  const pending = [];
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((resolve) => pending.push(() => {
      if (operation.name === "lux.parameters.set") fixture.publish(operation.input.values);
      resolve({});
    }));
  };
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const slider = screen.getByRole("slider", { name: "Intensity" });
  fireEvent.change(slider, { target: { value: "0.6" } });
  fireEvent.change(slider, { target: { value: "0.8" } });
  assert.equal(slider.value, "0.8");
  assert.equal(fixture.calls.length, 1, "controller coalesces pending writes");
  await act(async () => pending.shift()());
  assert.equal(document.querySelector('[data-control-id="intensity"]')?.getAttribute("data-applied-value"), "0.6");
  assert.equal(slider.value, "0.8", "old acknowledgement must not overwrite newer input");
  assert.equal(fixture.calls.length, 2);
  fireEvent.change(slider, { target: { value: "0.9" } });
  await act(async () => pending.shift()());
  assert.equal(slider.value, "0.9");
  await act(async () => pending.shift()());
  assert.equal(slider.value, "0.9");
  assert.equal(document.querySelector('[data-control-id="intensity"]')?.getAttribute("data-applied-value"), "0.9");
  await act(async () => fixture.publish({ intensity: 0.25 }));
  assert.equal(slider.value, "0.25", "external changes still apply after local input settles");
});
test("RTL: rejected slider input restores confirmed value and replacement ignores old completion", async () => {
  const fixture = service();
  let reject;
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((_resolve, fail) => {
      reject = fail;
    });
  };
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  let slider = screen.getByRole("slider", { name: "Intensity" });
  fireEvent.change(slider, { target: { value: "0.8" } });
  await act(async () => reject(Error("Parameter rejected")));
  assert.equal(slider.value, "0.5");
  assert.match(screen.getByRole("alert").textContent ?? "", /Parameter rejected/);
  fireEvent.change(slider, { target: { value: "0.9" } });
  await act(async () => fixture.publish({ revisionId: "new-revision", intensity: 0.2 }));
  slider = screen.getByRole("slider", { name: "Intensity" });
  assert.equal(slider.value, "0.2");
  await act(async () => reject(Error("Old revision rejected")));
  assert.equal(slider.value, "0.2");
  assert.equal(screen.queryByText("Old revision rejected"), null);
});
test("RTL: a replaced runtime has an independent input queue while old writes are pending", async () => {
  const fixture = service();
  const pending = [];
  fixture.client.invoke = (operation) => {
    fixture.calls.push(operation);
    return new Promise((resolve, reject) => pending.push({ resolve: () => {
      if (operation.name === "lux.parameters.set") fixture.publish(operation.input.values);
      resolve({});
    }, reject }));
  };
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  let slider = screen.getByRole("slider", { name: "Intensity" });
  fireEvent.change(slider, { target: { value: "0.8" } });
  await act(async () => fixture.publish({ revisionId: "new-revision", intensity: 0.2 }));
  slider = screen.getByRole("slider", { name: "Intensity" });
  fireEvent.change(slider, { target: { value: "0.4" } });
  assert.equal(fixture.calls.length, 2, "new runtime input cannot queue behind the obsolete target");
  await act(async () => pending[1].resolve());
  assert.equal(slider.value, "0.4");
  await act(async () => pending[0].reject(Error("Obsolete revision")));
  assert.equal(slider.value, "0.4");
  assert.equal(screen.queryByRole("alert"), null);
});
test("RTL: Escape exits native fullscreen even before its state notification arrives", async () => {
  const values2 = [];
  const windows = {
    getState: async () => ({ detached: false, fullscreen: false }),
    subscribe: () => () => {
    },
    popout: async () => {
    },
    dock: async () => {
    },
    fullscreen: async (value) => {
      values2.push(value);
    }
  };
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: createDisconnectedClient2(), windows, nowMs: 1e3 }));
  await userEvent.setup({ document }).keyboard("{Escape}");
  assert.deepEqual(values2, [false]);
});
test("RTL: fullscreen shows only preview, ignores stale initial state, and exits on first Escape", async () => {
  let notify, initial;
  const windows = {
    getState: () => new Promise((resolve) => {
      initial = resolve;
    }),
    subscribe: (listener) => {
      notify = listener;
      return () => {
      };
    },
    popout: async () => {
    },
    dock: async () => {
    },
    fullscreen: async (fullscreen) => {
      notify({ detached: false, fullscreen });
    }
  };
  const { container } = render(/* @__PURE__ */ jsx14(StudioApp2, { client: service().client, windows, nowMs: 1e3 }));
  const surface = container.querySelector(".preview-surface");
  await act(async () => {
    fireEvent.keyDown(window, { key: "F11" });
    await Promise.resolve();
  });
  assert.ok(container.querySelector(".studio-preview-fullscreen"));
  assert.equal(screen.queryByRole("button", { name: "Play" }), null);
  assert.equal(screen.queryByRole("slider"), null);
  assert.ok(screen.getByText("Press Escape to exit fullscreen"));
  await act(async () => {
    initial({ detached: false, fullscreen: false });
    await Promise.resolve();
  });
  assert.ok(container.querySelector(".studio-preview-fullscreen"));
  await act(async () => {
    fireEvent.keyDown(window, { key: "F11", repeat: true });
    await Promise.resolve();
  });
  assert.ok(container.querySelector(".studio-preview-fullscreen"), "repeat does not toggle fullscreen");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
  assert.equal(screen.queryByText("Press Escape to exit fullscreen"), null);
  await act(async () => {
    fireEvent.keyDown(window, { key: "Escape" });
    await Promise.resolve();
  });
  assert.equal(container.querySelector(".studio-preview-fullscreen"), null);
  assert.ok(screen.getByRole("button", { name: "Fullscreen" }));
  assert.equal(container.querySelector(".preview-surface"), surface);
});
test("RTL: unavailable popout is absent while fullscreen remains available", async () => {
  const windows = {
    getState: async () => ({ detached: false, fullscreen: false }),
    subscribe: () => () => {
    },
    dock: async () => {
    },
    fullscreen: async () => {
    }
  };
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: service().client, windows, nowMs: 1e3 }));
  assert.equal(screen.queryByRole("button", { name: "Pop out" }), null);
  assert.equal(screen.getByRole("button", { name: "Fullscreen" }).disabled, false);
});
test("RTL: global authoring shortcuts dispatch one shared action and suppress repeats", async () => {
  const calls = [];
  const action = (name2, disabled = false) => ({ disabled, run: () => {
    calls.push(name2);
  } });
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: createDisconnectedClient2(), nowMs: 1e3, shortcutActions: {
    save: action("save"),
    "save-as": action("save-as"),
    export: action("export"),
    build: action("build"),
    "save-frame": action("frame", true),
    "toggle-recording": action("record")
  } }));
  for (const event of [
    { key: "s", ctrlKey: true },
    { key: "s", ctrlKey: true, shiftKey: true },
    { key: "e", ctrlKey: true, shiftKey: true },
    { key: "Enter", ctrlKey: true },
    { key: "p", ctrlKey: true, shiftKey: true },
    { key: "r", ctrlKey: true, shiftKey: true }
  ]) fireEvent.keyDown(window, event);
  fireEvent.keyDown(window, { key: "r", ctrlKey: true, shiftKey: true, repeat: true });
  const handled = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
  handled.preventDefault();
  window.dispatchEvent(handled);
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  fireEvent.keyDown(window, { key: "s", ctrlKey: true, shiftKey: true });
  dialog.remove();
  assert.deepEqual(calls, ["save", "save-as", "export", "build", "record"]);
});
test("RTL: question mark opens the shortcut reference without intercepting text entry or repeats", async () => {
  render(/* @__PURE__ */ jsx14(StudioApp2, { client: createDisconnectedClient2(), nowMs: 1e3 }));
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  const questionMark = new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true, cancelable: true });
  input.dispatchEvent(questionMark);
  assert.equal(questionMark.defaultPrevented, false, "question-mark typing remains available to text inputs");
  assert.equal(screen.queryByRole("dialog", { name: "Keyboard shortcuts" }), null);
  input.remove();
  const fullscreen = screen.getByRole("button", { name: "Fullscreen" });
  await act(async () => {
    fullscreen.focus();
  });
  await act(async () => {
    fireEvent.keyDown(window, { key: "?", shiftKey: true });
  });
  const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
  assert.ok(within(dialog).getByText("Build preview"));
  assert.ok(within(dialog).getByText("Ctrl+Enter"));
  assert.ok(within(dialog).getByText("Shift+/"));
  const repeatedQuestionMark = new KeyboardEvent("keydown", { key: "?", shiftKey: true, repeat: true, bubbles: true, cancelable: true });
  await act(async () => {
    window.dispatchEvent(repeatedQuestionMark);
  });
  assert.equal(repeatedQuestionMark.defaultPrevented, false, "repeated question mark is not intercepted");
  assert.equal(screen.getAllByRole("dialog", { name: "Keyboard shortcuts" }).length, 1);
});
test("RTL: sequence timing is visible before launch and selection does not alter transport", async () => {
  const calls = [];
  const { StoryPanel: StoryPanel2 } = await Promise.resolve().then(() => (init_StoryPanel(), StoryPanel_exports));
  render(/* @__PURE__ */ jsx14(StoryPanel2, { status: storyStatus(), available: true, controller: { storyTransport: async (...args) => {
    calls.push(args);
    return {};
  } }, onError: () => {
  } }));
  const rows = within(screen.getByRole("list", { name: "Story sequence" })).getAllByRole("listitem");
  assert.match(rows[0].textContent ?? "", /4\.0s/, "show scheduled dwell, not the 10s local beat duration");
  assert.match(rows[1].textContent ?? "", /Manual cue/, "manual waits are explicit before activation");
  assert.match(rows[2].textContent ?? "", /5\.0s/);
  fireEvent.click(within(rows[2]).getByRole("button"));
  assert.equal(calls.length, 0);
  fireEvent.click(screen.getByRole("button", { name: /Start here: Hold — occurrence 3 of 3/ }));
  await waitFor(() => assert.equal(calls.length, 1));
  assert.deepEqual(calls[0][0], { action: "start", occurrenceId: "hold-b" });
});
test("RTL: an MCP-connected audio device replaces the previous device label", async () => {
  const { AudioInputControl: AudioInputControl2 } = await Promise.resolve().then(() => (init_AudioInputControl(), AudioInputControl_exports));
  localStorage.clear();
  let connected = false, listener = () => {
  };
  const provider = {
    getSnapshot: () => ({ available: connected }),
    getMonitoring: () => false,
    getConnectedInputId: () => connected ? "cable" : void 0,
    listInputs: async () => [{ id: "cable", label: "CABLE Output" }],
    subscribeDevices: () => () => {
    },
    subscribe: (next) => {
      listener = next;
      return () => {
      };
    },
    dispose: async () => {
    }
  };
  render(/* @__PURE__ */ jsx14(AudioInputControl2, { provider, onError: () => {
  } }));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "Connect" })));
  await act(async () => {
    connected = true;
    listener();
  });
  assert.equal(screen.getByRole("status").textContent, "Connected");
  const selector = screen.getByRole("combobox", { name: "Audio input device" });
  assert.equal(selector.textContent, "CABLE Output");
  assert.equal(selector.parentElement.getAttribute("title"), "CABLE Output");
  const styles = document.createElement("style");
  styles.textContent = await (await import("node:fs/promises")).readFile("apps/studio/src/studio.css", "utf8");
  document.head.append(styles);
  try {
    const backing = selector.parentElement.querySelector("input");
    assert.equal(backing.disabled, true);
    assert.equal(getComputedStyle(backing).opacity, "0", "disabled backing input must never paint its device ID");
  } finally {
    styles.remove();
  }
  await act(async () => {
    connected = false;
    listener();
  });
  assert.equal(screen.getByRole("status").textContent, "Unavailable");
});
