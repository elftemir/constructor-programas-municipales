const fs = require('fs'); const path = require('path'); const vm = require('vm'); const assert = require('assert');
async function main() {
  const profile = fs.mkdtempSync(path.join(__dirname, '../scratch/language-profile-'));
  process.env.APPDATA = profile; process.env.LOCALAPPDATA = profile;
  const { dir } = require('./generate_ocr_fixtures').generate();
  const engine = require('../src/main/services/importer/ocrEngine');
  const es = await engine.processScannedPdf(fs.readFileSync(path.join(dir, 'ocr-es.pdf')), { language: 'es' });
  const ca = await engine.processScannedPdf(fs.readFileSync(path.join(dir, 'ocr-ca.pdf')), { language: 'ca' });
  for (const result of [es, ca]) {
    assert.equal(result.areas.length, 1); assert.equal(result.areas[0].measures.length, 3);
    assert.equal(result.metadata.unclassifiedBlocks.length, 0, 'Recognized headings must not be duplicated');
  }
  require('./generate_test_catalog');
  const { getDb, closeDb } = require('../src/main/db/database');
  const scratch = fs.mkdtempSync(path.join(__dirname, '../scratch/language-test-'));
  const db = await getDb(path.join(scratch, 'test.sqlite'), { catalogPath: path.join(dir, 'catalog-test.json') });
  const service = require('../src/main/services/sourceProgramService');
  const source = await service.createSourceProgram({ nombre: 'Dos versiones', idioma_inicial: 'es', areas: es.areas,
    ocr_metadata: { pages: es.pages, summary: es.summary } });
  const beforeCount = db.exec('SELECT COUNT(*) FROM programas_fuente')[0].values[0][0];
  const invalid = structuredClone(ca.areas); invalid[0].measures.pop();
  await assert.rejects(service.addLanguageToSource(source.id, 'ca', { areas: invalid }));
  assert.equal((await service.getById(source.id)).idiomas.ca.disponible, false);
  const duplicate = structuredClone(ca.areas); duplicate[0].measures[1].sourceNumber = duplicate[0].measures[0].sourceNumber;
  await assert.rejects(service.addLanguageToSource(source.id, 'ca', { areas: duplicate }));
  const updated = await service.addLanguageToSource(source.id, 'ca', { areas: ca.areas,
    ocr_metadata: { pages: ca.pages, summary: ca.summary }, origen_archivo: 'ocr-ca.pdf' });
  assert.equal(updated.id, source.id); assert(updated.idiomas.es.disponible && updated.idiomas.ca.disponible);
  assert.equal(db.exec('SELECT COUNT(*) FROM programas_fuente')[0].values[0][0], beforeCount);
  assert.equal(updated.medidas.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(updated.medidas[i].id, source.medidas[i].id);
    assert.equal(updated.medidas[i].texto_es, source.medidas[i].texto_es);
    assert.equal(updated.medidas[i].texto_ca, ca.areas[0].measures[i].text);
  }
  const metadata = JSON.parse(updated.ocr_metadata_json);
  assert.equal(metadata.languages.es.pages[0].origin, 'ocr'); assert.equal(metadata.languages.ca.pages[0].origin, 'ocr');
  await assert.rejects(service.addLanguageToSource(source.id, 'ca', { areas: ca.areas }));
  const firstCa = await service.createSourceProgram({ nombre: 'Catalán primero', idioma_inicial: 'ca', areas: ca.areas });
  const reversed = await service.addLanguageToSource(firstCa.id, 'es', { areas: es.areas });
  assert(reversed.idiomas.es.disponible && reversed.idiomas.ca.disponible);
  assert.equal(reversed.medidas[0].texto_ca, firstCa.medidas[0].texto_ca);
  assert.equal(reversed.medidas[0].texto_es, es.areas[0].measures[0].text);
  closeDb();
  console.log('PASS bilingual source: OCR ES/CA, same IDs, isolated language columns, metadata, no duplicate headings, mismatches rejected without changes.');

  // Exercise the actual renderer handlers: scanned/native second language, review, confirmation and cancellation.
  const handlers = new Map(); const nodes = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, { style: {}, value: 'ca', checked: false,
    addEventListener: (event, fn) => handlers.set(key + ':' + event, fn) }); return nodes.get(key); };
  const container = { style: {}, querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  let saved = 0, created = 0, scanned = true; const app = { notifySaving() {}, notifySaved() {}, navigateTo() {} };
  const context = { window: { i18n: { getLang: () => 'es', t: k => k }, App: app,
    api: { importerSelectFile: async () => 'ca.pdf', importerAnalyzeDocument: async () => ({ isScanned: scanned, language: 'ca', areas: ca.areas, pageCount: 1 }),
      importerRunOcr: async () => ({ ...ca, language: 'ca', stats: { requiresReviewCount: 0 } }), onImporterOcrProgress: () => () => {},
      importerAddLanguage: async (id, lang) => { assert.equal(id, source.id); assert.equal(lang, 'ca'); saved++; },
      importerConfirmImport: async () => { created++; } } }, App: app, document: { querySelector: () => container },
    alert() {}, confirm: () => true, escapeHtml: value => String(value || ''), console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/renderer/js/views/importReviewView.js'), 'utf8'), context);
  const view = context.window.ImportReviewView; let prompted = false, reviewed;
  view.showOcrPromptModal = (file, lang, pages, pending, id) => { assert.equal(lang, 'ca'); assert.equal(id, source.id); prompted = true; };
  view.showPreReviewSummaryModal = data => { reviewed = data; };
  await view.openAddLanguageModal(source.id, 'ca'); assert(prompted); assert.equal(saved, 0);
  await view.runLocalOcr('ca.pdf', 'ca', 1, { targetSourceId: source.id, primaryLanguage: 'ca' });
  assert.equal(reviewed.targetSourceId, source.id); assert.equal(saved, 0);
  view.openHierarchicalReviewScreen(reviewed);
  await handlers.get('#btn-review-confirm-all:click')(); assert.equal(saved, 1); assert.equal(created, 0);
  await handlers.get('#btn-review-cancel-all:click')(); assert.equal(saved, 1);
  scanned = false; await view.openAddLanguageModal(source.id, 'ca'); assert.equal(reviewed.targetSourceId, source.id); assert.equal(saved, 1);
  console.log('PASS renderer second-language OCR/native review, explicit association and cancellation without creating a new source.');
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/renderer/js/views/marcoView.js'), 'utf8'), context);
  const marco = context.window.MarcoView;
  marco.catalogData = { info: {}, areas: updated.areas };
  marco.viewLang = 'es'; await marco.render(container);
  assert(container.innerHTML.includes(updated.medidas[0].texto_es));
  assert(!container.innerHTML.includes(updated.medidas[0].texto_ca));
  marco.viewLang = 'ca'; await marco.render(container);
  assert(container.innerHTML.includes(updated.medidas[0].texto_ca));
  assert(!container.innerHTML.includes(updated.medidas[0].texto_es));
  console.log('PASS actual source view renders only the selected ES/CA measure text.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
