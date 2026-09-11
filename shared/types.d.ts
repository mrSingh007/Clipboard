// Types shared by the main process, the preload script and the renderer.
// This is a declaration file so it can be imported from both tsconfig projects
// without being compiled into either output directory.

export interface HistoryItem {
  id: number;
  content: string;
  created_at: number;
  pinned: 0 | 1;
}

export interface Settings {
  monitoring: boolean;
  shortcut: string;
  maxItems: number;
  launchAtLogin: boolean;
}

/** The API the preload script exposes to the renderer as `window.clipboardHistory`. */
export interface ClipboardHistoryApi {
  getItems(): Promise<HistoryItem[]>;
  copyItem(id: number): Promise<void>;
  deleteItem(id: number): Promise<void>;
  clearItems(): Promise<void>;
  pinItem(id: number, pinned: boolean): Promise<void>;
  getSettings(): Promise<Settings>;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
  hideWindow(): Promise<void>;
  onItemsChanged(callback: () => void): () => void;
  onSettingsChanged(callback: (settings: Settings) => void): () => void;
  onFocusSearch(callback: () => void): () => void;
}

declare global {
  interface Window {
    clipboardHistory: ClipboardHistoryApi;
  }
}
