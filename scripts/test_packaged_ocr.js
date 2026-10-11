const path = require('path'); const fs = require('fs'); const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..'); const app = path.join(root, 'dist/win-unpacked');
const fixture = require('./generate_ocr_fixtures').generate();
const profile = fs.mkdtempSync(path.join(root, 'scratch/packaged-profile-'));
const result = spawnSync(path.join(app, 'Constructor de Programas Municipales Podemos.exe'), [
  path.join(__dirname, 'probe_packaged_ocr.js'), path.join(app, 'resources'), path.join(fixture.dir, 'ocr-scanned.pdf')
], { windowsHide: true, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', APPDATA: profile,
  LOCALAPPDATA: profile, NODE_PATH: '', NODE_OPTIONS: '' }, timeout: 120000 });
if (result.error) console.error(result.error.message);
process.exitCode = result.status || (result.error ? 1 : 0);
