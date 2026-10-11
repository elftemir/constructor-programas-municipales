/**
 * updateService.js - Servicio de Actualización de la Aplicación (Fase 3.4A)
 * Constructor de Programas Municipales Podemos
 *
 * Gestiona de forma segura el ciclo de vida de electron-updater en el proceso Main:
 * - autoDownload = false (el usuario decide cuándo descargar)
 * - autoInstallOnAppQuit = false (el usuario decide cuándo reiniciar e instalar)
 * - allowPrerelease = false
 * - allowDowngrade = false
 * - Sanitización estricta a texto plano de las notas de versión (releaseNotes)
 */

const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const UPDATE_STATES = Object.freeze({
  IDLE: 'IDLE',
  CHECKING: 'CHECKING',
  UPDATE_AVAILABLE: 'UPDATE_AVAILABLE',
  NO_UPDATE: 'NO_UPDATE',
  DOWNLOADING: 'DOWNLOADING',
  DOWNLOADED: 'DOWNLOADED',
  ERROR: 'ERROR'
});

/**
 * Convierte cualquier contenido de releaseNotes procedente de GitHub Releases
 * en texto plano seguro, eliminando etiquetas HTML, scripts, estilos y enlaces.
 */
function sanitizeReleaseNotes(rawNotes) {
  if (rawNotes === null || rawNotes === undefined) return '';

  let combined = '';
  if (typeof rawNotes === 'string') {
    combined = rawNotes;
  } else if (Array.isArray(rawNotes)) {
    combined = rawNotes
      .map(entry => {
        if (!entry) return '';
        if (typeof entry === 'string') return entry;
        if (typeof entry === 'object') {
          const ver = entry.version ? `v${String(entry.version).trim()}\n` : '';
          const note = entry.note ? String(entry.note) : '';
          return `${ver}${note}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  } else if (typeof rawNotes === 'object') {
    combined = rawNotes.note ? String(rawNotes.note) : '';
  }

  if (!combined) return '';

  let text = combined
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|blockquote)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<[^>]+>/g, '');

  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length > 4000) {
    text = text.slice(0, 4000).trim() + '…';
  }

  return text;
}

function classifyUpdaterError(err, wasDownloading = false) {
  const rawMsg = String(err && err.message ? err.message : err || 'Error desconocido');
  const lower = rawMsg.toLowerCase();

  if (wasDownloading) {
    return {
      code: 'DOWNLOAD_ERROR',
      userMessageEs: 'No se ha podido descargar la actualización. Puedes seguir utilizando la aplicación e intentarlo de nuevo más tarde.',
      userMessageCa: 'No s\'ha pogut baixar l\'actualització. Pots continuar utilitzant l\'aplicació i tornar-ho a provar més tard.',
      technicalError: rawMsg.slice(0, 300)
    };
  }

  if (
    lower.includes('404') ||
    lower.includes('cannot find latest.yml') ||
    lower.includes('unable to find latest version on github') ||
    lower.includes('no published versions on github') ||
    lower.includes('atom') ||
    lower.includes('releases.atom')
  ) {
    return {
      code: 'NO_REMOTE_RELEASE',
      userMessageEs: 'No se ha podido comprobar si hay actualizaciones (el repositorio oficial aún no tiene versiones publicadas o no está disponible).',
      userMessageCa: 'No s\'ha pogut comprovar si hi ha actualitzacions (el repositori oficial encara no té versions publicades o no està disponible).',
      technicalError: rawMsg.slice(0, 300)
    };
  }

  if (
    lower.includes('net::') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('eai_again') ||
    lower.includes('socket hang up') ||
    lower.includes('network')
  ) {
    return {
      code: 'NETWORK_ERROR',
      userMessageEs: 'No se ha podido conectar con el servidor de actualizaciones. Comprueba tu conexión a Internet.',
      userMessageCa: 'No s\'ha pogut connectar amb el servidor d\'actualitzacions. Comprova la teva connexió a Internet.',
      technicalError: rawMsg.slice(0, 300)
    };
  }

  return {
    code: 'CHECK_ERROR',
    userMessageEs: 'No se ha podido comprobar el estado de las actualizaciones en este momento.',
    userMessageCa: 'No s\'ha pogut comprovar l\'estat de les actualitzacions en aquest moment.',
    technicalError: rawMsg.slice(0, 300)
  };
}

class UpdateService {
  constructor() {
    const pkg = require('../../../package.json');
    this.currentVersion = pkg.version || '3.4.0';
    this.listeners = new Set();
    this.autoCheckScheduled = false;
    this.explicitTestMode = false;
    this.userAuthorizedUpdate = false;
    this.beforeQuitHook = null;

    this.state = {
      status: UPDATE_STATES.IDLE,
      currentVersion: this.currentVersion,
      availableVersion: null,
      releaseDate: null,
      releaseNotes: '',
      progress: null,
      error: null,
      errorCa: null,
      errorCode: null,
      technicalError: null,
      isPackaged: this.isPackagedApp(),
      checkedAt: null,
      lastCheckSource: null,
      silent: false
    };

    this.configureAutoUpdater();
  }

  setBeforeQuitHook(hookFn) {
    if (typeof hookFn === 'function') {
      this.beforeQuitHook = hookFn;
    }
  }

  isPackagedApp() {
    return Boolean(app && app.isPackaged);
  }

  configureAutoUpdater() {
    // Seguridad explícita del actualizador (Sección 6)
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.disableWebInstaller = true;

    // Logger técnico controlado en Main
    autoUpdater.logger = {
      info: (msg) => console.log('[AutoUpdater]', msg),
      warn: (msg) => console.warn('[AutoUpdater]', msg),
      error: (msg) => console.warn('[AutoUpdater:Error]', msg),
      debug: () => {}
    };

    autoUpdater.on('checking-for-update', () => {
      this.updateState({
        status: UPDATE_STATES.CHECKING,
        error: null,
        errorCa: null,
        errorCode: null,
        technicalError: null
      });
    });

    autoUpdater.on('update-available', (info) => {
      const nextVer = info && info.version ? String(info.version).trim() : null;
      const safeNotes = sanitizeReleaseNotes(info ? info.releaseNotes : '');
      const relDate = info && info.releaseDate ? String(info.releaseDate) : null;

      this.updateState({
        status: UPDATE_STATES.UPDATE_AVAILABLE,
        availableVersion: nextVer,
        releaseDate: relDate,
        releaseNotes: safeNotes,
        progress: null,
        error: null,
        errorCa: null,
        errorCode: null,
        technicalError: null,
        checkedAt: new Date().toISOString(),
        // Cuando hay actualización disponible, debe mostrarse al usuario aunque el check fuera automático
        silent: false
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.updateState({
        status: UPDATE_STATES.NO_UPDATE,
        availableVersion: null,
        releaseDate: null,
        releaseNotes: '',
        progress: null,
        error: null,
        errorCa: null,
        errorCode: null,
        technicalError: null,
        checkedAt: new Date().toISOString()
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.max(0, Math.min(100, Math.round(Number(progressObj?.percent || 0))));
      this.updateState({
        status: UPDATE_STATES.DOWNLOADING,
        progress: {
          percent,
          transferred: Number(progressObj?.transferred || 0),
          total: Number(progressObj?.total || 0),
          bytesPerSecond: Number(progressObj?.bytesPerSecond || 0)
        },
        error: null,
        errorCa: null,
        errorCode: null,
        silent: false
      });
    });

    autoUpdater.on('update-downloaded', (event) => {
      const nextVer = event && event.version ? String(event.version).trim() : this.state.availableVersion;
      const safeNotes = event && event.releaseNotes
        ? sanitizeReleaseNotes(event.releaseNotes)
        : this.state.releaseNotes;

      this.updateState({
        status: UPDATE_STATES.DOWNLOADED,
        availableVersion: nextVer,
        releaseNotes: safeNotes,
        progress: {
          percent: 100,
          transferred: this.state.progress?.total || 0,
          total: this.state.progress?.total || 0,
          bytesPerSecond: 0
        },
        error: null,
        errorCa: null,
        errorCode: null,
        technicalError: null,
        silent: false
      });

      if (this.userAuthorizedUpdate) {
        this.userAuthorizedUpdate = false;
        this.installDownloadedUpdate(this.beforeQuitHook).catch((err) => {
          console.warn('[UpdateService] Error al iniciar instalación automática tras descarga:', err && err.message ? err.message : err);
        });
      }
    });

    autoUpdater.on('error', (err) => {
      const wasDownloading = this.state.status === UPDATE_STATES.DOWNLOADING || this.userAuthorizedUpdate;
      this.userAuthorizedUpdate = false;
      const classified = classifyUpdaterError(err, wasDownloading);
      console.warn(`[UpdateService] Error (${classified.code}): ${classified.technicalError}`);

      this.updateState({
        status: UPDATE_STATES.ERROR,
        progress: null,
        error: classified.userMessageEs,
        errorCa: classified.userMessageCa,
        errorCode: classified.code,
        technicalError: classified.technicalError,
        checkedAt: new Date().toISOString()
      });
    });
  }

  /**
   * Permite activar de forma explícita y controlada la configuración de prueba local
   * (exclusivamente para pruebas técnicas; nunca activo por defecto en producción).
   */
  enableExplicitTestConfig(updateConfigFilePath) {
    if (!updateConfigFilePath || typeof updateConfigFilePath !== 'string') {
      throw new Error('Ruta de configuración de prueba no válida');
    }
    const resolved = path.resolve(updateConfigFilePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error('El archivo app-update.yml de prueba no existe');
    }
    this.explicitTestMode = true;
    autoUpdater.updateConfigPath = resolved;
    autoUpdater.forceDevUpdateConfig = true;
  }

  getUpdaterConfigurationSnapshot() {
    return {
      autoDownload: autoUpdater.autoDownload,
      autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit,
      allowPrerelease: autoUpdater.allowPrerelease,
      allowDowngrade: autoUpdater.allowDowngrade,
      disableWebInstaller: autoUpdater.disableWebInstaller,
      currentVersion: this.currentVersion,
      isPackaged: this.isPackagedApp(),
      explicitTestMode: this.explicitTestMode
    };
  }

  onStatusChange(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  updateState(patch) {
    this.state = {
      ...this.state,
      ...patch,
      isPackaged: this.isPackagedApp()
    };
    const snapshot = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (e) {
        console.warn('[UpdateService] Error notificando listener:', e.message);
      }
    }
    return snapshot;
  }

  getStatus() {
    return {
      ...this.state,
      progress: this.state.progress ? { ...this.state.progress } : null
    };
  }

  /**
   * Programa una única comprobación automática asíncrona tras el arranque.
   * No se ejecuta en modo desarrollo (app.isPackaged === false).
   */
  scheduleStartupCheck(delayMs = 4000) {
    if (this.autoCheckScheduled) return;
    this.autoCheckScheduled = true;

    if (!this.isPackagedApp()) {
      console.log('[UpdateService] Modo desarrollo detectado (app.isPackaged = false): comprobación automática al inicio omitida.');
      return;
    }

    const timer = setTimeout(() => {
      this.checkForUpdates({ silent: true, source: 'auto' }).catch((err) => {
        console.warn('[UpdateService] Fallo controlado en comprobación automática:', err && err.message ? err.message : err);
      });
    }, delayMs);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  async checkForUpdates(options = {}) {
    const isAuto = options && options.source === 'auto';
    const silent = Boolean(options && options.silent);

    if (
      this.state.status === UPDATE_STATES.CHECKING ||
      this.state.status === UPDATE_STATES.DOWNLOADING
    ) {
      return this.getStatus();
    }

    if (!this.isPackagedApp() && !this.explicitTestMode) {
      if (isAuto) {
        return this.getStatus();
      }
      return this.updateState({
        status: UPDATE_STATES.ERROR,
        lastCheckSource: 'manual',
        silent: false,
        error: 'La comprobación de actualizaciones solo está activa en la versión instalada de la aplicación.',
        errorCa: 'La comprovació d\'actualitzacions només està activa en la versió instal·lada de l\'aplicació.',
        errorCode: 'DEV_MODE_UNPACKAGED',
        technicalError: 'app.isPackaged is false',
        checkedAt: new Date().toISOString()
      });
    }

    this.updateState({
      status: UPDATE_STATES.CHECKING,
      lastCheckSource: isAuto ? 'auto' : 'manual',
      silent,
      error: null,
      errorCa: null,
      errorCode: null,
      technicalError: null
    });

    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      if (this.state.status !== UPDATE_STATES.ERROR) {
        const classified = classifyUpdaterError(err, false);
        this.updateState({
          status: UPDATE_STATES.ERROR,
          progress: null,
          error: classified.userMessageEs,
          errorCa: classified.userMessageCa,
          errorCode: classified.code,
          technicalError: classified.technicalError,
          checkedAt: new Date().toISOString()
        });
      }
    }

    return this.getStatus();
  }

  async downloadUpdate() {
    if (this.state.status === UPDATE_STATES.DOWNLOADING) {
      return this.getStatus();
    }

    if (
      this.state.status !== UPDATE_STATES.UPDATE_AVAILABLE &&
      !(this.state.status === UPDATE_STATES.ERROR && this.state.availableVersion)
    ) {
      throw new Error('No hay ninguna actualización pendiente de descarga en este momento.');
    }

    this.userAuthorizedUpdate = true;

    this.updateState({
      status: UPDATE_STATES.DOWNLOADING,
      silent: false,
      progress: {
        percent: 0,
        transferred: 0,
        total: 0,
        bytesPerSecond: 0
      },
      error: null,
      errorCa: null,
      errorCode: null,
      technicalError: null
    });

    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      this.userAuthorizedUpdate = false;
      if (this.state.status !== UPDATE_STATES.ERROR) {
        const classified = classifyUpdaterError(err, true);
        this.updateState({
          status: UPDATE_STATES.ERROR,
          progress: null,
          error: classified.userMessageEs,
          errorCa: classified.userMessageCa,
          errorCode: classified.code,
          technicalError: classified.technicalError
        });
      }
    }

    return this.getStatus();
  }

  async installDownloadedUpdate(beforeQuitHook) {
    if (this.state.status !== UPDATE_STATES.DOWNLOADED) {
      throw new Error('La actualización aún no se ha descargado por completo.');
    }

    const hookToRun = typeof beforeQuitHook === 'function' ? beforeQuitHook : this.beforeQuitHook;
    if (typeof hookToRun === 'function') {
      try {
        await hookToRun();
      } catch (e) {
        console.warn('[UpdateService] Aviso en beforeQuitHook previo a instalar actualización:', e.message);
      }
    }

    setImmediate(() => {
      autoUpdater.quitAndInstall(true, true);
    });

    return { ok: true };
  }
}

const updateService = new UpdateService();

module.exports = {
  updateService,
  UpdateService,
  UPDATE_STATES,
  sanitizeReleaseNotes,
  classifyUpdaterError
};
