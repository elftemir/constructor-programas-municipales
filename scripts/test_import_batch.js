const fs = require('fs'); const path = require('path'); const vm = require('vm'); const assert = require('assert');
async function main() {
  const profile = fs.mkdtempSync(path.join(__dirname, '../scratch/batch-import-'));
  process.env.APPDATA = profile; process.env.LOCALAPPDATA = profile;
  require('./generate_test_catalog');
  const dbFile = path.join(profile, 'test.sqlite');
  const { getDb, closeDb } = require('../src/main/db/database');
  const db = await getDb(dbFile, { catalogPath: path.join(__dirname, 'fixtures/catalog-test.json') });
  const service = require('../src/main/services/sourceProgramService');
  const es = { filePath: 'es.pdf', format: 'pdf', areas: [{ title: 'Vivienda', measures: [{ sourceNumber: '1', text: 'Crearemos una oficina municipal de vivienda.' }] }],
    ocr_metadata: { pages: [{ page: 1, text: 'Castellano', origin: 'ocr' }] } };
  const ca = { filePath: 'ca.pdf', format: 'pdf', areas: [{ title: 'Habitatge', measures: [{ sourceNumber: '1', text: "Crearem una oficina municipal d'habitatge." }] }],
    ocr_metadata: { pages: [{ page: 1, text: 'Català', origin: 'ocr' }] } };
  const count = () => db.exec('SELECT COUNT(*) FROM programas_fuente')[0].values[0][0];
  const before = count();
  const both = await service.createImportedSource({ nombre: 'Un programa', versions: { es, ca } });
  assert.equal(count(), before + 1); assert.equal(both.medidas.length, 1);
  assert(both.idiomas.es.disponible && both.idiomas.ca.disponible);
  assert.equal(both.medidas[0].texto_es, es.areas[0].measures[0].text);
  assert.equal(both.medidas[0].texto_ca, ca.areas[0].measures[0].text);
  const onlyEs = await service.createImportedSource({ nombre: 'Solo ES', versions: { es } });
  const onlyCa = await service.createImportedSource({ nombre: 'Solo CA', versions: { ca } });
  assert(onlyEs.idiomas.es.disponible && !onlyEs.idiomas.ca.disponible);
  assert(onlyCa.idiomas.ca.disponible && !onlyCa.idiomas.es.disponible);
  const invalid = structuredClone(ca); invalid.areas[0].measures[0].sourceNumber = '99';
  const snapshot = fs.readFileSync(dbFile); const countBeforeFailure = count();
  await assert.rejects(service.createImportedSource({ nombre: 'Debe revertirse', versions: { es, ca: invalid } }));
  assert.equal(count(), countBeforeFailure); assert(fs.readFileSync(dbFile).equals(snapshot), 'Failed bilingual creation must not write half a source to disk');
  await assert.rejects(service.createImportedSource({ versions: {} }));
  console.log('PASS batch persistence: two files create one source; ES-only/CA-only accepted; incompatible second version rolls back memory and disk.');

  const handlers = new Map(), nodes = new Map(); let selectedPath, currentLang = 'es', selectedScannedCa = true, saved = 0, reviewed;
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, { style: {}, value: key === '#input-summary-source-name' ? 'Programa común' : currentLang,
      checked: false, addEventListener: (event, fn) => handlers.set(key + ':' + event, fn) });
    if (key === '#ocr-language') nodes.get(key).value = currentLang;
    return nodes.get(key);
  };
  const container = { style: {}, querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  const app = { notifySaving() {}, notifySaved() {}, navigateTo() {} };
  const context = { window: { i18n: { getLang: () => 'es', t: k => k }, App: app, api: {
    importerSelectFile: async () => selectedPath,
    importerAnalyzeDocument: async (file, lang) => {
      currentLang = lang; const v = lang === 'es' ? es : ca;
      return { sourceName: 'Programa común', language: lang, filePath: file, areas: structuredClone(v.areas), format: 'pdf',
        stats: { totalAreas: 1, totalMeasures: 1, requiresReviewCount: 0 }, isScanned: lang === 'ca' && selectedScannedCa, pageCount: 1 };
    },
    importerRunOcr: async (file, lang, options) => {
      assert.equal(file, 'ca.pdf'); assert.equal(lang, 'ca'); assert(!options.batchImport);
      return { sourceName: 'Programa común', language: lang, areas: structuredClone(ca.areas), format: 'pdf (ocr)',
        pages: ca.ocr_metadata.pages, stats: { totalAreas: 1, totalMeasures: 1, requiresReviewCount: 0 } };
    }, onImporterOcrProgress: () => () => {}, importerCancelOcr: async () => true,
    importerConfirmImport: async payload => { saved++; return service.createImportedSource(payload); }
  } }, App: app, document: { querySelector: () => container }, escapeHtml: x => String(x || ''), console, alert() {}, confirm: () => true };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/renderer/js/views/importReviewView.js'), 'utf8'), context);
  const view = context.window.ImportReviewView;
  view.showPreReviewSummaryModal = data => { reviewed = data; view.openHierarchicalReviewScreen(data); };
  const click = key => handlers.get(key + ':click')();
  await view.openImportModal(); assert(node('#btn-import-init-select-file').disabled !== false);
  selectedPath = 'es.pdf'; await click('#btn-import-file-es'); assert.equal(node('#btn-import-init-select-file').disabled, false);
  selectedPath = 'ca.pdf'; await click('#btn-import-file-ca');
  await click('#btn-import-init-select-file'); assert.equal(reviewed.language, 'es'); assert.equal(saved, 0);
  await click('#btn-review-confirm-all'); assert.equal(saved, 0); assert(container.innerHTML.includes('ocr-language'));
  await click('#btn-ocr-start'); assert.equal(reviewed.language, 'ca'); assert.equal(saved, 0);
  await click('#btn-review-previous-language'); assert(container.innerHTML.includes('Crearemos una oficina'));
  await click('#btn-review-confirm-all'); assert(container.innerHTML.includes('Crearem una oficina'));
  await click('#btn-review-confirm-all'); assert.equal(saved, 1);
  await click('#btn-review-confirm-all'); assert.equal(saved, 1, 'Repeated confirmation must not create a duplicate source');
  assert.equal(count(), countBeforeFailure + 1);

  // Selecting only one optional slot needs a single review and confirmation.
  selectedScannedCa = false;
  for (const lang of ['es', 'ca']) {
    await view.openImportModal(); selectedPath = lang + '.pdf'; await click('#btn-import-file-' + lang);
    await click('#btn-import-init-select-file'); assert.equal(reviewed.language, lang);
    const previous = saved; await click('#btn-review-confirm-all'); assert.equal(saved, previous + 1);
  }
  await view.openImportModal(); selectedPath = 'es.pdf'; await click('#btn-import-file-es');
  await click('#btn-import-clear-es'); assert.equal(node('#btn-import-init-select-file').disabled, true);
  selectedPath = 'es.pdf'; await click('#btn-import-file-es'); selectedPath = 'ca.pdf'; await click('#btn-import-file-ca');
  await click('#btn-import-init-select-file'); await click('#btn-review-confirm-all');
  const beforeCancel = saved; await click('#btn-review-cancel-all'); assert.equal(saved, beforeCancel); assert.equal(view.batchImport, null);
  closeDb();
  console.log('PASS actual dual-file UI: optional slots, native + scanned OCR, review both, return to first language, one final creation, single-language import, clear slot and cancellation without saving.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
