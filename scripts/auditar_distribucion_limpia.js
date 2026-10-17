const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { spawnSync } = require('child_process'); const asar = require('@electron/asar');
const JSZip = require('jszip');
const https = require('https');
const { scanBufferPaths, loadCompilerWhitelist } = require('./auditar_rutas');
const {forbiddenContent}=require('./auditar_contenido_empaquetado');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.replace(/\\/g, '/');
const archiveMemberPath = value => path.normalize(value.replace(/[\\/]+/g, path.sep).replace(/^[\\/]+/, ''));
function listArchiveFiles(archive) {
  return asar.listPackage(archive).map(rel => slash(rel).replace(/^\/+/, ''))
    .filter(rel => !asar.statFile(archive, archiveMemberPath(rel)).files);
}
const permittedCatalog = rel => /(?:^|\/)(?:ai_models|municipios_catalunya|catalogo_modelos[^/]*|catalogo_municipios[^/]*)\.json$/i.test(rel);
function forbiddenPacked(rel) {
  if (/\.(?:sqlite3?|db|pdf|gguf|ggml)(?:$|-wal$|-shm$|-journal$)/i.test(rel)) return 'datos/documentos/modelos';
  if (/(?:^|\/)catalogo_[^/]*\.json$/i.test(rel) && !permittedCatalog(rel)) return 'catálogo de programas';
  if (/(?:^|\/)(?:scratch|content-fixtures|fixtures|test[^/]*|exportaciones|proyectos|backups|user-logos)(?:\/|$)/i.test(rel)) return 'carpeta de datos o pruebas';
  if (/^(?:src\/)?scripts\//i.test(rel)) return 'scripts de prueba';
  if (/(?:^|\/)(?:extracted_raw\.txt|catalogo_validacion\.html)$/i.test(rel)) return 'extracción privada';
  return null;
}
function privatePhrases(root) {
  const file = ['src/main/assets/data/catalogo_marco.json', 'data/catalogo_marco.json'].map(rel => path.join(root, rel)).find(fs.existsSync);
  if (!file) return { available: false, phrases: [] };
  const catalog = JSON.parse(fs.readFileSync(file)); const phrases = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.texto === 'string' || typeof value.texto_es === 'string') {
      const text = (value.texto_es || value.texto).replace(/\s+/g, ' ').trim();
      if (text.length > 70 && phrases.length < 4) phrases.push(text.slice(0, 180));
    }
    for (const item of Object.values(value)) if (typeof item === 'object') visit(item);
  }
  visit(catalog);
  return { available: true, phrases: [...new Set(phrases)] };
}
function walk(root, base = '') {
  return fs.readdirSync(path.join(root, base), { withFileTypes: true }).flatMap(entry => {
    const rel = slash(path.join(base, entry.name));
    if (entry.isSymbolicLink()) throw Error('Enlace inesperado en resources: ' + rel);
    return entry.isDirectory() ? walk(root, rel) : [rel];
  });
}
function fetchCatalog(url) {
  return new Promise(resolve => {
    const request = https.get(url, { headers: { 'User-Agent': 'CPM-clean-distribution-audit' } }, response => {
      if (response.statusCode !== 200) { response.resume(); resolve({ status: response.statusCode, warning: 'El catálogo no está disponible: HTTP ' + response.statusCode }); return; }
      const chunks = []; let length = 0;
      response.on('data', chunk => { length += chunk.length; if (length > 2*1024*1024) request.destroy(Error('Catálogo demasiado grande')); else chunks.push(chunk); });
      response.on('end', () => {
        try { resolve({ status: 200, data: JSON.parse(Buffer.concat(chunks)), checkedAt: new Date().toISOString() }); }
        catch (error) { resolve({ status: 200, warning: 'catalog.json no es JSON válido: ' + error.message }); }
      });
      response.on('error', error => resolve({ warning: 'No se pudo leer el catálogo: ' + error.message }));
    });
    request.setTimeout(20000, () => request.destroy(Error('Tiempo de consulta agotado')));
    request.on('error', error => resolve({ warning: 'Sin comprobación de red: ' + error.message }));
  });
}
async function auditPackage(root, options = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  const archive = path.join(root, 'dist/win-unpacked/resources/app.asar');
  const resources = path.dirname(archive); const errors = []; const findings = []; const compilerPaths = [];
  const compilerPolicy = loadCompilerWhitelist(root);
  const contentSource = asar.extractFile(archive, archiveMemberPath('src/main/services/contentUpdateService.js')).toString('utf8');
  const catalogUrl = contentSource.match(/const OFFICIAL_CATALOG_URL\s*=\s*'([^']+)'/)?.[1];
  if (catalogUrl !== 'https://raw.githubusercontent.com/elftemir/constructor-programas-municipales-content/main/catalog.json') errors.push('Repositorio de contenidos inesperado');
  if (pkg.build.publish?.[0]?.repo !== 'constructor-programas-municipales-updates') errors.push('Repositorio de actualizaciones inesperado');
  const remote = catalogUrl ? await fetchCatalog(catalogUrl) : { warning: 'No se encuentra la URL del catálogo' };
  // Use the exact requested CLI; --no-install prevents downloads or an unexpected asar version.
  const npxCli = process.env.npm_execpath
    ? path.join(path.dirname(process.env.npm_execpath), 'npx-cli.js')
    : path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
  const cli = spawnSync(process.execPath, [npxCli, '--no-install', 'asar', 'list', archive],
    { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (cli.status !== 0) throw Error('npx asar list falló: ' + cli.stderr);
  const fullList = cli.stdout.trim();
  const entries = listArchiveFiles(archive);
  const outer = walk(resources); const samples = options.privatePhrases ? {available: true, phrases: options.privatePhrases} : privatePhrases(root);
  const phraseResults = samples.phrases.map(text => ({ text, files: [] }));
  if (samples.available && phraseResults.length < 3) errors.push('No se han obtenido al menos tres frases reales del catálogo privado para contrastar');
  async function inspect(rel, bytes, inAsar) {
    const reason = forbiddenPacked(rel); if (reason) errors.push(rel + ': ' + reason);
    const contentReason=forbiddenContent(rel,bytes);if(contentReason)errors.push(rel+': '+contentReason);
    if(rel.startsWith('vendor/llama/')&&!/^vendor\/llama\/(cpu|vulkan)\/manifest\.json$/.test(rel)){
      if(compilerPolicy.vendorHashes?.[rel]!==hash(bytes))errors.push(rel+': SHA256 no coincide con el manifiesto oficial b11476');
    }
    const utf8 = bytes.toString('utf8');
    const utf16 = bytes.toString('utf16le');
    const routes = scanBufferPaths(rel,bytes,compilerPolicy);
    compilerPaths.push(...routes.allowed);
    for(const candidate of routes.blocked) {
      errors.push(rel+': '+candidate.reason); findings.push(rel+': RUTA PERSONAL (valor omitido)');
    }
    let searchable = utf8;
    if (/\.docx$/i.test(rel)) {
      const zip = await JSZip.loadAsync(bytes);
      searchable = (await Promise.all(Object.keys(zip.files).filter(name => /\.xml$/i.test(name)).map(name => zip.file(name).async('string')))).join('\n');
    }
    if (inAsar) {
      const normalized = searchable.replace(/\s+/g, ' ');
      for (const sample of phraseResults) if (normalized.includes(sample.text) || utf16.replace(/\s+/g, ' ').includes(sample.text)) sample.files.push(rel);
    }
  }
  for (const rel of entries) await inspect(rel, asar.extractFile(archive, archiveMemberPath(rel)), true);
  for (const rel of entries.filter(name=>name.startsWith('src/'))) {
    const source=path.join(root,rel);
    if (!fs.existsSync(source) || hash(fs.readFileSync(source))!==hash(asar.extractFile(archive,archiveMemberPath(rel)))) errors.push(rel+': contenido compilado distinto del código revisado');
  }
  for (const rel of outer.filter(rel => rel !== 'app.asar')) await inspect(rel, fs.readFileSync(path.join(resources, rel)), false);
  for (const sample of phraseResults) if (sample.files.length) errors.push('Texto del catálogo privado encontrado: ' + sample.files.join(', '));
  const extra = (pkg.build.extraResources || []).map(rule => JSON.stringify(rule));
  const resourceInventory = outer.map(rel => {
    const bytes = fs.readFileSync(path.join(resources, rel)); return `${rel}; ${bytes.length}; ${hash(bytes)}`;
  }).join('\n');
  // Execute only the unpacked Electron runtime as Node with brand-new profiles; never the installer.
  const scratch = path.join(root, 'scratch'); fs.mkdirSync(scratch, { recursive: true });
  const probeDir = fs.mkdtempSync(path.join(scratch, 'packaged-clean-'));
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', APPDATA: path.join(probeDir,'roaming'),
    LOCALAPPDATA: path.join(probeDir,'local'), USERPROFILE: path.join(probeDir,'user'), TEMP: path.join(probeDir,'temp'), TMP: path.join(probeDir,'temp'), CPM_ALLOW_TEST_CONTENT: '0' };
  for (const key of ['APPDATA','LOCALAPPDATA','USERPROFILE','TEMP']) fs.mkdirSync(env[key], { recursive: true });
  const probeFile = path.join(probeDir,'probe.cjs');
  fs.writeFileSync(probeFile, `const fs=require('fs');const path=require('path');const root=process.argv[2];\n(async()=>{const database=require(path.join(root,'src/main/db/database'));const paths=require(path.join(root,'src/main/utils/paths'));const db=await database.getDb();const counts={};for(const table of ['programas_fuente','medidas','proyectos','fichas_municipios','areas','contenidos_instalados'])counts[table]=db.exec('SELECT COUNT(*) FROM '+table)[0].values[0][0];if(!fs.existsSync(paths.getDatabasePath())||Object.values(counts).some(n=>n!==0))throw Error('Non-empty startup');database.closeDb();console.log('CLEAN_PACKAGED_RESULT='+JSON.stringify(counts));})().catch(e=>{console.error(e);process.exitCode=1;});`);
  if (remote.data) {
    const remoteFile = path.join(probeDir,'catalog.json'); fs.writeFileSync(remoteFile, JSON.stringify(remote.data));
    fs.appendFileSync(probeFile, `\ntry{const service=new(require(path.join(root,'src/main/services/contentUpdateService')).ContentUpdateService)();service.isPackagedApp=()=>true;const catalog=service.validateCatalogSchema(JSON.parse(fs.readFileSync(${JSON.stringify(remoteFile)})));console.log('CATALOG_SCHEMA_RESULT='+JSON.stringify({raw_entries:${remote.data?.programas_marco?.length ?? 0},entries:catalog.programas_marco.length,official:catalog.programas_marco.filter(x=>x.official===true&&!x.is_test_fixture).length}));}catch(e){console.log('CATALOG_SCHEMA_ERROR='+e.message);}`);
  }
  const runtime = path.join(root, 'dist/win-unpacked', pkg.build.productName + '.exe');
  const probe = spawnSync(runtime, [probeFile, archive], { cwd: probeDir, env, windowsHide: true, encoding:'utf8', timeout:60000, maxBuffer:4*1024*1024 });
  if (probe.status !== 0 || !probe.stdout.includes('CLEAN_PACKAGED_RESULT=')) errors.push('Primer arranque del código empaquetado falló: ' + (probe.error?.message || probe.stderr || probe.stdout));
  const schemaResult = probe.stdout.match(/CATALOG_SCHEMA_RESULT=(.*)/)?.[1];
  if (schemaResult) { Object.assign(remote, JSON.parse(schemaResult)); remote.valid = true;
    if (!remote.entries) remote.warning = remote.raw_entries ? 'El catálogo solo contiene paquetes excluidos de producción; no hay ningún Programa Marco oficial disponible.' : 'Catálogo válido pero vacío: una instalación limpia no tiene nada que descargar.';
    else if (!remote.official) remote.warning = 'Solo hay contenido de prueba NO OFICIAL. No hay ningún Programa Marco oficial disponible para descargar.';
  } else if (remote.data) remote.warning = 'El catálogo remoto no supera la validación: ' + (probe.stdout.match(/CATALOG_SCHEMA_ERROR=(.*)/)?.[1] || 'sin resultado');
  const result = {
    errors, asarFiles: entries.length, resourcesFiles: outer.length, archiveSha256: hash(fs.readFileSync(archive)),
    fullList, resourceInventory, extraResources: extra, phrases: phraseResults,
    probe: probe.stdout.trim(), phraseCheck: samples.available ? 'CUATRO FRASES PRIVADAS CONTRASTADAS' : 'No hay catálogo privado local: contraste de frases no disponible en este checkout público.',
    findings, remote: { ...remote, data: undefined, url: catalogUrl },
    compilerPaths
  };
  return result;
}
function auditSection(result) {
  return `DISTRIBUCIÓN VACÍA
DISTRIBUCIÓN LIMPIA — resultados de diagnóstico, desvinculación, arranque y empaquetado.
A — Empaquetado y arranque
Catálogos políticos, bases, PDF, GGUF, pruebas y datos de desarrollo excluidos. Sin importación de la base de desarrollo ni siembra automática.
Base nueva: 0 fuentes, 0 áreas, 0 medidas, 0 proyectos y 0 fichas. Datos existentes conservados al reabrir; sin borrados.
Primer arranque sin fuentes: consulta el catálogo y OFRECE el Programa Marco oficial compatible más reciente. Solo se descarga al pulsar el botón, con progreso, SHA256 y manifiesto verificados. Se activa después de instalarlo.
Sin red o sin Marco oficial: mensaje ES/CA y botones Reintentar / Importar documento. Crear programa sin fuente vuelve a Inicio.
Paquetes de prueba excluidos de producción: no se cargan, anuncian ni instalan por vías automáticas o manuales. Solo desarrollo no empaquetado con CPM_ALLOW_TEST_CONTENT=1 permite las pruebas.
Las actualizaciones de un Marco ya instalado conservan el aviso y requieren la elección del usuario.
Desvinculación: 0 referencias funcionales fijas en src; los comentarios de etapas de IA no se confunden con catálogos.
Portada neutra: con municipio, lema y fecha vacíos no imprime marcadores ni textos de ejemplo. Los nombres del padrón de municipios y los marcadores internos de la plantilla no son datos de usuario.
Actualizaciones de app: constructor-programas-municipales-updates; Programas Marco: constructor-programas-municipales-content. Transporte, comprobación criptográfica y repositorios conservados.
Catálogo remoto: ${result.remote.url}; HTTP ${result.remote.status ?? 'no disponible'}; esquema ${result.remote.valid ? 'VÁLIDO' : 'no verificado'}; consulta ${result.remote.checkedAt ?? 'sin conexión'}.
Entradas remotas: ${result.remote.raw_entries ?? 'no verificadas'}; admitidas en producción: ${result.remote.entries ?? 'no verificadas'}; Programas Marco oficiales: ${result.remote.official ?? 'no verificados'}.
${result.remote.warning ? 'AVISO: '+result.remote.warning : 'Contenido disponible.'}

B — Auditoría del paquete REAL
Resultado: ${result.errors.length ? 'NO PUBLICAR' : 'APROBADO'}
app.asar SHA256: ${result.archiveSha256}
Archivos ASAR: ${result.asarFiles}; archivos resources/ (incluye ASAR y extraResources): ${result.resourcesFiles}.
Catálogos de programas, SQLite/DB/PDF/GGUF, proyectos, exportaciones, logos de usuario, scratch, fixtures y scripts de prueba: ${result.errors.length ? 'VER FALLOS' : '0 archivos prohibidos'}.
Rutas personales: ${result.findings.length ? 'VER FALLOS' : '0 coincidencias'}.
OCR nativo: binarios originales intactos, verificados contra el manifiesto del proveedor; ${result.compilerPaths.filter(entry=>!entry.vendor).length} cadenas exactas de Canvas autorizadas.
CPU y Vulkan: binarios oficiales b11476 intactos. ${result.compilerPaths.filter(entry=>entry.vendor).length} rutas del servidor de compilación admitidas exclusivamente en vendor/llama/cpu y vendor/llama/vulkan por SHA256 oficial y el prefijo exacto autorizado. Otras rutas de la unidad prohibida y marcadores personales siguen bloqueados.
${result.phraseCheck}
${result.phrases.map((p,i)=>`${i+1}. «${p.text}» → ${p.files.length} coincidencias${p.files.length ? ': '+p.files.join(', ') : ''}`).join('\n')}
Primer arranque del código empaquetado con Electron como Node y perfil temporal:
${result.probe}
No se ha ejecutado NSIS ni la aplicación instalada en Program Files.

C — Pruebas automáticas
test_distribucion_limpia.js: perfil APPDATA/LOCALAPPDATA/USERPROFILE temporal; arranque vacío; pantallas y botones ES/CA; creación sin fuente sin registros parciales;
paquete ZIP sintético local con SHA256, manifiesto y alineación ES/CA; una fuente y una medida; creación y conservación de proyecto;
portada vacía Word ES/CA y exclusiones build.files. Incluido en npm test (ver resumen general).
test_distribucion_vacia.js: oficial compatible más reciente, activación y proyecto; catálogo solo de pruebas sin instalación ni avisos; falta de red y reintento;
actualización posterior sin sustitución automática; discrepancia de prueba en manifiesto rechazada; solo comentarios exactos de fases de IA ignorados y referencias reales rechazadas.
test_retirada_ejemplo.js: producción rechaza el ejemplo y admite solo oficiales; desarrollo exige variable; retirada con copia previa, idempotencia y conservación de proyectos e importaciones legítimas; ASAR inyectado falla y pasa al retirarlo.
test_actualizacion_361_380.js: esquema final 8 idéntico tabla por tabla desde instalación nueva, 3.6.1 y 3.7.0; conserva proyectos y relaciones; retirada del ejemplo y segunda migración idempotente.
Pantallas probadas mediante sus renderizadores reales en DOM de prueba; prueba gráfica de Windows pendiente de la guía.

Reglas extraResources aplicadas:
${result.extraResources.join('\n')}
\nEVIDENCIA DE RUTAS DE COMPILACIÓN (cadena; archivo; librería; componente; SHA256; justificación). Canvas usa cadenas exactas; llama.cpp usa hash oficial más prefijo de GitHub Actions autorizado.
${result.compilerPaths.map(entry=>`${entry.path}; ${entry.file}; ${entry.library}; ${entry.component}; ${entry.sha256}; ${entry.justification}`).join('\n')}
${result.errors.length ? '\nFALLOS:\n'+result.errors.join('\n') : ''}
`;
}
module.exports = { auditPackage, auditSection, forbiddenPacked, archiveMemberPath, listArchiveFiles };
