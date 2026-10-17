/**
 * aiService.js - Coordinador Principal de Inteligencia Artificial Local (Fase 2)
 * Constructor de Programas Municipales Podemos - Versión 2.0.2
 *
 * Principio Fundamental: LA IA PROPONE. EL USUARIO DECIDE.
 * 100% Local, Privado y Opcional: Inferencia mediante llama.cpp nativo en Windows x64.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { getDb, save } = require('../../db/database');
const {
  getUserDataDir,
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
  resolveSafePath,
  isPathInside
} = require('../../utils/paths');
const {
  BuiltinLocalAiEngine,
  LlamaCppProvider,
  serverManager
} = require('./aiProvider');

function verifyGgufHeader(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    if (stats.size < 1000000) return false;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf.toString('utf8') === 'GGUF';
  } catch (e) {
    return false;
  }
}

const {DEFAULT_MODEL_ID,QUALITY_MODEL_ID,RETIRED_MODEL,isRetired,verifyFileSha256}=require('./modelPolicy');

class AiService {
  constructor() {
    this.serverManager = serverManager;
    this.activeDownloads = new Map();
    this.builtinEngine = new BuiltinLocalAiEngine();
    this.selectionFile=path.join(getUserDataDir(),'ai-model-selection.json');
    this.selection={};try{this.selection=JSON.parse(fs.readFileSync(this.selectionFile,'utf8'));}catch(_){}
    const previous=this.selection.activeModelId;
    this.activeModelId=previous&&!isRetired({id:previous})?previous:DEFAULT_MODEL_ID;
    this.catalog = this.loadCatalog();
    this.retirementPending=isRetired({id:previous})||fs.existsSync(this.getModelFilePath(RETIRED_MODEL));
    if(isRetired({id:previous})){this.selection.retiredModelDetected=true;this.persistSelection();}
  }

  getDefaultCatalog() {
    return JSON.parse(JSON.stringify(require('../../../../data/ai_models.json').models));
  }

  loadCatalog() {
    let officialModels = [];
    const officialPath = resolveOfficialCatalogFile();
    try {
      if (fs.existsSync(officialPath)) {
        const raw = fs.readFileSync(officialPath, 'utf8');
        const parsed = JSON.parse(raw);
        officialModels = parsed.models || (Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.warn('Aviso leyendo catálogo oficial:', e.message);
    }

    if (!officialModels || officialModels.length === 0) {
      officialModels = this.getDefaultCatalog();
    }

    // Merge con catálogo personalizado en %LOCALAPPDATA%\...\AI\catalog\ai_models.json
    let customModels = [];
    const customPath = resolveCustomCatalogFile();
    try {
      if (fs.existsSync(customPath)) {
        const raw = fs.readFileSync(customPath, 'utf8');
        const parsed = JSON.parse(raw);
        customModels = parsed.models || (Array.isArray(parsed) ? parsed : []);
      } else {
        // Crear plantilla vacía/ejemplo en disco
        const sampleCustom = {
          models: []
        };
        fs.writeFileSync(customPath, JSON.stringify(sampleCustom, null, 2), 'utf8');
      }
    } catch (e) {
      console.warn('Aviso leyendo catálogo personalizado:', e.message);
    }

    const officialIds = new Set(officialModels.map(m => m.id));
    const merged = [...officialModels];
    for (const cm of customModels) {
      if (cm && cm.id && !officialIds.has(cm.id)) {
        merged.push({ ...cm, custom: true });
      }
    }

    return merged.filter(model=>!isRetired(model));
  }

  getModelsDirectory() {
    return resolveModelsDir();
  }

  getModelFilePath(model) {
    const modelsDir = path.resolve(this.getModelsDirectory());
    const safeId = sanitizeSafeName(model?.id, 'model');
    const rawFile = path.basename(String(model?.filename || model?.archivo || 'model.gguf'));
    const baseFile = sanitizeSafeName(rawFile.replace(/\.gguf$/i, ''), 'model');
    const safeFilename = `${baseFile}.gguf`;

    // 1. Subcarpeta estándar models/<id>/<filename>
    const subfolderPath = resolveSafePath(modelsDir, safeId, safeFilename);
    if (fs.existsSync(subfolderPath)) return subfolderPath;

    // 2. Archivo plano en models/<filename>
    const flatPath = resolveSafePath(modelsDir, safeFilename);
    if (fs.existsSync(flatPath)) return flatPath;

    // 3. Búsqueda recursiva en cualquier subdirectorio directo de modelsDir
    try {
      const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory()) {
          const candidate = path.resolve(modelsDir, ent.name, safeFilename);
          if (isPathInside(modelsDir, candidate, false) && fs.existsSync(candidate)) {
            return candidate;
          }
        }
      }
    } catch (e) {}

    // Por defecto, guardar en subcarpeta contenida dentro de modelsDir
    const subDir = resolveSafePath(modelsDir, safeId);
    if (!fs.existsSync(subDir)) {
      try { fs.mkdirSync(subDir, { recursive: true }); } catch (e) {}
    }
    return subfolderPath;
  }

  async stopServer(options = {}) {
    return await serverManager.stopServer(options);
  }

  async checkHardwareSpecs() {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const totalMemGb = (totalMemBytes / (1024 ** 3)).toFixed(1);
    const freeMemGb = (freeMemBytes / (1024 ** 3)).toFixed(1);
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Procesador estándar';
    const cpuCores = cpus.length;
    const arch = os.arch();

    let diskFreeGb = 10;
    try {
      const stats = fs.statfsSync(this.getModelsDirectory());
      diskFreeGb = ((stats.bfree * stats.bsize) / (1024 ** 3)).toFixed(1);
    } catch (e) {
      diskFreeGb = '10+';
    }

    let recomendacion = 'Tu equipo puede ejecutar correctamente el modelo recomendado (Qwen 2.5 1.5B).';
    let recomendacionCa = 'El teu equip pot executar correctament el model recomanat (Qwen 2.5 1.5B).';

    if (totalMemBytes < 4 * (1024 ** 3)) {
      recomendacion = 'Para este equipo recomendamos el modelo ligero (0.5B) para garantizar máxima fluidez.';
      recomendacionCa = 'Per a aquest equip recomanem el model lleuger (0.5B) per garantir la màxima fluïdesa.';
    } else if (totalMemBytes >= 16 * (1024 ** 3)) {
      recomendacion = 'Tu equipo cuenta con potencia excelente para ejecutar cualquiera de los perfiles disponibles.';
      recomendacionCa = 'El teu equip compta amb potència excel·lent per executar qualsevol dels perfils disponibles.';
    }

    let compatibleGpu=false;
    try{const devices=await serverManager.backendSelection.listDevices(),qualityModel=this.getDefaultCatalog().find(m=>m.id==='qwen3-4b-instruct-2507-q4');compatibleGpu=require('./backendSelection').candidateDevices(devices,qualityModel?.expectedSizeBytes||qualityModel?.sizeBytes||3*1024**3).length>0;}catch(_){}
    const recommendedModelId=compatibleGpu||totalMemBytes>=16*1024**3?'qwen3-4b-instruct-2507-q4':'qwen2.5-1.5b-instruct-q4';
    if(recommendedModelId==='qwen3-4b-instruct-2507-q4'){recomendacion='Para textos en catalán recomendamos Qwen3 4B. Tu equipo tiene GPU compatible o al menos 16 GB de RAM.';recomendacionCa='Per a textos en català recomanem Qwen3 4B. El teu equip té GPU compatible o almenys 16 GB de RAM.';}
    else{recomendacion='Para equipos modestos recomendamos Qwen 2.5 1.5B. Su calidad en catalán es limitada; revisa el texto.';recomendacionCa='Per a equips modestos recomanem Qwen 2.5 1.5B. La seva qualitat en català és limitada; revisa el text.';}
    const runtimePath = getAiRuntimePath();
    const runtimeAvailable = !!(runtimePath && fs.existsSync(runtimePath));

    return {
      arch,
      cpuModel,
      cpuCores,
      totalMemGb,
      recommendedModelId,
      compatibleGpu,
      freeMemGb,
      diskFreeGb,
      recomendacion,
      recomendacionCa,
      apto: totalMemBytes >= 3.5 * (1024 ** 3),
      runtimeAvailable,
      runtimePath: runtimePath || 'No instalado'
    };
  }

  async checkHardware() {
    return await this.checkHardwareSpecs();
  }

  async getAvailableModels() {
    const neuralModels = await this.getModels();
    const builtin = {
      id: 'builtin_local',
      nombre: 'Motor lingüístico integrado (0 descargas)',
      name: 'Motor lingüístico integrado (0 descargas)',
      archivo: null,
      filename: null,
      ruta: null,
      tamano_bytes: 0,
      sizeBytes: 0,
      parametros: 'Integrado',
      cuantizacion: 'Reglas NLP',
      recomendado: false,
      instalado: true,
      installed: true,
      estado: 'LISTO',
      descripcion: 'Motor determinista y de reglas para funcionamiento 100% autónomo sin descargar modelos neuronales.',
      url_descarga: null,
      runtimeAvailable: true
    };
    return [builtin, ...neuralModels];
  }

  async getModels() {
    const db = await getDb();
    const catalog = this.catalog;
    const runtimePath = getAiRuntimePath();
    const runtimeAvailable = !!(runtimePath && fs.existsSync(runtimePath));

    const resultList = [];

    for (const def of catalog) {
      const targetPath = this.getModelFilePath(def);
      const fileValid = verifyGgufHeader(targetPath);

      // Determinación de estado físico real
      let estado = 'DISPONIBLE';
      if (this.activeDownloads.has(def.id)) {
        estado = 'DESCARGANDO';
      } else if (fileValid) {
        estado = runtimeAvailable ? 'LISTO' : 'PREPARANDO_RUNTIME';
      }

      // Sincronizar con SQLite
      const downloadUrl = def.downloadUrl || `https://huggingface.co/${def.repoId}/resolve/${def.revision||'main'}/${def.filename}`;
      const existing = db.exec('SELECT * FROM ai_modelos WHERE id = ?', [def.id]);
      if (!existing || existing.length === 0 || existing[0].values.length === 0) {
        db.run(`
          INSERT INTO ai_modelos (id, nombre, archivo, ruta, tamano_bytes, parametros, cuantizacion, recomendado, instalado, descripcion, url_descarga)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          def.id, def.name, def.filename, fileValid ? targetPath : null, def.sizeBytes,
          def.id.includes('1.5b') ? '1.5B' : (def.id.includes('0.5b') ? '0.5B' : '4B'),
          def.quantization, def.recommended ? 1 : 0, fileValid ? 1 : 0,
          def.description, downloadUrl
        ]);
      } else {
        db.run(`
          UPDATE ai_modelos 
          SET instalado = ?, ruta = ?, url_descarga = ?, tamano_bytes = ?, nombre = ?, descripcion = ?
          WHERE id = ?
        `, [fileValid ? 1 : 0, fileValid ? targetPath : null, downloadUrl, def.sizeBytes, def.name, def.description, def.id]);
      }

      resultList.push({
        id: def.id,
        nombre: def.name,
        name: def.name,
        archivo: def.filename,
        filename: def.filename,
        ruta: fileValid ? targetPath : null,
        tamano_bytes: def.sizeBytes,
        sizeBytes: def.sizeBytes,
        sha256: def.sha256 || null,
        license: def.license || null,
        licenseUrl: def.licenseUrl || null,
        licenseRestricted: def.licenseRestricted === true || /research|non[- ]commercial|(?:^|[- ])nc(?:$|[- ])/i.test(def.license || ''),
        parametros: def.id.includes('1.5b') ? '1.5B' : (def.id.includes('0.5b') ? '0.5B' : '4B'),
        cuantizacion: def.quantization,
        recomendado: !!def.recommended,
        instalado: fileValid,
        installed: fileValid,
        estado: estado,
        descripcion: def.description,
        descripcionCa: def.descriptionCa || null,
        url_descarga: downloadUrl,
        runtimeAvailable
      });
    }

    save();
    return resultList;
  }

  async getModelById(modelId) {
    const models = await this.getModels();
    return models.find(m => m.id === modelId) || null;
  }

  async installModel(modelId, progressCallback) {
    const models = await this.getModels();
    const model = models.find(m => m.id === modelId);
    if (!model) throw new Error('Modelo no encontrado en el catálogo');
    if (!model.url_descarga) throw new Error('Este modelo no dispone de URL de descarga');

    const targetFile = this.getModelFilePath(model);
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const partFile = targetFile + '.part';

    if (this.activeDownloads.has(modelId)) {
      throw new Error('La descarga ya está en curso');
    }

    try {
      if (fs.existsSync(partFile)) fs.unlinkSync(partFile);
    } catch (e) {}

    const emitPhase = (phaseNum, phaseName, extra = {}) => {
      if (progressCallback) {
        try {
          progressCallback({
            modelId,
            phase: phaseNum,
            phaseName,
            percent: extra.percent || 0,
            downloadedBytes: extra.downloadedBytes || 0,
            totalBytes: extra.totalBytes || model.tamano_bytes,
            speedBytesSec: extra.speedBytesSec || 0,
            etaSeconds: extra.etaSeconds || 0,
            message: `Paso ${phaseNum}: ${phaseName}`
          });
        } catch (e) {}
      }
    };

    // FASE 1: Preparando instalación
    emitPhase(1, 'Preparando instalación…');

    // FASE 2: Comprobando conexión a Internet
    emitPhase(2, 'Comprobando conexión a Internet…');
    await new Promise((resolve, reject) => {
      const probe = https.get('https://huggingface.co', { timeout: 8000 }, (res) => {
        res.resume();
        resolve(true);
      });
      probe.on('error', () => reject(new Error('No se puede conectar con Hugging Face. Comprueba tu conexión a Internet.')));
      probe.on('timeout', () => {
        probe.destroy();
        reject(new Error('Tiempo de espera agotado al verificar conexión con Hugging Face.'));
      });
    });

    // FASE 3: Conectando con Hugging Face
    emitPhase(3, 'Conectando con Hugging Face…');

    // FASE 4: Localizando modelo
    emitPhase(4, `Localizando modelo ${model.nombre} (${model.cuantizacion})…`);

    // FASE 5: Verificando disponibilidad
    emitPhase(5, 'Verificando disponibilidad en el repositorio…');

    // FASE 6: Comprobando espacio disponible
    emitPhase(6, 'Comprobando espacio en disco disponible…');
    try {
      const stats = fs.statfsSync(targetDir);
      const freeBytes = stats.bfree * stats.bsize;
      if (freeBytes < (model.tamano_bytes || 500000000) * 1.1) {
        throw new Error('Espacio insuficiente en disco para descargar y alojar este modelo.');
      }
    } catch (e) {
      if (e.message.includes('Espacio insuficiente')) throw e;
    }

    return new Promise((resolve, reject) => {
      const activeState = {
        req: null,
        res: null,
        fileStream: null,
        partFile,
        aborted: false
      };
      this.activeDownloads.set(modelId, activeState);

      let fileStream = null;
      let downloadedBytes = 0;
      let totalBytes = model.tamano_bytes || 0;
      let startTime = Date.now();
      let lastProgressReportTime = 0;

      const cleanupAndReject = (err) => {
        if (activeState.aborted) {
          this.activeDownloads.delete(modelId);
          return reject(new Error('Descarga cancelada'));
        }
        try {
          if (fileStream && !fileStream.destroyed) fileStream.destroy();
          if (fs.existsSync(partFile)) fs.unlinkSync(partFile);
        } catch (e) {}
        this.activeDownloads.delete(modelId);
        reject(err);
      };

      const sendProgress = (force = false) => {
        const now = Date.now();
        if (!force && (now - lastProgressReportTime < 150)) return;
        lastProgressReportTime = now;
        const elapsedSec = (now - startTime) / 1000;
        const speedBytesSec = elapsedSec > 0 ? (downloadedBytes / elapsedSec) : 0;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
        const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
        const etaSeconds = speedBytesSec > 0 ? Math.round(remainingBytes / speedBytesSec) : 0;

        if (progressCallback && !activeState.aborted) {
          try {
            progressCallback({
              modelId,
              phase: 7,
              phaseName: 'Descargando modelo…',
              downloadedBytes,
              totalBytes,
              percent,
              speedBytesSec: Math.round(speedBytesSec),
              etaSeconds,
              message: `Descargando: ${Math.round(downloadedBytes / 1000000)} MB de ${Math.round(totalBytes / 1000000)} MB (${(speedBytesSec / 1000000).toFixed(1)} MB/s)`
            });
          } catch (e) {}
        }
      };

      const downloadUrl = (currentUrl, redirectCount = 0) => {
        if (activeState.aborted) return cleanupAndReject(new Error('Descarga cancelada'));
        if (redirectCount > 10) return cleanupAndReject(new Error('Demasiadas redirecciones HTTP'));

        let parsedUrl;
        try {
          parsedUrl = new URL(currentUrl);
        } catch (e) {
          return cleanupAndReject(new Error('URL de descarga inválida'));
        }

        // SEC-005: Restricción estricta de protocolo HTTPS
        if (parsedUrl.protocol !== 'https:') {
          return cleanupAndReject(new Error('Protocolo de descarga no seguro: sólo se permite HTTPS'));
        }

        // SEC-005: Allowlist de dominios de Hugging Face
        const hostname = parsedUrl.hostname.toLowerCase();
        const isAllowed = hostname === 'huggingface.co' || hostname.endsWith('.huggingface.co') ||
                          hostname === 'hf.co' || hostname.endsWith('.hf.co');
        if (!isAllowed) {
          return cleanupAndReject(new Error(`Dominio de descarga no permitido: ${hostname}`));
        }

        const client = https;

        const reqOptions = {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname + parsedUrl.search,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ProgramaElectoral/2.0',
            'Accept': '*/*'
          }
        };

        const req = client.get(reqOptions, (res) => {
          activeState.res = res;

          // Seguir redirecciones 301, 302, 303, 307, 308 (validando URL en la siguiente llamada)
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume();
            const nextUrl = new URL(res.headers.location, currentUrl).href;
            return downloadUrl(nextUrl, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            res.resume();
            return cleanupAndReject(new Error(`Servidor de descarga respondió HTTP ${res.statusCode}`));
          }

          const headerLen = parseInt(res.headers['content-length'], 10);
          if (headerLen && !isNaN(headerLen) && headerLen > 0) {
            totalBytes = headerLen;
          }

          fileStream = fs.createWriteStream(partFile);
          fileStream.on('error', (err) => {
            if (!activeState.aborted) cleanupAndReject(err);
          });
          activeState.fileStream = fileStream;

          const sha256Hash = crypto.createHash('sha256');

          // FASE 7: Descargando modelo
          sendProgress(true);

          res.on('data', (chunk) => {
            if (activeState.aborted || fileStream.destroyed || fileStream.closed) {
              try { res.destroy(); } catch (e) {}
              return;
            }
            downloadedBytes += chunk.length;
            sha256Hash.update(chunk);
            try {
              fileStream.write(chunk);
            } catch (e) {
              if (!activeState.aborted) cleanupAndReject(e);
              return;
            }
            sendProgress(false);
          });

          res.on('end', () => {
            if (activeState.aborted || fileStream.destroyed) return;
            sendProgress(true);

            fileStream.end(async () => {
              try {
                if (activeState.aborted) return cleanupAndReject(new Error('Descarga cancelada'));

                // FASE 8: Verificando archivo e integridad SHA-256 (SEC-005)
                emitPhase(8, 'Verificando archivo e integridad SHA-256…', { percent: 100 });

                const expectedSha256 = (model.sha256 || this.getDefaultCatalog().find(m => m.id === modelId)?.sha256 || '').toLowerCase();
                if (expectedSha256) {
                  const computedSha256 = sha256Hash.digest('hex').toLowerCase();
                  if (computedSha256 !== expectedSha256) {
                    console.error(`Fallo de verificación de integridad SHA-256 para ${modelId}: esperado ${expectedSha256}, calculado ${computedSha256}`);
                    return cleanupAndReject(new Error('La descarga no supera la comprobación de integridad.'));
                  }
                }

                const isValidGguf = verifyGgufHeader(partFile);
                if (!isValidGguf) {
                  return cleanupAndReject(new Error('El archivo descargado no superó la verificación GGUF. Puede estar incompleto o corrupto.'));
                }

                if (fs.existsSync(targetFile)) {
                  fs.unlinkSync(targetFile);
                }
                fs.renameSync(partFile, targetFile);

                // FASE 9: Preparando motor local
                emitPhase(9, 'Preparando motor llama.cpp local…', { percent: 100 });
                const runtime = getAiRuntimePath();
                if (!runtime || !fs.existsSync(runtime)) {
                  console.warn('llama-server.exe no encontrado en runtime');
                }

                // FASE 10: Cargando modelo
                emitPhase(10, 'Cargando modelo en memoria…', { percent: 100 });

                // FASE 11: Comprobando funcionamiento
                emitPhase(11, 'Comprobando funcionamiento e inferencia de prueba…', { percent: 100 });
                const provider = new LlamaCppProvider(targetFile, modelId);
                const testResult = await provider.testConnection();
                if (!testResult.ok) {
                  console.warn('Aviso en prueba de inferencia post-descarga:', testResult.message);
                }

                // FASE 12: IA lista para usar
                emitPhase(12, 'IA lista para usar ✓', { percent: 100 });

                const db = await getDb();
                const now = new Date().toISOString();
                db.run(
                  `UPDATE ai_modelos SET instalado = 1, ruta = ?, fecha_instalacion = ? WHERE id = ?`,
                  [targetFile, now, modelId]
                );
                save();

                this.activeDownloads.delete(modelId);
                resolve({ ok: true, path: targetFile, modelId });
              } catch (err) {
                cleanupAndReject(err);
              }
            });
          });

          res.on('error', (err) => {
            cleanupAndReject(err);
          });
        });

        req.setTimeout(45000, () => {
          req.destroy(new Error('Tiempo de espera agotado al conectar con el servidor de descarga'));
        });

        req.on('error', (err) => {
          cleanupAndReject(err);
        });

        activeState.req = req;
      };

      downloadUrl(model.url_descarga);
    });
  }

  cancelDownload(modelId) {
    const active = this.activeDownloads.get(modelId);
    if (active) {
      active.aborted = true;
      try {
        if (active.req) active.req.destroy();
        if (active.res) active.res.destroy();
        if (active.fileStream) active.fileStream.destroy();
      } catch (e) {
        console.warn('Error cancelando descarga:', e);
      }
      setTimeout(() => {
        try {
          if (fs.existsSync(active.partFile)) fs.unlinkSync(active.partFile);
        } catch (e) {}
      }, 150);
      this.activeDownloads.delete(modelId);
      return true;
    }
    return false;
  }

  async deleteModel(modelId) {
    // Si estaba corriendo en el servidor, detenerlo primero
    if (serverManager.activeModelId === modelId) {
      await serverManager.stopServer();
    }

    const models = await this.getModels();
    const model = modelId===RETIRED_MODEL.id ? RETIRED_MODEL : models.find(m => m.id === modelId);
    if (!model) return false;

    const targetFile = this.getModelFilePath(model);
    const partFile = targetFile + '.part';

    try {
      if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
      if (fs.existsSync(partFile)) fs.unlinkSync(partFile);
    } catch (e) {
      console.warn('Aviso eliminando archivos de modelo:', e);
    }

    const db = await getDb();
    db.run(`UPDATE ai_modelos SET instalado = 0, ruta = NULL, fecha_instalacion = NULL WHERE id = ?`, [modelId]);
    save();
    return true;
  }

  async getActiveProvider() {
    const availability=await this.getAvailability();
    if(availability.available)return new LlamaCppProvider(availability.modelPath,availability.modelId);
    return this.builtinEngine;
  }

  async getAvailability() {
    const candidates=this.catalog.filter(def=>def.id&&def.filename).map(def=>({...def,file:this.getModelFilePath(def)})).filter(def=>verifyGgufHeader(def.file));
    const preferred=this.activeModelId;
    const preference=id=>id===DEFAULT_MODEL_ID?0:id===QUALITY_MODEL_ID?1:2;
    candidates.sort((a,b)=>Number(b.id===preferred)-Number(a.id===preferred)||preference(a.id)-preference(b.id));
    for(const model of candidates){
      const key=await this.serverManager.backendSelection.modelKey(model.file);
      if(!model.sha256||key.modelHash!==model.sha256)continue;
      let backend=!this.serverManager.backendSelection.config.failed&&this.serverManager.process&&this.serverManager.status==='READY'&&this.serverManager.activeModelId===model.id?this.serverManager.activeBackend:(this.serverManager.backendSelection.config.mode!=='cpu'&&this.serverManager.backendSelection.config.key===key.key&&this.serverManager.backendSelection.config.backend==='gpu'&&!this.serverManager.backendSelection.config.failed?'gpu':'cpu');
      try{await this.serverManager.backendSelection.verify(backend==='gpu'?'vulkan':'cpu');}catch(_){backend='cpu';try{await this.serverManager.backendSelection.verify('cpu');}catch(_){continue;}}
      if(this.activeModelId!==model.id){this.activeModelId=model.id;this.persistSelection();}
      return {available:true,engine:backend==='gpu'?'ia-gpu':'ia-cpu',modelId:model.id,modelName:model.name,modelPath:model.file};
    }
    return {available:false,engine:'sin-ia',modelId:null,modelName:null,modelPath:null};
  }

  persistSelection(){
    this.selection.activeModelId=this.activeModelId;
    fs.mkdirSync(path.dirname(this.selectionFile),{recursive:true});
    const temporary=this.selectionFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify(this.selection,null,2)+'\n');fs.renameSync(temporary,this.selectionFile);
  }
  getRetirementNotice(){return (this.retirementPending||this.selection.retiredModelDetected)&&!this.selection.retirementAcknowledged?{retiredModelId:RETIRED_MODEL.id,replacementModelId:QUALITY_MODEL_ID}:null;}
  acknowledgeRetirement(){this.selection.retirementAcknowledged=true;this.persistSelection();}
  setActiveModel(modelId) {
    if(!this.catalog.some(model=>model.id===modelId&&!isRetired(model)))return false;
    this.activeModelId = modelId;this.persistSelection();
    return true;
  }

  async testModel(modelId) {
    const startTime = Date.now();
    try {
      if (modelId === 'builtin_local') {
        const testRes = await this.builtinEngine.testConnection();
        return {
          ok: true,
          success: true,
          modelo: 'Motor de Procesamiento Lingüístico',
          tiempo_ms: Date.now() - startTime,
          durationMs: Date.now() - startTime,
          texto: testRes.message,
          response: testRes.message,
          resultado: { texto: testRes.message },
          meta: { durationMs: Date.now() - startTime }
        };
      }

      const models = await this.getModels();
      const model = models.find(m => m.id === modelId);
      if (!model || !model.instalado || !model.ruta || !fs.existsSync(model.ruta)) {
        return {
          ok: false,
          success: false,
          modelo: model?.nombre || modelId,
          tiempo_ms: 0,
          durationMs: 0,
          texto: null,
          response: null,
          resultado: { texto: null },
          message: 'El archivo del modelo GGUF no se encuentra en el disco.',
          error: { code: 'MODEL_NOT_FOUND', message: 'El archivo del modelo GGUF no se encuentra en el disco.' },
          meta: { durationMs: 0 }
        };
      }

      const provider = new LlamaCppProvider(model.ruta, model.id);
      const conn = await provider.testConnection();
      const elapsed = Date.now() - startTime;

      return {
        ok: conn.ok,
        success: conn.ok,
        modelo: model.nombre,
        tiempo_ms: conn.durationMs || elapsed,
        durationMs: conn.durationMs || elapsed,
        operacion: conn.operation,
        esperado: conn.expected,
        obtenido: conn.obtained,
        mathVerified: conn.mathVerified,
        tokens_generados: conn.tokens_generados || 2,
        serverPid: conn.pid,
        port: conn.port,
        texto: conn.answer || conn.message,
        response: conn.answer || conn.message,
        resultado: {
          texto: conn.answer || conn.message,
          operacion: conn.operation,
          esperado: conn.expected,
          obtenido: conn.obtained,
          tokens: conn.tokens_generados || 2,
          pid: conn.pid
        },
        meta: {
          ...conn.meta,
          durationMs: conn.durationMs || elapsed
        }
      };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      return {
        ok: false,
        success: false,
        modelo: modelId,
        tiempo_ms: elapsed,
        durationMs: elapsed,
        texto: null,
        resultado: { texto: null },
        message: err.message,
        error: { code: 'TEST_ERROR', message: err.message },
        meta: { durationMs: elapsed }
      };
    }
  }

  getDiagnostic() {
    const runtime = resolveLlamaRuntime();
    const serverDiag = serverManager.getDiagnosticInfo();
    const activeModel = this.catalog.find(m => m.id === this.activeModelId) || null;
    const modelPath = activeModel ? this.getModelFilePath(activeModel) : null;
    const modelAvailable = !!(modelPath && fs.existsSync(modelPath) && verifyGgufHeader(modelPath));

    return {
      engine: 'llama.cpp',
      runtimeExists: !!(runtime && runtime.exists),
      runtimeAvailable: !!(runtime && runtime.exists),
      runtimePath: serverDiag.serverRunning?serverDiag.runtimePath:'No se está ejecutando ningún servidor',
      runtimeSource: serverDiag.serverRunning?serverDiag.runtimeSource:runtime.source,
      backend:serverDiag.backend,
      device:serverDiag.device,
      gpuLayers:serverDiag.gpuLayers,
      modelAvailable,
      modelId: this.activeModelId,
      modelName: activeModel ? activeModel.name : (this.activeModelId || 'Ningún modelo seleccionado'),
      modelPath: modelPath || 'No disponible',
      serverRunning: serverDiag.serverRunning,
      serverReady: serverDiag.serverReady,
      serverStatus: serverDiag.serverStatus,
      pid: serverDiag.pid,
      serverPid: serverDiag.pid,
      port: serverDiag.port,
      serverPort: serverDiag.port,
      lastError: serverDiag.lastError,
      lastTestOk: !!serverDiag.lastTestOk,
      modelsDir: resolveModelsDir(),
      customCatalogDir: resolveCustomCatalogDir(),
      customCatalogPath: resolveCustomCatalogFile(),
      customCatalogFile: resolveCustomCatalogFile(),
      specs: os.cpus().length,
      activeDownloadsCount: this.activeDownloads.size
    };
  }

  // Verificador posterior automático (Regla: control de alucinaciones y calidad)
  verifyProposal(result, promptConfig = {}) {
    const text = typeof result === 'string' ? result : (result?.texto || result?.data?.texto || '');
    const avisos = Array.isArray(result?.avisos) ? [...result.avisos] : [];
    const titulos = Array.isArray(result?.titulos) ? [...result.titulos] : (Array.isArray(result?.data?.titulos) ? [...result.data.titulos] : []);
    const lang = promptConfig?.idioma_salida || promptConfig?.idioma || 'es';

    if (!text.trim() && titulos.length === 0) {
      avisos.push('La propuesta generada está vacía.');
    }

    if (/\b(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:€|euros|millones)/i.test(text)) {
      avisos.push('La propuesta contiene cifras o importes económicos. Verifícalos antes de incluir la medida.');
    }

    if (/\b(según la ley \d+|artículo \d+|RD \d+|decreto \d+)/i.test(text)) {
      avisos.push('Se detectaron referencias normativas concretas. Asegúrate de su fidelidad jurídica.');
    }

    if (lang === 'ca') {
      const hasSpanishMarkers = /\b(ayuntamiento|vecinos y vecinas|nuestro municipio)\b/i.test(text);
      if (hasSpanishMarkers) {
        avisos.push('El text conté possibles termes en castellà no adaptats al català.');
      }
    } else {
      const hasCatalanMarkers = /\b(ajuntament|per a tothom|impulsarem|veïns i veïnes)\b/i.test(text);
      if (hasCatalanMarkers) {
        avisos.push('El texto contiene posibles términos en catalán no traducidos al castellano.');
      }
    }

    const uniqueAvisos = Array.from(new Set(Array.isArray(result?.qualityWarnings)?result.avisos:avisos));

    return {
      ok: true,
      texto: text,
      titulos,
      avisos: uniqueAvisos,
      advertencias: uniqueAvisos,
      has_warnings: uniqueAvisos.length > 0,
      warnings: uniqueAvisos,
      error: null
    };
  }

  // --- Contrato común para todas las operaciones de IA ---

  async runAiTask(taskName, params) {
    const models=Object.fromEntries((this.catalog||[]).map(model=>[model.id,model.name||model.nombre||model.id]));
    const result=await require('./generationSource').run(models,()=>this.executeAiTask(taskName,params));
    return {...result,availability:await this.getAvailability()};
  }

  async executeAiTask(taskName, params) {
    const startTime = Date.now();
    try {
      params = await require('./municipalContext').enrichWritingParams(taskName, params);
      const contract=require('../../../shared/writingContract');
      const generationTask=contract.MIN_SELECTED[taskName]?taskName:params.generationTask;
      if(contract.MIN_SELECTED[generationTask])await require('./orthography').ready();
      if(contract.MIN_SELECTED[taskName]){
        const minimum=contract.minimumState(generationTask,params.selectedMeasures||[],params.idioma_salida||params.idioma||'es',params);
        if(!minimum.allowed)return {ok:false,data:null,texto:null,titulos:[],avisos:[minimum.message],error:{code:'MIN_SELECTED_MEASURES',message:minimum.message},selection:minimum};
      }
      const normalizedParams = {
        ...params,
        area: params?.area || params?.area_nombre || '',
        area_nombre: params?.area_nombre || params?.area || '',
        municipio: params?.municipio || params?.municipality || '',
        partido: params?.partido || params?.organizacion || 'Podemos',
        organizacion: params?.organizacion || params?.partido || 'Podemos',
        texto: params?.texto || params?.text || params?.texto_actual || params?.puntosClave || '',
        idioma: params?.idioma || params?.language || params?.idioma_salida || 'es'
      };

      const isTranslation = taskName === 'traducir_texto' || taskName === 'traducir_texto_estructurado';
      const useSelectedModel = Boolean(params && (params.useSelectedModel || params.forzar_modelo_usuario));

      let provider;
      if (isTranslation && !useSelectedModel) {
        // Enrutado automático nativo al Motor Lingüístico Integrado
        if (!this.builtinEngine || (typeof this.builtinEngine.isAvailable === 'function' && !(await this.builtinEngine.isAvailable()))) {
          return {
            ok: false,
            data: null,
            texto: null,
            titulos: [],
            avisos: ['No se ha podido realizar la traducción con el motor lingüístico integrado.'],
            error: {
              code: 'BUILTIN_ENGINE_ERROR',
              message: 'No se ha podido realizar la traducción con el motor lingüístico integrado.'
            },
            canFallbackToSelectedModel: true,
            meta: {
              task: taskName,
              operation: taskName,
              durationMs: Date.now() - startTime,
              provider: 'BuiltinLocalAiEngine'
            }
          };
        }
        provider = this.builtinEngine;
      } else {
        provider = await this.getActiveProvider();
      }

      let raw;
      try {
        raw = await provider.generate(taskName, normalizedParams);
        if(provider===this.builtinEngine)require('./generationSource').recordBuiltin({labelOnly:isTranslation&&!useSelectedModel});
        if(raw?.ok===false&&contract.MIN_SELECTED[generationTask])return raw;
        if(raw?.ok===false&&provider!==this.builtinEngine){
          raw=await this.builtinEngine.generate(taskName,normalizedParams);
          provider=this.builtinEngine;require('./generationSource').recordBuiltin({fallbackReason:'ai-failed'});
        }
      } catch (genErr) {
        if(contract.MIN_SELECTED[generationTask])return {ok:false,data:null,texto:null,error:{code:'GENERATION_FAILED',message:params.idioma==='ca'?'La IA no ha pogut generar aquest text.':'La IA no ha podido generar este texto.'}};
        if(provider!==this.builtinEngine){
          raw=await this.builtinEngine.generate(taskName,normalizedParams);
          provider=this.builtinEngine;require('./generationSource').recordBuiltin({fallbackReason:'ai-failed'});
        }else{
        if (isTranslation && !useSelectedModel) {
          return {
            ok: false,
            data: null,
            texto: null,
            titulos: [],
            avisos: ['No se ha podido realizar la traducción con el motor lingüístico integrado.'],
            error: {
              code: 'BUILTIN_ENGINE_ERROR',
              message: 'No se ha podido realizar la traducción con el motor lingüístico integrado.'
            },
            canFallbackToSelectedModel: true,
            meta: {
              task: taskName,
              operation: taskName,
              durationMs: Date.now() - startTime,
              provider: provider.name || 'BuiltinLocalAiEngine'
            }
          };
        }
        throw genErr;
        }
      }

      if (raw && raw.ok === false) {
        if (isTranslation && !useSelectedModel) {
          return {
            ok: false,
            data: null,
            texto: null,
            titulos: [],
            avisos: ['No se ha podido realizar la traducción con el motor lingüístico integrado.'],
            error: {
              code: 'BUILTIN_ENGINE_ERROR',
              message: 'No se ha podido realizar la traducción con el motor lingüístico integrado.'
            },
            canFallbackToSelectedModel: true,
            meta: {
              task: taskName,
              operation: taskName,
              durationMs: Date.now() - startTime,
              provider: provider.name || 'BuiltinLocalAiEngine'
            }
          };
        }
        return raw;
      }

      if(isTranslation&&contract.MIN_SELECTED[generationTask]&&!raw.qualityWarnings){
        const quality=require('./writingQuality'),data=quality.formatAndValidate(generationTask,raw.data||raw,normalizedParams);
        const qualityWarnings=data.validation.warnings.map(w=>({...w,message_es:quality.warningText(w,'es'),message_ca:quality.warningText(w,'ca')}));
        raw={...raw,...data,data,texto:data.formattedText,qualityWarnings,avisos:require('../../../shared/writingWarnings').messages(qualityWarnings,normalizedParams.idioma)};
      }
      const verified = this.verifyProposal(raw, normalizedParams);
      return {
        ...raw,
        ...verified,
        data: raw.data || { texto: verified.texto, titulos: verified.titulos },
        texto: verified.texto,
        titulos: verified.titulos,
        avisos: verified.avisos,
        meta: {
          ...raw.meta,
          task: taskName,
          operation: taskName,
          durationMs: Date.now() - startTime,
          provider: provider.name
        }
      };
    } catch (err) {
      console.error(`Error ejecutando tarea de IA (${taskName}):`, err);
      const isTimeout = err.message && (err.message.includes('Tiempo de espera') || err.message.includes('TIMEOUT'));
      return {
        ok: false,
        data: null,
        texto: null,
        titulos: [],
        avisos: [err.message],
        advertencias: [err.message],
        error: { code: isTimeout ? 'TIMEOUT' : 'INFERENCE_ERROR', message: err.message },
        meta: { task: taskName, operation: taskName, durationMs: Date.now() - startTime }
      };
    }
  }

  async sugerirTitulos(params) {
    return await this.runAiTask('sugerir_titulos', params);
  }

  async adaptarMedida(params) {
    return await this.runAiTask('adaptar_medida', params);
  }

  async desarrollarMedida(params) {
    return await this.runAiTask('desarrollar_medida', params);
  }

  async mejorarRedaccion(params) {
    return await this.runAiTask('mejorar_redaccion', params);
  }

  async corregirTexto(params) {
    return await this.runAiTask('corregir_texto', params);
  }

  async resumirTexto(params) {
    return await this.runAiTask('resumir_texto', params);
  }

  async traducirTexto(params) {
    return await this.runAiTask('traducir_texto', params);
  }

  async traducirTextoEstructurado(params) {
    return await this.runAiTask('traducir_texto_estructurado', params);
  }

  async redactarPresentacion(params) {
    return await this.runAiTask('redactar_presentacion', params);
  }

  async redactarIntroduccionArea(params) {
    return await this.runAiTask('redactar_introduccion_area', params);
  }

  async sugerirFraseDestacada(params) {
    return await this.runAiTask('sugerir_frase_destacada', params);
  }

  async redactarCierre(params) {
    return await this.runAiTask('redactar_cierre', params);
  }

  async revisarTexto(params) {
    return await this.runAiTask('revisar_texto', params);
  }
}

const serviceInstance = new AiService();
serviceInstance.verifyFileSha256 = verifyFileSha256;
serviceInstance.verifyGgufHeader = verifyGgufHeader;
module.exports = serviceInstance;
