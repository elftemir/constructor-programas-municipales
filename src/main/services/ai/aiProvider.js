const { getLema } = require('../../utils/lema');
/**
 * aiProvider.js - Arquitectura de Proveedores de IA Local (Fase 2)
 * Constructor de Programas Municipales Podemos - Versión 2.0.1
 *
 * Soporta:
 * 1. BaseAiProvider (interfaz base)
 * 2. LlamaServerManager (controlador del runtime nativo llama-server.exe en Windows)
 * 3. LlamaCppProvider (inferencia neuronal local vía HTTP 127.0.0.1)
 * 4. BuiltinLocalAiEngine (motor determinista y lingüístico out-of-the-box)
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { getAiRuntimePath, getAiLogsDir, resolveLlamaRuntime, resolveModelsDir } = require('../../utils/paths');
const { translateText, translateStructured } = require('./bilingualTranslator');
const { BackendSelection } = require('./backendSelection');

const TASK_TOKEN_LIMITS = {
  sugerir_titulos: 120,
  corregir_texto: 250,
  resumir_texto: 300,
  adaptar_medida: 500,
  desarrollar_medida: 400,
  mejorar_redaccion: 500,
  redactar_introduccion_area: 420,
  redactar_cierre: 500,
  redactar_presentacion: 700,
  traducir_texto_estructurado: 950,
  clasificar_bloques_estructurales: 800
};

class BaseAiProvider {
  constructor(name) {
    this.name = name;
  }

  async isAvailable() {
    return true;
  }

  async generate(task, promptConfig, options = {}) {
    throw new Error('generate() no implementado en proveedor base');
  }

  async testConnection() {
    return { ok: true, message: 'Proveedor activo' };
  }
}

const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024; // 5 MB por archivo de log técnico
const MAX_LOG_BACKUPS = 1; // Conserva llama-server.log (actual) + llama-server.log.1 (anterior)

function rotateLlamaServerLog(logPath, maxBytes = MAX_LOG_FILE_BYTES, maxBackups = MAX_LOG_BACKUPS) {
  if (!logPath || typeof logPath !== 'string') {
    return { rotated: false, currentSize: 0 };
  }
  try {
    if (!fs.existsSync(logPath)) {
      return { rotated: false, currentSize: 0 };
    }
    const stat = fs.statSync(logPath);
    if (!stat.isFile() || stat.size < maxBytes) {
      return { rotated: false, currentSize: stat.size };
    }

    // Eliminar cualquier rotación más antigua excedente
    for (let i = Math.max(1, maxBackups); i <= 5; i++) {
      const oldBackup = `${logPath}.${i}`;
      if (fs.existsSync(oldBackup)) {
        try { fs.unlinkSync(oldBackup); } catch (e) {}
      }
    }

    const backupPath = `${logPath}.1`;
    if (maxBackups >= 1) {
      fs.renameSync(logPath, backupPath);
    } else {
      fs.unlinkSync(logPath);
    }

    return { rotated: true, previousSize: stat.size, backupPath, currentSize: 0 };
  } catch (err) {
    console.warn('[LlamaServer] No se pudo rotar llama-server.log (continuando sin interrumpir IA):', err.message);
    return { rotated: false, error: err.message };
  }
}

function sanitizeLlamaLogChunk(chunk) {
  if (!chunk) return '';
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  // Defensa en profundidad: evitar que posibles volcados accidentales de cuerpos JSON
  // almacenen textos completos de prompts, medidas o respuestas en el log técnico.
  return text.replace(/"(?:messages|prompt|content)"\s*:\s*(?:\[|\{|")[^\r\n]*/gi, '"[CONTENIDO_REDACTADO_POR_PRIVACIDAD]"');
}

/**
 * LlamaServerManager: Administrador del proceso hijo llama-server.exe
 * Controla ciclo de vida, puerto dinámico en 127.0.0.1, redirección de logs y comprobación /health.
 */
class LlamaServerManager {
  constructor() {
    this.process = null;
    this.ownedPid = null;
    this.shuttingDown = false;
    this.activeModelPath = null;
    this.activeModelId = null;
    this.activeRuntimePath=null;
    this.actualGpuLayers=0;
    this.port = null;
    this.status = 'STOPPED'; // 'STOPPED' | 'STARTING' | 'READY' | 'ERROR'
    this.lastError = null;
    this.lastTestOk = false;
    this.logFileStream = null;
    this.logFilePath = null;
    this.currentLogBytes = 0;
    this.maxLogBytes = MAX_LOG_FILE_BYTES;
    this.rotatingLog = false;
    this.backendSelection = new BackendSelection();
    this.activeBackend = 'cpu';
    this.startPromise = null;
    this.requestQueue = Promise.resolve();
    this.pendingRequests = 0;
    this.benchmarkPromise = null;
    this.benchmarkController = null;
    this.detectionTimer = null;
    this.contextSize=4096;
    this.activeContext=0;
    this.currentRequestController=null;
  }

  openLogStream(logPath, headerLine = '') {
    try {
      if (this.logFileStream) {
        try { this.logFileStream.end(); } catch (e) {}
        this.logFileStream = null;
      }
      this.logFilePath = logPath;
      const rot = rotateLlamaServerLog(logPath, this.maxLogBytes, MAX_LOG_BACKUPS);
      this.currentLogBytes = (!rot.rotated && typeof rot.currentSize === 'number') ? rot.currentSize : 0;

      const stream = fs.createWriteStream(logPath, { flags: 'a' });
      stream.on('error', (err) => {
        console.warn('[LlamaServer] Error en stream de log:', err.message);
        this.logFileStream = null;
      });
      this.logFileStream = stream;

      if (headerLine) {
        this.writeLogChunk(headerLine);
      }
    } catch (err) {
      console.warn('[LlamaServer] No se pudo inicializar llama-server.log:', err.message);
      this.logFileStream = null;
    }
  }

  writeLogChunk(chunk) {
    if (!this.logFileStream || !this.logFilePath) return;
    try {
      const safeText = sanitizeLlamaLogChunk(chunk);
      if (!safeText) return;
      const byteLen = Buffer.byteLength(safeText, 'utf8');

      if (!this.rotatingLog && this.maxLogBytes > 0 && (this.currentLogBytes + byteLen > this.maxLogBytes)) {
        this.rotatingLog = true;
        const activeStream = this.logFileStream;
        const targetPath = this.logFilePath;
        this.logFileStream = null;

        activeStream.end(() => {
          try {
            rotateLlamaServerLog(targetPath, 0, MAX_LOG_BACKUPS);
            this.currentLogBytes = 0;
            const newStream = fs.createWriteStream(targetPath, { flags: 'a' });
            newStream.on('error', () => { this.logFileStream = null; });
            this.logFileStream = newStream;
            this.currentLogBytes += byteLen;
            newStream.write(safeText);
          } catch (e) {
            console.warn('[LlamaServer] Error rotando log activo:', e.message);
          } finally {
            this.rotatingLog = false;
          }
        });
        return;
      }

      this.currentLogBytes += byteLen;
      this.logFileStream.write(safeText);
    } catch (err) {
      // No interrumpir nunca la inferencia por un error de escritura de log
    }
  }

  isProcessAlive(pid) {
    if (!pid || typeof pid !== 'number' || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return e.code === 'EPERM';
    }
  }

