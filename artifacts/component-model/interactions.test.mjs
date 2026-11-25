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
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== "string" || !descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      invalid(path, "expected enumerable own data properties");
    }
    result[key] = descriptor.value;
  }
  return result;
}
function controlId(id2) {
  if (typeof id2 !== "string" || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(id2) || reservedIds.has(id2)) {
    invalid("controls", "invalid control ID");
  }
  return id2;
}
function text(value, path, maximum) {
  if (typeof value !== "string" || !value.isWellFormed() || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    invalid(path, "expected valid Unicode without control characters");
  }
  const normalized = value.trim();
  if (!normalized || [...normalized].length > maximum) invalid(path, `expected 1\u2013${maximum} code points`);
  return normalized;
}
function finite(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(path, "expected a finite number");
  return Object.is(value, -0) ? 0 : value;
}
function definition(id2, input, normalizedRow) {
  const path = `controls.${controlId(id2)}`, raw = record(input, path);
  const required = normalizedRow ? ["id", ...requiredFields, "changeCost"] : requiredFields;
  for (const key of required) if (!Object.hasOwn(raw, key)) invalid(path, `missing field ${key}`);
  for (const key of Object.keys(raw)) if (!required.includes(key) && !optionalFields.includes(key)) invalid(path, `unsupported field ${key.slice(0, 80)}`);
  if (normalizedRow && raw.changeCost !== "live") invalid(path, "changeCost must be live");
  if (raw.type !== "number") invalid(path, "only number controls are supported");
  const label = text(raw.label, `${path}.label`, parameterLimits.label);
  const minimum = finite(raw.min, `${path}.min`), maximum = finite(raw.max, `${path}.max`);
  const value = finite(raw.default, `${path}.default`);
  if (!(minimum < maximum) || !Number.isFinite(maximum - minimum)) invalid(path, "min must be below max with a finite range");
  if (value < minimum || value > maximum) invalid(`${path}.default`, `expected a number from ${minimum} to ${maximum}`);
  const result = { id: id2, type: "number", label, default: value, min: minimum, max: maximum };
  if (Object.hasOwn(raw, "step")) {
    const step = finite(raw.step, `${path}.step`);
    if (step <= 0 || step > maximum - minimum) invalid(`${path}.step`, "expected a positive increment no greater than the range");
    result.step = step;
  }
  if (Object.hasOwn(raw, "unit")) result.unit = text(raw.unit, `${path}.unit`, parameterLimits.unit);
  if (Object.hasOwn(raw, "description")) result.description = text(raw.description, `${path}.description`, parameterLimits.description);
  if (Object.hasOwn(raw, "group")) result.group = text(raw.group, `${path}.group`, parameterLimits.group);
  result.changeCost = "live";
  return Object.freeze(result);
}
function finishSchema(rows) {
  if (encoder.encode(JSON.stringify(rows)).byteLength > parameterLimits.metadataBytes) invalid("controls", "schema exceeds 32 KiB UTF-8");
  return Object.freeze(rows);
}
function normalizeControlSchema(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) invalid("controls", "expected a plain array of control definitions");
  const length = Object.getOwnPropertyDescriptor(input, "length").value;
  if (Reflect.ownKeys(input).length !== length + 1) invalid("controls", "unexpected array properties");
  const rows = [], ids = /* @__PURE__ */ new Set();
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) invalid("controls", "expected dense own data array elements");
    const raw = record(descriptor.value, `controls[${i}]`);
    const id2 = controlId(raw.id);
    if (ids.has(id2)) invalid("controls", `duplicate control ID ${id2}`);
    ids.add(id2);
    rows.push(definition(id2, raw, true));
  }
  return finishSchema(rows);
}
function values(schema3, input, complete) {
  const definitions = normalizeControlSchema(schema3), raw = record(input, "values"), keys = Object.keys(raw);
  if (!complete && !keys.length) invalid("values", "expected a nonempty parameter patch");
  const known = new Map(definitions.map((control) => [control.id, control]));
  for (const id2 of keys) if (!known.has(id2)) invalid(`values.${id2.slice(0, 64)}`, "unknown parameter ID");
  const result = {};
  for (const control of definitions) {
    const path = `values.${control.id}`;
    if (!Object.hasOwn(raw, control.id)) {
      if (complete) invalid(path, "missing parameter in full snapshot");
      continue;
    }
    const value = finite(raw[control.id], path);
    if (value < control.min || value > control.max) invalid(path, `expected a number from ${control.min} to ${control.max}`);
    result[control.id] = value;
  }
  return Object.freeze(result);
}
function validateControlPatch(schema3, input) {
  return values(schema3, input, false);
}
function validateControlSnapshot(schema3, input) {
  return values(schema3, input, true);
}
var parameterLimits, requiredFields, optionalFields, reservedIds, encoder;
var init_parameters = __esm({
  "packages/runtime-contracts/src/parameters.mjs"() {
    "use strict";
    parameterLimits = Object.freeze({ metadataBytes: 32768, id: 64, label: 80, unit: 24, description: 512, group: 80 });
    requiredFields = ["type", "label", "default", "min", "max"];
    optionalFields = ["step", "unit", "description", "group"];
    reservedIds = /* @__PURE__ */ new Set(["constructor", "prototype", "__proto__"]);
    encoder = new TextEncoder();
  }
});

// packages/assets/src/limits.mjs
var assetLimits;
var init_limits = __esm({
  "packages/assets/src/limits.mjs"() {
    "use strict";
    assetLimits = Object.freeze({ count: 4, imageBytes: 786486, totalBytes: 1048576, rgbaBytes: 2097152, dimension: 512, pathCharacters: 240 });
  }
});

// packages/assets/src/png.mjs
import { decode as decodeFastPng } from "fast-png";
import zlib from "pako/lib/zlib/inflate.js";
import ZStream from "pako/lib/zlib/zstream.js";
var typedArrayByteLength, typedArraySet, crcTable;
var init_png = __esm({
  "packages/assets/src/png.mjs"() {
    "use strict";
    init_limits();
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
var typedArrayByteLength2, typedArraySet2;
var init_jpeg = __esm({
  "packages/assets/src/jpeg.mjs"() {
    "use strict";
    init_limits();
    typedArrayByteLength2 = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
    typedArraySet2 = Uint8Array.prototype.set;
  }
});

// packages/assets/src/index.mjs
var sourceFields, derivedFields;
var init_src = __esm({
  "packages/assets/src/index.mjs"() {
    "use strict";
    init_limits();
    init_png();
    init_jpeg();
    sourceFields = ["mediaType", "encoding", "data"];
    derivedFields = [...sourceFields, "byteLength", "sha256", "width", "height"];
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
var limits;
var init_source_policy = __esm({
  "apps/build-worker/src/source-policy.mjs"() {
    "use strict";
    init_src();
    init_sdk_selection();
    limits = Object.freeze({ sourceBytes: 1048576, files: 32, diagnosticBytes: 131072, compileMs: 3e4, outputBytes: 4194304, sourceJsonBytes: 6291456, requestBytes: 8388608 });
  }
});

// packages/runtime-contracts/src/index.ts
import { z } from "zod";
var SDK_VERSION, sourceSdkVersionSchema, hashSchema, runtimeKeySchema, outputSettingsSchema, DEFAULT_OUTPUT, controlDefinitionSchema, INTENSITY_CONTROL, controlValuesSchema, legacySourceBundleSchema, sourceAssetSchema, assetSourceBundleSchema, sourceBundleSchema, compileRequestSchema, compileDiagnosticSchema, legacyCompiledArtifactSchema, derivedAssetSchema, assetCompiledArtifactSchema, parameterControlDefinitionSchema, parameterCompiledArtifactSchema, componentPortSchema, componentMetadataDtoSchema, componentCompiledArtifactSchema, compositionCompiledArtifactSchema, compiledArtifactSchema, compileFailureCodeSchema, compileResultSchema;
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
    derivedAssetSchema = sourceAssetSchema.extend({ byteLength: z.number().int().positive(), sha256: hashSchema, width: z.number().int().min(1).max(512), height: z.number().int().min(1).max(512) }).strict();
    assetCompiledArtifactSchema = legacyCompiledArtifactSchema.extend({ artifactVersion: z.literal(2), assets: z.record(derivedAssetSchema), assetSetHash: hashSchema }).strict();
    parameterControlDefinitionSchema = z.object({
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
    parameterCompiledArtifactSchema = assetCompiledArtifactSchema.extend({
      artifactVersion: z.literal(3),
      sdkVersion: z.literal("0.2.0"),
      controls: z.array(parameterControlDefinitionSchema),
      controlSchemaHash: hashSchema
    }).strict();
    componentPortSchema = z.object({
      type: z.union([
        z.object({ kind: z.literal("image"), colorSpace: z.literal("linear-srgb"), alphaMode: z.literal("premultiplied") }).strict(),
        z.object({ kind: z.literal("signal"), value: z.literal("number"), unit: z.string().nullable(), clock: z.literal("frame") }).strict()
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
      executionModel: z.literal("image-chain-v1"),
      composition: z.unknown(),
      compositionHash: hashSchema
    }).strict();
    compiledArtifactSchema = z.union([legacyCompiledArtifactSchema, assetCompiledArtifactSchema, parameterCompiledArtifactSchema, componentCompiledArtifactSchema, compositionCompiledArtifactSchema]);
    compileFailureCodeSchema = z.enum(["SOURCE_BOUNDARY_VIOLATION", "COMPILE_FAILED", "QUOTA_EXCEEDED", "TIMEOUT", "SERVICE_UNAVAILABLE"]);
    compileResultSchema = z.discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), artifact: compiledArtifactSchema, diagnostics: z.array(compileDiagnosticSchema) }).strict(),
      z.object({ ok: z.literal(false), code: compileFailureCodeSchema, diagnostics: z.array(compileDiagnosticSchema) }).strict()
    ]);
  }
});

// packages/runtime-contracts/src/identities.ts
import { z as z2 } from "zod";
var projectIdSchema, sceneIdSchema, componentIdSchema, assetIdSchema, projectRevisionIdSchema, sceneRevisionIdSchema, nodeIdSchema, edgeIdSchema;
var init_identities = __esm({
  "packages/runtime-contracts/src/identities.ts"() {
    "use strict";
    projectIdSchema = z2.string().uuid().brand();
    sceneIdSchema = z2.string().uuid().brand();
    componentIdSchema = z2.string().uuid().brand();
    assetIdSchema = z2.string().uuid().brand();
    projectRevisionIdSchema = z2.string().uuid().brand();
    sceneRevisionIdSchema = z2.string().uuid().brand();
    nodeIdSchema = z2.string().uuid().brand();
    edgeIdSchema = z2.string().uuid().brand();
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

// packages/runtime-contracts/src/control-animation.mjs
var objectPrototype, arrayPrototype, finite2, RuntimeSet, call, hasOwn, setHas, setAdd, regexTest, arrayPush, encoder2, encode, shapes;
var init_control_animation = __esm({
  "packages/runtime-contracts/src/control-animation.mjs"() {
    "use strict";
    objectPrototype = Object.prototype;
    arrayPrototype = Array.prototype;
    finite2 = Number.isFinite;
    RuntimeSet = Set;
    call = Function.prototype.call;
    hasOwn = call.bind(Object.prototype.hasOwnProperty);
    setHas = call.bind(Set.prototype.has);
    setAdd = call.bind(Set.prototype.add);
    regexTest = call.bind(RegExp.prototype.test);
    arrayPush = call.bind(Array.prototype.push);
    encoder2 = new TextEncoder();
    encode = call.bind(TextEncoder.prototype.encode);
    shapes = new RuntimeSet(["sine", "triangle", "saw", "square"]);
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
    init_parameters();
    init_identities();
    init_component_library();
    init_control_animation();
    legacySchema = z3.object({ format: z3.literal("lux-scene"), version: z3.literal(1), source: legacySourceBundleSchema.extend({ sdkVersion: z3.literal("0.1.0") }), settings: outputSettingsSchema, controls: controlValuesSchema }).strict();
    schema = z3.discriminatedUnion("version", [legacySchema, legacySchema.extend({ version: z3.literal(2), source: assetSourceBundleSchema.extend({ sdkVersion: z3.literal("0.1.0") }) }).strict()]);
  }
});

// apps/studio/src/controls/control-state.ts
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
    const next = nodes.find((node2) => remaining.has(node2.id) && !definition2.body.edges.some((edge) => edge.to.nodeId === node2.id && remaining.has(edge.from.nodeId)));
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
  const selectedNode = nodes.find((node2) => nodeKey(node2.nodePath) === selected), canOpen = selectedNode?.definition.kind === "graph", width = Math.max(240, (nodes.length + 1) * 250 - 30), height = 180;
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
          /* @__PURE__ */ jsx2("svg", { className: "graph-wires", width, height, "aria-label": "Node connections", children: body?.edges.map((edge) => {
            const from = nodes.findIndex((node2) => node2.id === edge.from.nodeId) + 1;
            const to = nodes.findIndex((node2) => node2.id === edge.to.nodeId) + 1;
            const highlighted = selected === nodeKey(nodes[from - 1].nodePath) || selected === nodeKey(nodes[to - 1].nodePath);
            const midpoint = (from * 250 + 220 + to * 250) / 2;
            const direction = Math.sign(to * 250 - (from * 250 + 220));
            return /* @__PURE__ */ jsxs2("g", { className: `graph-connection${highlighted ? " graph-connection-selected" : ""}`, children: [
              /* @__PURE__ */ jsxs2("title", { children: [
                nodes[from - 1]?.label,
                " ",
                edge.from.portId,
                " to ",
                nodes[to - 1]?.label,
                " ",
                edge.to.portId
              ] }),
              /* @__PURE__ */ jsx2("path", { d: `M ${from * 250 + 220} 82 C ${from * 250 + 235} 82,${to * 250 - 15} 82,${to * 250} 82` }),
              /* @__PURE__ */ jsx2("polygon", { points: `${midpoint - direction * 3},78 ${midpoint + direction * 3},82 ${midpoint - direction * 3},86` })
            ] }, edge.id);
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
              /* @__PURE__ */ jsx2("span", { children: Object.entries(node2.metadata.inputs).map(([id2, port]) => /* @__PURE__ */ jsxs2("span", { className: "graph-port graph-port-input", title: `${port.label} input`, children: [
                /* @__PURE__ */ jsx2("span", { className: "graph-port-anchor", "aria-hidden": "true" }),
                /* @__PURE__ */ jsx2("span", { children: port.label })
              ] }, id2)) }),
              /* @__PURE__ */ jsx2("span", { children: Object.entries(node2.metadata.outputs).map(([id2, port]) => /* @__PURE__ */ jsxs2("span", { className: "graph-port graph-port-output", title: `${port.label} output`, children: [
                /* @__PURE__ */ jsx2("span", { children: port.label }),
                /* @__PURE__ */ jsx2("span", { className: "graph-port-anchor", "aria-hidden": "true" })
              ] }, id2)) })
            ] }),
            (output?.nodeId === node2.id || !profile) && /* @__PURE__ */ jsx2("span", { className: "graph-final-output", children: "Final output \xB7 image" })
          ] }, nodeKey(node2.nodePath)))
        ] })
      }
    ),
    /* @__PURE__ */ jsx2("p", { className: "graph-hint", children: "Select Scene or a node for its controls. Click the background for Scene controls. Drag to pan. Scroll to zoom. Double-click a component to view inside." })
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
      typography: { fontFamily: 'Inter, "Segoe UI", sans-serif', fontSize: 13, button: { textTransform: "none", fontWeight: 500 } },
      shape: { borderRadius: 5 },
      components: {
        MuiButton: { defaultProps: { size: "small", variant: "text", disableElevation: true }, styleOverrides: { root: { whiteSpace: "nowrap", minWidth: 0 } } },
        MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: "none" } } },
        MuiChip: { defaultProps: { size: "small", variant: "outlined" }, styleOverrides: { root: { fontSize: 9, letterSpacing: 1, borderRadius: 3, height: 23 } } },
        MuiSlider: { defaultProps: { size: "small" } },
        MuiTooltip: { styleOverrides: { tooltip: { fontSize: "12px", lineHeight: 1.45 } } }
      }
    });
  }
});

