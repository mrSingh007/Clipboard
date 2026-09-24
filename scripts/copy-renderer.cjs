const { copyFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
for (const file of ['index.html', 'style.css']) {
  copyFileSync(path.join(root, 'renderer', file), path.join(root, 'dist/renderer', file));
}
