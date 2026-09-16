import { parse } from '@babel/parser';
import type { SourceBundle } from '../../runtime-contracts/src/index.ts';

type CompileOutcome = Readonly<{
  ok?: boolean;
  linked?: unknown;
  diagnostics?: readonly Readonly<{ message?: string }>[];
}>;

export type LibraryCandidateCompiler = (source: SourceBundle) => Promise<unknown>;

const sourceNodeId = '1176b1f7-9850-4f3c-8275-ec502142d49b';
const candidateNodeId = '2bfc5c24-4e4f-40c2-9c49-b783602c9f6d';

function unwrap(node: any): any {
  while (node && ['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion', 'ParenthesizedExpression'].includes(node.type)) node = node.expression;
  return node;
}

function compositionEntry(source: SourceBundle): boolean {
  const text = source.files[source.entry];
  if (typeof text !== 'string') return false;
  try {
    const program = parse(text, { sourceType: 'module', plugins: ['typescript'] }).program;
    const aliases = program.body.flatMap((statement: any) => statement.type === 'ImportDeclaration'
      && statement.importKind !== 'type' && statement.source.value === '@lux/visual-sdk'
      ? statement.specifiers.filter((specifier: any) => specifier.type === 'ImportSpecifier'
        && specifier.importKind !== 'type' && (specifier.imported.name ?? specifier.imported.value) === 'defineComposition')
        .map((specifier: any) => specifier.local.name)
      : []);
    const exported = program.body.find((statement: any) => statement.type === 'ExportDefaultDeclaration') as any;
    const call = unwrap(exported?.declaration);
    return call?.type === 'CallExpression' && call.callee.type === 'Identifier' && aliases.includes(call.callee.name) && call.arguments.length === 1;
  } catch {
    // Preserve the existing leaf validation path so the compiler reports the
    // original source diagnostic rather than a parser-specific library error.
    return false;
  }
}

function hasExternalImageInput(source: SourceBundle): boolean {
  const text = source.files[source.entry];
  if (typeof text !== 'string') return false;
  try {
    const program = parse(text, { sourceType: 'module', plugins: ['typescript'] }).program;
    const aliases = program.body.flatMap((statement: any) => statement.type === 'ImportDeclaration'
      && statement.importKind !== 'type' && statement.source.value === '@lux/visual-sdk'
      ? statement.specifiers.filter((specifier: any) => specifier.type === 'ImportSpecifier'
        && specifier.importKind !== 'type' && (specifier.imported.name ?? specifier.imported.value) === 'defineComposition')
        .map((specifier: any) => specifier.local.name)
      : []);
    const exported = program.body.find((statement: any) => statement.type === 'ExportDefaultDeclaration') as any;
    const call = unwrap(exported?.declaration);
    const argument = unwrap(call?.arguments[0]);
    if (call?.type !== 'CallExpression' || call.callee.type !== 'Identifier' || !aliases.includes(call.callee.name) || call.arguments.length !== 1 || argument?.type !== 'ObjectExpression') return false;
    return argument.properties.some((property: any) => property.type === 'ObjectProperty' && !property.computed
      && (property.key.type === 'Identifier' ? property.key.name : property.key.type === 'StringLiteral' ? property.key.value : undefined) === 'input');
  } catch {
    return false;
  }
}

function harnessPaths(source: SourceBundle, feedsImageInput: boolean): Readonly<{ harness: string; source?: string }> {
  const required = feedsImageInput ? 2 : 1;
  if (Object.keys(source.files).length + required > 32) {
    throw Error(`Library composition needs ${feedsImageInput ? 'two' : 'one'} free source file${feedsImageInput ? 's' : ''} for validation`);
  }
  for (let index = 1; index <= 32; index++) {
    const harness = `library-validation-harness-${index}.ts`;
    const imageSource = `library-validation-source-${index}.ts`;
    if (!Object.hasOwn(source.files, harness) && (!feedsImageInput || !Object.hasOwn(source.files, imageSource))) {
      return feedsImageInput ? { harness, source: imageSource } : { harness };
    }
  }
  throw Error(`Library composition needs ${feedsImageInput ? 'two' : 'one'} free source file${feedsImageInput ? 's' : ''} for validation`);
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

export function libraryValidationSource(source: SourceBundle): SourceBundle {
  if (!compositionEntry(source)) return { ...source, sdkVersion: '0.3.0' };
  const feedsImageInput = hasExternalImageInput(source), paths = harnessPaths(source, feedsImageInput);
  return {
    ...source,
    entry: paths.harness,
    files: {
      ...source.files,
      [paths.harness]: closedHarness(source.entry, feedsImageInput, paths.source),
      ...(paths.source ? { [paths.source]: closedImageSource() } : {}),
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
