import {normalizeStoryCapabilityDeclaration} from '../../../packages/runtime-contracts/src/story.mjs';

function fail(node,message) {
  throw Object.assign(Error(message),{code:'COMPILE_FAILED',loc:node?.loc?.start ?? {line:1,column:0}});
}
function unwrap(node) {
  while(node&&['TSAsExpression','TSSatisfiesExpression','TSTypeAssertion','ParenthesizedExpression'].includes(node.type)) node=node.expression;
  return node;
}
function propertyName(property) {
  if(!['ObjectProperty','ObjectMethod'].includes(property.type)||property.computed||property.shorthand||!['Identifier','StringLiteral'].includes(property.key?.type)) {
    fail(property,'Story capability requires literal data properties; methods, accessors, spreads, computed keys and shorthand are unavailable');
  }
  return property.key.name??property.key.value;
}
function properties(node) {
  node=unwrap(node);
  if(node?.type!=='ObjectExpression') fail(node,'Story capability requires an inline literal object; references and calls are unavailable');
  const rows=new Map();
  for(const property of node.properties) {
    if(property.type==='SpreadElement') fail(property,'Story capability spreads are unavailable');
    const key=propertyName(property);
    if(rows.has(key)) fail(property,`Duplicate literal property: ${String(key).slice(0,80)}`);
    rows.set(key,property);
  }
  return rows;
}
function literal(node,path,locations) {
  node=unwrap(node);
  locations.set(path,node);
  if(node?.type==='StringLiteral'||node?.type==='NumericLiteral'||node?.type==='BooleanLiteral') return node.value;
  if(node?.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='NumericLiteral') return -node.argument.value;
  if(node?.type==='ObjectExpression') {
    const result=Object.create(null);
    for(const [key,property] of properties(node)) {
      if(property.type!=='ObjectProperty') fail(property,'Story capability methods and accessors are unavailable');
      result[key]=literal(property.value,`${path}.${key}`,locations);
    }
    return result;
  }
  fail(node,'Story capability requires literal data; expressions, calls and references are unavailable');
}

/** Reads Babel syntax only. Never imports or evaluates submitted source. */
export function extractStoryCapability(ast) {
  const program=ast.program??ast;
  const aliases=program.body.flatMap(node=>node.type==='ImportDeclaration'&&node.importKind!=='type'&&node.source.value==='@lux/visual-sdk'
    ? node.specifiers.filter(item=>item.type==='ImportSpecifier'&&item.importKind!=='type'&&(item.imported.name??item.imported.value)==='defineVisual').map(item=>item.local.name):[]);
  const exported=program.body.find(node=>node.type==='ExportDefaultDeclaration');
  const call=unwrap(exported?.declaration);
  if(call?.type!=='CallExpression'||call.callee.type!=='Identifier'||!aliases.includes(call.callee.name)||call.arguments.length!==1) {
    fail(exported,'Entry must export default defineVisual({...}) imported from @lux/visual-sdk');
  }
  const outer=properties(call.arguments[0]);
  for(const key of outer.keys()) if(!['controls','story','create'].includes(key)) fail(outer.get(key),`Unsupported visual literal property: ${key.slice(0,80)}`);
  const property=outer.get('story');
  if(!property) return null;
  if(property.type!=='ObjectProperty') fail(property,'Story capability methods and accessors are unavailable');
  const locations=new Map();
  const declaration=literal(property.value,'story',locations);
  try { return normalizeStoryCapabilityDeclaration(declaration); }
  catch(error) { fail(locations.get(error.path)??property,error.message); }
}
