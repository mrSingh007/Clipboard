import { app, BrowserWindow, clipboard, ipcMain, Menu, Tray, nativeImage, globalShortcut } from 'electron';
import path from 'path';
import { ClipboardRepository } from './database/clipboard-repository';
import { Settings } from './settings/settings';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let monitorInterval: NodeJS.Timeout | null = null;
let lastText = '';
let isQuitting = false;
let registeredShortcut: string | null = null;
const settings = new Settings();
const repo = new ClipboardRepository();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // During development Vite serves the renderer at http://localhost:5173.
  // In production the main process is compiled to dist/main, alongside the
  // renderer output at dist/renderer.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // hide instead of close
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
 const iconPath = path.join(__dirname, '../assets/tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('Clipboard History');
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open History', click: showHistory },
    {
      id: 'monitorToggle',
      label: settings.get('monitoring') ? 'Pause Monitoring' : 'Resume Monitoring',
      click: toggleMonitoring,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
}

async function startMonitoring() {
  if (monitorInterval) return;
  // Treat the current clipboard as the baseline so pause/resume and relaunch do
  // not add the same item again merely because monitoring was restarted.
  lastText = await clipboard.readText();
  monitorInterval = setInterval(async () => {
    const text = await clipboard.readText();
    if (text && text !== lastText) {
      lastText = text;
      repo.addItem(text, settings.get('maxItems'));
    }
  }, 300);
  settings.set('monitoring', true);
  refreshTrayMenu();
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  settings.set('monitoring', false);
  refreshTrayMenu();
}

function toggleMonitoring() {
  if (monitorInterval) {
    stopMonitoring();
  } else {
    startMonitoring();
  }
  refreshTrayMenu();
}

function registerGlobalShortcut(shortcut = settings.get('shortcut')): boolean {
  const normalizedShortcut = shortcut.trim();
  if (registeredShortcut === normalizedShortcut) return true;

  let registered = false;
  try {
    registered = globalShortcut.register(normalizedShortcut, () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('focus-search');
      }
    });
  } catch {
    registered = false;
  }

  if (!registered) return false;
  if (registeredShortcut) globalShortcut.unregister(registeredShortcut);
  registeredShortcut = normalizedShortcut;
  return true;
}

function setLaunchAtLogin(enabled: boolean) {
  app.setLoginItemSettings({ openAtLogin: enabled });
}

/*
 * Register a shortcut before unregistering the previous one. An invalid or
 * already-taken shortcut therefore cannot leave the user without their
 * existing shortcut.
 */
function updateShortcut(shortcut: string) {
  if (!registerGlobalShortcut(shortcut)) {
    throw new Error('The shortcut is invalid or is already in use.');
  }
  settings.set('shortcut', shortcut.trim());
}

function showHistory() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('focus-search');
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  if (settings.get('monitoring')) startMonitoring();
  registerGlobalShortcut();
  setLaunchAtLogin(settings.get('launchAtLogin'));

  ipcMain.handle('clipboard:get-items', async () => {
    return repo.getAll();
  });

  ipcMain.handle('clipboard:search', async (_event, query: string) => {
    return repo.search(query);
  });

  ipcMain.handle('clipboard:copy', async (_event, id: number) => {
    const item = repo.getById(id);
    if (item) clipboard.writeText(item.content);
    return true;
  });

  ipcMain.handle('clipboard:delete', async (_event, id: number) => {
    repo.delete(id);
    return true;
  });

  ipcMain.handle('clipboard:clear', async () => {
    repo.clear();
    return true;
  });

  ipcMain.handle('clipboard:pin', async (_event, id: number, pinned: boolean) => {
    repo.pin(id, pinned);
    return true;
  });

  ipcMain.handle('window:hide', async () => {
    mainWindow?.hide();
    return true;
  });

  // Settings API
  ipcMain.handle('settings:get', async () => settings.all());
  ipcMain.handle('settings:set', async (_e, key: string, value: any) => {
    if (!settings.isKnownKey(key)) {
      throw new Error('Unknown setting key.');
    }
    if (key === 'shortcut') {
      if (typeof value !== 'string') throw new Error('Invalid value for setting: shortcut');
      updateShortcut(value);
    } else {
      settings.set(key, value);
      if (key === 'monitoring') {
        value ? startMonitoring() : stopMonitoring();
      } else if (key === 'launchAtLogin') {
        setLaunchAtLogin(value as boolean);
      }
    }
    return true;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  registeredShortcut = null;
});
