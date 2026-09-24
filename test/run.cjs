const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Run with Electron's Node ABI: better-sqlite3 is rebuilt for Electron by npm ci.
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'clipboard-history-test-'));
const env = { ...process.env, CLIPBOARD_TEST_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [path.join(__dirname, 'suite.cjs')], {
  env,
  stdio: 'inherit',
});
let timedOut = false;
const timeout = setTimeout(() => {
  timedOut = true;
  console.error('Tests timed out after 60 seconds.');
  child.kill();
}, 60_000);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('close', (code, signal) => {
  clearTimeout(timeout);
  fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  if (signal) console.error(`Electron tests terminated by ${signal}.`);
  process.exitCode = !timedOut && code === 0 ? 0 : 1;
});
