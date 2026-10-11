// Run only after build, tests and packaged-runtime verification have passed.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const JSZip = require('jszip');
const root = path.resolve(__dirname, '..'); const out = path.join(root, 'instalable');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))); const version = pkg.version;
const exe = 'Programa_Electoral_Municipal_Setup_x64_v' + version + '.exe';
const hash = (buffer, algo = 'sha256') => crypto.createHash(algo).update(buffer).digest(algo === 'sha512' ? 'base64' : 'hex');
async function main() {
  const installer = fs.readFileSync(path.join(root, 'dist', exe));
  const yaml = fs.readFileSync(path.join(root, 'dist/latest.yml'), 'utf8');
  if (!yaml.includes('version: ' + version) || !yaml.includes(exe) || !yaml.includes(hash(installer, 'sha512'))) throw Error('Release metadata mismatch');
  fs.mkdirSync(out, { recursive: true });
  for (const file of [exe, exe + '.blockmap', 'latest.yml']) fs.copyFileSync(path.join(root, 'dist', file), path.join(out, file));
  fs.copyFileSync(path.join(out, exe), path.join(out, 'Programa_Electoral_Municipal_Setup_x64.exe'));
  fs.copyFileSync(path.join(out, exe + '.blockmap'), path.join(out, 'Programa_Electoral_Municipal_Setup_x64.exe.blockmap'));
  fs.writeFileSync(path.join(out, 'VERSION.txt'), version + '\n');
  const latest = 'Version: ' + version + '\nInstaller: ' + exe + '\nUpdate metadata: latest.yml\nSHA256: ' + hash(installer) + '\n';
  fs.writeFileSync(path.join(out, 'latest.txt'), latest); fs.writeFileSync(path.join(out, 'lastest.txt'), latest);
  const zip = new JSZip(); let count = 0;
  const sourceScripts = ['build_i18n.js', 'run_tests.js', 'test_suite_v141.js', 'test_suite_fase2.js', 'test_ocr.js',
    'test_municipal_context.js', 'test_database_safety.js', 'test_export_availability.js', 'test_prompt_integrity.js', 'test_ocr_i18n.js', 'test_ocr_languages.js', 'test_import_batch.js', 'test_electron_ocr.js', 'test_packaged_ocr.js', 'probe_packaged_ocr.js', 'generate_ocr_fixtures.js', 'generate_test_catalog.js',
    'setup_ocr_runtime.js', 'setup_ocr_licenses.js', 'setup_llama_runtime.js', 'pack_ocr_runtime.js', 'prepare_release.js', 'test_nsis_initialization.js', 'test_nsis_shortcuts.js'];
  const add = rel => { zip.file(rel.replaceAll('\\', '/'), fs.readFileSync(path.join(root, rel))); count++; };
  function walk(rel) {
    for (const item of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const file = path.join(rel, item.name);
      if (item.isDirectory()) walk(file);
      else if (!/catalogo_marco\.json$|\.sqlite$|\.db$|\.log$|\.tmp$|__pycache__/.test(file)) add(file);
    }
  }
  for (const file of ['package.json', 'package-lock.json', '.gitignore', 'LICENSE', 'README.md', 'PRIVACY.md', 'SOURCE_BUILD.md', 'THIRD_PARTY_NOTICES.md', 'DECISIONES.md']) add(file);
  for (const dir of ['src', 'build', 'docs', 'scripts/fixtures', 'resources/ocr-licenses']) walk(dir);
  for (const file of sourceScripts) add('scripts/' + file);
  for (const file of ['ai_models.json', 'municipios_ine.csv', 'municipios_catalunya.json']) add('data/' + file);
  const sourceName = 'Constructor_Programas_Municipales_Source_v' + version + '.zip';
  fs.writeFileSync(path.join(out, sourceName), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'scratch/ocr-test-results.json')));
  fs.copyFileSync(path.join(root, `scratch/TEST_OUTPUT_${version}.txt`), path.join(out, `TEST_OUTPUT_${version}.txt`));
  fs.copyFileSync(path.join(root, `scratch/BUILD_FINAL_${version}.txt`), path.join(out, `BUILD_OUTPUT_${version}.txt`));
  fs.copyFileSync(path.join(root, 'scratch/ocr-test-results.json'), path.join(out, 'OCR_TEST_RESULTS.json'));
  fs.copyFileSync(path.join(root, `scratch/PACKAGED_TEST_${version}.txt`), path.join(out, `PACKAGED_TEST_${version}.txt`));
  const baseline = path.join(root, 'dist/Programa_Electoral_Municipal_Setup_x64_v3.4.0.exe');
  const increase = fs.existsSync(baseline) ? installer.length - fs.statSync(baseline).size : null;
  const info = { version, builtAt: new Date().toISOString(), installer: exe, bytes: installer.length,
    increaseVs340Bytes: increase, sourceFiles: count, sourceArchive: sourceName, ocr: fixture,
    unsigned: true, installedApplicationModified: false };
  fs.writeFileSync(path.join(out, 'BUILD_INFO.txt'), JSON.stringify(info, null, 2) + '\n');
  const files = [exe, exe + '.blockmap', 'Programa_Electoral_Municipal_Setup_x64.exe', 'Programa_Electoral_Municipal_Setup_x64.exe.blockmap',
    'latest.yml', 'latest.txt', 'lastest.txt', 'VERSION.txt', 'BUILD_INFO.txt', sourceName, `TEST_OUTPUT_${version}.txt`, `BUILD_OUTPUT_${version}.txt`, 'OCR_TEST_RESULTS.json', `PACKAGED_TEST_${version}.txt`,
    'PROMPT_CORRECCION_OCR_Y_RELEASE.md', 'PLAN_OCR_Y_DISTRIBUCION.md', `ENTREGA_${version}.md`, `SUBIR_A_GITHUB_${version}.md`];
  const nsisLog = `NSIS_TEST_${version}.txt`;
  if (fs.existsSync(path.join(root, 'scratch', nsisLog))) {
    fs.copyFileSync(path.join(root, 'scratch', nsisLog), path.join(out, nsisLog));
    files.push(nsisLog);
  }
  const diagnosticBat = `INSTALAR_${version}_CON_DIAGNOSTICO.bat`;
  const shortcutsLog = `NSIS_SHORTCUT_TEST_${version}.txt`;
  if (fs.existsSync(path.join(root, 'scratch', shortcutsLog))) {
    fs.copyFileSync(path.join(root, 'scratch', shortcutsLog), path.join(out, shortcutsLog));
    files.push(shortcutsLog);
  }
  if (fs.existsSync(path.join(out, diagnosticBat))) files.push(diagnosticBat);
  const modifiedFiles = `ARCHIVOS_MODIFICADOS_${version}.md`;
  if (fs.existsSync(path.join(out, modifiedFiles))) files.push(modifiedFiles);
  fs.writeFileSync(path.join(out, 'SHA256.txt'), files.map(file => hash(fs.readFileSync(path.join(out, file))) + '  ' + file).join('\n') + '\n');
  console.log(JSON.stringify(info, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
