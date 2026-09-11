import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import type { HistoryItem } from '../shared/types';

const db = new Database(path.join(app.getPath('userData'), 'clipboard.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS clipboard_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0
  )
`);

const sql = {
  all: db.prepare('SELECT * FROM clipboard_items ORDER BY created_at DESC, id DESC'),
  byId: db.prepare('SELECT * FROM clipboard_items WHERE id = ?'),
  touch: db.prepare('UPDATE clipboard_items SET created_at = ? WHERE content = ?'),
  insert: db.prepare('INSERT INTO clipboard_items (content, created_at) VALUES (?, ?)'),
  // Deletes every unpinned item beyond the newest `limit` unpinned ones.
  prune: db.prepare(`
    DELETE FROM clipboard_items WHERE id IN (
      SELECT id FROM clipboard_items WHERE pinned = 0
      ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?
    )
  `),
  remove: db.prepare('DELETE FROM clipboard_items WHERE id = ?'),
  // Pinned items survive "clear all".
  clear: db.prepare('DELETE FROM clipboard_items WHERE pinned = 0'),
  pin: db.prepare('UPDATE clipboard_items SET pinned = ? WHERE id = ?'),
};

export const history = {
  /**
   * Records a clipboard value. Text that is already in the history is moved to
   * the top instead of being stored twice. Pinned items never count towards
   * `maxItems`; a limit of zero means unlimited.
   */
  add: db.transaction((content: string, maxItems: number) => {
    const now = Date.now();
    if (sql.touch.run(now, content).changes === 0) sql.insert.run(content, now);
    if (maxItems > 0) sql.prune.run(maxItems);
  }),

  all: () => sql.all.all() as HistoryItem[],
  get: (id: number) => sql.byId.get(id) as HistoryItem | undefined,
  remove: (id: number) => { sql.remove.run(id); },
  clear: () => { sql.clear.run(); },
  pin: (id: number, pinned: boolean) => { sql.pin.run(pinned ? 1 : 0, id); },
};
