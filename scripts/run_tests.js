// Never use a real user profile or migrate the developer's existing database during tests.
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..'); fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
// A caller may choose a shorter temporary root for native Windows converters.
const testRoot=process.env.CPM_TEST_ROOT?path.resolve(process.env.CPM_TEST_ROOT):path.join(root,'scratch');
fs.mkdirSync(testRoot,{recursive:true});
const dir = fs.mkdtempSync(path.join(testRoot, 'tests-'));
require('./generate_test_catalog');
const env = { ...process.env, APPDATA: path.join(dir, 'roaming'), LOCALAPPDATA: path.join(dir, 'local'), USERPROFILE: path.join(dir, 'user'), TEST_RUN_DIR: dir, CPM_ALLOW_TEST_CONTENT: '1' };
const results = [];
for (const script of ['build_i18n.js', 'setup_ocr_runtime.js', 'test_suite_v141.js', 'test_suite_fase2.js', 'test_ocr.js', 'test_ocr_languages.js', 'test_import_batch.js', 'test_prompt_integrity.js', 'test_municipal_context.js', 'test_database_safety.js', 'test_export_availability.js', 'test_ocr_i18n.js', 'test_preparar_publicacion.js', 'test_lema_bilingue.js', 'test_distribucion_limpia.js', 'test_distribucion_vacia.js', 'test_auditoria_publicacion.js', 'test_retirada_ejemplo.js', 'test_actualizacion_361_380.js', 'test_inicio_380.js', 'test_backend_ai.js', 'test_generation_source.js','test_writing_381.js','test_saved_text_381.js','test_availability_381.js','test_models_381.js','test_visible_labels_381.js']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  const passed = result.status === 0;
  results.push({ script, passed });
  if (!passed) process.exitCode = 1;
}

const recovery=spawnSync(process.execPath,[path.join(__dirname,'test_generation_recovery_382.js')],{cwd:root,env,stdio:'inherit',windowsHide:true});results.push({script:'test_generation_recovery_382.js',passed:recovery.status===0});if(recovery.status!==0)process.exitCode=1;
const repair=spawnSync(process.execPath,[path.join(__dirname,'test_presentation_repair_382.js')],{cwd:root,env,stdio:'inherit',windowsHide:true});results.push({script:'test_presentation_repair_382.js',passed:repair.status===0});if(repair.status!==0)process.exitCode=1;
for(const script of ['test_request_isolation_383.js','test_pdf_layout_383.js','test_validation_384.js','test_review_385.js','test_official_385.js']){const r=spawnSync(process.execPath,[path.join(__dirname,script)],{cwd:root,env,stdio:'inherit',windowsHide:true});results.push({script,passed:r.status===0});if(r.status!==0)process.exitCode=1;}
const cover=spawnSync(process.execPath,[path.join(__dirname,'test_portada_neutra.js')],{cwd:root,env,stdio:'inherit',windowsHide:true});results.push({script:'test_portada_neutra.js',passed:cover.status===0});if(cover.status!==0)process.exitCode=1;
console.log("\nRESUMEN FINAL DE BATERÍAS");
for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"}: ${result.script}`);
console.log(`${results.filter(r => r.passed).length}/${results.length} baterías superadas.`);
