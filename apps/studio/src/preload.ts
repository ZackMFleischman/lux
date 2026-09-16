import { contextBridge, ipcRenderer } from 'electron';
import type { StudioWindowClient, WindowState } from './window-client.ts';
import type { StudioExportClient } from './export-client.ts';
import type { ComponentLibraryClient } from './library-client.ts';
import type { LookClient } from './look-client.ts';
import type { PreviewCaptureClient } from './preview-capture-client.ts';
const lookApi: LookClient = {
  list: () => ipcRenderer.invoke('studio:looks', 'list'),
  read: id => ipcRenderer.invoke('studio:looks', 'read', id),
  save: input => ipcRenderer.invoke('studio:looks', 'save', input),
};
contextBridge.exposeInMainWorld('luxLooks', Object.freeze(lookApi));

const api: StudioWindowClient = {
  getState: () => ipcRenderer.invoke('studio:window', 'state'),
  popout: () => ipcRenderer.invoke('studio:window', 'popout'),
  dock: () => ipcRenderer.invoke('studio:window', 'dock'),
  fullscreen: value => ipcRenderer.invoke('studio:window', 'fullscreen', value),
  subscribe: listener => {
    const callback = (_event: Electron.IpcRendererEvent, state: WindowState) => listener(state);
    ipcRenderer.on('studio:window-state', callback);
    return () => ipcRenderer.removeListener('studio:window-state', callback);
  },
};
contextBridge.exposeInMainWorld('luxStudioWindows', Object.freeze(api));
const exportApi: StudioExportClient = { create: request => ipcRenderer.invoke('studio:export', request),
  ...(process.argv.includes('--lux-no-export') ? { unavailableReason: 'Resolume export is not included in this desktop build.' } : {}) };
contextBridge.exposeInMainWorld('luxExport', Object.freeze(exportApi));
contextBridge.exposeInMainWorld('luxConfirmation', Object.freeze({
  onCloseRequest: (listener: (id: string) => void) => {
    const callback = (_event: Electron.IpcRendererEvent, id: string) => listener(id);
    ipcRenderer.on('studio:close-request', callback);
    return () => ipcRenderer.removeListener('studio:close-request', callback);
  },
  reply: (id: string, discard: boolean) => ipcRenderer.invoke('studio:authoring', 'close-confirmation', { id, discard }),
}));
contextBridge.exposeInMainWorld('luxAuthoring', Object.freeze({
  example: () => ipcRenderer.invoke('studio:authoring', 'example'),
  compile: (source: unknown) => ipcRenderer.invoke('studio:authoring', 'compile', source),
  smokeResult: (result: unknown) => ipcRenderer.invoke('studio:authoring', 'smoke-result', result),
  smokeEnabled: () => ipcRenderer.invoke('studio:authoring', 'smoke-enabled'),
  open: () => ipcRenderer.invoke('studio:authoring', 'open'),
  save: (request: unknown) => ipcRenderer.invoke('studio:authoring', 'save', request),
  savePath: (request: unknown) => ipcRenderer.invoke('studio:authoring', 'save-path', request),
  openPath: (path: string) => ipcRenderer.invoke('studio:authoring', 'open-path', path),
  dirty: (value: boolean) => ipcRenderer.invoke('studio:authoring', 'dirty', value),
  smokeSave: (document: unknown) => ipcRenderer.invoke('studio:authoring', 'smoke-save', document),
  onAgentCommand: (listener: (command: unknown) => Promise<unknown>) => {
    const callback = (_event: Electron.IpcRendererEvent, command: { id: string }) => {
      void Promise.resolve().then(() => listener(command)).then(result => ipcRenderer.invoke('studio:agent-result', command.id, { ok: true, result }),
        error => ipcRenderer.invoke('studio:agent-result', command.id, { ok: false, error: String(error?.message || error) }));
    };
    ipcRenderer.on('studio:agent-command', callback);
    void ipcRenderer.invoke('studio:agent-ready');
    return () => ipcRenderer.removeListener('studio:agent-command', callback);
  },
}));
const libraryApi:ComponentLibraryClient={
  location:()=>ipcRenderer.invoke('studio:library','location'),
  list:()=>ipcRenderer.invoke('studio:library','list'),
  read:(id,revision)=>ipcRenderer.invoke('studio:library','read',{id,revision}),
  create:input=>ipcRenderer.invoke('studio:library','create',input),
  update:input=>ipcRenderer.invoke('studio:library','update',input),
  copyRequest:id=>ipcRenderer.invoke('studio:library','copy-request',id),
};
contextBridge.exposeInMainWorld('luxLibrary',Object.freeze(libraryApi));
const previewCaptureApi: PreviewCaptureClient = {
  saveFrame: bytes => ipcRenderer.invoke('studio:capture', 'save-frame', bytes),
  beginVideo: settings => ipcRenderer.invoke('studio:capture', 'begin-video', settings),
  appendVideo: (id, bytes) => ipcRenderer.invoke('studio:capture', 'append-video', { id, bytes }),
  finishVideo: (id, durationMs) => ipcRenderer.invoke('studio:capture', 'finish-video', { id, durationMs }),
  cancelVideo: id => ipcRenderer.invoke('studio:capture', 'cancel-video', id),
};
contextBridge.exposeInMainWorld('luxPreviewCapture', Object.freeze(previewCaptureApi));
