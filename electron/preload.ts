import { contextBridge, ipcRenderer } from 'electron';
import type { ClipboardHistoryApi } from '../shared/types';

function subscribe<T>(channel: string, callback: (payload: T) => void) {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => { ipcRenderer.removeListener(channel, listener); };
}

const api: ClipboardHistoryApi = {
  getItems: () => ipcRenderer.invoke('history:get'),
  copyItem: (id) => ipcRenderer.invoke('history:copy', id),
  deleteItem: (id) => ipcRenderer.invoke('history:delete', id),
  clearItems: () => ipcRenderer.invoke('history:clear'),
  pinItem: (id, pinned) => ipcRenderer.invoke('history:pin', id, pinned),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  onItemsChanged: (callback) => subscribe('history:changed', callback),
  onSettingsChanged: (callback) => subscribe('settings:changed', callback),
  onFocusSearch: (callback) => subscribe('window:focus-search', callback),
};

contextBridge.exposeInMainWorld('clipboardHistory', api);
