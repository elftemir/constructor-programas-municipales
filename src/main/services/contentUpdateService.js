/**
 * contentUpdateService.js - Servicio Seguro de Actualizaciones de Contenidos (Fase 3.4B)
 *
 * Sistema independiente del actualizador de aplicación (electron-updater).
 * Gestiona la consulta de catalog.json, detección de Programas Marco nuevos o actualizados,
 * descarga autorizada con validación estricta de origen y redirects, verificación SHA-256
 * externa e interna, validación anti-Zip-Slip / anti-Zip-Bomb, alineación bilingüe ES/CA
 * por identificadores canónicos (area_id / measure_id) e instalación transaccional en SQLite.
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const JSZip = require('jszip');
const { getDb, save } = require('../db/database');
const { getUserDataDir, isPathInside } = require('../utils/paths');

let electronApp = null;
try {
  const electron = require('electron');
  electronApp = electron.app;
} catch (e) {
  electronApp = null;
}

const OFFICIAL_CATALOG_URL = 'https://raw.githubusercontent.com/elftemir/constructor-programas-municipales-content/main/catalog.json';
const EXPECTED_REPO_PREFIX = '/elftemir/constructor-programas-municipales-content/releases/download/';
const EXPECTED_ASSET_REDIRECT_PREFIX = '/github-production-release-asset/';

// Whitelist mínima de hosts observados realmente en producción (Sección 14)
const ALLOWED_CATALOG_HOSTS = new Set([
  'raw.githubusercontent.com'
]);

const ALLOWED_PACKAGE_HOSTS = new Set([
  'github.com',
  'release-assets.githubusercontent.com'
]);

const MAX_REDIRECTS = 3;
const HTTP_TIMEOUT_MS = 25000;
const MAX_CATALOG_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_ZIP_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_ZIP_ENTRIES = 10;
const MAX_UNCOMPRESSED_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_JSON_ENTRY_BYTES = 10 * 1024 * 1024; // 10 MB

const CONTENT_UPDATE_STATES = {
  IDLE: 'IDLE',
  CHECKING: 'CHECKING',
  UP_TO_DATE: 'UP_TO_DATE',
  AVAILABLE: 'AVAILABLE',
  DOWNLOADING: 'DOWNLOADING',
  VERIFYING: 'VERIFYING',
  INSTALLING: 'INSTALLING',
  INSTALLED: 'INSTALLED',
  INCOMPATIBLE: 'INCOMPATIBLE',
  ERROR: 'ERROR'
};

const SAFE_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9\-_]{1,120}$/;
const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
const SHA256_REGEX = /^[a-fA-F0-9]{64}$/;

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function sanitizeUntrustedJson(value, depth = 0) {
  if (depth > 15) {
    throw new Error('Estructura JSON excede la profundidad máxima permitida');
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 5000) {
      throw new Error('Lista JSON excede el número máximo de elementos permitido');
    }
    return value.map((item) => sanitizeUntrustedJson(item, depth + 1));
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error('Objeto JSON con prototipo no permitido');
  }
  const clean = {};
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    clean[key] = sanitizeUntrustedJson(value[key], depth + 1);
  }
  return clean;
}

function sanitizePlainText(val, maxLen = 2000) {
  if (val === null || val === undefined) return '';
  const str = String(val)
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function compareSemver(vA, vB) {
  const cleanA = String(vA || '0.0.0').trim().replace(/^v/i, '');
  const cleanB = String(vB || '0.0.0').trim().replace(/^v/i, '');
  const mA = cleanA.match(SEMVER_REGEX);
  const mB = cleanB.match(SEMVER_REGEX);
  if (!mA || !mB) return 0;
  for (let i = 1; i <= 3; i++) {
    const nA = parseInt(mA[i], 10);
    const nB = parseInt(mB[i], 10);
    if (nA > nB) return 1;
    if (nA < nB) return -1;
  }
  return 0;
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
}

function isSafeRelativeZipPath(relPath, allowedExt) {
  if (!relPath || typeof relPath !== 'string') return false;
  if (relPath.length > 200) return false;
  if (/[\x00-\x1f\x7f]/.test(relPath)) return false;
  if (relPath.includes('\\')) return false;
  if (relPath.startsWith('/') || relPath.endsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(relPath)) return false;
  if (relPath.includes('..')) return false;
  const parts = relPath.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) return false;
  if (allowedExt && !relPath.toLowerCase().endsWith(allowedExt.toLowerCase())) return false;
  return true;
}

function isZipEntrySymlink(zipEntry) {
  if (!zipEntry) return false;
  if (typeof zipEntry.unixPermissions === 'number') {
    const fileType = zipEntry.unixPermissions & 0o170000;
    if (fileType === 0o120000) return true;
  }
  return false;
}

class ContentUpdateService {
  constructor() {
    const pkg = require('../../../package.json');
    this.appVersion = pkg.version || '3.4.0';
    this.catalogUrl = OFFICIAL_CATALOG_URL;
    this.listeners = new Set();
    this.autoCheckScheduled = false;
    this.validatedCatalogMap = new Map();
    this.bootstrapPromise = null;
    this.bootstrapAttempted = false;
    this.bootstrapResult = { status: 'EMPTY' };
    this.catalogCheckPromise = null;

    this.state = {
      status: CONTENT_UPDATE_STATES.IDLE,
      appVersion: this.appVersion,
      catalogVersion: null,
      checkedAt: null,
      lastCheckSource: null,
      silent: false,
      availableItems: [],
      installedItems: [],
      activeDownloadId: null,
      progress: null,
      lastInstalledItem: null,
      error: null,
      errorCa: null,
      errorCode: null,
      technicalError: null
    };
  }

  isPackagedApp() {
    return Boolean(electronApp && electronApp.isPackaged);
  }

  allowsTestContent() {
    return !this.isPackagedApp() && process.env.CPM_ALLOW_TEST_CONTENT === '1';
  }

  getCacheFilePath() {
    try {
      const dir = path.join(getUserDataDir(), 'content-updates');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return path.join(dir, 'catalog_cache.json');
    } catch (e) {
      return null;
    }
  }

  saveCatalogCacheSnapshot(catalogData) {
    try {
      const cachePath = this.getCacheFilePath();
      if (!cachePath) return;
      fs.writeFileSync(
        cachePath,
        JSON.stringify({ cachedAt: new Date().toISOString(), catalog: catalogData }, null, 2),
        'utf8'
      );
    } catch (e) {}
  }

  onStatusChange(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    return () => {};
  }

  emitStatus() {
    const snapshot = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (e) {
        console.warn('[ContentUpdateService] Error notificando listener:', e.message);
      }
    }
  }

  updateState(patch) {
    this.state = {
      ...this.state,
      ...patch
    };
    this.emitStatus();
    return this.getStatus();
  }

  getStatus() {
    return JSON.parse(JSON.stringify({ ...this.state, testContentEnabled: this.allowsTestContent() }));
  }

  async getTestContentItems() {
    if (!this.allowsTestContent()) return [];
    if (!this.validatedCatalogMap.size) await this.checkForContentUpdates({ silent: true, source: 'test_browser' });
    return [...this.validatedCatalogMap.values()].filter(item => item.official !== true || item.is_test_fixture === true)
      .map(item => ({ ...item, compatible_with_app: compareSemver(this.appVersion, item.min_app_version) >= 0 }));
  }

  async bootstrapOfficialContent(force = false) {
    if (this.bootstrapPromise) return this.bootstrapPromise;
    this.bootstrapPromise = this.bootstrapOfficialContentOnce(force).finally(() => { this.bootstrapPromise = null; });
    return this.bootstrapPromise;
  }

  async bootstrapOfficialContentOnce(force) {
    const db = await getDb();
    if (queryOne(db, 'SELECT COUNT(*) AS count FROM programas_fuente WHERE retirado_por_prueba = 0 AND archivado = 0').count > 0) return { status: 'READY' };
    if (this.bootstrapAttempted && !force) return this.bootstrapResult;
    this.bootstrapAttempted = true;
    this.updateState({ bootstrapInProgress: true });
    try {
      const state = await this.checkForContentUpdates({ silent: true, source: 'bootstrap' });
      if (state.status === CONTENT_UPDATE_STATES.ERROR) return (this.bootstrapResult = { status: 'EMPTY', reason: 'CATALOG_ERROR' });
      const official = [...this.validatedCatalogMap.values()].filter(item =>
        item.content_type === 'programa_marco' && item.official === true && item.is_test_fixture !== true &&
        compareSemver(this.appVersion, item.min_app_version) >= 0);
      official.sort((a,b) => compareSemver(b.content_version, a.content_version) || String(b.published_at || '').localeCompare(String(a.published_at || '')));
      if (official.length === 0) return (this.bootstrapResult = { status: 'EMPTY', reason: 'NO_OFFICIAL_CONTENT' });
      // Offer the verified entry. A download always requires the user's click.
      if (queryOne(db, 'SELECT COUNT(*) AS count FROM programas_fuente WHERE retirado_por_prueba = 0 AND archivado = 0').count > 0) return { status: 'READY' };
      return (this.bootstrapResult = { status: 'AVAILABLE', item: official[0] });
    } catch (error) {
      return (this.bootstrapResult = { status: 'EMPTY', reason: error.code || 'INSTALL_ERROR' });
    } finally { this.updateState({ bootstrapInProgress: false }); }
  }

  scheduleStartupCheck(delayMs = 6500) {
    if (this.autoCheckScheduled) return;
    this.autoCheckScheduled = true;

    if (!this.isPackagedApp()) {
      return;
    }

    const safeDelay = Math.max(2000, Number(delayMs) || 6500);
    const timer = setTimeout(() => {
      this.checkForContentUpdates({ silent: true, source: 'auto' }).catch((err) => {
        console.warn('[ContentUpdateService] Fallo silencioso en comprobación de arranque:', err && err.message ? err.message : err);
      });
    }, safeDelay);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  async getInstalledContentsFromDb() {
    const db = await getDb();
    let rows = [];
    try {
      rows = queryAll(db, `SELECT * FROM contenidos_instalados WHERE retirado_por_prueba = 0 ORDER BY installed_at DESC`);
    } catch (e) {
      rows = [];
    }

    // Filtrar solo aquellos cuya fuente siga existiendo en programas_fuente
    const sources = queryAll(db, `SELECT id, nombre, activo, archivado, official, es_fixture_prueba, instalado_por_actualizador, oficial_actual_protegido FROM programas_fuente`);
    const sourceMap = new Map(sources.map((s) => [s.id, s]));

    const installed = [];
    for (const r of rows) {
      const src = sourceMap.get(r.fuente_id);
      if (!src) continue;
      let langs = ['es', 'ca'];
      try {
        if (r.languages_json) langs = JSON.parse(r.languages_json);
      } catch (e) {}
      installed.push({
        content_id: r.content_id,
        fuente_id: r.fuente_id,
        content_version: r.content_version,
        content_type: r.content_type || 'programa_marco',
        title: {
          es: r.title_es || src.nombre,
          ca: r.title_ca || src.nombre
        },
        cycle: r.cycle || '',
        official: Boolean(r.official),
        is_test_fixture: Boolean(r.is_test_fixture),
        is_current_official: Boolean(r.is_current_official) && Boolean(src.oficial_actual_protegido),
        managed_by_content_update: Boolean(r.managed_by_content_update),
        languages: langs,
        package_sha256: r.package_sha256 || null,
        remote_url: r.remote_url || null,
        release_tag: r.release_tag || null,
        installed_at: r.installed_at,
        updated_at: r.updated_at
      });
    }
    return installed;
  }

  /**
   * Descarga HTTPS con validación estricta de protocolo, whitelist de hosts,
   * límite de redirects, timeout y límite de bytes en streaming.
   */
  fetchSecureBuffer(initialUrl, options = {}) {
    const {
      allowedHosts = ALLOWED_CATALOG_HOSTS,
      maxBytes = MAX_CATALOG_BYTES,
      maxRedirects = MAX_REDIRECTS,
      timeoutMs = HTTP_TIMEOUT_MS,
      validateUrlHop = null,
      onProgress = null
    } = options;

    const redirectHistory = [];

    const executeHop = (targetUrl, redirectsRemaining) => {
      return new Promise((resolve, reject) => {
        let parsed;
        try {
          parsed = new URL(targetUrl);
        } catch (e) {
          return reject(new Error(`URL inválida: ${targetUrl}`));
        }

        if (parsed.protocol !== 'https:') {
          return reject(new Error(`Protocolo inseguro bloqueado (${parsed.protocol}). Solo se admite HTTPS.`));
        }

        const hostname = parsed.hostname.toLowerCase();
        if (!allowedHosts.has(hostname)) {
          return reject(new Error(`Host no autorizado por la política de seguridad: ${hostname}`));
        }

        if (typeof validateUrlHop === 'function') {
          const hopCheck = validateUrlHop(parsed, redirectHistory.length);
          if (!hopCheck.ok) {
            return reject(new Error(hopCheck.reason || `Ruta URL no autorizada en ${hostname}`));
          }
        }

        const req = https.request(
          {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers: {
              'User-Agent': `ConstructorProgramasMunicipales/${this.appVersion}`,
              'Accept': '*/*'
            }
          },
          (res) => {
            const statusCode = res.statusCode || 0;
            redirectHistory.push({
              url: targetUrl,
              host: hostname,
              statusCode
            });

            if ([301, 302, 303, 307, 308].includes(statusCode)) {
              res.resume();
              const location = res.headers.location;
              if (!location) {
                return reject(new Error(`Redirección HTTP ${statusCode} sin cabecera Location`));
              }
              if (redirectsRemaining <= 0) {
                return reject(new Error(`Número máximo de redirecciones superado (${maxRedirects})`));
              }
              let nextUrl;
              try {
                nextUrl = new URL(location, targetUrl).toString();
              } catch (e) {
                return reject(new Error('URL de redirección mal formada'));
              }
              return resolve(executeHop(nextUrl, redirectsRemaining - 1));
            }

            if (statusCode !== 200) {
              res.resume();
              return reject(new Error(`Respuesta HTTP inesperada (${statusCode}) desde ${hostname}`));
            }

            const contentLengthHeader = res.headers['content-length'];
            const totalExpected = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
            if (Number.isFinite(totalExpected) && totalExpected > maxBytes) {
              res.destroy();
              return reject(new Error(`El tamaño declarado (${totalExpected} bytes) supera el límite máximo permitido (${maxBytes} bytes)`));
            }

            const chunks = [];
            let receivedBytes = 0;

            res.on('data', (chunk) => {
              receivedBytes += chunk.length;
              if (receivedBytes > maxBytes) {
                res.destroy();
                return reject(new Error(`Descarga abortada: se superó el límite máximo de ${maxBytes} bytes`));
              }
              chunks.push(chunk);
              if (typeof onProgress === 'function') {
                const pct = totalExpected > 0
                  ? Math.min(99, Math.round((receivedBytes / totalExpected) * 100))
                  : 0;
                onProgress({
                  percent: pct,
                  transferred: receivedBytes,
                  total: totalExpected || receivedBytes
                });
              }
            });

            res.on('end', () => {
              const fullBuffer = Buffer.concat(chunks);
              if (typeof onProgress === 'function') {
                onProgress({
                  percent: 100,
                  transferred: fullBuffer.length,
                  total: fullBuffer.length
                });
              }
              resolve({
                buffer: fullBuffer,
                redirects: redirectHistory
              });
            });

            res.on('error', (err) => {
              reject(err);
            });
          }
        );

        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error(`Tiempo de espera agotado (${timeoutMs} ms) al conectar con ${hostname}`));
        });

        req.on('error', (err) => {
          reject(err);
        });

        req.end();
      });
    };

    return executeHop(initialUrl, maxRedirects);
  }

  validateCatalogSchema(rawCatalog) {
    const catalog = sanitizeUntrustedJson(rawCatalog);
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
      throw new Error('El catálogo remoto no es un objeto JSON válido');
    }
    if (catalog.schema_version !== 1) {
      throw new Error(`Versión de esquema de catálogo no soportada: ${catalog.schema_version}`);
    }
    if (!Array.isArray(catalog.programas_marco)) {
      throw new Error('El catálogo remoto no contiene una lista válida en "programas_marco"');
    }
    if (catalog.programas_marco.length > 100) {
      throw new Error('El catálogo remoto excede el número máximo de entradas permitidas');
    }

    const validatedItems = [];
    const seenIds = new Set();

    for (let i = 0; i < catalog.programas_marco.length; i++) {
      const entry = catalog.programas_marco[i];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`Entrada de catálogo inválida en posición ${i}`);
      }

      // Production never loads non-official packages, including through the manual browser.
      if (!this.allowsTestContent() && (entry.official !== true || entry.is_test_fixture === true)) continue;

      const contentId = sanitizePlainText(entry.content_id, 120);
      if (typeof entry.official !== 'boolean' || (entry.is_test_fixture != null && typeof entry.is_test_fixture !== 'boolean')) {
        throw new Error('Los atributos official e is_test_fixture deben ser booleanos.');
      }
      if (!SAFE_ID_REGEX.test(contentId)) {
        throw new Error(`content_id inválido en catálogo: ${contentId}`);
      }
      if (seenIds.has(contentId)) {
        throw new Error(`content_id duplicado en catálogo: ${contentId}`);
      }
      seenIds.add(contentId);

      const contentType = sanitizePlainText(entry.content_type || 'programa_marco', 60);
      if (contentType !== 'programa_marco') {
        throw new Error(`content_type no soportado para ${contentId}: ${contentType}`);
      }

      const contentVersion = sanitizePlainText(entry.content_version, 40);
      if (!SEMVER_REGEX.test(contentVersion)) {
        throw new Error(`content_version inválida para ${contentId}: ${contentVersion}`);
      }

      const minAppVersion = sanitizePlainText(entry.min_app_version || '3.1.0', 40);
      if (!SEMVER_REGEX.test(minAppVersion)) {
        throw new Error(`min_app_version inválida para ${contentId}: ${minAppVersion}`);
      }

      const titleEs = typeof entry.title === 'object' && entry.title !== null
        ? sanitizePlainText(entry.title.es || entry.title.ca, 250)
        : sanitizePlainText(entry.title, 250);
      const titleCa = typeof entry.title === 'object' && entry.title !== null
        ? sanitizePlainText(entry.title.ca || entry.title.es, 250)
        : titleEs;

      if (!titleEs) {
        throw new Error(`Título vacío en entrada de catálogo ${contentId}`);
      }

      const summaryEs = typeof entry.summary === 'object' && entry.summary !== null
        ? sanitizePlainText(entry.summary.es || '', 1500)
        : sanitizePlainText(entry.summary || '', 1500);
      const summaryCa = typeof entry.summary === 'object' && entry.summary !== null
        ? sanitizePlainText(entry.summary.ca || summaryEs, 1500)
        : summaryEs;

      const langs = Array.isArray(entry.languages)
        ? entry.languages.map((l) => sanitizePlainText(l, 10)).filter((l) => l === 'es' || l === 'ca')
        : ['es', 'ca'];
      if (langs.length === 0) {
        throw new Error(`El paquete ${contentId} debe declarar al menos un idioma soportado ("es" o "ca")`);
      }

      const pkgObj = entry.package;
      if (!pkgObj || typeof pkgObj !== 'object') {
        throw new Error(`Falta bloque "package" en la entrada ${contentId}`);
      }

      const downloadUrl = sanitizePlainText(pkgObj.download_url, 500);
      let parsedDl;
      try {
        parsedDl = new URL(downloadUrl);
      } catch (e) {
        throw new Error(`URL de descarga inválida en ${contentId}`);
      }
      if (
        parsedDl.protocol !== 'https:' ||
        parsedDl.hostname.toLowerCase() !== 'github.com' ||
        !parsedDl.pathname.startsWith(EXPECTED_REPO_PREFIX) ||
        !parsedDl.pathname.toLowerCase().endsWith('.zip')
      ) {
        throw new Error(`URL de paquete no pertenece al repositorio oficial de contenidos: ${downloadUrl}`);
      }

      const pkgSha256 = sanitizePlainText(pkgObj.sha256, 64).toLowerCase();
      if (!SHA256_REGEX.test(pkgSha256)) {
        throw new Error(`Hash SHA-256 inválido en catálogo para ${contentId}`);
      }

      const sizeBytes = Number(pkgObj.size_bytes || 0);
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_ZIP_BYTES) {
        throw new Error(`Tamaño de paquete inválido o superior a 50 MB en ${contentId}`);
      }

      validatedItems.push({
        content_id: contentId,
        content_type: contentType,
        content_version: contentVersion,
        title: { es: titleEs, ca: titleCa },
        cycle: sanitizePlainText(entry.cycle || '2027-2031', 40),
        official: Boolean(entry.official),
        is_test_fixture: Boolean(entry.is_test_fixture) || !entry.official,
        fixture_notice: sanitizePlainText(entry.fixture_notice || '', 300),
        published_at: sanitizePlainText(entry.published_at || '', 60),
        min_app_version: minAppVersion,
        languages: langs,
        stats: {
          total_areas: Math.max(0, parseInt(entry.stats?.total_areas || 0, 10) || 0),
          total_measures: Math.max(0, parseInt(entry.stats?.total_measures || 0, 10) || 0)
        },
        summary: { es: summaryEs, ca: summaryCa },
        release_tag: sanitizePlainText(entry.release_tag || '', 120),
        package: {
          filename: sanitizePlainText(pkgObj.filename || `${contentId}_v${contentVersion}.zip`, 180),
          download_url: downloadUrl,
          size_bytes: sizeBytes,
          sha256: pkgSha256
        }
      });
    }

    return {
      schema_version: 1,
      catalog_version: sanitizePlainText(catalog.catalog_version || '1.0.0', 40),
      updated_at: sanitizePlainText(catalog.updated_at || '', 60),
      programas_marco: validatedItems
    };
  }

  async checkForContentUpdates(options = {}) {
    if (this.catalogCheckPromise) return this.catalogCheckPromise;
    this.catalogCheckPromise = this.checkCatalogOnce(options).finally(() => { this.catalogCheckPromise = null; });
    return this.catalogCheckPromise;
  }

  async checkCatalogOnce(options = {}) {
    const silent = Boolean(options.silent);
    const source = options.source || 'manual';

    if (
      this.state.status === CONTENT_UPDATE_STATES.CHECKING ||
      this.state.status === CONTENT_UPDATE_STATES.DOWNLOADING ||
      this.state.status === CONTENT_UPDATE_STATES.VERIFYING ||
      this.state.status === CONTENT_UPDATE_STATES.INSTALLING
    ) {
      return this.getStatus();
    }

    const installedItems = await this.getInstalledContentsFromDb();

    this.updateState({
      status: CONTENT_UPDATE_STATES.CHECKING,
      lastCheckSource: source,
      silent,
      installedItems,
      error: null,
      errorCa: null,
      errorCode: null,
      technicalError: null
    });

    try {
      const { buffer } = await this.fetchSecureBuffer(this.catalogUrl, {
        allowedHosts: ALLOWED_CATALOG_HOSTS,
        maxBytes: MAX_CATALOG_BYTES,
        maxRedirects: 1,
        timeoutMs: HTTP_TIMEOUT_MS,
        validateUrlHop: (parsedUrl) => {
          if (parsedUrl.hostname.toLowerCase() !== 'raw.githubusercontent.com') {
            return { ok: false, reason: 'Host de catálogo no permitido' };
          }
          if (parsedUrl.pathname !== '/elftemir/constructor-programas-municipales-content/main/catalog.json') {
            return { ok: false, reason: 'Ruta de catálogo no permitida' };
          }
          return { ok: true };
        }
      });

      let rawJson;
      try {
        rawJson = JSON.parse(buffer.toString('utf8'));
      } catch (parseErr) {
        throw new Error('El archivo catalog.json recibido no es un JSON válido');
      }

      const validatedCatalog = this.validateCatalogSchema(rawJson);
      this.saveCatalogCacheSnapshot(validatedCatalog);

      this.validatedCatalogMap.clear();
      for (const item of validatedCatalog.programas_marco) {
        this.validatedCatalogMap.set(item.content_id, item);
      }

      const installedById = new Map(installedItems.map((it) => [it.content_id, it]));
      const availableItems = [];

      for (const remoteItem of validatedCatalog.programas_marco) {
        if (remoteItem.official !== true || remoteItem.is_test_fixture === true) continue;
        const localItem = installedById.get(remoteItem.content_id);
        const isNew = !localItem;
        const isUpdate = Boolean(
          localItem && compareSemver(remoteItem.content_version, localItem.content_version) > 0
        );

        if (isUpdate && Boolean(localItem.official) !== Boolean(remoteItem.official)) {
          // official debe ser estable para el mismo content_id (Regla 11)
          continue;
        }

        if (isNew || isUpdate) {
          const requiresNewerApp = compareSemver(this.appVersion, remoteItem.min_app_version) < 0;
          availableItems.push({
            ...remoteItem,
            update_kind: isNew ? 'new' : 'update',
            installed_version: localItem ? localItem.content_version : null,
            compatible_with_app: !requiresNewerApp
          });
        }
      }

      const nowIso = new Date().toISOString();
      if (availableItems.length > 0) {
        return this.updateState({
          status: CONTENT_UPDATE_STATES.AVAILABLE,
          catalogVersion: validatedCatalog.catalog_version,
          checkedAt: nowIso,
          availableItems,
          installedItems,
          silent: false,
          error: null,
          errorCa: null,
          errorCode: null,
          technicalError: null
        });
      }

      return this.updateState({
        status: CONTENT_UPDATE_STATES.UP_TO_DATE,
        catalogVersion: validatedCatalog.catalog_version,
        checkedAt: nowIso,
        availableItems: [],
        installedItems,
        error: null,
        errorCa: null,
        errorCode: null,
        technicalError: null
      });
    } catch (err) {
      const rawMsg = String(err && err.message ? err.message : err || 'Error desconocido');
      console.warn(`[ContentUpdateService] Error comprobando catálogo: ${rawMsg}`);

      return this.updateState({
        status: CONTENT_UPDATE_STATES.ERROR,
        checkedAt: new Date().toISOString(),
        installedItems,
        errorCode: 'CATALOG_CHECK_ERROR',
        error: 'No se ha podido consultar el catálogo de contenidos en este momento. Puedes seguir trabajando con normalidad.',
        errorCa: 'No s\'ha pogut consultar el catàleg de continguts en aquest moment. Pots continuar treballant amb normalitat.',
        technicalError: rawMsg.slice(0, 300)
      });
    }
  }

  /**
   * Valida en memoria y en carpeta temporal controlada el paquete ZIP descargado:
   * - Límites anti-Zip-Bomb (entries <= 10, total <= 100 MB, JSON <= 10 MB)
   * - Prohibición de .., rutas absolutas, UNC, letras de unidad, backslashes, symlinks
   * - Validación de manifest.json contra la entrada de catalog.json y min_app_version
   * - Verificación de hashes SHA-256 internos de PDF ES, JSON ES, PDF CA, JSON CA
   * - Validación de correspondencia bilingüe exacta ES/CA por area_id y measure_id
   */
  async verifyAndExtractPackage(zipBuffer, catalogEntry) {
    const loadedZip = await JSZip.loadAsync(zipBuffer);
    const allEntryNames = Object.keys(loadedZip.files);

    if (allEntryNames.length === 0 || allEntryNames.length > MAX_ZIP_ENTRIES) {
      throw new Error(`Número de entradas en el ZIP (${allEntryNames.length}) fuera del límite permitido (máx. ${MAX_ZIP_ENTRIES})`);
    }

    let totalUncompressedBytes = 0;
    const fileEntryNames = [];

    for (const entryName of allEntryNames) {
      const zipObj = loadedZip.files[entryName];
      if (isZipEntrySymlink(zipObj)) {
        throw new Error(`Enlace simbólico bloqueado dentro del paquete ZIP: ${entryName}`);
      }
      if (zipObj.dir) {
        const cleanDir = entryName.replace(/\/$/, '');
        if (cleanDir !== 'es' && cleanDir !== 'ca') {
          throw new Error(`Directorio no permitido dentro del paquete ZIP: ${entryName}`);
        }
        continue;
      }
      if (!isSafeRelativeZipPath(entryName)) {
        throw new Error(`Ruta interna peligrosa o no permitida en el ZIP: ${entryName}`);
      }
      const uncompressedSize = Number(zipObj._data?.uncompressedSize || 0);
      if (uncompressedSize < 0 || uncompressedSize > MAX_UNCOMPRESSED_TOTAL_BYTES) {
        throw new Error(`Tamaño descomprimido inválido en entrada: ${entryName}`);
      }
      totalUncompressedBytes += uncompressedSize;
      if (totalUncompressedBytes > MAX_UNCOMPRESSED_TOTAL_BYTES) {
        throw new Error('El tamaño descomprimido total supera el límite de seguridad de 100 MB');
      }
      fileEntryNames.push(entryName);
    }

    if (!loadedZip.files['manifest.json'] || loadedZip.files['manifest.json'].dir) {
      throw new Error('El paquete no contiene un archivo manifest.json válido en su raíz');
    }

    const manifestBuf = await loadedZip.file('manifest.json').async('nodebuffer');
    if (manifestBuf.length > MAX_JSON_ENTRY_BYTES) {
      throw new Error('manifest.json supera el límite de tamaño permitido');
    }

    let rawManifest;
    try {
      rawManifest = JSON.parse(manifestBuf.toString('utf8'));
    } catch (e) {
      throw new Error('manifest.json no contiene JSON válido');
    }

    const manifest = sanitizeUntrustedJson(rawManifest);
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('Estructura de manifest.json inválida');
    }

    if (manifest.schema_version !== 1) {
      throw new Error(`schema_version de manifest no soportada: ${manifest.schema_version}`);
    }
    if (manifest.content_id !== catalogEntry.content_id) {
      throw new Error(`Discrepancia de content_id entre manifest (${manifest.content_id}) y catálogo (${catalogEntry.content_id})`);
    }
    if (manifest.content_type !== 'programa_marco' || manifest.content_type !== catalogEntry.content_type) {
      throw new Error(`content_type inválido en manifest: ${manifest.content_type}`);
    }
    if (manifest.content_version !== catalogEntry.content_version) {
      throw new Error(`Discrepancia de content_version entre manifest (${manifest.content_version}) y catálogo (${catalogEntry.content_version})`);
    }
    if (Boolean(manifest.official) !== Boolean(catalogEntry.official)) {
      throw new Error('Discrepancia en el atributo "official" entre manifest y catálogo');
    }

    const minAppVer = sanitizePlainText(manifest.min_app_version || catalogEntry.min_app_version, 40);
    if (!SEMVER_REGEX.test(minAppVer)) {
      throw new Error(`min_app_version inválido en manifest: ${minAppVer}`);
    }
    if (compareSemver(this.appVersion, minAppVer) < 0) {
      const compatErr = new Error('Este contenido requiere una versión más reciente de Constructor de Programas Municipales.');
      compatErr.code = 'INCOMPATIBLE_APP_VERSION';
      throw compatErr;
    }

    if (!manifest.languages || typeof manifest.languages !== 'object') {
      throw new Error('manifest.json no define el bloque "languages"');
    }

    const hasEs = Boolean(manifest.languages.es);
    const hasCa = Boolean(manifest.languages.ca);
    if (!hasEs && !hasCa) {
      throw new Error('manifest.json debe incluir al menos un idioma soportado ("es" o "ca")');
    }

    const langEs = hasEs ? manifest.languages.es : null;
    const langCa = hasCa ? manifest.languages.ca : null;
    const allowedFilesSet = new Set(['manifest.json']);

    if (hasEs) {
      if (
        !isSafeRelativeZipPath(langEs.pdf, '.pdf') ||
        !langEs.pdf.startsWith('es/') ||
        !isSafeRelativeZipPath(langEs.data, '.json') ||
        !langEs.data.startsWith('es/')
      ) {
        throw new Error('Las rutas relativas del idioma "es" en manifest.json no cumplen las reglas de seguridad');
      }
      if (
        !SHA256_REGEX.test(String(langEs.sha256_pdf || '')) ||
        !SHA256_REGEX.test(String(langEs.sha256_data || ''))
      ) {
        throw new Error('manifest.json contiene hashes SHA-256 internos inválidos para "es"');
      }
      allowedFilesSet.add(langEs.pdf);
      allowedFilesSet.add(langEs.data);
    }

    if (hasCa) {
      if (
        !isSafeRelativeZipPath(langCa.pdf, '.pdf') ||
        !langCa.pdf.startsWith('ca/') ||
        !isSafeRelativeZipPath(langCa.data, '.json') ||
        !langCa.data.startsWith('ca/')
      ) {
        throw new Error('Las rutas relativas del idioma "ca" en manifest.json no cumplen las reglas de seguridad');
      }
      if (
        !SHA256_REGEX.test(String(langCa.sha256_pdf || '')) ||
        !SHA256_REGEX.test(String(langCa.sha256_data || ''))
      ) {
        throw new Error('manifest.json contiene hashes SHA-256 internos inválidos para "ca"');
      }
      allowedFilesSet.add(langCa.pdf);
      allowedFilesSet.add(langCa.data);
    }

    for (const fName of fileEntryNames) {
      if (!allowedFilesSet.has(fName)) {
        throw new Error(`Archivo no declarado o no permitido dentro del paquete ZIP: ${fName}`);
      }
    }
    for (const reqFile of allowedFilesSet) {
      if (!loadedZip.files[reqFile] || loadedZip.files[reqFile].dir) {
        throw new Error(`Falta el archivo obligatorio declarado en manifest: ${reqFile}`);
      }
    }

    // Extracción física controlada en carpeta temporal exclusiva con validación anti-Zip-Slip
    const tempExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpm-content-pkg-'));
    try {
      const extractedBuffers = {};
      let actualTotalBytes = 0;

      for (const relFile of allowedFilesSet) {
        const destPath = path.resolve(tempExtractDir, ...relFile.split('/'));
        if (!isPathInside(tempExtractDir, destPath, false)) {
          throw new Error(`Bloqueo Anti-Zip-Slip: intento de extracción fuera de carpeta temporal (${relFile})`);
        }
        const buf = await loadedZip.file(relFile).async('nodebuffer');
        actualTotalBytes += buf.length;
        if (actualTotalBytes > MAX_UNCOMPRESSED_TOTAL_BYTES) {
          throw new Error('El tamaño descomprimido real supera el límite máximo de 100 MB');
        }
        if (relFile.endsWith('.json') && buf.length > MAX_JSON_ENTRY_BYTES) {
          throw new Error(`El archivo JSON ${relFile} supera el límite máximo de 10 MB`);
        }

        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, buf);
        extractedBuffers[relFile] = buf;
      }

      // Verificar SHA-256 internos contra manifest.json
      let actualShaPdfEs = null;
      let actualShaJsonEs = null;
      let actualShaPdfCa = null;
      let actualShaJsonCa = null;
      let esData = null;
      let caData = null;

      if (hasEs) {
        actualShaPdfEs = sha256Hex(extractedBuffers[langEs.pdf]);
        actualShaJsonEs = sha256Hex(extractedBuffers[langEs.data]);
        if (actualShaPdfEs !== String(langEs.sha256_pdf).toLowerCase()) {
          throw new Error('Fallo de integridad: el hash SHA-256 del PDF en castellano no coincide con manifest.json');
        }
        if (actualShaJsonEs !== String(langEs.sha256_data).toLowerCase()) {
          throw new Error('Fallo de integridad: el hash SHA-256 del JSON en castellano no coincide con manifest.json');
        }
        if (extractedBuffers[langEs.pdf].slice(0, 5).toString('ascii') !== '%PDF-') {
          throw new Error('El archivo PDF en castellano no tiene una cabecera PDF válida');
        }
        const rawEsData = JSON.parse(extractedBuffers[langEs.data].toString('utf8'));
        esData = sanitizeUntrustedJson(rawEsData);
      }

      if (hasCa) {
        actualShaPdfCa = sha256Hex(extractedBuffers[langCa.pdf]);
        actualShaJsonCa = sha256Hex(extractedBuffers[langCa.data]);
        if (actualShaPdfCa !== String(langCa.sha256_pdf).toLowerCase()) {
          throw new Error('Fallo de integridad: el hash SHA-256 del PDF en catalán no coincide con manifest.json');
        }
        if (actualShaJsonCa !== String(langCa.sha256_data).toLowerCase()) {
          throw new Error('Fallo de integridad: el hash SHA-256 del JSON en catalán no coincide con manifest.json');
        }
        if (extractedBuffers[langCa.pdf].slice(0, 5).toString('ascii') !== '%PDF-') {
          throw new Error('El archivo PDF en catalán no tiene una cabecera PDF válida');
        }
        const rawCaData = JSON.parse(extractedBuffers[langCa.data].toString('utf8'));
        caData = sanitizeUntrustedJson(rawCaData);
      }

      let aligned;
      if (hasEs && hasCa) {
        aligned = this.validateBilingualAlignment(manifest, esData, caData);
      } else if (hasEs) {
        aligned = this.validateSingleLanguageStructure(manifest, esData, 'es');
      } else {
        aligned = this.validateSingleLanguageStructure(manifest, caData, 'ca');
      }

      return {
        manifest,
        hasEs,
        hasCa,
        esData,
        caData,
        aligned,
        hashes: {
          shaPdfEs: actualShaPdfEs,
          shaJsonEs: actualShaJsonEs,
          shaPdfCa: actualShaPdfCa,
          shaJsonCa: actualShaJsonCa
        }
      };
    } finally {
      try {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }

  /**
   * Valida estructura interna de paquete con un solo idioma (Reglas 5, 6 y 10).
   */
  validateSingleLanguageStructure(manifest, data, lang) {
    if (!data || typeof data !== 'object') {
      throw new Error(`Los datos JSON lingüísticos (${lang}) deben ser un objeto válido`);
    }
    if (data.content_id !== manifest.content_id) {
      throw new Error(`El content_id del JSON (${lang}) no coincide con manifest.json`);
    }
    if (data.content_version !== manifest.content_version) {
      throw new Error(`El content_version del JSON (${lang}) no coincide con manifest.json`);
    }
    if (data.language?.ai_translated === true) {
      throw new Error('Rechazado: la versión lingüística está marcada como traducción automática por IA');
    }

    const areas = Array.isArray(data.areas) ? data.areas : [];
    if (areas.length === 0) {
      throw new Error(`El JSON (${lang}) no contiene áreas`);
    }

    const seenAreaIds = new Set();
    const seenGlobalMeasureIds = new Set();
    const structuredAreas = [];

    for (let aIdx = 0; aIdx < areas.length; aIdx++) {
      const a = areas[aIdx];
      const areaId = sanitizePlainText(a.area_id || a.id, 120);
      if (!SAFE_ID_REGEX.test(areaId)) {
        throw new Error(`Identificador de área inválido en ${lang}: ${areaId}`);
      }
      if (seenAreaIds.has(areaId)) {
        throw new Error(`Identificador de área duplicado en ${lang}: ${areaId}`);
      }
      seenAreaIds.add(areaId);

      const nombre = sanitizePlainText(a.nombre || a.title, 500);
      if (!nombre) {
        throw new Error(`El área "${areaId}" carece de nombre en ${lang}`);
      }

      const rawMeasures = Array.isArray(a.medidas) ? a.medidas : (Array.isArray(a.measures) ? a.measures : []);
      if (rawMeasures.length === 0) {
        throw new Error(`El área "${areaId}" no contiene medidas en ${lang}`);
      }

      const structuredMeasures = [];
      const seenMeasureIdsInArea = new Set();

      for (let mIdx = 0; mIdx < rawMeasures.length; mIdx++) {
        const m = rawMeasures[mIdx];
        const measureId = sanitizePlainText(m.measure_id || m.id, 120);
        if (!SAFE_ID_REGEX.test(measureId)) {
          throw new Error(`Identificador de medida inválido en ${lang} (${areaId}): ${measureId}`);
        }
        if (seenMeasureIdsInArea.has(measureId)) {
          throw new Error(`Identificador de medida duplicado en área (${areaId}): ${measureId}`);
        }
        seenMeasureIdsInArea.add(measureId);

        if (seenGlobalMeasureIds.has(measureId)) {
          throw new Error(`Identificador de medida duplicado en el programa: ${measureId}`);
        }
        seenGlobalMeasureIds.add(measureId);

        if (m.area_id && sanitizePlainText(m.area_id, 120) !== areaId) {
          throw new Error(`Relación area_id incoherente en medida ${measureId}`);
        }

        const titulo = sanitizePlainText(m.titulo || m.title, 500);
        if (!titulo) {
          throw new Error(`La medida "${measureId}" carece de título en ${lang}`);
        }

        const texto = sanitizePlainText(m.texto || m.text || '', 50000);
        const explicacion = sanitizePlainText(m.explicacion || m.explanation || '', 50000);

        structuredMeasures.push({
          canonicalMeasureId: measureId,
          codigo: sanitizePlainText(m.codigo || `${aIdx + 1}.${mIdx + 1}`, 40),
          orden: Number(m.orden) || (mIdx + 1),
          numero_origen: Number(m.numero_origen) || (mIdx + 1),
          subarea: sanitizePlainText(m.subarea || '', 200),
          titulo_es: lang === 'es' ? titulo : null,
          titulo_ca: lang === 'ca' ? titulo : null,
          texto_es: lang === 'es' ? texto : null,
          texto_ca: lang === 'ca' ? texto : null,
          explicacion_es: lang === 'es' ? explicacion : null,
          explicacion_ca: lang === 'ca' ? explicacion : null,
          pagina_inicio: Number(m.pagina_inicio) || 1,
          pagina_fin: Number(m.pagina_fin) || 1,
          dudoso: m.dudoso ? 1 : 0,
          motivo_duda: sanitizePlainText(m.motivo_duda || '', 500)
        });
      }

      structuredAreas.push({
        canonicalAreaId: areaId,
        orden: Number(a.orden) || (aIdx + 1),
        nombre_es: lang === 'es' ? nombre : null,
        nombre_ca: lang === 'ca' ? nombre : null,
        pagina_inicio: Number(a.pagina_inicio) || 1,
        medidas: structuredMeasures
      });
    }

    return {
      totalAreas: structuredAreas.length,
      totalMeasures: seenGlobalMeasureIds.size,
      areas: structuredAreas
    };
  }

  /**
   * Valida correspondencia bilingüe estricta ES/CA (Sección 20):
   * - mismo content_id y content_version
   * - prohibición de traducción por IA (ai_translated === false)
   * - mismos area_id sin duplicados
   * - mismos measure_id por área sin duplicados
   * - códigos y orden coherentes
   */
  validateBilingualAlignment(manifest, esData, caData) {
    if (!esData || typeof esData !== 'object' || !caData || typeof caData !== 'object') {
      throw new Error('Los datos JSON lingüísticos deben ser objetos válidos');
    }
    if (esData.content_id !== manifest.content_id || caData.content_id !== manifest.content_id) {
      throw new Error('El content_id de los JSON lingüísticos no coincide con manifest.json');
    }
    if (esData.content_version !== manifest.content_version || caData.content_version !== manifest.content_version) {
      throw new Error('El content_version de los JSON lingüísticos no coincide con manifest.json');
    }
    if (esData.language?.ai_translated === true || caData.language?.ai_translated === true) {
      throw new Error('Rechazado: una de las versiones lingüísticas está marcada como traducción automática por IA');
    }

    const esAreas = Array.isArray(esData.areas) ? esData.areas : [];
    const caAreas = Array.isArray(caData.areas) ? caData.areas : [];
    if (esAreas.length === 0 || esAreas.length !== caAreas.length) {
      throw new Error(`El número de áreas en ES (${esAreas.length}) y CA (${caAreas.length}) no coincide o está vacío`);
    }

    const caAreaById = new Map();
    const seenCaAreaIds = new Set();
    for (const aCa of caAreas) {
      const aId = sanitizePlainText(aCa.area_id || aCa.id, 120);
      if (!SAFE_ID_REGEX.test(aId)) {
        throw new Error(`Identificador de área inválido en CA: ${aId}`);
      }
      if (seenCaAreaIds.has(aId)) {
        throw new Error(`Identificador de área duplicado en CA: ${aId}`);
      }
      seenCaAreaIds.add(aId);
      caAreaById.set(aId, aCa);
    }

    const seenEsAreaIds = new Set();
    const seenGlobalMeasureIds = new Set();
    const mergedAreas = [];

    for (let aIdx = 0; aIdx < esAreas.length; aIdx++) {
      const aEs = esAreas[aIdx];
      const areaId = sanitizePlainText(aEs.area_id || aEs.id, 120);
      if (!SAFE_ID_REGEX.test(areaId)) {
        throw new Error(`Identificador de área inválido en ES: ${areaId}`);
      }
      if (seenEsAreaIds.has(areaId)) {
        throw new Error(`Identificador de área duplicado en ES: ${areaId}`);
      }
      seenEsAreaIds.add(areaId);

      const aCa = caAreaById.get(areaId);
      if (!aCa) {
        throw new Error(`El área "${areaId}" presente en ES no existe en CA`);
      }

      const nombreEs = sanitizePlainText(aEs.nombre || aEs.title, 500);
      const nombreCa = sanitizePlainText(aCa.nombre || aCa.title, 500);
      if (!nombreEs || !nombreCa) {
        throw new Error(`El área "${areaId}" carece de título en ES o CA`);
      }

      const esMeasures = Array.isArray(aEs.medidas) ? aEs.medidas : (Array.isArray(aEs.measures) ? aEs.measures : []);
      const caMeasures = Array.isArray(aCa.medidas) ? aCa.medidas : (Array.isArray(aCa.measures) ? aCa.measures : []);
      if (esMeasures.length === 0 || esMeasures.length !== caMeasures.length) {
        throw new Error(`El número de medidas del área "${areaId}" no coincide entre ES (${esMeasures.length}) y CA (${caMeasures.length})`);
      }

      const caMeasureById = new Map();
      const seenCaMeasureIdsInArea = new Set();
      for (const mCa of caMeasures) {
        const mId = sanitizePlainText(mCa.measure_id || mCa.id, 120);
        if (!SAFE_ID_REGEX.test(mId)) {
          throw new Error(`Identificador de medida inválido en CA (${areaId}): ${mId}`);
        }
        if (seenCaMeasureIdsInArea.has(mId)) {
          throw new Error(`Identificador de medida duplicado en CA (${areaId}): ${mId}`);
        }
        if (mCa.area_id && sanitizePlainText(mCa.area_id, 120) !== areaId) {
          throw new Error(`Relación area_id incoherente en medida CA ${mId}`);
        }
        seenCaMeasureIdsInArea.add(mId);
        caMeasureById.set(mId, mCa);
      }

      const mergedMeasures = [];
      for (let mIdx = 0; mIdx < esMeasures.length; mIdx++) {
        const mEs = esMeasures[mIdx];
        const measureId = sanitizePlainText(mEs.measure_id || mEs.id, 120);
        if (!SAFE_ID_REGEX.test(measureId)) {
          throw new Error(`Identificador de medida inválido en ES (${areaId}): ${measureId}`);
        }
        if (seenGlobalMeasureIds.has(measureId)) {
          throw new Error(`Identificador de medida duplicado en el programa: ${measureId}`);
        }
        if (mEs.area_id && sanitizePlainText(mEs.area_id, 120) !== areaId) {
          throw new Error(`Relación area_id incoherente en medida ES ${measureId}`);
        }
        seenGlobalMeasureIds.add(measureId);

        const mCa = caMeasureById.get(measureId);
        if (!mCa) {
          throw new Error(`La medida "${measureId}" del área "${areaId}" en ES no existe en el área correspondiente de CA`);
        }

        const codigoEs = sanitizePlainText(mEs.codigo || mEs.numero_origen || `${aIdx + 1}.${mIdx + 1}`, 50);
        const codigoCa = sanitizePlainText(mCa.codigo || mCa.numero_origen || `${aIdx + 1}.${mIdx + 1}`, 50);
        if (codigoEs !== codigoCa) {
          throw new Error(`Código de medida incoherente entre ES (${codigoEs}) y CA (${codigoCa}) en ${measureId}`);
        }

        const textoEs = sanitizePlainText(mEs.texto || mEs.text, 50000);
        const textoCa = sanitizePlainText(mCa.texto || mCa.text, 50000);
        if (!textoEs || !textoCa) {
          throw new Error(`Texto vacío en ES o CA para la medida ${measureId}`);
        }

        mergedMeasures.push({
          canonicalMeasureId: measureId,
          orden: Number(mEs.orden) || (mIdx + 1),
          codigo: codigoEs,
          numero_origen: sanitizePlainText(mEs.numero_origen || codigoEs, 50),
          subarea: sanitizePlainText(mEs.subarea || '', 300) || null,
          titulo_es: sanitizePlainText(mEs.titulo || mEs.title || '', 1500) || null,
          titulo_ca: sanitizePlainText(mCa.titulo || mCa.title || '', 1500) || null,
          texto_es: textoEs,
          texto_ca: textoCa,
          explicacion_es: sanitizePlainText(mEs.explicacion || mEs.explanation || '', 50000) || null,
          explicacion_ca: sanitizePlainText(mCa.explicacion || mCa.explanation || '', 50000) || null,
          pagina_inicio: Number(mEs.pagina_inicio) || 1,
          pagina_fin: Number(mEs.pagina_fin) || 1,
          dudoso: (mEs.dudoso || mCa.dudoso) ? 1 : 0,
          motivo_duda: sanitizePlainText(mEs.motivo_duda || mCa.motivo_duda || '', 500) || null
        });
      }

      mergedAreas.push({
        canonicalAreaId: areaId,
        orden: Number(aEs.orden) || (aIdx + 1),
        nombre_es: nombreEs,
        nombre_ca: nombreCa,
        pagina_inicio: Number(aEs.pagina_inicio) || 1,
        medidas: mergedMeasures
      });
    }

    return {
      totalAreas: mergedAreas.length,
      totalMeasures: seenGlobalMeasureIds.size,
      areas: mergedAreas
    };
  }

  /**
   * Instala transaccionalmente el paquete bilingüe verificado en SQLite (Secciones 21, 22, 23, 25).
   */
  async persistVerifiedPackageToDb(catalogEntry, verifiedPkg) {
    const db = await getDb();
    const { manifest, aligned, hashes } = verifiedPkg;
    const contentId = manifest.content_id;
    const fuenteId = contentId;
    const nowIso = new Date().toISOString();

    const isOfficial = manifest.official === true && manifest.is_test_fixture !== true;
    const isTestFixture = Boolean(manifest.is_test_fixture) || !isOfficial;
    if (isTestFixture && !this.allowsTestContent()) throw new Error('Este contenido de prueba no está permitido en producción.');

    const newDbAreaIds = new Set(aligned.areas.map((a) => `${fuenteId}__${a.canonicalAreaId}`));
    const newDbMeasureIds = new Set(
      aligned.areas.flatMap((a) => a.medidas.map((m) => `${fuenteId}__${m.canonicalMeasureId}`))
    );

    // Si el content_id ya existe, comprobar compatibilidad con decisiones/proyectos existentes (Sección 23)
    const existingSource = queryOne(db, `SELECT * FROM programas_fuente WHERE id = ?`, [fuenteId]);
    if (existingSource) {
      const refMeasures = queryAll(
        db,
        `SELECT DISTINCT m.id FROM medidas m
         WHERE m.fuente_id = ? AND (
           EXISTS (SELECT 1 FROM decisiones_medidas d WHERE d.medida_id = m.id)
           OR EXISTS (SELECT 1 FROM medidas_propias mp WHERE mp.medida_origen_id = m.id)
         )`,
        [fuenteId]
      );
      for (const rm of refMeasures) {
        if (!newDbMeasureIds.has(rm.id)) {
          const err = new Error(`La actualización de contenido (${manifest.content_version}) elimina o altera identificadores de medidas utilizados por proyectos existentes (${rm.id}). Actualización bloqueada por seguridad.`);
          err.code = 'INCOMPATIBLE_CONTENT_UPDATE';
          throw err;
        }
      }

      const refAreas = queryAll(
        db,
        `SELECT DISTINCT a.id FROM areas a
         WHERE a.fuente_id = ? AND EXISTS (SELECT 1 FROM medidas_propias mp WHERE mp.area_id = a.id)`,
        [fuenteId]
      );
      for (const ra of refAreas) {
        if (!newDbAreaIds.has(ra.id)) {
          const err = new Error(`La actualización de contenido (${manifest.content_version}) elimina un área utilizada por medidas propias de un proyecto (${ra.id}). Actualización bloqueada por seguridad.`);
          err.code = 'INCOMPATIBLE_CONTENT_UPDATE';
          throw err;
        }
      }
    }

    // Comprobación de estabilidad de official (Regla 11)
    if (existingSource) {
      const existingIsOfficial = Boolean(existingSource.official);
      if (existingIsOfficial !== isOfficial) {
        const err = new Error(
          `Incompatibilidad de seguridad: el Programa Marco "${contentId}" ya está instalado como ${existingIsOfficial ? 'OFICIAL' : 'NO OFICIAL'} y no se permite alterar su oficialidad mediante actualización. Debe utilizarse un content_id diferente.`
        );
        err.code = 'INCOMPATIBLE_CONTENT_UPDATE';
        throw err;
      }
    }

    const hasEs = verifiedPkg.hasEs;
    const hasCa = verifiedPkg.hasCa;

    let existingIdiomas = {};
    if (existingSource && existingSource.idiomas_json) {
      try {
        existingIdiomas = JSON.parse(existingSource.idiomas_json);
      } catch (e) {}
    }

    const idiomasObj = {
      es: {
        disponible: hasEs ? true : Boolean(existingIdiomas.es?.disponible),
        archivo: hasEs ? manifest.languages.es.pdf : (existingIdiomas.es?.archivo || null),
        data: hasEs ? manifest.languages.es.data : (existingIdiomas.es?.data || null),
        sha256_pdf: hasEs ? hashes.shaPdfEs : (existingIdiomas.es?.sha256_pdf || null),
        sha256_data: hasEs ? hashes.shaJsonEs : (existingIdiomas.es?.sha256_data || null),
        fecha: hasEs ? nowIso : (existingIdiomas.es?.fecha || null)
      },
      ca: {
        disponible: hasCa ? true : Boolean(existingIdiomas.ca?.disponible),
        archivo: hasCa ? manifest.languages.ca.pdf : (existingIdiomas.ca?.archivo || null),
        data: hasCa ? manifest.languages.ca.data : (existingIdiomas.ca?.data || null),
        sha256_pdf: hasCa ? hashes.shaPdfCa : (existingIdiomas.ca?.sha256_pdf || null),
        sha256_data: hasCa ? hashes.shaJsonCa : (existingIdiomas.ca?.sha256_data || null),
        fecha: hasCa ? nowIso : (existingIdiomas.ca?.fecha || null)
      }
    };

    const rawTitleEs = hasEs && (typeof manifest.title === 'object' ? manifest.title.es : manifest.title);
    const rawTitleCa = hasCa && (typeof manifest.title === 'object' ? manifest.title.ca : manifest.title);
    const baseTitleEs = sanitizePlainText(rawTitleEs || (existingSource ? existingSource.nombre : '') || catalogEntry.title.es || '', 250);
    const baseTitleCa = sanitizePlainText(rawTitleCa || catalogEntry.title.ca || baseTitleEs, 250);
    const chosenTitle = baseTitleEs || baseTitleCa || contentId;
    const visibleName = !isOfficial && !/no\s+oficial/i.test(chosenTitle)
      ? `${chosenTitle} (NO OFICIAL)`
      : chosenTitle;

    const preserveArchivado = existingSource ? Number(existingSource.archivado || 0) : 0;
    const createdAt = existingSource && existingSource.created_at ? existingSource.created_at : nowIso;

    let isProtectedNow = 0;
    let targetActivo = 0;

    db.run('BEGIN TRANSACTION;');
    // Freeze the secondary-language copy of selected measures before replacing catalogue rows.
    // The primary-language version and user adaptations are already stored in decisiones_medidas.
    if(existingSource){
      const selected=queryAll(db,`SELECT d.id,p.idioma_principal,m.titulo_es,m.titulo_ca,m.texto_es,m.texto_ca,m.explicacion_es,m.explicacion_ca FROM decisiones_medidas d JOIN proyectos p ON p.id=d.proyecto_id JOIN medidas m ON m.id=d.medida_id WHERE m.fuente_id=? AND d.estado IN ('incluida','adaptada')`,[fuenteId]);
      for(const copy of selected){const secondary=copy.idioma_principal==='ca'?'es':'ca';db.run(`UPDATE decisiones_medidas SET traduccion_titulo=CASE WHEN coalesce(traduccion_titulo,'')='' THEN ? ELSE traduccion_titulo END,traduccion_texto=CASE WHEN coalesce(traduccion_texto,'')='' THEN ? ELSE traduccion_texto END,traduccion_explicacion=CASE WHEN coalesce(traduccion_explicacion,'')='' THEN ? ELSE traduccion_explicacion END WHERE id=?`,[copy['titulo_'+secondary]||'',copy['texto_'+secondary]||'',copy['explicacion_'+secondary]||'',copy.id]);}
    }

    try {
      if (existingSource) {
        // MISMO content_id (Regla 1 y 4):
        // NO rotar. Mantener protección si ya era oficial actual. Mantener activo previo.
        isProtectedNow = (existingSource.oficial_actual_protegido || isOfficial) ? 1 : 0;
        targetActivo = Number(existingSource.activo || 0);
      } else if (isOfficial) {
        // NUEVO Programa Marco oficial (Regla 2, 3 y 13):
        // Identificar si el anterior Programa Marco oficial era la fuente activa
        const prevOfficialActive = queryOne(
          db,
          `SELECT id FROM programas_fuente
           WHERE official = 1
             AND oficial_actual_protegido = 1
             AND activo = 1
           LIMIT 1`
        );

        // Desproteger todos los programas oficiales anteriores
        db.run(
          `UPDATE programas_fuente
           SET oficial_actual_protegido = 0, updated_at = ?
           WHERE official = 1`,
          [nowIso]
        );
        db.run(
          `UPDATE contenidos_instalados
           SET is_current_official = 0, updated_at = ?`,
          [nowIso]
        );

        // Si el oficial anterior estaba activo, sustituirlo por el nuevo oficial
        if (prevOfficialActive) {
          db.run(`UPDATE programas_fuente SET activo = 0 WHERE id = ?`, [prevOfficialActive.id]);
          targetActivo = 1;
        } else {
          // El usuario tenía otra fuente deliberada activa: conservarla
          targetActivo = 0;
        }

        isProtectedNow = 1;
      } else {
        // Paquete nuevo NO oficial
        isProtectedNow = 0;
        targetActivo = 0;
      }

      if (existingSource) {
        db.run(
          `UPDATE programas_fuente SET
            nombre = ?,
            tipo = 'marco_oficial',
            origen_archivo = ?,
            idiomas_json = ?,
            total_areas = ?,
            total_medidas = ?,
            content_id = ?,
            content_version = ?,
            content_type = ?,
            ciclo = ?,
            official = ?,
            es_fixture_prueba = ?,
            instalado_por_actualizador = 1,
            oficial_actual_protegido = ?,
            origen_remoto = ?,
            fecha_instalacion = ?,
            updated_at = ?
           WHERE id = ?`,
          [
            visibleName,
            catalogEntry.package.filename,
            JSON.stringify(idiomasObj),
            aligned.totalAreas,
            aligned.totalMeasures,
            contentId,
            manifest.content_version,
            manifest.content_type,
            manifest.cycle || catalogEntry.cycle,
            isOfficial ? 1 : 0,
            isTestFixture ? 1 : 0,
            isProtectedNow,
            catalogEntry.package.download_url,
            nowIso,
            nowIso,
            fuenteId
          ]
        );
      } else {
        db.run(
          `INSERT INTO programas_fuente (
            id, nombre, activo, archivado, tipo, origen_archivo, idiomas_json,
            total_areas, total_medidas, created_at, updated_at,
            content_id, content_version, content_type, ciclo, official,
            es_fixture_prueba, instalado_por_actualizador, oficial_actual_protegido,
            origen_remoto, fecha_instalacion
          ) VALUES (?, ?, ?, ?, 'marco_oficial', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [
            fuenteId,
            visibleName,
            targetActivo,
            preserveArchivado,
            catalogEntry.package.filename,
            JSON.stringify(idiomasObj),
            aligned.totalAreas,
            aligned.totalMeasures,
            createdAt,
            nowIso,
            contentId,
            manifest.content_version,
            manifest.content_type,
            manifest.cycle || catalogEntry.cycle,
            isOfficial ? 1 : 0,
            isTestFixture ? 1 : 0,
            isProtectedNow,
            catalogEntry.package.download_url,
            nowIso
          ]
        );
      }

      // Upsert de áreas bilingües manteniendo IDs canónicos y combinando idiomas
      for (const area of aligned.areas) {
        const dbAreaId = `${fuenteId}__${area.canonicalAreaId}`;
        const existingArea = queryOne(db, `SELECT * FROM areas WHERE id = ?`, [dbAreaId]);

        const mergedNombreEs = area.nombre_es !== null && area.nombre_es !== undefined
          ? area.nombre_es
          : (existingArea ? existingArea.nombre_es : null);
        const mergedNombreCa = area.nombre_ca !== null && area.nombre_ca !== undefined
          ? area.nombre_ca
          : (existingArea ? existingArea.nombre_ca : null);
        const defaultAreaNombre = mergedNombreEs || mergedNombreCa || '';

        db.run(
          `INSERT OR REPLACE INTO areas (
            id, fuente_id, orden, nombre, nombre_es, nombre_ca, pagina_inicio
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            dbAreaId,
            fuenteId,
            area.orden,
            defaultAreaNombre,
            mergedNombreEs,
            mergedNombreCa,
            area.pagina_inicio
          ]
        );

        for (const med of area.medidas) {
          const dbMeasureId = `${fuenteId}__${med.canonicalMeasureId}`;
          const existingMeasure = queryOne(db, `SELECT * FROM medidas WHERE id = ?`, [dbMeasureId]);

          const mergedTituloEs = med.titulo_es !== null && med.titulo_es !== undefined
            ? med.titulo_es
            : (existingMeasure ? existingMeasure.titulo_es : '');
          const mergedTituloCa = med.titulo_ca !== null && med.titulo_ca !== undefined
            ? med.titulo_ca
            : (existingMeasure ? existingMeasure.titulo_ca : '');
          const defaultTitulo = mergedTituloEs || mergedTituloCa || '';

          const mergedTextoEs = med.texto_es !== null && med.texto_es !== undefined
            ? med.texto_es
            : (existingMeasure ? existingMeasure.texto_es : '');
          const mergedTextoCa = med.texto_ca !== null && med.texto_ca !== undefined
            ? med.texto_ca
            : (existingMeasure ? existingMeasure.texto_ca : '');
          const defaultTexto = mergedTextoEs || mergedTextoCa || '';

          const mergedExpEs = med.explicacion_es !== null && med.explicacion_es !== undefined
            ? med.explicacion_es
            : (existingMeasure ? existingMeasure.explicacion_es : '');
          const mergedExpCa = med.explicacion_ca !== null && med.explicacion_ca !== undefined
            ? med.explicacion_ca
            : (existingMeasure ? existingMeasure.explicacion_ca : '');
          const defaultExp = mergedExpEs || mergedExpCa || '';

          db.run(
            `INSERT OR REPLACE INTO medidas (
              id, fuente_id, codigo, orden, area_id, area_nombre, subarea,
              numero_origen, pagina_origen, titulo, titulo_es, titulo_ca,
              texto, texto_es, texto_ca, explicacion, explicacion_es, explicacion_ca,
              pagina_inicio, pagina_fin, dudoso, motivo_duda
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              dbMeasureId,
              fuenteId,
              med.codigo,
              med.orden,
              dbAreaId,
              defaultAreaNombre,
              med.subarea,
              med.numero_origen,
              med.pagina_inicio,
              defaultTitulo,
              mergedTituloEs,
              mergedTituloCa,
              defaultTexto,
              mergedTextoEs,
              mergedTextoCa,
              defaultExp,
              mergedExpEs,
              mergedExpCa,
              med.pagina_inicio,
              med.pagina_fin,
              med.dudoso,
              med.motivo_duda
            ]
          );
        }
      }

      // Registrar en contenidos_instalados
      const existingInstalled = queryOne(db, `SELECT installed_at FROM contenidos_instalados WHERE content_id = ?`, [contentId]);
      const installedAt = existingInstalled && existingInstalled.installed_at ? existingInstalled.installed_at : nowIso;
      const installedLangsList = [idiomasObj.es.disponible && 'es', idiomasObj.ca.disponible && 'ca'].filter(Boolean);

      db.run(
        `INSERT OR REPLACE INTO contenidos_instalados (
          content_id, fuente_id, content_version, content_type,
          title_es, title_ca, cycle, official, is_test_fixture,
          is_current_official, managed_by_content_update, languages_json,
          package_sha256, remote_url, release_tag, manifest_json,
          installed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contentId,
          fuenteId,
          manifest.content_version,
          manifest.content_type,
          baseTitleEs,
          baseTitleCa,
          manifest.cycle || catalogEntry.cycle,
          isOfficial ? 1 : 0,
          isTestFixture ? 1 : 0,
          isProtectedNow,
          JSON.stringify(installedLangsList),
          catalogEntry.package.sha256,
          catalogEntry.package.download_url,
          catalogEntry.release_tag || '',
          JSON.stringify(manifest),
          installedAt,
          nowIso
        ]
      );

      db.run('COMMIT;');
    } catch (txErr) {
      try {
        db.run('ROLLBACK;');
      } catch (e) {}
      throw txErr;
    }

    save();

    const installedLangsFinal = [idiomasObj.es.disponible && 'es', idiomasObj.ca.disponible && 'ca'].filter(Boolean);

    return {
      content_id: contentId,
      fuente_id: fuenteId,
      nombre: visibleName,
      content_version: manifest.content_version,
      official: isOfficial,
      is_test_fixture: isTestFixture,
      is_current_official: Boolean(isProtectedNow),
      total_areas: aligned.totalAreas,
      total_medidas: aligned.totalMeasures,
      languages: installedLangsFinal
    };
  }

  /**
   * Descarga, verifica e instala un paquete de contenido autorizado por el usuario (Secciones 15–27).
   */
  async installContentUpdate(contentId, options = {}) {
    const cleanId = sanitizePlainText(contentId, 120);
    if (!SAFE_ID_REGEX.test(cleanId)) {
      throw new Error('Identificador de contenido no válido');
    }

    // Si aún no se había consultado el catálogo en esta sesión, consultarlo primero
    if (!this.validatedCatalogMap.has(cleanId)) {
      await this.checkForContentUpdates({ silent: false, source: 'manual' });
    }

    const catalogEntry = this.validatedCatalogMap.get(cleanId);
    if (!catalogEntry) {
      throw new Error(`El contenido solicitado (${cleanId}) no se encuentra en el catálogo oficial validado.`);
    }
    const isTest = catalogEntry.official !== true || catalogEntry.is_test_fixture === true;
    if (isTest && !this.allowsTestContent()) throw new Error('Los paquetes de prueba solo están disponibles en desarrollo autorizado.');
    if (isTest && options.allowTestFixture !== true) throw new Error('Activa «Mostrar contenidos de prueba» antes de instalar un paquete de prueba.');
    if (options.automatic === true && (catalogEntry.official !== true || catalogEntry.is_test_fixture === true)) {
      throw new Error('Los paquetes de prueba nunca se instalan automáticamente.');
    }

    if (compareSemver(this.appVersion, catalogEntry.min_app_version) < 0) {
      this.updateState({
        status: CONTENT_UPDATE_STATES.INCOMPATIBLE,
        errorCode: 'INCOMPATIBLE_APP_VERSION',
        error: 'Este contenido requiere una versión más reciente de Constructor de Programas Municipales.',
        errorCa: 'Aquest contingut requereix una versió més recent de Constructor de Programes Municipals.'
      });
      throw new Error('Este contenido requiere una versión más reciente de Constructor de Programas Municipales.');
    }

    // 1. Fase DOWNLOADING
    this.updateState({
      status: CONTENT_UPDATE_STATES.DOWNLOADING,
      activeDownloadId: cleanId,
      progress: { percent: 0, transferred: 0, total: catalogEntry.package.size_bytes },
      error: null,
      errorCa: null,
      errorCode: null,
      technicalError: null
    });

    const tempZipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpm-content-zip-'));
    const tempZipPath = path.join(tempZipDir, 'package.zip');

    try {
      const { buffer: zipBuffer, redirects } = await this.fetchSecureBuffer(
        catalogEntry.package.download_url,
        {
          allowedHosts: ALLOWED_PACKAGE_HOSTS,
          maxBytes: MAX_ZIP_BYTES,
          maxRedirects: MAX_REDIRECTS,
          timeoutMs: HTTP_TIMEOUT_MS,
          validateUrlHop: (parsedUrl, hopIndex) => {
            const host = parsedUrl.hostname.toLowerCase();
            if (hopIndex === 0) {
              if (host !== 'github.com' || !parsedUrl.pathname.startsWith(EXPECTED_REPO_PREFIX)) {
                return { ok: false, reason: 'URL inicial de descarga fuera del repositorio oficial de contenidos' };
              }
              return { ok: true };
            }
            if (host === 'release-assets.githubusercontent.com' && parsedUrl.pathname.startsWith(EXPECTED_ASSET_REDIRECT_PREFIX)) {
              return { ok: true };
            }
            if (host === 'github.com' && parsedUrl.pathname.startsWith(EXPECTED_REPO_PREFIX)) {
              return { ok: true };
            }
            return { ok: false, reason: `Redirección hacia host o ruta no autorizada (${host})` };
          },
          onProgress: (prog) => {
            this.updateState({
              status: CONTENT_UPDATE_STATES.DOWNLOADING,
              activeDownloadId: cleanId,
              progress: prog
            });
          }
        }
      );

      // Guardar en directorio temporal controlado
      if (!isPathInside(tempZipDir, tempZipPath, false)) {
        throw new Error('Ruta temporal de descarga inválida');
      }
      fs.writeFileSync(tempZipPath, zipBuffer);

      // 2. Fase VERIFYING (SHA-256 externo + validación ZIP + manifest + hashes internos + alineación ES/CA)
      this.updateState({
        status: CONTENT_UPDATE_STATES.VERIFYING,
        activeDownloadId: cleanId,
        progress: { percent: 100, transferred: zipBuffer.length, total: zipBuffer.length }
      });

      const actualZipSha256 = sha256Hex(zipBuffer);
      if (actualZipSha256 !== catalogEntry.package.sha256.toLowerCase()) {
        throw new Error(`Verificación criptográfica fallida: el SHA-256 del paquete descargado (${actualZipSha256}) no coincide con el catálogo oficial.`);
      }

      const verifiedPkg = await this.verifyAndExtractPackage(zipBuffer, catalogEntry);
      if (Boolean(verifiedPkg.manifest.is_test_fixture) !== Boolean(catalogEntry.is_test_fixture) && verifiedPkg.manifest.official === true) {
        throw new Error('El atributo is_test_fixture del manifiesto no coincide con el catálogo.');
      }
      if (options.automatic === true && (verifiedPkg.manifest.official !== true || verifiedPkg.manifest.is_test_fixture === true)) {
        throw new Error('El manifiesto no corresponde a un Programa Marco oficial apto para el primer arranque.');
      }

      // 3. Fase INSTALLING (Transacción SQLite)
      this.updateState({
        status: CONTENT_UPDATE_STATES.INSTALLING,
        activeDownloadId: cleanId
      });

      const installedSummary = await this.persistVerifiedPackageToDb(catalogEntry, verifiedPkg);

      // Actualizar estado tras la instalación exitosa
      const updatedInstalled = await this.getInstalledContentsFromDb();
      const remainingAvailable = (this.state.availableItems || []).filter((it) => it.content_id !== cleanId);

      this.updateState({
        status: remainingAvailable.length > 0 ? CONTENT_UPDATE_STATES.AVAILABLE : CONTENT_UPDATE_STATES.INSTALLED,
        activeDownloadId: null,
        progress: null,
        availableItems: remainingAvailable,
        installedItems: updatedInstalled,
        lastInstalledItem: {
          ...installedSummary,
          redirectsObserved: redirects
        },
        error: null,
        errorCa: null,
        errorCode: null,
        technicalError: null
      });

      return {
        ok: true,
        installed: installedSummary,
        redirectsObserved: redirects
      };
    } catch (err) {
      const rawMsg = String(err && err.message ? err.message : err || 'Error desconocido');
      const isCompat = err && (err.code === 'INCOMPATIBLE_APP_VERSION' || err.code === 'INCOMPATIBLE_CONTENT_UPDATE');

      const userMsgEs = isCompat
        ? rawMsg
        : 'No se ha podido descargar o verificar el paquete de contenido. No se ha realizado ningún cambio en la aplicación.';
      const userMsgCa = isCompat
        ? (err.code === 'INCOMPATIBLE_APP_VERSION'
            ? 'Aquest contingut requereix una versió més recent de Constructor de Programes Municipals.'
            : rawMsg)
        : 'No s\'ha pogut baixar o verificar el paquet de contingut. No s\'ha realitzat cap canvi a l\'aplicació.';

      this.updateState({
        status: isCompat ? CONTENT_UPDATE_STATES.INCOMPATIBLE : CONTENT_UPDATE_STATES.ERROR,
        activeDownloadId: null,
        progress: null,
        errorCode: err.code || 'CONTENT_INSTALL_ERROR',
        error: userMsgEs,
        errorCa: userMsgCa,
        technicalError: rawMsg.slice(0, 300)
      });

      throw err;
    } finally {
      try {
        fs.rmSync(tempZipDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }

  /**
   * Alias de compatibilidad para installContentUpdate
   */
  async installContent(contentId) {
    return await this.installContentUpdate(contentId);
  }
}

const contentUpdateService = new ContentUpdateService();

module.exports = {
  contentUpdateService,
  ContentUpdateService,
  CONTENT_UPDATE_STATES,
  OFFICIAL_CATALOG_URL,
  ALLOWED_CATALOG_HOSTS,
  ALLOWED_PACKAGE_HOSTS,
  MAX_CATALOG_BYTES,
  MAX_ZIP_BYTES,
  MAX_ZIP_ENTRIES,
  MAX_UNCOMPRESSED_TOTAL_BYTES,
  MAX_JSON_ENTRY_BYTES,
  compareSemver
};
