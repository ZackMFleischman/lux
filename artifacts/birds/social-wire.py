from pathlib import Path
p=Path('.worktrees/bird-iteration/examples/components/wandering-tracers/ornament-birds.ts');s=p.read_text()
s="import { createBirdSocial } from './ornament-bird-social.ts';\n"+s
s=s.replace('settings: vec4f, motion: vec4f)', 'settings: vec4f, motion: vec4f, social: vec4f, mood: vec4f)')
s=s.replace('settings: vec4f, motion: vec4f, style: vec4f)', 'settings: vec4f, motion: vec4f, style: vec4f, social: vec4f, mood: vec4f, rates: vec4f)')
s=s.replace('detail, settings, motion);','detail, settings, motion, social, mood);')
a=s.index('  // Stagger visits');b=s.index('  return LoBirdPose',a)
s=s[:a]+'''  let excursion = social.x;
  if (excursion > 0.0) {
    let owner = i32(social.z);
    let anchor = loRegionCenter(owner, view.x, view.z, detail.y);
    var perch = anchor + vec2f(social.w, shape.x * 0.82);
    for (var step = 0; step < 12; step++) {
      let noise = loFbm(perch * (1.35 + shape.y * 0.38) + vec2f(view.z * 0.071, -view.z * 0.043)) - 0.5;
      let distance = loShapeSdf(owner, perch, view.x, view.z, shape, detail, noise);
      perch.y -= clamp(distance * 0.8, -0.025, 0.12);
    }
    rest = social.y;
    position = mix(position, vec3f(perch + vec2f(0.0, 0.037 * settings.x), 0.04), excursion);
    position.y += sin(excursion * 3.141593) * 0.18;
    let idle = mood.y;
    let hop = pow(max(0.0, sin(motion.z * 5.0 + index)), 8.0) * 0.016;
    position.y += select(0.0, hop, idle > 4.5) * rest;
    heading = select(0.10, 3.041593, mood.x < -0.1);
    heading += sin(motion.z * 2.2 + index) * select(0.03, 0.15, idle > 1.5 && idle < 2.5) * rest;
  }
''' +s[b:]
s=s.replace('(st - 0.5) * 0.24','(st - 0.5) * 0.40')
a=s.index('  // The tangent and orbital');b=s.index('  let time = motion.z;',a)
s=s[:a]+'''  // Follow actual travel as before. A short forward sample avoids numerical
  // noise, while shortest-angle blending only settles into the perch heading.
  let look = 0.045;
  let nextSettings = vec4f(settings.x, settings.y + look * rates.z, settings.zw);
  let nextMotion = vec4f(motion.x + look * rates.z * 0.86 / max(0.15, rates.w), motion.y, motion.z + look, motion.w);
  let nextSocial = vec4f(clamp(social.x + look * rates.x, 0.0, 1.0), clamp(social.y + look * rates.y, 0.0, 1.0), social.zw);
  let nextPose = loBirdPose(index, vec4f(view.x + look, view.yzw), shape, detail, nextSettings, nextMotion, nextSocial, mood);
  let velocity = nextPose.center.xy - pose.center.xy;
  var heading = select(pose.heading, atan2(velocity.y, velocity.x), dot(velocity, velocity) > 0.00000001);
  let settle = smoothstep(0.15, 0.85, pose.rest);
  heading += atan2(sin(pose.heading - heading), cos(pose.heading - heading)) * settle;
  var q = loRotate(offset, heading);
''' +s[b:]
s=s.replace('8.0 + index * 0.2','9.5 + index * 0.47').replace('glide * 0.60','glide * 0.74').replace('0.049 + flap * mix(0.015, 0.010, humming)','0.046 + flap * mix(0.022, 0.013, humming)')
s=s.replace('  let spread = mix(', '  var spread = mix(')
s=s.replace('  q.x *=', '''  if (mood.y > 2.5 && mood.y < 3.5) { spread += pose.rest * 0.028 * (0.5 + 0.5 * sin(time * 2.4)); }
  q.x *=''')
