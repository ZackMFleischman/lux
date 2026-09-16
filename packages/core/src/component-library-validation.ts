import { parse } from '@babel/parser';
import type { SourceBundle } from '../../runtime-contracts/src/index.ts';
import { normalizeComponentDeclaration } from '../../runtime-contracts/src/components.mjs';
import type { ComponentMetadata, PortDeclaration } from '../../runtime-contracts/src/components.mjs';

type CompileOutcome = Readonly<{
  ok?: boolean;
  linked?: unknown;
  diagnostics?: readonly Readonly<{ message?: string }>[];
}>;

export type LibraryCandidateCompiler = (source: SourceBundle) => Promise<unknown>;

const sourceNodeId = '1176b1f7-9850-4f3c-8275-ec502142d49b';
const candidateNodeId = '2bfc5c24-4e4f-40c2-9c49-b783602c9f6d';
const sinkNodeId = '603442bf-69c2-4224-bf59-b53b39a8e00b';

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
  return !!program && !!sdkCall(program, 'defineComposition');
}

function hasExternalImageInput(source: SourceBundle): boolean {
  const text = source.files[source.entry];
  if (typeof text !== 'string') return false;
  try {
    const program = parsedEntry(source);
    const call = program && sdkCall(program, 'defineComposition');
    const argument = unwrap(call?.arguments[0]);
    if (!call || argument?.type !== 'ObjectExpression') return false;
    return argument.properties.some((property: any) => property.type === 'ObjectProperty' && !property.computed
      && (property.key.type === 'Identifier' ? property.key.name : property.key.type === 'StringLiteral' ? property.key.value : undefined) === 'input');
  } catch {
    return false;
  }
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

function closedImageSource(): string {
  const imagePort = `{type:{kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'},label:'Image',description:'Validation image'}`;
  return `import {defineComponent} from '@lux/visual-sdk';export default defineComponent({metadata:{declarationVersion:1,key:'lux/library-validation-source',label:'Validation image source',description:'Provides a closed compile-only image input.',tags:['internal'],inputs:{},outputs:{image:${imagePort}},controls:{},controlDescriptions:{},lifecycle:{state:'stateless',reset:'seed'}},async create(){return {update(){},async evaluate(_inputs,context){return {image:await context.render({}, {}, 'image')}},reset(){},dispose(){}}}});`;
}

function closedHarness(entry: string, feedsImageInput: boolean, sourcePath?: string): string {
  const nodes = feedsImageInput
    ? `[{id:'${sourceNodeId}',definition:'source'},{id:'${candidateNodeId}',definition:'candidate'}]`
    : `[{id:'${candidateNodeId}',definition:'candidate'}]`;
  const edges = feedsImageInput
    ? `[{id:'369d2be9-9b50-46d2-8ee4-6200f51974c1',from:{nodeId:'${sourceNodeId}',portId:'image'},to:{nodeId:'${candidateNodeId}',portId:'image'},delay:'none'}]`
    : '[]';
  const sourceImport = feedsImageInput ? `import source from ${JSON.stringify(`./${sourcePath}`)};` : '';
  const definitions = feedsImageInput ? '{candidate,source}' : '{candidate}';
  return `import {defineComposition} from '@lux/visual-sdk';import candidate from ${JSON.stringify(`./${entry}`)};${sourceImport}
export default defineComposition({label:'Library validation harness',definitions:${definitions},nodes:${nodes},edges:${edges},output:{nodeId:'${candidateNodeId}',portId:'image'},expose:[]});`;
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
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

function typedLeafHarness(entry: string, metadata: ComponentMetadata, providerPath?: string, sinkPath?: string): string {
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

function validateTypedPorts(metadata: ComponentMetadata): void {
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
  const feedsImageInput = hasExternalImageInput(source);
  const paths = harnessPaths(source, feedsImageInput ? ['source'] : [], 'composition');
  const sourcePath = paths.helpers[0];
  return {
    ...source,
    entry: paths.harness,
    files: {
      ...source.files,
      [paths.harness]: closedHarness(source.entry, feedsImageInput, sourcePath),
      ...(sourcePath ? { [sourcePath]: closedImageSource() } : {}),
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
