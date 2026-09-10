import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getItems: () => ipcRenderer.invoke('clipboard:get-items'),
  search: (query: string) => ipcRenderer.invoke('clipboard:search', query),
  copyItem: (id: number) => ipcRenderer.invoke('clipboard:copy', id),
  deleteItem: (id: number) => ipcRenderer.invoke('clipboard:delete', id),
  clear: () => ipcRenderer.invoke('clipboard:clear'),
  pinItem: (id: number, pinned: boolean) => ipcRenderer.invoke('clipboard:pin', id, pinned),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  onFocusSearch: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('focus-search', listener);
    return () => ipcRenderer.removeListener('focus-search', listener);
  }
};

contextBridge.exposeInMainWorld('clipboardHistory', api);
