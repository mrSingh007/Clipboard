# Clipboard History App — Implementation Plan

## 1. Goal

Build a lightweight desktop app that runs in the background by default and automatically keeps a local history of copied **text**.

Primary target: macOS first.

Core flow:

```text
User copies text
      ↓
Background clipboard monitor
      ↓
Detect changed text
      ↓
Save to local SQLite database
      ↓
History UI
      ↓
Search / select / copy old item
```

The app should start automatically and remain active in the background without requiring the user to manually open it.

---

## 2. Recommended technology

### Use Electron + TypeScript

For this project, Electron is the fastest/easiest implementation if we want to stay entirely in the JavaScript/TypeScript ecosystem.

Recommended stack:

- **Electron** — desktop application/runtime
- **TypeScript** — application code
- **React** — history/search UI
- **Vite** — fast development/build tooling
- **SQLite** — local persistent storage
- **electron-store** — simple application settings
- **Electron Tray** — background/system-tray integration

Avoid adding unnecessary frameworks or services.

### Why Electron

The first version is primarily:

1. monitor clipboard
2. store text
3. display history
4. copy selected history item

Electron provides everything needed without requiring a separate native-language implementation.

Tauri could produce a smaller application, but Electron is the simpler choice for getting an MVP working quickly.

---

## 3. Application behavior

The application is **active by default**.

After installation:

1. App launches.
2. App starts clipboard monitoring automatically.
3. App runs in the background.
4. A tray/menu-bar icon indicates that it is running.
5. The main history window can be opened using a keyboard shortcut.
6. No account or internet connection is required.

The user should not have to click "Start monitoring."

---

## 4. MVP features

### Clipboard monitoring

Monitor the system clipboard continuously.

When the clipboard contains new text:

- detect the change
- read the text
- save it
- record timestamp
- ignore the event if it is identical to the immediately previous item

Only text is required for v1.

Do not implement image/file clipboard history initially.

### History

Display copied items newest first.

Each item should show:

- copied text
- timestamp
- optional character count

Long text should be truncated visually but remain completely stored.

### Search

Provide instant local search.

Example:

```text
Search clipboard...
```

Searching should work across the stored text.

### Copy from history

Selecting an item and pressing Enter/clicking it should place that text back into the system clipboard.

### Delete

Allow deletion of an individual history item.

### Clear history

Provide an action to clear all stored clipboard history.

Add a confirmation step.

### Pin

Allow frequently used items to be pinned.

Pinned items should remain available even when applying normal history cleanup.

---

## 5. Background behavior

The application should have two states:

### Main window

Used to:

- search
- browse history
- copy an old item
- delete/pin items
- change settings

### Background mode

When the main window is closed:

- do NOT quit the application
- continue monitoring the clipboard
- keep the tray/menu-bar item active

The user must explicitly choose **Quit** from the tray/menu-bar menu to stop the application.

---

## 6. Start automatically

Enable launch-at-login by default.

On macOS this means the app should be configured as a login item.

Recommended setting:

```text
Start Clipboard History at Login: ON
```

The user can disable this later.

The first-run experience should make this behavior clear.

---

## 7. Global keyboard shortcut

Add a global shortcut to open/focus the history window.

Example:

```text
Cmd + Shift + V
```

When pressed:

- bring the history window to the front
- focus the search box
- allow immediate keyboard navigation

If the shortcut is already used by another application, provide a setting to change it.

---

## 8. Keyboard-first UI

The application should be usable without a mouse.

Suggested behavior:

```text
Cmd + Shift + V
        ↓
Search box focused
        ↓
Type search
        ↓
Arrow Up / Down
        ↓
Enter = copy selected item
        ↓
Escape = hide window
```

This should be a priority because clipboard managers are naturally keyboard-driven tools.

---

## 9. Database

Use SQLite for persistent clipboard history.

Suggested table:

```sql
CREATE TABLE clipboard_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0
);
```

Add indexes appropriate for search/order once needed.

Keep the database entirely local.

Suggested database location:

```text
Electron app data directory / clipboard.sqlite
```

Do not send clipboard contents to a server.

---

## 10. Duplicate handling

For MVP:

