from pathlib import Path
p=Path('C:/Users/zFlei/repos/lux/.worktrees/bird-iteration/examples/components/wandering-tracers/ornament-birds.ts')
s=p.read_text()
s=s.replace('settings: vec4f)', 'settings: vec4f, motion: vec4f)')
s=s.replace('detail, settings);','detail, settings, motion);')
s=s.replace('settings: vec4f, speed: f32)', 'settings: vec4f, motion: vec4f, style: vec4f)')
s=s.replace('let s = lead - member * 0.145 + sin(time * 0.63 - member * 1.4) * member * 0.018;', 'let s = lead + sin(time * 0.3 + member * 2.1) * 0.008;')
s=s.replace('let orbit = time * (0.83 + route * 0.09) - member * 1.6 + route * 2.1;', 'let orbit = motion.x + member * 6.283185 / select(2.0, 3.0, route > 0.5) + route * 2.1;')
s=s.replace('let radius = settings.z * (0.105 + member * 0.018);','let radius = settings.z * 0.105;')
s=s.replace('if (member == select(1.0, 2.0, route > 0.5) && settings.w > 0.0)', 'if (settings.w > 0.0)')
s=s.replace('let visit = fract(time / 48.0 + route * 0.43);','let visit = fract(motion.y / 48.0 + route * 0.43 + member * 0.27);')
s=s.replace(' * settings.w;', ' * min(settings.w, 1.0);')
s=s.replace('let scale = settings.x * (1.0 + pose.center.z * 1.2);','let scale = settings.x * clamp(1.0 + pose.center.z * 0.55, 0.65, 1.5);')
a=s.index('  let nextView ='); b=s.index('  let bank =',a)
s=s[:a]+'''  // The tangent and orbital bank provide a continuous heading even at a
  // projected velocity reversal. No tiny finite-difference heading flips.
  let heading = pose.heading + pose.bank * 0.12;
  var q = loRotate(offset, heading);
  let time = motion.z;
  let species = style.x;
  let humming = select(0.0, 1.0, species > 0.5 && species < 1.5);
  let swallow = select(0.0, 1.0, species > 1.5 && species < 2.5);
  let broad = select(0.0, 1.0, species > 2.5);
  let glide = smoothstep(0.20, 0.70, sin(time * 0.73 + index * 1.7));
  let flap = mix(sin(time * mix(8.0 + index * 0.2, 24.0, humming) - index * 2.0), 0.32, glide * 0.60 * (1.0 - humming));
  let spread = mix(0.049 + flap * mix(0.015, 0.010, humming) + swallow * 0.009, 0.009, pose.rest);
  q.x *= 1.0 + humming * 0.12 - swallow * 0.1;
''' +s[b:]
s=s.replace('vec2f(0.023, 0.010)', 'vec2f(0.023, 0.010 + broad * 0.004)')
s=s.replace('  let tail = loBirdTriangle', '  var tail = loBirdTriangle')
s=s.replace('  let topWing =', '''  if (swallow > 0.5) {
    tail = min(loBirdTriangle(q, vec2f(-0.012, 0.0), vec2f(-0.057, 0.019), vec2f(-0.031, 0.0)),
      loBirdTriangle(q, vec2f(-0.012, 0.0), vec2f(-0.052, -0.018), vec2f(-0.031, 0.0)));
  }
  let topWing =''')
s=s.replace('vec2f(-0.023, 0.009)', 'vec2f(-0.023 - broad * 0.012, 0.009)')
s=s.replace('vec2f(-0.025 + flap * 0.009, spread * bank)', 'vec2f(-0.025 + flap * 0.005 + humming * 0.024, spread * bank)')
s=s.replace('vec2f(-0.027, -spread / bank)', 'vec2f(-0.027 + humming * 0.02, -spread / bank)')
s=s.replace('vec2f(0.041, 0.006)', 'vec2f(0.041 + humming * 0.027, 0.006)')
s=s.replace('  let accent = select(vec3f(0.95, 0.19, 0.055), vec3f(0.02, 0.62, 0.66), index > 1.5);', '''  let hue = style.y + index * 0.173;
  let accent = 0.50 + 0.44 * cos(6.283185 * (hue + vec3f(0.0, 0.33, 0.67)));
  let wingMask = 1.0 - smoothstep(-aa, aa, min(topWing, bottomWing));
  let iridescence = 0.62 + 0.35 * cos(vec3f(0.1, 2.1, 4.2) + time * 1.8 + q.y * 90.0 + pose.bank * 3.0);
  ink = mix(ink, accent * 0.64, 0.55);
  ink = mix(ink, mix(accent * 0.8, iridescence, humming), wingMask * mix(0.65, 0.94, humming));''')
