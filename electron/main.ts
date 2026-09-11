import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron';
import path from 'path';
import { history } from './database';
import { parseSetting, settings } from './settings';
import type { Settings } from '../shared/types';

// Two instances would both poll the clipboard and fight over the shortcut.
if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let monitor: NodeJS.Timeout | null = null;
let lastText = '';
let activeShortcut: string | null = null;
let quitting = false;

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Closing the window only hides it; the app keeps running in the tray.
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    hideWindow();
  });
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('window:focus-search');
}

function hideWindow() {
  mainWindow?.hide();
  // Hand focus back to the previous app so the copied text can be pasted immediately.
  if (process.platform === 'darwin') app.hide();
}

function send(channel: string, payload?: unknown) {
  mainWindow?.webContents.send(channel, payload);
}

// ---------------------------------------------------------------------------
// Clipboard monitoring
// ---------------------------------------------------------------------------

async function startMonitoring() {
  if (monitor) return;
  // Treat the current clipboard as already seen so (re)starting does not add it again.
  lastText = await clipboard.readText();
  let polling = false;
  monitor = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const text = await clipboard.readText();
      if (text && text !== lastText) {
        lastText = text;
        history.add(text, settings.get('maxItems'));
        send('history:changed');
      }
    } finally {
      polling = false;
    }
  }, 300);
}

function stopMonitoring() {
  if (monitor) clearInterval(monitor);
  monitor = null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function registerShortcut(accelerator: string): boolean {
  if (accelerator === activeShortcut) return true;
  let registered = false;
  try {
    registered = globalShortcut.register(accelerator, showWindow);
  } catch {
    registered = false;
  }
  if (!registered) return false;
  // Only drop the old shortcut once the new one works, so a bad value never leaves the user without one.
  if (activeShortcut) globalShortcut.unregister(activeShortcut);
  activeShortcut = accelerator;
  return true;
}

function setLaunchAtLogin(enabled: boolean) {
  // In development this would register the bare Electron binary as a login item.
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: enabled });
}

function applySettings(patch: Partial<Settings>) {
  if (patch.shortcut !== undefined && !registerShortcut(patch.shortcut)) {
    throw new Error('That shortcut is invalid or already in use by another app.');
  }
  if (patch.monitoring !== undefined) patch.monitoring ? void startMonitoring() : stopMonitoring();
  if (patch.launchAtLogin !== undefined) setLaunchAtLogin(patch.launchAtLogin);
  settings.set(patch);
  updateTrayMenu();
  send('settings:changed', settings.store);
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  // "Template" in the file name makes macOS recolour the icon for light/dark menu bars.
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets/trayTemplate.png'));
  tray = new Tray(icon);
  tray.setToolTip('Clipboard History');
  updateTrayMenu();
}

function updateTrayMenu() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open History', click: showWindow },
    {
      label: settings.get('monitoring') ? 'Pause Monitoring' : 'Resume Monitoring',
      click: () => applySettings({ monitoring: !settings.get('monitoring') }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

ipcMain.handle('history:get', () => history.all());
ipcMain.handle('history:copy', async (_event, id: number) => {
  const item = history.get(id);
  if (!item) throw new Error('That item no longer exists.');
  await clipboard.writeText(item.content);
});
ipcMain.handle('history:delete', (_event, id: number) => { history.remove(id); send('history:changed'); });
ipcMain.handle('history:clear', () => { history.clear(); send('history:changed'); });
ipcMain.handle('history:pin', (_event, id: number, pinned: boolean) => { history.pin(id, pinned); send('history:changed'); });
ipcMain.handle('settings:get', () => settings.store);
ipcMain.handle('settings:set', (_event, key: unknown, value: unknown) => applySettings(parseSetting(key, value)));
ipcMain.handle('window:hide', () => hideWindow());

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  // Packaged builds get the icon from the bundle; in development show it in the Dock too.
  if (!app.isPackaged) app.dock?.setIcon(nativeImage.createFromPath(path.join(app.getAppPath(), 'assets/icon.png')));
  createWindow();
  createTray();
  if (settings.get('monitoring')) void startMonitoring();
  if (!registerShortcut(settings.get('shortcut'))) {
    console.warn(`Could not register global shortcut "${settings.get('shortcut')}".`);
  }
  setLaunchAtLogin(settings.get('launchAtLogin'));
});

// Covers the tray menu, Cmd+Q, SIGTERM and system shutdown, so the close handler lets the window go.
app.on('before-quit', () => { quitting = true; });
app.on('second-instance', showWindow);
app.on('activate', showWindow);
app.on('window-all-closed', () => { /* keep running in the tray */ });
app.on('will-quit', () => globalShortcut.unregisterAll());
