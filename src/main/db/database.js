const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { getDatabasePath, resolveAssetPath } = require('../utils/paths');
const migrator = require('./migrator');

let db = null;
let dbFilePath = null;

const { atomicWrite, backupFiles, createBackup, openChecked } = require('./persistence');
let handlers = {};
let opening = null;
function setDatabaseHandlers(value) { handlers = value || {}; }
async function getDb(customPath = null, options = {}) {
  if (!customPath && opening) return opening;
  if (db && !customPath) return db;
  const operation = openDatabase(customPath, options);
  opening = operation;
  try { return await operation; } finally { if (opening === operation) opening = null; }
}
async function openDatabase(customPath, options) {
  const SQL = await initSqlJs();
  const target = customPath || getDatabasePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!customPath && !fs.existsSync(target)) {
    const devDbPath = path.join(__dirname, '..', '..', '..', 'data', 'programa_electoral.sqlite');
    if (fs.existsSync(devDbPath) && fs.statSync(devDbPath).size > 0) {
      const bytes = fs.readFileSync(devDbPath);
      const checked = openChecked(SQL, bytes); checked.close();
      atomicWrite(target, bytes);
    }
  }
  let candidate;
  if (fs.existsSync(target)) {
    try { candidate = openChecked(SQL, fs.readFileSync(target)); }
    catch (cause) {
      let recovery = null;
      for (const file of backupFiles(target)) {
        try {
          const bytes = fs.readFileSync(file);
          const checked = openChecked(SQL, bytes);
          const version = migrator.getSchemaVersion(checked); checked.close();
          if (version <= migrator.TARGET_SCHEMA_VERSION) { recovery = { file, bytes }; break; }
        } catch (_) { /* Try the next valid startup backup. */ }
      }
      const confirm = options.confirmRestore || handlers.confirmRestore;
      if (!recovery || !confirm || !(await confirm({ databasePath: target, backupPath: recovery.file }))) {
        const error = new Error(recovery ? 'Base de datos dañada. Restauración cancelada; el archivo original se conserva.' : 'Base de datos dañada y sin copia válida de arranque. El archivo original se conserva.');
        error.code = 'ERR_DATABASE_CORRUPT'; error.cause = cause; throw error;
      }
      createBackup(target, fs.readFileSync(target), 'corrupt');
      atomicWrite(target, recovery.bytes);
      candidate = openChecked(SQL, recovery.bytes);
    }
  } else candidate = new SQL.Database();
  try {
    // Once per opening, before any mutation. Never back up an unreadable database.
    if (fs.existsSync(target)) createBackup(target, fs.readFileSync(target));
    await migrator.migrate(candidate, { dbFilePath: target });
    if (db && db !== candidate) db.close();
    db = candidate; dbFilePath = target;
    seedCatalog(customPath ? options.catalogPath : null);
    save();
    return db;
  } catch (err) {
    if (db === candidate) { db = null; dbFilePath = null; }
    candidate.close();
    throw err;
  }
}

function save() {
  if (!db || !dbFilePath) return;
  try { atomicWrite(dbFilePath, Buffer.from(db.export())); }
  catch (err) {
    console.error('Error saving SQLite database to disk:', err);
    if (handlers.onSaveError) { try { handlers.onSaveError(err); } catch (_) {} }
    throw err;
  }
}

function closeDb() {
  if (db) {
    try {
      db.close();
    } catch (e) {}
    db = null;
    dbFilePath = null;
  }
}

function seedCatalog(testCatalogPath = null) {
  const catalogPath = testCatalogPath || resolveAssetPath('data', 'catalogo_marco.json');
  if (!fs.existsSync(catalogPath)) {
    // En distribución libre limpia no se incluye catálogo político embebido; se usa el gestor de contenidos
    return;
  }

  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const catalog = catalogData.catalogo_marco || catalogData;
  const stats = catalogData.estadisticas || catalog.estadisticas;

  // Ensure default source program exists in programas_fuente
  try {
    const pfCheck = db.exec("SELECT COUNT(*) FROM programas_fuente WHERE id = 'fuente_marco_oficial'");
    if (!pfCheck.length || pfCheck[0].values[0][0] === 0) {
      db.run(`INSERT OR REPLACE INTO programas_fuente (id, nombre, activo, archivado, tipo, origen_archivo, idiomas_json, total_areas, total_medidas, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        'fuente_marco_oficial',
        'Programa Marco 2027',
        1,
        0,
        'marco_oficial',
        'catalogo_marco.json',
        JSON.stringify({
          es: { disponible: true, archivo: 'catalogo_marco.json' },
          ca: { disponible: true, archivo: 'catalogo_marco.json' }
        }),
        stats.total_areas || 12,
        stats.total_medidas || 123,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
    }
  } catch(e) {
    console.error('Error seeding default source program:', e);
  }

  // Check if we need to seed or upgrade areas/medidas for default catalog
  let needsSeed = false;
  const check = db.exec("SELECT COUNT(*) FROM areas WHERE fuente_id = 'fuente_marco_oficial'");
  if (!check.length || check[0].values[0][0] === 0) {
    needsSeed = true;
  } else {
    // Check if bilingual columns are populated
    const checkCa = db.exec("SELECT nombre_ca FROM areas WHERE fuente_id = 'fuente_marco_oficial' LIMIT 1");
    if (!checkCa.length || !checkCa[0].values[0][0]) {
      needsSeed = true;
    }
  }

  if (!needsSeed) {
    return;
  }

  db.run(`INSERT OR REPLACE INTO catalogo_info VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    'marco_principal',
    catalog.version,
    catalog.fecha_revision,
    catalog.descripcion,
    JSON.stringify(catalog.idiomas_disponibles),
    stats.total_areas,
    stats.total_medidas
  ]);

  for (const a of catalog.areas) {
    db.run(`INSERT OR REPLACE INTO areas (id, fuente_id, orden, nombre, nombre_es, nombre_ca, pagina_inicio) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      a.id,
      'fuente_marco_oficial',
      a.orden,
      a.nombre,
      a.nombre_es || a.nombre,
      a.nombre_ca || a.nombre,
      a.pagina_inicio || null
    ]);

    for (const m of a.medidas) {
      db.run(`INSERT OR REPLACE INTO medidas (id, fuente_id, codigo, orden, area_id, area_nombre, subarea, numero_origen, pagina_origen, titulo, titulo_es, titulo_ca, texto, texto_es, texto_ca, explicacion, explicacion_es, explicacion_ca, pagina_inicio, pagina_fin, dudoso, motivo_duda) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        m.id,
        'fuente_marco_oficial',
        m.codigo,
        m.orden,
        m.area_id,
        m.area_nombre || a.nombre,
        m.subarea || null,
        m.numero_origen || m.codigo || null,
        m.pagina_origen || m.pagina_inicio || null,
        m.titulo,
        m.titulo_es || m.titulo,
        m.titulo_ca || null,
        m.texto,
        m.texto_es || m.texto,
        m.texto_ca || m.texto,
        m.explicacion,
        m.explicacion_es || m.explicacion,
        m.explicacion_ca || null,
        m.pagina_inicio,
        m.pagina_fin,
        m.dudoso ? 1 : 0,
        m.motivo_duda
      ]);
    }
  }

  console.log(`Seeded bilingual catalog successfully: ${catalog.areas.length} areas, ${stats.total_medidas} measures.`);
}

module.exports = {
  getDb,
  setDatabaseHandlers,
  initDb: getDb,
  save,
  closeDb
};
