const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const initSql = require('sql.js');
const database = require('../src/main/db/database');
const projects = require('../src/main/services/projectService');
const fichas = require('../src/main/services/fichaMunicipioService');
const lema = require('../src/main/utils/lema');
const exporter = require('../src/main/services/docxExporter');
const { buildMunicipalContext } = require('../src/main/services/ai/municipalContext');
const { BuiltinLocalAiEngine, LlamaCppProvider } = require('../src/main/services/ai/aiProvider');

function loadView(file, context) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/renderer/js', file), 'utf8'), context);
}
async function coverLema(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const xml = await zip.file('word/document.xml').async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const drawings = [...doc.getElementsByTagName('wp:anchor')];
  return [1, 2].map(n => {
    const box = drawings.find(node => [...node.getElementsByTagName('wp:docPr')].some(prop => /Lema/.test(prop.getAttribute('name')) && prop.getAttribute('name').endsWith(' ' + n)));
    assert(box, 'Existe el cuadro lema' + n);
    return [...box.getElementsByTagName('w:txbxContent')].map(content => [...content.getElementsByTagName('w:t')].map(t => t.textContent).join('')).join('');
  });
}
async function main() {
  const base = process.env.TEST_RUN_DIR || path.join(__dirname, '../scratch');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'lema-'));
  const filename = path.join(dir, 'test.sqlite');
  let db = await database.getDb(filename, { catalogPath: path.join(__dirname, 'fixtures/catalog-minimal.json') });
  // Reconstruir esquema 5 real sin modificar perfiles o proyectos personales.
  for (const table of ['proyectos', 'fichas_municipios']) for (const column of ['lema_es', 'lema_ca']) db.run(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  db.run('PRAGMA user_version=5');
  for (const [id, lang] of [['legacy-ca', 'ca'], ['legacy-es', 'es'], ['legacy-null', null]]) {
    db.run("INSERT INTO proyectos (id,municipio,idioma_principal,lema,fuente_id) VALUES (?,?,?,?, 'synthetic-main-source')", [id, 'Prueba', lang, 'Lema conservado']);
    db.run("INSERT INTO proyecto_fuentes (id,proyecto_id,fuente_id,rol,fecha_anadida) VALUES (?,?,'synthetic-main-source','principal',?)", ['link-' + id, id, new Date().toISOString()]);
  }
  db.run("INSERT INTO fichas_municipios (codigo_ine,municipio,lema) VALUES ('99999','Prueba','Lema de ficha')");
  database.save(); database.closeDb();
  db = await database.getDb(filename);
  const ca = await projects.getProject('legacy-ca');
  assert.equal(ca.lema_ca, 'Lema conservado'); assert.equal(ca.lema_es, null); assert.equal(ca.lema, 'Lema conservado');
  for (const id of ['legacy-es', 'legacy-null']) { const row = await projects.getProject(id); assert.equal(row.lema_es, 'Lema conservado'); assert.equal(row.lema_ca, null); }
  const backups = path.join(dir, 'backups/migrations');
  const snapshot = fs.readdirSync(backups).find(name => name.includes('schema5-to-' + require('../src/main/db/migrator').TARGET_SCHEMA_VERSION));
  assert(snapshot, 'Copia previa obligatoria del esquema 5');
  const SQL = await initSql(); const prior = new SQL.Database(fs.readFileSync(path.join(backups, snapshot)));
  assert.equal(prior.exec('PRAGMA user_version')[0].values[0][0], 5);
  assert(!prior.exec('PRAGMA table_info(proyectos)')[0].values.some(row => row[1] === 'lema_ca')); prior.close();
  assert.equal((await fichas.getFichaMunicipio('99999')).lema_es, 'Lema de ficha');
  await fichas.saveFichaMunicipio({ codigo_ine: '99999', lema_ca: 'Lema de fitxa' });
  assert.equal((await fichas.getFichaMunicipio('99999')).lema_ca, 'Lema de fitxa');
  await fichas.saveFichaMunicipio({ codigo_ine: '99999', lema_es: 'Juntos mejoramos', lema_ca: 'Junts millorem' });
  database.closeDb(); db = await database.getDb(filename);
  const ficha = await fichas.getFichaMunicipio('99999');
  assert.equal(ficha.lema_es, 'Juntos mejoramos', 'La ficha conserva el lema castellano en disco');
  assert.equal(ficha.lema_ca, 'Junts millorem', 'La ficha conserva el lema catalán en disco');

  const id = await projects.createProject({ municipio: 'Prueba', lema_es: 'Pallejà se lo merece', lema_ca: 'Pallejà s’ho mereix' });
  await projects.updateProjectData(id, { lema_es: 'x'.repeat(70) });
  assert.equal((await projects.getProject(id)).lema_es.length, 60);
  await projects.updateProjectData(id, { lema_es: 'Pallejà se lo merece' });
  const copyId = await projects.duplicateProject(id); const project = await projects.getProject(copyId);
  assert.equal(project.lema_es, 'Pallejà se lo merece', 'Duplicar conserva lema_es');
  assert.equal(project.lema_ca, 'Pallejà s’ho mereix', 'Duplicar conserva lema_ca');
  const importedId = await projects.importProjectJson(await projects.exportProjectJson(id));
  assert.equal((await projects.getProject(importedId)).lema_ca, project.lema_ca);
  assert.equal(lema.getLema({ lema: 'Antiguo', lema_es: ' ' }, 'es'), null);
  assert.equal(lema.getLema(project, 'fr'), null);
  const results = await exporter.exportProjectToDocx(project, { outputDir: dir, exportBothLanguages: true });
  for (const result of results.files) {
    const boxes = await coverLema(result.filePath);
    assert.equal(boxes.join(' '), lema.getLema(project, result.language).toUpperCase());
    assert(!boxes.join(' ').includes(lema.getLema(project, result.language === 'es' ? 'ca' : 'es').toUpperCase()));
  }
  const missing = { ...project, lema_ca: null };
  const blank = await exporter.exportProjectToDocx(missing, { idioma: 'ca', outputPath: path.join(dir, 'sin-lema.docx') });
  assert.deepEqual(await coverLema(blank.filePath), ['', '']);
  const agreed = await exporter.exportProjectToDocx(missing, { idioma: 'ca', lemaAlternativoConfirmado: true, outputPath: path.join(dir, 'confirmado.docx') });
  assert.equal((await coverLema(agreed.filePath)).join(' '), project.lema_es.toUpperCase());
  assert.equal(missing.lema_ca, null, 'La excepción no altera datos');
  // Probar el filtro real que comparten los IPC de Word y PDF, sin arrancar Electron.
  const mainSource = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
  const start = mainSource.indexOf('function sanitizeExportOptionsFromIpc(');
  const end = mainSource.indexOf('\nfunction enforceNavigationSecurity', start);
  const sanitize = vm.runInNewContext(mainSource.slice(start, end) + '\nsanitizeExportOptionsFromIpc');
  assert.equal(sanitize({ idioma: 'ca', lemaAlternativoConfirmado: true }).lemaAlternativoConfirmado, true);
  assert.equal(sanitize({ lemaAlternativoConfirmado: 'true' }).lemaAlternativoConfirmado, undefined);
  const throughIpc = await exporter.exportProjectToDocx(missing, { ...sanitize({ idioma: 'ca', lemaAlternativoConfirmado: true }), outputPath: path.join(dir, 'ipc-confirmado.docx') });
  assert.equal((await coverLema(throughIpc.filePath)).join(' '), project.lema_es.toUpperCase());
  assert(buildMunicipalContext(project, {}, 'ca').includes(project.lema_ca));
  assert(!buildMunicipalContext(project, {}, 'ca').includes(project.lema_es));
  const builtin = new BuiltinLocalAiEngine();
  const provider = new LlamaCppProvider('fixture', 'fixture');
  provider.manager.ensureServerRunning = async () => 'http://127.0.0.1:1';
  let messages;
  provider.callChat = async (_, input) => { messages = input; return '{"titulo":"Prueba","entradilla":"Prueba","parrafos":["Prueba"]}'; };
  for (const lang of ['es', 'ca']) for (const task of ['redactar_presentacion', 'redactar_cierre']) {
    const params = { ...project, idioma_salida: lang };
    const local = await builtin.generate(task, params);
    assert(JSON.stringify(local).includes(lema.getLema(project, lang)), 'Motor integrado elige el lema de salida');
    assert(!JSON.stringify(local).includes(lema.getLema(project, lang === 'ca' ? 'es' : 'ca')));
    await provider.generate(task, params);
    assert(messages[1].content.includes(lema.getLema(project, lang)), 'Prompt del modelo usa el lema de salida');
    assert(!messages[1].content.includes(lema.getLema(project, lang === 'ca' ? 'es' : 'ca')));
  }

  let translated = 0, saved = 0, navigated = '';
  const window = { Lema: lema, i18n: { t: key => key }, api: {
    aiTranslateText: async params => { assert.equal(params.a, 'ca'); translated++; return { ok: true, texto: 'Pallejà s’ho mereix' }; },
    updateProjectData: async () => { saved++; }, saveFichaMunicipio: async () => {}
  }, App: { navigateTo: async view => { navigated = view; } } };
  const context = vm.createContext({ window, document: { querySelector: () => ({ focus() {} }) }, alert() {}, confirm: () => false, prompt: () => null, escapeHtml: s => s });
  loadView('utils/lemaUi.js', context); loadView('views/reviewExportView.js', context); loadView('views/previewView.js', context);
  const view = window.ReviewExportView; const shown = [];
  view.promptMissingLema = async lang => { shown.push(lang); return 'other'; };
  const options = await view.prepareLemaExport(missing, ['es', 'ca']);
  assert.deepEqual(shown, ['ca']); assert.equal(options.ca.lemaAlternativoConfirmado, true);
  view.promptMissingLema = async () => 'write'; assert.equal(await view.prepareLemaExport(missing, ['ca']), null); assert.equal(navigated, 'datos-basicos');
  view.promptMissingLema = async () => 'cancel'; assert.equal(await view.prepareLemaExport(missing, ['ca']), null);
  view.promptMissingLema = async () => 'translate'; const translatedProject = { ...missing };
  assert(await view.prepareLemaExport(translatedProject, ['ca'])); assert.equal(translatedProject.lema_ca, project.lema_ca); assert.equal(saved, 1);
  assert.equal(await window.LemaUi.translate(project, 'ca'), false, 'Sin confirmación no pisa lema'); assert.equal(translated, 1);
  const emptyOptions = await view.prepareLemaExport({ lema_es: null, lema_ca: null }, ['es', 'ca']); assert.equal(Object.keys(emptyOptions).length, 0);
  const pages = window.PreviewView.buildDocumentPages({ ...missing, areas: [] }, true); assert.equal(pages[0].lema, '');
  const caPages = window.PreviewView.buildDocumentPages({ ...project, areas: [] }, true);
  assert.equal(caPages[0].lema, project.lema_ca, 'La vista previa catalana muestra el lema catalán');
  const esPages = window.PreviewView.buildDocumentPages({ ...project, areas: [] }, false);
  assert.equal(esPages[0].lema, project.lema_es, 'La vista previa castellana muestra el lema castellano');
  console.log('PASS lema bilingüe: migración ES/CA/null y copia previa; límites y fichas; duplicación/JSON; cuadros DOCX ES/CA; aviso y tres acciones; traducción sin sobrescritura; vista previa y contexto.');
  database.closeDb();
}
main().catch(err => { database.closeDb(); console.error(err); process.exitCode = 1; });
