const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDb, setDatabaseHandlers } = require('./db/database');
const {
  resolveAssetPath,
  getDefaultExportDir,
  resolveCustomCatalogDir,
  sanitizeSafeName,
  validateOpenableDocumentPath,
  isAllowedNavigationUrl
} = require('./utils/paths');
const projectService = require('./services/projectService');
const docxExporter = require('./services/docxExporter');
const pdfExporter = require('./services/pdfExporter');
const aiService = require('./services/ai/aiService');
const fichaMunicipioService = require('./services/fichaMunicipioService');
const configService = require('./services/configService');
const sourceProgramService = require('./services/sourceProgramService');
const documentStructuringService = require('./services/importer/documentStructuringService');
const { updateService } = require('./services/updateService');
const { contentUpdateService } = require('./services/contentUpdateService');

let mainWindow = null;
let cachedMunicipios = [];
let isQuittingApp = false;
const trackedExportedFiles = new Set();
const APP_INDEX_HTML_PATH = path.join(__dirname, '..', 'renderer', 'index.html');

function recordExportedFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return;
  try {
    const resolved = path.resolve(filePath);
    trackedExportedFiles.add(process.platform === 'win32' ? resolved.toLowerCase() : resolved);
  } catch (e) {}
}

function recordExportResultFiles(res) {
  if (!res || typeof res !== 'object') return;
  recordExportedFile(res.filePath);
  recordExportedFile(res.filePathEs);
  recordExportedFile(res.filePathCa);
  recordExportedFile(res.docxPath);
}

function sanitizeExportOptionsFromIpc(options) {
  if (!options || typeof options !== 'object') return {};
  const safe = {};
  if (options.idioma === 'es' || options.idioma === 'ca') {
    safe.idioma = options.idioma;
  }
  if (typeof options.isCa === 'boolean') {
    safe.isCa = options.isCa;
  }
  if (typeof options.exportBothLanguages === 'boolean') {
    safe.exportBothLanguages = options.exportBothLanguages;
  }
  if (typeof options.suffix === 'string' && /^(_ES|_CA)?$/i.test(options.suffix)) {
    safe.suffix = options.suffix;
  }
  return safe;
}

function enforceNavigationSecurity(webContents) {
  if (!webContents) return;

  webContents.setWindowOpenHandler(({ url }) => {
    console.warn('[SEC-008] Apertura de ventana externa bloqueada:', url);
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedNavigationUrl(targetUrl, APP_INDEX_HTML_PATH)) {
      event.preventDefault();
      console.warn('[SEC-008] Navegación externa o no autorizada bloqueada:', targetUrl);
    }
  });

  webContents.on('will-redirect', (event, targetUrl) => {
    if (!isAllowedNavigationUrl(targetUrl, APP_INDEX_HTML_PATH)) {
      event.preventDefault();
      console.warn('[SEC-008] Redirección no autorizada bloqueada:', targetUrl);
    }
  });
}

app.on('web-contents-created', (_, contents) => {
  enforceNavigationSecurity(contents);
});

function normalizeSearchText(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function loadMunicipiosDataset() {
  try {
    const jsonPaths = [
      resolveAssetPath('data', 'municipios_catalunya.json'),
      path.join(__dirname, '..', '..', 'data', 'municipios_catalunya.json'),
      path.join(__dirname, 'assets', 'data', 'municipios_catalunya.json')
    ];

    for (const p of jsonPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        cachedMunicipios = JSON.parse(content);
        console.log(`Loaded ${cachedMunicipios.length} municipalities from: ${p}`);
        return;
      }
    }

    // Fallback: parse CSV
    const csvPaths = [
      resolveAssetPath('data', 'municipios_ine.csv'),
      path.join(__dirname, '..', '..', 'data', 'municipios_ine.csv')
    ];
    for (const p of csvPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 1) {
          const list = [];
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 4) {
              list.push({
                codigo_ine: parts[0].trim(),
                nombre: parts[1].replace(/^"|"$/g, '').trim(),
                provincia: parts[2].trim(),
                comunidad_autonoma: parts[3].trim(),
                poblacion: parts[4] ? parseInt(parts[4], 10) : null,
                fuente_poblacion: parts[5] ? parts[5].replace(/^"|"$/g, '').trim() : 'Idescat / INE',
                ano_poblacion: parts[6] ? parts[6].trim() : '2025'
              });
            }
          }
          cachedMunicipios = list;
          console.log(`Loaded ${cachedMunicipios.length} municipalities from CSV: ${p}`);
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Error loading municipios dataset:', err);
  }
}

