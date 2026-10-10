/**
 * Migración 004: Metadatos de Actualizaciones de Contenidos (Fase 3.4B / v3.2.0)
 * Añade de forma aditiva y compatible la tabla contenidos_instalados y columnas
 * de metadatos en programas_fuente sin alterar proyectos, áreas, medidas ni decisiones.
 */

function up(db, { addColumnIfNotExists }) {
  // 1. Tabla dedicada de metadatos de paquetes de contenido instalados mediante Content Update
  db.run(`
    CREATE TABLE IF NOT EXISTS contenidos_instalados (
      content_id TEXT PRIMARY KEY,
      fuente_id TEXT NOT NULL,
      content_version TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'programa_marco',
      title_es TEXT,
      title_ca TEXT,
      cycle TEXT,
      official INTEGER NOT NULL DEFAULT 0,
      is_test_fixture INTEGER NOT NULL DEFAULT 0,
      is_current_official INTEGER NOT NULL DEFAULT 0,
      managed_by_content_update INTEGER NOT NULL DEFAULT 1,
      languages_json TEXT NOT NULL DEFAULT '[]',
      package_sha256 TEXT,
      remote_url TEXT,
      release_tag TEXT,
      manifest_json TEXT DEFAULT '{}',
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Columnas aditivas en programas_fuente para trazabilidad directa
  addColumnIfNotExists(db, 'programas_fuente', 'content_id TEXT');
  addColumnIfNotExists(db, 'programas_fuente', 'content_version TEXT');
  addColumnIfNotExists(db, 'programas_fuente', 'content_type TEXT');
  addColumnIfNotExists(db, 'programas_fuente', 'ciclo TEXT');
  addColumnIfNotExists(db, 'programas_fuente', 'official INTEGER DEFAULT 0');
  addColumnIfNotExists(db, 'programas_fuente', 'es_fixture_prueba INTEGER DEFAULT 0');
  addColumnIfNotExists(db, 'programas_fuente', 'instalado_por_actualizador INTEGER DEFAULT 0');
  addColumnIfNotExists(db, 'programas_fuente', 'oficial_actual_protegido INTEGER DEFAULT 0');
  addColumnIfNotExists(db, 'programas_fuente', 'origen_remoto TEXT');
  addColumnIfNotExists(db, 'programas_fuente', 'fecha_instalacion TEXT');
}

module.exports = {
  version: 4,
  name: '004_content_updates',
  up
};
