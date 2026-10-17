/**
 * Migración 002: Arquitectura de Programas Fuente (Fase 3.0 / 3.1)
 * Introduce programas_fuente, proyecto_fuentes, trazabilidad de medidas
 * complementarias y campos multiesquema.
 */

function up(db, { addColumnIfNotExists, tableExists }) {
  // 1. Tabla de programas fuente
  db.run(`
    CREATE TABLE IF NOT EXISTS programas_fuente (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      activo INTEGER DEFAULT 0,
      archivado INTEGER DEFAULT 0,
      tipo TEXT DEFAULT 'marco_oficial',
      origen_archivo TEXT,
      idiomas_json TEXT DEFAULT '{}',
      total_areas INTEGER DEFAULT 0,
      total_medidas INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 2. Columnas en areas y medidas para fuentes
  addColumnIfNotExists(db, 'areas', 'fuente_id TEXT');
  addColumnIfNotExists(db, 'medidas', 'fuente_id TEXT');
  addColumnIfNotExists(db, 'medidas', "subarea TEXT");
  addColumnIfNotExists(db, 'medidas', "numero_origen TEXT");
  addColumnIfNotExists(db, 'medidas', "pagina_origen INTEGER");

  // 3. Columna fuente_id en proyectos
  addColumnIfNotExists(db, 'proyectos', 'fuente_id TEXT');

  // 4. Tabla de relaciones de múltiples fuentes por proyecto
  db.run(`
    CREATE TABLE IF NOT EXISTS proyecto_fuentes (
      id TEXT PRIMARY KEY,
      proyecto_id TEXT NOT NULL,
      fuente_id TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'complementaria',
      fecha_anadida TEXT NOT NULL,
      UNIQUE(proyecto_id, fuente_id)
    );
  `);

  // 5. Mapeos de área y trazabilidad en proyectos y medidas propias
  addColumnIfNotExists(db, 'proyectos', "mapeo_fuentes_json TEXT DEFAULT '{}'");
  addColumnIfNotExists(db, 'medidas_propias', "fuente_origen_id TEXT");
  addColumnIfNotExists(db, 'medidas_propias', "medida_origen_id TEXT");
  addColumnIfNotExists(db, 'medidas_propias', "numero_origen TEXT");
  addColumnIfNotExists(db, 'medidas_propias', "fuente_nombre TEXT");

  // Preserve pre-source-schema data under a neutral legacy source, only when it exists.
  const hasLegacy = ['areas', 'medidas', 'proyectos'].some(table =>
    db.exec(`SELECT 1 FROM ${table} WHERE fuente_id IS NULL OR fuente_id = '' LIMIT 1`).length > 0);
  if (hasLegacy) {
    const legacyId = 'source_legacy_import';
    for (const table of ['areas', 'medidas', 'proyectos']) {
      db.run(`UPDATE ${table} SET fuente_id = ? WHERE fuente_id IS NULL OR fuente_id = ''`, [legacyId]);
    }
    db.run(`INSERT OR IGNORE INTO programas_fuente
      (id,nombre,activo,archivado,tipo,idiomas_json,total_areas,total_medidas,created_at,updated_at)
      SELECT ?, 'Programa fuente conservado', 1, 0, 'legacy', '{}',
        (SELECT COUNT(*) FROM areas WHERE fuente_id = ?),
        (SELECT COUNT(*) FROM medidas WHERE fuente_id = ?), datetime('now'), datetime('now')`,
      [legacyId, legacyId, legacyId]);
  }
}

module.exports = {
  version: 2,
  name: '002_phase3_sources',
  up
};