  async getFreePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
  }

  async stopServer(options = {}) {
    if (options && options.isAppQuit) {
      this.shuttingDown = true;
      clearTimeout(this.detectionTimer);
      this.benchmarkController?.abort();
    }

    const child = this.process;
    const pid = child ? child.pid : this.ownedPid;
    this.process = null;
    this.ownedPid = null;
    this.status = 'STOPPED';
    this.port = null;
    this.activeModelPath = null;
    this.activeModelId = null;

    if (child && pid) {
      const timeoutMs = typeof options?.timeoutMs === 'number' ? options.timeoutMs : 2000;
      console.log(`[LlamaServer] Deteniendo servidor propio en PID ${pid}...`);

      const waitForExit = new Promise((resolve) => {
        if (child.exitCode !== null || !this.isProcessAlive(pid)) {
          return resolve(true);
        }
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            clearInterval(poller);
            resolve(true);
          }
        };
        child.once('exit', done);
        child.once('close', done);
        const poller = setInterval(() => {
          if (!this.isProcessAlive(pid)) done();
        }, 80);
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            clearInterval(poller);
            resolve(false);
          }
        }, timeoutMs);
      });

      try {
        child.kill('SIGTERM');
      } catch (e) {
        console.warn('[LlamaServer] Error al enviar señal SIGTERM a PID propio:', e.message);
      }

      const exitedGracefully = await waitForExit;
      if (!exitedGracefully && this.isProcessAlive(pid)) {
        try {
          console.log(`[LlamaServer] Finalizando forzosamente PID propio ${pid}...`);
          process.kill(pid, 'SIGKILL');
        } catch (e) {}
        const deadline = Date.now() + 500;
        while (Date.now() < deadline && this.isProcessAlive(pid)) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
      if(this.isProcessAlive(pid))throw new Error('The owned AI server could not be stopped; another server will not be launched');
    }

    if (this.logFileStream) {
      try { this.logFileStream.end(); } catch (e) {}
      this.logFileStream = null;
    }
  }

  async checkHealth(port, timeoutMs = 60000, signal = null) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const poll = () => {
        if(signal?.aborted)return reject(Object.assign(new Error('Benchmark preempted'),{code:'PREEMPTED'}));
        if (this.shuttingDown) {
          return reject(new Error('El servidor de IA se está deteniendo por cierre de la aplicación'));
        }
        if (Date.now() - startTime > timeoutMs) {
          return reject(new Error('Tiempo de espera agotado esperando a llama-server (/health)'));
        }

        const req = http.get(`http://127.0.0.1:${port}/health`, { timeout: 3000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              return resolve(true);
            }
            // 503 indica que los pesos del modelo se están cargando en memoria
            setTimeout(poll, 600);
          });
        });

        req.on('error', () => {
          setTimeout(poll, 600);
        });
      };
      poll();
    });
  }

  async interruptBenchmark() {
    if (!this.benchmarkPromise) return;
    this.benchmarkController?.abort();
    await this.stopServer();
    await this.benchmarkPromise;
  }

  async ensureServerRunning(modelPath, modelId, forced = null) {
    if (!forced) await this.interruptBenchmark();
    while (this.startPromise) await this.startPromise.catch(() => {});
    this.startPromise = this.startServer(modelPath, modelId, forced);
    try { return await this.startPromise; } finally { this.startPromise = null; }
  }

  async slotsState(endpoint){
    const {localJson}=require('./localHttp');
    const health=await localJson(endpoint,'/health',null,{timeout:3000});if(health.status!=='ok')throw Object.assign(Error('Server not healthy'),{code:'SERVER_UNHEALTHY'});
    const slots=await localJson(endpoint,'/slots',null,{timeout:3000});
    if(!Array.isArray(slots)||!slots.length||slots.some(slot=>!Number.isFinite(slot.n_ctx)||typeof slot.is_processing!=='boolean'))throw Object.assign(Error('Invalid server slots'),{code:'SERVER_UNHEALTHY'});
    return slots.map(slot=>({id:slot.id,n_ctx:slot.n_ctx,is_processing:slot.is_processing}));
  }

  async waitIdle(endpoint,timeout=3000){
    const end=Date.now()+timeout;let slots;
    do{slots=await this.slotsState(endpoint);if(slots.every(slot=>!slot.is_processing))return slots;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<end);
    throw Object.assign(Error('Server slot still occupied'),{code:'SLOT_BUSY'});
  }

  cancelCurrentRequest(){this.currentRequestController?.abort();}

  async serverHealthy(endpoint){
    if(!this.process||!endpoint)return false;
    try{return (await require('./localHttp').localJson(endpoint,'/health',null,{timeout:3000})).status==='ok';}catch{return false;}
  }

  recordBackendTransition(from,to,error,reason){
    const event={from,to,reason,errorCode:error?.code||'REQUEST_ERROR',httpStatus:error?.status||null,route:error?.route||null};
    this.writeLogChunk('[BACKEND_TRANSITION] '+JSON.stringify(event)+'\n');
    console.warn('[AI backend transition]',JSON.stringify(event));
  }

  async withRequest(modelPath, modelId, callback, options={}) {
    this.pendingRequests++;
    this.benchmarkController?.abort();
    const operation = this.requestQueue.then(async () => {
      if(options.signal?.aborted)throw Object.assign(Error('ABORTED'),{code:'ABORTED'});
      this.contextSize=Math.max(this.contextSize,Math.min(32768,options.context||4096));
      this.currentRequestController=new AbortController();
      const controller=this.currentRequestController,abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
      let endpoint;
      const invoke=async()=>{if(controller.signal.aborted)throw Object.assign(Error('ABORTED'),{code:'ABORTED'});const slots=this.process?await this.waitIdle(endpoint):null;if(slots)this.activeContext=Math.min(...slots.map(slot=>slot.n_ctx));const result=await callback(endpoint,controller.signal,slots);require('./generationSource').recordNative(this.activeBackend,modelId);return result;};
      try { endpoint=await this.ensureServerRunning(modelPath,modelId);return await invoke(); }
      catch (error) {
        if(error.code==='ABORTED'){try{await this.waitIdle(endpoint,1500);}catch{await this.stopServer();}throw error;}
        if(error.code==='CONTEXT_TOO_LONG'&&error.requiredContext<=32768&&error.requiredContext>this.contextSize){this.contextSize=Math.ceil(error.requiredContext/2048)*2048;await this.stopServer();endpoint=await this.ensureServerRunning(modelPath,modelId);return await invoke();}
        if(['CONTEXT_TOO_LONG','RESPONSE_TOO_LARGE','INVALID_JSON','INVALID_TEMPLATE','INVALID_TOKEN_COUNT','TRUNCATED'].includes(error.code))throw error;
        // A request failure is never evidence that GPU hardware failed.
        if(await this.serverHealthy(endpoint)){
          try{await this.waitIdle(endpoint,1500);}catch{await this.stopServer();}
          throw error;
        }
        const backend=this.activeBackend;
        await this.stopServer();
        try{endpoint=await this.ensureServerRunning(modelPath,modelId,{backend,device:this.backendSelection.config.device,ngl:this.backendSelection.config.ngl});return await invoke();}catch(retryError){
          if(retryError.code==='ABORTED'||await this.serverHealthy(endpoint)||backend!=='gpu')throw retryError;
          error=retryError;
        }
        this.recordBackendTransition('gpu','cpu',error,'server-dead-or-health-unavailable');
        require('./generationSource').recordFallback('gpu-server-unhealthy');
        this.backendSelection.markFailed(Object.assign(Error('SERVER_UNHEALTHY'),{code:'SERVER_UNHEALTHY'}));
        await this.stopServer();
        endpoint = await this.ensureServerRunning(modelPath, modelId, {backend:'cpu'});
        return await invoke();
      }finally{
        if(controller.signal.aborted&&this.process&&endpoint){try{await this.waitIdle(endpoint,1500);}catch{await this.stopServer();}}
        options.signal?.removeEventListener('abort',abort);if(this.currentRequestController===controller)this.currentRequestController=null;
      }
    });
    this.requestQueue = operation.catch(() => {});
    try { return await operation; }
    finally { this.pendingRequests--; this.scheduleDetection(modelPath,modelId); }
  }

  scheduleDetection(modelPath,modelId) {
    clearTimeout(this.detectionTimer);
    if(this.shuttingDown||this.pendingRequests||this.benchmarkPromise)return;
    this.detectionTimer=setTimeout(()=>{
      const operation=this.requestQueue.then(async()=>{
        if(this.pendingRequests||this.shuttingDown)return;
        const selection=await this.backendSelection.select(modelPath).catch(()=>null);
        if(!selection?.needsDetection)return;
        const controller=new AbortController();this.benchmarkController=controller;
        this.benchmarkPromise=this.backendSelection.detect(modelPath,async options=>{
          if(options.signal.aborted||this.pendingRequests)throw Object.assign(Error('Preempted'),{code:'PREEMPTED'});
          const endpoint=await this.ensureServerRunning(modelPath,modelId,options);
          if(options.signal.aborted||this.pendingRequests)throw Object.assign(Error('Preempted'),{code:'PREEMPTED'});
          const result=await this.benchmarkCompletion(endpoint,options.signal);
          return {tokensPerSecond:result.timings?.predicted_per_second,valid:typeof result.content==='string'&&result.content.trim().length>0&&result.tokens_predicted>=64,ngl:this.activeNgl};
        },controller.signal);
        try{await this.benchmarkPromise;}catch(error){console.warn('[AI detection]',error.code||'DETECTION_ERROR');}
        finally{
          this.benchmarkPromise=null;this.benchmarkController=null;
          // The next queued generation starts the selected backend. No out-of-queue restore.
          if(controller.signal.aborted||this.backendSelection.getStatus().backend==='cpu')await this.stopServer();
        }
      });
      this.requestQueue=operation.catch(()=>{});
    },1200);
    this.detectionTimer.unref?.();
  }

  benchmarkCompletion(endpoint,signal) {
    return new Promise((resolve,reject)=>{
      const body=JSON.stringify({prompt:'Write a short explanation of how to organize a public meeting.',n_predict:64,temperature:0,seed:1234,ignore_eos:true,cache_prompt:false,stream:false});
      const url=new URL(endpoint+'/completion');
      const request=http.request({hostname:'127.0.0.1',port:url.port,path:url.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:60000,signal},response=>{
        let data='';response.on('data',chunk=>data+=chunk);response.on('end',()=>{try{if(response.statusCode!==200)throw Error('Benchmark HTTP '+response.statusCode);resolve(JSON.parse(data));}catch(error){reject(error);}});
      });request.on('error',reject);request.on('timeout',()=>request.destroy(Error('Benchmark timed out')));request.end(body);
    });
  }

  async startServer(modelPath, modelId, forced = null) {
    if (this.shuttingDown) {
      throw new Error('El servidor local de IA no admite nuevas peticiones durante el cierre de la aplicación.');
    }

    // Si ya está corriendo con el mismo modelo y saludable, reutilizarlo
    let selection;
    if(forced){const backend=forced.backend;selection={...forced,executable:await this.backendSelection.verify(backend==='gpu'?'vulkan':'cpu')};}
    else selection=await this.backendSelection.select(modelPath);
    if (this.process && this.status === 'READY' && this.activeModelPath === modelPath && this.activeBackend === selection.backend && this.port && this.activeContext>=this.contextSize) {
      return `http://127.0.0.1:${this.port}`;
    }

    // Si había un modelo diferente en ejecución, detenerlo
    await this.stopServer();

    const runtime = {exists:true,executablePath:selection.executable,source:'verified '+selection.backend+' b11476'};
    if (!runtime.exists || !runtime.executablePath) {
      this.status = 'ERROR';
      this.lastError = 'Ejecutable llama-server.exe no encontrado en los recursos de la aplicación.';
      throw new Error(this.lastError);
    }
    const runtimePath = runtime.executablePath;

    if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 1000000) {
      this.status = 'ERROR';
      this.lastError = `Archivo del modelo GGUF no válido o no encontrado: ${modelPath}`;
      throw new Error(this.lastError);
    }

    const port = await this.getFreePort();
    const logsDir = getAiLogsDir();
    const logPath = path.join(logsDir, 'llama-server.log');

    this.openLogStream(
      logPath,
      `\n--- Iniciando llama-server en ${new Date().toISOString()} (Puerto: ${port}, Origen: ${runtime.source}) ---\n`
    );

    const cpuCores = os.cpus().length || 4;
    const threads = Math.max(1, Math.min(6, cpuCores - 1));

    const args = [
      '--model', modelPath,
      '--host', '127.0.0.1',
      '--port', String(port),
      '--cors-origins', 'localhost',
      '--no-cors-credentials',
      '--ctx-size', String(this.contextSize),
      '--parallel', '1',
      '--slots',
      '--threads', String(threads),
      '--log-verbosity', '4',
      '--n-predict', '-1'
    ];
    args.push('--gpu-layers',selection.backend==='gpu'?String(selection.fit?'auto':selection.ngl||99):'0');
    if(selection.backend==='gpu'&&selection.device?.id)args.push('--device',selection.device.id);
    if(selection.backend==='gpu'&&selection.fit)args.push('--fit','on');

    console.log(`[LlamaServer] Ejecutando: ${runtimePath} (${runtime.source}) ${args.join(' ')}`);

    this.status = 'STARTING';
    this.port = port;
    this.activeModelPath = modelPath;
    this.activeModelId = modelId;
    this.activeBackend = selection.backend;
    this.activeRuntimePath=runtimePath;
    this.activeContext=this.contextSize;
    this.actualGpuLayers=0;
    this.offloadLogTail='';
    this.activeNgl = selection.backend==='gpu'?(selection.fit?'auto':selection.ngl||99):0;

    const child = spawn(runtimePath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', chunk => {
      this.captureGpuLayers(chunk);
      this.writeLogChunk(chunk);
    });

    child.stderr.on('data', chunk => {
      this.captureGpuLayers(chunk);
      this.writeLogChunk(chunk);
    });

    child.on('error', (err) => {
      console.error('[LlamaServer] Error de proceso:', err);
      this.status = 'ERROR';
      this.lastError = err.message;
    });

    child.on('exit', (code, signal) => {
      console.log(`[LlamaServer] Proceso finalizado (code: ${code}, signal: ${signal})`);
      if(this.process!==child)return;
      if (this.status !== 'STOPPED') {
        this.status = 'ERROR';
        this.lastError = `El servidor se cerró inesperadamente con código ${code}`;
        if(this.activeBackend==='gpu'){this.recordBackendTransition('gpu','cpu',{code:'PROCESS_EXIT'},'server-exited');this.backendSelection.markFailed(this.lastError);}
      }
    });

    this.process = child;
    this.ownedPid = child.pid;

    try {
      await this.checkHealth(port,60000,forced?.signal);
      this.status = 'READY';
      this.lastError = null;
      console.log(`[LlamaServer] Servidor listo en http://127.0.0.1:${port}`);
      return `http://127.0.0.1:${port}`;
    } catch (err) {
      await this.stopServer();
      if(selection.backend==='gpu'&&!selection.fit&&!forced?.signal?.aborted)return await this.startServer(modelPath,modelId,{...selection,fit:true,allowCpuFallback:forced?.allowCpuFallback??!forced});
      if(selection.backend==='gpu'&&(forced?.allowCpuFallback??!forced)){this.recordBackendTransition('gpu','cpu',err,'startup-health-unavailable');this.backendSelection.markFailed(err);return await this.startServer(modelPath,modelId,{backend:'cpu'});}
      this.status = 'ERROR';
      this.lastError = err.message;
      throw err;
    }
  }

  captureGpuLayers(chunk){
    this.offloadLogTail=(this.offloadLogTail||'')+chunk.toString();
    const offload=this.offloadLogTail.match(/offloaded\s+(\d+)\/\d+\s+layers to GPU/i);if(offload)this.actualGpuLayers=Number(offload[1]);
    this.offloadLogTail=this.offloadLogTail.slice(-1024);
  }

  getDiagnosticInfo() {
    const runtime = resolveLlamaRuntime();
    const runtimeAvailable = !!(runtime && runtime.exists);
    const serverRunning = !!(this.process);
    const serverReady = this.status === 'READY';

    return {
      runtimeAvailable,
      runtimeExists: runtimeAvailable, // retrocompatibilidad
      runtimePath: serverRunning?this.activeRuntimePath:null,
      runtimeSource: serverRunning?'verified '+this.activeBackend+' b11476':null,
      device:serverRunning&&this.activeBackend==='gpu'?this.backendSelection.config.device:null,
      gpuLayers:serverRunning&&this.activeBackend==='gpu'?this.actualGpuLayers:0,
      modelAvailable: !!(this.activeModelPath && fs.existsSync(this.activeModelPath)),
      modelId: this.activeModelId,
      modelPath: this.activeModelPath,
      serverRunning,
      serverReady,
      serverStatus: this.status,
      serverPort: this.port,
      port: this.port,
      serverPid: this.process ? this.process.pid : null,
      pid: this.process ? this.process.pid : null,
      lastError: this.lastError,
      lastTestOk: !!this.lastTestOk
      ,nCtx:serverRunning?this.activeContext:null,nPredictDefault:serverRunning?-1:null,totalSlots:serverRunning?1:0
      ,backend:this.activeBackend,backendState:this.backendSelection.getStatus()
    };
  }
}

const serverManager = new LlamaServerManager();

