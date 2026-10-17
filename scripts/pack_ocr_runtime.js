// electron-builder excludes nested node_modules when copying extraResources.
// Copy the verified standalone runtime after packaging, then verify every byte.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
module.exports = async context => {
  const root = context.packager.projectDir; const source = path.join(root, 'resources/ocr-runtime');
  const output = path.resolve(context.appOutDir);
  if (!output.startsWith(path.resolve(root, 'dist') + path.sep)) throw Error('Unexpected build output path');
  const target = path.join(output, 'resources/ocr-runtime');
  fs.cpSync(source, target, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json')));
  for (const [file, expected] of Object.entries(manifest.files)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(target, file))).digest('hex');
    if (actual !== expected) throw Error('Packaged OCR integrity mismatch: ' + file);
  }
  console.log('Verified packaged OCR runtime:', Object.keys(manifest.files).length, 'files');
  const {assertArchiveHasNoTestContent,assertResourcesHaveNoTestContent}=require('./auditar_contenido_empaquetado');
  assertArchiveHasNoTestContent(path.join(output,'resources/app.asar'));
  assertResourcesHaveNoTestContent(path.join(output,'resources'));
};
