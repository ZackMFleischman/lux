import type { SourceBundle } from '../../../../packages/runtime-contracts/src/index.ts';
import { validateSource } from '../../../build-worker/src/source-policy.mjs';
import { equalSource as equal, changedAssets } from './source-equality.ts';

export type SourceSnapshot = Readonly<{
  source: SourceBundle; version: number; documentKey: number; dirty: boolean;
  selectedFile: string; openFiles: readonly string[]; busy: boolean;
  dirtyFiles: readonly string[]; dirtyAssets: readonly string[]; runningMatchesDraft: boolean; hasRunningSource: boolean;
  canUndoReplacement: boolean;
}>;
export interface SourceWorkspace {
  getSnapshot(): SourceSnapshot;
  subscribe(listener: () => void): () => void;
  edit(path: string, text: string): void;
  addFile(path: string, text: string): void;
  openFile(path: string): void;
  closeFile(path: string): void;
  markSaved(version: number): void;
  replaceDocument(source: SourceBundle): void;
  undoReplacement(): void;
  submit(source: SourceBundle, expectedVersion: number, activate: (source: SourceBundle) => Promise<void>): Promise<void>;
}
function admit(source: SourceBundle): SourceBundle {
  const admitted = validateSource(source) as SourceBundle;
  Object.freeze(admitted.files); return Object.freeze(admitted);
}
export function createSourceWorkspace(initial: SourceBundle): SourceWorkspace {
  let source = admit(initial), saved = source, running: SourceBundle | null = null, undo: SourceBundle | null = null;
  let version = 0, documentKey = 0, busy = false, selectedFile = source.entry, openFiles = [source.entry];
  const listeners = new Set<() => void>();
  function snapshot(): SourceSnapshot { return Object.freeze({ source, version, documentKey, busy, selectedFile,
    openFiles: Object.freeze([...openFiles]), dirty: !equal(saved, source),
    dirtyFiles: Object.freeze(Object.keys(source.files).filter(path => source.files[path] !== saved.files[path])),
    dirtyAssets: Object.freeze(changedAssets(saved, source)),
    runningMatchesDraft: equal(running, source), hasRunningSource: running !== null, canUndoReplacement: undo !== null }); }
  let current = snapshot();
  function publish() { current = snapshot(); for (const listener of listeners) listener(); }
  function editable() { if (busy) throw Error('Studio is busy'); }
  function exists(path: string) { if (!Object.hasOwn(source.files, path)) throw Error(`Source file does not exist: ${path}`); }
  function reconcile() {
    openFiles = openFiles.filter(path => Object.hasOwn(source.files, path));
    if (!Object.hasOwn(source.files, selectedFile)) selectedFile = source.entry;
    if (!openFiles.includes(selectedFile)) openFiles.push(selectedFile);
  }
  return {
    getSnapshot: () => current,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    edit(path, text) { editable(); exists(path); if (source.files[path] === text) return;
      source = admit({ ...source, files: { ...source.files, [path]: text } }); version++; publish(); },
    addFile(path, text) { editable(); if (Object.hasOwn(source.files, path)) throw Error('Source file already exists');
      source = admit({ ...source, files: { ...source.files, [path]: text } }); version++;
      selectedFile = path; openFiles.push(path); publish(); },
    openFile(path) { exists(path); selectedFile = path; if (!openFiles.includes(path)) openFiles.push(path); publish(); },
    closeFile(path) { openFiles = openFiles.filter(file => file !== path);
      if (selectedFile === path) selectedFile = openFiles.at(-1) ?? ''; publish(); },
    markSaved(atVersion) { if (atVersion !== version) return; saved = source; publish(); },
    replaceDocument(next) { editable(); source = admit(next); saved = source; undo = null; version++; documentKey++;
      selectedFile = source.entry; openFiles = [source.entry]; publish(); },
    undoReplacement() { editable(); if (!undo) return; source = undo; undo = null; version++; reconcile(); publish(); },
    async submit(next, expectedVersion, activate) {
      editable();
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== version) throw Error('Editor changed; read its source again before building');
      const admitted = admit(next);
      busy = true; publish();
      try {
        await activate(admitted);
        if (!equal(source, admitted)) undo = source;
        source = admitted; running = source; version++; reconcile();
      } finally { busy = false; publish(); }
    },
  };
}
