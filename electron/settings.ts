import Store from 'electron-store';
import { nativeTheme } from 'electron';
import type { Settings, Theme } from '../shared/types';

function getSystemTheme(): Theme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

export const settings = new Store<Settings>({
  defaults: {
    monitoring: true,
    shortcut: 'CommandOrControl+Shift+V',
    maxItems: 1000,
    launchAtLogin: true,
    theme: getSystemTheme(),
  },
});

/**
 * Validates a key/value pair received over IPC and returns it as a settings
 * patch. Throws when the key is unknown or the value has the wrong shape.
 */
export function parseSetting(key: unknown, value: unknown): Partial<Settings> {
  switch (key) {
    case 'monitoring':
      if (typeof value === 'boolean') return { monitoring: value };
      break;
    case 'launchAtLogin':
      if (typeof value === 'boolean') return { launchAtLogin: value };
      break;
    case 'shortcut':
      if (typeof value === 'string' && value.trim()) return { shortcut: value.trim() };
      break;
    case 'maxItems':
      // Zero means "unlimited".
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10000) {
        return { maxItems: value };
      }
      break;
    case 'theme':
      if (value === 'light' || value === 'dark') return { theme: value };
      break;
  }
  throw new Error(`Invalid setting: ${String(key)}`);
}
