import {normalizeComponentDeclaration} from '../../../packages/runtime-contracts/src/components.mjs';
import {validateSingleImageProfile} from '../../../packages/runtime-contracts/src/component-profile.mjs';
function fail(node,message){throw Object.assign(Error(message),{code:'COMPILE_FAILED',loc:node?.loc?.start??{line:1,column:0}});}
function unwrap(node){while(node&&['TSAsExpression','TSSatisfiesExpression','TSTypeAssertion','ParenthesizedExpression'].includes(node.type))node=node.expression;return node;}
function rows(node){
 node=unwrap(node);if(node?.type!=='ObjectExpression')fail(node,'Component metadata requires inline literal objects');
 const result=new Map();
 for(const p of node.properties){
  if(!['ObjectProperty','ObjectMethod'].includes(p.type)||p.computed||p.shorthand||!['Identifier','StringLiteral'].includes(p.key?.type))fail(p,'Component metadata requires literal keys; no spreads or computed keys');
  const key=p.key.name??p.key.value;if(result.has(key))fail(p,'Duplicate literal property: '+key);result.set(key,p);
 }return result;
}
function literal(node){
 node=unwrap(node);
 if(['StringLiteral','NumericLiteral'].includes(node?.type))return node.value;
 if(node?.type==='NullLiteral')return null;
 if(node?.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='NumericLiteral')return -node.argument.value;
 if(node?.type==='ArrayExpression')return node.elements.map(literal);
 if(node?.type==='ObjectExpression'){
  const value=Object.create(null);for(const [key,p] of rows(node)){if(p.type!=='ObjectProperty')fail(p,'No methods or accessors in metadata');value[key]=literal(p.value);}return value;
 }
 fail(node,'Metadata requires literals; no references, calls or expressions');
}
export function extractComponentDeclaration(ast){
 const program=ast.program??ast;
 const aliases=program.body.flatMap(n=>n.type==='ImportDeclaration'&&n.importKind!=='type'&&n.source.value==='@lux/visual-sdk'?n.specifiers.filter(s=>s.type==='ImportSpecifier'&&s.importKind!=='type'&&(s.imported.name??s.imported.value)==='defineComponent').map(s=>s.local.name):[]);
 const exported=program.body.find(n=>n.type==='ExportDefaultDeclaration'),call=unwrap(exported?.declaration);
 if(call?.type!=='CallExpression'||call.callee.type!=='Identifier'||!aliases.includes(call.callee.name)||call.arguments.length!==1)fail(exported,'Entry must export default defineComponent({...}) imported from @lux/visual-sdk');
 const outer=rows(call.arguments[0]);
 if(outer.size!==2||!outer.has('metadata')||!outer.has('create')||outer.get('metadata').type!=='ObjectProperty')fail(call,'Component requires only literal metadata and create');
 const node=outer.get('metadata').value;
 try{return validateSingleImageProfile(normalizeComponentDeclaration(literal(node)));}catch(error){if(error.code==='COMPILE_FAILED')throw error;fail(node,error.message);}
}
