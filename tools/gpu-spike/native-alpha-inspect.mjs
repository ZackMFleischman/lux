import { deflateSync } from 'node:zlib';
const WIDTH=1920,HEIGHT=1080;
const WHITE=[[187,187,255,255],[0,255,0,255],[255,255,255,255],[255,255,255,255]];
const TRANSPARENT=[[0,0,128,128],[0,255,0,255],[0,0,0,0],[64,64,64,64]];
const matches=(actual,expected)=>Array.isArray(actual)&&actual.length===4&&actual.every((row,i)=>Array.isArray(row)&&row.length===4&&row.every((v,c)=>Number.isInteger(v)&&v>=0&&v<=255&&Math.abs(v-expected[i][c])<=5));
/** A fixture image/control check only; does not certify Resolume, frame
 * correspondence, physical stop, GPU cleanup or performance acceptance. */
export function inspectNativeAlpha({pixels,experiment,probe,captureMtimeMs}) {
  if(experiment?.outcome!=='success'||experiment.cleanupComplete!==true||experiment.result?.cleanupComplete!==true||experiment.result.exitCode!==0||experiment.result.timeout!==false||experiment.result.cancelled!==false||!Number.isInteger(experiment.timeoutMs)||experiment.timeoutMs<1000||experiment.timeoutMs>30000)throw Error('Supervised cleanup/deadline did not succeed');
  // Manifest start includes review hashing/preflight; freshness starts at the
  // actual supervised child, whose execution budget is recorded separately.
  const start=Date.parse(experiment.child?.startUtc),end=Date.parse(experiment.result.endUtc);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||!Number.isFinite(captureMtimeMs)||captureMtimeMs<start||captureMtimeMs>end)throw Error('Capture is stale or outside the bounded experiment window');
  if(!probe||probe.runId!==experiment.id||probe.ok!==true||probe.deinstantiated!==true||probe.deinitialized!==true||probe.parameterIndex!==0||probe.normalizedValue!==0||!Number.isFinite(probe.elapsedMs)||probe.elapsedMs<0||probe.elapsedMs>10000||!matches(probe.white,WHITE))throw Error('Invalid alpha/control probe evidence');
  if(!(pixels instanceof Uint8Array)||pixels.byteLength!==WIDTH*HEIGHT*4)throw Error('Invalid native capture size');
  const samples=[.25,.75].flatMap(y=>[.25,.75].map(x=>{const at=((HEIGHT-1-Math.floor(y*HEIGHT))*WIDTH+Math.floor(x*WIDTH))*4;return [...pixels.subarray(at,at+4)];}));
  if(!matches(samples,TRANSPARENT))throw Error('Native premultiplied-alpha quartet mismatch');
  return {ok:true,samples,actualResolumeTested:false,performanceAcceptance:false};
}
/** Native output is E(linear RGB)*alpha. PNG needs straight encoded RGB:
 * unpremultiply the encoded bytes, with zero RGB when alpha is zero. */
export function nativeAlphaPng(pixels,width=WIDTH,height=HEIGHT) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>WIDTH||height>HEIGHT||!(pixels instanceof Uint8Array)||pixels.byteLength!==width*height*4)throw Error('Invalid native RGBA image');
  const scan=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const from=((height-1-y)*width+x)*4,to=y*(width*4+1)+1+x*4,a=pixels[from+3];
    for(let c=0;c<3;c++)scan[to+c]=a?Math.min(255,Math.round(pixels[from+c]*255/a)):0;
    scan[to+3]=a;
  }
  const crc32=buffer=>{let crc=0xffffffff;for(const b of buffer){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
  const chunk=(name,data)=>{const type=Buffer.from(name),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([n,type,data,crc]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
