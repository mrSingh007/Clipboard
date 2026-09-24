const assert = require('node:assert/strict');
const path = require('node:path');
const { app } = require('electron');

// Set paths before importing modules, so no real history or settings are touched.
assert.ok(process.env.CLIPBOARD_TEST_USER_DATA, 'Start tests through test/run.cjs');
app.setPath('userData', process.env.CLIPBOARD_TEST_USER_DATA);
app.setPath('sessionData', process.env.CLIPBOARD_TEST_USER_DATA);

app.whenReady().then(() => {
  const { parseSetting, settings } = require('../dist/main/settings.js');
  const { history } = require('../dist/main/database.js');
  let passed = 0;
  let failed = 0;
  const realNow = Date.now;
  let time = 1_700_000_000_000;
  Date.now = () => time++;

  function test(name, run) {
    try {
      for (const item of history.all()) history.remove(item.id);
      run();
      passed++;
      console.log(`PASS ${name}`);
    } catch (error) {
      failed++;
      console.error(`FAIL ${name}`, error);
    }
  }

  test('settings defaults and files are isolated', () => {
    assert.equal(path.dirname(settings.path), process.env.CLIPBOARD_TEST_USER_DATA);
    assert.deepEqual({ ...settings.store }, {
      monitoring: true, shortcut: 'CommandOrControl+Shift+V', maxItems: 1000, launchAtLogin: true,
    });
  });
  test('valid settings include unlimited history and normalize shortcut whitespace', () => {
    for (const key of ['monitoring', 'launchAtLogin']) {
      for (const value of [true, false]) assert.deepEqual(parseSetting(key, value), { [key]: value });
    }
    for (const value of [0, 1, 10000]) assert.deepEqual(parseSetting('maxItems', value), { maxItems: value });
    assert.deepEqual(parseSetting('shortcut', '  Control+Shift+V  '), { shortcut: 'Control+Shift+V' });
  });
  test('invalid IPC settings are rejected', () => {
    for (const value of [-1, 10001, 1.5, NaN, Infinity, '10', null, undefined]) {
      assert.throws(() => parseSetting('maxItems', value), /Invalid setting/);
    }
    for (const key of ['monitoring', 'launchAtLogin']) {
      for (const value of [0, 1, 'true', null]) assert.throws(() => parseSetting(key, value), /Invalid setting/);
    }
    for (const value of ['', '  ', false, 12, null]) assert.throws(() => parseSetting('shortcut', value), /Invalid setting/);
    for (const key of ['unknown', '__proto__', undefined, null]) assert.throws(() => parseSetting(key, true), /Invalid setting/);
  });
  test('history preserves text and deduplicates by moving existing items to the top', () => {
    const content = "Hello 🌍\n'quoted' text";
    history.add(content, 10);
    const original = history.all()[0];
    history.add('second', 10);
    history.add(content, 10);
    assert.deepEqual(history.all().map(item => item.content), [content, 'second']);
    assert.equal(history.all()[0].id, original.id);
    assert.ok(history.all()[0].created_at > original.created_at);
    assert.deepEqual(history.get(original.id), history.all()[0]);
  });
  test('equal timestamps sort deterministically by newest insertion', () => {
    const advancingNow = Date.now;
    try {
      Date.now = () => 42;
      history.add('first', 0);
      history.add('second', 0);
      assert.deepEqual(history.all().map(item => item.content), ['second', 'first']);
    } finally { Date.now = advancingNow; }
  });
  test('pruning retains pinned items outside the unpinned limit', () => {
    history.add('pinned', 2);
    const pinned = history.all()[0].id;
    history.pin(pinned, true);
    for (const text of ['old', 'middle', 'new']) history.add(text, 2);
    assert.deepEqual(history.all().map(item => item.content), ['new', 'middle', 'pinned']);
    history.add('pinned', 2);
    assert.equal(history.get(pinned).pinned, 1);
    assert.equal(history.all().length, 3);
    history.pin(pinned, false);
    history.add('latest', 2);
    assert.deepEqual(history.all().map(item => item.content), ['latest', 'pinned']);
  });
  test('unlimited history retains all entries and a new limit prunes on add', () => {
    for (let i = 0; i < 25; i++) history.add(`entry ${i}`, 0);
    assert.equal(history.all().length, 25);
    history.add('entry 0', 2);
    assert.deepEqual(history.all().map(item => item.content), ['entry 0', 'entry 24']);
  });
  test('clear preserves pinned history and explicit deletion removes it', () => {
    history.add('keep', 10);
    const id = history.all()[0].id;
    history.pin(id, true);
    history.add('remove', 10);
    history.clear();
    assert.deepEqual(history.all().map(item => item.content), ['keep']);
    history.remove(id);
    assert.equal(history.get(id), undefined);
    assert.deepEqual(history.all(), []);
  });
  test('history is persisted to the SQLite file', () => {
    history.add('persisted', 10);
    const Database = require('better-sqlite3');
    const connection = new Database(path.join(app.getPath('userData'), 'clipboard.sqlite'), { readonly: true });
    try {
      assert.equal(connection.prepare('SELECT content FROM clipboard_items').get().content, 'persisted');
    } finally { connection.close(); }
  });
  Date.now = realNow;
  console.log(`\n${passed} passed; ${failed} failed`);
  app.exit(failed ? 1 : 0);
}).catch(error => {
  console.error(error);
  app.exit(1);
});
