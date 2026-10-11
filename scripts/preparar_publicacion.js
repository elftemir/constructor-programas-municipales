// Preparacion local: no commits, push, Releases ni escritura en la instalacion real.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const ignore = require('ignore'); const yaml = require('js-yaml');
const { guide, PUBLICATIONS, SOURCE_REPO, UPDATES_REPO } = require('./publicacion_guia');
const hash = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest(algorithm === 'sha512' ? 'base64' : 'hex');
const slash = value => value.replace(/\\/g, '/');

function forbiddenReason(rel) {
  const parts = slash(rel).toLowerCase().split('/');
  if (parts.some(p => ['.git', 'node_modules', 'dist', 'out', 'release', 'instalable', 'scratch', 'content-fixtures', 'public-source-candidate', 'backups', 'backup', 'copias', 'logs', '.cache', '__pycache__', PUBLICATIONS.toLowerCase()].includes(p))) return 'carpeta local o de compilacion';
  if (/^0\d_/.test(parts[0]) || parts[0] === 'cartepa instalada respeldo') return 'material interno';
  if (parts.some(p => p.startsWith('.env'))) return 'variables de entorno';
  if (/\.(exe|blockmap|gguf|ggml|sqlite3?|db|pdf|pfx|p12|pem|key|cer|dll|so|dylib|log|bak|tmp)$/i.test(rel)) return 'extension no publicable';
  if (parts.at(-1) === 'latest.yml' || parts.at(-1) === 'catalogo_marco.json') return 'metadatos de actualizacion o catalogo privado';
  if (parts.slice(0, 3).join('/') === 'resources/ai-runtime/llama.cpp') return 'runtime llama.cpp';
  return null;
}

function listPublicFiles(root) {
  const excluded = []; const unsafe = [];
  const gitRoot = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true });
  let files = []; let mode;
  if (gitRoot.status === 0 && path.resolve(gitRoot.stdout.trim()).toLowerCase() === path.resolve(root).toLowerCase()) {
    const result = spawnSync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw Error('git ls-files fallo: ' + result.stderr);
    files = [...new Set(result.stdout.split('\0').filter(Boolean).map(slash))]; mode = 'git ls-files --cached --others --exclude-standard';
  } else {
    mode = 'biblioteca ignore 7 (.gitignore raiz y reglas anidadas)';
    function walk(base, matchers) {
      const localIgnore = path.join(root, base, '.gitignore');
      const active = fs.existsSync(localIgnore) ? [...matchers, { base, matcher: ignore().add(fs.readFileSync(localIgnore, 'utf8')) }] : matchers;
      for (const entry of fs.readdirSync(path.join(root, base), { withFileTypes: true })) {
        const rel = slash(path.join(base, entry.name));
        const reason = forbiddenReason(rel);
        if (reason) { excluded.push({ file: rel, reason }); continue; }
        let isIgnored = false;
        for (const item of active) {
          const local = slash(path.relative(item.base || '.', rel)) + (entry.isDirectory() ? '/' : '');
          const result = item.matcher.test(local);
          if (result.ignored) isIgnored = true;
          if (result.unignored) isIgnored = false;
        }
        if (isIgnored) { excluded.push({ file: rel, reason: '.gitignore' }); continue; }
        if (entry.isSymbolicLink()) { unsafe.push('No copiar enlace simbolico: ' + rel); continue; }
        if (entry.isDirectory()) walk(rel, active); else files.push(rel);
      }
    }
    walk('', []);
  }
  files = files.filter(rel => {
    if (rel.startsWith('../') || path.isAbsolute(rel)) { unsafe.push('Ruta fuera de la raiz: ' + rel); return false; }
    const reason = forbiddenReason(rel);
    if (reason) { excluded.push({ file: rel, reason }); return false; }
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) return false; // tracked deletion, intentionally absent
    if (fs.lstatSync(full).isSymbolicLink()) { unsafe.push('No copiar enlace simbolico: ' + rel); return false; }
    return fs.statSync(full).isFile();
  }).sort();
  return { files, excluded, unsafe, mode };
}

