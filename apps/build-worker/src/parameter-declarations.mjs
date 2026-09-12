import { normalizeControlDeclarations } from '../../../packages/runtime-contracts/src/parameters.mjs';

function fail(node, message) {
  throw Object.assign(Error(message), {code:'COMPILE_FAILED',loc:node?.loc?.start ?? {line:1,column:0}});
}
function unwrap(node) {
  while (node && ['TSAsExpression','TSSatisfiesExpression','TSTypeAssertion','ParenthesizedExpression'].includes(node.type)) node = node.expression;
  return node;
}
function propertyName(property) {
  if (!['ObjectProperty','ObjectMethod'].includes(property.type) || property.computed || property.shorthand ||
      !['Identifier','StringLiteral'].includes(property.key?.type)) fail(property, 'Controls require literal keys and values; spreads, computed keys and shorthand are unavailable');
  return property.key.name ?? property.key.value;
}
function properties(node) {
  node = unwrap(node);
  if (node?.type !== 'ObjectExpression') fail(node, 'Controls require an inline literal object; references and calls are unavailable');
  const rows = new Map();
  for (const property of node.properties) {
    const key = propertyName(property);
    if (rows.has(key)) fail(property, `Duplicate literal property: ${String(key).slice(0,80)}`);
    rows.set(key,property);
  }
  return rows;
}
function literal(node) {
  node = unwrap(node);
  if (node?.type === 'StringLiteral' || node?.type === 'NumericLiteral') return node.value;
  if (node?.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'NumericLiteral') return -node.argument.value;
  fail(node, 'Control metadata requires string or numeric literals; expressions, calls and references are unavailable');
}

/** Reads Babel syntax only. Never imports or evaluates submitted source. */
export function extractControlDeclarations(ast) {
  const program = ast.program ?? ast;
  const aliases = program.body.flatMap(node => node.type === 'ImportDeclaration' && node.importKind !== 'type' && node.source.value === '@lux/visual-sdk'
    ? node.specifiers.filter(item => item.type === 'ImportSpecifier' && item.importKind !== 'type' && (item.imported.name ?? item.imported.value) === 'defineVisual').map(item => item.local.name) : []);
  const exported = program.body.find(node => node.type === 'ExportDefaultDeclaration');
  const call = unwrap(exported?.declaration);
  if (call?.type !== 'CallExpression' || call.callee.type !== 'Identifier' || !aliases.includes(call.callee.name) || call.arguments.length !== 1) {
    fail(exported, 'Entry must export default defineVisual({...}) imported from @lux/visual-sdk');
  }
  const outer = properties(call.arguments[0]);
  for (const key of outer.keys()) if (!['controls','create'].includes(key)) fail(outer.get(key), `Unsupported visual literal property: ${key.slice(0,80)}`);
  const property = outer.get('controls');
  if (!property || property.type !== 'ObjectProperty') fail(property ?? call, 'Visual requires literal controls: {} or named number declarations');
  const controlRows = properties(property.value), declarations = Object.create(null), locations = new Map();
  for (const [id, row] of controlRows) {
    if (row.type !== 'ObjectProperty') fail(row, 'Controls require literal descriptors; getters and methods are unavailable');
    const fields = properties(row.value), value = Object.create(null);
    locations.set(`controls.${id}`,row);
    for (const [key, field] of fields) {
      if (field.type !== 'ObjectProperty') fail(field, 'Control metadata requires literal values; getters and methods are unavailable');
      value[key] = literal(field.value); locations.set(`controls.${id}.${key}`,field.value);
    }
    declarations[id] = value;
  }
  try { return normalizeControlDeclarations(declarations); }
  catch (error) { fail(locations.get(error.path) ?? property, error.message); }
}