function createWindow() {
  const iconCandidates = [
    path.join(__dirname, 'assets', 'icons', 'app_icon.ico'),
    path.join(__dirname, '..', 'renderer', 'assets', 'icons', 'app_icon.ico'),
    path.join(__dirname, '..', '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'renderer', 'assets', 'icons', 'app_icon.png')
  ];
  let appIcon = undefined;
  for (const ic of iconCandidates) {
    if (fs.existsSync(ic)) {
      appIcon = ic;
      break;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1366,
    minHeight: 768,
    title: 'Podemos · Constructor de Programas Municipales',
    backgroundColor: '#F6F5F3',
    icon: appIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  enforceNavigationSecurity(mainWindow.webContents);

  mainWindow.loadFile(APP_INDEX_HTML_PATH);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    updateService.scheduleStartupCheck(4000);
    contentUpdateService.scheduleStartupCheck(6500);
  });

  // Shortcut for Ctrl+S
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 's') {
      mainWindow.webContents.send('shortcut:save');
      event.preventDefault();
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  setDatabaseHandlers({
    onSaveError: () => dialog.showMessageBoxSync({
      type: 'error', title: 'No se ha guardado / No s’ha desat',
      message: 'No se han podido guardar los cambios. Comprueba el espacio libre y los permisos; vuelve a guardar antes de cerrar.\n\nNo s’han pogut desar els canvis. Comprova l’espai lliure i els permisos; torna a desar abans de tancar.',
      buttons: ['Aceptar / Acceptar']
    }),
    confirmRestore: ({ backupPath }) => dialog.showMessageBoxSync({
      type: 'warning', title: 'Recuperar datos / Recuperar dades',
      message: 'La base de datos no se puede abrir. ¿Quieres restaurar la copia válida más reciente? Los cambios posteriores a esa copia no estarán disponibles.\n\nLa base de dades no es pot obrir. Vols restaurar la còpia vàlida més recent? Els canvis posteriors a la còpia no estaran disponibles.',
      detail: backupPath, buttons: ['Restaurar', 'Cancelar / Cancel·lar'], defaultId: 1, cancelId: 1
    }) === 0
  });
  let dbInitialized = false;
  while (!dbInitialized) {
    try {
      await initDb();
      loadMunicipiosDataset();
      dbInitialized = true;
    } catch (err) {
      console.error('Database initialization/migration error:', err);
      if (err.code === 'ERR_FUTURE_SCHEMA') {
        dialog.showMessageBoxSync({
          type: 'warning',
          title: 'Versión incompatible',
          message: 'Este proyecto fue actualizado con una versión más reciente de la aplicación y no puede abrirse de forma segura con esta versión.',
          buttons: ['Cerrar']
        });
        app.quit();
        return;
      } else {
        const choice = dialog.showMessageBoxSync({
          type: 'error',
          title: 'Error al actualizar base de datos',
          message: 'No se ha podido abrir o actualizar de forma segura la base de datos.\n\n' + err.message,
          buttons: ['Reintentar', 'Cerrar'],
          defaultId: 0,
          cancelId: 1
        });
        if (choice === 1) { // Cerrar
          app.quit();
          return;
        }
        // Si elige Reintentar (0), reintenta en la siguiente iteración
      }
    }
  }

  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', (event) => {
  if (isQuittingApp) return;
  isQuittingApp = true;
  event.preventDefault();
  Promise.resolve()
    .then(() => aiService.stopServer({ isAppQuit: true, graceMs: 2000 }))
    .catch((err) => {
      console.warn('[SEC-006] Error al detener llama-server durante el cierre:', err && err.message ? err.message : err);
    })
    .finally(() => {
      app.quit();
    });
});

