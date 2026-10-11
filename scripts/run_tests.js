// Never use a real user profile or migrate the developer's existing database during tests.
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..'); fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
const dir = fs.mkdtempSync(path.join(root, 'scratch/tests-'));
require('./generate_test_catalog');
const env = { ...process.env, APPDATA: path.join(dir, 'roaming'), LOCALAPPDATA: path.join(dir, 'local'), USERPROFILE: path.join(dir, 'user'), TEST_RUN_DIR: dir };
const results = [];
for (const script of ['build_i18n.js', 'setup_ocr_runtime.js', 'test_suite_v141.js', 'test_suite_fase2.js', 'test_ocr.js', 'test_ocr_languages.js', 'test_import_batch.js', 'test_prompt_integrity.js', 'test_municipal_context.js', 'test_database_safety.js', 'test_export_availability.js', 'test_ocr_i18n.js', 'test_preparar_publicacion.js']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  const passed = result.status === 0;
  results.push({ script, passed });
  if (!passed) process.exitCode = 1;
}

console.log("\nRESUMEN FINAL DE BATERÍAS");
for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"}: ${result.script}`);
console.log(`${results.filter(r => r.passed).length}/${results.length} baterías superadas.`);