s=s.replace('  const settings = uniform(new Vector4(1, 0, 1, 1));','''  const settings = Array.from({ length: 5 }, () => uniform(new Vector4(1, 0, 1, 1)));
  const motions = Array.from({ length: 5 }, () => uniform(new Vector4(0, 0, 0, 0)));
  const styles = Array.from({ length: 5 }, (_, i) => uniform(new Vector4(i % 4, 0.03, 0, 0)));
  let controls: Record<string, number> = {};
  let sampler: ((id: string, key: number) => number) | undefined;
  let orbitTime = 0;
  const visitsTime = [0, 0, 0, 0, 0];
  let wingTime = 0;''')
s=s.replace('  const speedValue = uniform(1);','')
s=s.replace('detail, settings);','detail, settings[index]!, motions[index]!);') # calls TS not WGSL already changed earlier
s=s.replace('detail, settings, motion);\n    material.fragmentNode', 'detail, settings[index]!, motions[index]!);\n    material.fragmentNode')
s=s.replace('detail, settings, speedValue);','detail, settings[index]!, motions[index]!, styles[index]!);')
a=s.index('    update(size: number,');b=s.index('    dispose() {',a)
s=s[:a]+'''    update(values: Record<string, number>, sample?: (id: string, key: number) => number) {
      controls = values;
      sampler = sample;
      flightSpeed = values.birdSpeed ?? 1;
      for (let i = 0; i < meshes.length; i++) {
        const size = sample?.('birdSize', i) ?? values.birdSize ?? 1;
        settings[i]!.value.x = size;
        settings[i]!.value.z = sample?.('birdOrbit', i) ?? values.birdOrbit ?? 1;
        settings[i]!.value.w = values.birdVisits ?? 1;
        styles[i]!.value.x = (i + Math.round(values.birdSpecies ?? 0)) % 4;
        styles[i]!.value.y = values.birdPalette ?? 0.03;
        meshes[i]!.visible = size > 0;
      }
    },
    advance(time: number) {
      const dt = previousTime === undefined || time < previousTime ? 0 : Math.min(time - previousTime, 0.1);
      previousTime = time;
      flightTime += dt * flightSpeed;
      orbitTime += dt * flightSpeed * 0.86 / Math.max(0.15, controls.birdPitch ?? 1);
      wingTime += dt;
      for (let i = 0; i < 5; i++) {
        const speed = sampler?.('birdExcursionSpeed', i) ?? controls.birdExcursionSpeed ?? 1;
        visitsTime[i]! += dt * speed * Math.max(0.1, controls.birdVisits ?? 1);
        settings[i]!.value.y = flightTime;
        motions[i]!.value.set(orbitTime, visitsTime[i]!, wingTime, 0);
      }
    },
    reset() {
      previousTime = undefined;
      flightTime = 0;
      orbitTime = 0;
      wingTime = 0;
      visitsTime.fill(0);
    },
''' +s[b:]
p.write_text(s)
p=p.with_name('ornament-renderer.ts');s=p.read_text();s=s.replace("let birdControls = [1, 1, 1, 1];", "let birdControls: Record<string, number> = {};\n    let birdSampler: ((id: string, key: number) => number) | undefined;")
s=s.replace('birdControls = [frame.controls.birdSize, frame.controls.birdSpeed, frame.controls.birdOrbit, frame.controls.birdVisits];','birdControls = { ...frame.controls };')
s=s.replace('birds?.update(birdControls[0]!, birdControls[1]!, birdControls[2]!, birdControls[3]!);','birds?.update(birdControls, birdSampler);').replace('birds.update(birdControls[0]!, birdControls[1]!, birdControls[2]!, birdControls[3]!);','birds.update(birdControls, birdSampler);')
s=s.replace("label: 'Flight speed'", "label: 'Spiral travel speed'")
s=s.replace("group: 'Birds'", "group: 'Bird Flight'")
for name in ['birdSize','birdSpeed','birdOrbit','birdVisits']:
 lines=s.splitlines();s='\n'.join(line.replace('max: 2,','max: 8,').replace('max: 1,','max: 8,') if name+':' in line and 'type:' in line else line for line in lines)+'\n'
pos=s.index('      structuralActivity:')
s=s[:pos]+'''      birdPitch: { type: 'number', group: 'Bird Flight', label: 'Spiral length', default: 2.5, min: 0.15, max: 12, step: 0.01 },
      birdExcursionSpeed: { type: 'number', group: 'Bird Flight', label: 'Excursion speed', default: 1.5, min: 0, max: 8, step: 0.01 },
      birdSpecies: { type: 'number', group: 'Bird Appearance', label: 'Species rotation', default: 0, min: 0, max: 3, step: 1 },
      birdPalette: { type: 'number', group: 'Bird Appearance', label: 'Plumage palette', default: 0.03, min: 0, max: 1, step: 0.01 },
''' +s[pos:]
s=s.replace("'Flight, wingbeat and visit tempo relative to the painting clock.'", "'Forward spiral flight speed. Wingbeats and excursions have independent clocks.'")
s=s.replace("'Blend from uninterrupted ribbon flight to occasional landing and departure.'", "'Excursion frequency: zero disables visits; higher values visit more often.'")
p.write_text(s)