function auditSource(root, files) {
  const entries = []; const findings = []; const errors = [];
  const textExt = /\.(js|cjs|mjs|json|md|txt|csv|ya?ml|nsh|nsi|html|css|svg|xml|py|ps1|bat|sh|sql|toml|cfg)$/i;
  for (const rel of files) {
    const bytes = fs.readFileSync(path.join(root, rel));
    entries.push({ file: rel, bytes: bytes.length, sha256: hash(bytes) });
    const forbidden = forbiddenReason(rel); if (forbidden) errors.push(rel + ': ' + forbidden);
    if (bytes.length > 50 * 1000 * 1000) errors.push(rel + ': supera 50 MB');
    let text;
    const knownText = textExt.test(rel) || path.basename(rel).startsWith('.gitignore') || path.basename(rel) === 'LICENSE';
    try {
      if (bytes[0] === 0xff && bytes[1] === 0xfe) text = bytes.subarray(2).toString('utf16le');
      else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = Buffer.from(bytes.subarray(2)).swap16().toString('utf16le');
      else {
        if (!knownText && bytes.includes(0)) continue;
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      }
    } catch (_) { if (knownText) errors.push(rel + ': formato de texto no legible'); continue; }
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\\\\/g, '\\').replace(/\//g, '\\');
      const personal = /[A-Z]:\\(?:Users\\[^\\\s"'`]+|Mis Documentos\\[^"'`\r\n]+)/i.test(normalized);
      if (personal) { findings.push({ file: rel, line: index + 1, kind: 'RUTA PERSONAL', blocking: true }); errors.push(rel + ':' + (index + 1) + ': ruta personal'); }
      const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      for (const email of new Set(emails.filter(e => e.toLowerCase() !== 'elftemir@hotmail.com'))) {
        const license = /license|notice|licenc|third.party|copying/i.test(rel);
        const npmMetadata = email.toLowerCase() === 'i@izs.me' && ((rel === 'package-lock.json' && /"deprecated"\s*:/.test(line)) || (rel === 'scripts/preparar_publicacion.js' && line.includes('const npmMetadata')));
        const publicAttribution = license || npmMetadata;
        findings.push({ file: rel, line: index + 1, kind: license ? 'CORREO EN LICENCIA (atribucion publica)' : (npmMetadata ? 'CORREO PUBLICO DE DEPENDENCIA NPM (glob 7.2.3)' : 'CORREO DISTINTO DEL CONTACTO'), blocking: !publicAttribution, value: publicAttribution ? email : '[redactado]' });
        if (!publicAttribution) errors.push(rel + ':' + (index + 1) + ': correo distinto del contacto');
      }
      if (/password|token|apikey|api_key|secret/i.test(line)) {
        const assigned = line.match(/(?:password|token|apikey|api_key|secret)\s*[:=]\s*['"]([^'"]{8,})['"]/i);
        const credential = /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{35})/.test(line)
          || (assigned && !/^(?:fixture|test|fake|dummy|example|sample|placeholder|redact)/i.test(assigned[1]));
        findings.push({ file: rel, line: index + 1, kind: credential ? 'POSIBLE CREDENCIAL' : 'PALABRA TECNICA O REGLA DE DETECCION', blocking: Boolean(credential) });
        if (credential) errors.push(rel + ':' + (index + 1) + ': posible credencial');
      }
    }
  }
  return { entries, findings, errors, totalBytes: entries.reduce((n, e) => n + e.bytes, 0) };
}

