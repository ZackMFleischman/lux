import type { EditorState } from '@codemirror/state';
import type { SourceBundle } from '../../../../packages/runtime-contracts/src/index.ts';
type BufferState = { state: EditorState; scrollTop: number; scrollLeft: number };
/** One bounded cache per workspace; no basename aliases or history shared between documents. */
export class EditorStateCache {
  private documentKey = -1;
  private files = new Map<string, BufferState>();
  reconcile(documentKey: number, source: SourceBundle) {
    if (documentKey !== this.documentKey) { this.documentKey = documentKey; this.files.clear(); }
    for (const [path, buffer] of this.files) if (source.files[path] !== buffer.state.doc.toString()) this.files.delete(path);
  }
  get(path: string, text: string) { const buffer = this.files.get(path); return buffer?.state.doc.toString() === text ? buffer : undefined; }
  set(documentKey: number, path: string, buffer: BufferState) { if (documentKey === this.documentKey) this.files.set(path, buffer); }
}
const caches = new WeakMap<object, EditorStateCache>();
export function editorCache(owner: object) { let cache = caches.get(owner); if (!cache) { cache = new EditorStateCache(); caches.set(owner, cache); } return cache; }
