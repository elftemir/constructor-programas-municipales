// Build time only. Runtime OCR never downloads anything.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const root = path.resolve(__dirname, '..'); const dest = path.join(root, 'resources/ocr-runtime');
const revision = '87416418657359cb625c412a48b6e1d6d41c29bd';
const languages = {
  'spa.traineddata': '6f2e04d02774a18f01bed44b1111f2cd7f3ba7ac9dc4373cd3f898a40ea6b464',
  'cat.traineddata': '250db73cd5b380d2798581295dc12f20d0828cdb335a65d833d12dfdbf57117d',
  LICENSE: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'
};
const coreHashes = {
  'tesseract-core-lstm.js': '6510efc4e8b45c5465df30679b9911ffe0071cd2ee982fa064e6f5136ef2de85',
  'tesseract-core-lstm.wasm': '66b17df6e20c5329a17ffa9c202a47eaa3e32500b253d4c7f38e7f2bc01457c3',
  'tesseract-core-simd-lstm.js': 'e48e2f02ddae3716c8dd24bf41cd290d4efa96892d689cdc4013c2545d63f469',
  'tesseract-core-simd-lstm.wasm': '34e8d50cac216427d86bf397d610fdd9f49492539bbcdfbfccc4eda20c810bea',
  'tesseract-core-relaxedsimd-lstm.js': 'a37ac78b707e8d5d3d2e532cc3c4e69b04d127ea44a608f1e7de17640402aa5c',
  'tesseract-core-relaxedsimd-lstm.wasm': '7985c92d4c64e7267d24cadffe1b2a1da6bf8aa55fdcaf953fe94fe122a24545'
};
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const copied = new Map();
function copyPackage(name, from = root, optional = false) {
  if (copied.has(name)) return;
  let source;
  try { source = path.dirname(require.resolve(name + '/package.json', { paths: [from] })); }
  catch (error) { if (optional) return; throw error; }
  const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  const target = path.join(dest, 'node_modules', name); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true }); copied.set(name, { version: pkg.version, license: pkg.license || null });
  for (const dep of Object.keys(pkg.dependencies || {})) copyPackage(dep, source);
  for (const dep of Object.keys(pkg.optionalDependencies || {})) copyPackage(dep, source, true);
}
async function main() {
  fs.mkdirSync(path.join(dest, 'languages'), { recursive: true });
  for (const [file, expected] of Object.entries(languages)) {
    const target = path.join(dest, 'languages', file);
    if (fs.existsSync(target) && hash(fs.readFileSync(target)) === expected) continue;
    const staged = path.join(root, 'scratch/ocr-download', file);
    let buffer;
    if (fs.existsSync(staged) && hash(fs.readFileSync(staged)) === expected) buffer = fs.readFileSync(staged);
    else { const response = await fetch('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/' + revision + '/' + file);
      if (!response.ok) throw Error('Download failed: ' + response.status); buffer = Buffer.from(await response.arrayBuffer()); }
    if (hash(buffer) !== expected) throw Error('SHA256 mismatch: ' + file);
    fs.writeFileSync(target, buffer);
  }
  for (const [name, version] of Object.entries({ 'tesseract.js': '7.0.0', 'tesseract.js-core': '7.0.0',
    'pdfjs-dist': '6.4.299', '@napi-rs/canvas': '1.0.11' })) {
    copyPackage(name);
    if (copied.get(name).version !== version) throw Error('Unexpected version: ' + name);
  }
  const core = path.join(dest, 'node_modules/tesseract.js-core');
  for (const [file, expected] of Object.entries(coreHashes)) {
    if (hash(fs.readFileSync(path.join(core, file))) !== expected) throw Error('Core SHA256 mismatch: ' + file);
  }
  // OEM=LSTM_ONLY only: retain all three CPU variants; embedded wasm.js copies and legacy cores are not used.
  for (const file of fs.readdirSync(core)) {
    if (/^tesseract-core/.test(file) && !Object.hasOwn(coreHashes, file)) fs.unlinkSync(path.join(core, file));
  }
  for (const file of ['ocrProcess.js', 'blockOcrNetwork.js', 'tesseractLocalWorker.js']) {
    fs.copyFileSync(path.join(root, 'src/main/services/importer', file), path.join(dest, file));
  }
  const licenseDir = path.join(root, 'resources/ocr-licenses');
  if (!fs.existsSync(licenseDir)) throw Error('Missing OCR license notices');
  fs.cpSync(licenseDir, path.join(dest, 'licenses'), { recursive: true });
  fs.copyFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(dest, 'licenses/THIRD_PARTY_NOTICES.md'));
  const files = {};
  function scan(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, item.name); if (item.isDirectory()) scan(target);
    else if (item.name !== 'manifest.json') files[path.relative(dest, target).replaceAll('\\', '/')] = hash(fs.readFileSync(target));
  } }
  scan(dest);
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({ revision, packages: Object.fromEntries(copied), files }, null, 2));
  console.log('OCR runtime verified, files:', Object.keys(files).length);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