function installerChecks(root, pkg) {
  const errors = [];
  const exe = `Programa_Electoral_Municipal_Setup_x64_v${pkg.version}.exe`;
  for (const file of [exe, exe + '.blockmap', 'latest.yml']) if (!fs.existsSync(path.join(root, 'dist', file))) errors.push('Falta artefacto: ' + file);
  if (pkg.build?.appId !== 'org.podemos.constructor.municipal') errors.push('appId incorrecto');
  if (pkg.build?.productName !== 'Constructor de Programas Municipales Podemos') errors.push('productName incorrecto');
  if (pkg.author?.name !== 'elftemir') errors.push('author.name incorrecto');
  if (pkg.build?.win?.publisherName) errors.push('No debe establecerse win.publisherName');
  if (pkg.build?.nsis?.perMachine !== true) errors.push('nsis.perMachine debe ser true');
  if (pkg.build?.nsis?.allowToChangeInstallationDirectory !== false) errors.push('El directorio debe ser fijo');
  if (pkg.build?.nsis?.createDesktopShortcut !== 'always') errors.push('Acceso del escritorio debe ser always');
  const include = path.join(root, 'build/installer.nsh');
  if (!fs.existsSync(include)) errors.push('Falta build/installer.nsh');
  else {
    const script = fs.readFileSync(include, 'utf8');
    for (const token of ['cpmCleanRegistry HKLM 64', 'cpmCleanRegistry HKCU 32', '$cpmKey == ""', 'customUnInstall', '${isUpdated}', 'cpmEnsureDesktopShortcut', '${CPM_NAME}']) if (!script.includes(token)) errors.push('Falta requisito NSIS: ' + token);
  }
  let size = 0; let sha256 = ''; let sha512 = '';
  if (!errors.some(e => e.startsWith('Falta artefacto'))) {
    const bytes = fs.readFileSync(path.join(root, 'dist', exe)); size = bytes.length; sha256 = hash(bytes); sha512 = hash(bytes, 'sha512');
    try {
      const metadata = yaml.load(fs.readFileSync(path.join(root, 'dist/latest.yml'), 'utf8'), { schema: yaml.JSON_SCHEMA });
      const file = metadata.files?.find(f => f.url === exe);
      if (metadata.version !== pkg.version || metadata.path !== exe || !file) errors.push('Nombre/version de latest.yml no coincide con package.json');
      if (metadata.sha512 !== sha512 || file?.sha512 !== sha512) errors.push('SHA512 de latest.yml incorrecto');
      if (file?.size !== size) errors.push('Tamano de latest.yml incorrecto');
    } catch (err) { errors.push('latest.yml no valido: ' + err.message); }
  }
  return { exe, errors, size, sha256, sha512 };
}

function runNpm(root, args) {
  const cli = process.env.npm_execpath;
  if (!cli || !fs.existsSync(cli)) throw Error('Ejecuta este proceso mediante npm run preparar-publicacion.');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, windowsHide: true, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { const text = chunk.toString(); output += text; process.stdout.write(text); });
    child.on('error', reject); child.on('close', code => resolve({ code, output }));
  });
}

function versionNotes(pkg, installer, currentChanges) {
  const fence = String.fromCharCode(96).repeat(3);
  return `# Constructor de Programas Municipales ${pkg.version}

Programa para Windows 10/11 x64, con programas fuente en castellano y catalan e IA opcional local.

## Novedades y correcciones

${currentChanges}

Consultar CHANGELOG.md para el historial desde la 3.3.0, con las limitaciones de reconstruccion indicadas en cada entrada.

DOCX funciona sin conversor. PDF requiere Word o LibreOffice. La IA y el OCR trabajan localmente; revisar los textos antes de utilizarlos.

## Descarga y comprobacion

Instalador: ${installer.exe}
Tamano: ${installer.size.toLocaleString('es-ES')} bytes (${(installer.size / 1048576).toFixed(2)} MiB).
SHA-256: ${installer.sha256}

${fence}powershell
Get-FileHash .\\${installer.exe} -Algorithm SHA256
${fence}

La huella debe coincidir con SHA256.txt. El instalador no dispone de firma Authenticode; el hash comprueba que se descarga el mismo archivo.

Codigo: ${SOURCE_REPO}
Actualizaciones: ${UPDATES_REPO}
`;
}