process.on('exit', () => {
  try {
    const mgr = aiService && aiService.serverManager;
    if (mgr && mgr.ownedPid) {
      process.kill(mgr.ownedPid, 'SIGKILL');
    }
  } catch (e) {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpcHandlers() {
  // Projects
  ipcMain.handle('projects:getAll', async () => {
    return await projectService.getProjects();
  });

  ipcMain.handle('projects:getOne', async (_, id) => {
    return await projectService.getProject(id);
  });

  ipcMain.handle('projects:create', async (_, data) => {
    return await projectService.createProject(data);
  });

  ipcMain.handle('projects:updateData', async (_, id, data) => {
    return await projectService.updateProjectData(id, data);
  });

  ipcMain.handle('projects:delete', async (_, id) => {
    return await projectService.deleteProject(id);
  });

  ipcMain.handle('projects:duplicate', async (_, id) => {
    return await projectService.duplicateProject(id);
  });

  ipcMain.handle('projects:duplicateForMunicipio', async (_, id, newMunicipioData, fichaData) => {
    return await projectService.duplicateProjectForMunicipio(id, newMunicipioData, fichaData);
  });

  ipcMain.handle('projects:rename', async (_, id, newName) => {
    return await projectService.renameProject(id, newName);
  });

  ipcMain.handle('projects:exportJson', async (_, id) => {
    return await projectService.exportProjectJson(id);
  });

  ipcMain.handle('projects:importJson', async (_, data) => {
    return await projectService.importProjectJson(data);
  });

  ipcMain.handle('projects:saveToFile', async (_, id) => {
    const project = await projectService.getProject(id);
    if (!project) throw new Error('Proyecto no encontrado');

    const munSafe = sanitizeSafeName(project.municipio || 'Municipal', 'Municipal');
    const manSafe = sanitizeSafeName(project.mandato || '2027-2031', '2027-2031');
    const defaultFilename = `Programa_${munSafe}_${manSafe}.json`;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar proyecto portátil',
      defaultPath: defaultFilename,
      filters: [{ name: 'Archivo JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) return { canceled: true };

    const exported = await projectService.exportProjectJson(id);
    fs.writeFileSync(result.filePath, JSON.stringify(exported, null, 2), 'utf8');
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('projects:loadFromFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar proyecto portátil',
      filters: [{ name: 'Archivo JSON', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const selectedPath = result.filePaths[0];
    const stat = fs.statSync(selectedPath);
    if (!stat.isFile()) {
      throw new Error('Formato de archivo inválido: el elemento seleccionado no es un archivo regular');
    }
    if (stat.size > projectService.MAX_IMPORT_JSON_BYTES) {
      throw new Error('Formato de archivo inválido: el archivo supera el límite máximo permitido de 25 MB');
    }

    const content = fs.readFileSync(selectedPath, 'utf8');
    const newId = await projectService.importProjectJson(content);
    return { canceled: false, id: newId };
  });

  // Fichas Municipales
  ipcMain.handle('fichas:get', async (_, codigoIne) => {
    return await fichaMunicipioService.getFichaMunicipio(codigoIne);
  });

  ipcMain.handle('fichas:check', async (_, codigoIne) => {
    return await fichaMunicipioService.checkFichaExists(codigoIne);
  });

  ipcMain.handle('fichas:save', async (_, data) => {
    return await fichaMunicipioService.saveFichaMunicipio(data);
  });

  // Decisions & Measures
  ipcMain.handle('measures:updateDecision', async (_, projectId, medidaId, decisionData) => {
    return await projectService.updateMeasureDecision(projectId, medidaId, decisionData);
  });

  ipcMain.handle('measures:batchUpdate', async (_, projectId, medidaIds, nuevoEstado) => {
    return await projectService.batchUpdateDecisions(projectId, medidaIds, nuevoEstado);
  });

  ipcMain.handle('measures:addOwn', async (_, projectId, measureData) => {
    return await projectService.addOwnMeasure(projectId, measureData);
  });

  ipcMain.handle('measures:updateOwn', async (_, id, measureData) => {
    return await projectService.updateOwnMeasure(id, measureData);
  });

  ipcMain.handle('measures:deleteOwn', async (_, id) => {
    return await projectService.deleteOwnMeasure(id);
  });

  // General Texts
  ipcMain.handle('texts:updateGeneral', async (_, projectId, textsData) => {
    return await projectService.updateGeneralTexts(projectId, textsData);
  });

  // Catalog
  ipcMain.handle('catalog:getInfo', async () => {
    return await projectService.getCatalogInfo();
  });

  // Export DOCX
  ipcMain.handle('export:docx', async (_, projectId, options) => {
    const project = await projectService.getProject(projectId);
    if (!project) throw new Error('Proyecto no encontrado');
    const safeOptions = sanitizeExportOptionsFromIpc(options);
    const res = await docxExporter.exportProjectToDocx(project, safeOptions);
    recordExportResultFiles(res);
    return res;
  });

  // Export Directory configuration
  ipcMain.handle('config:getExportDir', async () => {
    return await configService.getExportDirectory();
  });

  ipcMain.handle('config:resetExportDir', async () => {
    return await configService.resetExportDirectory();
  });

  ipcMain.handle('config:getLastProjectId', async () => {
    return await configService.getLastOpenedProjectId();
  });

  ipcMain.handle('config:setLastProjectId', async (_, id) => {
    await configService.setLastOpenedProjectId(id);
    return true;
  });

  // Municipalities search with accent-folding & substring matching (including postal codes)
  ipcMain.handle('ine:search', async (_, query) => {
    if (!query || typeof query !== 'string') return [];
    const qNorm = normalizeSearchText(query);
    if (qNorm.length === 0) return [];

    return cachedMunicipios.filter(m => {
      const nameNorm = normalizeSearchText(m.nombre);
      const provNorm = normalizeSearchText(m.provincia);
      const cod = m.codigo_ine || '';
      const cpMatch = Array.isArray(m.codigos_postales) && m.codigos_postales.some(cp => cp.startsWith(qNorm) || cp.includes(qNorm));
      return nameNorm.includes(qNorm) || provNorm.includes(qNorm) || cod.startsWith(qNorm) || cpMatch;
    }).slice(0, 25);
  });

  // Shell / OS helpers (SEC-007: restricción estricta de apertura de archivos y carpetas)
  ipcMain.handle('shell:openFile', async (_, filePath) => {
    const exportDir = await configService.getExportDirectory();
    const allowedDirs = [exportDir, getDefaultExportDir()].filter(Boolean);
    const check = validateOpenableDocumentPath(filePath, {
      allowedDirs,
      trackedFiles: trackedExportedFiles
    });
    if (!check.allowed) {
      console.warn('[SEC-007] shell:openFile bloqueado:', check.reason, filePath);
      return check.reason;
    }
    return await shell.openPath(check.resolvedPath);
  });

  ipcMain.handle('shell:showInFolder', async (_, filePath) => {
    const exportDir = await configService.getExportDirectory();
    const allowedDirs = [exportDir, getDefaultExportDir()].filter(Boolean);
    const check = validateOpenableDocumentPath(filePath, {
      allowedDirs,
      trackedFiles: trackedExportedFiles
    });
    if (!check.allowed) {
      console.warn('[SEC-007] shell:showInFolder bloqueado:', check.reason, filePath);
      return false;
    }
    shell.showItemInFolder(check.resolvedPath);
    return true;
  });

  ipcMain.handle('shell:openExportDir', async () => {
    const exportDir = path.resolve(await configService.getExportDirectory());
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const stat = fs.statSync(exportDir);
    if (!stat.isDirectory()) {
      throw new Error('Ruta de exportación no válida');
    }
    await shell.openPath(exportDir);
    return true;
  });

  ipcMain.handle('dialog:selectLogo', async (_, codigoIne) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar logo de la agrupación',
      filters: [{ name: 'Imágenes (PNG, JPG)', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }

    const originalPath = result.filePaths[0];
    // Copy into persistent logo storage
    const saved = await fichaMunicipioService.savePersistentLogo(originalPath, codigoIne || 'local');
    return saved.persistentPath;
  });

  ipcMain.handle('dialog:selectExportDir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar carpeta de exportación de documentos',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }

    const selectedDir = result.filePaths[0];
    await configService.setExportDirectory(selectedDir);
    return selectedDir;
  });

  ipcMain.handle('app:getVersion', () => {
    const pkg = require('../../package.json');
    let catVer = 'Sin catálogo preinstalado';
    try {
      const catPath = resolveAssetPath('data', 'catalogo_marco.json');
      if (fs.existsSync(catPath)) {
        const catData = JSON.parse(fs.readFileSync(catPath, 'utf8'));
        if (catData?.metadata?.version) catVer = catData.metadata.version;
        else if (catData?.version) catVer = catData.version;
      }
    } catch (e) {}

    return {
      version: pkg.version || '3.4.0',
      build: `Fase 3.6 (v${pkg.version || '3.4.0'})`,
      appName: pkg.description || 'Constructor de Programas Municipales',
      author: typeof pkg.author === 'object' ? pkg.author.name : (pkg.author || 'elftemir'),
      authorEmail: typeof pkg.author === 'object' ? pkg.author.email : 'elftemir@hotmail.com',
      license: pkg.license || 'GPL-3.0-or-later',
      repositoryUrl: 'https://github.com/elftemir/constructor-programas-municipales',
      catalogoVersion: catVer,
      defaultExportDir: getDefaultExportDir()
    };
  });

  // Lectura segura y offline de documentos legales y avisos
  ipcMain.handle('app:getLegalDoc', async (_, docType) => {
    const allowedDocs = {
      privacy: 'PRIVACY.md',
      license: 'LICENSE',
      thirdParty: 'THIRD_PARTY_NOTICES.md'
    };
    const fileName = allowedDocs[docType];
    if (!fileName) {
      throw new Error(`Tipo de documento legal no válido: ${docType}`);
    }

    const candidatePaths = [
      resolveAssetPath(fileName),
      path.join(__dirname, '..', '..', fileName),
      path.join(process.resourcesPath || '', fileName)
    ];

    for (const c of candidatePaths) {
      if (fs.existsSync(c)) {
        return fs.readFileSync(c, 'utf8');
      }
    }
    throw new Error(`No se pudo encontrar el archivo legal local: ${fileName}`);
  });

  // Apertura segura de URLs externas explícitamente autorizadas (lista blanca estricta)
  ipcMain.handle('shell:openExternalUrl', async (_, targetUrl) => {
    const ALLOWED_EXTERNAL_URLS = new Set([
      'https://github.com/elftemir/constructor-programas-municipales',
      'https://www.libreoffice.org/download/',
      'mailto:elftemir@hotmail.com'
    ]);

    if (typeof targetUrl !== 'string' || !ALLOWED_EXTERNAL_URLS.has(targetUrl.trim())) {
      console.warn('[SEC-008] shell:openExternalUrl bloqueado, URL no autorizada:', targetUrl);
      return false;
    }

    await shell.openExternal(targetUrl.trim());
    return true;
  });

  // PDF Export and Converter Detection (Fase 2)
  ipcMain.handle('export:detectConverters', async () => {
    return pdfExporter.detectConverters();
  });

  ipcMain.handle('export:pdf', async (_, projectId, options) => {
    const project = await projectService.getProject(projectId);
    if (!project) throw new Error('Proyecto no encontrado');
    const safeOptions = sanitizeExportOptionsFromIpc(options);
    const res = await pdfExporter.exportProjectToPdf(project, safeOptions);
    recordExportResultFiles(res);
    return res;
  });

  // Local AI Operations (Fase 2)
  ipcMain.handle('ai:getSpecs', async () => {
    return await aiService.checkHardwareSpecs();
  });

  ipcMain.handle('ai:getModels', async () => {
    return await aiService.getModels();
  });

  ipcMain.handle('ai:installModel', async (event, modelId) => {
    return await aiService.installModel(modelId, (progress) => {
      if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send('ai:download-progress', progress);
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai:download-progress', progress);
      }
    });
  });

  ipcMain.handle('ai:cancelDownload', async (_, modelId) => {
    return aiService.cancelDownload(modelId);
  });

  ipcMain.handle('ai:deleteModel', async (_, modelId) => {
    return await aiService.deleteModel(modelId);
  });

  ipcMain.handle('ai:testModel', async (_, modelId) => {
    return await aiService.testModel(modelId);
  });

  ipcMain.handle('ai:suggestTitles', async (_, params) => {
    return await aiService.sugerirTitulos(params);
  });

  ipcMain.handle('ai:adaptMeasure', async (_, params) => {
    return await aiService.adaptarMedida(params);
  });

  ipcMain.handle('ai:developMeasure', async (_, params) => {
    return await aiService.desarrollarMedida(params);
  });

  ipcMain.handle('ai:improveWriting', async (_, params) => {
    return await aiService.mejorarRedaccion(params);
  });

  ipcMain.handle('ai:correctText', async (_, params) => {
    return await aiService.corregirTexto(params);
  });

  ipcMain.handle('ai:summarizeText', async (_, params) => {
    return await aiService.resumirTexto(params);
  });

  ipcMain.handle('ai:translateText', async (_, params) => {
    return await aiService.traducirTexto(params);
  });

  ipcMain.handle('ai:translateStructuredText', async (_, params) => {
    return await aiService.traducirTextoEstructurado(params);
  });

  ipcMain.handle('ai:draftPresentation', async (_, params) => {
    return await aiService.redactarPresentacion(params);
  });

  ipcMain.handle('ai:draftAreaIntro', async (_, params) => {
    return await aiService.redactarIntroduccionArea(params);
  });

  ipcMain.handle('ai:suggestHighlight', async (_, params) => {
    return await aiService.sugerirFraseDestacada(params);
  });

  ipcMain.handle('ai:draftClosing', async (_, params) => {
    return await aiService.redactarCierre(params);
  });

  ipcMain.handle('ai:reviewText', async (_, params) => {
    return await aiService.revisarTexto(params);
  });

  ipcMain.handle('ai:getDiagnostic', async () => {
    return aiService.getDiagnostic();
  });

  ipcMain.handle('ai:openModelsFolder', async () => {
    const dir = path.resolve(aiService.getModelsDirectory());
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      await shell.openPath(dir);
    }
    return { ok: true, path: dir };
  });

  ipcMain.handle('ai:openCustomCatalogFolder', async () => {
    const dir = path.resolve(resolveCustomCatalogDir());
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      await shell.openPath(dir);
    }
    return { ok: true, path: dir };
  });

  ipcMain.handle('ai:setActiveModel', async (_, modelId) => {
    return aiService.setActiveModel(modelId);
  });

  // Programas Fuente (Fase 3.1)
  ipcMain.handle('sources:getAll', async (_, includeArchived) => {
    return sourceProgramService.getAll(includeArchived !== false);
  });
  ipcMain.handle('sources:getById', async (_, id) => {
    return sourceProgramService.getById(id);
  });
  ipcMain.handle('sources:getActive', async () => {
    return sourceProgramService.getActive();
  });
  ipcMain.handle('sources:setActive', async (_, id) => {
    return sourceProgramService.setActive(id);
  });
  ipcMain.handle('sources:rename', async (_, id, newName) => {
    return sourceProgramService.rename(id, newName);
  });
  ipcMain.handle('sources:archive', async (_, id, archive) => {
    return sourceProgramService.setArchived(id, archive);
  });
  ipcMain.handle('sources:canDelete', async (_, id) => {
    return sourceProgramService.canDelete(id);
  });
  ipcMain.handle('sources:delete', async (_, id) => {
    return sourceProgramService.delete(id);
  });
  ipcMain.handle('sources:getProjectSources', async (_, projectId) => {
    return sourceProgramService.getProjectSources(projectId);
  });
  ipcMain.handle('sources:addSourceToProject', async (_, projectId, fuenteId, rol) => {
    return sourceProgramService.addSourceToProject(projectId, fuenteId, rol);
  });
  ipcMain.handle('sources:removeSourceFromProject', async (_, projectId, fuenteId, force) => {
    return sourceProgramService.removeSourceFromProject(projectId, fuenteId, force);
  });
  ipcMain.handle('sources:saveSourceAreaMapping', async (_, projectId, fuenteId, fuenteAreaId, targetAreaId) => {
    return sourceProgramService.saveSourceAreaMapping(projectId, fuenteId, fuenteAreaId, targetAreaId);
  });
  ipcMain.handle('sources:getIncorporatedMeasures', async (_, projectId, fuenteId) => {
    return sourceProgramService.getIncorporatedMeasures(projectId, fuenteId);
  });
  ipcMain.handle('sources:incorporateMeasure', async (_, projectId, data) => {
    return sourceProgramService.incorporateMeasure(projectId, data);
  });

  // Importador Universal (Fase 3.1)
  const validateImporterDocumentPath = (filePath) => {
    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Ruta de documento a importar no válida');
    }
    const raw = filePath.trim();
    if (/^\\\\/.test(raw) || raw.split(/[\\/]+/).includes('..')) {
      throw new Error('Ruta de documento no permitida por seguridad');
    }
    const resolved = path.resolve(raw);
    const ext = path.extname(resolved).toLowerCase();
    if (ext !== '.docx' && ext !== '.pdf') {
      throw new Error('Solo se permiten documentos con extensión .docx o .pdf');
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error('El documento seleccionado no existe o no es un archivo regular');
    }
    return resolved;
  };

  ipcMain.handle('importer:selectFile', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar programa fuente (.docx o .pdf)',
      filters: [
        { name: 'Documentos políticos (.docx, .pdf)', extensions: ['docx', 'pdf'] },
        { name: 'Microsoft Word (.docx)', extensions: ['docx'] },
        { name: 'Documentos PDF (.pdf)', extensions: ['pdf'] }
      ],
      properties: ['openFile']
    });
    if (res.canceled || !res.filePaths || !res.filePaths.length) return null;
    return res.filePaths[0];
  });

  ipcMain.handle('importer:analyzeDocument', async (_, filePath, language) => {
    const safePath = validateImporterDocumentPath(filePath);
    return await documentStructuringService.analyzeDocument(safePath, language);
  });

  ipcMain.handle('importer:runOcr', async (event, filePath, language, options = {}) => {
    try {
    const safePath = validateImporterDocumentPath(filePath);
    return await documentStructuringService.runOcr(safePath, language, progress => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('importer:ocrProgress', progress);
      }
    }, { workers: options?.workers === 2 ? 2 : 1, primaryLanguage: options?.primaryLanguage === 'ca' ? 'ca' : 'es' });
    } catch (error) {
      const codes = ['OCR_CANCELLED', 'OCR_UNAVAILABLE', 'OCR_NO_TEXT', 'OCR_BUSY', 'OCR_INVALID_LANGUAGE', 'OCR_INVALID_FILE'];
      return { ok: false, error: { code: codes.includes(error.code || error.message) ? (error.code || error.message) : 'OCR_INVALID_FILE' } };
    }
  });

  ipcMain.handle('importer:cancelOcr', async () => {
    await documentStructuringService.cancelOcr();
    return true;
  });

  ipcMain.handle('importer:confirmImport', async (_, data) => {
    return sourceProgramService.createImportedSource(data);
  });

  ipcMain.handle('importer:addLanguage', async (_, sourceId, targetLang, data) => {
    return sourceProgramService.addLanguageToSource(sourceId, targetLang, data);
  });

  ipcMain.handle('importer:classifyWithAi', async (_, blocks, context) => {
    return documentStructuringService.classifyWithAi(blocks, context);
  });

  // Actualizaciones de aplicación (Fase 3.4A)
  updateService.setBeforeQuitHook(async () => {
    await aiService.stopServer({ isAppQuit: true, graceMs: 1500 });
    isQuittingApp = true;
  });

  updateService.onStatusChange((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', status);
    }
  });

  ipcMain.handle('updater:getStatus', () => {
    return updateService.getStatus();
  });

  ipcMain.handle('updater:check', async () => {
    return await updateService.checkForUpdates({ silent: false, source: 'manual' });
  });

  ipcMain.handle('updater:download', async () => {
    return await updateService.downloadUpdate();
  });

  ipcMain.handle('updater:install', async () => {
    return await updateService.installDownloadedUpdate();
  });

  // Actualizaciones de contenidos (Fase 3.4B)
  contentUpdateService.onStatusChange((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('contentUpdater:status', status);
    }
  });

  ipcMain.handle('contentUpdater:getStatus', () => {
    return contentUpdateService.getStatus();
  });

  ipcMain.handle('contentUpdater:check', async () => {
    return await contentUpdateService.checkForContentUpdates({ silent: false });
  });

  ipcMain.handle('contentUpdater:install', async (_, contentId) => {
    if (!contentId || typeof contentId !== 'string') {
      throw new Error('ID de contenido no válido');
    }
    return await contentUpdateService.installContentUpdate(contentId);
  });
}



