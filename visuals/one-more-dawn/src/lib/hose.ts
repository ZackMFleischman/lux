// Rubber-hose limb: a tube swept along a quadratic Bezier, rewritten in
// place every frame (no allocation). The classic bendy cartoon-robot arm.

import { BufferAttribute, BufferGeometry, Mesh, MeshBasicNodeMaterial, Object3D, Vector3 } from 'three/webgpu';

const RINGS = 18;
const SIDES = 10;

export class Hose {
  readonly geometry = new BufferGeometry();
  readonly mesh: Mesh;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  private readonly p = new Vector3();
  private readonly t = new Vector3();
  private readonly n = new Vector3();
  private readonly bn = new Vector3();
  private readonly prevT = new Vector3();
  private readonly tmp = new Vector3();

  constructor(material: MeshBasicNodeMaterial, parent: Object3D, private rStart: number, private rEnd: number) {
    const count = (RINGS + 1) * (SIDES + 1);
    this.positions = new Float32Array(count * 3);
    this.normals = new Float32Array(count * 3);
    const index: number[] = [];
    for (let i = 0; i < RINGS; i += 1) {
      for (let j = 0; j < SIDES; j += 1) {
        const a = i * (SIDES + 1) + j;
        const b = a + SIDES + 1;
        index.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    this.geometry.setIndex(index);
    const position = new BufferAttribute(this.positions, 3);
    const normal = new BufferAttribute(this.normals, 3);
    this.geometry.setAttribute('position', position);
    this.geometry.setAttribute('normal', normal);
    this.mesh = new Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }

  // start, bend control point and end, all in the parent's space.
  update(start: Vector3, bend: Vector3, end: Vector3): void {
    this.a.copy(start);
    this.b.copy(bend);
    this.c.copy(end);
    for (let i = 0; i <= RINGS; i += 1) {
      const u = i / RINGS;
      const k = 1 - u;
      this.p.set(0, 0, 0)
        .addScaledVector(this.a, k * k)
        .addScaledVector(this.b, 2 * k * u)
        .addScaledVector(this.c, u * u);
      this.t.copy(this.b).sub(this.a).multiplyScalar(2 * k)
        .addScaledVector(this.tmp.copy(this.c).sub(this.b), 2 * u);
      if (this.t.lengthSq() < 1e-10) {
        this.t.set(0, -1, 0);
      }
      this.t.normalize();
      if (i === 0) {
        // Any vector not parallel to the tangent starts the frame.
        this.n.set(0, 0, 1);
        if (Math.abs(this.t.z) > 0.9) {
          this.n.set(1, 0, 0);
        }
        this.n.sub(this.tmp.copy(this.t).multiplyScalar(this.n.dot(this.t))).normalize();
      } else {
        // Parallel transport: remove the tangent component.
        this.n.sub(this.tmp.copy(this.t).multiplyScalar(this.n.dot(this.t))).normalize();
      }
      this.bn.crossVectors(this.t, this.n);
      this.prevT.copy(this.t);
      // Slight bulge in the middle reads as soft rubber.
      const r = this.rStart + (this.rEnd - this.rStart) * u + Math.sin(u * Math.PI) * 0.06 * this.rStart;
      for (let j = 0; j <= SIDES; j += 1) {
        const ang = (j / SIDES) * Math.PI * 2;
        const cx = Math.cos(ang);
        const sy = Math.sin(ang);
        const nx = this.n.x * cx + this.bn.x * sy;
        const ny = this.n.y * cx + this.bn.y * sy;
        const nz = this.n.z * cx + this.bn.z * sy;
        const o = (i * (SIDES + 1) + j) * 3;
        this.positions[o] = this.p.x + nx * r;
        this.positions[o + 1] = this.p.y + ny * r;
        this.positions[o + 2] = this.p.z + nz * r;
        this.normals[o] = nx;
        this.normals[o + 1] = ny;
        this.normals[o + 2] = nz;
      }
    }
    (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('normal') as BufferAttribute).needsUpdate = true;
  }

  // Unit tangent at the end of the last update (for orienting hands/feet).
  endTangent(out: Vector3): Vector3 {
    return out.copy(this.c).sub(this.b).normalize();
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
