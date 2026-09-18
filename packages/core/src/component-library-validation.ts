import { parse } from '@babel/parser';
import { posix } from 'node:path';
import type { SourceBundle } from '../../runtime-contracts/src/index.ts';
import { normalizeComponentDeclaration } from '../../runtime-contracts/src/components.mjs';
import type { ComponentMetadata, PortDeclaration } from '../../runtime-contracts/src/components.mjs';

type CompileOutcome = Readonly<{
  ok?: boolean;
  linked?: unknown;
  diagnostics?: readonly Readonly<{ message?: string }>[];
}>;

export type LibraryCandidateCompiler = (source: SourceBundle) => Promise<unknown>;

const sourceNodeId = 'validation.source';
const candidateNodeId = 'validation.candidate';
const sinkNodeId = 'validation.sink';

function unwrap(node: any): any {
  while (node && ['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion', 'ParenthesizedExpression'].includes(node.type)) node = node.expression;
  return node;
}

function parsedEntry(source: SourceBundle): any | undefined {
  const text = source.files[source.entry];
  if (typeof text !== 'string') return undefined;
  try {
    return parse(text, { sourceType: 'module', plugins: ['typescript'] }).program;
  } catch {
    return undefined;
  }
}

function sdkCall(program: any, name: 'defineComponent' | 'defineComposition'): any | undefined {
  const aliases = program.body.flatMap((statement: any) => statement.type === 'ImportDeclaration'
    && statement.importKind !== 'type' && statement.source.value === '@lux/visual-sdk'
    ? statement.specifiers.filter((specifier: any) => specifier.type === 'ImportSpecifier'
      && specifier.importKind !== 'type' && (specifier.imported.name ?? specifier.imported.value) === name)
      .map((specifier: any) => specifier.local.name)
    : []);
  const exported = program.body.find((statement: any) => statement.type === 'ExportDefaultDeclaration') as any;
  const call = unwrap(exported?.declaration);
  return call?.type === 'CallExpression' && call.callee.type === 'Identifier'
    && aliases.includes(call.callee.name) && call.arguments.length === 1 ? call : undefined;
}

function objectRows(node: any, message: string): Map<string, any> {
  const value = unwrap(node);
  if (value?.type !== 'ObjectExpression') throw Error(message);
  const result = new Map<string, any>();
  for (const property of value.properties) {
    if (!['ObjectProperty', 'ObjectMethod'].includes(property.type) || property.computed || property.shorthand
      || !['Identifier', 'StringLiteral'].includes(property.key?.type)) throw Error(message);
    const key = property.key.name ?? property.key.value;
    if (result.has(key)) throw Error(`Library component metadata has duplicate property ${key}`);
    result.set(key, property);
  }
  return result;
}

function literal(node: any): unknown {
  const value = unwrap(node);
  if (['StringLiteral', 'NumericLiteral'].includes(value?.type)) return value.value;
  if (value?.type === 'NullLiteral') return null;
  if (value?.type === 'UnaryExpression' && value.operator === '-' && value.argument.type === 'NumericLiteral') return -value.argument.value;
  if (value?.type === 'ArrayExpression') return value.elements.map(literal);
  if (value?.type === 'ObjectExpression') {
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, property] of objectRows(value, 'Library component metadata requires literal keys without spreads or computed properties')) {
      if (property.type !== 'ObjectProperty') throw Error('Library component metadata cannot contain methods or accessors');
      result[key] = literal(property.value);
    }
    return result;
  }
  throw Error('Library component metadata requires literals without references, calls, or expressions');
}

function componentDeclaration(source: SourceBundle): ComponentMetadata | undefined {
  const program = parsedEntry(source);
  const call = program && sdkCall(program, 'defineComponent');
  if (!call) return undefined;
  const outer = objectRows(call.arguments[0], 'Library component requires inline defineComponent({...}) data');
  if (outer.size !== 2 || !outer.has('metadata') || !outer.has('create') || outer.get('metadata').type !== 'ObjectProperty') {
    throw Error('Library component requires only literal metadata and create fields');
  }
  return normalizeComponentDeclaration(literal(outer.get('metadata').value));
}

function compositionEntry(source: SourceBundle): boolean {
  const program = parsedEntry(source);
  if (!program) return false;
  if (sdkCall(program, 'defineComposition')) return true;
  const component = sdkCall(program, 'defineComponent');
  if (!component) return false;
  try {
    const fields = objectRows(component.arguments[0], 'Library component requires an inline definition');
    return fields.has('definitions') && fields.has('nodes') && fields.has('edges') && fields.has('output') && fields.has('expose');
  } catch { return false; }
}

