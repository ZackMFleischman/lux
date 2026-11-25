import fs from 'node:fs';
const path = new URL('./quasar.ts', import.meta.url);
let source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('fn qOrbiters(');
const end = source.indexOf('\n`);', start);
if(start < 0 || end < 0) throw Error('Missing orbital shader');
const bodies = `
// All bodies occupy world space and are intersected once along the bent ray.
// No foreground/background copies or depth crossfade.
fn qSphereDistance(ro:vec3f,rd:vec3f,center:vec3f,radius:f32,limit:f32) -> f32 {
  let offset=ro-center;
  let b=dot(offset,rd);
  let discriminant=b*b-dot(offset,offset)+radius*radius;
  if(discriminant<0.0) { return -1.0; }
  let entry=-b-sqrt(discriminant);
  if(entry<0.0001 || entry>limit) { return -1.0; }
  return entry;
}
fn qSceneBodies(ro:vec3f,rd:vec3f,limit:f32,time:f32,settings:vec4f) -> vec4f {
  if(settings.x<0.001 || limit<0.0001) { return vec4f(0.0,0.0,0.0,-1.0); }
  var nearest=limit;
  var color=vec3f(0.0);
  var found=false;
  for(var i=0;i<3;i++) {
    let id=f32(i);
    let orbit=8.5+id*2.0;
    let phase=time*settings.y*(0.34-id*0.045)+select(select(0.50,4.08,i==1),2.30,i==2);
    let center=vec3f(cos(phase)*orbit,sin(phase)*id*0.25,sin(phase)*orbit);
    let radius=select(select(0.55,0.48,i==1),0.38,i==2);
    let hit=qSphereDistance(ro,rd,center,radius,nearest);
    if(hit>=0.0) {
      let normal=normalize(ro+rd*hit-center);
      let light=max(0.0,dot(normal,normalize(-center)));
      let longitude=atan2(normal.z,normal.x)+time*0.12;
      let band=0.72+0.28*sin(normal.y*17.0+qNoise(vec2f(normal.y*4.0,sin(longitude)*2.0))*2.7);
      let pigment=select(select(vec3f(0.13,0.53,0.65),vec3f(0.71,0.28,0.095),i==1),vec3f(0.42,0.32,0.57),i==2);
      let rim=pow(1.0-max(0.0,dot(normal,-rd)),3.0)*light*0.35;
      color=pigment*(0.09+light*1.65)*band+vec3f(0.17,0.42,0.57)*rim;
      nearest=hit; found=true;
    }
    if(i==1) {
      let ringNormal=normalize(vec3f(0.12,1.0,0.28));
      let denominator=dot(rd,ringNormal);
      if(abs(denominator)>0.0001) {
        let distance=dot(center-ro,ringNormal)/denominator;
        let point=ro+rd*distance-center;
        let radiusInRing=length(point)/radius;
        if(distance>0.0001 && distance<nearest && radiusInRing>1.35 && radiusInRing<2.30) {
          let gap=smoothstep(1.78,1.81,radiusInRing)*(1.0-smoothstep(1.87,1.90,radiusInRing));
          let stripe=0.68+0.32*sin(radiusInRing*92.0);
          color=vec3f(0.62,0.36,0.16)*stripe*(1.0-gap*0.75);
          nearest=distance; found=true;
        }
      }
    }
  }
  // Belt tests run only for ray segments within one rock radius of its plane.
  let segmentEnd=ro+rd*limit;
  if(min(ro.y,segmentEnd.y)<0.10 && max(ro.y,segmentEnd.y)>-0.10) {
    for(var i=0;i<64;i++) {
      let id=f32(i);
      if(id>=settings.z*64.0) { break; }
      let seed=qHash(vec2f(id,8.3));
      let phase=id*2.399963+time*settings.y*(0.17+seed*0.07);
      let orbit=8.1+seed*5.7;
      let center=vec3f(cos(phase)*orbit,0.0,sin(phase)*orbit);
      let radius=0.025+qHash(vec2f(id,3.2))*0.045;
      let hit=qSphereDistance(ro,rd,center,radius,nearest);
      if(hit>=0.0) {
        let normal=normalize(ro+rd*hit-center);
        let light=0.12+max(0.0,dot(normal,normalize(-center)))*1.1;
        color=mix(vec3f(0.20,0.24,0.29),vec3f(0.46,0.31,0.18),seed)*light;
        nearest=hit; found=true;
      }
    }
  }
  return vec4f(color,select(-1.0,nearest,found));
}
`;
source=source.slice(0,start)+bodies+source.slice(end);
source=source.replace('  var closest = 30.0;', '  var closest = 30.0;\n  var bodyHit = false;\n  var foregroundBody = 0.0;');
source=source.replace('  let discriminant = entryB*entryB - dot(ro,ro) + 121.0;', '  let discriminant = entryB*entryB - dot(ro,ro) + 225.0;');
source=source.replace(`  if (discriminant > 0.0) {
    pos += rd * max(0.0, -entryB - sqrt(discriminant));
    for (var i = 0; i < 88; i++) {`, `  let entryDistance = select(80.0,max(0.0,-entryB-sqrt(max(0.0,discriminant))),discriminant>0.0);
  let entryBody = qSceneBodies(ro,rd,entryDistance,time,bodies);
  if(entryBody.a>=0.0) {
    pos=ro+rd*entryBody.a;
    emission+=entryBody.rgb*bodies.x;
    transmit*=1.0-bodies.x;
    bodyHit=true; foregroundBody=bodies.x;
  }
  if (discriminant > 0.0 && !bodyHit) {
    pos += rd * entryDistance;
    for (var i = 0; i < 96; i++) {`);
