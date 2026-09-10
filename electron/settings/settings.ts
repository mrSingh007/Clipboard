import Store from 'electron-store';

export type SettingsKey = 'monitoring' | 'shortcut' | 'maxItems' | 'launchAtLogin';

interface SettingsShape {
  monitoring: boolean;
  shortcut: string;
  maxItems: number;
  launchAtLogin: boolean;
}

export class Settings {
  private store: Store<SettingsShape>;
  constructor() {
    this.store = new Store<SettingsShape>({
      defaults: {
        monitoring: true,
        shortcut: 'CommandOrControl+Shift+V',
        maxItems: 1000,
        launchAtLogin: true,
      }
    });
  }

  get<K extends SettingsKey>(key: K): SettingsShape[K] {
    return this.store.get(key);
  }

  set(key: SettingsKey, value: unknown) {
    if (!this.isValidValue(key, value)) {
      throw new Error(`Invalid value for setting: ${key}`);
    }
    this.store.set(key, value as SettingsShape[SettingsKey]);
  }

  all(): SettingsShape {
    return this.store.store;
  }

  isKnownKey(key: unknown): key is SettingsKey {
    return key === 'monitoring' || key === 'shortcut' || key === 'maxItems' || key === 'launchAtLogin';
  }

  private isValidValue(key: SettingsKey, value: unknown): boolean {
    switch (key) {
      case 'monitoring':
      case 'launchAtLogin':
        return typeof value === 'boolean';
      case 'shortcut':
        return typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
      case 'maxItems':
        // Zero is the explicit "Unlimited" option exposed by the renderer.
        return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10000;
    }
  }
}