type PortSurface = Readonly<{ inputs: Readonly<Record<string, PortDeclaration>>; outputs: Readonly<Record<string, PortDeclaration>> }>;

function resolveModule(from: string, specifier: string): string {
  if ((!specifier.startsWith('./') && !specifier.startsWith('../')) || !specifier.endsWith('.ts')) {
    throw Error('Library composition imports must name relative submitted .ts modules');
  }
  const path = posix.normalize(posix.join(posix.dirname(from), specifier));
  if (path.startsWith('../')) throw Error('Library composition imports must remain inside the source bundle');
  return path;
}

function modulePorts(source: SourceBundle, path: string, active = new Set<string>()): PortSurface {
  if (active.has(path)) throw Error('Library composition imports cannot be recursive');
  const text = source.files[path];
  if (typeof text !== 'string') throw Error(`Library composition is missing imported module ${path}`);
  let program: any;
  try { program = parse(text, { sourceType: 'module', plugins: ['typescript'] }).program; }
  catch { throw Error(`Library composition cannot parse imported module ${path}`); }
  const component = sdkCall(program, 'defineComponent');
  const composition = sdkCall(program, 'defineComposition');
  if (component) {
    const fields = objectRows(component.arguments[0], 'Library component requires an inline definition');
    if (fields.has('metadata') && fields.has('create')) {
      if (fields.size !== 2 || fields.get('metadata').type !== 'ObjectProperty') throw Error('Library component requires only literal metadata and create fields');
      const metadata = normalizeComponentDeclaration(literal(fields.get('metadata').value));
      return { inputs: metadata.inputs, outputs: metadata.outputs };
    }
  }
  const graph = composition ?? component;
  if (!graph) throw Error(`Library composition dependency ${path} must export a component or composition`);
  active.add(path);
  try {
    const fields = objectRows(graph.arguments[0], 'Library composition requires an inline definition');
    const definitionsNode = unwrap(fields.get('definitions')?.value);
    if (definitionsNode?.type !== 'ObjectExpression') throw Error('Library composition definitions must be an inline object');
    const imports = new Map<string, string>();
    for (const statement of program.body) if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) if (specifier.type === 'ImportDefaultSpecifier') imports.set(specifier.local.name, resolveModule(path, statement.source.value));
    }
    const definitions = new Map<string, string>();
    for (const property of definitionsNode.properties) {
      if (property.type !== 'ObjectProperty' || property.computed || !['Identifier', 'StringLiteral'].includes(property.key?.type)) throw Error('Library composition definitions require literal keys');
      const key = property.key.name ?? property.key.value, value = unwrap(property.value);
      if (value?.type !== 'Identifier' || !imports.has(value.name)) throw Error('Library composition definitions must reference default imports');
      definitions.set(key, imports.get(value.name)!);
    }
    const nodes = literal(fields.get('nodes')?.value) as readonly Readonly<{ id: string; definition: string }>[];
    const nodeDefinitions = new Map(nodes.map(node => [node.id, node.definition]));
    const targetPort = (target: any, direction: 'inputs' | 'outputs'): PortDeclaration => {
      const definition = nodeDefinitions.get(target?.nodeId), childPath = definition && definitions.get(definition);
      if (!childPath) throw Error('Library composition boundary must target an immediate node');
      const port = modulePorts(source, childPath, active)[direction][target.portId];
      if (!port) throw Error(`Library composition boundary targets a missing ${direction} port`);
      return port;
    };
    const inputs: Record<string, PortDeclaration> = {};
    if (fields.has('input')) inputs.image = targetPort(literal(fields.get('input').value), 'inputs');
    if (fields.has('inputs')) for (const [id, target] of Object.entries(literal(fields.get('inputs').value) as Record<string, unknown>)) inputs[id] = targetPort(target, 'inputs');
    const output = targetPort(literal(fields.get('output')?.value), 'outputs');
    return { inputs, outputs: { image: output } };
  } finally { active.delete(path); }
}

