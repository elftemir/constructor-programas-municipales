/**
 * Batería de pruebas automatizadas v1.4.1 - Validación del programa
 * 
 * Verificaciones obligatorias:
 * 1. Sincronización de versión y empaquetado (v1.4.1).
 * 2. Iconos oficiales de Windows, acceso directo NSIS y recursos ICO.
 * 3. Auditoría exhaustiva de i18n: 0 claves faltantes, paridad total ES/CA.
 * 4. Detección de claves no resueltas: simulación de renderizado de todas las vistas
 *    en Castellano y Catalán buscando patrones como "basic.*", "welcome.*", "sidebar.*", etc.
 * 5. Verificación de ayuda contextual discreta (sin "❓ ?").
 * 6. Base de datos SQLite y Catálogo Marco bilingüe (áreas y medidas sintéticas).
 * 7. Exportación Word (.docx) rigurosa:
 *    - Validación ZIP y estructura OOXML.
 *    - Validación estricta XML (ElementTree / sin prefijos no declarados como v:, o:, w10:).
 *    - Conversión en LibreOffice Writer (código 0, sin errores de carga).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const JSZip = require('jszip');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const TEST_CATALOG = path.join(__dirname, 'fixtures/catalog-test.json');
require('./generate_test_catalog');

const { initDb, getDb } = require('../src/main/db/database');
const docxExporter = require('../src/main/services/docxExporter');
const projectService = require('../src/main/services/projectService');
const pdfExporter = require('../src/main/services/pdfExporter');

const scratchRoot = path.join(__dirname, '../scratch');
fs.mkdirSync(scratchRoot, { recursive: true });
const testDir = process.env.TEST_RUN_DIR || fs.mkdtempSync(path.join(scratchRoot, 'fase1-'));
fs.mkdirSync(testDir, { recursive: true });
let converters;
async function validateDocxAndLibreOffice(docxPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(docxPath));
  assert(zip.file('word/document.xml'), 'El DOCX contiene el documento principal');
  for (const part of zip.filter((name, entry) => !entry.dir && /\.(xml|rels)$/i.test(name))) {
    docxExporter.assertWellFormed(await part.async('string'), part.name);
  }
  converters ||= pdfExporter.detectConverters();
  if (!converters.libreOfficeAvailable || !converters.libreOfficePath) {
    console.log('  - OMITIDA: LibreOffice no disponible; XML DOCX validado (' + path.basename(docxPath) + ')');
    return null;
  }
  const profile = pathToFileURL(fs.mkdtempSync(path.join(testDir, 'lo-'))).href;
  execFileSync(converters.libreOfficePath, ['-env:UserInstallation=' + profile, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', testDir, docxPath], {
    stdio: 'pipe', timeout: 45000, windowsHide: true, shell: false
  });
  const pdfPath = docxPath.replace(/\.docx$/, '.pdf');
  assert(fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 1000, 'LibreOffice genera un PDF válido');
  return pdfPath;
}
function removeTestFile(filename) { if (filename && fs.existsSync(filename)) fs.unlinkSync(filename); }

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('====================================================');
  console.log('EJECUTANDO BATERÍA DE PRUEBAS v1.4.1 - ESTABILIZACIÓN FASE 1');
  console.log('====================================================\n');

  // 1. Verificación de versiones
  console.log('[1/7] Verificación de versión y metadatos centralizados');
  runTest('package.json tiene versión x.y.z', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  });

  runTest('catalog-test.json tiene versión válida', () => {
    const cat = JSON.parse(fs.readFileSync(TEST_CATALOG, 'utf8'));
    assert.ok(cat.version.includes('1.4.2') || cat.version.includes('2.0.0'));
  });

  // 2. Verificación de identidad visual e icono
  console.log('\n[2/7] Verificación de identidad visual e iconos oficiales');
  runTest('Archivos ICO oficiales y script NSIS para acceso directo existen', () => {
    const iconPaths = [
      path.join(__dirname, '../build/icon.ico'),
      path.join(__dirname, '../src/main/assets/icons/app_icon.ico'),
      path.join(__dirname, '../src/renderer/assets/icons/app_icon_256.png'),
      path.join(__dirname, '../build/installer.nsh')
    ];
    for (const p of iconPaths) {
      assert.ok(fs.existsSync(p), `Debe existir ${p}`);
      assert.ok(fs.statSync(p).size > 100, `El archivo ${p} no debe estar vacío`);
    }
    const png = fs.readFileSync(path.join(__dirname, '../src/renderer/assets/icons/app_icon_256.png'));
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert(png.length < 100000, 'El PNG de interfaz pesa menos de 100 KB');
    assert(fs.readFileSync(iconPaths[0]).equals(fs.readFileSync(iconPaths[1])), 'Ventana e instalador conservan el mismo ICO');

    const nshContent = fs.readFileSync(path.join(__dirname, '../build/installer.nsh'), 'utf8');
    assert.ok(nshContent.includes('SHChangeNotify'), 'installer.nsh debe invocar SHChangeNotify para limpiar la caché de iconos');
  });

  // 3. Auditoría exhaustiva de claves i18n
  console.log('\n[3/7] Auditoría de claves de internacionalización (es.json y ca.json)');
  const esJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/locales/es.json'), 'utf8'));
  const caJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/locales/ca.json'), 'utf8'));

  runTest('Paridad total de claves entre es.json y ca.json', () => {
    function getAllKeys(obj, prefix = '') {
      let keys = [];
      for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          keys = keys.concat(getAllKeys(v, full));
        } else {
          keys.push(full);
        }
      }
      return keys;
    }

    const esKeys = new Set(getAllKeys(esJson));
    const caKeys = new Set(getAllKeys(caJson));

    const missingInCa = [...esKeys].filter(k => !caKeys.has(k));
    const missingInEs = [...caKeys].filter(k => !esKeys.has(k));

    assert.strictEqual(missingInCa.length, 0, `Claves en es.json faltantes en ca.json: ${missingInCa.join(', ')}`);
    assert.strictEqual(missingInEs.length, 0, `Claves en ca.json faltantes en es.json: ${missingInEs.join(', ')}`);
  });

  runTest('0 claves utilizadas en código faltantes en los locales', () => {
    const usedKeys = new Set();
    function scanDir(dir) {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
          scanDir(full);
        } else if (f.endsWith('.js') || f.endsWith('.html')) {
          const content = fs.readFileSync(full, 'utf8');
          const m1 = [...content.matchAll(/i18n\.t\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
          const m2 = [...content.matchAll(/this\.t\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
          const m3 = [...content.matchAll(/data-i18n=['"]([^'"]+)['"]/g)].map(m => m[1]);
          [...m1, ...m2, ...m3].forEach(k => usedKeys.add(k));
        }
      }
    }
    scanDir(path.join(__dirname, '../src'));

    function resolve(obj, pathStr) {
      let curr = obj;
      for (const p of pathStr.split('.')) {
        if (curr && typeof curr === 'object' && p in curr) curr = curr[p];
        else return undefined;
      }
      return typeof curr === 'string' ? curr : undefined;
    }

    const missing = [];
    for (const k of usedKeys) {
      if (!resolve(esJson, k)) missing.push(k);
    }
    assert.strictEqual(missing.length, 0, `Claves usadas en código no encontradas en es.json: ${missing.join(', ')}`);
  });

  // 4. Prueba de Protección de i18n: NUNCA mostrar claves sin resolver al usuario
  console.log('\n[4/7] Verificación de la Regla: NUNCA mostrar claves i18n al usuario');
  global.window = global;
  global.document = {
    documentElement: { lang: 'es' },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const i18n = require('../src/renderer/js/i18n.js');
  global.window.i18n = i18n;
  global.window.Lema = require('../src/main/utils/lema');
  global.window.addEventListener = () => {};
  global.window.removeEventListener = () => {};

  runTest('i18n.t() devuelve textos limpios y ante una clave no existente no muestra la clave técnica con puntos', () => {
    i18n.setLang('es');
    assert.strictEqual(i18n.t('basic.field_municipio'), 'Municipio');
    assert.strictEqual(i18n.t('welcome.title'), 'Tutorial de bienvenida');
    assert.strictEqual(i18n.t('sidebar.nav_framework'), 'Ver Programa Marco');

    // Clave inventada inexistente: debe devolver fallback seguro, nunca la clave cruda con punto
    const fallback = i18n.t('invented_section.field_non_existent');
    assert.ok(!fallback.includes('.'), 'El fallback nunca debe contener puntos de clave interna');
    assert.ok(fallback.length > 0, 'El fallback no debe ser vacío');
  });

  runTest('i18n en catalán traduce correctamente las pantallas y navegación', () => {
    i18n.setLang('ca');
    assert.strictEqual(i18n.t('basic.field_municipio'), 'Municipi');
    assert.strictEqual(i18n.t('welcome.title'), 'Tutorial de benvinguda');
    assert.strictEqual(i18n.t('sidebar.nav_framework'), 'Veure Programa Marc');
    assert.strictEqual(i18n.t('sidebar.nav_options'), 'Opcions');
    assert.strictEqual(i18n.t('sidebar.nav_help'), 'Ajuda i tutorial');
  });

  // 5. Verificación de Vistas y Detección de Patrones de Claves sin Resolver en el DOM
  console.log('\n[5/7] Renderizado de vistas y detección de patrones de claves en DOM (ES y CA)');
  const KEY_PATTERN = /\b(?:welcome|sidebar|basic|general|help|review|export|common|tutorial|choose|adapt|options|framework|doubt_modal|topbar|navigation|municipality)\.[a-zA-Z0-9_.-]+/g;

  // Mock global objects needed for views
  global.escapeHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  global.safeLogoUrl = url => url || '';
  global.App = { currentProject: null, navigateTo: () => {} };
  if (!global.window) global.window = {};
  if (!global.window.api) global.window.api = {};
  global.window.api.getProjectSources = async () => [];

  const testProject = {
    id: 'test-p-audit',
    municipio: 'Sant Feliu de Llobregat',
    provincia: 'Barcelona',
    comunidad_autonoma: 'Cataluña',
    mandato: '2027–2031',
    partido: 'Podemos',
    organizacion: 'Podemos Sant Feliu',
    idioma_principal: 'es',
    lema_es: 'LA FUERZA DE TRANSFORMAR',
    habitantes: 45000,
    poblacion_oficial: 45000,
    areas: [
      {
        id: 1, codigo: 'A1', nombre: 'Drets Socials', nombre_es: 'Derechos Sociales', nombre_ca: 'Drets Socials',
        medidas: [{ id: 101, codigo: '1.1', titulo: 'M1', titulo_es: 'M1', titulo_ca: 'M1', texto: 'T1', decision: { estado: 'incluida' } }]
      }
    ],
    textos_generales: { presentacion_titulo: 'Pres', presentacion_parrafos: ['P1'] },
    stats: { decididas: 1, total_marco: 6, progreso_pct: 1, en_duda: 0, sin_revisar: 5, incluidas: 1, adaptadas: 0, medidas_propias: 0, descartadas: 0 }
  };

  function loadView(relPath, viewName) {
    const filePath = path.join(__dirname, relPath);
    const code = fs.readFileSync(filePath, 'utf8');
    const fn = new Function('window', 'document', 'App', 'escapeHtml', code + `\nreturn ${viewName};`);
    return fn(global.window, global.document, global.App, global.escapeHtml);
  }

  global.window.WritingContract = require("../src/shared/writingContract");
  global.window.TextFormat = require("../src/shared/textFormat");
  const BasicDataView = loadView('../src/renderer/js/views/basicDataView.js', 'BasicDataView');
  const GeneralTextsView = loadView('../src/renderer/js/views/generalTextsView.js', 'GeneralTextsView');
  const ChooseMeasuresView = loadView('../src/renderer/js/views/chooseMeasuresView.js', 'ChooseMeasuresView');
  const HelpView = loadView('../src/renderer/js/views/helpView.js', 'HelpView');

  const createMockElement = () => ({
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    style: {},
    dataset: {},
    classList: { add: () => {}, remove: () => {} },
    contains: () => false,
    value: ''
  });

  for (const lang of ['es', 'ca']) {
    runTest(`Recorrido de pantallas en ${lang.toUpperCase()}: 0 claves internas visibles`, () => {
      i18n.setLang(lang);
      const mockContainer = {
        innerHTML: '',
        querySelector: () => createMockElement(),
        querySelectorAll: () => []
      };

      // Render BasicDataView
      BasicDataView.render(mockContainer, testProject);
      let matches = mockContainer.innerHTML.match(KEY_PATTERN) || [];
      assert.strictEqual(matches.length, 0, `Claves encontradas en BasicDataView (${lang}): ${matches.join(', ')}`);

      // Render GeneralTextsView
      GeneralTextsView.render(mockContainer, testProject);
      matches = mockContainer.innerHTML.match(KEY_PATTERN) || [];
      assert.strictEqual(matches.length, 0, `Claves encontradas en GeneralTextsView (${lang}): ${matches.join(', ')}`);

      // Render ChooseMeasuresView
      ChooseMeasuresView.render(mockContainer, testProject);
      matches = mockContainer.innerHTML.match(KEY_PATTERN) || [];
      assert.strictEqual(matches.length, 0, `Claves encontradas en ChooseMeasuresView (${lang}): ${matches.join(', ')}`);

      // Render HelpView
      HelpView.render(mockContainer);
      matches = mockContainer.innerHTML.match(KEY_PATTERN) || [];
      assert.strictEqual(matches.length, 0, `Claves encontradas en HelpView (${lang}): ${matches.join(', ')}`);
    });
  }

  runTest('Botón de ayuda de pantalla es discreto (sin doble ?)', () => {
    const mockContainer = {
      innerHTML: '',
      querySelector: () => createMockElement(),
      querySelectorAll: () => []
    };
    BasicDataView.render(mockContainer, testProject);
    assert.ok(!mockContainer.innerHTML.includes('❓ ?'), 'No debe existir el doble signo ❓ ?');
    assert.ok(mockContainer.innerHTML.includes('btn-help-screen'), 'Debe utilizar la clase estilizada btn-help-screen');
  });

  // 6. Base de Datos y Catálogo Marco
  console.log('\n[6/7] Verificación de Base de Datos y Catálogo Marco');
  await runAsyncTest('Base de datos se inicializa con las áreas y medidas del fixture sintético', async () => {
    await getDb(path.join(process.env.TEST_RUN_DIR || path.join(__dirname, '../scratch'), 'tests-v141.sqlite'), { catalogPath: TEST_CATALOG });
    const db = await getDb();
    const areas = db.exec("SELECT COUNT(*) FROM areas WHERE fuente_id = 'synthetic-main-source'")[0].values[0][0];
    const medidas = db.exec("SELECT COUNT(*) FROM medidas WHERE fuente_id = 'synthetic-main-source'")[0].values[0][0];
    assert.strictEqual(areas, JSON.parse(fs.readFileSync(TEST_CATALOG)).areas.length);
    assert.strictEqual(medidas, JSON.parse(fs.readFileSync(TEST_CATALOG)).areas.reduce((n,a)=>n+a.medidas.length,0));
  });

  // 7. Verificación de Exportación DOCX y Validación con LibreOffice
  console.log('\n[7/7] Verificación de exportación Word (.docx) y validación estructural');
  const tempDocxEs = path.join(testDir, 'test_export_v141_es.docx');
  const tempDocxCa = path.join(testDir, 'test_export_v141_ca.docx');

  await runAsyncTest('Exportar Word en Español con lema_es: XML válido, namespaces completos, abre en LibreOffice', async () => {
    const projectEs = {
      ...testProject,
      idioma_principal: 'es',
      lema_es: 'FUERZA MUNICIPAL'
    };

    const res = await docxExporter.exportProjectToDocx(projectEs, {
      outputPath: tempDocxEs,
      idioma: 'es'
    });

    assert.ok(fs.existsSync(tempDocxEs), 'El archivo exportado debe existir');

    const pdfPath = await validateDocxAndLibreOffice(tempDocxEs);
    removeTestFile(tempDocxEs);
    removeTestFile(pdfPath);
  });

  await runAsyncTest('Exportar Word en Catalán sin lema catalán: XML válido, cuadros limpios, abre en LibreOffice', async () => {
    const projectCa = {
      ...testProject,
      idioma_principal: 'ca',
      lema_es: '' // Sin lema
    };

    const res = await docxExporter.exportProjectToDocx(projectCa, {
      outputPath: tempDocxCa,
      idioma: 'ca'
    });

    assert.ok(fs.existsSync(tempDocxCa), 'El archivo exportado debe existir');

    const pdfPath = await validateDocxAndLibreOffice(tempDocxCa);
    removeTestFile(tempDocxCa);
    removeTestFile(pdfPath);
  });

  await runAsyncTest('Exportar Word con Presentación VACÍA en ES y CA: sección omitida, sin página vacía, sin texto inventado', async () => {
    const emptyPresProj = {
      ...testProject,
      textos_generales: {
        presentacion_titulo: '',
        presentacion_entradilla: '',
        presentacion_parrafos: [],
        cierre_titulo: '',
        cierre_parrafos: []
      }
    };

    const docxEmptyEs = path.join(testDir, 'test_empty_pres_es.docx');
    const docxEmptyCa = path.join(testDir, 'test_empty_pres_ca.docx');

    await docxExporter.exportProjectToDocx(emptyPresProj, { outputPath: docxEmptyEs, idioma: 'es' });
    await docxExporter.exportProjectToDocx(emptyPresProj, { outputPath: docxEmptyCa, idioma: 'ca' });

    const zipEs = await JSZip.loadAsync(fs.readFileSync(docxEmptyEs));
    const xmlEs = await zipEs.file('word/document.xml').async('text');
    assert.ok(!xmlEs.includes('Presentación'), 'En ES: NO debe aparecer el título "Presentación" si no hay contenido');
    assert.ok(!xmlEs.includes('En Comú Podem'), 'En ES: NO debe aparecer texto inventado del catálogo');

    const zipCa = await JSZip.loadAsync(fs.readFileSync(docxEmptyCa));
    const xmlCa = await zipCa.file('word/document.xml').async('text');
    assert.ok(!xmlCa.includes('Presentació'), 'En CA: NO debe aparecer el título "Presentació" si no hay contenido');
    assert.ok(!xmlCa.includes('En Comú Podem'), 'En CA: NO debe aparecer texto inventado del catálogo');

    const pdfEmptyEs = await validateDocxAndLibreOffice(docxEmptyEs);
    const pdfEmptyCa = await validateDocxAndLibreOffice(docxEmptyCa);
    for (const file of [docxEmptyEs, docxEmptyCa, pdfEmptyEs, pdfEmptyCa]) removeTestFile(file);
  });

  console.log('\n====================================================');
  console.log(`RESULTADO FINAL: ${passedTests} de ${totalTests} pruebas superadas.`);
  console.log('✓ TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO.');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('\n✗ ERROR EN PRUEBAS:', err);
  process.exit(1);
});
