import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveNodeSeed, createNodeRandom, nodeRandomVersion } from '../../packages/runtime/src/graph/node-random.ts';
import type { NodePath } from '../../packages/runtime-contracts/src/graph.ts';

const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const U='ABCDEFAB-1234-4ABC-8DEF-ABCDEFABCDEF', L='abcdefab-1234-4abc-8def-abcdefabcdef';
const vectors = [
  {seed:0,path:[A],derived:554697909,words:[2163617745,846333058,4162980917,3818891773]},
  {seed:1,path:[A],derived:1541462538,words:[244026629,2314345351,4126713571,2340250673]},
  {seed:0,path:[B],derived:504365052,words:[780012583,3914084322,2352570172,435245682]},
  {seed:4294967295,path:[A,B],derived:876071422,words:[2687900949,2773913242,888867059,4067017224]},
  {seed:0,path:[U],derived:1461807047,words:[2157692342,2493424835,3952813674,3462588572]},
  {seed:0,path:[L],derived:4159721351,words:[2342564776,4029765132,1762557651,3480641535]},
];
const path = (value: unknown) => value as NodePath;
const words = (random: ReturnType<typeof createNodeRandom>) => Array.from({length:4}, () => random.next()*4294967296);

for (const vector of vectors) test(`literal FNV/Mulberry vector ${vector.seed}/${vector.path.join('/')}`, () => {
  assert.equal(nodeRandomVersion,'lux-node-rng-v1');
  assert.equal(deriveNodeSeed(vector.seed,path(vector.path)),vector.derived);
  assert.deepEqual(words(createNodeRandom(vector.seed,path(vector.path))),vector.words);
});

test('literal 57-byte zero/A encoding independently hashes to the published seed', () => {
  const bytes = Buffer.from('6c75782d6e6f64652d726e672d763100000000000130303030303030302d303030302d343030302d383030302d303030303030303030303031','hex');
  assert.equal(bytes.length,57);
  assert.equal(bytes.subarray(0,16).toString(),'lux-node-rng-v1\0');
  assert.equal(bytes.readUInt32LE(16),0); assert.equal(bytes[20],1);
  assert.equal(bytes.subarray(21).toString(),A);
  let hash = 2166136261n;
  for (const byte of bytes) hash = ((hash ^ BigInt(byte))*16777619n)&0xffffffffn;
  assert.equal(Number(hash),554697909);
  assert.equal(deriveNodeSeed(0,path([A])),Number(hash));
});

test('accepts frozen depth-eight paths, repeated UUID segments and canonical seed zero', () => {
  const ids = Object.freeze(Array.from({length:8},()=>A));
  assert.ok(Number.isInteger(deriveNodeSeed(0,path(ids))));
  assert.equal(deriveNodeSeed(-0,path([A])),554697909);
  assert.notEqual(deriveNodeSeed(0,path([A,B])),deriveNodeSeed(0,path([B,A])));
  assert.notEqual(deriveNodeSeed(0,path([A])),deriveNodeSeed(0,path([A,A])));
});

test('rejects invalid seeds before path reads or unsigned truncation', () => {
  let reads=0;
  const ids=Object.defineProperty([A],'0',{get(){reads++; return A;}});
  for (const seed of [-1,4294967296,0.5,NaN,Infinity,-Infinity,'0',null,undefined,1n]) {
    assert.throws(()=>deriveNodeSeed(seed as number,path(ids)),RangeError);
    assert.throws(()=>createNodeRandom(seed as number,path([A])),RangeError);
  }
  assert.equal(reads,0);
});

test('rejects malformed path containers and identities without invoking getters', () => {
  let reads=0;
  const getter=()=>{reads++; throw Error('unexpected getter');};
  const accessor=Object.defineProperty([A],'0',{get:getter});
  const extra=Object.defineProperty([A],'extra',{get:getter});
  const symbol=Object.assign([A],{[Symbol('extra')]:true});
  const inherited=Object.setPrototypeOf([A],{get extra(){return getter();}});
  const overlong=Object.defineProperty(new Array(9),'0',{get:getter});
  assert.throws(()=>deriveNodeSeed(0,path(overlong)), /1 to 8/);
  for (const bad of [[],new Array(1),accessor,extra,symbol,inherited,overlong,
    Array.from({length:9},()=>A),
    Object.setPrototypeOf([A],null), {0:A,length:1},new String(A),null,A,
    ['x'.repeat(100000)],['x'.repeat(36)], [A+' '], [123], [new String(A)], ['é'.repeat(36)]]) {
    assert.throws(()=>deriveNodeSeed(0,path(bad)));
    assert.throws(()=>createNodeRandom(0,path(bad)));
  }
  assert.equal(reads,0);
});

test('streams own private state and reset the original seed without external changes', () => {
  const external={gain:6.125};
  const ids=[A], a=createNodeRandom(0,path(ids)), same=createNodeRandom(0,path([A])), b=createNodeRandom(0,path([B]));
  assert.ok(Object.isFrozen(a));
  assert.notEqual(a,same);
  assert.equal(a.next()*4294967296,2163617745);
  for(let i=0;i<100;i++) a.next();
  assert.deepEqual(words(same),vectors[0]!.words);
  assert.deepEqual(words(b),vectors[2]!.words);
  ids[0]=B;
  a.reset(); same.reset(); b.reset();
  assert.deepEqual(words(a),vectors[0]!.words);
  assert.deepEqual(words(same),vectors[0]!.words);
  assert.deepEqual(words(b),vectors[2]!.words);
  assert.deepEqual(external,{gain:6.125});
  const {next,reset}=a; reset(); assert.equal(next()*4294967296,2163617745);
});

function typeBoundary(random: ReturnType<typeof createNodeRandom>) {
  // @ts-expect-error reset cannot replace the scene or path seed
  random.reset(123);
  // @ts-expect-error UUID paths use branded logical identities
  deriveNodeSeed(0,['display name']);
}
void typeBoundary;
