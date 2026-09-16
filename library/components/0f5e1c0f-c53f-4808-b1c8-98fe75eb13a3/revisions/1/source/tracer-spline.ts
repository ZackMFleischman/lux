// One interpolation rule for tracer ink and region carving.
export const tracerSplineWgsl = `
fn wtCatmull(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  let t2 = t * t;
  let t3 = t2 * t;
  return 0.5 * (2.0 * p1 + (-p0 + p2) * t
    + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
    + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3);
}

fn wtCatmullDerivative(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  let t2 = t * t;
  return 0.5 * ((-p0 + p2)
    + 2.0 * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t
    + 3.0 * (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t2);
}

fn wtCatmullSecondDerivative(
  p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  return 0.5 * (2.0 * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3)
    + 6.0 * (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t);
}

fn wtCatmullScalar(p0: f32, p1: f32, p2: f32, p3: f32, t: f32) -> f32 {
  let t2 = t * t;
  let t3 = t2 * t;
  return 0.5 * (2.0 * p1 + (-p0 + p2) * t
    + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
    + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3);
}

`;