s=s.replace('  let head = length(q - vec2f(0.020, 0.007 + pose.rest * sin(time * 2.2) * 0.002)) - 0.010;', '''  let preen = select(0.0, pose.rest * (0.5 + 0.5 * sin(time * 3.0)), mood.y > 0.5 && mood.y < 1.5);
  let headCenter = vec2f(0.020 - preen * 0.012, 0.007 - preen * 0.007 + pose.rest * sin(time * 2.2) * 0.002);
  let head = length(q - headCenter) - 0.010;''')
s=s.replace('  let eye = ', '  var eye = ')
s=s.replace('  ink = mix(ink, vec3f(1.0, 0.93, 0.70), eye);','''  if (mood.y > 3.5 && mood.y < 4.5 && pose.rest > 0.5) {
    eye = 1.0 - smoothstep(0.0010, 0.0018, loCapsule(q, vec2f(0.019, 0.009), vec2f(0.024, 0.008), 0.0005));
  }
  ink = mix(ink, vec3f(1.0, 0.93, 0.70), eye);''')
s=s.replace('  let color = mix(vec3f(0.99, 0.91, 0.68), ink, fill);','''  var color = mix(vec3f(0.99, 0.91, 0.68), ink, fill);
  if (mood.w > 0.001) {
    let b = offset - vec2f(0.014, 0.110);
    let bubbleSdf = loEllipse(b, vec2f(0.038, 0.030));
    let bubbleMask = (1.0 - smoothstep(-aa, aa, bubbleSdf)) * mood.w;
    let bead = min(length(offset - vec2f(0.014, 0.066)) - 0.006, length(offset - vec2f(0.012, 0.052)) - 0.003);
    var symbol = 1.0;
    var feeling = vec3f(0.17, 0.35, 0.50);
    let emotion = mood.z;
    if (emotion > 2.5 && emotion < 3.5) {
      symbol = min(min(length(b - vec2f(-0.007, 0.007)) - 0.009, length(b - vec2f(0.007, 0.007)) - 0.009), loBirdTriangle(b, vec2f(-0.015, 0.006), vec2f(0.015, 0.006), vec2f(0.0, -0.017)));
      feeling = vec3f(0.88, 0.13, 0.31);
    } else if (emotion > 3.5 && emotion < 4.5) {
      symbol = min(length(b - vec2f(0.0, -0.006)) - 0.009, loBirdTriangle(b, vec2f(-0.008, -0.003), vec2f(0.008, -0.003), vec2f(0.0, 0.017)));
      feeling = vec3f(0.10, 0.44, 0.75);
    } else if (emotion > 4.5 && emotion < 5.5) {
      symbol = min(loCapsule(b, vec2f(-0.019, 0.0), vec2f(0.019, 0.0), 0.002), loCapsule(b, vec2f(0.0, -0.021), vec2f(0.0, 0.021), 0.002));
      symbol = min(symbol, min(loCapsule(b, vec2f(-0.013, -0.013), vec2f(0.013, 0.013), 0.0018), loCapsule(b, vec2f(-0.013, 0.013), vec2f(0.013, -0.013), 0.0018)));
      feeling = vec3f(0.95, 0.53, 0.06);
    } else if (emotion < 1.5 || (emotion > 5.5 && emotion < 6.5)) {
      symbol = min(loEllipse(b, vec2f(0.020, 0.009)), length(b - vec2f(-0.004, 0.007)) - 0.012);
      symbol = min(symbol, loCapsule(b, vec2f(0.005, -0.009), vec2f(-0.003, -0.020), 0.002));
      feeling = select(vec3f(0.25, 0.35, 0.58), vec3f(0.57, 0.24, 0.46), emotion > 5.5);
    } else {
      // A tiny smiling companion/feather: avian symbols instead of human faces.
      symbol = min(loEllipse(b + vec2f(0.005, 0.002), vec2f(0.014, 0.010)), length(b - vec2f(0.009, 0.006)) - 0.008);
      symbol = min(symbol, loBirdTriangle(b, vec2f(0.014, 0.008), vec2f(0.014, 0.002), vec2f(0.023, 0.005)));
      symbol = min(symbol, loBirdTriangle(b, vec2f(-0.011, 0.0), vec2f(-0.024, 0.012), vec2f(-0.021, -0.007)));
      feeling = accent * 0.7;
    }
    let glyph = 1.0 - smoothstep(-aa, aa, symbol);
    let edge = smoothstep(-0.0025, -0.001, bubbleSdf);
    let bubbleColor = mix(mix(vec3f(1.0, 0.97, 0.86), vec3f(0.20, 0.14, 0.22), edge), feeling, glyph);
    color = mix(color, bubbleColor, bubbleMask);
    opacity = max(opacity, bubbleMask);
    let beadMask = (1.0 - smoothstep(-aa, aa, bead)) * mood.w;
    color = mix(color, vec3f(1.0, 0.96, 0.84), beadMask);
    opacity = max(opacity, beadMask);
  }''')
