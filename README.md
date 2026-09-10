# Clipboard History

A lightweight clipboard manager built with **Electron**, **React**, **Vite** and **TypeScript**.

## Features
- Continuously monitors the system clipboard (text only).
- Stores history in a local SQLite database (`clipboard.sqlite` in the app data folder).
- Global shortcut `Cmd+Shift+V` (configurable) opens a small searchable window.
- Tray icon with menu to open the history, pause monitoring and quit.
- Pin items, delete individual entries or clear the whole history.
- Settings persisted via `electron‑store`.

## Development
```bash
# install dependencies
npm install

# start the app in development mode (renderer via Vite, main process via Electron)
npm run dev
```

The renderer UI will be served by Vite at `http://localhost:5173`. The Electron main process loads that URL automatically.

## Building a production bundle (macOS)
```bash
npm run build   # creates a packaged app in the `dist` folder
```
The build uses `electron‑builder`; the generated `.app` can be distributed.

## Project structure
```
clipboard-history/
├─ electron/           # main process source
│   ├─ main.ts
│   ├─ database/      # SQLite handling
│   │   ├─ database.ts
│   │   └─ clipboard-repository.ts
│   └─ settings/       # persistent settings
│
├─ preload/           # context‑bridge exposing safe APIs
│   └─ preload.ts
│
├─ src/                # renderer (React) source
│   ├─ index.html
│   ├─ main.tsx
│   ├─ App.tsx
│   └─ App.css
│
├─ dist/               # build output (generated after `npm run build`)
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ README.md
```

## License
MIT
