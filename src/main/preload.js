const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Projects
  getProjects: () => ipcRenderer.invoke('projects:getAll'),
  getProject: (id) => ipcRenderer.invoke('projects:getOne', id),
  createProject: (data) => ipcRenderer.invoke('projects:create', data),
  updateProjectData: (id, data) => ipcRenderer.invoke('projects:updateData', id, data),
  deleteProject: (id) => ipcRenderer.invoke('projects:delete', id),
  duplicateProject: (id) => ipcRenderer.invoke('projects:duplicate', id),
  duplicateProjectForMunicipio: (id, newMun, ficha) => ipcRenderer.invoke('projects:duplicateForMunicipio', id, newMun, ficha),
  renameProject: (id, newName) => ipcRenderer.invoke('projects:rename', id, newName),
  exportProjectJson: (id) => ipcRenderer.invoke('projects:exportJson', id),
  importProjectJson: (data) => ipcRenderer.invoke('projects:importJson', data),
  saveProjectToFile: (id) => ipcRenderer.invoke('projects:saveToFile', id),
  loadProjectFromFile: () => ipcRenderer.invoke('projects:loadFromFile'),

  // Fichas Locales de Municipio
  getFichaMunicipio: (codigoIne) => ipcRenderer.invoke('fichas:get', codigoIne),
  checkFichaExists: (codigoIne) => ipcRenderer.invoke('fichas:check', codigoIne),
  saveFichaMunicipio: (data) => ipcRenderer.invoke('fichas:save', data),

  // Decisions & Measures
  updateMeasureDecision: (projectId, medidaId, decisionData) =>
    ipcRenderer.invoke('measures:updateDecision', projectId, medidaId, decisionData),
  batchUpdateDecisions: (projectId, medidaIds, nuevoEstado) =>
    ipcRenderer.invoke('measures:batchUpdate', projectId, medidaIds, nuevoEstado),
  addOwnMeasure: (projectId, measureData) =>
    ipcRenderer.invoke('measures:addOwn', projectId, measureData),
  updateOwnMeasure: (id, measureData) =>
    ipcRenderer.invoke('measures:updateOwn', id, measureData),
  deleteOwnMeasure: (id) =>
    ipcRenderer.invoke('measures:deleteOwn', id),

  // General Texts
  updateGeneralTexts: (projectId, textsData) =>
    ipcRenderer.invoke('texts:updateGeneral', projectId, textsData),

  // Catalog
  getCatalogInfo: () => ipcRenderer.invoke('catalog:getInfo'),

  // Export DOCX & PDF
  exportToDocx: (projectId, options) =>
    ipcRenderer.invoke('export:docx', projectId, options),
  exportToPdf: (projectId, options) =>
    ipcRenderer.invoke('export:pdf', projectId, options),
  detectPdfConverters: () =>
    ipcRenderer.invoke('export:detectConverters'),
  getExportDir: () => ipcRenderer.invoke('config:getExportDir'),
  resetExportDir: () => ipcRenderer.invoke('config:resetExportDir'),
  openExportDir: () => ipcRenderer.invoke('shell:openExportDir'),

  // Municipalities search (INE / Idescat)
  searchMunicipios: (query) =>
    ipcRenderer.invoke('ine:search', query),

  // Shell / OS helpers
  openFile: (filePath) => ipcRenderer.invoke('shell:openFile', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showInFolder', filePath),
  selectLogoFile: (codigoIne) => ipcRenderer.invoke('dialog:selectLogo', codigoIne),
  selectExportDir: () => ipcRenderer.invoke('dialog:selectExportDir'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getLastOpenedProjectId: () => ipcRenderer.invoke('config:getLastProjectId'),
  setLastOpenedProjectId: (id) => ipcRenderer.invoke('config:setLastProjectId', id),

  // Local AI (Fase 2)
  aiGetSpecs: () => ipcRenderer.invoke('ai:getSpecs'),
  aiGetModels: () => ipcRenderer.invoke('ai:getModels'),
  aiInstallModel: (modelId) => ipcRenderer.invoke('ai:installModel', modelId),
  aiCancelDownload: (modelId) => ipcRenderer.invoke('ai:cancelDownload', modelId),
  aiDeleteModel: (modelId) => ipcRenderer.invoke('ai:deleteModel', modelId),
  aiTestModel: (modelId) => ipcRenderer.invoke('ai:testModel', modelId),
  aiSuggestTitles: (params) => ipcRenderer.invoke('ai:suggestTitles', params),
  aiAdaptMeasure: (params) => ipcRenderer.invoke('ai:adaptMeasure', params),
  aiDevelopMeasure: (params) => ipcRenderer.invoke('ai:developMeasure', params),
  aiImproveWriting: (params) => ipcRenderer.invoke('ai:improveWriting', params),
  aiCorrectText: (params) => ipcRenderer.invoke('ai:correctText', params),
  aiSummarizeText: (params) => ipcRenderer.invoke('ai:summarizeText', params),
  aiTranslateText: (params) => ipcRenderer.invoke('ai:translateText', params),
  aiTranslateStructuredText: (params) => ipcRenderer.invoke('ai:translateStructuredText', params),
  aiDraftPresentation: (params) => ipcRenderer.invoke('ai:draftPresentation', params),
  aiDraftAreaIntro: (params) => ipcRenderer.invoke('ai:draftAreaIntro', params),
  aiSuggestHighlight: (params) => ipcRenderer.invoke('ai:suggestHighlight', params),
  aiDraftClosing: (params) => ipcRenderer.invoke('ai:draftClosing', params),
  aiReviewText: (params) => ipcRenderer.invoke('ai:reviewText', params),
  aiGetDiagnostic: () => ipcRenderer.invoke('ai:getDiagnostic'),
  aiOpenModelsFolder: () => ipcRenderer.invoke('ai:openModelsFolder'),
  aiOpenCustomCatalogFolder: () => ipcRenderer.invoke('ai:openCustomCatalogFolder'),
  aiSetActiveModel: (modelId) => ipcRenderer.invoke('ai:setActiveModel', modelId),
  onAiDownloadProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('ai:download-progress', handler);
    return () => ipcRenderer.removeListener('ai:download-progress', handler);
  },

  // Listen for shortcuts
  onGlobalSave: (callback) => {
    ipcRenderer.on('shortcut:save', () => callback());
  },

  // Programas Fuente & Importador (Fase 3.1)
  getSourcePrograms: (includeArchived) => ipcRenderer.invoke('sources:getAll', includeArchived),
  getSourceProgram: (id) => ipcRenderer.invoke('sources:getById', id),
  getActiveSourceProgram: () => ipcRenderer.invoke('sources:getActive'),
  setActiveSourceProgram: (id) => ipcRenderer.invoke('sources:setActive', id),
  renameSourceProgram: (id, newName) => ipcRenderer.invoke('sources:rename', id, newName),
  archiveSourceProgram: (id, archive) => ipcRenderer.invoke('sources:archive', id, archive),
  canDeleteSourceProgram: (id) => ipcRenderer.invoke('sources:canDelete', id),
  deleteSourceProgram: (id) => ipcRenderer.invoke('sources:delete', id),
  getProjectSources: (projectId) => ipcRenderer.invoke('sources:getProjectSources', projectId),
  addSourceToProject: (projectId, fuenteId, rol) => ipcRenderer.invoke('sources:addSourceToProject', projectId, fuenteId, rol),
  removeSourceFromProject: (projectId, fuenteId, force) => ipcRenderer.invoke('sources:removeSourceFromProject', projectId, fuenteId, force),
  saveSourceAreaMapping: (projectId, fuenteId, fuenteAreaId, targetAreaId) => ipcRenderer.invoke('sources:saveSourceAreaMapping', projectId, fuenteId, fuenteAreaId, targetAreaId),
  getIncorporatedMeasures: (projectId, fuenteId) => ipcRenderer.invoke('sources:getIncorporatedMeasures', projectId, fuenteId),
  incorporateMeasure: (projectId, data) => ipcRenderer.invoke('sources:incorporateMeasure', projectId, data),

  // Importador
  importerSelectFile: () => ipcRenderer.invoke('importer:selectFile'),
  importerAnalyzeDocument: (filePath, language) => ipcRenderer.invoke('importer:analyzeDocument', filePath, language),
  importerRunOcr: (filePath, language) => ipcRenderer.invoke('importer:runOcr', filePath, language),
  importerCancelOcr: () => ipcRenderer.invoke('importer:cancelOcr'),
  importerConfirmImport: (data) => ipcRenderer.invoke('importer:confirmImport', data),
  importerAddLanguage: (sourceId, targetLang, data) => ipcRenderer.invoke('importer:addLanguage', sourceId, targetLang, data),
  importerClassifyWithAi: (blocks, context) => ipcRenderer.invoke('importer:classifyWithAi', blocks, context),
  onImporterOcrProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('importer:ocrProgress', handler);
    return () => ipcRenderer.removeListener('importer:ocrProgress', handler);
  },

  // Actualizaciones de aplicación (Fase 3.4A)
  getUpdateStatus: () => ipcRenderer.invoke('updater:getStatus'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installDownloadedUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  },

  // Actualizaciones de contenidos (Fase 3.4B)
  getContentUpdateStatus: () => ipcRenderer.invoke('contentUpdater:getStatus'),
  checkContentUpdates: () => ipcRenderer.invoke('contentUpdater:check'),
  installContentUpdate: (contentId) => ipcRenderer.invoke('contentUpdater:install', contentId),
  onContentUpdateStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('contentUpdater:status', handler);
    return () => ipcRenderer.removeListener('contentUpdater:status', handler);
  }
});

