const path = require('path');
const fs = require('fs');

let electronApp = null;
try {
  const electron = require('electron');
  electronApp = electron.app;
} catch (e) {
  // Standalone node process (test or script)
}

function getUserDataDir() {
  if (electronApp && typeof electronApp.getPath === 'function') {
    return electronApp.getPath('userData');
  }
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'Constructor de Programas Municipales Podemos');
  }
  return path.join(__dirname, '..', '..', '..', 'data');
}

function getDatabasePath() {
  const userDir = getUserDataDir();
  const dbDir = path.join(userDir, 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, 'programa_electoral.sqlite');
}

function getLogosDir() {
  const userDir = getUserDataDir();
  const logosDir = path.join(userDir, 'logos');
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }
  return logosDir;
}

function getDocumentsDir() {
  if (electronApp && typeof electronApp.getPath === 'function') {
    return electronApp.getPath('documents');
  }
  if (process.env.USERPROFILE) {
    const docPath = path.join(process.env.USERPROFILE, 'Documents');
    if (fs.existsSync(docPath)) return docPath;
    const misDocs = path.join(process.env.USERPROFILE, ['Mis','Documentos'].join(' '));
    if (fs.existsSync(misDocs)) return misDocs;
  }
  return path.join(getUserDataDir(), 'Documentos');
}

function getDefaultExportDir() {
  const docs = getDocumentsDir();
  return path.join(docs, 'Constructor de Programas Municipales', 'Exportaciones');
}

