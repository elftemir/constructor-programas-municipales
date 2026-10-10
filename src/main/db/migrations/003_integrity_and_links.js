/**
 * Migración 003: Compatibilidad y Migraciones Seguras (Fase 3.2 / 3.0.2)
 * Introduce registro de migraciones (_schema_migrations), garantiza vinculación
 * segura e idempotente de proyectos a fuentes principales en proyecto_fuentes,
 * y normaliza estados heredados.
 */

function up(db, { addColumnIfNotExists, tableExists }) {
  // 1. Tabla de metadatos de migraciones
  db.run(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_version INTEGER NOT NULL,
      to_version INTEGER NOT NULL,
      migration_name TEXT NOT NULL,
      executed_at TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      details TEXT
    );
  `);

  // 2. Normalización de estados legacy (descartada -> sin_revisar)
  db.run(`
    UPDATE decisiones_medidas SET estado = 'sin_revisar' WHERE estado = 'descartada';
    UPDATE medidas_propias SET estado = 'sin_revisar' WHERE estado = 'descartada';
  `);

  // 3. Vinculación idempotente de proyectos a fuente principal en proyecto_fuentes
  // Solo se inserta para proyectos que no dispongan todavía de una fuente principal registrada.
  db.run(`
    INSERT OR IGNORE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida)
    SELECT ('pf_' || p.id || '_' || coalesce(p.fuente_id, 'fuente_marco_oficial')),
           p.id,
           coalesce(p.fuente_id, 'fuente_marco_oficial'),
           'principal',
           datetime('now')
    FROM proyectos p
    WHERE p.id NOT IN (
      SELECT pf.proyecto_id FROM proyecto_fuentes pf WHERE pf.rol = 'principal'
    );
  `);

  // 4. Asegurar valores neutros no nulos en mapeos y campos críticos
  db.run(`
    UPDATE proyectos SET mapeo_fuentes_json = '{}' WHERE mapeo_fuentes_json IS NULL OR mapeo_fuentes_json = '';
  `);
}

module.exports = {
  version: 3,
  name: '003_integrity_and_links',
  up
};
