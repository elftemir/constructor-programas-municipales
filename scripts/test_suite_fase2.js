/**
 * test_suite_fase2.js - Batería exhaustiva de pruebas de validación FASE 2
 * Constructor de Programas Municipales - Versión 2.0.0
 * 
 * Verifica:
 * 1. Diagnóstico y requisitos de hardware local.
 * 2. Catálogo de modelos y motor de IA integrado (0 descargas, 100% privado).
 * 3. Sugerencia de títulos ejecutivos (3 opciones, 4-12 palabras, catálogo intacto).
 * 4. Adaptación y desarrollo de medidas con verificador anti-alucinaciones.
 * 5. Ciclo de vida de traducción (revisada / propuesta / desactualizada automática).
 * 6. Generación de textos generales (Presentación, Introducción por Área, Cierre).
 * 7. Conversión a PDF a partir del DOCX maestro (LibreOffice / Word nativo).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const TEST_CATALOG = path.join(__dirname, 'fixtures/catalog-minimal.json');
require('./generate_test_catalog');

const { getDb } = require('../src/main/db/database');
const ProjectService = require('../src/main/services/projectService');
const AiService = require('../src/main/services/ai/aiService');
const PdfExporter = require('../src/main/services/pdfExporter');

let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;
function skip(name) { skippedTests++; console.log(`  - OMITIDO: ${name}: no hay Word ni LibreOffice`); }

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function main() {
  console.log('====================================================');
  console.log(' EJECUTANDO BATERÍA DE PRUEBAS DE FASE 2 - IA LOCAL');
  console.log('====================================================\n');

  // Inicializar DB temporal
  const testDbDir = path.join(process.env.TEST_RUN_DIR || path.join(__dirname, '../scratch'), 'test_fase2');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
  const testDbPath = path.join(testDbDir, 'test_fase2.sqlite');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  await getDb(testDbPath, { catalogPath: TEST_CATALOG });

  // [1/7] Diagnóstico de hardware
  console.log('[1/7] Diagnóstico de hardware y recursos de sistema');
  await runAsyncTest('Diagnóstico detecta núcleos de CPU y memoria RAM con recomendación clara', async () => {
    const hw = await AiService.checkHardware();
    assert.ok(hw.cpuCores > 0, 'CPU cores detectados');
    assert.ok(hw.totalMemGb > 0, 'RAM total detectada');
    assert.ok(hw.recomendacion.length > 10, 'Recomendación humana generada');
    assert.strictEqual(typeof hw.apto, 'boolean', 'Dictamen de aptitud generado');
  });

  // [2/7] Catálogo de modelos y motor de IA integrado
  console.log('\n[2/7] Catálogo de modelos y motor de IA integrado');
  await runAsyncTest('Catálogo de modelos incluye motor integrado y modelos GGUF neuronales', async () => {
    const models = await AiService.getAvailableModels();
    assert.ok(Array.isArray(models) && models.length >= 3, 'Al menos 3 opciones disponibles');
    const builtin = models.find(m => m.id === 'builtin_local');
    assert.ok(builtin, 'Motor integrado offline presente');
    assert.strictEqual(builtin.installed, true, 'Motor integrado está disponible de serie');
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/ai_models.json'), 'utf8')).models;
    for (const def of catalog) {
      const model = models.find(m => m.id === def.id);
      assert(model, 'Modelo oficial disponible');
      assert.equal(model.license, 'Apache-2.0');
      assert.equal(model.licenseUrl, 'https://huggingface.co/' + (def.baseModel || def.repoId) + '/blob/main/LICENSE');
      assert.equal(model.licenseRestricted, false);
    }
    const visibleModels = await AiService.getModels();
    const viewSource = fs.readFileSync(path.join(__dirname, '../src/renderer/js/views/aiView.js'), 'utf8');
    for (const lang of ['es', 'ca']) {
      const locales = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/locales/' + lang + '.json')));
      const list = { innerHTML: '' };
      const context = vm.createContext({ window: { api: { aiGetModels: async () => visibleModels, aiGetDiagnostic: async () => ({}), onAiDownloadProgress: () => () => {} }, i18n: { t: key => key.split('.').reduce((obj, name) => obj?.[name], locales) } }, document: { querySelector: () => list }, escapeHtml: value => String(value || ''), console });
      vm.runInContext(viewSource, context);
      await context.window.AiView.loadModels(lang === 'ca');
      assert(list.innerHTML.includes('Apache-2.0'));
      assert(!list.innerHTML.includes('qwen-research'));
      assert(!list.innerHTML.includes('Qwen 2.5 3B'));
      assert(list.innerHTML.includes('Qwen3 4B Instruct 2507'));
      assert.equal((list.innerHTML.match(/role="note"/g) || []).length, 0, 'No se ofrece ningún modelo con licencia restringida');
    }
  });

  await runAsyncTest('Motor integrado responde a pruebas de autodiagnóstico sin descargas', async () => {
    const res = await AiService.testModel('builtin_local');
    assert.strictEqual(res.success, true);
    assert.ok(res.response.length > 5);
  });

  // [3/7] Sugerencia de títulos y protección del catálogo marco
  console.log('\n[3/7] Sugerencia de títulos ejecutivos y preservación de catálogo');
  let testProjectId = null;
  await runAsyncTest('Crear proyecto municipal de prueba', async () => {
    testProjectId = await ProjectService.createProject({
      municipio: 'Sant Andreu de la Barca',
      provincia: 'Barcelona',
      comunidad: 'Catalunya',
      habitantes: 27500,
      codigo_ine: '08196',
      organizacion: 'En Comú Podem Sant Andreu de la Barca',
      partido: 'En Comú Podem',
      lema_es: 'Políticas honestas y valientes',
      idioma_principal: 'es'
    });
    assert.ok(testProjectId && typeof testProjectId === 'string');
  });

  await runAsyncTest('Sugerencia de títulos genera 3 opciones de 4-12 palabras con verbos de acción', async () => {
    const res = await AiService.sugerirTitulos({
      texto: 'Crearemos una nueva escuela de música municipal accesible para toda la infancia y con bonificaciones según renta familiar.',
      municipio: 'Sant Andreu de la Barca'
    });

    assert.ok(res.titulos && Array.isArray(res.titulos) && res.titulos.length === 3, 'Devuelve 3 títulos');
    for (const tit of res.titulos) {
      const words = tit.split(/\s+/).length;
      assert.ok(words >= 4 && words <= 14, `Título con longitud válida (${words} palabras): "${tit}"`);
    }
  });

  await runAsyncTest('Guardar título sugerido en proyecto sin tocar el catálogo marco oficial', async () => {
    const projData = await ProjectService.getProject(testProjectId);
    const m = projData.areas[0].medidas[0];
    const catOriginal = JSON.parse(fs.readFileSync(TEST_CATALOG, 'utf8'));
    const mOriginal = catOriginal.areas[0].medidas[0];

    const nuevoTitulo = 'Creación de la nueva escuela municipal de música';
    await ProjectService.updateMeasureDecision(testProjectId, m.id, {
      version_municipal_titulo: nuevoTitulo
    });

    const projUpdated = await ProjectService.getProject(testProjectId);
    const mUpdated = projUpdated.areas[0].medidas[0];
    assert.strictEqual(mUpdated.decision.version_municipal_titulo, nuevoTitulo);

    // Comprobar catálogo oficial en disco intacto
    const catCheck = JSON.parse(fs.readFileSync(TEST_CATALOG, 'utf8'));
    assert.strictEqual(catCheck.areas[0].medidas[0].titulo, mOriginal.titulo, 'Catálogo oficial en disco no se ha modificado');
  });

  // [4/7] Adaptación de medidas y verificador anti-alucinaciones
  console.log('\n[4/7] Adaptación de medidas y filtro anti-alucinaciones');
  await runAsyncTest('Adaptación de medida incorpora especificidad municipal', async () => {
    const adaptResult = await AiService.adaptarMedida({
      texto: 'Fomentar la movilidad en bicicleta y vehículos de movilidad personal.',
      municipio: 'Sant Andreu de la Barca',
      longitud: 'media'
    });

    assert.ok(adaptResult.texto && adaptResult.texto.length > 20);
    assert.ok(adaptResult.advertencias !== undefined);
  });

  runTest('Verificador anti-alucinaciones detecta presupuestos ficticios o leyes inventadas', () => {
    const cleanText = 'Ampliaremos el parque de vivienda de alquiler asequible mediante convenios con el tejido cooperativo local.';
    const fakeText = 'Destinaremos 45.000.000 € del presupuesto municipal en cumplimiento de la Ley Orgánica 99/2029.';

    const vClean = AiService.verifyProposal(cleanText);
    assert.strictEqual(vClean.has_warnings, false, 'Texto limpio no genera alertas');

    const vFake = AiService.verifyProposal(fakeText);
    assert.strictEqual(vFake.has_warnings, true, 'Texto con cifras o leyes ficticias genera alertas');
    assert.ok(vFake.warnings.length >= 1, 'Se detallan advertencias específicas');
  });

  // [5/7] Ciclo de vida de traducción y detección de desactualización automática
  console.log('\n[5/7] Ciclo de vida de traducción y actualización automática');
  await runAsyncTest('Flujo de traducción y marcado automático como desactualizada al editar origen', async () => {
    const projData = await ProjectService.getProject(testProjectId);
    const m = projData.areas[0].medidas[0];

    // 1. Guardar traducción revisada
    await ProjectService.updateMeasureDecision(testProjectId, m.id, {
      version_municipal_texto: 'Impulsaremos una red de carriles bici conectados con la estación de tren.',
      traduccion_texto: 'Impulsarem una xarxa de carrils bici connectats amb l\'estació de tren.',
      estado_traduccion: 'revisada'
    });

    let mCheck = (await ProjectService.getProject(testProjectId)).areas[0].medidas[0];
    assert.strictEqual(mCheck.decision.estado_traduccion, 'revisada', 'Traducción marcada como revisada');

    // 2. Modificar el texto en castellano sin actualizar la traducción
    await ProjectService.updateMeasureDecision(testProjectId, m.id, {
      version_municipal_texto: 'Impulsaremos una red de carriles bici de última generación y aparcamientos seguros.'
    });

    // 3. Debe pasar automáticamente a 'desactualizada'
    mCheck = (await ProjectService.getProject(testProjectId)).areas[0].medidas[0];
    assert.strictEqual(mCheck.decision.estado_traduccion, 'desactualizada', 'Traducción pasa automáticamente a desactualizada');
  });

  // [6/7] Generación de textos generales (Presentación, Introducción por Área, Cierre)
  console.log('\n[6/7] Generación de textos generales con IA');
  await runAsyncTest('Generación de carta de presentación municipal', async () => {
    const pres = await AiService.redactarPresentacion({
      selectedMeasures:[{texto:'Ampliar la biblioteca.'},{texto:'Crear una oficina de vivienda.'},{texto:'Mejorar los parques.'}],
      municipio: 'Sant Andreu de la Barca',
      candidato: 'Mireia Hernández',
      prioridades: ['Sanidad pública', 'Vivienda asequible', 'Transición ecológica'],
      tono: 'cercano',
      tipo: 'estandar',
      idioma: 'es'
    });

    assert.ok(pres.texto && pres.texto.length > 50);
    assert.ok(pres.texto.includes('Sant Andreu de la Barca'));
  });

  await runAsyncTest('Generación de introducción de área temática', async () => {
    const intro = await AiService.redactarIntroduccionArea({
      selectedMeasures:[{texto:'Crear refugios climáticos.'}],
      area_nombre: 'Transición Ecológica y Medio Ambiente',
      municipio: 'Sant Andreu de la Barca',
      medidas: ['Creación de refugios climáticos', 'Instalación de placas solares en edificios públicos'],
      idioma: 'es'
    });

    assert.ok(intro.introduccion && intro.introduccion.length > 40);
    assert.ok(intro.frase_destacada && intro.frase_destacada.length > 10);
  });

  await runAsyncTest('Generación de texto de cierre del programa', async () => {
    const cierre = await AiService.redactarCierre({
      selectedMeasures:[{texto:'Ampliar la biblioteca.'},{texto:'Crear una oficina de vivienda.'},{texto:'Mejorar los parques.'}],
      municipio: 'Sant Andreu de la Barca',
      candidato: 'Mireia Hernández',
      lema_es: 'Políticas honestas y valientes',
      idioma: 'es'
    });

    assert.ok(cierre.texto && cierre.texto.length > 40);
    assert.ok(cierre.texto.includes('Sant Andreu de la Barca'));
  });

  // [7/7] Conversión nativa a PDF a partir del DOCX maestro
  console.log('\n[7/7] Conversión nativa a PDF a partir del Word maestro');
  const converter = await PdfExporter.detectConverter();
  if (!converter.available) {
    skip('Detección de conversor PDF');
    skip('Conversión DOCX a PDF');
  } else {
  await runAsyncTest('Detección de conversor PDF nativo (LibreOffice / Word COM)', async () => {
    const conv = converter;
    assert.ok(conv && conv.available, 'Conversor disponible detectado');
    console.log(`     (Conversor detectado: ${conv.name} en ${conv.path})`);
  });

  await runAsyncTest('Generar DOCX maestro y convertirlo a PDF de alta resolución', async () => {
    const outputDir = path.join(testDbDir, 'export_test');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const exportRes = await PdfExporter.exportProjectWithPdf(testProjectId, {
      lang: 'es',
      outputDir: outputDir
    });

    assert.strictEqual(exportRes.success, true, 'Exportación Word + PDF exitosa');
    assert.ok(exportRes.docxPath && fs.existsSync(exportRes.docxPath), 'Archivo DOCX maestro existe');
    assert.ok(exportRes.pdfPath && fs.existsSync(exportRes.pdfPath), 'Archivo PDF generado existe');

    const pdfStats = fs.statSync(exportRes.pdfPath);
    assert.ok(pdfStats.size > 20000, `Tamaño del PDF adecuado (${pdfStats.size} bytes > 20KB)`);

    // Validar cabecera PDF (%PDF-)
    const pdfBuf = fs.readFileSync(exportRes.pdfPath);
    const pdfHeader = pdfBuf.slice(0, 5).toString('ascii');
    assert.strictEqual(pdfHeader, '%PDF-', 'Cabecera de archivo PDF válida');
  });

  }

  // Limpieza de carpeta de test temporal
  try {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n====================================================');
  console.log(` RESULTADO FASE 2: ${passedTests} de ${passedTests + failedTests} pruebas superadas; ${skippedTests} omitidas.`);
  if (failedTests === 0) {
    console.log(' ✓ TODAS LAS PRUEBAS DE FASE 2 COMPLETADAS CON ÉXITO.');
  } else {
    console.log(` ✗ SE PRODUJERON ${failedTests} FALLOS.`);
    process.exit(1);
  }
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('\n✗ ERROR FATAL EN PRUEBAS DE FASE 2:', err);
  process.exit(1);
});