function resolveAssetPath(...relativeParts) {
  const candidates = [
    path.join(__dirname, '..', 'assets', ...relativeParts),
    path.join(__dirname, '..', '..', '..', ...relativeParts),
    path.join(process.resourcesPath || '', 'assets', ...relativeParts),
    path.join(process.resourcesPath || '', 'app.asar', 'src', 'main', 'assets', ...relativeParts)
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function getAiBaseDir() {
  const base = process.env.LOCALAPPDATA || getUserDataDir();
  const aiDir = path.join(base, 'Constructor de Programas Municipales Podemos', 'AI');
  if (!fs.existsSync(aiDir)) {
    fs.mkdirSync(aiDir, { recursive: true });
  }
  return aiDir;
}

function resolveModelsDir() {
  const modelsDir = path.join(getAiBaseDir(), 'models');
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  return modelsDir;
}

function getAiModelsDir() {
  return resolveModelsDir();
}

function getAiLogsDir() {
  const logsDir = path.join(getAiBaseDir(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
}

function resolveCustomCatalogDir() {
  const catDir = path.join(getAiBaseDir(), 'catalog');
  if (!fs.existsSync(catDir)) {
    fs.mkdirSync(catDir, { recursive: true });
  }
  return catDir;
}

function resolveCustomCatalogFile() {
  return path.join(resolveCustomCatalogDir(), 'ai_models.json');
}

function resolveOfficialCatalogFile() {
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'data', 'ai_models.json'),
    path.join(__dirname, '..', '..', 'data', 'ai_models.json'),
    path.join(process.resourcesPath || '', 'app.asar', 'data', 'ai_models.json'),
    path.join(process.resourcesPath || '', 'data', 'ai_models.json'),
    path.join(process.cwd(), 'data', 'ai_models.json')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function resolveLlamaRuntime() {
  const candidates = [
    {
      source: 'verified official CPU b11476',
      path: path.join(process.resourcesPath || path.join(__dirname, '..', '..', '..'), 'vendor', 'llama', 'cpu', 'llama-server.exe')
    },
    {
      source: 'resourcesPath (installed package)',
      path: path.join(process.resourcesPath || '', 'ai-runtime', 'llama.cpp', 'llama-server.exe')
    },
    {
      source: 'appPath (installed package)',
      path: electronApp && typeof electronApp.getAppPath === 'function'
        ? path.join(electronApp.getAppPath(), '..', 'ai-runtime', 'llama.cpp', 'llama-server.exe')
        : null
    },
    {
      source: 'source repo resources (4 levels)',
      path: path.join(__dirname, '..', '..', '..', 'resources', 'ai-runtime', 'llama.cpp', 'llama-server.exe')
    },
    {
      source: 'source repo resources (3 levels)',
      path: path.join(__dirname, '..', '..', 'resources', 'ai-runtime', 'llama.cpp', 'llama-server.exe')
    },
    {
      source: 'current working directory',
      path: path.join(process.cwd(), 'resources', 'ai-runtime', 'llama.cpp', 'llama-server.exe')
    }
  ];

  for (const c of candidates) {
    if (c.path && fs.existsSync(c.path)) {
      return {
        executablePath: c.path,
        exists: true,
        source: c.source
      };
    }
  }

  return {
    executablePath: candidates[0].path,
    exists: false,
    source: 'not_found'
  };
}

function getAiRuntimePath() {
  const resolved = resolveLlamaRuntime();
  return resolved.exists ? resolved.executablePath : null;
}

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const BLOCKED_EXECUTABLE_EXTENSIONS = new Set([
  '.exe', '.com', '.bat', '.cmd', '.ps1', '.vbs', '.vbe',
  '.js', '.jse', '.wsf', '.wsh', '.msi', '.msp', '.scr',
  '.pif', '.hta', '.cpl', '.msc', '.jar', '.reg', '.lnk',
  '.dll', '.sys', '.ps1xml', '.psh'
]);

function sanitizeSafeName(name, fallback = 'Municipal') {
  if (name === null || name === undefined) return fallback;
  let cleaned = String(name)
    .replace(/['’]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\.{2,}/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .replace(/_+/g, '_');

  if (!cleaned || /^[._]+$/.test(cleaned)) {
    return fallback;
  }
  if (WINDOWS_RESERVED_NAMES.test(cleaned)) {
    cleaned = `_${cleaned}`;
  }
  if (cleaned.length > 120) {
    cleaned = cleaned.slice(0, 120).replace(/[.\s]+$/g, '') || fallback;
  }
  return cleaned;
}

function isPathInside(baseDir, targetPath, allowSameDir = false) {
  if (!baseDir || !targetPath || typeof baseDir !== 'string' || typeof targetPath !== 'string') {
    return false;
  }
  try {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(targetPath);

    const isWin = process.platform === 'win32';
    const normBase = isWin ? resolvedBase.toLowerCase() : resolvedBase;
    const normTarget = isWin ? resolvedTarget.toLowerCase() : resolvedTarget;

    if (normTarget === normBase) {
      return Boolean(allowSameDir);
    }

    const baseWithSep = normBase.endsWith(path.sep) ? normBase : normBase + path.sep;
    if (!normTarget.startsWith(baseWithSep)) {
      return false;
    }

    const rel = path.relative(resolvedBase, resolvedTarget);
    if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || rel.startsWith('../') || path.isAbsolute(rel)) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function resolveSafePath(baseDir, ...segments) {
  if (!baseDir || typeof baseDir !== 'string') {
    throw new Error('Directorio base no válido');
  }
  const resolvedBase = path.resolve(baseDir);
  for (const seg of segments) {
    if (typeof seg !== 'string' || seg.trim().length === 0) {
      throw new Error('Segmento de ruta no válido');
    }
    // Bloquear rutas absolutas o UNC inyectadas como segmento relativo
    if (path.isAbsolute(seg) || /^\\\\/.test(seg) || /^[a-zA-Z]:/.test(seg)) {
      throw new Error('Ruta absoluta o UNC no permitida dentro del directorio base');
    }
  }
  const resolvedTarget = path.resolve(resolvedBase, ...segments);
  if (!isPathInside(resolvedBase, resolvedTarget, false)) {
    throw new Error('Operación bloqueada por seguridad: la ruta escapa del directorio autorizado');
  }
  return resolvedTarget;
}

const { fileURLToPath } = require('url');

const ALLOWED_OPENABLE_DOC_EXTENSIONS = new Set(['.docx', '.pdf']);

function isBlockedExecutablePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;
  const trimmed = filePath.trim().replace(/[.\s]+$/, '');
  const ext = path.extname(trimmed).toLowerCase();
  return BLOCKED_EXECUTABLE_EXTENSIONS.has(ext);
}

function validateOpenableDocumentPath(filePath, options = {}) {
  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
    return { allowed: false, reason: 'Ruta de archivo no válida' };
  }
  const raw = filePath.trim();
  if (/^\\\\/.test(raw)) {
    return { allowed: false, reason: 'Rutas de red UNC no permitidas' };
  }

  // Rechazar traversal explícito en la ruta recibida por IPC
  const parts = raw.split(/[\\/]+/);
  if (parts.includes('..')) {
    return { allowed: false, reason: 'Secuencia de escape de directorio (..) no permitida' };
  }

  let resolvedPath;
  try {
    resolvedPath = path.resolve(raw);
  } catch (e) {
    return { allowed: false, reason: 'No se pudo resolver la ruta del archivo' };
  }

  if (isBlockedExecutablePath(resolvedPath)) {
    return { allowed: false, reason: 'Tipo de archivo ejecutable o script bloqueado por seguridad' };
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  if (!ALLOWED_OPENABLE_DOC_EXTENSIONS.has(ext)) {
    return { allowed: false, reason: `Extensión no permitida (${ext || 'sin extensión'}). Solo se permiten documentos .docx y .pdf` };
  }

  const allowedDirs = Array.isArray(options.allowedDirs) ? options.allowedDirs.filter(Boolean) : [];
  const trackedFiles = options.trackedFiles instanceof Set ? options.trackedFiles : null;
  const normResolved = process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;

  const isTracked = trackedFiles ? trackedFiles.has(normResolved) : false;
  const isInsideAllowedDir = allowedDirs.some(dir => isPathInside(dir, resolvedPath, false));

  if (!isTracked && !isInsideAllowedDir) {
    return { allowed: false, reason: 'El archivo no pertenece a un directorio de exportación autorizado' };
  }

  if (!fs.existsSync(resolvedPath)) {
    return { allowed: false, reason: 'Archivo no encontrado' };
  }

  try {
    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      return { allowed: false, reason: 'La ruta no corresponde a un archivo regular' };
    }
  } catch (e) {
    return { allowed: false, reason: 'No se pudo verificar el archivo' };
  }

  return { allowed: true, resolvedPath };
}

function isAllowedNavigationUrl(targetUrl, appIndexFilePath) {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'file:') {
      return false;
    }
    const targetFilePath = path.resolve(fileURLToPath(parsed));
    const expectedIndex = path.resolve(
      appIndexFilePath || path.join(__dirname, '..', '..', 'renderer', 'index.html')
    );
    if (process.platform === 'win32') {
      return targetFilePath.toLowerCase() === expectedIndex.toLowerCase();
    }
    return targetFilePath === expectedIndex;
  } catch (e) {
    return false;
  }
}

module.exports = {
  getUserDataDir,
  getDatabasePath,
  getLogosDir,
  getDocumentsDir,
  getDefaultExportDir,
  resolveAssetPath,
  getAiBaseDir,
  getAiModelsDir,
  resolveModelsDir,
  getAiLogsDir,
  getAiRuntimePath,
  resolveLlamaRuntime,
  resolveCustomCatalogDir,
  resolveCustomCatalogFile,
  resolveOfficialCatalogFile,
  sanitizeSafeName,
  isPathInside,
  resolveSafePath,
  isBlockedExecutablePath,
  validateOpenableDocumentPath,
  isAllowedNavigationUrl,
  BLOCKED_EXECUTABLE_EXTENSIONS,
  ALLOWED_OPENABLE_DOC_EXTENSIONS
};
