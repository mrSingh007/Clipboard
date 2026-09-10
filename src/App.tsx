import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

interface ClipboardItem {
  id: number;
  content: string;
  created_at: number;
  pinned: 0 | 1;
}

interface AppSettings {
  monitoring: boolean;
  shortcut: string;
  maxItems: number;
  launchAtLogin: boolean;
}

const App: React.FC = () => {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const loadItems = useCallback(async () => {
    try {
      const result = await window.clipboardHistory.getItems();
      setItems(result);
      setError(null);
    } catch {
      setError('Could not load clipboard history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    void loadItems();
    const interval = window.setInterval(() => void loadItems(), 2000);
    return () => window.clearInterval(interval);
  }, [loadItems]);

  useEffect(() => {
    window.clipboardHistory.getSettings()
      .then((result) => setSettings(result as AppSettings))
      .catch(() => setError('Could not load settings.'));
  }, []);

  useEffect(() => {
    const focusSearch = () => {
      searchInput.current?.focus();
      searchInput.current?.select();
    };
    return window.clipboardHistory.onFocusSearch(focusSearch);
  }, []);

  const filtered = useMemo(
    () => items.filter((item) => item.content.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  // Keep selection in bounds
  useEffect(() => {
    setSelectedIndex((index) => Math.min(index, filtered.length - 1));
  }, [filtered.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filtered.length]);

  const copyItem = useCallback(async (id: number) => {
    try {
      await window.clipboardHistory.copyItem(id);
      setError(null);
      await window.clipboardHistory.hideWindow();
    } catch {
      setError('Could not copy that clipboard item.');
    }
  }, []);

  const deleteItem = async (id: number) => {
    try {
      await window.clipboardHistory.deleteItem(id);
      await loadItems();
    } catch {
      setError('Could not delete that clipboard item.');
    }
  };

  const clearItems = async () => {
    if (!window.confirm('Clear all clipboard history? This cannot be undone.')) return;

    try {
      await window.clipboardHistory.clear();
      setSelectedIndex(-1);
      await loadItems();
    } catch {
      setError('Could not clear clipboard history.');
    }
  };

  const togglePin = async (id: number, pinned: boolean) => {
    try {
      await window.clipboardHistory.pinItem(id, !pinned);
      await loadItems();
    } catch {
      setError('Could not update the pinned item.');
    }
  };

  const updateSetting = async <K extends keyof AppSettings,>(key: K, value: AppSettings[K]) => {
    try {
      await window.clipboardHistory.setSetting(key, value);
      setSettings((current) => current ? { ...current, [key]: value } : current);
      setError(null);
    } catch {
      setError('Could not save that setting.');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter' && selectedIndex >= 0) {
      event.preventDefault();
      void copyItem(filtered[selectedIndex].id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (search) {
        setSearch('');
        setSelectedIndex(-1);
      } else {
        void window.clipboardHistory.hideWindow();
      }
    } else if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setShowSettings((prev) => !prev);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatShortcut = (shortcut: string) => {
    return shortcut
      .split('+')
      .map((part) => part.trim())
      .map((part) => {
        const lower = part.toLowerCase();
        if (lower === 'cmd' || lower === 'command') return '⌘';
        if (lower === 'ctrl' || lower === 'control') return '⌃';
        if (lower === 'alt' || lower === 'option') return '⌥';
        if (lower === 'shift') return '⇧';
        return part.toUpperCase();
      })
      .join(' + ');
  };

  const getContentPreview = (content: string) => {
    // Remove zero-width characters and normalize
    return content.replace(/[\u200B-\u200D\uFEFF]/g, '');
  };

  return (
    <main className="app" onKeyDown={handleKeyDown} role="application">
      <header className="toolbar">
        <div className="search-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInput}
            id="search"
            placeholder="Search clipboard..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedIndex(-1);
            }}
            autoFocus
            aria-label="Search clipboard history"
            aria-autocomplete="list"
            aria-controls="clipboard-list"
            aria-activedescendant={selectedIndex >= 0 ? `clipboard-item-${filtered[selectedIndex]?.id}` : undefined}
          />
          {search && (
            <button
              className="clear-search"
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedIndex(-1);
                searchInput.current?.focus();
              }}
              aria-label="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          <button
            className="icon-button settings-toggle"
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            aria-label={showSettings ? 'Hide settings' : 'Show settings'}
            aria-expanded={showSettings}
            aria-controls="settings-panel"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            className="icon-button clear-button"
            type="button"
            onClick={() => void clearItems()}
            disabled={!items.length}
            aria-label="Clear all clipboard history"
            aria-disabled={!items.length}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </header>

      {error && (
        <div className="error-toast" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showSettings && settings && (
        <section id="settings-panel" className="settings-panel" role="region" aria-label="Settings">
          <div className="settings-header">
            <h2>Settings</h2>
            <button
              className="icon-button"
              type="button"
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="settings-content">
            <div className="settings-section">
              <h3>General</h3>
              <label className="setting-row">
                <span>Monitor clipboard</span>
                <input
                  type="checkbox"
                  checked={settings.monitoring}
                  onChange={(event) => void updateSetting('monitoring', event.target.checked)}
                />
              </label>
              <label className="setting-row">
                <span>Start at login</span>
                <input
                  type="checkbox"
                  checked={settings.launchAtLogin}
                  onChange={(event) => void updateSetting('launchAtLogin', event.target.checked)}
                />
              </label>
            </div>
            <div className="settings-section">
              <h3>History</h3>
              <label className="setting-row">
                <span>Maximum unpinned items</span>
                <select
                  value={settings.maxItems}
                  onChange={(event) => void updateSetting('maxItems', Number(event.target.value))}
                >
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={5000}>5,000</option>
                  <option value={0}>Unlimited</option>
                </select>
              </label>
            </div>
            <div className="settings-section">
              <h3>Shortcut</h3>
              <label className="setting-row shortcut-setting">
                <span>Open history</span>
                <div className="shortcut-display">
                  <kbd>{formatShortcut(settings.shortcut)}</kbd>
                  <span className="shortcut-hint">(Change in system settings)</span>
                </div>
              </label>
            </div>
          </div>
        </section>
      )}

      <ul
        ref={listRef}
        id="clipboard-list"
        className="list"
        aria-label="Clipboard history"
        role="listbox"
      >
        {isLoading ? (
          <li className="loading-state" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true"></div>
            <span>Loading clipboard history…</span>
          </li>
        ) : filtered.map((item, index) => (
          <li
            key={item.id}
            id={`clipboard-item-${item.id}`}
            className={`list-item${index === selectedIndex ? ' selected' : ''}${item.pinned ? ' pinned' : ''}`}
            onClick={() => void copyItem(item.id)}
            onMouseEnter={() => setSelectedIndex(index)}
            role="option"
            aria-selected={index === selectedIndex}
            aria-label={`Clipboard item from ${formatTime(item.created_at)}. ${item.content.length} characters. ${item.pinned ? 'Pinned.' : ''}`}
          >
            <div className="item-content" title={getContentPreview(item.content)}>
              {getContentPreview(item.content)}
            </div>
            <div className="item-meta">
              <time className="item-time" dateTime={new Date(item.created_at).toISOString()}>
                {formatTime(item.created_at)}
              </time>
              <span className="item-chars">{item.content.length} chars</span>
              <div className="item-actions">
                <button
                  type="button"
                  className={`action-button pin-button${item.pinned ? ' pinned' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void togglePin(item.id, Boolean(item.pinned));
                  }}
                  aria-label={item.pinned ? 'Unpin item' : 'Pin item'}
                  aria-pressed={item.pinned}
                >
                  <svg viewBox="0 0 24 24" fill={item.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 17v5M9 12H3v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1h-6M9 8V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="action-button delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteItem(item.id);
                  }}
                  aria-label="Delete item"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!isLoading && !filtered.length && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <p>{search ? 'No matching clipboard items.' : 'Your clipboard history is empty.'}</p>
          {search && (
            <button className="clear-search-link" type="button" onClick={() => { setSearch(''); setSelectedIndex(-1); searchInput.current?.focus(); }}>
              Clear search
            </button>
          )}
        </div>
      )}

      <footer className="footer">
        <kbd className="shortcut-hint">⌘⇧V</kbd> to open · <kbd>↑↓</kbd> navigate · <kbd>⏎</kbd> copy · <kbd>Esc</kbd> close · <kbd>⌘S</kbd> settings
      </footer>
    </main>
  );
};

export default App;
