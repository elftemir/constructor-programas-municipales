// Run with Electron's Node mode; exercises its actual Node/V8 and N-API ABI.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const { fork } = require('child_process');
const executable = process.argv[3] || require('electron');
const runtime = process.argv[2] || path.resolve(__dirname, '../resources/ocr-runtime');
const { generate } = require('./generate_ocr_fixtures'); const fixture = generate();
const child = fork(path.join(runtime, 'ocrProcess.js'), [], { execPath: executable,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: '', NODE_OPTIONS: '' }, windowsHide: true, silent: true });
child.stderr.on('data', data => process.stderr.write(data)); child.stdout.resume();
let result = null;
child.on('message', message => { if (message.type === 'result') result = message.data; if (message.type === 'error') console.error(message); });
child.on('exit', code => { try { assert.equal(code, 0); assert.equal(result?.summary.ocr, 2);
  assert(result.pages[0].text.includes('oficina municipal')); console.log('PASS OCR under Electron', require('electron/package.json').version, result.summary); }
  catch (error) { console.error(error); process.exitCode = 1; } });
child.send({ buffer: fs.readFileSync(path.join(fixture.dir, 'ocr-scanned.pdf')), mode: 'ocr', language: 'both',
  workers: 1, cache: path.resolve(__dirname, '../scratch/electron-ocr-cache') });
