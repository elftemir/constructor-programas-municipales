const assert = require('assert'); const fs = require('fs'); const path = require('path');
const os = require('os');
const { generate } = require('./generate_ocr_fixtures');
const engine = require('../src/main/services/importer/ocrEngine');
function similarity(a, b) {
  const normalize = s => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim(); a = normalize(a); b = normalize(b);
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const next = [i]; for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] !== b[j - 1])); row = next; }
  return 1 - row[b.length] / Math.max(a.length, b.length, 1);
}
async function main() {
  const { dir, texts } = generate(); const scanned = fs.readFileSync(path.join(dir, 'ocr-scanned.pdf'));
  const result = await engine.processScannedPdf(scanned, { language: 'both' });
  for (let i = 0; i < texts.length; i++) { const score = similarity(texts[i], result.pages[i].text); console.log('Fidelity page', i + 1, (score * 100).toFixed(2) + '%'); assert(score >= 0.95); }
  assert(result.pages.every(p => p.origin === 'ocr' && p.lines.length && typeof p.lines[0].confidence === 'number'));
  assert(result.areas.length > 0, 'Known area headings must be recognized');
  console.log('PASS real OCR, line confidence, network disabled; average ms/page:', result.summary.averageMs);
  const mixed = await engine.processScannedPdf(fs.readFileSync(path.join(dir, 'ocr-mixed.pdf')), { language: 'both' });
  assert.deepEqual(mixed.pages.map(p => p.origin), ['native', 'ocr']); console.log('PASS mixed PDF');
  let cancelled = false;
  const cancellation = engine.processScannedPdf(scanned, { language: 'both', onProgress: () => { if (!cancelled) { cancelled = true; void engine.cancel(); } } });
  await assert.rejects(cancellation, error => error.code === 'OCR_CANCELLED'); assert(!engine.active); console.log('PASS cancellation without partial data');
  const missing = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-missing-'));
  fs.writeFileSync(path.join(missing, 'manifest.json'), JSON.stringify({ files: { 'languages/spa.traineddata': 'missing' } }));
  await assert.rejects(engine.processScannedPdf(scanned, { runtimeDir: missing }), e => e.code === 'OCR_UNAVAILABLE');
  fs.rmSync(missing, { recursive: true, force: true }); console.log('PASS missing language controlled error');
  const unstructured = await engine.processScannedPdf(fs.readFileSync(path.join(dir, 'ocr-unstructured.pdf')));
  assert.equal(unstructured.areas.length, 0); assert(unstructured.metadata.unclassifiedBlocks.length > 0); console.log('PASS unclassified blocks preserved');
  if (os.totalmem() >= 8 * 1024 ** 3) { const parallel = await engine.processScannedPdf(scanned, { language: 'both', workers: 2 }); assert.equal(parallel.summary.ocr, 2); console.log('PASS two workers'); }
  assert(!fs.readFileSync(path.join(__dirname, '../src/main/services/importer/ocrEngine.js'), 'utf8').includes('ocrLines.push'));
  console.log('PASS no simulated measures');
  const originalRun = engine.run;
  engine.run = async () => ({ pages: result.pages.map(p => ({ ...p, confidence: 40, lines: p.lines.map(l => ({ ...l, confidence: 40 })) })), summary: result.summary });
  const uncertain = await engine.processScannedPdf(scanned);
  engine.run = originalRun;
  assert(uncertain.areas.some(a => a.measures.some(m => m.dudoso && m.motivo_duda.includes('baja fiabilidad'))));
  require('./generate_test_catalog');
  const { getDb, closeDb } = require('../src/main/db/database');
  const dbDir = fs.mkdtempSync(path.join(__dirname, '../scratch/ocr-db-'));
  const db = await getDb(path.join(dbDir, 'ocr.sqlite'), { catalogPath: path.join(__dirname, 'fixtures/catalog-test.json') });
  const sourceService = require('../src/main/services/sourceProgramService');
  const saved = await sourceService.createSourceProgram({ nombre: 'Prueba OCR', areas: uncertain.areas,
    ocr_metadata: { pages: uncertain.pages, summary: uncertain.summary } });
  assert(JSON.parse(saved.ocr_metadata_json).pages[0].confidence === 40);
  const warnings = db.exec('SELECT COUNT(*) FROM medidas WHERE fuente_id = ? AND dudoso = 1', [saved.id]);
  assert(warnings[0].values[0][0] > 0);
  const count = db.exec('SELECT COUNT(*) FROM medidas')[0].values[0][0];
  db.run('ALTER TABLE programas_fuente DROP COLUMN ocr_metadata_json');
  db.run('PRAGMA user_version = 4');
  const migration = await require('../src/main/db/migrator').migrate(db, { dbFilePath: path.join(dbDir, 'ocr.sqlite') });
  assert(migration.migrated);
  assert.equal(db.exec('SELECT COUNT(*) FROM medidas')[0].values[0][0], count);
  assert.equal(db.exec('SELECT nombre FROM programas_fuente WHERE id = ?', [saved.id])[0].values[0][0], 'Prueba OCR');
  console.log('PASS schema 4 to 5 migration preserves source and measure data');
  closeDb();
  console.log('PASS low-confidence warnings and page/line metadata persist after confirmation');
  const output = { passed: true, fidelity: texts.map((text, i) => similarity(text, result.pages[i].text)), summary: result.summary,
    metric: '1 - normalized Levenshtein distance / maximum text length' };
  fs.mkdirSync(path.join(__dirname, '../scratch'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../scratch/ocr-test-results.json'), JSON.stringify(output, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