// apps/studio/src/service-client.ts
var service_client_exports = {};
__export(service_client_exports, {
  StudioController: () => StudioController,
  createDisconnectedClient: () => createDisconnectedClient,
  getRuntimeControlState: () => getRuntimeControlState,
  runtimeEditSignature: () => runtimeEditSignature
});
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
  const state = getRuntimeControlState(runtime);
  return JSON.stringify({
    controls: state.controls,
    nodes: state.nodeControls?.nodes,
    animations: state.controlAnimations ?? [],
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
        const snapshot = this.client.getSnapshot();
        if (snapshot.connection !== "connected" || !snapshot.authoring) throw Error("Authoring service unavailable");
        if (snapshot.authoring.authority !== "studio") throw Error("Authority conflict: Studio cannot control a host instance");
        return snapshot.authoring;
      }
      async setIntensity(value) {
        if (!Number.isFinite(value) || value < 0 || value > 1) throw Error("Intensity must be a finite number from 0 to 1");
        return this.setParameters({ intensity: value });
      }
      async setNodeParameters(nodePath, values2) {
        const target = this.target();
        const node2 = target.nodeControls?.nodes.find((row) => JSON.stringify(row.nodePath) === JSON.stringify(nodePath));
        if (target.sdkVersion !== "0.4.0" || !node2) throw Error("Composition node is unavailable");
        const patch = validateControlPatch(node2.schema, values2);
        return this.client.invoke({ name: "lux.node.parameters.set", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          expectedControlSchemaHash: node2.schemaHash,
          nodePath: [...node2.nodePath],
          values: patch,
          mode: "live"
        } });
      }
      async setNodeAnimation(nodePath, controlId2, animation, restart = false) {
        const target = this.target(), state = getRuntimeControlState(target), node2 = target.nodeControls?.nodes.find((row) => JSON.stringify(row.nodePath) === JSON.stringify(nodePath));
        const flat = nodePath.length === 0 && state.sdkVersion !== "0.4.0";
        if (!flat && (target.sdkVersion !== "0.4.0" || !node2 || !node2.schema.some((row) => row.id === controlId2))) throw Error("Composition node control is unavailable");
        if (flat && !state.controlSchema.some((row) => row.id === controlId2)) throw Error("Scene control is unavailable");
        const definitionHash = flat ? state.controlSchemaHash : node2.definitionHash, schemaHash = flat ? state.controlSchemaHash : node2.schemaHash;
        if (animation && (JSON.stringify(animation.nodePath) !== JSON.stringify(nodePath) || animation.controlId !== controlId2 || animation.definitionHash !== definitionHash || animation.schemaHash !== schemaHash)) throw Error("Animation target identity changed");
        return this.client.invoke({ name: "lux.node.animation.set", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          expectedControlSchemaHash: schemaHash,
          nodePath: [...nodePath],
          controlId: controlId2,
          animation,
          ...restart ? { restart: true } : {}
        } });
      }
      async setParameters(values2) {
        const target = this.target();
        const state = getRuntimeControlState(target), patch = validateControlPatch(state.controlSchema, values2);
        const pending = this.latestParameters?.input;
        if (pending && (pending.instanceId !== target.instanceId || pending.expectedGeneration !== target.generation || pending.expectedRevisionId !== target.revisionId || pending.expectedControlSchemaHash !== (state.sdkVersion !== "0.1.0" ? state.controlSchemaHash : void 0))) throw Error("Runtime target changed while parameters were queued");
        this.latestParameters = { name: "lux.parameters.set", input: {
          requestId: this.requestId(),
          instanceId: target.instanceId,
          expectedGeneration: target.generation,
          expectedRevisionId: target.revisionId,
          ...state.sdkVersion !== "0.1.0" ? { expectedControlSchemaHash: state.controlSchemaHash } : {},
          values: { ...pending?.values, ...patch },
          mode: "live"
        } };
        return this.startParameterDrain();
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
import { Button as Button3, Checkbox, ClickAwayListener, Divider, FormControlLabel, IconButton, MenuItem as MenuItem2, Paper, Popper, Select, Slider, TextField, Tooltip } from "@mui/material";
import { Fragment, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function parameterOwner(runtime, nodePath) {
  return runtime?.authority === "studio" ? JSON.stringify([runtime.instanceId, runtime.generation, runtime.revisionId, runtime.controlSchemaHash, nodePath ?? null]) : null;
}
function ParameterRow({ definition: definition2, controlId: controlId2, description, displayLabel, applied, effective, owner, available, client, controller, onError, edits, nodePath, node: node2, animation, issue, animationUnavailable, playback, open, onOpen, onClose }) {
  const [value, setValue] = useState3(applied), [text2, setText] = useState3(String(applied));
  const [optimistic, setOptimistic] = useState3(animation), [period, setPeriod] = useState3(String(animation?.periodSeconds ?? 2));
  const [amount, setAmount] = useState3(String(animation?.amount ?? Math.max(definition2.step ?? 0, (definition2.max - definition2.min) / 10))), [phase, setPhase] = useState3(String(animation?.phase ?? 0));
  const intent = useRef3(null), editing = useRef3(false), button = useRef3(null), row = useRef3(null), editor = useRef3(null), undo = useRef3([]), drafting = useRef3(/* @__PURE__ */ new Set()), animationKey = animation ? JSON.stringify(animation) : "", animationDescriptionId = useId();
  useEffect2(() => {
    if (!intent.current) {
      setValue(applied);
      if (!editing.current) setText(String(applied));
    }
  }, [applied]);
  useEffect2(() => {
    setOptimistic(animation);
    if (animation) {
      if (!drafting.current.has("period")) setPeriod(String(animation.periodSeconds));
      if (!drafting.current.has("amount")) setAmount(String(animation.amount));
      if (!drafting.current.has("phase")) setPhase(String(animation.phase));
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
          setValue(confirmed);
          if (!editing.current) setText(String(confirmed));
        }
      }
    }
  }
  function commitText() {
    editing.current = false;
    const next = text2.trim() === "" ? NaN : Number(text2);
    if (!Number.isFinite(next) || next < definition2.min || next > definition2.max) {
      setText(String(value));
      onError(`${displayLabel} must be between ${definition2.min} and ${definition2.max}.`);
      return;
    }
    if (next !== value) void change(next);
  }
  async function setAnimation(next, record2 = true) {
    if (!available || !owner || !nodePath || !node2 || parameterOwner(client.getSnapshot().authoring, nodePath) !== owner) return;
    const pending = {};
    if (record2) undo.current.push({ prior: optimistic ?? null, token: pending });
    intent.current = pending;
    setOptimistic(next);
    onError(null);
    edits?.changed();
    const write = controller.setNodeAnimation(nodePath, controlId2, next ?? null);
    edits?.track(write);
    try {
      await write;
    } catch (error) {
      if (record2) {
        const index = undo.current.findIndex((entry) => entry.token === pending);
        if (index >= 0) undo.current.splice(index, 1);
      }
      if (intent.current === pending && parameterOwner(client.getSnapshot().authoring, nodePath) === owner) {
        setOptimistic(animation);
        setPeriod(String(animation?.periodSeconds ?? 2));
        setAmount(String(animation?.amount ?? Math.max(definition2.step ?? 0, (definition2.max - definition2.min) / 10)));
        setPhase(String(animation?.phase ?? 0));
        onError(String(error));
      }
    } finally {
      if (intent.current === pending) intent.current = null;
    }
  }
  const active = optimistic ?? animation;
  const add = () => setAnimation({ nodePath: [...nodePath], definitionHash: node2.definitionHash, schemaHash: node2.schemaHash, controlId: controlId2, shape: "sine", periodSeconds: 2, amount: Math.max(definition2.step ?? 0, (definition2.max - definition2.min) / 10), phase: 0, enabled: true });
  const update = (patch) => {
    if (!active) return;
    const next = { ...active, ...patch };
    if (JSON.stringify(next) !== JSON.stringify(active)) void setAnimation(next);
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
    const raw = kind === "period" ? period : kind === "amount" ? amount : phase, next = Number(raw), valid = raw.trim() !== "" && Number.isFinite(next) && (kind === "period" ? next >= 0.05 && next <= 3600 : kind === "amount" ? next >= 0 : next >= 0 && next <= 1);
    if (!valid) {
      onError(kind === "period" ? "Period must be between 0.05 and 3600 seconds." : kind === "amount" ? "Amount must be zero or greater." : "Phase must be between 0 and 1.");
      setPeriod(String(active.periodSeconds));
      setAmount(String(active.amount));
      setPhase(String(active.phase));
      return;
    }
    const current = kind === "period" ? active.periodSeconds : kind === "amount" ? active.amount : active.phase;
    if (next === current) return;
    void update(kind === "period" ? { periodSeconds: next } : kind === "amount" ? { amount: next } : { phase: next });
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
      /* @__PURE__ */ jsx3(TextField, { id: `parameter-${definition2.id}`, className: "parameter-number", size: "small", type: "number", value: text2, disabled: !available, slotProps: { htmlInput: { "aria-label": `${displayLabel} value`, min: definition2.min, max: definition2.max, step: definition2.step ?? "any" } }, onChange: (event) => {
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
    /* @__PURE__ */ jsx3(Popper, { open, anchorEl: row.current, placement: "bottom-end", modifiers: animationModifiers, className: "animation-popper", children: /* @__PURE__ */ jsx3(ClickAwayListener, { onClickAway: onClose, children: /* @__PURE__ */ jsxs3(Paper, { ref: editor, role: "dialog", "aria-label": `Animate ${displayLabel}`, tabIndex: -1, onKeyDown: (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        button.current?.focus();
      }
    }, className: "animation-editor", children: [
      /* @__PURE__ */ jsx3("header", { children: /* @__PURE__ */ jsxs3("strong", { children: [
        "Animate ",
        displayLabel
      ] }) }),
      issue && /* @__PURE__ */ jsx3("p", { role: "alert", children: issue }),
      playback === "paused" && /* @__PURE__ */ jsx3("p", { className: "hint", children: "Press Play to animate." }),
      !active ? /* @__PURE__ */ jsxs3(Fragment, { children: [
        /* @__PURE__ */ jsx3("p", { className: "hint", children: "Move this control automatically with a repeating waveform." }),
        /* @__PURE__ */ jsx3(Button3, { variant: "contained", onClick: add, children: "Add LFO" }),
        /* @__PURE__ */ jsx3(Divider, {}),
        /* @__PURE__ */ jsx3(Button3, { onClick: () => void change(definition2.default), children: "Reset base to default" }),
        undo.current.length > 0 && /* @__PURE__ */ jsx3(Button3, { onClick: () => {
          const prior = undo.current.pop()?.prior;
          if (prior) void setAnimation(prior, false);
        }, children: "Undo remove" })
      ] }) : /* @__PURE__ */ jsxs3(Fragment, { children: [
        /* @__PURE__ */ jsx3(FormControlLabel, { control: /* @__PURE__ */ jsx3(Checkbox, { checked: animating, disabled: blocked, onChange: (event) => void update({ enabled: event.target.checked }) }), label: blocked ? "Unavailable" : animating ? "On" : "Off" }),
        /* @__PURE__ */ jsxs3("label", { children: [
          "Shape",
          /* @__PURE__ */ jsx3(Select, { size: "small", value: active.shape, disabled: blocked, onChange: (event) => void update({ shape: event.target.value }), children: ["sine", "triangle", "saw", "square"].map((shape) => /* @__PURE__ */ jsx3(MenuItem2, { value: shape, children: shape[0].toUpperCase() + shape.slice(1) }, shape)) })
        ] }),
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
          if (typeof next === "number") void update({ periodSeconds: next });
        } }),
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
          if (typeof next === "number") void update({ amount: next });
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
          /* @__PURE__ */ jsxs3("label", { children: [
            "Start phase ",
            /* @__PURE__ */ jsx3(TextField, { size: "small", type: "number", value: phase, disabled: blocked, slotProps: { htmlInput: { min: 0, max: 1, step: 0.01, "aria-label": "Animation start phase" } }, onFocus: () => drafting.current.add("phase"), onChange: (event) => setPhase(event.target.value), onBlur: () => {
              commitDraft("phase");
              drafting.current.delete("phase");
            } })
          ] }),
          /* @__PURE__ */ jsx3(Button3, { disabled: blocked, onClick: () => void restartAnimation(), children: "Restart animation" }),
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
function ParameterInspector({ runtime, available, client, controller, onError, edits, nodePath }) {
  const [openId, setOpenId] = useState3(null), [groupOpen, setGroupOpen] = useState3({}), selectionOwner = parameterOwner(runtime, nodePath);
  useEffect2(() => {
    setOpenId(null);
    setGroupOpen({});
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
  const counts = /* @__PURE__ */ new Map();
  for (const definition2 of schema3) counts.set(definition2.label, (counts.get(definition2.label) ?? 0) + 1);
  const display = (d) => counts.get(d.label) > 1 ? `${d.id} \xB7 ${d.label}` : d.label;
  const renderControl = (definition2) => {
    const target = compositionControlTarget(runtime, nodePath ?? [], definition2.id), targetNode = target ? visualControlNode(runtime, target.nodePath) : void 0, effectiveNode = target ? runtime.effectiveNodeControls?.nodes.find((row) => samePath(row.nodePath, target.nodePath)) : void 0;
    if (nodePath && (!target || !targetNode)) return /* @__PURE__ */ jsx3("p", { className: "hint", children: "This control is no longer available. Rebuild or select another node." }, definition2.id);
    const controlId2 = target?.controlId ?? definition2.id, applied = targetNode?.values[controlId2] ?? publicState.controls[definition2.id], animation = runtime.controlAnimations?.find((row) => !!target && samePath(row.nodePath, target.nodePath) && row.controlId === controlId2), issue = runtime.controlAnimationIssues?.find((row) => !!target && samePath(row.nodePath, target.nodePath) && row.controlId === controlId2)?.message, owner = parameterOwner(runtime, target?.nodePath);
    const animationUnavailable = target ? void 0 : "Animation is unavailable because this control does not map to one component control.";
    return /* @__PURE__ */ jsx3(ParameterRow, { definition: definition2, controlId: controlId2, description: occurrence?.metadata.controlDescriptions[definition2.id], displayLabel: display(definition2), applied, effective: effectiveNode?.values[controlId2] ?? runtime.effectiveControls?.[controlId2] ?? applied, owner, available, client, controller, onError, edits, nodePath: target?.nodePath, node: targetNode, animation, issue, animationUnavailable, playback: runtime.playback, open: openId === definition2.id, onOpen: () => setOpenId((current) => current === definition2.id ? null : definition2.id), onClose: () => setOpenId((current) => current === definition2.id ? null : current) }, `${selectionOwner}:${definition2.id}`);
  };
  const grouped = /* @__PURE__ */ new Map();
  for (const definition2 of schema3) if (definition2.group) grouped.set(definition2.group, [...grouped.get(definition2.group) ?? [], definition2]);
  const renderedGroups = /* @__PURE__ */ new Set(), content = schema3.flatMap((definition2) => {
    if (!definition2.group) return [renderControl(definition2)];
    if (renderedGroups.has(definition2.group)) return [];
    renderedGroups.add(definition2.group);
    const group2 = definition2.group, definitions = grouped.get(group2);
    return [/* @__PURE__ */ jsxs3("details", { className: "parameter-group", open: groupOpen[group2] ?? true, onToggle: (event) => {
      if (event.target === event.currentTarget) {
        const open = event.currentTarget.open;
        setGroupOpen((current) => ({ ...current, [group2]: open }));
        if (!open) setOpenId((current) => definitions.some((definition3) => definition3.id === current) ? null : current);
      }
    }, children: [
      /* @__PURE__ */ jsx3("summary", { children: group2 }),
      /* @__PURE__ */ jsx3("div", { className: "parameter-group-controls", children: definitions.map(renderControl) })
    ] }, `${selectionOwner}:group:${group2}`)];
  });
  return /* @__PURE__ */ jsxs3(Fragment, { children: [
    unselectedIssues.map((row) => /* @__PURE__ */ jsxs3("p", { role: "alert", children: [
      "Animation for ",
      row.controlId,
      " is disabled. ",
      row.message
    ] }, `${row.index}:${row.controlId}`)),
    schema3.length === 0 && /* @__PURE__ */ jsx3("p", { className: "hint", children: "This visual defines no live controls." }),
    content
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

// apps/studio/src/preview.tsx
import { useEffect as useEffect3, useRef as useRef4, useState as useState4 } from "react";
import { Button as Button4 } from "@mui/material";
import { jsx as jsx4, jsxs as jsxs5 } from "react/jsx-runtime";
function Preview({ runtime, port, moved, onDock, onError }) {
  const target = useRef4(null);
  const portRef = useRef4(port);
  portRef.current = port;
  const bindingRef = useRef4(null);
  if (!bindingRef.current) bindingRef.current = new PreviewBinding({ attach: (request) => {
    if (!portRef.current) return Promise.reject(Error("Presentation service unavailable"));
    return portRef.current.attach(request);
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
  const output = runtime?.output ?? DEFAULT_OUTPUT;
  return /* @__PURE__ */ jsxs5("div", { className: "preview-area", children: [
    /* @__PURE__ */ jsx4("div", { className: "preview-surface", ref: target, "aria-label": "Final authoring output", title: `Output ${output.width} \xD7 ${output.height} \xB7 Fit to view`, "data-output-width": output.width, "data-output-height": output.height, children: state !== "attached" && /* @__PURE__ */ jsxs5("div", { className: "preview-empty", children: [
      /* @__PURE__ */ jsx4("div", { className: "preview-mark", "aria-hidden": "true", children: "L" }),
      /* @__PURE__ */ jsx4("h1", { children: moved ? "Preview in separate window" : state === "attaching" ? "Attaching preview" : state === "failed" ? "Preview unavailable" : "Awaiting runtime" }),
      /* @__PURE__ */ jsx4("p", { children: moved ? "Your authoring instance stays with the service." : error ?? "Completed output will appear here when the authoring service connects." }),
      moved ? /* @__PURE__ */ jsx4(Button4, { onClick: onDock, children: "Return preview here" }) : /* @__PURE__ */ jsx4("span", { className: "empty-caption", children: "FINAL OUTPUT \xB7 FIT TO VIEW" })
    ] }) }),
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
  }
});

// apps/studio/src/StudioMenu.tsx
import { createContext, useContext, useId as useId2, useRef as useRef5, useState as useState5 } from "react";
import { Button as Button5, ClickAwayListener as ClickAwayListener2, MenuList, Paper as Paper2, Popper as Popper2 } from "@mui/material";
import { jsx as jsx5, jsxs as jsxs6 } from "react/jsx-runtime";
function useMenuState() {
  return useState5(null);
}
function StudioMenu({ label, children: children2, buttonRef, className = "" }) {
  const local = useMenuState();
  const [active, setActive] = useContext(MenuContext) ?? local;
  const ownRef = useRef5(null);
  const trigger = buttonRef ?? ownRef;
  const id2 = useId2();
  const open = active === id2;
  function close(restoreFocus = false) {
    setActive((current) => current === id2 ? null : current);
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
  return /* @__PURE__ */ jsx5(ClickAwayListener2, { onClickAway: () => close(), children: /* @__PURE__ */ jsxs6("div", { className: `studio-menu ${className}`, children: [
    /* @__PURE__ */ jsx5(
      Button5,
      {
        ref: trigger,
        "data-studio-menu": true,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? id2 : void 0,
        className: "studio-menu-trigger",
        color: "inherit",
        onClick: () => setActive((current) => current === id2 ? null : id2),
        onKeyDown: (event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(id2);
          }
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            adjacent(event.key === "ArrowRight" ? 1 : -1);
          }
        },
        children: label
      }
    ),
    /* @__PURE__ */ jsx5(Popper2, { open, anchorEl: trigger.current, placement: "bottom-start", sx: { zIndex: 1300 }, children: /* @__PURE__ */ jsx5(Paper2, { className: "studio-menu-paper", children: /* @__PURE__ */ jsx5(
      MenuList,
      {
        id: id2,
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
    isReservedPanelKey = (key) => ["__proto__", "constructor", "prototype"].includes(key);
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
    if (item.value && typeof item.value === "object") for (const [key, child] of Object.entries(item.value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw Error("Unsafe layout key");
      stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  const result = schema2.parse(value);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > LAYOUT_BYTE_LIMIT) throw Error("Layout exceeds 128 KiB");
  if (Object.keys(result.dock.panels).length + Object.keys(result.closedPanels).length > 32) throw Error("Too many panels");
  const counts = /* @__PURE__ */ new Map(), seenPanels = /* @__PURE__ */ new Set(), seenGroups = /* @__PURE__ */ new Set();
  for (const [panelId, record2] of [...Object.entries(result.dock.panels), ...Object.entries(result.closedPanels)]) {
    if (record2.id !== panelId) throw Error("Panel identity mismatch");
    const definition2 = registry.get(record2.contentComponent), count = (counts.get(definition2.kind) ?? 0) + 1;
    if (!definition2.multiple && count > 1) throw Error("Duplicate singleton panel: " + definition2.kind);
    counts.set(definition2.kind, count);
    if ((record2.minimumWidth ?? 0) > (record2.maximumWidth ?? 32768) || (record2.minimumHeight ?? 0) > (record2.maximumHeight ?? 32768)) throw Error("Inconsistent panel size constraints");
    record2.params = { viewState: definition2.parseViewState(record2.params?.viewState) };
    record2.title = definition2.title;
    record2.renderer = "always";
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
function parsePersonalLayout(text2, registry) {
  if (new TextEncoder().encode(text2).byteLength > LAYOUT_BYTE_LIMIT) throw Error("Layout exceeds 128 KiB");
  return validatePersonalLayout(JSON.parse(text2), registry);
}
function defaultPersonalLayout(registry, mode) {
  const panels = Object.fromEntries(["preview", "source", "graph", "library", "inspector", "diagnostics", "jobs"].map((kind) => [kind, { id: kind, contentComponent: kind, title: registry.get(kind).title, renderer: "always", params: { viewState: {} } }]));
  const leaf = (id2, views, size2) => ({ type: "leaf", size: size2, data: { id: id2, views, activeView: views[0] } });
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
var DOCKVIEW_VERSION, LAYOUT_BYTE_LIMIT, id, size, group, node, panel, schema2;
var init_personal_layout = __esm({
  "apps/studio/src/layout/personal-layout.ts"() {
    "use strict";
    DOCKVIEW_VERSION = "7.0.4";
    LAYOUT_BYTE_LIMIT = 131072;
    id = z5.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
    size = z5.number().finite().min(0).max(32768);
    group = z5.object({
      id,
      views: z5.array(id).min(1).max(32),
      activeView: id.optional(),
      locked: z5.literal(false).optional(),
      hideHeader: z5.literal(false).optional(),
      headerPosition: z5.enum(["top", "bottom", "left", "right"]).optional()
    }).strict();
    node = z5.lazy(() => z5.union([
      z5.object({ type: z5.literal("leaf"), data: group, size: size.optional(), visible: z5.literal(true).optional() }).strict(),
      z5.object({ type: z5.literal("branch"), data: z5.array(node).max(64), size: size.optional() }).strict()
    ]));
    panel = z5.object({
      id,
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
        activeGroup: id.optional(),
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
      key(name) {
        if (!name.trim() || name.length > 80) throw Error("Invalid layout name");
        return "lux.personal-layout.v1." + encodeURIComponent(name);
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
      capture(name) {
        this.live();
        const closedPanels = Object.fromEntries(Object.entries(this.closed).filter(([id2]) => !this.api.getPanel(id2)));
        return validatePersonalLayout({ format: "lux-personal-layout", version: 1, dockviewVersion: DOCKVIEW_VERSION, name, dock: this.api.toJSON(), closedPanels }, this.registry);
      }
      save(name) {
        this.live();
        const layout = this.capture(name);
        this.storage.setItem(this.key(name), JSON.stringify(layout));
      }
      restore(name) {
        this.live();
        try {
          const text2 = this.storage.getItem(this.key(name));
          if (text2 === null) {
            this.apply(defaultPersonalLayout(this.registry, this.mode));
            return { restored: false, reason: "No saved personal layout" };
          }
          this.apply(parsePersonalLayout(text2, this.registry));
          return { restored: true };
        } catch (error) {
          this.apply(defaultPersonalLayout(this.registry, this.mode));
          return { restored: false, reason: "Saved layout unavailable or incompatible: " + String(error) };
        }
      }
      reset(name, mode = this.mode) {
        this.live();
        this.mode = mode;
        this.apply(defaultPersonalLayout(this.registry, this.mode));
        this.storage.removeItem(this.key(name));
      }
      groupTarget(id2) {
        this.live();
        const group2 = this.api.getGroup(id2);
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
      open(kind, id2 = kind, group2) {
        this.live();
        const definition2 = this.registry.get(kind);
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(id2) || isReservedPanelKey(id2)) throw Error("Invalid panel identity");
        const existing = this.api.getPanel(id2);
        if (existing) {
          if (existing.view.contentComponent !== kind) throw Error("Panel identity already belongs to another kind");
          existing.api.setActive();
          existing.group.focus();
          return;
        }
        if (!definition2.multiple && this.api.panels.some((panel2) => panel2.view.contentComponent === kind)) throw Error("Panel is already open");
        if (!definition2.multiple && Object.entries(this.closed).some(([key, panel2]) => key !== id2 && !this.api.getPanel(key) && panel2.contentComponent === kind)) throw Error("Reopen the existing panel identity to preserve its view state");
        const previous = this.closed[id2];
        if (previous && previous.contentComponent !== kind) throw Error("Closed panel identity belongs to another kind");
        if (this.api.panels.length + Object.keys(this.closed).filter((key) => !this.api.getPanel(key)).length >= 32 && !previous) throw Error("Too many panels");
        this.api.addPanel({ ...group2 ? { position: { referenceGroup: group2, direction: "within" } } : {}, id: id2, component: kind, title: definition2.title, renderer: "always", params: { viewState: definition2.parseViewState(previous?.params?.viewState) } });
        delete this.closed[id2];
        const opened = this.api.getPanel(id2);
        opened?.api.setActive();
        opened?.group.focus();
      }
      close(id2) {
        this.live();
        const panel2 = this.api.getPanel(id2);
        if (panel2) this.api.removePanel(panel2);
      }
      openBeside(kind, referenceId) {
        this.live();
        const reference = this.api.getPanel(referenceId);
        this.open(kind);
        const panel2 = this.api.getPanel(kind);
        if (reference && panel2 && panel2 !== reference && panel2.group === reference.group) panel2.api.moveTo({ group: reference.group, position: "right" });
      }
      move(id2, referenceId, position) {
        this.live();
        const panel2 = this.api.getPanel(id2), target = this.api.getPanel(referenceId);
        if (!panel2 || !target || panel2 === target) throw Error("Choose two different open panels");
        panel2.api.moveTo({ group: target.group, position });
      }
      setViewState(id2, value) {
        this.live();
        const panel2 = this.api.getPanel(id2);
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

// ../../node_modules/.pnpm/dockview-react@7.0.4_react-_15c3a7ae96275b2a46a030edf7bd76e8/node_modules/dockview-react/dist/styles/dockview.css
var init_dockview = __esm({
  "../../node_modules/.pnpm/dockview-react@7.0.4_react-_15c3a7ae96275b2a46a030edf7bd76e8/node_modules/dockview-react/dist/styles/dockview.css"() {
  }
});

// apps/studio/src/layout/LuxDockLayout.tsx
import { useEffect as useEffect4, useMemo as useMemo2, useRef as useRef6, useState as useState6, useId as useId3 } from "react";
import { Button as Button6, Menu as Menu2, MenuItem as MenuItem3, Tooltip as Tooltip2 } from "@mui/material";
import { DockviewReact, themeDark } from "dockview-react";
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs7 } from "react/jsx-runtime";
function LuxDockLayout({ registry, panels, storage: storage2, name = "Default", mode = "desktop", nonce, onReady }) {
  const adapter = useRef6(null);
  const components = useMemo2(() => Object.fromEntries(registry.list().map((definition2) => {
    const Panel = panels[definition2.kind];
    if (!Panel) throw Error("Missing real panel renderer: " + definition2.kind);
    const Component = (props) => /* @__PURE__ */ jsx6(
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
    const [anchor, setAnchor] = useState6(null), [error, setError] = useState6("");
    const id2 = useId3(), selected = useRef6(false);
    return /* @__PURE__ */ jsxs7(Fragment2, { children: [
      /* @__PURE__ */ jsx6(Tooltip2, { title: "Add pane", children: /* @__PURE__ */ jsx6(
        Button6,
        {
          className: "pane-add",
          "aria-label": `Add pane to ${activePanel?.title ?? "empty"} group`,
          "aria-haspopup": "menu",
          "aria-expanded": !!anchor,
          "aria-controls": anchor ? id2 : void 0,
          onPointerDown: (event) => event.stopPropagation(),
          onClick: (event) => {
            selected.current = false;
            setError("");
            setAnchor(event.currentTarget);
          },
          children: "+"
        }
      ) }),
      /* @__PURE__ */ jsxs7(
        Menu2,
        {
          id: id2,
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
              return /* @__PURE__ */ jsx6(MenuItem3, { onClick: () => {
                try {
                  adapter.current?.openInGroup(definition2.kind, group2);
                  selected.current = true;
                  setAnchor(null);
                } catch (reason) {
                  setError(String(reason));
                }
              }, children: action === "Move" ? `Move ${definition2.title} here` : `${action} ${definition2.title}` }, definition2.kind);
            }),
            error && /* @__PURE__ */ jsx6("li", { role: "alert", children: error })
          ]
        }
      )
    ] });
  }, [registry]);
  useEffect4(() => () => {
    adapter.current?.dispose();
    adapter.current = null;
  }, []);
  if (!/^[A-Za-z0-9+/=]{24,64}$/.test(nonce)) throw Error("Studio style nonce unavailable");
  return /* @__PURE__ */ jsx6(
    DockviewReact,
    {
      rightHeaderActionsComponent: HeaderActions,
      components,
      theme: themeDark,
      nonce,
      disableFloatingGroups: true,
      dndStrategy: "pointer",
      onReady: (event) => {
        adapter.current?.dispose();
        const current = new LuxDockviewAdapter(event.api, registry, storage2, mode);
        adapter.current = current;
        const result = current.restore(name);
        onReady?.(current, result);
      }
    }
  );
}
var init_LuxDockLayout = __esm({
  "apps/studio/src/layout/LuxDockLayout.tsx"() {
    "use strict";
    init_dockview_adapter();
    init_dockview();
  }
});

// apps/studio/src/layout/StudioDockShell.tsx
import { useLayoutEffect, useMemo as useMemo3, useRef as useRef7, useState as useState7 } from "react";
import { createPortal } from "react-dom";
import { Alert, Button as Button7, TextField as TextField2, MenuItem as MenuItem4, Divider as Divider2, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { jsx as jsx7, jsxs as jsxs8 } from "react/jsx-runtime";
function StudioDockShell({ compact, showInspector, toolsHost, onOpenPanelReady, ...content }) {
  const [mode] = useState7(() => window.innerWidth < 1100 ? "laptop" : "desktop");
  const [name, setName] = useState7("Default"), [message, setMessage] = useState7("");
  const [layoutsOpen, setLayoutsOpen] = useState7(false);
  const viewButton = useRef7(null);
  const adapter = useRef7(null), expanded = useRef7(null);
  const compactRef = useRef7(compact);
  compactRef.current = compact;
  const hosts = useMemo3(() => Object.fromEntries(kinds.map((kind) => {
    const host = document.createElement("div");
    host.className = `studio-pane-host studio-pane-${kind}`;
    return [kind, host];
  })), []);
  const slots = useRef7({});
  const registry = useMemo3(() => new PanelRegistry(createStudioPanelRegistry().list().map((definition2) => ({ ...definition2, multiple: false }))), []);
  const panels = useMemo3(() => Object.fromEntries(kinds.map((kind) => [kind, function PaneSlot() {
    const slot = useRef7(null);
    useLayoutEffect(() => {
      slots.current[kind] = slot.current;
      if (!(kind === "preview" && compactRef.current)) slot.current.append(hosts[kind]);
      return () => {
        delete slots.current[kind];
        if (hosts[kind].parentElement === slot.current) hosts[kind].remove();
      };
    }, []);
    return /* @__PURE__ */ jsx7("div", { ref: slot, className: "studio-pane-slot" });
  }])), [hosts]);
  useLayoutEffect(() => {
    const destination = compact ? expanded.current : slots.current.preview;
    if (destination) destination.append(hosts.preview);
    else hosts.preview.remove();
  }, [compact, hosts]);
  useLayoutEffect(() => {
    const destination = compact && showInspector ? expanded.current : slots.current.inspector;
    if (destination) destination.append(hosts.inspector);
    else hosts.inspector.remove();
  }, [compact, hosts, showInspector]);
  function action(run) {
    try {
      if (!adapter.current) throw Error("Layout is loading");
      run(adapter.current);
    } catch (reason) {
      setMessage(String(reason));
    }
  }
  useLayoutEffect(() => () => onOpenPanelReady?.(null), [onOpenPanelReady]);
  function reset(next) {
    action((value) => {
      value.reset(name, next);
      setMessage(`Reset to ${next} layout`);
    });
  }
  const nonce = document.querySelector('meta[name="style-nonce"]')?.content ?? "";
  const tools = /* @__PURE__ */ jsxs8("div", { className: "layout-tools", hidden: compact, children: [
    /* @__PURE__ */ jsxs8(StudioMenu, { label: "View", buttonRef: viewButton, children: [
      kinds.map((kind) => /* @__PURE__ */ jsx7(MenuItem4, { onClick: () => action((value) => value.open(kind)), children: registry.get(kind).title }, kind)),
      /* @__PURE__ */ jsx7(Divider2, {}),
      /* @__PURE__ */ jsx7(MenuItem4, { onClick: () => setLayoutsOpen(true), children: "Layouts\u2026" })
    ] }),
    /* @__PURE__ */ jsxs8(
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
          /* @__PURE__ */ jsx7(DialogTitle, { id: "workspace-layouts-title", children: "Workspace layouts" }),
          /* @__PURE__ */ jsxs8(DialogContent, { children: [
            /* @__PURE__ */ jsxs8("div", { className: "layout-actions", children: [
              /* @__PURE__ */ jsx7(TextField2, { size: "small", label: "Layout name", value: name, onChange: (event) => setName(event.target.value) }),
              /* @__PURE__ */ jsx7(Button7, { onClick: () => action((value) => {
                value.save(name);
                setMessage(`Saved layout: ${name}`);
              }), children: "Save layout" }),
              /* @__PURE__ */ jsx7(Button7, { onClick: () => action((value) => {
                const result = value.restore(name);
                setMessage(result.restored ? `Restored layout: ${name}` : result.reason ?? "Default layout restored");
              }), children: "Restore layout" }),
              /* @__PURE__ */ jsx7(Button7, { onClick: () => reset("desktop"), children: "Reset desktop layout" }),
              /* @__PURE__ */ jsx7(Button7, { onClick: () => reset("laptop"), children: "Reset laptop layout" })
            ] }),
            message && /* @__PURE__ */ jsx7(Alert, { severity: "info", role: "status", children: message })
          ] }),
          /* @__PURE__ */ jsx7(DialogActions, { children: /* @__PURE__ */ jsx7(Button7, { onClick: () => setLayoutsOpen(false), children: "Done" }) })
        ]
      }
    )
  ] });
  return /* @__PURE__ */ jsxs8("div", { className: `studio-dock-shell ${compact ? "dock-compact" : ""}`, children: [
    toolsHost ? createPortal(tools, toolsHost) : tools,
    message && !layoutsOpen && /* @__PURE__ */ jsx7(Alert, { severity: "info", role: "status", onClose: () => setMessage(""), children: message }),
    /* @__PURE__ */ jsx7("div", { className: "studio-dock-grid", hidden: compact, children: /* @__PURE__ */ jsx7(
      LuxDockLayout,
      {
        registry,
        panels,
        storage,
        nonce,
        mode,
        onReady: (value, result) => {
          adapter.current = value;
          onOpenPanelReady?.((kind) => {
            if (kind === "inspector") value.openBeside(kind, "graph");
            else value.open(kind);
          });
          if (result.reason && result.reason !== "No saved personal layout") setMessage(result.reason);
        }
      }
    ) }),
    /* @__PURE__ */ jsx7("div", { className: `studio-expanded-pane ${showInspector ? "studio-expanded-with-inspector" : ""}`, hidden: !compact, ref: expanded }),
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
    kinds = ["preview", "source", "library", "inspector", "diagnostics", "jobs", "graph"];
    storage = {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
      removeItem: (key) => window.localStorage.removeItem(key)
    };
  }
});

// apps/studio/src/renderer-snapshot.ts
function urgentState(snapshot) {
  const { receivedAtMs, visualFps, uiFps, performance, authoring, ...state } = snapshot;
  const runtime = authoring ? (({ frameId, timeSeconds, effectiveControls, effectiveNodeControls, ...rest }) => rest)(authoring) : null;
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
  function publish() {
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
    if (urgentState(next) !== signature) publish();
    else timer ??= setTimeout(publish, 100);
  }
  return {
    // Do not bypass the cache here: React reads again during commit consistency
    // checks, which would otherwise reintroduce per-frame synchronous renders.
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      if (!detach) {
        detach = client.subscribe(changed);
        publish();
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
import { useState as useState8 } from "react";
import { jsx as jsx8, jsxs as jsxs9 } from "react/jsx-runtime";
function Disclosure({ title, badge, defaultOpen = false, className = "", children: children2 }) {
  const [open, setOpen] = useState8(defaultOpen);
  return /* @__PURE__ */ jsxs9(
    "details",
    {
      className: `studio-disclosure ${className}`,
      open,
      onToggle: (event) => setOpen(event.currentTarget.open),
      children: [
        /* @__PURE__ */ jsxs9("summary", { children: [
          title,
          badge && /* @__PURE__ */ jsx8("span", { className: "disclosure-badge", children: badge })
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
function diagnosticTarget(diagnostic, snapshot) {
  const path = diagnostic.file;
  if (diagnostic.candidateOnly || diagnostic.draftVersion !== snapshot.version || !path || !Object.hasOwn(snapshot.source.files, path)) return null;
  const text2 = snapshot.source.files[path], lines = text2.split("\n");
  const position = (value) => value !== void 0 && Number.isFinite(value) ? Math.max(0, Math.floor(value) - 1) : 0;
  const line = Math.min(position(diagnostic.line), lines.length - 1);
  const lineText = lines[line].replace(/\r$/, "");
  let offset = Math.min(position(diagnostic.column), lineText.length);
  for (let index = 0; index < line; index++) offset += lines[index].length + 1;
  return { path, offset };
}
var init_diagnostics = __esm({
  "apps/studio/src/source/diagnostics.ts"() {
    "use strict";
    init_source_equality();
  }
});

// apps/studio/src/source/ProblemsPanel.tsx
import { Button as Button8 } from "@mui/material";
import { jsx as jsx9, jsxs as jsxs10 } from "react/jsx-runtime";
function ProblemsPanel({ diagnostics, snapshot, onNavigate }) {
  if (!diagnostics.length) return null;
  return /* @__PURE__ */ jsxs10("section", { "aria-label": "Source diagnostics", children: [
    /* @__PURE__ */ jsx9("h3", { children: "Source diagnostics" }),
    /* @__PURE__ */ jsx9("ul", { children: diagnostics.map((diagnostic, index) => {
      const target = diagnosticTarget(diagnostic, snapshot), stale = diagnostic.draftVersion !== snapshot.version;
      return /* @__PURE__ */ jsxs10("li", { children: [
        /* @__PURE__ */ jsxs10(Button8, { disabled: !target, onClick: () => target && onNavigate(target), children: [
          diagnostic.file ? `${diagnostic.file}:${diagnostic.line ?? ""}:${diagnostic.column ?? ""} ` : "",
          diagnostic.message
        ] }),
        diagnostic.candidateOnly ? /* @__PURE__ */ jsx9("span", { children: "Diagnostic belongs to a rejected candidate; the displayed source is unchanged." }) : stale ? /* @__PURE__ */ jsx9("span", { children: "Stale diagnostic: source has changed. Build again to refresh." }) : !target && /* @__PURE__ */ jsx9("span", { children: "Location unavailable in this source bundle." })
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
import { useCallback, useEffect as useEffect5, useMemo as useMemo4, useRef as useRef8, useState as useState9, useSyncExternalStore } from "react";
import { Alert as Alert2, Button as Button9, Chip, CssBaseline, Paper as Paper3, ThemeProvider, IconButton as IconButton2, Tooltip as Tooltip3, Menu as Menu4, MenuItem as MenuItem5 } from "@mui/material";
import { Fragment as Fragment3, jsx as jsx10, jsxs as jsxs11 } from "react/jsx-runtime";
function metricText(metric, nowMs) {
  if (!metric || !Number.isFinite(metric.value) || metric.value < 0 || !Number.isFinite(metric.sampledAtMs) || !Number.isFinite(metric.coverage) || metric.coverage <= 0 || metric.coverage > 1 || metric.sampledAtMs > nowMs) {
    return { value: "Unavailable", detail: "No observed samples" };
  }
  const age = nowMs - metric.sampledAtMs;
  return { value: `${metric.value.toFixed(1)} fps`, detail: `${age > 2e3 ? "Stale \xB7 " : ""}${Math.round(metric.coverage * 100)}% coverage \xB7 ${(age / 1e3).toFixed(1)}s ago` };
}
function MetricView({ label, metric, nowMs }) {
  const text2 = metricText(metric, nowMs);
  return /* @__PURE__ */ jsxs11("div", { className: "metric", children: [
    /* @__PURE__ */ jsx10("span", { children: label }),
    /* @__PURE__ */ jsx10("strong", { children: text2.value }),
    /* @__PURE__ */ jsx10("small", { children: text2.detail })
  ] });
}
function StudioApp(props) {
  return /* @__PURE__ */ jsxs11(ThemeProvider, { theme: studioTheme, children: [
    /* @__PURE__ */ jsx10(CssBaseline, {}),
    /* @__PURE__ */ jsx10(StudioLayout, { ...props })
  ] });
}
function controlOwner(snapshot) {
  const runtime = snapshot.authoring;
  return snapshot.connection === "connected" && runtime?.authority === "studio" ? parameterOwner(runtime) : null;
}
function sentenceCase(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}
function sourceDiagnosticFault(fault, sourceDiagnostics) {
  return !!fault && fault.includes("SourceCompileError:") && sourceDiagnostics.length > 0 && sourceDiagnostics.every((diagnostic) => fault.includes(diagnostic.message));
}
function studioStatus(snapshot, sourceProblemCount = 0) {
  const jobs = [...snapshot.jobs];
  const latest = jobs.at(-1), active = jobs.findLast((job) => activeJobStates.has(job.state.toLowerCase()));
  const build = active?.summary ?? (latest?.state.toLowerCase() === "failed" ? "Build failed" : latest?.state.toLowerCase() === "succeeded" ? "Build ready" : "Build idle");
  const problems = sourceProblemCount + (snapshot.authoring?.fault ? 1 : 0) + jobs.filter((job) => !!job.fault || job.state.toLowerCase() === "failed").length;
  const runtime = snapshot.connection === "connecting" ? "Connecting" : snapshot.connection !== "connected" ? "Disconnected" : snapshot.authoring?.fault || snapshot.authoring?.playback === "failed" ? "Failed" : snapshot.authoring ? sentenceCase(snapshot.authoring.playback) : "No runtime";
  return { build, building: !!active, problems, runtime };
}
function StudioLayout({ client, presentation, windows, previewOnly = false, nowMs, sourcePanel, sourceDiagnostics, libraryPanel, appCommands, fileMenu, previewActions, appError, controlEdits, sourceChanged, controlsAvailable }) {
  const [toolsHost, setToolsHost] = useState9(null);
  const [transportMenu, setTransportMenu] = useState9(null);
  const view = useMemo4(() => createRendererSnapshot(client), [client]);
  const snapshot = useSyncExternalStore(view.subscribe, view.getSnapshot, view.getSnapshot);
  const owner = controlOwner(snapshot);
  const controller = useMemo4(() => new StudioController(client), [client, owner]);
  const [windowState, setWindowState] = useState9({ detached: false, fullscreen: false });
  const [maximized, setMaximized] = useState9(false);
  const [maximizedInspector, setMaximizedInspector] = useState9(false);
  const [pendingCommands, setPendingCommands] = useState9(0);
  const transportPending = useRef8(false);
  const jobsRef = useRef8(null), openPanelRef = useRef8(null);
  const bindOpenPanel = useCallback((action) => {
    openPanelRef.current = action;
  }, []);
  const [jobsRequest, setJobsRequest] = useState9(0);
  useEffect5(() => {
    if (!jobsRequest) return;
    if (openPanelRef.current) openPanelRef.current("jobs");
    else jobsRef.current?.focus();
  }, [jobsRequest]);
  const [fullscreenHint, setFullscreenHint] = useState9(false);
  const busy = pendingCommands > 0;
  const [error, setError] = useState9(null);
  const [clock, setClock] = useState9(() => nowMs ?? Date.now());
  const runtime = snapshot.authoring;
  const sourceProblemCount = sourceDiagnostics?.items.length ?? 0;
  const matchingSourceFaults = snapshot.jobs.filter((job) => sourceDiagnosticFault(job.fault, sourceDiagnostics?.items ?? [])).length;
  const baseStatus = studioStatus(snapshot, sourceProblemCount);
  const status = { ...baseStatus, problems: Math.max(0, baseStatus.problems - matchingSourceFaults) };
  useEffect5(() => {
    setError(null);
  }, [runtime?.instanceId, runtime?.generation]);
  const [graphSelection, setGraphSelection] = useState9(null);
  const selectedNodePath = graphSelection ?? void 0;
  function selectGraphNode(path) {
    setGraphSelection(path ? [...path] : null);
    openPanelRef.current?.("inspector");
  }
  const available = snapshot.connection === "connected" && runtime?.authority === "studio" && controlsAvailable !== false;
  useEffect5(() => {
    if (nowMs !== void 0) return;
    const timer = setInterval(() => setClock(Date.now()), 1e3);
    return () => clearInterval(timer);
  }, [nowMs]);
  useEffect5(() => {
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
  useEffect5(() => {
    const escape = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (windows) void windows.fullscreen(false).catch((reason) => setError(String(reason)));
      if (!windowState.fullscreen) setMaximized(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [windows, windowState.fullscreen]);
  useEffect5(() => {
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
  function windowAction(action) {
    void action().catch((reason) => setError(String(reason)));
  }
  const compact = previewOnly || maximized || windowState.fullscreen;
  const showMaximizedInspector = maximized && maximizedInspector && !windowState.fullscreen;
  const previewOutput = runtime?.output;
  const presetValue = previewOutput && [[1280, 720], [1920, 1080], [2560, 1440]].some(([width, height]) => width === previewOutput.width && height === previewOutput.height) ? `${previewOutput.width}x${previewOutput.height}` : "custom";
  const resizePreview = (height) => {
    if (!previewOutput) return;
    const width = Math.round(height * previewOutput.width / previewOutput.height);
    void command(() => controller.resize(width, height));
  };
  const previewPane = /* @__PURE__ */ jsxs11(Paper3, { component: "main", square: true, className: "preview-panel", children: [
    /* @__PURE__ */ jsxs11("div", { className: "panel-toolbar", hidden: windowState.fullscreen, children: [
      /* @__PURE__ */ jsxs11("div", { className: "preview-actions", children: [
        previewActions,
        !previewOnly && /* @__PURE__ */ jsx10(Button9, { "aria-pressed": maximized, onClick: () => setMaximized((value) => !value), children: maximized ? "Restore workspace" : "Maximize" }),
        maximized && !windowState.fullscreen && /* @__PURE__ */ jsx10(Button9, { "aria-pressed": maximizedInspector, onClick: () => setMaximizedInspector((value) => !value), children: maximizedInspector ? "Hide Inspector" : "Show Inspector" }),
        (previewOnly || windowState.detached || windows?.popout) && /* @__PURE__ */ jsx10(Button9, { disabled: !windows, onClick: () => windows && windowAction(() => previewOnly || windowState.detached ? windows.dock() : windows.popout()), children: previewOnly || windowState.detached ? "Dock preview" : "Pop out" }),
        /* @__PURE__ */ jsx10(Button9, { disabled: !windows, onClick: () => windows && windowAction(() => windows.fullscreen(!windowState.fullscreen)), children: windowState.fullscreen ? "Exit fullscreen" : "Fullscreen" })
      ] }),
      /* @__PURE__ */ jsxs11("div", { className: "preview-resolution-controls", children: [
        /* @__PURE__ */ jsxs11("label", { className: "preview-resolution", children: [
          "Resolution",
          /* @__PURE__ */ jsxs11("select", { "aria-label": "Preview resolution preset", disabled: !available || busy, value: presetValue, onChange: (event) => {
            const parts = event.target.value.split("x");
            const width = Number(parts[0]), height = Number(parts[1]);
            if (Number.isInteger(width) && Number.isInteger(height)) void command(() => controller.resize(width, height));
          }, children: [
            /* @__PURE__ */ jsx10("option", { value: "custom", children: "Custom" }),
            /* @__PURE__ */ jsx10("option", { value: "1280x720", children: "1280 \xD7 720" }),
            /* @__PURE__ */ jsx10("option", { value: "1920x1080", children: "1920 \xD7 1080" }),
            /* @__PURE__ */ jsx10("option", { value: "2560x1440", children: "2560 \xD7 1440" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs11("label", { className: "preview-resolution-scale", children: [
          "Scale ",
          /* @__PURE__ */ jsx10("input", { "aria-label": "Preview resolution scale", type: "range", min: "360", max: "2160", step: "90", disabled: !available || busy || !previewOutput, value: previewOutput ? Math.min(2160, Math.max(360, previewOutput.height)) : 1080, onChange: (event) => resizePreview(Number(event.target.value)) })
        ] }),
        previewOutput && /* @__PURE__ */ jsxs11("span", { className: "preview-resolution-value", "aria-live": "polite", children: [
          previewOutput.width,
          " \xD7 ",
          previewOutput.height
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx10(Preview, { runtime, port: presentation, moved: !previewOnly && windowState.detached, onError: setError, onDock: () => windows && windowAction(() => windows.dock()) }),
    runtime?.fault && /* @__PURE__ */ jsxs11(Alert2, { severity: "error", children: [
      /* @__PURE__ */ jsx10("strong", { children: runtime.fault.code }),
      " \xB7 ",
      runtime.fault.message
    ] }),
    error && /* @__PURE__ */ jsx10(Alert2, { severity: "error", role: "alert", children: error }),
    /* @__PURE__ */ jsx10("div", { className: "transport", hidden: windowState.fullscreen, "aria-busy": busy, children: /* @__PURE__ */ jsxs11("div", { className: "transport-actions", children: [
      /* @__PURE__ */ jsx10(Tooltip3, { title: runtime?.playback === "playing" ? "Pause" : "Play", children: /* @__PURE__ */ jsx10("span", { children: /* @__PURE__ */ jsx10(
        IconButton2,
        {
          className: "playback-toggle",
          "aria-label": runtime?.playback === "playing" ? "Pause" : "Play",
          disabled: !available,
          onClick: () => void command(() => controller.playback(runtime?.playback === "playing" ? "pause" : "play")),
          children: /* @__PURE__ */ jsx10("svg", { viewBox: "0 0 24 24", width: "18", height: "18", "aria-hidden": "true", children: /* @__PURE__ */ jsx10("path", { fill: "currentColor", d: runtime?.playback === "playing" ? "M6 4h4v16H6zm8 0h4v16h-4z" : "M6 3l15 9-15 9z" }) })
        }
      ) }) }),
      /* @__PURE__ */ jsx10(Tooltip3, { title: "Reset", children: /* @__PURE__ */ jsx10("span", { children: /* @__PURE__ */ jsx10(IconButton2, { "aria-label": "Reset", disabled: !available, onClick: () => void command(() => controller.playback("reset")), children: /* @__PURE__ */ jsx10("svg", { viewBox: "0 0 24 24", width: "18", height: "18", "aria-hidden": "true", children: /* @__PURE__ */ jsx10("path", { fill: "none", stroke: "currentColor", strokeWidth: "2", d: "M4 10a8 8 0 1 1 0 5M4 4v6h6" }) }) }) }) }),
      /* @__PURE__ */ jsx10(Tooltip3, { title: "More playback actions", children: /* @__PURE__ */ jsx10(IconButton2, { "aria-label": "More playback actions", "aria-haspopup": "menu", "aria-expanded": !!transportMenu, onClick: (event) => setTransportMenu(event.currentTarget), children: "..." }) }),
      /* @__PURE__ */ jsx10(Menu4, { anchorEl: transportMenu, open: !!transportMenu, onClose: () => setTransportMenu(null), onKeyDown: (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setTransportMenu(null);
        }
      }, children: /* @__PURE__ */ jsx10(MenuItem5, { disabled: !available, onClick: () => {
        setTransportMenu(null);
        void command(() => controller.restart());
      }, children: "Restart runtime" }) })
    ] }) })
  ] });
  const inspectorPane = /* @__PURE__ */ jsx10(Paper3, { component: "aside", square: true, className: "inspector", "aria-label": "Scene controls", children: /* @__PURE__ */ jsx10("section", { children: /* @__PURE__ */ jsxs11(Disclosure, { title: "Controls", defaultOpen: true, className: "controls-section", badge: /* @__PURE__ */ jsx10(Chip, { label: "LIVE" }), children: [
    /* @__PURE__ */ jsx10(InspectorBreadcrumb, { runtime, path: selectedNodePath, onSelect: setGraphSelection }),
    /* @__PURE__ */ jsx10(ParameterInspector, { nodePath: selectedNodePath, runtime, available: !!available, client, controller, onError: setError, edits: controlEdits })
  ] }) }) });
  const diagnosticsPane = /* @__PURE__ */ jsxs11(Paper3, { component: "aside", square: true, className: "diagnostics-pane", "aria-label": "Diagnostics", children: [
    /* @__PURE__ */ jsx10("section", { children: /* @__PURE__ */ jsxs11(Disclosure, { title: "Performance", children: [
      /* @__PURE__ */ jsx10(PerformanceStatus, { performance: snapshot.performance }),
      /* @__PURE__ */ jsx10(MetricView, { label: "Visual delivery", metric: snapshot.visualFps, nowMs: nowMs ?? clock }),
      /* @__PURE__ */ jsx10(MetricView, { label: "UI cadence", metric: snapshot.uiFps, nowMs: nowMs ?? clock }),
      /* @__PURE__ */ jsx10("p", { className: "hint", children: "Delivery and interface cadence are measured separately." })
    ] }) }),
    /* @__PURE__ */ jsx10("section", { children: /* @__PURE__ */ jsx10(Disclosure, { title: "Runtime", children: /* @__PURE__ */ jsxs11("dl", { className: "identity", children: [
      /* @__PURE__ */ jsx10("dt", { children: "Authoring revision" }),
      /* @__PURE__ */ jsx10("dd", { children: runtime?.revisionId ?? "Unavailable" }),
      /* @__PURE__ */ jsx10("dt", { children: "Instance" }),
      /* @__PURE__ */ jsx10("dd", { children: runtime?.instanceId ?? "Unavailable" }),
      /* @__PURE__ */ jsx10("dt", { children: "Generation / clock epoch" }),
      /* @__PURE__ */ jsx10("dd", { children: runtime ? `${runtime.generation} / ${runtime.clockEpoch}` : "Unavailable" }),
      /* @__PURE__ */ jsx10("dt", { children: "Completed frame" }),
      /* @__PURE__ */ jsx10("dd", { children: runtime?.frameId ?? "Unavailable" })
    ] }) }) }),
    /* @__PURE__ */ jsx10("section", { children: /* @__PURE__ */ jsxs11(Disclosure, { title: "Host output", children: [
      /* @__PURE__ */ jsx10("p", { className: "host-revision", children: snapshot.host?.revisionId ?? "No host status available" }),
      /* @__PURE__ */ jsx10("p", { className: "hint", children: "Authoring changes do not update a pinned host revision." })
    ] }) })
  ] });
  const openJobs = () => {
    setMaximized(false);
    setJobsRequest((value) => value + 1);
  };
  const jobsPane = /* @__PURE__ */ jsxs11("section", { ref: jobsRef, tabIndex: -1, className: "diagnostics", "aria-label": "Jobs and diagnostics", children: [
    /* @__PURE__ */ jsxs11("div", { className: "section-heading", children: [
      /* @__PURE__ */ jsx10("h2", { children: "Jobs & diagnostics" }),
      /* @__PURE__ */ jsxs11("span", { className: "subtle", children: [
        snapshot.jobs.length,
        " jobs \xB7 ",
        sourceProblemCount,
        " diagnostics"
      ] })
    ] }),
    runtime?.fault && /* @__PURE__ */ jsxs11("p", { className: "error", role: "alert", children: [
      /* @__PURE__ */ jsx10("strong", { children: runtime.fault.code }),
      " \xB7 ",
      runtime.fault.message
    ] }),
    snapshot.jobs.map((job) => /* @__PURE__ */ jsxs11("p", { className: job.fault ? "error" : "", children: [
      /* @__PURE__ */ jsx10("span", { className: "tag", children: job.state }),
      " ",
      job.summary,
      job.fault && !sourceDiagnosticFault(job.fault, sourceDiagnostics?.items ?? []) && ` \xB7 ${job.fault}`
    ] }, job.jobId)),
    sourceDiagnostics && /* @__PURE__ */ jsx10(ProblemsPanel, { diagnostics: sourceDiagnostics.items, snapshot: sourceDiagnostics.snapshot, onNavigate: (target) => {
      sourceDiagnostics.onNavigate(target);
      openPanelRef.current?.("source");
    } }),
    !runtime?.fault && snapshot.jobs.length === 0 && !sourceProblemCount && /* @__PURE__ */ jsx10("p", { children: snapshot.message ?? "No jobs reported." })
  ] });
  return /* @__PURE__ */ jsxs11("div", { className: `studio ${compact ? "studio-expanded" : ""} ${windowState.fullscreen ? "studio-preview-fullscreen" : ""}`, children: [
    windowState.fullscreen && fullscreenHint && /* @__PURE__ */ jsx10("div", { className: "fullscreen-hint", role: "status", children: "Press Escape to exit fullscreen" }),
    /* @__PURE__ */ jsxs11("header", { className: "app-bar", hidden: windowState.fullscreen, children: [
      /* @__PURE__ */ jsx10("div", { className: "brand", children: /* @__PURE__ */ jsx10("strong", { children: "LUX" }) }),
      fileMenu,
      /* @__PURE__ */ jsx10("span", { className: "view-tools-host", ref: setToolsHost }),
      appCommands ?? /* @__PURE__ */ jsxs11("div", { className: "scene-heading", children: [
        /* @__PURE__ */ jsx10("span", { className: "eyebrow", children: "AUTHORING" }),
        /* @__PURE__ */ jsx10("span", { children: runtime?.sceneName ?? "No scene connected" })
      ] })
    ] }),
    appError && /* @__PURE__ */ jsx10(Alert2, { severity: "error", children: appError }),
    /* @__PURE__ */ jsx10("div", { className: "workspace", children: sourcePanel ? /* @__PURE__ */ jsx10(StudioDockShell, { onOpenPanelReady: bindOpenPanel, toolsHost, compact, showInspector: showMaximizedInspector, preview: previewPane, source: sourcePanel, library: libraryPanel ?? /* @__PURE__ */ jsx10("section", { "aria-label": "Shared component library", children: "Library unavailable." }), inspector: inspectorPane, diagnostics: diagnosticsPane, jobs: jobsPane, graph: /* @__PURE__ */ jsx10(GraphPanel, { runtime, selected: selectedNodePath ? nodeKey(selectedNodePath) : null, onSelect: selectGraphNode }) }) : /* @__PURE__ */ jsxs11(Fragment3, { children: [
      previewPane,
      (!compact || showMaximizedInspector) && inspectorPane,
      (!compact || showMaximizedInspector) && diagnosticsPane
    ] }) }),
    !sourcePanel && !compact && jobsPane,
    /* @__PURE__ */ jsxs11("footer", { className: "status-bar", hidden: windowState.fullscreen || previewOnly, "aria-label": "Studio status", children: [
      /* @__PURE__ */ jsxs11("button", { type: "button", className: `status-item status-build ${status.build === "Build failed" ? "status-error" : ""}`, "aria-busy": status.building, "aria-label": `Build status: ${status.build}. Open Jobs and diagnostics`, onClick: openJobs, children: [
        /* @__PURE__ */ jsx10("span", { "aria-hidden": "true", className: status.building ? "status-spinner" : "status-build-icon", children: status.building ? "" : "\u21BB" }),
        /* @__PURE__ */ jsx10("span", { "aria-live": "polite", children: status.build })
      ] }),
      /* @__PURE__ */ jsxs11("button", { type: "button", className: `status-item ${status.problems ? "status-error" : ""}`, "aria-label": `Problems: ${status.problems}. Open Jobs and diagnostics`, onClick: openJobs, children: [
        /* @__PURE__ */ jsx10("span", { "aria-hidden": "true", children: "!" }),
        /* @__PURE__ */ jsxs11("span", { children: [
          status.problems,
          " ",
          status.problems === 1 ? "problem" : "problems"
        ] })
      ] }),
      sourceChanged && /* @__PURE__ */ jsx10("span", { className: "status-item", title: "Build to apply the source edits to Preview", children: "Source changed \xB7 Build to update" }),
      ["Connecting", "Disconnected", "Failed"].includes(status.runtime) && /* @__PURE__ */ jsx10("button", { type: "button", className: "status-item status-runtime status-error", "aria-label": `Runtime status: ${status.runtime}. Open Jobs and diagnostics`, onClick: openJobs, children: status.runtime })
    ] })
  ] });
}
var activeJobStates;
var init_renderer = __esm({
  "apps/studio/src/renderer.tsx"() {
    "use strict";
    init_InspectorBreadcrumb();
    init_GraphPanel();
    init_theme();
    init_ParameterInspector();
    init_PerformanceStatus();
    init_preview();
    init_service_client();
    init_StudioDockShell();
    init_renderer_snapshot();
    init_Disclosure();
    init_ProblemsPanel();
    activeJobStates = /* @__PURE__ */ new Set(["queued", "pending", "running", "compiling", "initializing"]);
  }
});

// apps/studio/src/Confirmation.tsx
var Confirmation_exports = {};
__export(Confirmation_exports, {
  useDiscardConfirmation: () => useDiscardConfirmation
});
import { useCallback as useCallback2, useEffect as useEffect6, useRef as useRef9, useState as useState10 } from "react";
import { Button as Button10, Dialog as Dialog2, DialogActions as DialogActions2, DialogContent as DialogContent2, DialogContentText, DialogTitle as DialogTitle2 } from "@mui/material";
import { jsx as jsx11, jsxs as jsxs12 } from "react/jsx-runtime";
function useDiscardConfirmation() {
  const [action, setAction] = useState10(null);
  const pending = useRef9(null);
  const answer = useRef9(false);
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
  useEffect6(() => () => {
    pending.current?.(false);
    pending.current = null;
  }, []);
  const dialog = /* @__PURE__ */ jsxs12(Dialog2, { open: action !== null, onClose: () => settle(false), slotProps: { transition: { onExited: finish } }, "aria-labelledby": "discard-title", onKeyDown: (event) => {
    if (event.key === "Escape") event.stopPropagation();
  }, children: [
    /* @__PURE__ */ jsx11(DialogTitle2, { id: "discard-title", children: "Discard unsaved changes?" }),
    /* @__PURE__ */ jsx11(DialogContent2, { children: /* @__PURE__ */ jsx11(DialogContentText, { children: action === "close" ? "Your unsaved changes will be lost when Lux closes." : action === "load-look" ? "Load this look and discard your unsaved scene changes?" : "Your unsaved changes will be lost if you open another scene." }) }),
    /* @__PURE__ */ jsxs12(DialogActions2, { children: [
      /* @__PURE__ */ jsx11(Button10, { autoFocus: true, onClick: () => settle(false), children: "Keep editing" }),
      /* @__PURE__ */ jsx11(Button10, { color: "error", onClick: () => settle(true), children: action === "close" ? "Discard and close" : action === "load-look" ? "Discard and load look" : "Discard and open" })
    ] })
  ] });
  return { confirm, dialog, isPending: () => pending.current !== null };
}
var init_Confirmation = __esm({
  "apps/studio/src/Confirmation.tsx"() {
    "use strict";
  }
});

// tests/studio/interactions.test.tsx
import test, { afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { Fragment as Fragment4, jsx as jsx12, jsxs as jsxs13 } from "react/jsx-runtime";
var dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { url: "http://studio.test/" });
for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "ShadowRoot", "DocumentFragment", "Event", "KeyboardEvent", "MouseEvent", "getComputedStyle"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true });
var { render: renderUI, screen, cleanup, waitFor, fireEvent, act, within } = await import("@testing-library/react");
var { CacheProvider } = await import("@emotion/react");
var { default: createCache } = await import("@emotion/cache");
var styleCache = createCache({ key: "studio-test" });
var render = (ui) => renderUI(/* @__PURE__ */ jsx12(CacheProvider, { value: styleCache, children: ui }));
var { userEvent } = await import("@testing-library/user-event");
var { StudioApp: StudioApp2 } = await Promise.resolve().then(() => (init_renderer(), renderer_exports));
var { createDisconnectedClient: createDisconnectedClient2 } = await Promise.resolve().then(() => (init_service_client(), service_client_exports));
var { useDiscardConfirmation: useDiscardConfirmation2 } = await Promise.resolve().then(() => (init_Confirmation(), Confirmation_exports));
afterEach(() => {
  cleanup();
  styleCache.sheet.flush();
  styleCache = createCache({ key: "studio-test" });
});
after(() => dom.window.close());
test("RTL: frame bursts leave Performance responsive and applied controls publish immediately", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const fixture = service();
    render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
    return /* @__PURE__ */ jsxs13(Fragment4, { children: [
      confirmation.dialog,
      /* @__PURE__ */ jsx12("button", { onClick: () => void confirmation.confirm("open").then((answer) => answers.push(answer)), children: "Choose another scene" })
    ] });
  }
  const user = userEvent.setup({ document });
  render(/* @__PURE__ */ jsx12(Fixture, {}));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
test("RTL: direct component selection edits flat controls and keeps empty-path animation identity", async () => {
  const { useState: useState11 } = await import("react");
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
      const [path, setPath] = useState11(null);
      return /* @__PURE__ */ jsxs13(Fragment4, { children: [
        /* @__PURE__ */ jsx12(GraphPanel2, { runtime, selected: path ? nodeKey2(path) : null, onSelect: setPath }),
        /* @__PURE__ */ jsx12(InspectorBreadcrumb2, { runtime, path: path ?? void 0, onSelect: setPath }),
        /* @__PURE__ */ jsx12(ParameterInspector2, { runtime, available: true, client: fixture.client, controller, onError: () => {
        }, nodePath: path ?? void 0 })
      ] });
    };
    var Fixture = Fixture2;
    render(/* @__PURE__ */ jsx12(Fixture2, {}));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const described = screen.getByText("Source sampling radius");
  fireEvent.mouseOver(described);
  const tooltip = await screen.findByRole("tooltip", { name: /Expands the area sampled/ });
  assert.ok(tooltip.querySelector(".MuiTooltip-tooltipPlacementLeft"), "help must open toward Preview");
  assert.equal(getComputedStyle(tooltip.querySelector(".MuiTooltip-tooltip")).fontSize, "12px");
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
test("RTL: an empty authored schema has no invented control", () => {
  const fixture = service();
  fixture.publish({ sdkVersion: "0.2.0", intensity: void 0, controlSchema: [], controlSchemaHash: "b".repeat(64), controls: {}, controlSequence: 0 });
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3, controlEdits: { changed: () => {
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  const input = screen.getByRole("spinbutton", { name: "Intensity value" });
  fireEvent.focus(input);
  await act(async () => fixture.publish({ intensity: 0.2 }));
  assert.equal(input.value, "0.2");
  fireEvent.blur(input);
  assert.equal(fixture.calls.length, 0);
});
function service() {
  let snapshot = {
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
    getSnapshot: () => snapshot,
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
    snapshot = { ...snapshot, authoring: { ...snapshot.authoring, ...values2 } };
    for (const listener of listeners) listener();
  }, update: () => {
    snapshot = { ...snapshot, authoring: { ...snapshot.authoring, generation: 3, playback: "playing" } };
    for (const listener of listeners) listener();
  } };
}
test("RTL: disconnected controls refuse input while workspace remains operable", async () => {
  const user = userEvent.setup({ document });
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: createDisconnectedClient2(), nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
  fireEvent.change(screen.getByRole("slider", { name: "Intensity" }), { target: { value: "0.8" } });
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  for (const name of ["Play", "Reset", "More playback actions"]) assert.equal(screen.getByRole("button", { name }).disabled, false);
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: fixture.client, nowMs: 1e3 }));
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: createDisconnectedClient2(), windows, nowMs: 1e3 }));
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
  const { container } = render(/* @__PURE__ */ jsx12(StudioApp2, { client: service().client, windows, nowMs: 1e3 }));
  const surface = container.querySelector(".preview-surface");
  fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
  assert.ok(container.querySelector(".studio-preview-fullscreen"));
  assert.equal(screen.queryByRole("button", { name: "Play" }), null);
  assert.equal(screen.queryByRole("slider"), null);
  assert.ok(screen.getByText("Press Escape to exit fullscreen"));
  await act(async () => initial({ detached: false, fullscreen: false }));
  assert.ok(container.querySelector(".studio-preview-fullscreen"));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
  assert.equal(screen.queryByText("Press Escape to exit fullscreen"), null);
  fireEvent.keyDown(window, { key: "Escape" });
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
  render(/* @__PURE__ */ jsx12(StudioApp2, { client: service().client, windows, nowMs: 1e3 }));
  assert.equal(screen.queryByRole("button", { name: "Pop out" }), null);
  assert.equal(screen.getByRole("button", { name: "Fullscreen" }).disabled, false);
});