- if newly copied text equals the most recent stored item, don't create another record
- if an older item is copied again, create a new history event or move the existing item to the top

Recommended initial behavior:

**Move existing identical content to the top rather than creating unlimited duplicates.**

This keeps the history cleaner.

---

## 11. History retention

Add a configurable maximum history size.

Default:

```text
1000 items
```

Possible settings:

```text
100
500
1000
5000
Unlimited
```

When the limit is reached:

- delete the oldest unpinned entries first
- never automatically delete pinned items

This prevents the database from growing indefinitely.

---

## 12. Privacy

Clipboard contents can contain sensitive information.

The app should be designed as local-only.

Important rules:

- no cloud synchronization in v1
- no analytics containing clipboard contents
- no network request containing clipboard contents
- database stored locally
- clearly explain that copied text is being recorded

Add an optional exclusion feature later for sensitive applications.

For example:

```text
Ignore clipboard while using:
- Password manager
- Banking apps
- Other selected applications
```

This does not need to be part of the first MVP.

---

## 13. UI structure

Keep the first UI extremely simple.

```text
┌──────────────────────────────────────┐
│ Search clipboard...                  │
├──────────────────────────────────────┤
│ Today                                │
│                                      │
│ npm install electron                 │
│ 20:41                                │
│                                      │
│ https://example.com/something        │
│ 20:38                                │
│                                      │
│ Meeting notes from today...          │
│ 19:55                         📌      │
│                                      │
└──────────────────────────────────────┘
```

No complex dashboard.

The core interaction should be:

**open → search → select → paste**

---

## 14. Electron architecture

Use Electron's process separation correctly.

### Main process

Responsible for:

- application lifecycle
- clipboard monitoring
- SQLite access
- tray/menu-bar
- global shortcuts
- settings
- window management

### Renderer process

Responsible for:

- React UI
- search
- history list
- keyboard interaction
- settings UI

### Preload

Expose only the required API from main to renderer.

Example conceptual API:

```ts
clipboardHistory.getItems()
clipboardHistory.search(query)
clipboardHistory.copyItem(id)
clipboardHistory.deleteItem(id)
clipboardHistory.pinItem(id)
clipboardHistory.clear()
settings.get()
settings.update()
```

Do not expose unrestricted Node.js APIs to the renderer.

---

## 15. Clipboard monitoring implementation

Do not rely on the browser Clipboard API for continuous monitoring.

The Electron main process should periodically check the system clipboard.

Conceptually:

```text
setInterval(...)
    ↓
read clipboard text
    ↓
compare with last known value
    ↓
if changed:
    save to SQLite
```

Use a sensible polling interval, such as roughly 250–500 ms initially.

During implementation, test CPU usage and adjust the interval if necessary.

Only process text clipboard contents.

---

## 16. Window behavior

The history window should behave like a utility window.

Requirements:

- fast opening
- fast hiding
- stays available in background
- closing window does not quit app
- optionally remember window position
- focus search automatically when opened

The app should feel almost instantaneous.

---

## 17. Tray/menu-bar menu

Provide:

```text
Clipboard History
-----------------
Open History
Pause Monitoring
-----------------
Settings
Clear History
-----------------
Quit
```

Because the app is active by default, **Pause Monitoring** should be available without quitting the application.

---

## 18. Settings

Initial settings:

```text
General
[x] Start at login
[x] Start monitoring automatically

History
Maximum items: 1000
[ ] Unlimited

Shortcut
Open history: Cmd + Shift + V

Privacy
[ ] Pause monitoring
```

Keep settings minimal in v1.

---

## 19. Development phases

### Phase 1 — Project setup

Create:

- Electron
- TypeScript
- React
- Vite
- basic Electron window

Verify:

```text
npm run dev
```

opens the desktop application.

### Phase 2 — Clipboard monitor

Implement:

- clipboard polling
- text detection
- duplicate detection
- event handling

Verify that copied text is detected while the app is in the background.

### Phase 3 — SQLite

Implement:

- database initialization
- insert
- list
- delete
- pin
- clear
- history limit

Verify data survives application restart.

### Phase 4 — History UI

Implement:

