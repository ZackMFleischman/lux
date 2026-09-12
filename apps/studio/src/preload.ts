import { contextBridge, ipcRenderer } from 'electron';
import type { StudioWindowClient, WindowState } from './window-client.ts';

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
contextBridge.exposeInMainWorld('luxAuthoring', Object.freeze({
  example: () => ipcRenderer.invoke('studio:authoring', 'example'),
  compile: (source: unknown) => ipcRenderer.invoke('studio:authoring', 'compile', source),
  smokeResult: (result: unknown) => ipcRenderer.invoke('studio:authoring', 'smoke-result', result),
  smokeEnabled: () => ipcRenderer.invoke('studio:authoring', 'smoke-enabled'),
}));