function harnessPaths(source: SourceBundle, helpers: readonly string[], subject: string): Readonly<{ harness: string; helpers: readonly string[] }> {
  const required = helpers.length + 1;
  if (Object.keys(source.files).length + required > 32) {
    throw Error(`Library ${subject} needs ${required === 1 ? 'one' : required === 2 ? 'two' : required} free source file${required === 1 ? '' : 's'} for validation`);
  }
  for (let index = 1; index <= 32; index++) {
    const harness = `library-validation-harness-${index}.ts`;
    const helperPaths = helpers.map(helper => `library-validation-${helper}-${index}.ts`);
    if (![harness, ...helperPaths].some(path => Object.hasOwn(source.files, path))) {
      return { harness, helpers: helperPaths };
    }
  }
  throw Error(`Library ${subject} needs ${required === 1 ? 'one' : required === 2 ? 'two' : required} free source file${required === 1 ? '' : 's'} for validation`);
}

function portSource(port: PortDeclaration): string {
  return JSON.stringify(port);
}

function typedProvider(outputs: Readonly<Record<string, PortDeclaration>>): string {
  const declared = Object.entries(outputs).map(([id, port]) => `${JSON.stringify(id)}:${portSource(port)}`).join(',');
  const evaluated = Object.entries(outputs).map(([id, port]) => `${JSON.stringify(id)}:${port.type.kind === 'image'
    ? `await context.render({}, {}, ${JSON.stringify(id)})`
    : port.type.kind === 'shader-field'
      ? `context.shaderField(${JSON.stringify(id)},{version:1,abi:${JSON.stringify(port.type.abi)},fragments:{},values:{}})`
      : `context.paths(${JSON.stringify(id)},{version:1,paths:[]})`}`).join(',');
  return `import {defineComponent} from '@lux/visual-sdk';export default defineComponent({metadata:{declarationVersion:1,key:'lux/library-validation-provider',label:'Validation provider',description:'Provides closed compile-only typed inputs.',tags:['internal'],inputs:{},outputs:{${declared}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {${evaluated}}},reset(){},dispose(){}}}});`;
}

function typedSink(inputId: string, input: PortDeclaration): string {
  return `import {defineComponent} from '@lux/visual-sdk';export default defineComponent({metadata:{declarationVersion:1,key:'lux/library-validation-sink',label:'Validation sink',description:'Closes a typed component output as an image.',tags:['internal'],inputs:{${JSON.stringify(inputId)}:${portSource(input)}},outputs:{image:${imagePortSource()}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(inputs,context){void inputs[${JSON.stringify(inputId)}].data;return {image:await context.render({}, {}, 'image')}},reset(){},dispose(){}}}});`;
}

function imagePortSource(): string {
  return `{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Validation image'}`;
}

function edgeId(index: number): string {
  return `validation.edge-${index + 1}`;
}

function typedLeafHarness(entry: string, metadata: Pick<ComponentMetadata, 'inputs' | 'outputs'>, providerPath?: string, sinkPath?: string): string {
  const inputPorts = Object.entries(metadata.inputs);
  const imageOutput = Object.entries(metadata.outputs).find(([, port]) => port.type.kind === 'image');
  const finalOutput = imageOutput ?? Object.entries(metadata.outputs)[0];
  if (!finalOutput) throw Error('Library typed component requires at least one image, paths2d or shader-field output');
  const imports = [`import candidate from ${JSON.stringify(`./${entry}`)};`];
  if (providerPath) imports.push(`import provider from ${JSON.stringify(`./${providerPath}`)};`);
  if (sinkPath) imports.push(`import sink from ${JSON.stringify(`./${sinkPath}`)};`);
  const definitions = ['candidate', ...(providerPath ? ['provider'] : []), ...(sinkPath ? ['sink'] : [])];
  const nodes = [
    ...(providerPath ? [`{id:'${sourceNodeId}',definition:'provider'}`] : []),
    `{id:'${candidateNodeId}',definition:'candidate'}`,
    ...(sinkPath ? [`{id:'${sinkNodeId}',definition:'sink'}`] : []),
  ];
  const edges = inputPorts.map(([id], index) => `{id:'${edgeId(index)}',from:{nodeId:'${sourceNodeId}',portId:${JSON.stringify(id)}},to:{nodeId:'${candidateNodeId}',portId:${JSON.stringify(id)}},delay:'none'}`);
  if (sinkPath) edges.push(`{id:'${edgeId(inputPorts.length)}',from:{nodeId:'${candidateNodeId}',portId:${JSON.stringify(finalOutput[0])}},to:{nodeId:'${sinkNodeId}',portId:${JSON.stringify(finalOutput[0])}},delay:'none'}`);
  const output = sinkPath
    ? `{nodeId:'${sinkNodeId}',portId:'image'}`
    : `{nodeId:'${candidateNodeId}',portId:${JSON.stringify(finalOutput[0])}}`;
  return `import {defineComposition} from '@lux/visual-sdk';${imports.join('')}export default defineComposition({label:'Library typed leaf validation harness',definitions:{${definitions.join(',')}},nodes:[${nodes.join(',')}],edges:[${edges.join(',')}],output:${output},expose:[]});`;
}

