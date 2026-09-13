const keys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
const isArray=Array.isArray,freeze=Object.freeze,objectPrototype=Object.prototype,arrayPrototype=Array.prototype,RuntimeError=Error;
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
function bad(){throw new RuntimeError('Component definition metadata mismatch');}
function own(value,key){const d=descriptor(value,key);if(!d?.enumerable||!hasOwn(d,'value'))bad();return d.value;}
// Prepare the expected shape in the pristine realm. Comparison never normalizes
// authored objects or calls getters, JSON, or mutable policy after import.
export function prepareComponentDefinition(metadata){
 function prepare(expected){
  if(expected===null||typeof expected!=='object')return actual=>{if(actual!==expected)bad();};
  const array=isArray(expected),fields=keys(expected).filter(k=>k!=='length'),checks=fields.map(k=>prepare(expected[k]));
  return actual=>{
   if(!actual||typeof actual!=='object'||keys(actual).length!==fields.length+(array?1:0))bad();
   const p=prototype(actual);
   if(array?(!isArray(actual)||p!==arrayPrototype||descriptor(actual,'length')?.value!==fields.length):(p!==objectPrototype&&p!==null))bad();
   for(let i=0;i<fields.length;i++)checks[i](own(actual,fields[i]));
  };
 }
 const check=prepare(metadata);
 return freeze(module=>{
  const definition=own(module,'default');
  if(!definition||typeof definition!=='object'||keys(definition).length!==4||(prototype(definition)!==objectPrototype&&prototype(definition)!==null)||own(definition,'kind')!=='component'||own(definition,'sdkVersion')!=='0.3.0')bad();
  check(own(definition,'metadata'));const create=own(definition,'create');if(typeof create!=='function')bad();return create;
 });
}
