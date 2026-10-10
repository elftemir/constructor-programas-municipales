/**
 * Migración 001: Esquema inicial de Fase 2 (referencia estable 2.0.10)
 */

function up(db, { tableExists }) {
  db.run(`
    CREATE TABLE IF NOT EXISTS catalogo_info (
      id TEXT PRIMARY KEY,
      version TEXT,
      fecha_revision TEXT,
      descripcion TEXT,
      idiomas_disponibles TEXT,
      total_areas INTEGER,
      total_medidas INTEGER
    );

    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      orden INTEGER,
      nombre TEXT,
      nombre_es TEXT,
      nombre_ca TEXT,
      pagina_inicio INTEGER
    );

    CREATE TABLE IF NOT EXISTS medidas (
      id TEXT PRIMARY KEY,
      codigo TEXT,
      orden INTEGER,
      area_id TEXT,
      area_nombre TEXT,
      titulo TEXT,
      titulo_es TEXT,
      titulo_ca TEXT,
      texto TEXT,
      texto_es TEXT,
      texto_ca TEXT,
      explicacion TEXT,
      explicacion_es TEXT,
      explicacion_ca TEXT,
      pagina_inicio INTEGER,
      pagina_fin INTEGER,
      dudoso INTEGER,
      motivo_duda TEXT
    );

    CREATE TABLE IF NOT EXISTS proyectos (
      id TEXT PRIMARY KEY,
      municipio TEXT NOT NULL,
      provincia TEXT,
      comunidad_autonoma TEXT,
      partido TEXT DEFAULT 'Podemos',
      organizacion TEXT,
      mandato TEXT DEFAULT '2027–2031',
      idioma_principal TEXT DEFAULT 'es',
      idioma_secundario TEXT DEFAULT 'ca',
      habitantes INTEGER,
      fecha_electoral TEXT,
      lema TEXT,
      presupuesto_municipal REAL,
      presupuesto_inversiones REAL,
      empresas_municipales_json TEXT DEFAULT '[]',
      servicios_json TEXT DEFAULT '{}',
      logo_path TEXT,
      codigo_ine TEXT,
      poblacion_fuente TEXT DEFAULT 'Idescat / INE',
      poblacion_ano TEXT DEFAULT '2025',
      poblacion_modificada INTEGER DEFAULT 0,
      organizacion_modificada INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS fichas_municipios (
      codigo_ine TEXT PRIMARY KEY,
      municipio TEXT NOT NULL,
      provincia TEXT,
      comunidad_autonoma TEXT,
      poblacion_oficial INTEGER,
      poblacion_usuario INTEGER,
      fuente_poblacion TEXT DEFAULT 'Idescat / INE',
      ano_poblacion TEXT DEFAULT '2025',
      partido TEXT,
      organizacion TEXT,
      mandato TEXT,
      lema TEXT,
      fecha_electoral TEXT,
      presupuesto_municipal REAL,
      presupuesto_inversiones REAL,
      empresas_municipales_json TEXT DEFAULT '[]',
      servicios_json TEXT DEFAULT '{}',
      logo_path TEXT,
      logo_filename TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS decisiones_medidas (
      id TEXT PRIMARY KEY,
      proyecto_id TEXT NOT NULL,
      medida_id TEXT NOT NULL,
      estado TEXT DEFAULT 'sin_revisar',
      version_municipal_titulo TEXT,
      version_municipal_texto TEXT,
      version_municipal_explicacion TEXT,
      nota_interna TEXT,
      estado_idioma_secundario TEXT DEFAULT 'sin_traducir',
      traduccion_titulo TEXT,
      traduccion_texto TEXT,
      traduccion_explicacion TEXT,
      estado_traduccion TEXT DEFAULT 'sin_traduccion',
      propuesta_ia_texto TEXT,
      propuesta_ia_titulo TEXT,
      propuesta_ia_tipo TEXT,
      propuesta_ia_fecha TEXT,
      texto_anterior TEXT,
      titulo_anterior TEXT,
      updated_at TEXT,
      FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
      FOREIGN KEY (medida_id) REFERENCES medidas(id)
    );

    CREATE TABLE IF NOT EXISTS medidas_propias (
      id TEXT PRIMARY KEY,
      proyecto_id TEXT NOT NULL,
      area_id TEXT NOT NULL,
      codigo TEXT,
      orden INTEGER DEFAULT 999,
      posicion TEXT DEFAULT 'fin',
      posicion_referencia_id TEXT,
      titulo TEXT,
      texto TEXT NOT NULL,
      explicacion TEXT,
      nota_interna TEXT,
      estado TEXT DEFAULT 'incluida',
      traduccion_titulo TEXT,
      traduccion_texto TEXT,
      traduccion_explicacion TEXT,
      estado_traduccion TEXT DEFAULT 'sin_traduccion',
      propuesta_ia_texto TEXT,
      propuesta_ia_titulo TEXT,
      texto_anterior TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
      FOREIGN KEY (area_id) REFERENCES areas(id)
    );

    CREATE TABLE IF NOT EXISTS textos_generales (
      proyecto_id TEXT PRIMARY KEY,
      presentacion_titulo TEXT,
      presentacion_entradilla TEXT,
      presentacion_parrafos_json TEXT DEFAULT '[]',
      presentacion_traduccion_json TEXT DEFAULT '[]',
      introducciones_areas_json TEXT DEFAULT '{}',
      cierre_titulo TEXT,
      cierre_parrafos_json TEXT DEFAULT '[]',
      cierre_traduccion_json TEXT DEFAULT '[]',
      presentacion_estado_traduccion TEXT DEFAULT 'sin_traduccion',
      cierre_estado_traduccion TEXT DEFAULT 'sin_traduccion',
      introducciones_traduccion_json TEXT DEFAULT '{}',
      introducciones_estado_traduccion_json TEXT DEFAULT '{}',
      bilingue_json TEXT DEFAULT '{}',
      updated_at TEXT,
      FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_modelos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      archivo TEXT NOT NULL,
      ruta TEXT,
      tamano_bytes INTEGER,
      parametros TEXT,
      cuantizacion TEXT,
      recomendado INTEGER DEFAULT 0,
      instalado INTEGER DEFAULT 0,
      descripcion TEXT,
      url_descarga TEXT,
      fecha_instalacion TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_historial (
      id TEXT PRIMARY KEY,
      proyecto_id TEXT,
      tipo_tarea TEXT,
      referencia_id TEXT,
      prompt TEXT,
      respuesta_ia TEXT,
      avisos_json TEXT DEFAULT '[]',
      estado TEXT DEFAULT 'propuesta',
      texto_anterior TEXT,
      created_at TEXT
    );
  `);
}

module.exports = {
  version: 1,
  name: '001_initial_schema',
  up
};