function validateTypedPorts(metadata: Pick<ComponentMetadata, 'inputs' | 'outputs'>): void {
  for (const [direction, ports] of [['input', metadata.inputs], ['output', metadata.outputs]] as const) {
    for (const [id, port] of Object.entries(ports)) {
      if (port.type.kind !== 'image' && port.type.kind !== 'paths2d' && port.type.kind !== 'shader-field') {
        throw Error(`Library component ${direction} ${id} uses ${port.type.kind}; only image, paths2d and shader-field ports are supported`);
      }
    }
  }
}

function isLegacyImageLeaf(metadata: ComponentMetadata): boolean {
  const inputs = Object.keys(metadata.inputs), outputs = Object.entries(metadata.outputs);
  return inputs.length === 0 && outputs.length === 1 && outputs[0]![0] === 'image' && outputs[0]![1].type.kind === 'image';
}

function typedLeafValidationSource(source: SourceBundle, metadata: ComponentMetadata): SourceBundle {
  validateTypedPorts(metadata);
  const output = Object.entries(metadata.outputs).find(([, port]) => port.type.kind === 'image') ?? Object.entries(metadata.outputs)[0];
  if (!output) throw Error('Library typed component requires at least one image, paths2d or shader-field output');
  const needsProvider = Object.keys(metadata.inputs).length > 0;
  const needsSink = output[1].type.kind !== 'image';
  const helperKinds = [...(needsProvider ? ['provider'] : []), ...(needsSink ? ['sink'] : [])];
  const paths = harnessPaths(source, helperKinds, 'typed component');
  let helperIndex = 0;
  const providerPath = needsProvider ? paths.helpers[helperIndex++] : undefined;
  const sinkPath = needsSink ? paths.helpers[helperIndex++] : undefined;
  return {
    ...source,
    sdkVersion: '0.4.0',
    entry: paths.harness,
    files: {
      ...source.files,
      [paths.harness]: typedLeafHarness(source.entry, metadata, providerPath, sinkPath),
      ...(providerPath ? { [providerPath]: typedProvider(metadata.inputs) } : {}),
      ...(sinkPath ? { [sinkPath]: typedSink(output[0], output[1]) } : {}),
    },
  };
}

export function libraryValidationSource(source: SourceBundle): SourceBundle {
  if (!compositionEntry(source)) {
    const metadata = componentDeclaration(source);
    if (!metadata || isLegacyImageLeaf(metadata)) return { ...source, sdkVersion: '0.3.0' };
    return typedLeafValidationSource(source, metadata);
  }
  const ports = modulePorts(source, source.entry);
  validateTypedPorts(ports);
  const needsProvider = Object.keys(ports.inputs).length > 0;
  const paths = harnessPaths(source, needsProvider ? ['provider'] : [], 'composition');
  const providerPath = paths.helpers[0];
  return {
    ...source,
    sdkVersion: '0.4.0',
    entry: paths.harness,
    files: {
      ...source.files,
      [paths.harness]: typedLeafHarness(source.entry, ports, providerPath),
      ...(providerPath ? { [providerPath]: typedProvider(ports.inputs) } : {}),
    },
  };
}

function diagnosticMessage(result: CompileOutcome): string {
  return result.diagnostics?.map(item => item.message).filter((message): message is string => !!message).join('; ')
    || 'Library component candidate did not compile';
}

function linkedVersion(result: CompileOutcome): number | undefined {
  const linked = result.linked;
  return linked && typeof linked === 'object' && 'linkedVersion' in linked && typeof linked.linkedVersion === 'number'
    ? linked.linkedVersion
    : undefined;
}

export async function validateLibraryCandidate(source: SourceBundle, compile: LibraryCandidateCompiler): Promise<void> {
  const harness = libraryValidationSource(source);
  const result = await compile(harness) as CompileOutcome;
  if (!result.ok) throw Error(diagnosticMessage(result));
  const expectedVersion = harness.sdkVersion === '0.4.0' ? 5 : 4;
  if (linkedVersion(result) !== expectedVersion) {
    throw Error(expectedVersion === 5
      ? 'Library composition candidate did not produce a composition build'
      : 'Library component candidate did not produce a component build');
  }
}
