import type { HistoryItem, Settings } from '../shared/types';

const api = window.clipboardHistory;
const isMac = navigator.userAgent.includes('Mac');

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const ui = {
  search: element<HTMLInputElement>('search'),
  clearSearch: element<HTMLButtonElement>('clear-search'),
  settingsToggle: element<HTMLButtonElement>('settings-toggle'),
  clearAll: element<HTMLButtonElement>('clear-all'),
  error: element<HTMLDivElement>('error'),
  errorText: element<HTMLSpanElement>('error-text'),
  dismissError: element<HTMLButtonElement>('dismiss-error'),
  settingsPanel: element<HTMLElement>('settings-panel'),
  closeSettings: element<HTMLButtonElement>('close-settings'),
  monitoring: element<HTMLInputElement>('setting-monitoring'),
  launchAtLogin: element<HTMLInputElement>('setting-launch-at-login'),
  maxItems: element<HTMLSelectElement>('setting-max-items'),
  shortcut: element<HTMLButtonElement>('setting-shortcut'),
  list: element<HTMLUListElement>('list'),
  empty: element<HTMLDivElement>('empty'),
  emptyText: element<HTMLParagraphElement>('empty-text'),
  emptyClearSearch: element<HTMLButtonElement>('empty-clear-search'),
  footerShortcut: element<HTMLElement>('footer-shortcut'),
  footerSettingsKey: element<HTMLElement>('footer-settings-key'),
  itemTemplate: element<HTMLTemplateElement>('item-template'),
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let items: HistoryItem[] = [];
let visible: HistoryItem[] = [];
let selected = -1;
let loaded = false;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const PREVIEW_LENGTH = 500;

function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const KEY_SYMBOLS: Record<string, string> = {
  commandorcontrol: isMac ? '⌘' : 'Ctrl',
  cmdorctrl: isMac ? '⌘' : 'Ctrl',
  command: '⌘',
  cmd: '⌘',
  control: isMac ? '⌃' : 'Ctrl',
  ctrl: isMac ? '⌃' : 'Ctrl',
  alt: isMac ? '⌥' : 'Alt',
  option: '⌥',
  shift: isMac ? '⇧' : 'Shift',
  super: isMac ? '⌘' : 'Win',
};

function formatShortcut(accelerator: string) {
  return accelerator
    .split('+')
    .map((part) => part.trim())
    .map((part) => KEY_SYMBOLS[part.toLowerCase()] ?? part.toUpperCase())
    .join(isMac ? '' : '+');
}

function preview(content: string) {
  // Strip zero-width characters and keep the DOM light for very large entries.
  return content.replace(/[\u200B-\u200D\uFEFF]/g, '').slice(0, PREVIEW_LENGTH);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function showError(message: string) {
  ui.errorText.textContent = message;
  ui.error.hidden = false;
}

function hideError() {
  ui.error.hidden = true;
}

async function attempt(action: () => Promise<unknown>, failureMessage: string) {
  try {
    await action();
    hideError();
  } catch {
    showError(failureMessage);
  }
}

// ---------------------------------------------------------------------------
// History list
// ---------------------------------------------------------------------------

function renderItem(item: HistoryItem): HTMLLIElement {
  const li = (ui.itemTemplate.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLLIElement;
  li.id = `item-${item.id}`;
  li.dataset.id = String(item.id);
  li.classList.toggle('pinned', item.pinned === 1);
  li.setAttribute('aria-label', `Clipboard item from ${formatTime(item.created_at)}. ${item.content.length} characters.${item.pinned ? ' Pinned.' : ''}`);

  li.querySelector('.item-content')!.textContent = preview(item.content);

  const time = li.querySelector<HTMLTimeElement>('.item-time')!;
  time.textContent = formatTime(item.created_at);
  time.dateTime = new Date(item.created_at).toISOString();

  li.querySelector('.item-chars')!.textContent = `${item.content.length} chars`;

  const pin = li.querySelector<HTMLButtonElement>('.pin-button')!;
  pin.classList.toggle('pinned', item.pinned === 1);
  pin.setAttribute('aria-label', item.pinned ? 'Unpin item' : 'Pin item');
  pin.setAttribute('aria-pressed', String(item.pinned === 1));
  return li;
}

function renderList() {
  const query = ui.search.value.trim().toLowerCase();
  visible = query ? items.filter((item) => item.content.toLowerCase().includes(query)) : items;

  ui.list.replaceChildren(...visible.map(renderItem));
  ui.clearAll.disabled = !items.some((item) => item.pinned === 0);
  ui.clearSearch.hidden = !ui.search.value;

  ui.empty.hidden = !loaded || visible.length > 0;
  ui.emptyText.textContent = query ? 'No matching clipboard items.' : 'Your clipboard history is empty.';
  ui.emptyClearSearch.hidden = !query;

  select(Math.min(selected, visible.length - 1));
}

function select(index: number) {
  selected = index;
  for (const [i, li] of Array.from(ui.list.children).entries()) {
    const isSelected = i === selected;
    li.classList.toggle('selected', isSelected);
    li.setAttribute('aria-selected', String(isSelected));
    if (isSelected) li.scrollIntoView({ block: 'nearest' });
  }
  if (selected >= 0) {
    ui.search.setAttribute('aria-activedescendant', `item-${visible[selected].id}`);
  } else {
    ui.search.removeAttribute('aria-activedescendant');
  }
}

async function loadItems() {
  try {
    items = await api.getItems();
    loaded = true;
    hideError();
  } catch {
    showError('Could not load clipboard history.');
  }
  renderList();
}

function copyItem(id: number) {
  return attempt(async () => {
    await api.copyItem(id);
    await api.hideWindow();
  }, 'Could not copy that clipboard item.');
}

function clearSearch() {
  ui.search.value = '';
  selected = -1;
  renderList();
  ui.search.focus();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

let currentShortcut = '';

function renderSettings(settings: Settings) {
  ui.monitoring.checked = settings.monitoring;
  ui.launchAtLogin.checked = settings.launchAtLogin;
  ui.maxItems.value = String(settings.maxItems);
  currentShortcut = settings.shortcut;
  stopRecordingShortcut();
  ui.footerShortcut.textContent = formatShortcut(settings.shortcut);
}

function startRecordingShortcut() {
  ui.shortcut.classList.add('recording');
  ui.shortcut.textContent = 'Press keys…';
}

function stopRecordingShortcut() {
  ui.shortcut.classList.remove('recording');
  ui.shortcut.textContent = formatShortcut(currentShortcut);
}

/** Turns a keydown into an Electron accelerator such as "Command+Shift+V", or null if it is not usable. */
function acceleratorFromEvent(event: KeyboardEvent): string | null {
  const modifiers: string[] = [];
  if (event.metaKey) modifiers.push(isMac ? 'Command' : 'Super');
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');

  let key: string | null = null;
  const { code } = event;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
  else if (code === 'Space') key = 'Space';
  else if (code.startsWith('Arrow')) key = code.slice(5);
  else if (['Enter', 'Backspace', 'Delete', 'Tab', 'Home', 'End', 'PageUp', 'PageDown'].includes(code)) key = code === 'Enter' ? 'Return' : code;
  else if (event.key.length === 1 && !/\s/.test(event.key)) key = event.key;
  if (!key) return null;

  // A global shortcut without a modifier would swallow ordinary typing; function keys are the exception.
  if (modifiers.length === 0 && !key.startsWith('F')) return null;
  return [...modifiers, key].join('+');
}

function toggleSettings(open = ui.settingsPanel.hidden) {
  ui.settingsPanel.hidden = !open;
  ui.settingsToggle.setAttribute('aria-expanded', String(open));
  ui.settingsToggle.setAttribute('aria-label', open ? 'Hide settings' : 'Show settings');
}

async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K], failureMessage = 'Could not save that setting.') {
  try {
    await api.setSetting(key, value);
    hideError();
  } catch {
    showError(failureMessage);
    // Put the control back to the value the main process still has.
    api.getSettings().then(renderSettings).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

ui.search.addEventListener('input', () => {
  selected = -1;
  renderList();
});
ui.clearSearch.addEventListener('click', clearSearch);
ui.emptyClearSearch.addEventListener('click', clearSearch);
ui.dismissError.addEventListener('click', hideError);
ui.settingsToggle.addEventListener('click', () => toggleSettings());
ui.closeSettings.addEventListener('click', () => toggleSettings(false));

ui.clearAll.addEventListener('click', () => {
  if (!window.confirm('Clear clipboard history? Pinned items are kept. This cannot be undone.')) return;
  void attempt(() => api.clearItems(), 'Could not clear clipboard history.');
});

ui.list.addEventListener('click', (event) => {
  const li = (event.target as HTMLElement).closest<HTMLLIElement>('li[data-id]');
  if (!li) return;
  const id = Number(li.dataset.id);
  const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
  if (action === 'pin') {
    const pinned = li.classList.contains('pinned');
    void attempt(() => api.pinItem(id, !pinned), 'Could not update the pinned item.');
  } else if (action === 'delete') {
    void attempt(() => api.deleteItem(id), 'Could not delete that clipboard item.');
  } else {
    void copyItem(id);
  }
});

ui.list.addEventListener('mouseover', (event) => {
  const li = (event.target as HTMLElement).closest<HTMLLIElement>('li[data-id]');
  if (!li) return;
  const index = Array.prototype.indexOf.call(ui.list.children, li);
  if (index !== selected) select(index);
});

ui.shortcut.addEventListener('click', startRecordingShortcut);
ui.shortcut.addEventListener('blur', stopRecordingShortcut);
ui.shortcut.addEventListener('keydown', (event) => {
  if (!ui.shortcut.classList.contains('recording')) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Escape') {
    stopRecordingShortcut();
    return;
  }
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return; // wait for the actual key
  const accelerator = acceleratorFromEvent(event);
  if (!accelerator) {
    showError('Use at least one modifier key (⌘, ⌃, ⌥ or ⇧) with a letter, number or function key.');
    return;
  }
  stopRecordingShortcut();
  if (accelerator !== currentShortcut) {
    void saveSetting('shortcut', accelerator, 'That shortcut could not be registered. It is probably already used by another app.');
  }
});

ui.monitoring.addEventListener('change', () => void saveSetting('monitoring', ui.monitoring.checked));
ui.launchAtLogin.addEventListener('change', () => void saveSetting('launchAtLogin', ui.launchAtLogin.checked));
ui.maxItems.addEventListener('change', () => void saveSetting('maxItems', Number(ui.maxItems.value)));

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  // Let native controls in the settings panel keep their own keyboard handling.
  const inControl = target instanceof HTMLSelectElement || target instanceof HTMLButtonElement
    || (target instanceof HTMLInputElement && target.type === 'checkbox');

  if (event.key === 'Escape') {
    event.preventDefault();
    if (!ui.settingsPanel.hidden) toggleSettings(false);
    else if (ui.search.value) clearSearch();
    else void api.hideWindow();
  } else if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    toggleSettings();
  } else if (inControl) {
    return;
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    select(Math.min(selected + 1, visible.length - 1));
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    select(Math.max(selected - 1, -1));
  } else if (event.key === 'Enter' && selected >= 0) {
    event.preventDefault();
    void copyItem(visible[selected].id);
  }
});

api.onItemsChanged(() => void loadItems());
api.onSettingsChanged(renderSettings);
api.onFocusSearch(() => {
  ui.search.focus();
  ui.search.select();
});

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

ui.footerSettingsKey.textContent = isMac ? '⌘S' : 'Ctrl+S';
void loadItems();
api.getSettings().then(renderSettings).catch(() => showError('Could not load settings.'));