s=s.replace('  const styles =', '''  const socialEngine = createBirdSocial();
  const socials = Array.from({ length: 5 }, () => uniform(new Vector4(0, 0, 5, 0)));
  const moods = Array.from({ length: 5 }, () => uniform(new Vector4(0, 0, 0, 0)));
  const rates = Array.from({ length: 5 }, () => uniform(new Vector4(0, 0, 1, 2.5)));
  const styles =''')
s=s.replace('new PlaneGeometry(0.24, 0.24)','new PlaneGeometry(0.40, 0.40)')
s=s.replace('settings[index]!, motions[index]!);','settings[index]!, motions[index]!, socials[index]!, moods[index]!);')
s=s.replace('styles[index]!);','styles[index]!, socials[index]!, moods[index]!, rates[index]!);')
s=s.replace('      wingTime += dt;', '''      wingTime += dt;
      socialEngine.advance(dt, {
        frequency: controls.birdVisits ?? 1,
        speed: Array.from({ length: 5 }, (_, i) => sampler?.('birdExcursionSpeed', i) ?? controls.birdExcursionSpeed ?? 1),
        perchDuration: controls.birdPerchDuration ?? 10,
        sociability: controls.birdSociability ?? 0.65,
        seed: view.value.z,
      });''')
s=s.replace('        const speed = sampler?.(\'birdExcursionSpeed\', i)', '''        const state = socialEngine.states[i]!;
        const old = socials[i]!.value;
        rates[i]!.value.set(dt > 0 ? (state.excursion - old.x) / dt : 0, dt > 0 ? (state.rest - old.y) / dt : 0,
          sampler?.('birdSpeed', i < 2 ? 0 : 1) ?? flightSpeed, sampler?.('birdPitch', i < 2 ? 0 : 1) ?? controls.birdPitch ?? 1);
        old.set(state.excursion, state.rest, state.owner, state.slot);
        moods[i]!.value.set(state.facing, state.idle, state.emotion, state.bubble * (controls.birdThoughts ?? 0.7));
        const speed = sampler?.('birdExcursionSpeed', i)''')
s=s.replace('      previousTime = undefined;','      socialEngine.reset();\n      previousTime = undefined;')
p.write_text(s)
p=p.with_name('ornament-renderer.ts');s=p.read_text();s=s.replace('      structuralActivity: {', """      birdPerchDuration: { type: 'number', group: 'Bird Personality', label: 'Perch duration', default: 10, min: 1, max: 90, step: 0.5 },
      birdSociability: { type: 'number', group: 'Bird Personality', label: 'Sociability', default: 0.65, min: 0, max: 1, step: 0.01 },
      birdThoughts: { type: 'number', group: 'Bird Personality', label: 'Thought bubbles', default: 0.7, min: 0, max: 1, step: 0.01 },
      structuralActivity: {""")
s=s.replace('    controlDescriptions: {',"""    controlDescriptions: {
      birdPerchDuration: 'Typical stay in scene seconds; a friendly encounter can extend it until after the interaction.',
      birdSociability: 'Chance of visiting a perched companion, greeting, playing or shyly sharing a perch.',
      birdThoughts: 'Visibility of occasional feeling bubbles; zero hides them.',""")
p.write_text(s)
