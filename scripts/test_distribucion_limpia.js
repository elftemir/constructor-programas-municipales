// All profiles are isolated BEFORE loading application services. No installer is executed.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const vm = require('vm'); const crypto = require('crypto'); const JSZip = require('jszip');
const root = path.resolve(__dirname, '..');
const base = process.env.TEST_RUN_DIR || path.join(root, 'scratch');
fs.mkdirSync(base, { recursive: true });
const dir = fs.mkdtempSync(path.join(base, 'clean-distribution-'));
for (const [key, folder] of Object.entries({ APPDATA: 'roaming', LOCALAPPDATA: 'local', USERPROFILE: 'user', TEMP: 'temp', TMP: 'temp' })) {
  process.env[key] = path.join(dir, folder); fs.mkdirSync(process.env[key], { recursive: true });
}
const database = require('../src/main/db/database');
const projects = require('../src/main/services/projectService');
const sources = require('../src/main/services/sourceProgramService');
const { ContentUpdateService } = require('../src/main/services/contentUpdateService');
const { getDatabasePath } = require('../src/main/utils/paths');
const pkg = require('../package.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function node() {
  return { innerHTML: '', textContent: '', style: {}, dataset: {}, value: '', checked: false,
    classList: { add() {}, remove() {}, toggle() {} }, addEventListener(event, cb) { this[event] = cb; },
    querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() {} };
}
function viewContext(lang, api) {
  const elements = new Map(); const container = node();
  container.querySelector = selector => {
    if (!container.innerHTML.includes(selector.slice(1))) return null;
    if (!elements.has(selector)) elements.set(selector, node()); return elements.get(selector);
  };
  const locale = require('../src/renderer/locales/' + lang + '.json');
  const app = { currentProject: null, updaterState: {}, contentUpdaterState: {},
    navigateTo: async name => { app.lastView = name; },
    openContentManager: async () => { app.managerOpened = true; }, showScreenHelp() {}, updateTopBar() {},
    ensureProjectHydrated: async () => null, updateStepStates() {}, renderGlobalUpdateBanner() {} };
  const context = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval,
    escapeHtml: value => String(value ?? ''), App: app,
    document: { querySelector: selector => ['#view-container','#main-content'].includes(selector) ? container : null,
      querySelectorAll: () => [], getElementById: () => null, addEventListener() {} },
    window: { App: app, api, i18n: { getLang: () => lang,
      t: key => key.split('.').reduce((value, part) => value?.[part], locale) ?? key },
      ImportReviewView: { openImportModal() { app.importOpened = true; } },
      Tutorial: { getScreenHelp: () => null } } });
  return { context, container, app };
}
async function makeFixture(service) {
  const id = 'clean-distribution-fixture';
  const manifest = { schema_version: 1, content_id: id, content_type: 'programa_marco', content_version: '1.0.0',
    min_app_version: '3.1.3', title: { es: 'Prueba técnica NO OFICIAL', ca: 'Prova tècnica NO OFICIAL' },
    official: false, is_test_fixture: true, cycle: '2027-2031', languages: {}, stats: { total_areas: 1, total_measures: 1 } };
  const zip = new JSZip();
  for (const lang of ['es', 'ca']) {
    const data = Buffer.from(JSON.stringify({ content_id: id, content_version: '1.0.0', language: { code: lang },
      areas: [{ area_id: 'technical-area', title: lang === 'es' ? 'Área técnica' : 'Àrea tècnica',
        measures: [{ measure_id: 'technical-measure', title: 'Test', text: lang === 'es' ? 'Texto sintético para verificar la instalación.' : 'Text sintètic per verificar la instal·lació.' }] }] }));
    const pdf = Buffer.from('%PDF-1.4\n% Synthetic test fixture\n%%EOF\n');
    manifest.languages[lang] = { code: lang, data: lang + '/data.json', pdf: lang + '/document.pdf',
      sha256_data: sha(data), sha256_pdf: sha(pdf) };
    zip.file(manifest.languages[lang].data, data, { createFolders: false });
    zip.file(manifest.languages[lang].pdf, pdf, { createFolders: false });
  }
  zip.file('manifest.json', JSON.stringify(manifest));
  const bytes = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(dir, 'fixture-local.zip'), bytes);
  const entry = { ...manifest, package: { filename: id + '.zip', size_bytes: bytes.length, sha256: sha(bytes),
    download_url: 'https://github.com/elftemir/constructor-programas-municipales-content/releases/download/test/fixture.zip' } };
  const checked = service.validateCatalogSchema({ schema_version: 1, programas_marco: [entry] }).programas_marco[0];
  service.validatedCatalogMap.set(id, checked);
  let calls = 0;
  service.fetchSecureBuffer = async url => { assert.equal(url, checked.package.download_url); calls++; return { buffer: fs.readFileSync(path.join(dir, 'fixture-local.zip')), redirects: [] }; };
  await service.installContentUpdate(id, { allowTestFixture: true });
  assert.equal(calls, 1, 'Local transport only; full ZIP/hash/alignment/install pipeline runs without network');
}
async function main() {
  const db = await database.getDb();
  assert(fs.existsSync(getDatabasePath()), 'Fresh database created');
  for (const table of ['programas_fuente', 'areas', 'medidas', 'proyectos', 'fichas_municipios', 'catalogo_info', 'contenidos_instalados']) {
    assert.equal(db.exec('SELECT COUNT(*) FROM ' + table)[0].values[0][0], 0, table + ' starts empty');
  }
  assert.equal(await sources.getActive(), null);
  await assert.rejects(projects.createProject({ municipio: 'Prueba' }), error => error.code === 'ERR_NO_SOURCE');
  assert.equal((await projects.getProjects()).length, 0, 'No partial project created');
  console.log('PASS clean first startup: database created; 0 sources, areas, measures, projects, municipal records and contents; no fake source.');
  const api = { getProjects: () => projects.getProjects(), getProject: id => projects.getProject(id),
    getSourcePrograms: all => sources.getAll(all), getActiveSourceProgram: () => sources.getActive(),
    getLastOpenedProjectId: async () => null, getAppVersion: async () => ({ version: pkg.version, author: pkg.author.name }), getExportDir: async () => dir,
    getContentUpdateStatus: async () => ({ status: 'IDLE' }), getUpdateStatus: async () => ({ status: 'IDLE' }),
    aiGetSpecs: async () => ({ cpu: {}, ram: {}, disk: {} }), aiGetDiagnostic: async () => ({}), aiGetModels: async () => [] };
  for (const lang of ['es', 'ca']) {
    const { context, container, app } = viewContext(lang, api);
    for (const [file, name] of [['homeView.js','HomeView'],['sourceProgramsView.js','SourceProgramsView'],
      ['programsView.js','ProgramsView'],['optionsView.js','OptionsView'],['helpView.js','HelpView'],['aiView.js','AiView']]) {
      vm.runInContext(fs.readFileSync(path.join(root, 'src/renderer/js/views', file), 'utf8'), context);
      const view = vm.runInContext(name, context); assert(view, name);
      await view.render(container); assert(container.innerHTML.length > 100, name + ' renders without a source');
      if (name === 'HomeView') {
        assert(container.innerHTML.includes(lang === 'es' ? 'Todavía no tienes ningún Programa Marco' : 'Encara no tens cap Programa Marc'));
        await container.querySelector('#btn-clean-find').click(); assert(app.managerOpened);
        await container.querySelector('#btn-clean-import').click(); assert(app.importOpened);
      }
      if (name === 'OptionsView') assert(container.innerHTML.includes(pkg.version), 'About shows current version');
    }
    // Real navigation and real create modal guard redirect to the guided Home.
    vm.runInContext(fs.readFileSync(path.join(root, 'src/renderer/js/app.js'), 'utf8'), context);
    context.window.App = vm.runInContext('App', context);
    context.window.App.ensureProjectHydrated = async () => null;
    context.window.App.navigateTo = context.window.App.navigateTo.bind(context.window.App);
    context.App = context.window.App;
    for (const view of ['datos-basicos', 'areas-medidas', 'vista-previa', 'generar-documentos']) {
      await context.window.App.navigateTo(view); assert(container.innerHTML.includes(lang === 'es' ? 'Todavía no tienes' : 'Encara no tens'));
    }
    await context.window.App.showNewProjectModal();
    assert.equal(context.window.App.currentView, 'home', 'Create project has no fabricated source');
  }
  console.log('PASS empty screens ES/CA: Home/actions, source programs, My programs, create project, basic data/navigation, AI, Options/About, Help.');
  const service = new ContentUpdateService(); await makeFixture(service);
  const installed = await sources.getAll(false); assert.equal(installed.length, 1);
  const project = await projects.getProject(await projects.createProject({ municipio: 'Municipio de prueba', lema_es: 'Prueba', lema_ca: 'Prova' }));
  assert.equal(project.fuente_id, installed[0].id); assert.equal(project.areas.length, 1);
  assert.equal(project.areas[0].medidas.length, 1, 'One measure, with both languages');
  assert.equal(project.partido, 'Podemos'); assert.equal(project.mandato, '2027–2031');
  assert.equal(project.logo_path, null);
  console.log('PASS local content fixture: validated ZIP and hashes, source installed, bilingual project created without network.');
  const exporter = require('../src/main/services/docxExporter');
  for (const lang of ['es', 'ca']) {
    const empty = { ...project, municipio: '', organizacion: '', provincia: '', lema_es: null, lema_ca: null, logo_path: null, areas: [], textos_generales: {} };
    const exported = await exporter.exportProjectToDocx(empty, { idioma: lang, outputPath: path.join(dir, 'blank-' + lang + '.docx') });
    const zip = await JSZip.loadAsync(fs.readFileSync(exported.filePath));
    const xml = await zip.file('word/document.xml').async('string');
    const text = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
    assert(!/SANT ANDREU|PALLEJ[ÀA]/i.test(text), 'Blank cover never prints a sample municipality');
  }
  console.log('PASS blank DOCX cover ES/CA: no sample municipality, slogan or user logo.');
  const patterns = pkg.build.files;
  for (const pattern of ['!src/main/assets/data/catalogo_marco.json','!**/catalogo_*.json','!**/*.sqlite','!**/*.db','!**/*.pdf','!**/*.gguf','!scratch/**','!scripts/**','!test*/**','!content-fixtures/**','!data/models/**']) assert(patterns.includes(pattern), pattern);
  for (const allowed of ['data/ai_models.json','data/municipios_ine.csv','data/municipios_catalunya.json']) assert(patterns.includes(allowed));
  console.log('PASS build.files: program catalogues/databases/PDF/models/test artefacts excluded; AI and municipality metadata retained.');
  database.save(); database.closeDb(); await database.getDb();
  assert.equal((await projects.getProjects()).length, 1, 'Reopening keeps installed content and the user project');
  database.closeDb();
}
main().catch(error => { database.closeDb(); console.error(error); process.exitCode = 1; });