source=source.replace('if (r > 11.2 && dot(pos,rd) > 0.0)', 'if (r > 15.2 && dot(pos,rd) > 0.0)');
source=source.replace('      let nextPosition = pos + rd * stepLength + force * (0.5*stepLength*stepLength);', `      var nextPosition = pos + rd * stepLength + force * (0.5*stepLength*stepLength);
      let segmentLength=length(nextPosition-pos);
      let segmentDirection=(nextPosition-pos)/max(0.00001,segmentLength);
      let body=qSceneBodies(pos,segmentDirection,segmentLength,time,bodies);
      if(body.a>=0.0) { nextPosition=pos+segmentDirection*body.a; }`);
source=source.replace(`      pos = nextPosition;
      rd = nextDirection;`, `      pos = nextPosition;
      rd = nextDirection;
      if(body.a>=0.0) {
        emission+=body.rgb*transmit*bodies.x;
        transmit*=1.0-bodies.x;
        bodyHit=true;
        foregroundBody=select(0.0,bodies.x,dot(pos,ro)>0.0);
        break;
      }`);
source=source.replace('    if (length(pos) < 3.0) { swallowed = true; }', `    if (!bodyHit && length(pos) < 3.0) { swallowed = true; }
  }
  if(!bodyHit && !swallowed && discriminant>0.0) {
    let escapingBody=qSceneBodies(pos,normalize(rd),80.0,time,bodies);
    if(escapingBody.a>=0.0) {
      emission+=escapingBody.rgb*transmit*bodies.x;
      transmit*=1.0-bodies.x;
      bodyHit=true;
    }`);
source=source.replace(`  let distantBodies = qOrbiters((p+warp*2.0)/view.z,time,bodies,0.0);
  let background = sky*(1.0-distantBodies.a)+distantBodies.rgb;
  var color = emission + select(background*transmit,vec3f(0.0),swallowed);`, `  var color = emission + select(sky*transmit,vec3f(0.0),swallowed);`);
source=source.replace('*(0.70+0.3*p.x);','*(0.70+0.3*p.x)*(1.0-foregroundBody);');
source=source.replace('*nearJet*(0.8+shocks*0.45);','*nearJet*(0.8+shocks*0.45)*(1.0-foregroundBody);');
source=source.replace(`*jets.x*0.25;
  // Foreground bodies cross cleanly in front; the far half is sampled through the lens.
  let nearBodies = qOrbiters(p/view.z,time,bodies,1.0);
  color = color*(1.0-nearBodies.a)+nearBodies.rgb;`, '*jets.x*0.25*(1.0-foregroundBody);');
if(source.includes('qOrbiters'))throw Error('Old screen-space path remains');
fs.writeFileSync(path,source);
console.log('Replaced screen-space copies with bent-ray world-space intersections');
