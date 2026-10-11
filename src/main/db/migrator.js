const fs = require('fs');
const path = require('path');
const { getUserDataDir } = require('../utils/paths');

const TARGET_SCHEMA_VERSION = 5;

// Registro ordenado de migraciones
const MIGRATIONS = [
  require('./migrations/001_initial_schema'),
  require('./migrations/002_phase3_sources'),
  require('./migrations/003_integrity_and_links'),
  require('./migrations/004_content_updates'),
  require('./migrations/005_ocr_metadata')
];

function tableExists(db, tableName) {
  try {
    const res = db.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", [tableName]);
    return res.length > 0 && res[0].values.length > 0;
  } catch (e) {
    return false;
  }
}

function columnExists(db, tableName, columnName) {
  if (!tableExists(db, tableName)) return false;
  try {
    const res = db.exec(`PRAGMA table_info(${tableName})`);
    if (!res.length || !res[0].values) return false;
    return res[0].values.some(row => row[1] === columnName);
  } catch (e) {
    return false;
  }
}

function addColumnIfNotExists(db, tableName, columnDef) {
  const colName = columnDef.trim().split(/\s+/)[0];
  if (!columnExists(db, tableName, colName)) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef};`);
    return true;
  }
  return false;
}

function getSchemaVersion(db) {
  try {
    const res = db.exec("PRAGMA user_version");
    if (res.length && res[0].values && res[0].values[0]) {
      return parseInt(res[0].values[0][0], 10) || 0;
    }
  } catch (e) {
    console.warn("No se pudo leer PRAGMA user_version:", e);
  }
  return 0;
}

function detectSchemaLevel(db) {
  const userVer = getSchemaVersion(db);
  if (userVer > 0) return userVer;

  // Si user_version == 0, inspeccionar estructura para bases legacy o base vacía
  if (!tableExists(db, 'proyectos')) {
    // Base de datos nueva / vacía
    return 0;
  }

  // Base existente: comprobar si tiene tablas de programas fuente de Fase 3
  const hasProgramasFuente = tableExists(db, 'programas_fuente');
  const hasFuenteIdInProyectos = columnExists(db, 'proyectos', 'fuente_id');
  const hasProyectoFuentes = tableExists(db, 'proyecto_fuentes');
  const hasContenidosInstalados = tableExists(db, 'contenidos_instalados');

  if (!hasProgramasFuente || !hasFuenteIdInProyectos) {
    // Nivel 1: Fase 2 (2.0.10)
    return 1;
  }

  if (hasContenidosInstalados) {
    return columnExists(db, 'programas_fuente', 'ocr_metadata_json') ? 5 : 4;
  }

  if (hasProyectoFuentes) {
    // Nivel 2: Fase 3.0 / 3.1
    return 2;
  }

  return 1;
}

function getTimestampString() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `${y}${m}${d}_${h}${min}${s}`;
}

function getMigrationBackupDir() {
  const userDir = getUserDataDir();
  const backupDir = path.join(userDir, 'backups', 'migrations');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

function createMigrationBackup(db, fromVersion, toVersion, dbFilePath) {
  const target = dbFilePath || path.join(getUserDataDir(), 'database', 'programa_electoral.sqlite');
  const backupPath = require('./persistence').createBackup(target, Buffer.from(db.export()), 'schema' + fromVersion + '-to-' + toVersion);
  console.log('[Migrador] Copia previa: ' + backupPath);
  return backupPath;
}

function queryCount(db, sql, params = []) {
  try {
    const res = db.exec(sql, params);
    if (res.length && res[0].values && res[0].values[0]) {
      return parseInt(res[0].values[0][0], 10) || 0;
    }
  } catch (e) {}
  return 0;
}

function collectMetrics(db) {
  return {
    projects: tableExists(db, 'proyectos') ? queryCount(db, 'SELECT COUNT(*) FROM proyectos') : 0,
    decisions: tableExists(db, 'decisiones_medidas') ? queryCount(db, 'SELECT COUNT(*) FROM decisiones_medidas') : 0,
    propias: tableExists(db, 'medidas_propias') ? queryCount(db, 'SELECT COUNT(*) FROM medidas_propias') : 0,
    areas: tableExists(db, 'areas') ? queryCount(db, 'SELECT COUNT(*) FROM areas') : 0,
    medidas: tableExists(db, 'medidas') ? queryCount(db, 'SELECT COUNT(*) FROM medidas') : 0
  };
}

function validateIntegrity(db, preMetrics) {
  const requiredTables = [
    'catalogo_info',
    'areas',
    'medidas',
    'proyectos',
    'fichas_municipios',
    'decisiones_medidas',
    'medidas_propias',
    'textos_generales',
    'configuracion',
    'ai_modelos',
    'ai_historial',
    'programas_fuente',
    'proyecto_fuentes',
    'contenidos_instalados',
    '_schema_migrations'
  ];

  for (const t of requiredTables) {
    if (!tableExists(db, t)) {
      throw new Error(`Validación de esquema fallida: falta la tabla obligatoria '${t}'`);
    }
  }

  // Columnas críticas
  const requiredColumns = [
    ['proyectos', 'fuente_id'],
    ['proyectos', 'mapeo_fuentes_json'],
    ['areas', 'fuente_id'],
    ['medidas', 'fuente_id'],
    ['medidas_propias', 'fuente_origen_id']
  ];

  for (const [tbl, col] of requiredColumns) {
    if (!columnExists(db, tbl, col)) {
      throw new Error(`Validación de esquema fallida: falta la columna obligatoria '${tbl}.${col}'`);
    }
  }

  // Comprobar que los contadores no han disminuido inesperadamente
  const postMetrics = collectMetrics(db);
  if (postMetrics.projects < preMetrics.projects) {
    throw new Error(`Validación fallida: pérdida de proyectos detectada (${postMetrics.projects} < ${preMetrics.projects})`);
  }
  if (postMetrics.decisions < preMetrics.decisions) {
    throw new Error(`Validación fallida: pérdida de decisiones detectada (${postMetrics.decisions} < ${preMetrics.decisions})`);
  }
  if (postMetrics.propias < preMetrics.propias) {
    throw new Error(`Validación fallida: pérdida de medidas propias detectada (${postMetrics.propias} < ${preMetrics.propias})`);
  }

  // Comprobar que todos los proyectos tienen al menos una fuente principal en proyecto_fuentes
  const unlinkedCount = queryCount(db, `
    SELECT COUNT(*) FROM proyectos
    WHERE id NOT IN (SELECT proyecto_id FROM proyecto_fuentes WHERE rol = 'principal')
  `);
  if (unlinkedCount > 0) {
    throw new Error(`Validación fallida: existen ${unlinkedCount} proyectos sin fuente principal vinculada en proyecto_fuentes`);
  }

  // Comprobar que los JSON críticos parsean
  const projRows = db.exec("SELECT id, mapeo_fuentes_json, empresas_municipales_json, servicios_json FROM proyectos");
  if (projRows.length && projRows[0].values) {
    for (const row of projRows[0].values) {
      const pid = row[0];
      try { if (row[1]) JSON.parse(row[1]); } catch(e) { throw new Error(`JSON no válido en mapeo_fuentes_json para proyecto ${pid}`); }
      try { if (row[2]) JSON.parse(row[2]); } catch(e) { throw new Error(`JSON no válido en empresas_municipales_json para proyecto ${pid}`); }
      try { if (row[3]) JSON.parse(row[3]); } catch(e) { throw new Error(`JSON no válido en servicios_json para proyecto ${pid}`); }
    }
  }

  // Comprobar schema_version final
  const finalVer = getSchemaVersion(db);
  if (finalVer !== TARGET_SCHEMA_VERSION) {
    throw new Error(`Validación fallida: schema_version final (${finalVer}) no coincide con el objetivo (${TARGET_SCHEMA_VERSION})`);
  }

  return true;
}

function logMigrationRecord(db, fromVersion, toVersion, migrationName, details = 'OK') {
  try {
    db.run(`
      INSERT INTO _schema_migrations (from_version, to_version, migration_name, executed_at, success, details)
      VALUES (?, ?, ?, datetime('now'), 1, ?)
    `, [fromVersion, toVersion, migrationName, details]);
  } catch (e) {
    console.warn("[Migrador] No se pudo registrar entrada en _schema_migrations:", e);
  }
}

async function migrate(db, options = {}) {
  const currentVer = getSchemaVersion(db);

  // 1. Compatibilidad hacia delante: versión superior a la soportada
  if (currentVer > TARGET_SCHEMA_VERSION) {
    const error = new Error('Este proyecto fue actualizado con una versión más reciente de la aplicación y no puede abrirse de forma segura con esta versión.');
    error.code = 'ERR_FUTURE_SCHEMA';
    error.currentVersion = currentVer;
    error.targetVersion = TARGET_SCHEMA_VERSION;
    throw error;
  }

  // 2. Si ya está en la versión requerida exacta, no migrar ni crear backup
  if (currentVer === TARGET_SCHEMA_VERSION) {
    return {
      migrated: false,
      version: TARGET_SCHEMA_VERSION,
      reason: 'already_up_to_date'
    };
  }

  // 3. Determinar nivel de partida si currentVer == 0
  const startLevel = detectSchemaLevel(db);

  // Mandatory even for a new schema or a legacy database with missing user_version.
  const backupFile = createMigrationBackup(db, startLevel, TARGET_SCHEMA_VERSION, options.dbFilePath);

  if (startLevel === TARGET_SCHEMA_VERSION) {
    // Si la base ya contenía todo pero tenía user_version=0, simplemente fijar user_version
    db.run(`PRAGMA user_version = ${TARGET_SCHEMA_VERSION};`);
    return {
      migrated: false,
      version: TARGET_SCHEMA_VERSION,
      reason: 'version_updated_only'
    };
  }

  const preMetrics = collectMetrics(db);
  // 5. Ejecutar migraciones secuenciales en transacción
  const helpers = { tableExists, columnExists, addColumnIfNotExists };

  db.run("BEGIN TRANSACTION;");
  try {
    for (let step = startLevel; step < TARGET_SCHEMA_VERSION; step++) {
      const migration = MIGRATIONS[step];
      if (!migration) {
        throw new Error(`Migración no encontrada para el paso ${step} -> ${step + 1}`);
      }
      console.log(`[Migrador] Aplicando migración ${migration.name} (esquema ${step} -> ${step + 1})...`);
      migration.up(db, helpers);

      // Si la tabla de migraciones ya existe, registrar el paso
      if (tableExists(db, '_schema_migrations')) {
        logMigrationRecord(db, step, step + 1, migration.name);
      }
    }

    // Actualizar formalmente PRAGMA user_version al objetivo
    db.run(`PRAGMA user_version = ${TARGET_SCHEMA_VERSION};`);

    // Validar integridad antes de confirmar la transacción
    validateIntegrity(db, preMetrics);

    db.run("COMMIT;");
    console.log(`[Migrador] Migración completada con éxito a esquema versión ${TARGET_SCHEMA_VERSION}`);

    return {
      migrated: true,
      fromVersion: startLevel,
      toVersion: TARGET_SCHEMA_VERSION,
      backupFile
    };
  } catch (err) {
    console.error("[Migrador] Error durante la migración, ejecutando ROLLBACK:", err);
    try {
      db.run("ROLLBACK;");
    } catch (rbErr) {
      console.error("[Migrador] Error durante ROLLBACK:", rbErr);
    }
    err.backupFile = backupFile;
    err.rolledBack = true;
    throw err;
  }
}

module.exports = {
  TARGET_SCHEMA_VERSION,
  getSchemaVersion,
  detectSchemaLevel,
  createMigrationBackup,
  getMigrationBackupDir,
  validateIntegrity,
  migrate,
  tableExists,
  columnExists,
  addColumnIfNotExists,
  collectMetrics
};
