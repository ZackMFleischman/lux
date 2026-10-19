// Second render of the same scene for the ink pass: every visible mesh
// writes its view-space normal (rg) and a line ID (b). The ink component
// draws a line wherever the ID changes (silhouettes, overlaps, part seams)
// or the normal folds sharply (creases), at a fixed pixel width.
//
// IDs 1..127 belong to the set (thin coloured lines). IDs 129..248 belong
// to up to eight performer groups of 15 IDs each: lines between groups (or
// against the set) are full-weight silhouettes, lines inside one group are
// thinner interior seams. Neighbouring parts only need different IDs, so
// IDs are assigned round-robin with a stride.

import { InstancedMesh, Material, Mesh, MeshBasicNodeMaterial, Object3D } from 'three/webgpu';
import { float, instanceIndex, normalize, transformedNormalView, vec4 } from 'three/tsl';

export type LineClass = 'figure' | 'set' | 'none';

interface Entry {
  mesh: Mesh;
  color: Material | Material[];
  data: MeshBasicNodeMaterial | null;
  visible: boolean;
}

export class InkBuffer {
  private readonly entries: Entry[] = [];
  private readonly made: MeshBasicNodeMaterial[] = [];
  private figureCounter = 0;
  private setCounter = 0;
  private groups = 0;
  private group = 0;

  // Registers every mesh below root. A mesh can override its class with
  // `mesh.userData.line = 'figure' | 'set' | 'none'`; meshes registered
  // under an earlier root are skipped.
  register(root: Object3D, cls: LineClass, newGroup = true): void {
    if (cls === 'figure' && newGroup) {
      this.group = Math.min(7, this.groups);
      this.groups += 1;
    }
    const seen = new Set(this.entries.map(e => e.mesh));
    root.traverse(object => {
      const mesh = object as Mesh;
      if (!mesh.isMesh || seen.has(mesh)) {
        return;
      }
      const here: LineClass = (mesh.userData.line as LineClass | undefined) ?? inherited(mesh, cls);
      const color = mesh.material;
      const instanced = (mesh as InstancedMesh).isInstancedMesh === true;
      const data = here === 'none' ? null : this.material(this.nextId(here, instanced), color as Material, instanced);
      this.entries.push({ mesh, color, data, visible: true });
    });
  }

  private nextId(cls: LineClass, instanced = false): number {
    if (cls === 'figure') {
      this.figureCounter += 1;
      return 129 + this.group * 15 + ((this.figureCounter * 7) % 15);
    }
    this.setCounter += 1;
    // Instanced set meshes add up to 13 per instance, so keep their base low.
    return instanced ? 1 + ((this.setCounter * 29) % 110) : 1 + ((this.setCounter * 29) % 127);
  }

  private material(id: number, source: Material, instanced = false): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial({ side: source.side });
    const from = source as MeshBasicNodeMaterial;
    if (from.positionNode) {
      material.positionNode = from.positionNode;
    }
    if (from.opacityNode) {
      material.opacityNode = from.opacityNode;
      material.alphaTest = from.alphaTest;
    }
    const n = normalize(transformedNormalView);
    // Instances get their own IDs so neighbours in one InstancedMesh still
    // get a line between them.
    const idNode = instanced ? float(id).add(instanceIndex.toFloat().mul(7).mod(13)).div(255) : float(id / 255);
    material.colorNode = vec4(n.xy.mul(0.5).add(0.5), idNode, 1);
    material.toneMapped = false;
    this.made.push(material);
    return material;
  }

  // Swap to the data materials; transparent and unlined meshes are hidden.
  toData(): void {
    for (const e of this.entries) {
      e.visible = e.mesh.visible;
      if (e.data) {
        e.mesh.material = e.data;
      } else {
        e.mesh.visible = false;
      }
    }
  }

  toColor(): void {
    for (const e of this.entries) {
      e.mesh.material = e.color;
      e.mesh.visible = e.visible;
    }
  }

  dispose(): void {
    for (const m of this.made) {
      m.dispose();
    }
  }
}

function inherited(mesh: Object3D, fallback: LineClass): LineClass {
  let p: Object3D | null = mesh.parent;
  while (p) {
    const cls = p.userData.line as LineClass | undefined;
    if (cls) {
      return cls;
    }
    p = p.parent;
  }
  return fallback;
}
