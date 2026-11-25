const fs=require('fs');const p='.worktrees/hummingbird-art/examples/components/wandering-tracers/ornament-birds.ts';let s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');s="import { hummingbirdShader } from './ornament-hummingbird.ts';\n"+s;
s=s.replace('  var opacity = outline;',`  var opacity = outline;
  var birdColor = mix(vec3f(0.99, 0.91, 0.68), ink, fill);
  if (humming > 0.5) {
    let hum = loHummingbird(q, time, pose.bank, pose.rest, mood.y, index, style.y);
    birdColor = hum.rgb;
    opacity = hum.a;
  }`);
s=s.replace('  var color = mix(vec3f(0.99, 0.91, 0.68), ink, fill);','  var color = birdColor;');
s=s.replace('wgslFn(fragment + birdHelpers + helpers)', 'wgslFn(fragment + hummingbirdShader + birdHelpers + helpers)');
fs.writeFileSync(p,s);
