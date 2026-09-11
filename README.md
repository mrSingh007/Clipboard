# Clipboard History

A lightweight clipboard manager for macOS built with **Electron** and **TypeScript**. No frameworks, no bundler.

## Features
- Monitors the system clipboard (text only) and stores history in a local SQLite database (`clipboard.sqlite` in the app data folder).
- Re-copying text you already have moves it to the top instead of adding a duplicate.
- Global shortcut `Cmd+Shift+V` opens a small searchable window; the window hides again after you pick an item and focus returns to the app you came from.
- Tray icon with menu to open the history, pause monitoring and quit.
- Pin items, delete individual entries or clear the whole history.
- Settings panel (⌘S) for monitoring, start at login, history size and the global shortcut, which you change by clicking it and pressing a new key combination. Persisted via `electron-store`.

## Development
```bash
npm install     # also rebuilds better-sqlite3 for Electron
npm start       # compile and launch the app
```

There is no dev server. `npm run build` runs `tsc` for the main process and the renderer and copies the static renderer files into `dist/`.

## Packaging (macOS)
```bash
npm run dist    # builds and packages with electron-builder into release/
```

## Project structure
```
clipboard-history/
├─ electron/            # main process (CommonJS, tsc → dist/main)
│   ├─ main.ts          # window, tray, clipboard monitor, IPC
│   ├─ preload.ts       # context bridge exposing window.clipboardHistory
│   ├─ database.ts      # SQLite access
│   └─ settings.ts      # electron-store wrapper + IPC validation
├─ renderer/            # UI (plain HTML/CSS/TS, tsc → dist/renderer)
│   ├─ index.html
│   ├─ style.css
│   └─ renderer.ts
├─ shared/types.d.ts    # types shared by main, preload and renderer
├─ assets/              # tray icons
└─ dist/                # build output
```

## License
MIT
