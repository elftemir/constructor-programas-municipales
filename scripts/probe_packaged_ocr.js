// Executed by the packaged Electron executable in Node mode, never by the installed application.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
(async () => {
  const resources = process.argv[2]; const fixture = process.argv[3];
  const archive = path.join(resources, 'app.asar');
  const engine = require(path.join(archive, 'src/main/services/importer/ocrEngine.js'));
  const manifest = engine.verifyRuntime(path.join(resources, 'ocr-runtime'));
  const result = await engine.processScannedPdf(fs.readFileSync(fixture), { language: 'both', runtimeDir: path.join(resources, 'ocr-runtime') });
  assert.equal(result.summary.ocr, 2); assert.equal(result.summary.failed, 0);
  assert(result.areas.length > 0);
  assert.equal(result.metadata.unclassifiedBlocks.length, 0);
  console.log('PASS packaged engine through ASAR:', result.summary, 'verified files:', Object.keys(manifest.files).length);
  const { getDb, closeDb } = require(path.join(archive, 'src/main/db/database.js'));
  await getDb(path.join(process.env.APPDATA, 'language-test.sqlite'), { catalogPath: path.join(__dirname, 'fixtures/catalog-test.json') });
  const sourceService = require(path.join(archive, 'src/main/services/sourceProgramService.js'));
  const source = await sourceService.createSourceProgram({ nombre: 'Packaged language test', idioma_inicial: 'es', areas: [result.areas[0]] });
  const associated = await sourceService.addLanguageToSource(source.id, 'ca', { areas: [result.areas[1]],
    ocr_metadata: { pages: [result.pages[1]], summary: result.summary } });
  assert.equal(associated.id, source.id); assert.equal(associated.medidas.length, 3);
  assert(associated.idiomas.es.disponible && associated.idiomas.ca.disponible);
  assert.equal(associated.medidas[0].texto_es, source.medidas[0].texto_es);
  assert.equal(associated.medidas[0].texto_ca, result.areas[1].measures[0].text);
  const combined = await sourceService.createImportedSource({ nombre: 'Two files, one program', versions: {
    es: { areas: [result.areas[0]], filePath: fixture, format: 'pdf', ocr_metadata: { pages: [result.pages[0]], summary: result.summary } },
    ca: { areas: [result.areas[1]], filePath: fixture, format: 'pdf', ocr_metadata: { pages: [result.pages[1]], summary: result.summary } }
  } });
  assert.equal(combined.medidas.length, 3);
  assert(combined.idiomas.es.disponible && combined.idiomas.ca.disponible);
  assert.equal(combined.medidas[0].texto_es, result.areas[0].measures[0].text);
  assert.equal(combined.medidas[0].texto_ca, result.areas[1].measures[0].text);
  const singleCa = await sourceService.createImportedSource({ nombre: 'CA only', versions: { ca: { areas: [result.areas[1]], filePath: fixture } } });
  assert(singleCa.idiomas.ca.disponible && !singleCa.idiomas.es.disponible);
  closeDb();
  console.log('PASS packaged source association: same source and measure IDs, separate ES/CA text and saved OCR metadata.');
  console.log('PASS packaged batch import: two language versions in one program and optional missing ES version.');
})().catch(error => { console.error(error); process.exitCode = 1; });
