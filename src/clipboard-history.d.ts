interface ClipboardHistoryApi {
  getItems(): Promise<ClipboardItem[]>;
  search(query: string): Promise<ClipboardItem[]>;
  copyItem(id: number): Promise<boolean>;
  deleteItem(id: number): Promise<boolean>;
  clear(): Promise<boolean>;
  pinItem(id: number, pinned: boolean): Promise<boolean>;
  getSettings(): Promise<Record<string, unknown>>;
  setSetting(key: string, value: unknown): Promise<boolean>;
  hideWindow(): Promise<void>;
  onFocusSearch(callback: () => void): () => void;
}

declare global {
  interface ClipboardItem {
    id: number;
    content: string;
    created_at: number;
    pinned: number;
  }

  interface Window {
    clipboardHistory: ClipboardHistoryApi;
  }
}

export {};