async function prepare(root = path.resolve(__dirname, '..'), options = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version)) throw Error('Version no valida: se requiere x.y.z');
  const destination = path.join(root, PUBLICATIONS, 'V' + pkg.version);
  if (fs.existsSync(destination)) throw Error('La carpeta ' + destination + ' ya existe. No se sobrescribe nunca.');
  if (!pkg.scripts?.build?.includes('--publish never')) throw Error('El comando build debe conservar --publish never; no se permite publicar automaticamente.');
  const run = options.run || ((args) => runNpm(root, args));
  console.log('Preparando version ' + pkg.version + '; no se subira nada a GitHub.');
  const tests = await run(['test']);
  if (tests.code !== 0) throw Error('npm test ha fallado. No se crea la carpeta de publicacion.');
  const listing = listPublicFiles(root);
  const source = auditSource(root, listing.files);
  const cover = 'src/main/assets/templates/portada_programa_sant_andreu_editable.docx';
  const coverBefore = fs.existsSync(path.join(root, cover)) ? hash(fs.readFileSync(path.join(root, cover))) : null;
  const buildStarted = Date.now();
  const build = await run(['run', 'build']);
  if (build.code !== 0) throw Error('npm run build ha fallado. No se crea la carpeta de publicacion.');
  const installer = installerChecks(root, pkg);
  const errors = [...listing.unsafe, ...source.errors, ...installer.errors];
  for (const file of [installer.exe, installer.exe + '.blockmap', 'latest.yml']) {
    const artifact = path.join(root, 'dist', file);
    if (fs.existsSync(artifact) && fs.statSync(artifact).mtimeMs < buildStarted - 2000) errors.push('Artefacto antiguo: no procede de esta compilacion: ' + file);
  }
  for (const item of source.entries) if (!fs.existsSync(path.join(root, item.file)) || hash(fs.readFileSync(path.join(root, item.file))) !== item.sha256) errors.push('Cambio de fuente durante la compilacion: ' + item.file);
  if (!listing.files.includes(cover) || !coverBefore || !fs.existsSync(path.join(root, cover)) || coverBefore !== hash(fs.readFileSync(path.join(root, cover)))) errors.push('La portada falta o ha cambiado');
  for (const file of ['README.md', 'SOURCE_BUILD.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'docs/REQUISITOS_INSTALADOR.md', '.github/ISSUE_TEMPLATE/error_programa.md', '.github/ISSUE_TEMPLATE/importacion_marco.md', '.github/ISSUE_TEMPLATE/propuesta_mejora.md', 'package-lock.json', 'scripts/preparar_publicacion.js']) if (!listing.files.includes(file)) errors.push('Falta documento/archivo requerido: ' + file);
  const changelog = fs.existsSync(path.join(root, 'CHANGELOG.md')) ? fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8') : '';
  const currentChanges = changelog.match(new RegExp('^## ' + pkg.version.replace(/\./g, '\\.') + '\\s*\\n([\\s\\S]*?)(?=\\n## |$)', 'm'))?.[1]?.trim();
  if (!currentChanges) errors.push('CHANGELOG.md debe documentar la version ' + pkg.version);
  // Match every published application file with the actual ASAR from this build.
  if (!options.skipPackagedCheck) {
    try {
      const asar = require('@electron/asar'); const archive = path.join(root, 'dist/win-unpacked/resources/app.asar');
      for (const entry of source.entries.filter(e => e.file.startsWith('src/') || e.file === 'package.json')) {
        const packed = asar.extractFile(archive, path.normalize(entry.file));
        // electron-builder normalizes package.json and removes devDependencies/scripts.
        if (entry.file === 'package.json') {
          const packedPkg = JSON.parse(packed); if (packedPkg.version !== pkg.version) errors.push('Version empaquetada incorrecta');
        } else if (hash(packed) !== entry.sha256) errors.push('Fuente empaquetada diferente: ' + entry.file);
      }
    } catch (err) { errors.push('No se pudo verificar el codigo empaquetado: ' + err.message); }
  }
  const testSummary = tests.output.slice(tests.output.lastIndexOf('RESUMEN FINAL') >= 0 ? tests.output.lastIndexOf('RESUMEN FINAL') : Math.max(0, tests.output.length - 5000)).trim();
  const date = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', hour12: false });
  const report = [errors.length ? 'NO PUBLICAR\n' + errors.map(e => '- ' + e).join('\n') : 'PREPARACION CORRECTA — comprobaciones automaticas aprobadas; completar pruebas manuales antes de subir.',
    `Version: ${pkg.version}\nFecha Europe/Madrid: ${date}\nOrigen: ${root}\nDestino: ${destination}\nNo se ha subido nada a GitHub.`,
    'PRUEBAS\n' + testSummary + '\nCompilacion: npm run build, codigo de salida ' + build.code,
    `CODIGO FUENTE\nSeleccion: ${listing.mode}\nArchivos: ${source.entries.length}\nTotal: ${source.totalBytes} bytes\nArchivos de mas de 50 MB: ${source.entries.filter(e => e.bytes > 50 * 1000 * 1000).length}.`,
    'EXCLUSIONES\nNo se incluyen node_modules, dist, EXE, blockmap, latest.yml, modelos, SQLite, binarios llama.cpp, PDF, .env, certificados, backups, logs, carpetas internas 00–09, content-fixtures, scratch, public-source-candidate ni la carpeta de publicaciones.\nCatalogo politico privado excluido de la fuente. Portada original conservada.\n' + listing.excluded.map(e => '- ' + e.file + ' [' + e.reason + ']').join('\n'),
    'ANALISIS DE TEXTO\nSe buscan rutas personales, correos distintos del contacto, password, token, apikey y secret. Las lineas con palabras tecnicas o atribuciones de licencias se listan para revision; no se consideran credenciales por esa palabra sola. Las coincidencias bloqueantes impiden publicar. No se imprime el valor de una posible credencial.\n' + (source.findings.length ? source.findings.map(f => `${f.file}:${f.line} — ${f.kind}${f.value ? ' — ' + f.value : ''}${f.blocking ? ' — BLOQUEANTE' : ''}`).join('\n') : 'Sin coincidencias.'),
    `INSTALADOR\nArchivo: ${installer.exe}\nVersion: ${pkg.version}\nTamano: ${installer.size} bytes\nSHA-256: ${installer.sha256}\nSHA-512: ${installer.sha512}\nNombre, version, tamano y SHA512 de latest.yml: ${installer.errors.length ? 'FALLO; ver motivos iniciales' : 'CORRECTOS'}\nappId: ${pkg.build?.appId}\nproductName: ${pkg.build?.productName}\nauthor.name: ${pkg.author?.name}\nnsis.perMachine: ${pkg.build?.nsis?.perMachine}\nCarpeta fija y acceso del escritorio: verificados.`,
    'ARCHIVOS INCLUIDOS (ruta; bytes; SHA256)\n' + source.entries.map(e => `${e.file}; ${e.bytes}; ${e.sha256}`).join('\n'),
    'PENDIENTE DEL USUARIO\nRevisar coincidencias y completar pruebas manuales Windows de instalacion, reinstalacion, desinstalacion con Si/No, entrada huerfana y acceso de escritorio. La subida se hace siguiendo GUIA_SUBIDA_GITHUB.txt. No se ha comprobado ni modificado la instalacion real.'
  ].join('\n\n') + '\n';
  if (errors.length) {
    // Failed checks never leave a version folder that would prevent a corrected retry.
    fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
    const failure = path.join(root, 'scratch', `INFORME_NO_PUBLICAR_${pkg.version}_${Date.now()}.txt`);
    fs.writeFileSync(failure, report, { flag: 'wx' });
    console.error(report.split('\n\n')[0] + '\nInforme completo: ' + failure);
    const error = new Error('Comprobaciones fallidas: no se crea la carpeta de version.'); error.reportPath = failure; throw error;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination); // exclusive: a concurrent process cannot overwrite an existing version
  try {
    for (const item of source.entries) {
      const target = path.join(destination, 'codigo-fuente', item.file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, item.file), target, fs.constants.COPYFILE_EXCL);
      if (hash(fs.readFileSync(target)) !== item.sha256) throw Error('Copia distinta de fuente compilada: ' + item.file);
    }
    const installers = path.join(destination, 'instalador'); fs.mkdirSync(installers);
    for (const file of [installer.exe, installer.exe + '.blockmap', 'latest.yml']) fs.copyFileSync(path.join(root, 'dist', file), path.join(installers, file), fs.constants.COPYFILE_EXCL);
    if (hash(fs.readFileSync(path.join(installers, installer.exe))) !== installer.sha256) throw Error('Copia del instalador no coincide');
    fs.writeFileSync(path.join(installers, 'SHA256.txt'), installer.sha256 + '  ' + installer.exe + '\n', { flag: 'wx' });
    fs.writeFileSync(path.join(destination, 'GUIA_SUBIDA_GITHUB.txt'), guide(root, pkg.version, installer.exe), { flag: 'wx' });
    fs.writeFileSync(path.join(destination, 'INFORME_PUBLICACION.txt'), report, { flag: 'wx' });
    fs.writeFileSync(path.join(destination, 'NOTAS_VERSION.md'), versionNotes(pkg, installer, currentChanges), { flag: 'wx' });
  } catch (err) {
    const target = path.join(destination, 'INFORME_PUBLICACION.txt');
    fs.writeFileSync(target, 'NO PUBLICAR\nFallo al copiar/preparar: ' + err.message + '\n\n' + report);
    throw err;
  }
  console.log(`PREPARADO: ${destination}\n${source.entries.length} archivos de codigo; instalador ${installer.size} bytes.\nLa subida la haces tu con GUIA_SUBIDA_GITHUB.txt.`);
  return { destination, report, files: source.entries, installer };
}
if (require.main === module) prepare().catch(err => { console.error('NO PUBLICAR: ' + err.message); process.exitCode = 1; });
module.exports = { prepare, listPublicFiles, auditSource, installerChecks, forbiddenReason };
