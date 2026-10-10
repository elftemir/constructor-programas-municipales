const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { getDatabasePath, resolveAssetPath } = require('../utils/paths');
const migrator = require('./migrator');

let db = null;
let dbFilePath = null;

async function getDb(customPath = null) {
  if (db && !customPath) return db;

  const SQL = await initSqlJs();
  dbFilePath = customPath || getDatabasePath();

  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Check if we need to migrate from local development database (only for default user db path in development)
  if (!customPath && !fs.existsSync(dbFilePath)) {
    const devDbPath = path.join(__dirname, '..', '..', '..', 'data', 'programa_electoral.sqlite');
    if (fs.existsSync(devDbPath) && fs.statSync(devDbPath).size > 0) {
      try {
        fs.copyFileSync(devDbPath, dbFilePath);
        console.log('Migrated existing SQLite database to user data directory:', dbFilePath);
      } catch (err) {
        console.warn('Could not copy dev database to user data directory:', err);
      }
    }
  }

  if (fs.existsSync(dbFilePath)) {
    try {
      const fileBuffer = fs.readFileSync(dbFilePath);
      db = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Error reading existing SQLite database, creating new one:', e);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Ejecución controlada y transaccional de migraciones y validación
  await migrator.migrate(db, { dbFilePath });

  seedCatalog();
  save();

  return db;
}

function save() {
  if (!db || !dbFilePath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
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

function seedCatalog() {
  const catalogPath = resolveAssetPath('data', 'catalogo_marco.json');
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
  initDb: getDb,
  save,
  closeDb
};