function stripAiMarkdown(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function extractJsonFromAi(text) {
  if (!text || typeof text !== 'string') return null;
  let str = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    str = codeBlockMatch[1].trim();
  }
  try {
    return JSON.parse(str);
  } catch (e) {}

  const startIdx = str.indexOf('{');
  const endIdx = str.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    const candidate = str.substring(startIdx, endIdx + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      try {
        const sanitized = candidate
          .replace(/\r\n/g, '\n')
          .replace(/\n(?=(?:(?!").)*"(?:[^"]*"[^"]*")*[^"]*$)/g, ' ');
        return JSON.parse(sanitized);
      } catch (e2) {}
    }
  }
  return null;
}

/**
 * LlamaCppProvider: Proveedor de IA que ejecuta modelos neuronales GGUF locales
 */
class LlamaCppProvider extends BaseAiProvider {
  constructor(modelPath, modelId = 'qwen2.5-1.5b-instruct-q4') {
    super('LlamaCppProvider');
    this.modelPath = modelPath;
    this.modelId = modelId;
    this.manager = serverManager;
  }

  async isAvailable() {
    const runtime = resolveLlamaRuntime();
    return !!(runtime.exists && fs.existsSync(this.modelPath));
  }

  async testConnection(options = {}) {
    const startTime = Date.now();
    try {
      const endpoint='http://127.0.0.1:'+(this.manager.port||1);
      
      // Prueba dinámica neuronal con dos enteros de 2 cifras (Sección 8.1)
      const a = Math.floor(Math.random() * 70) + 15;
      const b = Math.floor(Math.random() * 70) + 12;
      const expected = a + b;

      const completion = await this.callChat(endpoint, [
        { role: 'system', content: 'Eres una calculadora precisa. Responde únicamente con el número entero del resultado final, sin palabras, sin signos ni explicaciones.' },
        { role: 'user', content: `Calcula exactamente ${a} + ${b}. Responde solamente con el número final:` }
      ], { max_tokens: 25, temperature: 0.1, timeout: 30000 });

      const duration = Date.now() - startTime;
      const cleaned = (completion || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      const numbers = cleaned.match(/\d+/g) || [];
      const obtained = numbers.length > 0 ? parseInt(numbers[0], 10) : null;
      const mathVerified = obtained === expected;

      this.manager.lastTestOk = mathVerified;

      return {
        ok: true,
        success: true,
        isNeural: true,
        mathVerified,
        operation: `${a} + ${b}`,
        problem: `${a} + ${b}`,
        expected,
        obtained,
        answer: String(obtained !== null ? obtained : cleaned),
        tiempo_ms: duration,
        durationMs: duration,
        modelId: this.modelId,
        modelName: require('../../../../data/ai_models.json').models.find(model=>model.id===this.modelId)?.name || this.modelId,
        modelo: require('../../../../data/ai_models.json').models.find(model=>model.id===this.modelId)?.name || this.modelId,
        pid: this.manager.process ? this.manager.process.pid : null,
        port: this.manager.port,
        tokens_generados: numbers.length > 0 ? 2 : 1,
        runtimeAvailable: true,
        data: {
          operation: `${a} + ${b}`,
          expected,
          obtained,
          mathVerified
        },
        meta: {
          modelId: this.modelId,
          modelPath: this.modelPath,
          runtimePath: this.manager.getDiagnosticInfo().runtimePath,
          port: this.manager.port,
          pid: this.manager.process ? this.manager.process.pid : null,
          durationMs: duration
        }
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      this.manager.lastTestOk = false;
      return {
        ok: false,
        success: false,
        isNeural: true,
        mathVerified: false,
        message: `Fallo al verificar el modelo neuronal: ${err.message}`,
        response: null,
        tiempo_ms: duration,
        durationMs: duration,
        error: { code: 'NEURAL_TEST_FAILED', message: err.message },
        data: null,
        meta: {
          modelId: this.modelId,
          durationMs: duration
        }
      };
    }
  }

  async callChat(endpoint, messages, options = {}) {
    const estimated=Math.ceil((JSON.stringify(messages).length/2+(options.max_tokens||512)+256)/2048)*2048;
    return this.manager.withRequest(this.modelPath,this.modelId,(freshEndpoint,signal,slots)=>this.callChatRaw(freshEndpoint,messages,{...options,signal:signal||options.signal,slots}),{signal:options.signal,context:Math.max(options.context||4096,estimated)});
  }

  async callChatRaw(endpoint, messages, options = {}) {
    const trace={requestId:Date.now()+'-'+Math.random().toString(16).slice(2,8),backend:this.manager.activeBackend,modelId:this.modelId,nCtx:this.manager.activeContext||4096,maxTokens:options.max_tokens||512,timeoutMs:options.timeout||120000,slotsBefore:options.slots||null};
    const started=Date.now();
    try{
      trace.promptTokens=await require('./contextBudget').checkContextBudget(endpoint,messages,trace.maxTokens,options.idioma,trace.nCtx);
      const postData = {
        messages,
        ...require('../../../shared/writingContract').NORMAL_GENERATION,
        ...(options.temperature!==undefined?{temperature:options.temperature}:{}),
        ...(options.repeat_penalty!==undefined?{repeat_penalty:options.repeat_penalty}:{}),
        stop: options.stop || ['<|im_end|>','<|endoftext|>'],
        ...(options.responseSchema?{response_format:{type:'json_object',schema:options.responseSchema}}:{}),
        max_tokens: options.max_tokens || 512,
        cache_prompt:false,
        stream: false
      };
      trace.maxResponseBytes=Math.max(262144,trace.maxTokens*32);
      const data=await require('./localHttp').localJson(endpoint,'/v1/chat/completions',postData,{timeout:trace.timeoutMs,signal:options.signal,maxBytes:trace.maxResponseBytes});
      trace.finishReason=data.choices?.[0]?.finish_reason||'unknown';trace.completionTokens=data.usage?.completion_tokens||data.timings?.predicted_n||null;trace.serverPromptTokens=data.usage?.prompt_tokens||null;
      const content=data.choices?.[0]?.message?.content||'';
      this.lastCompletionStats={tokens:trace.completionTokens,tokensPerSecond:data.timings?.predicted_per_second||null,finishReason:trace.finishReason,inference:trace};
      if(trace.finishReason==='length')throw Object.assign(Error('TRUNCATED'),{code:'TRUNCATED'});
      return content;
    }catch(error){trace.error=error.code||error.message;trace.finishReason=trace.finishReason||(error.code==='TIMEOUT'?'timeout':error.code==='ABORTED'?'abort':'error');this.lastCompletionStats={inference:trace,finishReason:trace.finishReason};throw error;}
    finally{trace.elapsedMs=Date.now()-started;if(this.manager.process)try{trace.slotsAfter=await this.manager.slotsState(endpoint);}catch{trace.slotsAfter=null;}this.manager.writeLogChunk?.('[INFERENCE] '+JSON.stringify(trace)+'\n');}
  }

  async generateWriting(task,params,options={}) {
    await require('./orthography').ready();
    const quality=require('./writingQuality'),ca=(params.idioma_salida||params.idioma)==='ca',started=Date.now();
    const limits=require('../../../shared/writingLimits').limits(task,params),maxTokens=limits.maxTokens,checks=[];
    if((limits.long||(task==='redactar_presentacion'&&(params.selectedMeasures||[]).length>=require('../../../shared/writingContract').LONG_MIN_SELECTED))&&!options.translationObject)return this.generateLongWriting(params,options);
    let attempts=0,issues=[],previousRaw=null;
    try{
      const endpoint='http://127.0.0.1:'+(this.manager.port||1);
      for(attempts=1;attempts<=2;attempts++){
        const messages=options.translationObject?[
          {role:'system',content:(ca?'Tradueix fidelment al català. No afegeixis ni ometis contingut.':'Traduce fielmente al castellano. No añadas ni omitas contenido.')+' '+(ca?'Mantén exactament el municipi: ':'Mantén exactamente el municipio: ')+params.municipio+'. '+(ca?'Retorna només els camps del JSON indicat, sense instruccions, valles ni repeticions.':'Devuelve solo los campos del JSON indicado, sin instrucciones, vallas ni repeticiones.')+(attempts>1?(ca?' La resposta anterior no era vàlida; corregeix el format i la qualitat.':'La respuesta anterior no era válida; corrige el formato y la calidad.'):'')},
          {role:'user',content:JSON.stringify(options.translationObject)}
        ]:quality.prompt(task,params,ca?'ca':'es',attempts>1,issues);
        if(previousRaw&&issues.length&&issues.every(code=>code==='LANGUAGE_MIX'))messages.push({role:'user',content:(ca?'Corregeix només la llengua d’aquest esborrany generat. Mantén les idees, sense afegir fets, nombres ni municipis. Retorna el mateix esquema JSON en català normatiu: ':'Corrige solo el idioma de este borrador generado, conservando las ideas y el mismo esquema JSON: ')+previousRaw});
        try{
          const raw=await this.callChat(endpoint,messages,{...require('../../../shared/writingContract').NORMAL_GENERATION,max_tokens:maxTokens,context:limits.context,timeout:require('../../../shared/writingLimits').timeout(maxTokens,this.manager.activeBackend),signal:options.signal||params._generationSignal,idioma:ca?'ca':'es',responseSchema:quality.responseSchema(task,ca?'ca':'es')});
          previousRaw=raw;
          const data=quality.formatAndValidate(task,raw,params);
          checks.push({...this.lastCompletionStats?.inference,validation:[],warningCodes:data.validation.warnings.map(w=>w.code),wordCount:data.formattedText.split(/\s+/).length});
          const qualityWarnings=data.validation.warnings.map(w=>({...w,message_es:quality.warningText(w,'es'),message_ca:quality.warningText(w,'ca')}));
          this.manager.writeLogChunk?.('[WRITING_CORRECTIONS] '+JSON.stringify({count:data.validation.corrections,language:ca?'ca':'es'})+'\n');
          return {ok:true,data,...data,texto:data.formattedText,titulos:[],avisos:require('../../../shared/writingWarnings').messages(qualityWarnings,ca?'ca':'es'),qualityWarnings,error:null,meta:{modelId:this.modelId,provider:this.name,operation:task,durationMs:Date.now()-started,attempts,retried:attempts>1,backend:this.manager.activeBackend,...this.lastCompletionStats,responseChecks:checks}};
        }catch(error){issues=error.qualityErrors||[error.code||error.message];checks.push({...this.lastCompletionStats?.inference,validation:issues});this.manager.writeLogChunk?.('[WRITING_VALIDATION] '+JSON.stringify(checks.at(-1))+'\n');if(attempts===2||error.code==='ABORTED')throw error;}
      }
    }catch(error){
      return {ok:false,data:null,texto:null,titulos:[],avisos:[],error:{code:error.code==='ABORTED'?'CANCELLED':'INVALID_GENERATION',message:ca?'La IA no ha pogut generar aquest text.':'La IA no ha podido generar este texto.'},meta:{modelId:this.modelId,provider:this.name,operation:task,attempts:Math.min(attempts,2),qualityErrors:error.qualityErrors||[error.code||error.message],durationMs:Date.now()-started,backend:this.manager.activeBackend,...this.lastCompletionStats,responseChecks:checks}};
    }
  }

  async generateLongWriting(params,options={}){
    await require('./orthography').ready();
    const quality=require('./writingQuality'),contract=require('../../../shared/writingContract'),ca=(params.idioma_salida||params.idioma)==='ca',lang=ca?'ca':'es',started=Date.now(),checks=[];
    const long=params.longitud!=='corta',targetWords=long?500:300;
    const measures=params.selectedMeasures||[],minimum=contract.minimumState('redactar_presentacion',measures,lang,{longitud:long?'estandar':'corta'});
    if(!minimum.allowed)return {ok:false,error:{code:'MIN_SELECTED_MEASURES',message:minimum.message},selection:minimum};
    const groupCount=Math.max(1,Math.min(long?6:3,measures.length)),groups=Array.from({length:groupCount},(_,index)=>measures.filter((_,i)=>Math.min(groupCount-1,Math.floor(i*groupCount/measures.length))===index)),omitted=[],corrections=[];
    let paragraphMax=220;
    try{
      const endpoint='http://127.0.0.1:'+(this.manager.port||1),system=quality.prompt('redactar_presentacion',params,lang)[0];
      const fragment=async index=>{
        const header=index===-1,subset=header?measures:groups[index],facts=ca?{municipi:params.municipio,candidatura:params.organizacion||params.partido,mandat:params.mandato,mesures:subset.map(m=>({titol:m.titulo,text:m.texto}))}:{municipio:params.municipio,organizacion:params.organizacion||params.partido,mandato:params.mandato,medidas:subset.map(m=>({titulo:m.titulo,texto:m.texto}))};let lastIssues=[];
        for(let retry=0;retry<2;retry++){
          const fields=header?(ca?{titol:'',entradeta:''}:{titulo:'',entradilla:''}):(ca?{text:''}:{texto:''});
          const instruction=header?(ca?'Escriu un títol breu i una entradeta de 15 a 40 paraules, diferent del títol.':'Escribe un título breve y una entradilla de 15 a 40 palabras, diferente del título.'):(ca?'Escriu UN paràgraf de 60 a 90 paraules sobre aquestes mesures. Desenvolupa els compromisos en primera persona del plural i futur. No canviïs la finalitat d’una mesura ni inventis dades.':'Escribe UN párrafo de 60 a 90 palabras sobre estas medidas. Desarrolla los compromisos en primera persona del plural y futuro. No cambies la finalidad de una medida ni inventes datos.');
          try{
            const raw=await this.callChat(endpoint,[retry?quality.prompt('redactar_presentacion',params,lang,true,lastIssues)[0]:system,{role:'user',content:JSON.stringify(facts)+'\n'+instruction+'\n'+(ca?'Retorna només JSON amb aquests camps: ':'Devuelve solo JSON con estos campos: ')+Object.keys(fields).join(', ')}],{...contract.NORMAL_GENERATION,max_tokens:header?450:700,context:8192,timeout:require('../../../shared/writingLimits').timeout(header?450:700,this.manager.activeBackend),signal:options.signal||params._generationSignal,idioma:lang,responseSchema:{type:'object',properties:Object.fromEntries(Object.keys(fields).map(key=>[key,{type:'string'}])),required:Object.keys(fields),additionalProperties:false}});
            let object=contract.parseJson(raw);if(!object)object=require('../../../shared/textFormat').internalObject(raw);
            if(!object||typeof object!=='object')throw Object.assign(Error('INVALID_JSON'),{qualityErrors:['INVALID_JSON']});
            const title=object.titulo||object.titol||'',text=header?(object.entradilla||object.entradeta||''):(object.texto||object.text||'');
            if(typeof text!=='string'||!text.trim()||(header&&(typeof title!=='string'||!title.trim())))throw Object.assign(Error('EMPTY'),{qualityErrors:['EMPTY']});
            const value=quality.validatePrepared('redactar_fragmento',header?{titulo:title,entradilla:text,formattedText:[title,text].join('\n\n')}:{texto:text,formattedText:text},{...params,fragmentMaxWords:header?160:paragraphMax});
            const words=text.trim().split(/\s+/).filter(Boolean).length;
            if(words<(header?15:60)||words>(header?40:90))value.validation.warnings.push({code:'FRAGMENT_LENGTH',fragment:value.entradilla||value.texto,start:header?value.formattedText.indexOf(value.entradilla):0,end:value.formattedText.length,count:words});
            corrections.push(...value.validation.warnings.filter(w=>w.corrected).map(w=>({...w,part:header?'header':'paragraph-'+(index+1)})));
            checks.push({...this.lastCompletionStats?.inference,part:header?'header':'paragraph-'+(index+1),measureIndices:header?[]:subset.map(m=>measures.indexOf(m)+1),validation:[],warningCodes:value.validation.warnings.map(w=>w.code),wordCount:words});
            return{value,warnings:value.validation.warnings};
          }catch(error){lastIssues=error.qualityErrors||[error.code||error.message];const row={...this.lastCompletionStats?.inference,part:header?'header':'paragraph-'+(index+1),validation:lastIssues};checks.push(row);this.manager.writeLogChunk?.('[WRITING_VALIDATION] '+JSON.stringify(row)+'\n');if(error.code==='ABORTED')throw error;if(retry){omitted.push({part:row.part,measureIndices:subset.map(m=>measures.indexOf(m)+1),codes:lastIssues});return null;}}
        }
      };
      const first=await fragment(-1);if(!first)throw Object.assign(Error('EMPTY'),{qualityErrors:['EMPTY']});const header={titulo:first.value.titulo,entradilla:first.value.entradilla},parrafos=[],accepted=[first];let generatedWords=first.value.formattedText.split(/\s+/).filter(Boolean).length;
      for(let index=0;index<groupCount;index++){
        paragraphMax=Math.max(90,Math.min(220,targetWords-generatedWords));const result=await fragment(index);if(!result)continue;parrafos.push(result.value.texto);accepted.push(result);generatedWords+=result.value.texto.trim().split(/\s+/).filter(Boolean).length;
      }
      if(parrafos.length<2)throw Object.assign(Error('EMPTY'),{qualityErrors:['EMPTY']});
      // Each fragment already passed the blocking checks. Cross-fragment checks are warnings.
      const data=quality.formatAndValidate('redactar_presentacion',{...header,parrafos},params,{blocking:false});
      for(const item of accepted)for(const warning of item.warnings.filter(w=>w.corrected||w.code==='FRAGMENT_LENGTH')){
        const field=item.value.entradilla||item.value.texto,start=data.formattedText.indexOf(warning.corrected?item.value.formattedText:field);data.validation.warnings.push({...warning,start:warning.corrected?Math.max(0,start+warning.start):start,end:warning.corrected?Math.max(0,start+warning.start+1):start+field.length});
      }
      if(omitted.length)data.validation.warnings.push({code:'MISSING_FRAGMENTS',fragment:omitted.map(o=>o.measureIndices.join(', ')).filter(Boolean).join('; '),start:-1,end:-1});
      const unique=[...new Map(data.validation.warnings.map(w=>[w.code+':'+w.start+':'+w.fragment,w])).values()],qualityWarnings=unique.map(w=>({...w,message_es:quality.warningText(w,'es'),message_ca:quality.warningText(w,'ca')}));
      this.manager.writeLogChunk?.('[WRITING_CORRECTIONS] '+JSON.stringify({count:corrections.length+data.validation.corrections,language:lang})+'\n');
      return{ok:true,data,...data,texto:data.formattedText,avisos:require('../../../shared/writingWarnings').messages(qualityWarnings,ca?'ca':'es'),qualityWarnings,titulos:[],error:null,meta:{modelId:this.modelId,provider:this.name,operation:'redactar_presentacion',segmented:true,attempts:1,retried:checks.some(row=>row.validation.length>0),omittedFragments:omitted,automaticCorrections:corrections.length+data.validation.corrections,backend:this.manager.activeBackend,durationMs:Date.now()-started,...this.lastCompletionStats,responseChecks:checks}};
    }catch(error){return{ok:false,data:null,texto:null,avisos:[],titulos:[],error:{code:error.code==='ABORTED'?'CANCELLED':'INVALID_GENERATION',message:ca?'No hi ha prou fragments vàlids per mostrar una proposta.':'No hay suficientes fragmentos válidos para mostrar una propuesta.'},meta:{modelId:this.modelId,operation:'redactar_presentacion',segmented:true,qualityErrors:error.qualityErrors||[error.code||error.message],backend:this.manager.activeBackend,durationMs:Date.now()-started,responseChecks:checks}};}
  }

  async generate(task, promptConfig, options = {}) {
    if(require('../../../shared/writingContract').MIN_SELECTED[task])return this.generateWriting(task,promptConfig,options);
    if(task==='traducir_texto_estructurado'&&require('../../../shared/writingContract').MIN_SELECTED[promptConfig.generationTask]){
      const idioma=promptConfig.a||promptConfig.to||promptConfig.idioma_destino||promptConfig.idioma||'ca';
      const translationObject=promptConfig.objeto||promptConfig.sourceObject||promptConfig.datos||promptConfig.data||{};
      return this.generateWriting(promptConfig.generationTask,{...promptConfig,idioma,idioma_salida:idioma,translationSource:translationObject},{...options,translationObject});
    }
    const startTime = Date.now();
    // Normalización canónica de parámetros (Sección 4.1)
    const text = promptConfig.texto || promptConfig.text || promptConfig.texto_actual || promptConfig.texto_original || promptConfig.puntosClave || '';
    const mun = promptConfig.municipio || promptConfig.municipality || 'el municipi';
    const area = promptConfig.area || promptConfig.area_nombre || '';
    const org = promptConfig.organizacion || promptConfig.partido || 'Podemos';
    const mandato = promptConfig.mandato || '2027–2031';
    const lang = promptConfig.idioma_salida || promptConfig.idioma || promptConfig.language || 'es';
    const lema = getLema(promptConfig, lang) || '';
    const isCa = lang === 'ca';

    // Determinar límites de tokens específicos por tarea (Sección 6.1)
    let maxTokens = options.max_tokens || TASK_TOKEN_LIMITS[task] || 500;
    if (task === 'traducir_texto') {
      const inputWords = text.trim().split(/\s+/).filter(Boolean).length || 40;
      maxTokens = Math.min(950, Math.max(200, Math.round(inputWords * 2.5)));
    } else if (task === 'traducir_texto_estructurado') {
      maxTokens = 950;
    } else if (task === 'redactar_presentacion') {
      const longitud = promptConfig.longitud || options.longitud || 'estandar';
      maxTokens = longitud === 'corta' ? 550 : 900;
    }

    // Timeout por tarea (Sección 6.3): 180s para presentación, 120s para el resto
    const timeoutMs = options.timeout || (task === 'redactar_presentacion' ? 180000 : 120000);

    try {
      const endpoint='http://127.0.0.1:'+(this.manager.port||1);
      let systemPrompt = '';
      if (task === 'traducir_texto') {
        const sourceLang = promptConfig.de || promptConfig.from || (isCa ? 'es' : 'ca');
        const destination = promptConfig.a || promptConfig.to || promptConfig.idioma_destino || (sourceLang === 'ca' ? 'es' : 'ca');
        systemPrompt = destination === 'ca'
          ? 'Ets un traductor professional. Tradueix fidelment al català, sense afegir, ometre ni inventar contingut. Respon únicament amb la traducció.'
          : 'Eres un traductor profesional. Traduce fielmente al castellano, sin añadir, omitir ni inventar contenido. Responde únicamente con la traducción.';
      } else if (task === 'traducir_texto_estructurado') {
        const sourceLang = promptConfig.de || promptConfig.from || 'es';
        const destIsCa = (promptConfig.a || promptConfig.to || promptConfig.idioma_destino || (sourceLang === 'ca' ? 'es' : 'ca')) === 'ca';
        systemPrompt = destIsCa
          ? `Ets un traductor professional especialitzat en documents polítics i municipals catalans.
La teva tasca és traduir fidelment documents estructurats en JSON del castellà al català.
Mantén la màxima precisió terminològica, naturalitat i exactitud en català.
Conserva estrictament l'estructura JSON, les claus i el nombre d'elements i paràgrafs.
No afegeixis etiquetes tècniques ("Pàrraf explicatiu:", "Frase destacada:", etc.) ni comentaris addicionals.
Respon exclusivament amb l'objecte JSON vàlid.`
          : `Eres un traductor profesional especializado en documentos políticos y municipales en castellano.
Tu tarea es traducir fielmente documentos estructurados en JSON del catalán al castellano.
Mantén la máxima precisión terminológica, naturalidad y exactitud en castellano.
Conserva estrictamente la estructura JSON, las claves y el número de elementos y párrafos.
No añadas etiquetas técnicas ("Párrafo explicativo:", "Frase destacada:", etc.) ni comentarios adicionales.
Responde exclusivamente con el objeto JSON válido.`;
      } else {
        systemPrompt = isCa
          ? `Ets un redactor polític municipal per a candidatures progressistes de Podem / En Comú Podem.
El teu objectiu és redactar textos amb veu política pròpia: propera, directa, pedagògica i transformadora, arrelada a la realitat dels barris i a la defensa dels serveis públics.

CRITERIS GENERALS DE REDACCIÓ:
1. ARRELAMENT LOCAL I HONESTEDAT:
   - Escriu des de la realitat quotidiana del municipi, els barris i els serveis públics. Diferencia el que pot fer l'Ajuntament de la resta d'administracions.
   - No inventis carrers, barris, equipaments, dades, conflictes socials ni problemes que no estiguin al context.
2. VEU DIRECTA I PEDAGÒGICA:
   - Frases clares, paràgrafs nets i directes al gra.
   - Explica amb claredat i honestedat els problemes veïnals concrets i les solucions que proposem per resoldre'ls.
   - Quan sigui pertinent, expressa amb redacció pròpia que governar implica establir prioritats clares i assumir responsabilitats públiques davant la ciutadania.
   - Llenguatge polític normal, humà i honest. Evita terminologia buida de consultoria, màrqueting electoral o burocràcia. No sonis com una IA intentant semblar política.
3. CLIXÉS I FÓRMULES ESTRICTAMENT PROHIBIDES:
   - Evita rotundament fórmules buides com: "Creiem fermament que...", "El nostre ferm compromís...", "Un futur ple d'oportunitats...", "Transformar la nostra ciutat...", "Construir un futur millor...", "Junts ho podem aconseguir...", "Avançar cap a un nou paradigma...", "Aspirem a liderar una transformació integral i transversal...".
4. FERMESA SENSE GRANDILOQÜÈNCIA:
   - Fermesa basada en arguments, prioritats i solucions, sense agressivitat gratuïta ni acumulació d'adjectius.
   - Centra la crítica en decisions preses, conseqüències per a la ciutadania i models de municipi contraposts.
5. REGLA ANTI-CÒPIA:
   Les frases, exemples, esquemes i estructures d'aquestes instruccions són criteris de redacció i mai text per reutilitzar literalment.
   No copiis frases del prompt. No reprodueixis els exemples. Redacta sempre des de zero utilitzant únicament el contingut real del projecte.`
          : `Eres un redactor político municipal para candidaturas progresistas de Podemos / En Comú Podem.
Tu objetivo es redactar textos con voz política propia: cercana, directa, pedagógica y transformadora, arraigada en la realidad de los barrios y en la defensa de los servicios públicos.

CRITERIOS GENERALES DE REDACCIÓN:
1. ARRAIGO LOCAL Y HONESTIDAD:
   - Escribe desde la realidad cotidiana del municipio, los barrios y los servicios públicos. Diferencia lo que puede hacer el Ayuntamiento del resto de administraciones.
   - No inventes calles, barrios, equipamientos, datos, conflictos sociales ni problemas que no estén en el contexto.
2. VOZ DIRECTA Y PEDAGÓGICA:
   - Frases claras, párrafos limpios y directos al grano.
   - Explica con claridad y honestidad los problemas vecinales concretos y las soluciones que proponemos para resolverlos.
   - Cuando sea pertinente, expresa con redacción propia que gobernar implica establecer prioridades claras y asumir responsabilidades públicas ante la ciudadanía.
   - Lenguaje político normal, humano y honesto. Evita terminología vacía de consultoría, marketing electoral o burocracia. No escribas como una IA intentando sonar política.
3. CLICHÉS Y FÓRMULAS ESTRICTAMENTE PROHIBIDOS:
   - Evita rotundamente fórmulas vacías como: "Creemos firmemente que...", "Nuestro firme compromiso...", "Un futuro lleno de oportunidades...", "Transformar nuestra ciudad...", "Construir un futuro mejor...", "Juntos podemos conseguirlo...", "Avanzar hacia un nuevo paradigma...", "Aspiramos a liderar una transformación integral y transversal...".
4. FIRMEZA SIN GRANDILOCUENCIA:
   - Firmeza basada en argumentos, prioridades y soluciones, sin agresividad gratuita ni acumulación de adjetivos.
   - Centra la crítica en decisiones tomadas, consecuencias para la ciudadanía y modelos de municipio contrapuestos.
5. REGLA ANTI-COPIA:
   Las frases, ejemplos, esquemas y estructuras de estas instrucciones son criterios de redacción y nunca texto para reutilizar literalmente.
   No copies frases del prompt. No reproduzcas los ejemplos. Redacta siempre desde cero utilizando únicamente el contenido real del proyecto.`;
      }

      let userPrompt = '';
      switch (task) {
        case 'sugerir_titulos': {
          userPrompt = isCa
            ? `Proposa exactament 3 títols executius diferents per a aquesta mesura electoral (entre 4 i 12 paraules, amb verb d'acció, una línia per títol, sense numerar):\n"${text}"`
            : `Propón exactamente 3 títulos ejecutivos diferentes para esta medida electoral (entre 4 y 12 palabras, con verbo de acción, una línea por título, sin numerar):\n"${text}"`;
          break;
        }
        case 'adaptar_medida': {
          userPrompt = isCa
            ? `Adapta aquesta mesura al context municipal de ${mun} en primera persona del plural (ex: Impulsarem des de l'Ajuntament de ${mun}).\nConserva tots els compromisos i el sentit polític. Utilitza un llenguatge directe, humà i comprensible, centrat a explicar la solució per a les veïnes i veïns sense burocràcia ni clixés:\n"${text}"`
            : `Adapta esta medida al contexto municipal de ${mun} en primera persona del plural (ej: Impulsaremos desde el Ayuntamiento de ${mun}).\nConserva todos los compromisos y el fondo político. Utiliza un lenguaje directo, humano y comprensible, centrado en explicar la solución para las vecinas y vecinos sin burocracia ni clichés:\n"${text}"`;
          break;
        }
        case 'desarrollar_medida': {
          userPrompt = isCa
            ? `Afegeix una explicació breu (màxim 50 paraules) que desenvolupi com s'executarà aquesta mesura a ${mun}: Descriu el tipus de necessitat que atén la mesura, sense afirmar dades, llocs ni problemes concrets del municipi que no apareguin al context. Explica l'actuació municipal proposada i la participació ciutadana:\n"${text}"`
            : `Añade una explicación breve (máximo 50 palabras) que desarrolle cómo se ejecutará esta medida en ${mun}: Describe el tipo de necesidad que atiende la medida, sin afirmar datos, lugares ni problemas concretos del municipio que no aparezcan en el contexto. Explica la actuación municipal propuesta y la participación ciudadana:\n"${text}"`;
          break;
        }
        case 'mejorar_redaccion': {
          userPrompt = isCa
            ? `Millora l'estil d'aquest text electoral aplicant la veu política local: llenguatge clar, directe i pedagògic, eliminant clixés buits i conservant el contingut exacte:\n"${text}"`
            : `Mejora el estilo de este texto electoral aplicando la voz política local: lenguaje claro, directo y pedagógico, eliminando clichés vacíos y conservando el contenido exacto:\n"${text}"`;
          break;
        }
        case 'corregir_texto': {
          userPrompt = isCa
            ? `Corregeix l'ortografia, la tipografia i la puntuació d'aquest text en català mantenint fidelment el contingut:\n"${text}"`
            : `Corrige la ortografía, la tipografía y la puntuación de este texto en castellano manteniendo fielmente el contenido:\n"${text}"`;
          break;
        }
        case 'resumir_texto': {
          userPrompt = isCa
            ? `Resumeix aquesta proposta en una o dues frases executives i directes, conservant els compromisos clau:\n"${text}"`
            : `Resume esta propuesta en una o dos frases ejecutivas y directas, conservando los compromisos clave:\n"${text}"`;
          break;
        }
        case 'traducir_texto': {
          const deLang = promptConfig.de || promptConfig.from || (isCa ? 'es' : 'ca');
          const aLang = promptConfig.a || promptConfig.to || promptConfig.idioma_destino || (deLang === 'ca' ? 'es' : 'ca');
          const isDestCa = aLang === 'ca';
          userPrompt = isDestCa
            ? `Tradueix fidelment del castellà al català aquest text del programa municipal sense afegir ni ometre contingut:\n"${text}"`
            : `Traduce fielmente del catalán al castellano este texto del programa municipal sin añadir ni omitir contenido:\n"${text}"`;
          break;
        }
        case 'traducir_texto_estructurado': {
          const deLang = promptConfig.de || promptConfig.from || 'es';
          const aLang = promptConfig.a || promptConfig.to || promptConfig.idioma_destino || (deLang === 'ca' ? 'es' : 'ca');
          const isDestCa = aLang === 'ca';
          const srcObj = promptConfig.objeto || promptConfig.sourceObject || promptConfig.datos || promptConfig.data || {};
          const jsonString = JSON.stringify(srcObj, null, 2);

          userPrompt = isDestCa
            ? `Tradueix fidelment del castellà al català el següent objecte JSON de textos polítics municipals.
Conserva exactament les mateixes claus ("titulo", "entradilla", "parrafos", "texto", "frase_destacada") i el mateix nombre d'elements i paràgrafs.
No afegeixis etiquetes descriptives ni tècniques (com "Frase destacada:", "Pàrraf explicatiu:", etc.).
Tradueix exclusivament els valors textuals amb rigor, naturalitat i màxima fidelitat.

OBJECTE JSON A TRADUIR:
${jsonString}

RESPON ÚNICAMENT AMB L'OBJECTE JSON RESULTANT:`
            : `Traduce fielmente del catalán al castellano el siguiente objeto JSON de textos políticos municipales.
Conserva exactamente las mismas claves ("titulo", "entradilla", "parrafos", "texto", "frase_destacada") y el mismo número de elementos y párrafos.
No añadas etiquetas descriptivas ni técnicas (como "Frase destacada:", "Párrafo explicativo:", etc.).
Traduce exclusivamente los valores textuales con rigor, naturalidad y máxima fidelidad.

OBJETO JSON A TRADUCIR:
${jsonString}

RESPONDE ÚNICAMENTE CON EL OBJETO JSON RESULTANTE:`;
          break;
        }
        case 'redactar_presentacion': {
          const longitud = promptConfig.longitud || options.longitud || 'estandar';
          const numParsDesc = longitud === 'corta' ? '3 paràgrafs' : '3 o 4 paràgrafs';
          const numParsDescEs = longitud === 'corta' ? '3 párrafos' : '3 o 4 párrafos';

          const ejesArr = Array.isArray(promptConfig.ejes_prioridades) ? promptConfig.ejes_prioridades : (Array.isArray(promptConfig.medidas_resumen) ? promptConfig.medidas_resumen : (Array.isArray(promptConfig.medidas) ? promptConfig.medidas : []));
          let prioridadesContextoEs = '';
          let prioridadesContextoCa = '';
          if (ejesArr.length > 0) {
            prioridadesContextoEs = `\n\nEjes y prioridades políticas del programa:\n${ejesArr.slice(0, 8).map(m => typeof m === 'string' ? `- ${m}` : `- [${m.area}] ${m.titulo || ''}`).join('\n')}`;
            prioridadesContextoCa = `\n\nEixos i prioritats polítiques del programa:\n${ejesArr.slice(0, 8).map(m => typeof m === 'string' ? `- ${m}` : `- [${m.area}] ${m.titulo || ''}`).join('\n')}`;
          }

          const orientacion = promptConfig.orientacion_usuario || promptConfig.orientacion || '';
          const orientacionContextoEs = orientacion ? `\n\nOrientación editorial prioritaria indicada por el equipo:\n"${orientacion}"` : '';
          const orientacionContextoCa = orientacion ? `\n\nOrientació editorial prioritària indicada per l'equip:\n"${orientacion}"` : '';

          userPrompt = isCa
            ? `Redacta l'obertura política del programa electoral municipal per a ${org} a ${mun} (mandat ${mandato})${lema ? ` sota el lema "${lema}"` : ''}.${prioridadesContextoCa}${orientacionContextoCa}

OBJECTIU I ENFOCAMENT EDITORIAL:
La presentació és l'obertura política del programa. Ha d'expressar amb veu pròpia des de l'organització ("Defensem...", "Volem...", "Apostem per...", "Treballem per..."):
- Qui som i quins principis ens defineixen davant la ciutadania.
- Quin model de municipi volem construir: serveis públics forts de gestió directa, barris cuidats, igualtat real i justícia social.
- Quines són les prioritats generals que es desprenen del programa.
- Amb quina intenció política i compromís ètic de rendició de comptes ens adrecem a la ciutadania.

TÍTOL POLÍTIC EDITORIAL:
- Proposa un titular editorial propi i evocador de 4 a 10 paraules que sintetitzi el projecte de municipi (sense cometes, sense punt final).
- PROHIBIT titular: "Presentació", "Carta de presentació", "Presentación", "Carta de presentación", "Obertura", "Apertura", "Cierre", "Tancament", "Conclusió" o "Conclusión".

ENTRADILLA:
- 1 frase completa i contundent de 15 a 35 paraules que sintetitzi la visió i el model de ciutat.

COS DE PARÀGRAFS:
- ${numParsDesc} nets de reflexió i proposta política d'alçada.

PROHIBICIONS ESTRICTES:
- NO és una carta. PROHIBIT utilitzar cap encapçalament o salutació epistolar com: "Estimades veïnes...", "Estimats veïns...", "Querida ciutadania...".
- PROHIBIT parlar de "la candidatura", "comicis", "eleccions" o "presentem la nostra candidatura". Parla des de l'organització i el projecte de ciutat.
- NO enumeris ni resumeixis mesures una per una, ni citis noms concrets d'oficines, obres, fanals, carrers o imports. Extreu-ne el fil polític conductor general.

FORMAT DE SORTIDA:
Respon exclusivament amb un objecte JSON amb aquesta estructura exacta:
{
  "titulo": "Títol polític editorial de 4 a 10 paraules",
  "entradilla": "1 frase completa d'obertura de 15 a 35 paraules.",
  "parrafos": [
    "Primer paràgraf...",
    "Segon paràgraf...",
    "Tercer paràgraf..."
  ]
}

DIRECTRIU INEQUÍVOCA D'IDIOMA:
RESPON EXCLUSIVAMENT EN CATALÀ.
NO BARREGIS CASTELLÀ.`
            : `Redacta la apertura política del programa electoral municipal para ${org} en ${mun} (mandato ${mandato})${lema ? ` bajo el lema "${lema}"` : ''}.${prioridadesContextoEs}${orientacionContextoEs}

OBJETIVO Y ENFOQUE EDITORIAL:
La presentación es la apertura política del programa. Debe expresar con voz propia desde la organización ("Defendemos...", "Queremos...", "Apostamos por...", "Trabajamos por..."):
- Quiénes somos y qué principios nos definen ante la ciudadanía.
- Qué modelo de municipio queremos construir: servicios públicos fuertes de gestión directa, barrios cuidados, igualdad real y justicia social.
- Cuáles son las prioridades generales que se desprenden del programa.
- Con qué intención política y compromiso ético de rendición de cuentas nos presentamos ante la ciudadanía.

TÍTULO POLÍTICO EDITORIAL:
- Propón un titular editorial propio y evocador de 4 a 10 palabras que sintetice el proyecto de municipio (sin comillas, sin punto final).
- PROHIBIDO titular: "Presentación", "Carta de presentación", "Presentació", "Carta de presentació", "Apertura", "Obertura", "Cierre", "Tancament", "Conclusión" o "Conclusió".

ENTRADILLA:
- 1 frase completa y rotunda de 15 a 35 palabras que sintetice la visión y el modelo de ciudad.

CUERPO DE PÁRRAFOS:
- ${numParsDescEs} limpios de reflexión y propuesta política de altura.

PROHIBICIONES ESTRICTAS:
- NO es una carta. PROHIBIDO utilizar encabezados o saludos epistolares como: "Queridos vecinos...", "Querida ciudadanía...", "Estimados...".
- PROHIBIDO hablar de "la candidatura", "comicios", "elecciones" o "presentamos nuestra candidatura". Habla desde la organización y el proyecto de ciudad.
- NO enumeres ni resumas medidas una por una, ni cites nombres concretos de oficinas, obras, farolas, calles o importes. Extrae el hilo político conductor general.

FORMATO DE SALIDA:
Responde exclusivamente con un objeto JSON con esta estructura exacta:
{
  "titulo": "Título político editorial de 4 a 10 palabras",
  "entradilla": "1 frase completa de apertura de 15 a 35 palabras.",
  "parrafos": [
    "Primer párrafo...",
    "Segundo párrafo...",
    "Tercer párrafo..."
  ]
}

DIRECTRIZ INEQUÍVOCA DE IDIOMA:
RESPONDE EXCLUSIVAMENTE EN CASTELLANO.
NO MEZCLES CATALÁN.`;
          break;
        }
        case 'redactar_introduccion_area': {
          const areaName = area || 'General';
          const medidasArr = Array.isArray(promptConfig.medidas_incluidas) ? promptConfig.medidas_incluidas : [];
          // Contexto sintético: títulos o resúmenes breves (máximo 8 elementos)
          const contextoMedidas = medidasArr.length > 0 ? `\nMesures i prioritats seleccionades d'aquest bloc:\n- ${medidasArr.slice(0, 8).map(m => typeof m === 'string' ? m : (m.titulo || m.texto || '')).join('\n- ')}` : '';
          const contextoMedidasEs = medidasArr.length > 0 ? `\nMedidas y prioridades seleccionadas de este bloque:\n- ${medidasArr.slice(0, 8).map(m => typeof m === 'string' ? m : (m.titulo || m.texto || '')).join('\n- ')}` : '';
          userPrompt = isCa
            ? `Redacta la introducció política del bloc "${areaName}" per a ${org} a ${mun}.${contextoMedidas}

OBJECTIU I ENFOCAMENT:
Analitza les prioritats d'aquesta àrea per identificar el fons polític comú: què defensem, quina responsabilitat pública plantegem per a l'Ajuntament i què volem millorar o garantir per a les veïnes i veïns.
Escriu directament la posició política de l'organització com a veu viva (ex: "Apostem per...", "Defensem...", "Volem garantir...").

PROHIBICIONS ESTRICTES:
- NO expliquis què fa aquest text ni descriguis el procés de redacció. ESCRIU DIRECTAMENT LA INTRODUCCIÓ FINAL.
- PROHIBIT utilitzar metatext com: "Aquesta introducció...", "Aquesta àrea...", "En aquest apartat...", "En aquesta secció...", "A continuació...", "Aquestes mesures...", "Per què importa", "Prioritats", "Entradilla", "Frase destacada", o numeracions 1. / 2. / 3.
- PROHIBIT citar noms literals d'oficines, plans, programes, tràmits, serveis específics o instruments administratius concrets presents a les mesures. Transforma aquests instruments en principis polítics, drets ciutadans, responsabilitats públiques i prioritats generals.
- NO enumeris ni resumas les mesures una per una. No mencionis percentatges, imports ni codis.
- NO inventis diagnòstics locals, mancances ni fets que no estiguin al context.

FORMAT DE SORTIDA:
Respon exclusivament amb un objecte JSON amb aquesta estructura exacta (sense blocs markdown addicionals):
{
  "entradilla": "1 o 2 frases d'obertura que connectin directament l'àrea amb la vida quotidiana dels veïns i veïnes.",
  "texto": "1 paràgraf que desenvolupi les prioritats públiques i el compromís polític de l'Ajuntament en aquesta matèria (màxim 80 paraules).",
  "frase_destacada": "Una frase contundent i clara de màxim 15 paraules per encapçalar el bloc, sense cometes."
}

DIRECTRIU INEQUÍVOCA D'IDIOMA:
RESPON EXCLUSIVAMENT EN CATALÀ.
NO BARREGIS CASTELLÀ.
NO COPIÏS FRASES EN CASTELLÀ DEL CONTEXT.
TRADUEIX MENTALMENT EL CONTEXT ABANS DE REDACTAR.`
            : `Redacta la introducción política del bloque "${areaName}" para ${org} en ${mun}.${contextoMedidasEs}

OBJETIVO Y ENFOQUE:
Analiza las prioridades de este área para identificar el fondo político común: qué defendemos, qué responsabilidad pública planteamos para el Ayuntamiento y qué queremos mejorar o garantizar para las vecinas y vecinos.
Escribe directamente la posición política de la organización como voz viva (ej: "Apostamos por...", "Defendemos...", "Queremos garantizar...").

PROHIBICIONES ESTRICTAS:
- NO expliques qué hace este texto ni describas el proceso de redacción. ESCRIBE DIRECTAMENTE LA INTRODUCCIÓN FINAL.
- PROHIBIDO utilizar metatexto como: "Esta introducción...", "Esta área...", "En este apartado...", "En esta sección...", "A continuación...", "Estas medidas...", "Por qué importa", "Prioridades", "Entradilla", "Frase destacada", o numeraciones 1. / 2. / 3.
- PROHIBIDO citar nombres literales de oficinas, planes, programas, trámites, servicios específicos o instrumentos administrativos presentes en las medidas. Transforma esos instrumentos concretos en principios políticos, derechos ciudadanos, responsabilidades públicas y prioridades generales.
- NO enumeres ni resumas las medidas una por una. No menciones porcentajes, importes ni códigos.
- NO inventes diagnósticos locales, carencias ni hechos que no estén en el contexto.

FORMATO DE SALIDA:
Responde exclusivamente con un objeto JSON con esta estructura exacta (sin bloques markdown adicionales):
{
  "entradilla": "1 o 2 frases de apertura que conecten directamente el área con la vida cotidiana de las vecinas y vecinos.",
  "texto": "1 párrafo que desarrolle las prioridades públicas y el compromiso político del Ayuntamiento en esta materia (máximo 80 palabras).",
  "frase_destacada": "Una frase contundente y clara de máximo 15 palabras para encabezar el bloque, sin comillas."
}

DIRECTRIZ INEQUÍVOCA DE IDIOMA:
RESPONDE EXCLUSIVAMENTE EN CASTELLANO.
NO MEZCLES CATALÁN.`;
          break;
        }
        case 'sugerir_frase_destacada': {
          const areaName = area || 'General';
          userPrompt = isCa
            ? `Proposa una frase destacada contundent i pedagògica per encapçalar el bloc de "${areaName}" a ${mun}. Ha de basar-se en drets, serveis públics i vida als barris, sense clixés publicitaris (màxim 15 paraules).\n\nRESPON EXCLUSIVAMENT EN CATALÀ.`
            : `Propón una frase destacada contundente y pedagógica para encabezar el bloque de "${areaName}" en ${mun}. Debe basarse en derechos, servicios públicos y vida en los barrios, sin clichés publicitarios (máximo 15 palabras).\n\nRESPONDE EXCLUSIVAMENTE EN CASTELLANO.`;
          break;
        }
        case 'redactar_cierre': {
          const prioridadesArr = Array.isArray(promptConfig.medidas_resumen) ? promptConfig.medidas_resumen : (Array.isArray(promptConfig.medidas) ? promptConfig.medidas : []);
          const contextoPrioridades = prioridadesArr.length > 0 ? `\nPrioritats clau del programa:\n${prioridadesArr.slice(0, 6).map(m => typeof m === 'string' ? `- ${m}` : `- ${m.titulo || ''}`).join('\n')}` : '';
          const contextoPrioridadesEs = prioridadesArr.length > 0 ? `\nPrioridades clave del programa:\n${prioridadesArr.slice(0, 6).map(m => typeof m === 'string' ? `- ${m}` : `- ${m.titulo || ''}`).join('\n')}` : '';

          userPrompt = isCa
            ? `Redacta el text de tancament i compromisos per a ${org} a ${mun} (mandat ${mandato})${lema ? ` sota el lema "${lema}"` : ''}.${contextoPrioridades}

CRITERIS DE REDACCIÓ:
1. Explica que aquest programa és un contracte democràtic amb la ciutadania i un compromís de rendició de comptes barri a barri.
2. Tono proper, valent i mobilitzador: apel·la a la majoria social i a la defensa dels serveis públics davant les promeses buides.
3. TÍTOL: Proposa un titular polític de tancament de 4 a 10 paraules (ex: "El nostre compromís amb ${mun}: fets, paraula i futur"). PROHIBIT titular "Tancament", "Cierre", "Conclusió" o "Conclusión".
4. PÀRRAFOS: 2 o 3 paràgrafs nets (150–220 paraules en total).
5. PROHIBIT començar amb fórmules buides o clixés de tancament com: "Concloem aquest programa...", "En conclusió...", "Per finalitzar...", "A mode de cloenda...", "Per acabar...". Comença directament amb la decisió política i el compromís de futur per al municipi.
6. Evita clixés com "un futur millor" o "junts ho aconseguirem": transmet fermesa des de les solucions concretes.

FORMAT DE SORTIDA:
Respon exclusivament amb un objecte JSON amb aquesta estructura exacta:
{
  "titulo": "Títol polític editorial de 4 a 10 paraules",
  "parrafos": [
    "Primer paràgraf...",
    "Segon paràgraf..."
  ]
}

DIRECTRIU INEQUÍVOCA D'IDIOMA:
RESPON EXCLUSIVAMENT EN CATALÀ.
NO BARREGIS CASTELLÀ.`
            : `Redacta el texto de cierre y compromisos para ${org} en ${mun} (mandato ${mandato})${lema ? ` bajo el lema "${lema}"` : ''}.${contextoPrioridadesEs}

CRITERIOS DE REDACCIÓN:
1. Explica que este programa es un contrato democrático con la ciudadanía y un compromiso de rendición de cuentas barrio a barrio.
2. Tono cercano, valiente y movilizador: apela a la mayoría social y a la defensa de los servicios públicos frente a las promesas vacías.
3. TÍTULO: Propón un titular político de cierre de 4 a 10 palabras (ej: "Nuestro compromiso con ${mun}: hechos, palabra y futuro"). PROHIBIDO titular "Cierre", "Tancament", "Conclusión" o "Conclusió".
4. PÁRRAFOS: 2 o 3 párrafos limpios (150–220 palabras en total).
5. PROHIBIDO empezar con fórmulas vacías o clichés de cierre como: "Concluimos este programa...", "En conclusión...", "Para finalizar...", "A modo de conclusión...", "Para terminar...". Arranca directamente con la decisión política y el compromiso de futuro para el municipio.
6. Evita clichés como "un futuro mejor" o "juntos lo conseguiremos": transmite firmeza desde las soluciones concretas.

FORMATO DE SALIDA:
Responde exclusivamente con un objeto JSON con esta estructura exacta:
{
  "titulo": "Título político editorial de 4 a 10 palabras",
  "parrafos": [
    "Primer párrafo...",
    "Segundo párrafo..."
  ]
}

DIRECTRIZ INEQUÍVOCA DE IDIOMA:
RESPONDE EXCLUSIVAMENTE EN CASTELLANO.
NO MEZCLES CATALÁN.`;
          break;
        }
        case 'clasificar_bloques_estructurales': {
          const blocks = promptConfig.blocks || [];
          userPrompt = `Clasifica exclusivamente la función documental de cada uno de los siguientes bloques de un documento de programa político.
Las categorías válidas para "tipo" son exactamente:
[PORTADA, INTRODUCCION_GENERAL, INDICE, AREA, SUBAREA, INTRODUCCION_AREA, MEDIDA, CONTENIDO_GENERAL, BACK_MATTER, IGNORAR]

INSTRUCCIONES ESTRICTAS:
- NO reescribas.
- NO resumas.
- NO traduzcas.
- NO completes.
- NO inventes contenido.
- NO cambies ningún texto.
- Devuelve únicamente un array JSON válido con la forma: [{"id": "...", "tipo": "..."}].

BLOQUES:
${JSON.stringify(blocks, null, 2)}

RESPONDE ÚNICAMENTE CON EL ARRAY JSON:`;
          break;
        }
        default:
          userPrompt = text;
      }

      if (require('./municipalContext').WRITING_TASKS.has(task)) {
        const context = promptConfig.contexto_municipal || require('./municipalContext').buildMunicipalContext(promptConfig, {}, lang);
        userPrompt = context + '\n\n' + userPrompt;
      }

      const defaultTemps = {
        adaptar_medida: 0.2,
        mejorar_redaccion: 0.2,
        corregir_texto: 0.2,
        resumir_texto: 0.2,
        traducir_texto: 0.2,
        traducir_texto_estructurado: 0.1,
        clasificar_bloques_estructurales: 0.1,
        sugerir_titulos: 0.4,
        desarrollar_medida: 0.4,
        redactar_introduccion_area: 0.4,
        sugerir_frase_destacada: 0.4,
        redactar_presentacion: 0.6,
        redactar_cierre: 0.6
      };
      const taskTemp = options.temperature !== undefined ? options.temperature : require('../../../shared/writingContract').NORMAL_GENERATION.temperature;

      const executeCall = async () => {
        const raw = await this.callChat(endpoint, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], { max_tokens: maxTokens, timeout: timeoutMs, temperature: taskTemp, idioma: lang });

        let res = (raw || '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();
        return res;
      };

      let cleaned = await executeCall();

      // Si la respuesta es vacía, aplicar un único reintento automático (Sección 5.3)
      if (!cleaned) {
        console.warn(`[LlamaCppProvider] Respuesta vacía en ${task}. Reintentando una vez...`);
        cleaned = await executeCall();
      }

      if (!cleaned) {
        throw new Error('El modelo devolvió una respuesta vacía tras el reintento automático.');
      }

      const durationMs = Date.now() - startTime;

      // Formateo según contrato único de tarea (Sección 4.3 y 4.4)
      if (task === 'sugerir_titulos') {
        let lines = cleaned.split('\n')
          .map(l => l.replace(/^[-*•\d.)\]]+\s*/, '').replace(/^["'\*]+|["'\*]+$/g, '').trim())
          .filter(l => l.length >= 4 && !l.toLowerCase().startsWith('aquí') && !l.toLowerCase().startsWith('aquest'));

        if (lines.length < 3) {
          // Intentar separar por punto o punto y coma
          const alt = cleaned.split(/[;•\n]+/).map(s => s.replace(/^[-*•\d.)\]]+\s*/, '').trim()).filter(s => s.length >= 4);
          if (alt.length >= 3) lines = alt;
        }

        const titulos = lines.slice(0, 3);
        if (titulos.length === 0) {
          return {
            ok: false,
            data: null,
            texto: null,
            titulos: [],
            avisos: ['No se han podido generar propuestas de título.'],
            error: { code: 'INVALID_RESPONSE', message: 'No se han podido generar propuestas de título válidas.' },
            meta: { modelId: this.modelId, operation: task, durationMs }
          };
        }

        return {
          ok: true,
          data: { titulos },
          titulos,
          texto: titulos.join('\n'),
          avisos: [],
          error: null,
          meta: {
            modelId: this.modelId,
            modelPath: this.modelPath,
            provider: 'LlamaCppProvider',
            operation: task,
            port: this.manager.port,
            pid: this.manager.process ? this.manager.process.pid : null,
            durationMs
          }
        };
      }

      if (task === 'redactar_presentacion') {
        const parsedJson = extractJsonFromAi(cleaned);
        let presTitulo = '';
        let presEntradilla = '';
        let presParrafos = [];

        if (parsedJson && typeof parsedJson === 'object') {
          presTitulo = stripAiMarkdown(parsedJson.titulo || '').trim();
          presEntradilla = stripAiMarkdown(parsedJson.entradilla || '').trim();
          if (Array.isArray(parsedJson.parrafos)) {
            presParrafos = parsedJson.parrafos.map(p => stripAiMarkdown(p).trim()).filter(Boolean);
          } else if (typeof parsedJson.parrafos === 'string') {
            presParrafos = parsedJson.parrafos.split(/\n\s*\n/).map(p => stripAiMarkdown(p).trim()).filter(Boolean);
          } else if (parsedJson.cuerpo || parsedJson.texto) {
            presParrafos = String(parsedJson.cuerpo || parsedJson.texto).split(/\n\s*\n/).map(p => stripAiMarkdown(p).trim()).filter(Boolean);
          }
        }

        // Fallback si no fue JSON válido
        if (!presEntradilla && presParrafos.length === 0) {
          const rawPars = stripAiMarkdown(cleaned).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
          if (rawPars.length > 0) {
            if (rawPars[0].length < 80 && !rawPars[0].endsWith('.')) {
              presTitulo = rawPars[0];
              presEntradilla = rawPars[1] || '';
              presParrafos = rawPars.slice(2);
            } else {
              presEntradilla = rawPars[0];
              presParrafos = rawPars.slice(1);
            }
          }
        }

        // Limpiar títulos prohibidos o vacíos
        const forbiddenTitles = /^(?:Carta de Presentaci[óo]n|Presentaci[óo]n|Apertura|Cierre|Tancament|Conclusi[óo]n)[\s,:\.]*$/i;
        if (!presTitulo || forbiddenTitles.test(presTitulo.trim())) {
          presTitulo = isCa
            ? `Un projecte comú per a ${mun}: serveis públics i drets garantits`
            : `Un proyecto común para ${mun}: servicios públicos y derechos garantizados`;
        }
        presTitulo = presTitulo.replace(/^["'«»“]+|["'«»”\.\;]+$/g, '').trim();

        // Limpieza de entradilla (quitar encabezados epistolares o etiquetas)
        presEntradilla = presEntradilla
          .replace(/^(?:Estimades?\s+veïnes?|Estimats?\s+veïns?|Querid[ao]s?\s+vecin[ao]s?|Querida\s+ciudadan[íi]a|Estimada\s+ciutadania|Estimad[ao]s?)[\s,:\.]+/i, '')
          .replace(/^(?:Entradilla|Entradeta)[:\s*]+/i, '')
          .trim();

        // Si entradilla quedó vacía pero hay párrafos, extraer el primero
        if (!presEntradilla && presParrafos.length > 0) {
          presEntradilla = presParrafos.shift();
        }

        const presCuerpo = presParrafos.join('\n\n');
        const compositePres = [presEntradilla, presCuerpo].filter(Boolean).join('\n\n');

        const presData = {
          titulo: presTitulo,
          entradilla: presEntradilla,
          parrafos: presParrafos,
          cuerpo: presCuerpo,
          texto: compositePres
        };

        return {
          ok: true,
          data: presData,
          titulo: presTitulo,
          entradilla: presEntradilla,
          parrafos: presParrafos,
          cuerpo: presCuerpo,
          texto: compositePres,
          titulos: [],
          avisos: [],
          error: null,
          meta: {
            modelId: this.modelId,
            modelPath: this.modelPath,
            provider: 'LlamaCppProvider',
            operation: task,
            port: this.manager.port,
            pid: this.manager.process ? this.manager.process.pid : null,
            durationMs
          }
        };
      }

      if (task === 'redactar_introduccion_area') {
        let entradilla = '';
        let texto = '';
        let fraseDestacada = '';

        const parsedJson = extractJsonFromAi(cleaned);
        if (parsedJson && typeof parsedJson === 'object') {
          entradilla = (parsedJson.entradilla || '').trim();
          texto = (parsedJson.texto || '').trim();
          fraseDestacada = (parsedJson.frase_destacada || parsedJson.frase || '').trim();
        }

        // Intento 2: Extracción estructurada por patrones si no fue JSON
        if (!entradilla && !texto) {
          let rawClean = stripAiMarkdown(cleaned);
          const fraseMatch = rawClean.match(/(?:frase destacada|cita|lema)[:\s*]+([^\n\r]+)/i);
          if (fraseMatch) {
            fraseDestacada = fraseMatch[1].replace(/^["'*]+|["'*]+$/g, '').trim();
            rawClean = rawClean.replace(/(?:frase destacada|cita|lema)[:\s*]+[^\n\r]+/i, '').trim();
          }

          const introPars = rawClean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
          if (introPars.length > 1) {
            entradilla = introPars[0];
            texto = introPars.slice(1).join('\n\n');
          } else if (introPars.length === 1) {
            entradilla = introPars[0];
            texto = introPars[0];
          }

          if (!fraseDestacada) {
            fraseDestacada = isCa
              ? `Serveis públics forts i drets garantits per a ${mun}.`
              : `Servicios públicos fuertes y derechos garantizados para ${mun}.`;
          }
        }

        const cleanTag = (str) => {
          if (!str) return '';
          return stripAiMarkdown(str)
            .replace(/^\[(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text|párrafo explicativo|pàrraf explicatiu)\]:?\s*/gim, '')
            .replace(/^(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text|párrafo explicativo|pàrraf explicatiu)[:\s*]+/gim, '')
            .replace(/^\d+[\.\)]\s*/, '')
            .replace(/^(?:Esta introducción|Aquesta introducció|Esta área|Aquesta àrea|En este apartado|En aquest apartat|En esta sección|En aquesta secció|A continuación|A continuació)[\s,:]+/i, '')
            .replace(/^["'*«»“”]+|["'*«»“”]+$/g, '')
            .trim();
        };

        entradilla = cleanTag(entradilla);
        texto = cleanTag(texto);
        fraseDestacada = cleanTag(fraseDestacada);

        const compositeIntro = [
          entradilla,
          (texto && texto !== entradilla) ? texto : ''
        ].filter(Boolean).join('\n\n') || cleaned;

        return {
          ok: true,
          data: {
            entradilla,
            texto,
            frase_destacada: fraseDestacada,
            introduccion: compositeIntro
          },
          entradilla,
          texto,
          frase_destacada: fraseDestacada,
          introduccion: compositeIntro,
          titulos: [],
          avisos: [],
          error: null,
          meta: {
            modelId: this.modelId,
            modelPath: this.modelPath,
            provider: 'LlamaCppProvider',
            operation: task,
            port: this.manager.port,
            pid: this.manager.process ? this.manager.process.pid : null,
            durationMs
          }
        };
      }

      if (task === 'redactar_cierre') {
        const parsedJson = extractJsonFromAi(cleaned);
        let cierreTitulo = '';
        let cierreParrafos = [];

        if (parsedJson && typeof parsedJson === 'object') {
          cierreTitulo = stripAiMarkdown(parsedJson.titulo || '').trim();
          if (Array.isArray(parsedJson.parrafos)) {
            cierreParrafos = parsedJson.parrafos.map(p => stripAiMarkdown(p).trim()).filter(Boolean);
          } else if (typeof parsedJson.parrafos === 'string') {
            cierreParrafos = parsedJson.parrafos.split(/\n\s*\n/).map(p => stripAiMarkdown(p).trim()).filter(Boolean);
          } else if (parsedJson.cuerpo || parsedJson.texto) {
            cierreParrafos = String(parsedJson.cuerpo || parsedJson.texto).split(/\n\s*\n/).map(p => stripAiMarkdown(p).trim()).filter(Boolean);
          }
        }

        // Fallback si no fue JSON
        if (cierreParrafos.length === 0) {
          const rawPars = stripAiMarkdown(cleaned).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
          if (rawPars.length > 0) {
            if (rawPars[0].length < 80 && !rawPars[0].endsWith('.')) {
              cierreTitulo = rawPars[0];
              cierreParrafos = rawPars.slice(1);
            } else {
              cierreParrafos = rawPars;
            }
          }
        }

        // Limpiar títulos prohibidos
        const forbiddenCierreTitles = /^(?:Cierre|Tancament|Conclusi[óo]n|Conclusió)[\s,:\.]*$/i;
        if (!cierreTitulo || forbiddenCierreTitles.test(cierreTitulo.trim())) {
          cierreTitulo = isCa
            ? `El nostre compromís amb ${mun}: fets, paraula i futur`
            : `Nuestro compromiso con ${mun}: hechos, palabra y futuro`;
        }
        cierreTitulo = cierreTitulo.replace(/^["'«»“]+|["'«»”\.\;]+$/g, '').trim();

        // Limpiar clichés de apertura en párrafos
        cierreParrafos = cierreParrafos.map(p => p
          .replace(/^(?:Concluimos este programa|En conclusión|Para finalizar|A modo de conclusión|Para terminar|Concloem aquest programa|En conclusió|Per finalitzar|A mode de cloenda|Per acabar)[\s,:]+/i, '')
          .trim()
        ).filter(Boolean);

        const cierreCuerpo = cierreParrafos.join('\n\n');

        const cierreData = {
          titulo: cierreTitulo,
          parrafos: cierreParrafos,
          cuerpo: cierreCuerpo,
          texto: cierreCuerpo
        };

        return {
          ok: true,
          data: cierreData,
          titulo: cierreTitulo,
          parrafos: cierreParrafos,
          cuerpo: cierreCuerpo,
          texto: cierreCuerpo,
          titulos: [],
          avisos: [],
          error: null,
          meta: {
            modelId: this.modelId,
            modelPath: this.modelPath,
            provider: 'LlamaCppProvider',
            operation: task,
            port: this.manager.port,
            pid: this.manager.process ? this.manager.process.pid : null,
            durationMs
          }
        };
      }

      if (task === 'traducir_texto_estructurado') {
        const parsedJson = extractJsonFromAi(cleaned);
        if (!parsedJson || typeof parsedJson !== 'object') {
          throw new Error('La traducción estructurada no devolvió un objeto JSON válido');
        }

        const cleanString = (val) => {
          if (typeof val !== 'string') return val;
          return stripAiMarkdown(val)
            .replace(/^\[(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text|párrafo explicativo|pàrraf explicatiu)\]:?\s*/gim, '')
            .replace(/^(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text|párrafo explicativo|pàrraf explicatiu)[:\s*]+/gim, '')
            .replace(/^["'*«»“”]+|["'*«»“”]+$/g, '')
            .trim();
        };

        const resultObj = {};
        for (const [key, val] of Object.entries(parsedJson)) {
          if (Array.isArray(val)) {
            resultObj[key] = val.map(item => cleanString(item)).filter(Boolean);
          } else if (typeof val === 'string') {
            resultObj[key] = cleanString(val);
          } else {
            resultObj[key] = val;
          }
        }

        if (resultObj.entradilla && Array.isArray(resultObj.parrafos)) {
          resultObj.cuerpo = resultObj.parrafos.join('\n\n');
          resultObj.texto = [resultObj.entradilla, resultObj.cuerpo].filter(Boolean).join('\n\n');
        } else if (resultObj.parrafos && Array.isArray(resultObj.parrafos)) {
          resultObj.cuerpo = resultObj.parrafos.join('\n\n');
          resultObj.texto = resultObj.cuerpo;
        } else if (resultObj.entradilla && resultObj.texto && resultObj.frase_destacada !== undefined) {
          resultObj.introduccion = [resultObj.entradilla, resultObj.texto].filter(Boolean).join('\n\n');
        }

        return {
          ok: true,
          data: resultObj,
          ...resultObj,
          titulos: [],
          avisos: [],
          error: null,
          meta: {
            modelId: this.modelId,
            modelPath: this.modelPath,
            provider: 'LlamaCppProvider',
            operation: task,
            port: this.manager.port,
            pid: this.manager.process ? this.manager.process.pid : null,
            durationMs
          }
        };
      }

      if (task === 'clasificar_bloques_estructurales') {
        const parsed = extractJsonFromAi(cleaned);
        let clasificaciones = [];
        if (Array.isArray(parsed)) {
          clasificaciones = parsed;
        } else if (parsed && Array.isArray(parsed.bloques)) {
          clasificaciones = parsed.bloques;
        } else if (parsed && Array.isArray(parsed.clasificaciones)) {
          clasificaciones = parsed.clasificaciones;
        }
        return {
          ok: true,
          data: { clasificaciones },
          clasificaciones,
          titulos: [],
          avisos: [],
          error: null,
          meta: {
            modelId: this.modelId,
            modelPath: this.modelPath,
            provider: 'LlamaCppProvider',
            operation: task,
            port: this.manager.port,
            pid: this.manager.process ? this.manager.process.pid : null,
            durationMs
          }
        };
      }

      // Para el resto: adaptar, traducir, mejorar, corregir, resumir, desarrollar
      const plainCleaned = stripAiMarkdown(cleaned);
      return {
        ok: true,
        data: { texto: plainCleaned },
        texto: plainCleaned,
        titulos: [],
        avisos: [],
        error: null,
        meta: {
          modelId: this.modelId,
          modelPath: this.modelPath,
          provider: 'LlamaCppProvider',
          operation: task,
          port: this.manager.port,
          pid: this.manager.process ? this.manager.process.pid : null,
          durationMs
        }
      };

    } catch (err) {
      const durationMs = Date.now() - startTime;
      const isTimeout = err.message && (err.message.includes('Tiempo de espera') || err.message.includes('TIMEOUT'));
      const isModelNotReady = err.message && (err.message.includes('no encontrado') || err.message.includes('servidor se cerró'));
      const errCode = isTimeout ? 'TIMEOUT' : (isModelNotReady ? 'MODEL_NOT_READY' : 'INFERENCE_ERROR');

      console.error(`[LlamaCppProvider] Error en inferencia local (${task}): ${err.message}`);

      return {
        ok: false,
        data: null,
        texto: null,
        titulos: [],
        avisos: [err.message],
        error: { code: errCode, message: err.message },
        meta: {
          modelId: this.modelId,
          modelPath: this.modelPath,
          provider: 'LlamaCppProvider',
          operation: task,
          durationMs
        }
      };
    }
  }
}

/**
 * BuiltinLocalAiEngine: Motor lingüístico determinista integrado
 */
class BuiltinLocalAiEngine extends BaseAiProvider {
  constructor() {
    super('BuiltinLocalAiEngine');
  }

  async isAvailable() {
    return true;
  }

  async testConnection() {
    return { ok: true, success: true, message: 'Motor integrado de procesamiento lingüístico verificado.', response: 'OK' };
  }

  async generate(task, promptConfig, options = {}) {
    if(require('../../../shared/writingContract').MIN_SELECTED[task])return require('./builtinWriting').generate(task,promptConfig);
    const startTime = Date.now();
    const lang = promptConfig.idioma_salida || promptConfig.idioma || 'es';
    const isCa = lang === 'ca';
    let textoResult = '';
    let titulosResult = [];

    switch (task) {
      case 'adaptar_medida': {
        const orig = promptConfig.texto || promptConfig.texto_original || promptConfig.texto_actual || '';
        const mun = promptConfig.municipio || (isCa ? 'el nostre municipi' : 'nuestro municipio');
        let adapted = orig.trim();
        if (isCa) {
          adapted = adapted
            .replace(/^Crear\b/i, `Crearem a ${mun}`)
            .replace(/^Fomentar\b/i, `Fomentarem des de l'Ajuntament de ${mun}`)
            .replace(/^Garantizar\b/i, `Garantirem a ${mun}`)
            .replace(/^Impulsar\b/i, `Impulsarem a ${mun}`)
            .replace(/^Promover\b/i, `Promourem a ${mun}`)
            .replace(/^Desarrollar\b/i, `Desenvoluparem a ${mun}`)
            .replace(/^Aprobar\b/i, `Aprovarem des del govern municipal de ${mun}`)
            .replace(/^Establecer\b/i, `Establirem a ${mun}`)
            .replace(/^Revisar\b/i, `Revisarem a ${mun}`);
          if (!adapted.toLowerCase().includes(mun.toLowerCase())) {
            adapted = `${adapted} en l'àmbit municipal de ${mun}.`;
          }
        } else {
          adapted = adapted
            .replace(/^Crear\b/i, `Crearemos en ${mun}`)
            .replace(/^Fomentar\b/i, `Fomentaremos desde el Ayuntamiento de ${mun}`)
            .replace(/^Garantizar\b/i, `Garantizaremos en ${mun}`)
            .replace(/^Impulsar\b/i, `Impulsaremos en ${mun}`)
            .replace(/^Promover\b/i, `Promoveremos en ${mun}`)
            .replace(/^Desarrollar\b/i, `Desarrollaremos en ${mun}`)
            .replace(/^Aprobar\b/i, `Aprobaremos desde el gobierno municipal de ${mun}`)
            .replace(/^Establecer\b/i, `Estableceremos en ${mun}`)
            .replace(/^Revisar\b/i, `Revisaremos en ${mun}`);
          if (!adapted.toLowerCase().includes(mun.toLowerCase())) {
            adapted = `${adapted} en el término municipal de ${mun}.`;
          }
        }
        textoResult = adapted;
        break;
      }

      case 'desarrollar_medida': {
        const current = promptConfig.texto || promptConfig.texto_actual || promptConfig.texto_original || '';
        const mun = promptConfig.municipio || (isCa ? 'el municipi' : 'el municipio');
        if (isCa) {
          textoResult = `${current.trim()} Aquesta actuació es durà a terme amb la participació del veïnat de ${mun}, prioritzant la transparència i una gestió pública eficient al servei de la comunitat.`;
        } else {
          textoResult = `${current.trim()} Esta actuación se llevará a cabo con la participación activa de los vecinos y vecinas de ${mun}, priorizando la transparencia y una gestión pública eficiente al servicio de la comunidad.`;
        }
        break;
      }

      case 'mejorar_redaccion': {
        const text = promptConfig.texto || promptConfig.texto_actual || promptConfig.texto_original || '';
        let improved = text.trim()
          .replace(/\s+/g, ' ')
          .replace(/,\s*,/g, ',')
          .replace(/\.\s*\./g, '.');
        if (!/[.!?]$/.test(improved)) improved += '.';
        textoResult = improved;
        break;
      }

      case 'corregir_texto': {
        const text = promptConfig.texto || promptConfig.texto_actual || promptConfig.texto_original || '';
        let corrected = text.trim()
          .replace(/\s+/g, ' ')
          .replace(/\s+([,.:;!?])/g, '$1')
          .replace(/([,.:;!?])([A-Za-zÀ-ÿ])/g, '$1 $2');
        if (isCa) {
          corrected = corrected.replace(/\bl['']\s+/gi, "l'").replace(/\bd['']\s+/gi, "d'");
        }
        if (!/[.!?]$/.test(corrected)) corrected += '.';
        textoResult = corrected;
        break;
      }

      case 'resumir_texto': {
        const text = promptConfig.texto || promptConfig.texto_actual || promptConfig.texto_original || '';
        const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
        textoResult = sentences.slice(0, 2).join(' ') || text.trim();
        break;
      }

      case 'sugerir_titulos': {
        const text = promptConfig.texto || promptConfig.texto_actual || promptConfig.texto_original || '';
        const clean = text.replace(/^(Impulsaremos|Crearemos|Garantizaremos|Fomentaremos|Impulsarem|Crearem|Garantirem|Fomentarem)\s+/i, '');
        const words = clean.split(/\s+/).slice(0, 8).join(' ');

        let t1 = '', t2 = '', t3 = '';
        if (isCa) {
          t1 = `Impuls a ${words}`.trim();
          t2 = `Pla municipal per a ${words}`.trim();
          t3 = `Garantia pública de ${words}`.trim();
        } else {
          t1 = `Impulso a ${words}`.trim();
          t2 = `Plan municipal para ${words}`.trim();
          t3 = `Garantía pública de ${words}`.trim();
        }
        titulosResult = [t1, t2, t3];
        textoResult = `${t1}\n${t2}\n${t3}`;
        break;
      }

      case 'traducir_texto': {
        const text = promptConfig.texto || promptConfig.texto_actual || promptConfig.texto_original || '';
        const deLang = promptConfig.de || promptConfig.from || (isCa ? 'es' : 'ca');
        const aLang = promptConfig.a || promptConfig.to || promptConfig.idioma_destino || (deLang === 'ca' ? 'es' : 'ca');
        textoResult = translateText(text, deLang, aLang);
        break;
      }

      case 'traducir_texto_estructurado': {
        const srcObj = promptConfig.objeto || promptConfig.sourceObject || promptConfig.datos || promptConfig.data || {};
        const deLang = promptConfig.de || promptConfig.from || 'es';
        const aLang = promptConfig.a || promptConfig.to || promptConfig.idioma_destino || (deLang === 'ca' ? 'es' : 'ca');
        const resObj = translateStructured(srcObj, deLang, aLang);
        const durationMs = Date.now() - startTime;
        return {
          ok: true,
          data: resObj,
          ...resObj,
          titulos: [],
          avisos: [],
          error: null,
          meta: { provider: 'BuiltinLocalAiEngine', operation: task, durationMs }
        };
      }

      case 'redactar_presentacion': {
        const mun = promptConfig.municipio || (isCa ? 'el nostre municipi' : 'nuestro municipio');
        const org = promptConfig.organizacion || (isCa ? 'Podem' : 'Podemos');
        const lema = getLema(promptConfig, lang) || '';
        const mandato = promptConfig.mandato || '2027–2031';
        const titulo = isCa
          ? `Un projecte comú per a ${mun}: serveis públics i drets garantits`
          : `Un proyecto común para ${mun}: servicios públicos y derechos garantizados`;
        const entradilla = isCa
          ? `Governar un municipi també és decidir què es prioritza en el dia a dia per a la majoria social.`
          : `Gobernar un municipio también es decidir qué se prioriza en el día a día para la mayoría social.`;
        const parrafos = isCa
          ? [
              `Presentem a les veïnes i veïns de ${mun} aquest programa electoral per al mandat ${mandato}, elaborat des dels barris i pensant en els problemes reals de la gent corrent.${lema ? ` Ho fem sota el lema "${lema}".` : ''}`,
              `Al llarg d'aquestes pàgines no proposem promeses buides ni frases fetes, sinó compromisos concrets: recuperar i blindar la gestió pública directa dels serveis essencials, defensar el dret a un habitatge digne i assegurar recursos suficients a cada barri.`,
              `Un programa electoral és un contracte democràtic i un compromís de retiment de comptes. Davant la resignació, plantegem solucions viables i una forma propera i honesta de governar amb i per a la ciutadania.`
            ]
          : [
              `Presentamos a las vecinas y vecinos de ${mun} este programa electoral para el mandato ${mandato}, elaborado desde los barrios y pensando en los problemas reales de la gente corriente.${lema ? ` Lo hacemos bajo el lema "${lema}".` : ''}`,
              `A lo largo de estas páginas no proponemos promesas vacías ni frases hechas, sino compromisos concretos: recuperar y blindar la gestión pública directa de los servicios esenciales, defender el derecho a una vivienda digna y asegurar recursos suficientes en cada barrio.`,
              `Un programa electoral es un contrato democrático y un compromiso de rendición de cuentas. Frente a la resignación, planteamos soluciones viables y una forma cercana y honesta de gobernar con y para la ciudadanía.`
            ];
        const cuerpo = parrafos.join('\n\n');
        const texto = [entradilla, cuerpo].join('\n\n');
        const durationMs = Date.now() - startTime;
        return {
          ok: true,
          data: { titulo, entradilla, parrafos, cuerpo, texto },
          titulo,
          entradilla,
          parrafos,
          cuerpo,
          texto,
          titulos: [],
          avisos: [],
          error: null,
          meta: { provider: 'BuiltinLocalAiEngine', operation: task, durationMs }
        };
      }

      case 'redactar_introduccion_area': {
        const mun = promptConfig.municipio || (isCa ? 'el municipi' : 'el municipio');
        const entradilla = isCa
          ? `Els serveis públics i la vida quotidiana als barris de ${mun} són la nostra prioritat.`
          : `Los servicios públicos y la vida cotidiana en los barrios de ${mun} son nuestra prioridad.`;
        const cuerpo = isCa
          ? `En aquest bloc establim prioritats clares davant dels problemes reals que afecten el veïnat. Expliquem amb transparència quines solucions municipals proposem: gestió pública directa, suficiència de recursos als barris i compromisos concrets que es puguin avaluar carrer a carrer.`
          : `En este bloque establecemos prioridades claras frente a los problemas reales que afectan al vecindario. Explicamos con transparencia qué soluciones municipales proponemos: gestión pública directa, suficiencia de recursos en los barrios y compromisos concretos que se puedan evaluar calle a calle.`;
        const frase = isCa
          ? `Garantir serveis públics de qualitat i drets a cada barri de ${mun}.`
          : `Garantizar servicios públicos de calidad y derechos en cada barrio de ${mun}.`;

        const durationMs = Date.now() - startTime;
        return {
          ok: true,
          data: {
            entradilla,
            texto: cuerpo,
            frase_destacada: frase,
            introduccion: `${entradilla}\n\n${cuerpo}`
          },
          entradilla,
          texto: cuerpo,
          frase_destacada: frase,
          introduccion: `${entradilla}\n\n${cuerpo}`,
          titulos: [],
          avisos: [],
          error: null,
          meta: {
            provider: 'BuiltinLocalAiEngine',
            operation: task,
            durationMs
          }
        };
      }

      case 'sugerir_frase_destacada': {
        const mun = promptConfig.municipio || '';
        if (isCa) {
          textoResult = `Serveis públics forts i drets garantits a cada barri${mun ? ` de ${mun}` : ''}.`;
        } else {
          textoResult = `Servicios públicos fuertes y derechos garantizados en cada barrio${mun ? ` de ${mun}` : ''}.`;
        }
        break;
      }

      case 'redactar_cierre': {
        const mun = promptConfig.municipio || (isCa ? 'el nostre municipi' : 'nuestro municipio');
        const org = promptConfig.organizacion || 'Podemos';
        const lema = getLema(promptConfig, lang) || '';
        const titulo = isCa
          ? `El nostre compromís amb ${mun}: fets, paraula i futur`
          : `Nuestro compromiso con ${mun}: hechos, palabra y futuro`;
        const parrafos = isCa
          ? [
              `Aquest programa electoral és un compromís públic i verificable amb les veïnes i veïns de ${mun}. Governar també és triar quines prioritats es defensen quan els recursos són limitats, i les nostres són als barris, als serveis públics i a la garantia de drets per a la majoria social.`,
              `No demanem confiança a cegues: proposem un contracte democràtic per retre comptes sobre cada decisió i demostrar que una altra forma de fer política municipal és possible i necessària.${lema ? `\n\n${lema}` : ''}`
            ]
          : [
              `Este programa electoral es un compromiso público y verificable con las vecinas y vecinos de ${mun}. Gobernar también es elegir qué prioridades se defienden cuando los recursos son limitados, y las nuestras están en los barrios, en los servicios públicos y en la garantía de derechos para la mayoría social.`,
              `No pedimos confianza a ciegas: proponemos un contrato democrático para rendir cuentas sobre cada decisión y demostrar que otra forma de hacer política municipal es posible y necesaria.${lema ? `\n\n${lema}` : ''}`
            ];
        const cuerpo = parrafos.join('\n\n');
        const durationMs = Date.now() - startTime;
        return {
          ok: true,
          data: { titulo, parrafos, cuerpo, texto: cuerpo },
          titulo,
          parrafos,
          cuerpo,
          texto: cuerpo,
          titulos: [],
          avisos: [],
          error: null,
          meta: { provider: 'BuiltinLocalAiEngine', operation: task, durationMs }
        };
      }

      case 'clasificar_bloques_estructurales': {
        const blocks = promptConfig.blocks || [];
        const clasificaciones = blocks.map(b => ({
          id: b.id,
          tipo: b.headingLevel === 1 ? 'AREA' : (b.isList ? 'MEDIDA' : 'CONTENIDO_GENERAL')
        }));
        const durationMs = Date.now() - startTime;
        return {
          ok: true,
          data: { clasificaciones },
          clasificaciones,
          titulos: [],
          avisos: [],
          error: null,
          meta: { provider: 'BuiltinLocalAiEngine', operation: task, durationMs }
        };
      }

      default:
        textoResult = promptConfig.texto || '';
    }

    const durationMs = Date.now() - startTime;
    return {
      ok: true,
      data: {
        texto: textoResult,
        titulos: titulosResult
      },
      texto: textoResult,
      titulos: titulosResult,
      avisos: [],
      error: null,
      meta: {
        provider: 'BuiltinLocalAiEngine',
        operation: task,
        durationMs
      }
    };
  }

  translateBilingualText(text, targetLang) {
    if (!text) return '';
    const toLang = targetLang === 'ca' ? 'ca' : 'es';
    const fromLang = toLang === 'ca' ? 'es' : 'ca';
    return translateText(text, fromLang, toLang);
  }
}

module.exports = {
  BaseAiProvider,
  LlamaServerManager,
  serverManager,
  LlamaCppProvider,
  BuiltinLocalAiEngine,
  TASK_TOKEN_LIMITS,
  MAX_LOG_FILE_BYTES,
  MAX_LOG_BACKUPS,
  rotateLlamaServerLog,
  sanitizeLlamaLogChunk
};
