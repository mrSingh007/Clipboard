import db from './database';

export interface ClipboardItem {
  id: number;
  content: string;
  created_at: number;
  pinned: number;
}

export class ClipboardRepository {
  /**
   * Stores a clipboard entry while keeping the history bounded. Pinned entries
   * are intentionally excluded from the retention limit.
   */
  addItem(content: string, maxItems: number): void {
    const limit = Math.max(0, Math.floor(maxItems));

    db.transaction(() => {
      const latest = db.prepare(
        'SELECT content FROM clipboard_items ORDER BY created_at DESC, id DESC LIMIT 1',
      ).get() as Pick<ClipboardItem, 'content'> | undefined;

      // A monitor restart should not produce a second copy of the current
      // clipboard value when it is already the newest history entry.
      if (latest?.content === content) return;

      db.prepare('INSERT INTO clipboard_items (content, created_at) VALUES (?, ?)')
        .run(content, Date.now());

      // A zero limit represents the user's "Unlimited" setting. Otherwise,
      // delete every unpinned item after the newest `limit` entries.
      if (limit > 0) {
        db.prepare(`
          DELETE FROM clipboard_items
          WHERE id IN (
            SELECT id FROM clipboard_items
            WHERE pinned = 0
            ORDER BY created_at DESC, id DESC
            LIMIT -1 OFFSET ?
          )
        `).run(limit);
      }
    })();
  }

  getAll(): ClipboardItem[] {
    const stmt = db.prepare('SELECT * FROM clipboard_items ORDER BY created_at DESC');
    return stmt.all() as ClipboardItem[];
  }

  search(query: string): ClipboardItem[] {
    const stmt = db.prepare('SELECT * FROM clipboard_items WHERE content LIKE ? ORDER BY created_at DESC');
    return stmt.all(`%${query}%`) as ClipboardItem[];
  }

  getById(id: number): ClipboardItem | undefined {
    const stmt = db.prepare('SELECT * FROM clipboard_items WHERE id = ?');
    return stmt.get(id) as ClipboardItem | undefined;
  }

  delete(id: number) {
    const stmt = db.prepare('DELETE FROM clipboard_items WHERE id = ?');
    stmt.run(id);
  }

  clear() {
    const stmt = db.prepare('DELETE FROM clipboard_items');
    stmt.run();
  }

  pin(id: number, pinned: boolean) {
    const stmt = db.prepare('UPDATE clipboard_items SET pinned = ? WHERE id = ?');
    stmt.run(pinned ? 1 : 0, id);
  }
}
