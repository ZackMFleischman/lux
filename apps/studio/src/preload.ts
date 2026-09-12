import { contextBridge, ipcRenderer } from 'electron';
import type { StudioWindowClient, WindowState } from './window-client.ts';
import type { StudioExportClient } from './export-client.ts';

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
const exportApi: StudioExportClient = { create: request => ipcRenderer.invoke('studio:export', request) };
contextBridge.exposeInMainWorld('luxExport', Object.freeze(exportApi));
contextBridge.exposeInMainWorld('luxAuthoring', Object.freeze({
  example: () => ipcRenderer.invoke('studio:authoring', 'example'),
  compile: (source: unknown) => ipcRenderer.invoke('studio:authoring', 'compile', source),
  smokeResult: (result: unknown) => ipcRenderer.invoke('studio:authoring', 'smoke-result', result),
  smokeEnabled: () => ipcRenderer.invoke('studio:authoring', 'smoke-enabled'),
  open: () => ipcRenderer.invoke('studio:authoring', 'open'),
  save: (request: unknown) => ipcRenderer.invoke('studio:authoring', 'save', request),
  dirty: (value: boolean) => ipcRenderer.invoke('studio:authoring', 'dirty', value),
  smokeSave: (document: unknown) => ipcRenderer.invoke('studio:authoring', 'smoke-save', document),
  onAgentCommand: (listener: (command: unknown) => Promise<unknown>) => {
    const callback = (_event: Electron.IpcRendererEvent, command: { id: string }) => {
      void Promise.resolve().then(() => listener(command)).then(result => ipcRenderer.invoke('studio:agent-result', command.id, { ok: true, result }),
        error => ipcRenderer.invoke('studio:agent-result', command.id, { ok: false, error: String(error?.message || error) }));
    };
    ipcRenderer.on('studio:agent-command', callback);
    return () => ipcRenderer.removeListener('studio:agent-command', callback);
  },
}));