- history list
- timestamps
- search
- selected item
- copy item
- delete
- pin

### Phase 5 — Background/tray

Implement:

- tray/menu-bar icon
- hide window instead of quitting
- open history action
- pause monitoring
- quit action

### Phase 6 — Global shortcut

Implement:

```text
Cmd + Shift + V
```

Open/focus the history window.

### Phase 7 — Launch at login

Enable automatic startup by default.

Test after:

- reboot
- logout/login
- application restart

### Phase 8 — Polish

Add:

- empty state
- loading/error handling
- confirmation for clear
- settings
- keyboard navigation
- performance improvements
- database cleanup
- app icon

### Phase 9 — Packaging

Build a macOS installer/application.

Test:

- clean installation
- launch at login
- clipboard monitoring
- app restart
- database persistence
- uninstall/reinstall

---

## 20. Testing checklist

### Clipboard

- [ ] Copy plain text
- [ ] Copy multiline text
- [ ] Copy very long text
- [ ] Copy the same text repeatedly
- [ ] Copy text from different applications
- [ ] Copy while the history window is closed
- [ ] Copy while the computer is idle

### History

- [ ] Newest items appear first
- [ ] Search works
- [ ] Selecting an item copies it
- [ ] Delete works
- [ ] Pin works
- [ ] Clear works
- [ ] History survives restart
- [ ] Maximum history size works

### Background

- [ ] App starts automatically
- [ ] App continues after window closes
- [ ] Tray/menu-bar menu works
- [ ] Pause works
- [ ] Quit actually stops monitoring

### Shortcut

- [ ] Global shortcut works when another app is focused
- [ ] Search receives focus
- [ ] Enter copies selected item
- [ ] Escape hides window

---

## 21. Things NOT to build in v1

To keep implementation fast, avoid:

- cloud sync
- user accounts
- mobile apps
- image history
- file history
- AI features
- OCR
- browser extensions
- password-manager integration
- cross-device synchronization
- complicated themes
- collaboration/sharing
- remote database

These can be considered after the basic clipboard manager is stable.

---

## 22. Future features

After MVP:

1. **Ignore sensitive applications**
2. **Clipboard item types**
   - text
   - URL
   - code
   - image
3. **Favorites/categories**
4. **Better fuzzy search**
5. **Import/export**
6. **Encryption**
7. **Optional cloud sync**
8. **Windows/Linux support**
9. **Quick paste menu**
10. **Automatic cleanup by age**

---

## 23. Definition of done for MVP

The MVP is complete when:

> After installing the app, it automatically starts in the background, detects copied text, stores it locally, and lets the user press `Cmd + Shift + V` to search and reuse anything previously copied.

The application should work without an account or internet connection.

The most important qualities are:

1. **Fast**
2. **Reliable**
3. **Low resource usage**
4. **Keyboard-first**
5. **Local/private**
6. **Invisible while running**
7. **Active by default**

---

## 24. Suggested project structure

```text
clipboard-history/
├── electron/
│   ├── main.ts
│   ├── clipboard/
│   │   └── monitor.ts
│   ├── database/
│   │   ├── database.ts
│   │   └── clipboard-repository.ts
│   ├── tray/
│   │   └── tray.ts
│   ├── shortcuts/
│   │   └── shortcuts.ts
│   └── settings/
│       └── settings.ts
│
├── src/
│   ├── components/
│   │   ├── SearchBar.tsx
│   │   ├── ClipboardList.tsx
│   │   ├── ClipboardItem.tsx
│   │   └── Settings.tsx
│   ├── App.tsx
│   └── main.tsx
│
├── preload/
│   └── preload.ts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 25. Implementation priority

Build in this order:

```text
1. Electron app
       ↓
2. Clipboard monitoring
       ↓
3. SQLite persistence
       ↓
4. Basic history UI
       ↓
5. Search + copy
       ↓
6. Background/tray
       ↓
7. Global shortcut
       ↓
8. Auto-start
       ↓
9. Settings
       ↓
10. Packaging/testing
```

Do not start with UI polish.

The first milestone should be:

**"I can run the app, copy text anywhere, restart the app, and see my previous copied text."**

Once that works reliably, build the rest around it.
