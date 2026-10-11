const { getDb, save } = require('../db/database');
const crypto = require('crypto');

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
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

async function getProjects() {
  const db = await getDb();
  const projects = queryAll(db, `SELECT * FROM proyectos ORDER BY updated_at DESC`);

  return projects.map(p => {
    const stats = calculateProjectStats(db, p.id);
    return {
      ...p,
      empresas_municipales: JSON.parse(p.empresas_municipales_json || '[]'),
      servicios: JSON.parse(p.servicios_json || '{}'),
      stats
    };
  });
}

function calculateProjectStats(db, projectId) {
  const projRow = queryOne(db, `SELECT fuente_id FROM proyectos WHERE id = ?`, [projectId]);
  const fuenteId = projRow?.fuente_id || 'fuente_marco_oficial';

  let totalMarcoRow = queryOne(db, `SELECT COUNT(*) as count FROM medidas WHERE fuente_id = ?`, [fuenteId]);
  if (!totalMarcoRow || totalMarcoRow.count === 0) {
    totalMarcoRow = queryOne(db, `SELECT COUNT(*) as count FROM medidas WHERE fuente_id = 'fuente_marco_oficial'`);
  }
  const totalMarco = totalMarcoRow ? totalMarcoRow.count : 123;

  const counts = queryAll(db, `
    SELECT estado, COUNT(*) as count 
    FROM decisiones_medidas 
    WHERE proyecto_id = ? 
    GROUP BY estado
  `, [projectId]);

  const map = {
    sin_revisar: 0,
    incluida: 0,
    adaptada: 0,
    en_duda: 0
  };

  for (const c of counts) {
    if (c.estado === 'descartada') {
      map.sin_revisar = (map.sin_revisar || 0) + c.count;
    } else if (map[c.estado] !== undefined) {
      map[c.estado] = c.count;
    }
  }

  const propiasRow = queryOne(db, `
    SELECT COUNT(*) as count FROM medidas_propias WHERE proyecto_id = ?
  `, [projectId]);
  const medidasPropias = propiasRow ? propiasRow.count : 0;

  const decididas = map.incluida + map.adaptada;
  const progresoPct = totalMarco > 0 ? Math.round((decididas / totalMarco) * 100) : 0;

  return {
    total_marco: totalMarco,
    decididas,
    progreso_pct: progresoPct,
    incluidas: map.incluida,
    adaptadas: map.adaptada,
    descartadas: 0,
    en_duda: map.en_duda,
    sin_revisar: map.sin_revisar,
    medidas_propias: medidasPropias
  };
}

async function getProject(id) {
  const db = await getDb();
  try {
    db.run(`UPDATE decisiones_medidas SET estado = 'sin_revisar' WHERE proyecto_id = ? AND estado = 'descartada'`, [id]);
    db.run(`UPDATE medidas_propias SET estado = 'sin_revisar' WHERE proyecto_id = ? AND estado = 'descartada'`, [id]);
  } catch (e) {}

  const project = queryOne(db, `SELECT * FROM proyectos WHERE id = ?`, [id]);
  if (!project) return null;

  const stats = calculateProjectStats(db, id);
  const fuenteId = project.fuente_id || 'fuente_marco_oficial';
  let areas = queryAll(db, `SELECT * FROM areas WHERE fuente_id = ? ORDER BY orden ASC`, [fuenteId]);
  let medidas = queryAll(db, `SELECT * FROM medidas WHERE fuente_id = ? ORDER BY orden ASC`, [fuenteId]);
  if (!areas || areas.length === 0) {
    areas = queryAll(db, `SELECT * FROM areas WHERE fuente_id = 'fuente_marco_oficial' ORDER BY orden ASC`);
    medidas = queryAll(db, `SELECT * FROM medidas WHERE fuente_id = 'fuente_marco_oficial' ORDER BY orden ASC`);
  }

  const decisiones = queryAll(db, `SELECT * FROM decisiones_medidas WHERE proyecto_id = ?`, [id]);
  const medidasPropias = queryAll(db, `SELECT * FROM medidas_propias WHERE proyecto_id = ? ORDER BY orden ASC, created_at ASC`, [id]);
  const textosGenerales = queryOne(db, `SELECT * FROM textos_generales WHERE proyecto_id = ?`, [id]);

  const decisionesMap = {};
  for (const d of decisiones) {
    if (d.estado === 'descartada') d.estado = 'sin_revisar';
    decisionesMap[d.medida_id] = d;
  }
  for (const p of medidasPropias) {
    if (p.estado === 'descartada') p.estado = 'sin_revisar';
  }

  const lang = project.idioma_principal || 'es';

  // Group measures by area
  const areasWithMeasures = areas.map(a => {
    const localizedAreaName = (lang === 'ca' && a.nombre_ca) ? a.nombre_ca : (a.nombre_es || a.nombre);

    const areaMedidas = medidas.filter(m => m.area_id === a.id).map(m => {
      const catTitulo = (lang === 'ca' && m.titulo_ca) ? m.titulo_ca : (m.titulo_es || m.titulo);
      const catTexto = (lang === 'ca' && m.texto_ca) ? m.texto_ca : (m.texto_es || m.texto);
      const catExplicacion = (lang === 'ca' && m.explicacion_ca) ? m.explicacion_ca : (m.explicacion_es || m.explicacion);

      const decision = decisionesMap[m.id] || {
        estado: 'sin_revisar',
        version_municipal_titulo: catTitulo,
        version_municipal_texto: catTexto,
        version_municipal_explicacion: catExplicacion,
        nota_interna: null
      };

      // Si la medida no ha sido revisada, asegurar que muestre el texto del catálogo en el idioma activo como valor por defecto si no hay personalización
      if (decision.estado === 'sin_revisar') {
        if (!decision.version_municipal_titulo && decision.version_municipal_titulo !== '') {
          decision.version_municipal_titulo = catTitulo;
        }
        if (!decision.version_municipal_texto && decision.version_municipal_texto !== '') {
          decision.version_municipal_texto = catTexto;
        }
        if (!decision.version_municipal_explicacion && decision.version_municipal_explicacion !== '') {
          decision.version_municipal_explicacion = catExplicacion;
        }
      }

      // Soporte de títulos y textos bilingües independientes
      const isProjectCa = lang === 'ca';
      decision.titulo_es = isProjectCa ? (decision.traduccion_titulo || '') : (decision.version_municipal_titulo || m.titulo_es || m.titulo);
      decision.titulo_ca = isProjectCa ? (decision.version_municipal_titulo || m.titulo_ca || m.titulo) : (decision.traduccion_titulo || '');
      decision.texto_es = isProjectCa ? (decision.traduccion_texto || '') : (decision.version_municipal_texto || m.texto_es || m.texto);
      decision.texto_ca = isProjectCa ? (decision.version_municipal_texto || m.texto_ca || m.texto) : (decision.traduccion_texto || '');

      const esModificada = decision.estado === 'adaptada' ||
                           (decision.version_municipal_texto && decision.version_municipal_texto.trim() !== (catTexto || '').trim()) ||
                           (decision.version_municipal_titulo && decision.version_municipal_titulo.trim() !== (catTitulo || '').trim());

      return {
        ...m,
        titulo: catTitulo,
        texto: catTexto,
        explicacion: catExplicacion,
        decision,
        es_modificada: esModificada
      };
    });

    const areaPropias = medidasPropias.filter(p => p.area_id === a.id);

    return {
      ...a,
      nombre: localizedAreaName,
      medidas: areaMedidas,
      medidas_propias: areaPropias
    };
  });

  // Migración y resolución bilingüe compatible para textos generales
  let bilingue = {};
  try {
    if (textosGenerales && textosGenerales.bilingue_json) {
      bilingue = JSON.parse(textosGenerales.bilingue_json);
    }
  } catch (e) { bilingue = {}; }

  const pLang = project.idioma_principal || 'es';
  const secLang = pLang === 'ca' ? 'es' : 'ca';

  // 1. Presentación bilingüe
  const presParrafosOrig = JSON.parse(textosGenerales?.presentacion_parrafos_json || '[]');
  const presTradParsed = JSON.parse(textosGenerales?.presentacion_traduccion_json || '[]');
  const presTradParrafos = Array.isArray(presTradParsed) ? presTradParsed : (presTradParsed?.parrafos || []);
  const presTradTitulo = presTradParsed?.titulo || (secLang === 'ca' ? 'Presentació' : 'Presentación');
  const presTradEntradilla = presTradParsed?.entradilla || '';

  const presBilingue = bilingue.presentacion || {
    es: {
      titulo: pLang === 'es' ? (textosGenerales?.presentacion_titulo || 'Presentación') : presTradTitulo,
      entradilla: pLang === 'es' ? (textosGenerales?.presentacion_entradilla || '') : presTradEntradilla,
      parrafos: pLang === 'es' ? presParrafosOrig : presTradParrafos,
      estado: pLang === 'es' ? 'original' : (presTradParrafos.length > 0 ? (textosGenerales?.presentacion_estado_traduccion || 'propuesta') : 'sin_traduccion')
    },
    ca: {
      titulo: pLang === 'ca' ? (textosGenerales?.presentacion_titulo || 'Presentació') : presTradTitulo,
      entradilla: pLang === 'ca' ? (textosGenerales?.presentacion_entradilla || '') : presTradEntradilla,
      parrafos: pLang === 'ca' ? presParrafosOrig : presTradParrafos,
      estado: pLang === 'ca' ? 'original' : (presTradParrafos.length > 0 ? (textosGenerales?.presentacion_estado_traduccion || 'propuesta') : 'sin_traduccion')
    }
  };

  // 2. Introducciones de áreas bilingües
  const rawIntroAreas = JSON.parse(textosGenerales?.introducciones_areas_json || '{}');
  const rawIntroTrads = JSON.parse(textosGenerales?.introducciones_traduccion_json || '{}');
  const rawIntroEstados = JSON.parse(textosGenerales?.introducciones_estado_traduccion_json || '{}');

  const introBilingue = bilingue.introducciones_areas || {};
  areas.forEach(a => {
    if (!introBilingue[a.id]) {
      const itemRaw = rawIntroAreas[a.id];
      // Si el item ya viene con claves bilingües es/ca
      if (itemRaw && (itemRaw.es || itemRaw.ca)) {
        introBilingue[a.id] = {
          es: itemRaw.es || { entradilla: '', texto: '', frase_destacada: '', estado: 'sin_traduccion' },
          ca: itemRaw.ca || { entradilla: '', texto: '', frase_destacada: '', estado: 'sin_traduccion' }
        };
      } else {
        const itemOrig = itemRaw || {};
        const itemTrad = rawIntroTrads[a.id] || {};
        const estadoTrad = rawIntroEstados[a.id] || (itemTrad.texto ? 'propuesta' : 'sin_traduccion');

        introBilingue[a.id] = {
          es: {
            entradilla: pLang === 'es' ? (itemOrig.entradilla || '') : (itemTrad.entradilla || ''),
            texto: pLang === 'es' ? (itemOrig.texto || '') : (itemTrad.texto || ''),
            frase_destacada: pLang === 'es' ? (itemOrig.frase_destacada || '') : (itemTrad.frase_destacada || ''),
            estado: pLang === 'es' ? 'original' : estadoTrad
          },
          ca: {
            entradilla: pLang === 'ca' ? (itemOrig.entradilla || '') : (itemTrad.entradilla || ''),
            texto: pLang === 'ca' ? (itemOrig.texto || '') : (itemTrad.texto || ''),
            frase_destacada: pLang === 'ca' ? (itemOrig.frase_destacada || '') : (itemTrad.frase_destacada || ''),
            estado: pLang === 'ca' ? 'original' : estadoTrad
          }
        };
      }
    }
    // Proyecciones planas de compatibilidad en el idioma principal del proyecto
    if (introBilingue[a.id]) {
      const mainIntro = introBilingue[a.id][pLang] || {};
      introBilingue[a.id].entradilla = mainIntro.entradilla || '';
      introBilingue[a.id].texto = mainIntro.texto || '';
      introBilingue[a.id].frase_destacada = mainIntro.frase_destacada || '';
    }
  });

  // 3. Cierre bilingüe
  const cierreParrafosOrig = JSON.parse(textosGenerales?.cierre_parrafos_json || '[]');
  const cierreTradParsed = JSON.parse(textosGenerales?.cierre_traduccion_json || '[]');
  const cierreTradParrafos = Array.isArray(cierreTradParsed) ? cierreTradParsed : (cierreTradParsed?.parrafos || []);
  const cierreTradTitulo = cierreTradParsed?.titulo || (secLang === 'ca' ? 'Tancament' : 'Cierre');

  const cierreBilingue = bilingue.cierre || {
    es: {
      titulo: pLang === 'es' ? (textosGenerales?.cierre_titulo || 'Cierre') : cierreTradTitulo,
      parrafos: pLang === 'es' ? cierreParrafosOrig : cierreTradParrafos,
      estado: pLang === 'es' ? 'original' : (cierreTradParrafos.length > 0 ? (textosGenerales?.cierre_estado_traduccion || 'propuesta') : 'sin_traduccion')
    },
    ca: {
      titulo: pLang === 'ca' ? (textosGenerales?.cierre_titulo || 'Tancament') : cierreTradTitulo,
      parrafos: pLang === 'ca' ? cierreParrafosOrig : cierreTradParrafos,
      estado: pLang === 'ca' ? 'original' : (cierreTradParrafos.length > 0 ? (textosGenerales?.cierre_estado_traduccion || 'propuesta') : 'sin_traduccion')
    }
  };

  return {
    ...project,
    empresas_municipales: JSON.parse(project.empresas_municipales_json || '[]'),
    servicios: JSON.parse(project.servicios_json || '{}'),
    stats,
    areas: areasWithMeasures,
    textos_generales: textosGenerales ? {
      presentacion: presBilingue,
      introducciones_areas: introBilingue,
      cierre: cierreBilingue,
      // Proyecciones planas en idioma principal para compatibilidad total con vistas anteriores
      presentacion_titulo: presBilingue[pLang]?.titulo || textosGenerales.presentacion_titulo,
      presentacion_entradilla: presBilingue[pLang]?.entradilla || textosGenerales.presentacion_entradilla,
      presentacion_parrafos: presBilingue[pLang]?.parrafos || JSON.parse(textosGenerales.presentacion_parrafos_json || '[]'),
      presentacion_traduccion: presBilingue[secLang]?.parrafos || [],
      presentacion_estado_traduccion: presBilingue[secLang]?.estado || 'sin_traduccion',
      cierre_titulo: cierreBilingue[pLang]?.titulo || textosGenerales.cierre_titulo,
      cierre_parrafos: cierreBilingue[pLang]?.parrafos || JSON.parse(textosGenerales.cierre_parrafos_json || '[]'),
      cierre_traduccion: cierreBilingue[secLang]?.parrafos || [],
      cierre_estado_traduccion: cierreBilingue[secLang]?.estado || 'sin_traduccion'
    } : null
  };
}

async function createProject(data) {
  const db = await getDb();
  const id = 'proj_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();

  const idiomaPrincipal = data.idioma_principal || 'es';
  const idiomaSecundario = idiomaPrincipal === 'es' ? 'ca' : 'es';
  const partido = (data.partido || 'Podemos').trim();
  const municipio = (data.municipio || '').trim();
  const organizacion = (data.organizacion || `${partido} ${municipio}`).trim();
  const mandato = (data.mandato || '2027–2031').trim();

  // Validate fecha_electoral: if present must be Sunday
  let fechaElectoral = data.fecha_electoral || null;
  if (fechaElectoral) {
    const d = new Date(fechaElectoral);
    if (d.getUTCDay() !== 0) {
      fechaElectoral = null; // discard if not Sunday according to requirements
    }
  }

  const sourceProgramService = require('./sourceProgramService');
  const activeFuente = await sourceProgramService.getActive();
  const fuenteId = data.fuente_id || (activeFuente ? activeFuente.id : 'fuente_marco_oficial');

  db.run(`
    INSERT INTO proyectos (
      id, fuente_id, municipio, provincia, comunidad_autonoma, partido, organizacion, mandato,
      idioma_principal, idioma_secundario, habitantes, fecha_electoral, lema,
      presupuesto_municipal, presupuesto_inversiones, empresas_municipales_json,
      servicios_json, logo_path, codigo_ine, poblacion_fuente, poblacion_ano,
      poblacion_modificada, organizacion_modificada, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    fuenteId,
    municipio,
    data.provincia || '',
    data.comunidad_autonoma || '',
    partido,
    organizacion,
    mandato,
    idiomaPrincipal,
    idiomaSecundario,
    data.habitantes ? parseInt(data.habitantes, 10) : null,
    fechaElectoral,
    data.lema ? data.lema.slice(0, 60) : null,
    data.presupuesto_municipal ? parseFloat(data.presupuesto_municipal) : null,
    data.presupuesto_inversiones ? parseFloat(data.presupuesto_inversiones) : null,
    JSON.stringify(data.empresas_municipales || []),
    JSON.stringify(data.servicios || {}),
    data.logo_path || null,
    data.codigo_ine || null,
    data.poblacion_fuente || 'Idescat / INE',
    data.poblacion_ano || '2025',
    data.poblacion_modificada ? 1 : 0,
    data.organizacion_modificada ? 1 : 0,
    now,
    now
  ]);

  // Initialize measures with state 'sin_revisar' in project's language from source program
  let catalogMedidas = queryAll(db, `SELECT * FROM medidas WHERE fuente_id = ? ORDER BY orden ASC`, [fuenteId]);
  if (!catalogMedidas || catalogMedidas.length === 0) {
    catalogMedidas = queryAll(db, `SELECT * FROM medidas WHERE fuente_id = 'fuente_marco_oficial' ORDER BY orden ASC`);
  }
  for (const m of catalogMedidas) {
    const decId = `dec_${id}_${m.id}`;
    const initialTitulo = (idiomaPrincipal === 'ca' && m.titulo_ca) ? m.titulo_ca : (m.titulo_es || m.titulo);
    const initialTexto = (idiomaPrincipal === 'ca' && m.texto_ca) ? m.texto_ca : (m.texto_es || m.texto);
    const initialExplicacion = (idiomaPrincipal === 'ca' && m.explicacion_ca) ? m.explicacion_ca : (m.explicacion_es || m.explicacion);

    db.run(`
      INSERT INTO decisiones_medidas (
        id, proyecto_id, medida_id, estado, version_municipal_titulo,
        version_municipal_texto, version_municipal_explicacion, nota_interna,
        updated_at
      ) VALUES (?, ?, ?, 'sin_revisar', ?, ?, ?, NULL, ?)
    `, [
      decId,
      id,
      m.id,
      initialTitulo,
      initialTexto,
      initialExplicacion,
      now
    ]);
  }

  // Initialize empty general texts (Fase 1: No inventar contenido predeterminado)
  db.run(`
    INSERT INTO textos_generales (
      proyecto_id, presentacion_titulo, presentacion_entradilla,
      presentacion_parrafos_json, presentacion_traduccion_json,
      introducciones_areas_json, cierre_titulo, cierre_parrafos_json,
      cierre_traduccion_json, updated_at
    ) VALUES (?, '', '', '[]', '[]', '{}', '', '[]', '[]', ?)
  `, [
    id,
    now
  ]);

  save();
  return id;
}

async function updateProjectData(id, data) {
  const db = await getDb();
  const existing = queryOne(db, `SELECT * FROM proyectos WHERE id = ?`, [id]);
  if (!existing) throw new Error('Proyecto no encontrado');

  const now = new Date().toISOString();

  // Rule:
  // - undefined (not sent): preserve existing value
  // - null: explicit clear (if allowed)
  // - value: update
  const municipio = data.municipio !== undefined
    ? (data.municipio !== null ? String(data.municipio).trim() : existing.municipio)
    : existing.municipio;

  const provincia = data.provincia !== undefined
    ? (data.provincia !== null ? String(data.provincia).trim() : '')
    : existing.provincia;

  const comunidad_autonoma = data.comunidad_autonoma !== undefined
    ? (data.comunidad_autonoma !== null ? String(data.comunidad_autonoma).trim() : 'Cataluña')
    : existing.comunidad_autonoma;

  const partido = data.partido !== undefined
    ? (data.partido !== null ? String(data.partido).trim() : 'Podemos')
    : existing.partido;

  const organizacion_modificada = data.organizacion_modificada !== undefined
    ? (data.organizacion_modificada ? 1 : 0)
    : (existing.organizacion_modificada || 0);

  let organizacion = existing.organizacion;
  if (data.organizacion !== undefined) {
    organizacion = (data.organizacion !== null ? String(data.organizacion).trim() : '');
  } else if (!organizacion_modificada && (data.partido !== undefined || data.municipio !== undefined)) {
    organizacion = `${partido} ${municipio}`.trim();
  }


  const mandato = data.mandato !== undefined
    ? (data.mandato !== null ? String(data.mandato).trim() : '2027–2031')
    : existing.mandato;

  const idioma_principal = data.idioma_principal !== undefined
    ? data.idioma_principal
    : existing.idioma_principal;

  const idioma_secundario = data.idioma_secundario !== undefined
    ? data.idioma_secundario
    : (data.idioma_principal !== undefined ? (data.idioma_principal === 'es' ? 'ca' : 'es') : existing.idioma_secundario);

  const habitantes = data.habitantes !== undefined
    ? (data.habitantes !== null && data.habitantes !== '' ? parseInt(data.habitantes, 10) : null)
    : existing.habitantes;

  let fechaElectoral = existing.fecha_electoral;
  if (data.fecha_electoral !== undefined) {
    if (data.fecha_electoral === null || data.fecha_electoral === '') {
      fechaElectoral = null;
    } else {
      const d = new Date(data.fecha_electoral);
      fechaElectoral = (d.getUTCDay() === 0) ? data.fecha_electoral : null;
    }
  }

  const lema = data.lema !== undefined
    ? (data.lema !== null && data.lema !== '' ? String(data.lema).trim().slice(0, 60) : null)
    : existing.lema;

  const presupuesto_municipal = data.presupuesto_municipal !== undefined
    ? (data.presupuesto_municipal !== null && data.presupuesto_municipal !== '' ? parseFloat(data.presupuesto_municipal) : null)
    : existing.presupuesto_municipal;

  const presupuesto_inversiones = data.presupuesto_inversiones !== undefined
    ? (data.presupuesto_inversiones !== null && data.presupuesto_inversiones !== '' ? parseFloat(data.presupuesto_inversiones) : null)
    : existing.presupuesto_inversiones;

  const empresas_municipales_json = data.empresas_municipales !== undefined
    ? (data.empresas_municipales !== null ? JSON.stringify(data.empresas_municipales) : '[]')
    : existing.empresas_municipales_json;

  const servicios_json = data.servicios !== undefined
    ? (data.servicios !== null ? JSON.stringify(data.servicios) : '{}')
    : existing.servicios_json;

  const logo_path = data.logo_path !== undefined
    ? (data.logo_path !== null ? data.logo_path : null)
    : existing.logo_path;

  const codigo_ine = data.codigo_ine !== undefined
    ? (data.codigo_ine !== null ? data.codigo_ine : null)
    : existing.codigo_ine;

  const poblacion_fuente = data.poblacion_fuente !== undefined
    ? (data.poblacion_fuente !== null ? data.poblacion_fuente : 'Idescat / INE')
    : existing.poblacion_fuente;

  const poblacion_ano = data.poblacion_ano !== undefined
    ? (data.poblacion_ano !== null ? data.poblacion_ano : '2025')
    : existing.poblacion_ano;

  const poblacion_modificada = data.poblacion_modificada !== undefined
    ? (data.poblacion_modificada ? 1 : 0)
    : (existing.poblacion_modificada || 0);

  db.run(`
    UPDATE proyectos SET
      municipio = ?,
      provincia = ?,
      comunidad_autonoma = ?,
      partido = ?,
      organizacion = ?,
      mandato = ?,
      idioma_principal = ?,
      idioma_secundario = ?,
      habitantes = ?,
      fecha_electoral = ?,
      lema = ?,
      presupuesto_municipal = ?,
      presupuesto_inversiones = ?,
      empresas_municipales_json = ?,
      servicios_json = ?,
      logo_path = ?,
      codigo_ine = ?,
      poblacion_fuente = ?,
      poblacion_ano = ?,
      poblacion_modificada = ?,
      organizacion_modificada = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    municipio,
    provincia,
    comunidad_autonoma,
    partido,
    organizacion,
    mandato,
    idioma_principal,
    idioma_secundario,
    habitantes,
    fechaElectoral,
    lema,
    presupuesto_municipal,
    presupuesto_inversiones,
    empresas_municipales_json,
    servicios_json,
    logo_path,
    codigo_ine,
    poblacion_fuente,
    poblacion_ano,
    poblacion_modificada,
    organizacion_modificada,
    now,
    id
  ]);

  // Si cambia el idioma principal, actualizar las medidas no modificadas al nuevo idioma del catálogo
  if (data.idioma_principal && data.idioma_principal !== existing.idioma_principal) {
    const newLang = data.idioma_principal;
    const oldLang = existing.idioma_principal;
    const catMedidas = queryAll(db, `SELECT * FROM medidas`);
    for (const m of catMedidas) {
      const dec = queryOne(db, `SELECT * FROM decisiones_medidas WHERE proyecto_id = ? AND medida_id = ?`, [id, m.id]);
      if (!dec) continue;

      const oldCatTexto = (oldLang === 'ca' && m.texto_ca) ? m.texto_ca : (m.texto_es || m.texto);
      const newCatTexto = (newLang === 'ca' && m.texto_ca) ? m.texto_ca : (m.texto_es || m.texto);
      const newCatTitulo = (newLang === 'ca' && m.titulo_ca) ? m.titulo_ca : (m.titulo_es || m.titulo);
      const newCatExp = (newLang === 'ca' && m.explicacion_ca) ? m.explicacion_ca : (m.explicacion_es || m.explicacion);

      if (dec.estado === 'sin_revisar') {
        db.run(`
          UPDATE decisiones_medidas 
          SET version_municipal_titulo = ?, version_municipal_texto = ?, version_municipal_explicacion = ?, updated_at = ?
          WHERE id = ?
        `, [newCatTitulo, newCatTexto, newCatExp, now, dec.id]);
      } else if (dec.estado === 'incluida') {
        // Si no ha sido alterado manualmente por el usuario respecto al catálogo del idioma anterior
        if (!dec.version_municipal_texto || dec.version_municipal_texto.trim() === (oldCatTexto || '').trim()) {
          db.run(`
            UPDATE decisiones_medidas 
            SET version_municipal_titulo = ?, version_municipal_texto = ?, version_municipal_explicacion = ?, updated_at = ?
            WHERE id = ?
          `, [newCatTitulo, newCatTexto, newCatExp, now, dec.id]);
        }
      }
    }
  }

  save();
  return true;
}

async function deleteProject(id) {
  const db = await getDb();
  db.run(`DELETE FROM decisiones_medidas WHERE proyecto_id = ?`, [id]);
  db.run(`DELETE FROM medidas_propias WHERE proyecto_id = ?`, [id]);
  db.run(`DELETE FROM textos_generales WHERE proyecto_id = ?`, [id]);
  db.run(`DELETE FROM proyectos WHERE id = ?`, [id]);
  save();
  return true;
}

async function updateMeasureDecision(projectId, measureId, update) {
  const db = await getDb();
  const now = new Date().toISOString();

  const project = queryOne(db, `SELECT * FROM proyectos WHERE id = ?`, [projectId]);
  const lang = project ? project.idioma_principal : 'es';

  const originalMedida = queryOne(db, `SELECT * FROM medidas WHERE id = ?`, [measureId]);
  if (!originalMedida) throw new Error('Medida no encontrada en catálogo');

  const currentDecision = queryOne(db, `
    SELECT * FROM decisiones_medidas WHERE proyecto_id = ? AND medida_id = ?
  `, [projectId, measureId]);

  if (!currentDecision) throw new Error('Decisión no encontrada para proyecto');

  // Textos originales del catálogo para el idioma del proyecto
  const origTexto = (lang === 'ca' && originalMedida.texto_ca) ? originalMedida.texto_ca : (originalMedida.texto_es || originalMedida.texto);
  const origTitulo = (lang === 'ca' && originalMedida.titulo_ca) ? originalMedida.titulo_ca : (originalMedida.titulo_es || originalMedida.titulo);
  const origExplicacion = (lang === 'ca' && originalMedida.explicacion_ca) ? originalMedida.explicacion_ca : (originalMedida.explicacion_es || originalMedida.explicacion);

  let nuevoEstado = update.estado !== undefined ? update.estado : currentDecision.estado;
  let nuevoTexto = update.version_municipal_texto !== undefined ? update.version_municipal_texto : currentDecision.version_municipal_texto;
  let nuevoTitulo = update.version_municipal_titulo !== undefined ? update.version_municipal_titulo : currentDecision.version_municipal_titulo;
  let nuevaExplicacion = update.version_municipal_explicacion !== undefined ? update.version_municipal_explicacion : currentDecision.version_municipal_explicacion;
  let nuevaNota = update.nota_interna !== undefined ? update.nota_interna : currentDecision.nota_interna;

  // Si se solicita restaurar original
  if (update.restaurar_original) {
    nuevoTexto = origTexto;
    nuevoTitulo = origTitulo;
    nuevaExplicacion = origExplicacion;
    nuevoEstado = 'incluida';
  } else {
    // Si el texto municipal es modificado y el estado elegido es 'incluida' o 'adaptada'
    const textoModificado = (nuevoTexto && nuevoTexto.trim() !== (origTexto || '').trim()) ||
                            (nuevoTitulo && nuevoTitulo.trim() !== (origTitulo || '').trim());
    if (textoModificado && (nuevoEstado === 'incluida' || nuevoEstado === 'adaptada')) {
      nuevoEstado = 'adaptada';
    } else if (!textoModificado && nuevoEstado === 'adaptada') {
      nuevoEstado = 'incluida';
    }
  }

  let nuevoEstadoTrad = update.estado_traduccion !== undefined ? update.estado_traduccion : (currentDecision.estado_traduccion || 'sin_traduccion');
  const sourceChanged = (nuevoTexto && nuevoTexto.trim() !== (currentDecision.version_municipal_texto || '').trim()) ||
                        (nuevoTitulo && nuevoTitulo.trim() !== (currentDecision.version_municipal_titulo || '').trim());
  if (sourceChanged && update.estado_traduccion === undefined) {
    if (nuevoEstadoTrad === 'revisada' || nuevoEstadoTrad === 'propuesta' || nuevoEstadoTrad === 'traduccion_propuesta') {
      nuevoEstadoTrad = 'desactualizada';
    }
  }

  let nuevoPropuestaIaTexto = update.propuesta_ia_texto !== undefined ? update.propuesta_ia_texto : currentDecision.propuesta_ia_texto;
  let nuevoPropuestaIaTitulo = update.propuesta_ia_titulo !== undefined ? update.propuesta_ia_titulo : currentDecision.propuesta_ia_titulo;
  let nuevoPropuestaIaTipo = update.propuesta_ia_tipo !== undefined ? update.propuesta_ia_tipo : currentDecision.propuesta_ia_tipo;
  let nuevoPropuestaIaFecha = update.propuesta_ia_fecha !== undefined ? update.propuesta_ia_fecha : currentDecision.propuesta_ia_fecha;
  let nuevoTextoAnterior = update.texto_anterior !== undefined ? update.texto_anterior : currentDecision.texto_anterior;
  let nuevoTituloAnterior = update.titulo_anterior !== undefined ? update.titulo_anterior : currentDecision.titulo_anterior;
  let nuevoTradTitulo = update.traduccion_titulo !== undefined ? update.traduccion_titulo : currentDecision.traduccion_titulo;
  let nuevoTradTexto = update.traduccion_texto !== undefined ? update.traduccion_texto : currentDecision.traduccion_texto;
  let nuevoTradExp = update.traduccion_explicacion !== undefined ? update.traduccion_explicacion : currentDecision.traduccion_explicacion;

  db.run(`
    UPDATE decisiones_medidas SET
      estado = ?,
      version_municipal_titulo = ?,
      version_municipal_texto = ?,
      version_municipal_explicacion = ?,
      nota_interna = ?,
      estado_traduccion = ?,
      traduccion_titulo = ?,
      traduccion_texto = ?,
      traduccion_explicacion = ?,
      propuesta_ia_texto = ?,
      propuesta_ia_titulo = ?,
      propuesta_ia_tipo = ?,
      propuesta_ia_fecha = ?,
      texto_anterior = ?,
      titulo_anterior = ?,
      updated_at = ?
    WHERE proyecto_id = ? AND medida_id = ?
  `, [
    nuevoEstado,
    nuevoTitulo,
    nuevoTexto,
    nuevaExplicacion,
    nuevaNota,
    nuevoEstadoTrad,
    nuevoTradTitulo,
    nuevoTradTexto,
    nuevoTradExp,
    nuevoPropuestaIaTexto,
    nuevoPropuestaIaTitulo,
    nuevoPropuestaIaTipo,
    nuevoPropuestaIaFecha,
    nuevoTextoAnterior,
    nuevoTituloAnterior,
    now,
    projectId,
    measureId
  ]);

  db.run(`UPDATE proyectos SET updated_at = ? WHERE id = ?`, [now, projectId]);
  save();

  return {
    estado: nuevoEstado,
    version_municipal_texto: nuevoTexto,
    version_municipal_titulo: nuevoTitulo,
    version_municipal_explicacion: nuevaExplicacion,
    nota_interna: nuevaNota,
    estado_traduccion: nuevoEstadoTrad,
    traduccion_titulo: nuevoTradTitulo,
    traduccion_texto: nuevoTradTexto,
    traduccion_explicacion: nuevoTradExp,
    propuesta_ia_texto: nuevoPropuestaIaTexto,
    propuesta_ia_titulo: nuevoPropuestaIaTitulo,
    es_modificada: nuevoTexto.trim() !== (origTexto || '').trim()
  };
}

async function batchUpdateDecisions(projectId, measureIds, newEstado) {
  const db = await getDb();
  const now = new Date().toISOString();

  const project = queryOne(db, `SELECT * FROM proyectos WHERE id = ?`, [projectId]);
  const lang = project ? project.idioma_principal : 'es';

  for (const mid of measureIds) {
    const original = queryOne(db, `SELECT * FROM medidas WHERE id = ?`, [mid]);
    const current = queryOne(db, `SELECT * FROM decisiones_medidas WHERE proyecto_id = ? AND medida_id = ?`, [projectId, mid]);
    if (!original || !current) continue;

    const origTexto = (lang === 'ca' && original.texto_ca) ? original.texto_ca : (original.texto_es || original.texto);
    let estadoFinal = newEstado;
    const textoModificado = current.version_municipal_texto && current.version_municipal_texto.trim() !== (origTexto || '').trim();
    if (newEstado === 'incluida' && textoModificado) {
      estadoFinal = 'adaptada';
    }

    db.run(`
      UPDATE decisiones_medidas SET estado = ?, updated_at = ?
      WHERE proyecto_id = ? AND medida_id = ?
    `, [estadoFinal, now, projectId, mid]);
  }

  db.run(`UPDATE proyectos SET updated_at = ? WHERE id = ?`, [now, projectId]);
  save();
  return true;
}

async function addOwnMeasure(projectId, data) {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = 'prop_' + crypto.randomBytes(6).toString('hex');

  // Count existing own measures in area to assign code
  const countRow = queryOne(db, `
    SELECT COUNT(*) as count FROM medidas_propias WHERE proyecto_id = ? AND area_id = ?
  `, [projectId, data.area_id]);
  const areaRow = queryOne(db, `SELECT * FROM areas WHERE id = ?`, [data.area_id]);
  const areaOrden = areaRow ? areaRow.orden : 1;
  const numPropia = (countRow ? countRow.count : 0) + 1;
  const codigo = `${areaOrden}.P${numPropia}`;

  const posicion = data.posicion || 'fin';
  const orden = posicion === 'inicio' ? 0 : (posicion === 'fin' ? 999 : (parseInt(data.orden, 10) || 500));

  db.run(`
    INSERT INTO medidas_propias (
      id, proyecto_id, area_id, codigo, orden, posicion, posicion_referencia_id,
      titulo, texto, explicacion, nota_interna, estado, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'incluida', ?, ?)
  `, [
    id,
    projectId,
    data.area_id,
    codigo,
    orden,
    posicion,
    data.posicion_referencia_id || null,
    data.titulo || null,
    (data.texto || '').trim(),
    data.explicacion ? data.explicacion.trim() : null,
    data.nota_interna ? data.nota_interna.trim() : null,
    now,
    now
  ]);

  db.run(`UPDATE proyectos SET updated_at = ? WHERE id = ?`, [now, projectId]);
  save();
  return id;
}

async function updateOwnMeasure(id, data) {
  const db = await getDb();
  const now = new Date().toISOString();
  const current = queryOne(db, `SELECT * FROM medidas_propias WHERE id = ?`, [id]);
  if (!current) throw new Error('Medida propia no encontrada');

  let nuevoTexto = data.texto !== undefined ? (data.texto ? data.texto.trim() : '') : current.texto;
  let nuevoTitulo = data.titulo !== undefined ? (data.titulo ? data.titulo.trim() : null) : current.titulo;
  let nuevoEstadoTrad = data.estado_traduccion !== undefined ? data.estado_traduccion : (current.estado_traduccion || 'sin_traduccion');

  const sourceChanged = (nuevoTexto !== current.texto) || (nuevoTitulo !== current.titulo);
  if (sourceChanged && data.estado_traduccion === undefined) {
    if (nuevoEstadoTrad === 'revisada' || nuevoEstadoTrad === 'propuesta' || nuevoEstadoTrad === 'traduccion_propuesta') {
      nuevoEstadoTrad = 'desactualizada';
    }
  }

  let nuevoTradTitulo = data.traduccion_titulo !== undefined ? data.traduccion_titulo : current.traduccion_titulo;
  let nuevoTradTexto = data.traduccion_texto !== undefined ? data.traduccion_texto : current.traduccion_texto;
  let nuevoTradExp = data.traduccion_explicacion !== undefined ? data.traduccion_explicacion : current.traduccion_explicacion;
  let nuevoPropuestaIaTexto = data.propuesta_ia_texto !== undefined ? data.propuesta_ia_texto : current.propuesta_ia_texto;
  let nuevoPropuestaIaTitulo = data.propuesta_ia_titulo !== undefined ? data.propuesta_ia_titulo : current.propuesta_ia_titulo;
  let nuevoTextoAnterior = data.texto_anterior !== undefined ? data.texto_anterior : current.texto_anterior;

  db.run(`
    UPDATE medidas_propias SET
      area_id = COALESCE(?, area_id),
      posicion = COALESCE(?, posicion),
      orden = COALESCE(?, orden),
      titulo = ?,
      texto = ?,
      explicacion = ?,
      nota_interna = ?,
      estado_traduccion = ?,
      traduccion_titulo = ?,
      traduccion_texto = ?,
      traduccion_explicacion = ?,
      propuesta_ia_texto = ?,
      propuesta_ia_titulo = ?,
      texto_anterior = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    data.area_id || null,
    data.posicion || null,
    data.orden !== undefined ? parseInt(data.orden, 10) : null,
    nuevoTitulo,
    nuevoTexto,
    data.explicacion !== undefined ? (data.explicacion ? data.explicacion.trim() : null) : current.explicacion,
    data.nota_interna !== undefined ? (data.nota_interna ? data.nota_interna.trim() : null) : current.nota_interna,
    nuevoEstadoTrad,
    nuevoTradTitulo,
    nuevoTradTexto,
    nuevoTradExp,
    nuevoPropuestaIaTexto,
    nuevoPropuestaIaTitulo,
    nuevoTextoAnterior,
    now,
    id
  ]);

  save();
  return true;
}

async function deleteOwnMeasure(id) {
  const db = await getDb();
  db.run(`DELETE FROM medidas_propias WHERE id = ?`, [id]);
  save();
  return true;
}

async function updateGeneralTexts(projectId, data) {
  const db = await getDb();
  const now = new Date().toISOString();

  const project = queryOne(db, `SELECT * FROM proyectos WHERE id = ?`, [projectId]);
  const pLang = project ? (project.idioma_principal || 'es') : 'es';
  const secLang = pLang === 'ca' ? 'es' : 'ca';

  const existing = queryOne(db, `SELECT * FROM textos_generales WHERE proyecto_id = ?`, [projectId]);
  let existingBilingue = {};
  try {
    if (existing && existing.bilingue_json) existingBilingue = JSON.parse(existing.bilingue_json);
  } catch(e) {}

  // 1. Presentación: la estructura bilingüe canónica tiene prioridad absoluta
  let presBilingue = {
    es: { titulo: 'Presentación', entradilla: '', parrafos: [], estado: 'original' },
    ca: { titulo: 'Presentació', entradilla: '', parrafos: [], estado: 'sin_traduccion' },
    ...(existingBilingue.presentacion || {}),
    ...(data.presentacion || {})
  };
  const editLang = data.idioma_edicion || pLang;
  const hasExplicitPres = data.presentacion && data.presentacion[editLang];
  if (!hasExplicitPres && (data.presentacion_titulo !== undefined || data.presentacion_parrafos !== undefined)) {
    presBilingue[editLang] = {
      titulo: data.presentacion_titulo !== undefined ? data.presentacion_titulo : (presBilingue[editLang]?.titulo || (editLang === 'ca' ? 'Presentació' : 'Presentación')),
      entradilla: data.presentacion_entradilla !== undefined ? data.presentacion_entradilla : (presBilingue[editLang]?.entradilla || ''),
      parrafos: data.presentacion_parrafos !== undefined ? data.presentacion_parrafos : (presBilingue[editLang]?.parrafos || []),
      estado: presBilingue[editLang]?.estado || (editLang === pLang ? 'original' : 'revisada')
    };
  }

  // 2. Introducciones de áreas
  let introBilingue = {};
  const allAreaIds = new Set([
    ...Object.keys(existingBilingue.introducciones_areas || {}),
    ...Object.keys(data.introducciones_areas || {})
  ]);
  allAreaIds.forEach(aid => {
    const ex = (existingBilingue.introducciones_areas && existingBilingue.introducciones_areas[aid]) || {};
    const dt = (data.introducciones_areas && data.introducciones_areas[aid]) || {};
    if ((dt.es || dt.ca) || (ex.es || ex.ca)) {
      introBilingue[aid] = {
        es: dt.es || ex.es || { entradilla: '', texto: '', frase_destacada: '', estado: 'original' },
        ca: dt.ca || ex.ca || { entradilla: '', texto: '', frase_destacada: '', estado: 'sin_traduccion' }
      };
    } else {
      introBilingue[aid] = { ...ex, ...dt };
    }
  });

  // Si introducciones_areas vino en formato plano, mapear al idioma de edición
  if (data.introducciones_areas && typeof data.introducciones_areas === 'object') {
    Object.keys(data.introducciones_areas).forEach(aid => {
      const val = data.introducciones_areas[aid];
      if (val && !val.es && !val.ca) {
        // Formato plano
        const prevObj = introBilingue[aid] || {
          es: { entradilla: '', texto: '', frase_destacada: '', estado: 'original' },
          ca: { entradilla: '', texto: '', frase_destacada: '', estado: 'sin_traduccion' }
        };
        introBilingue[aid] = {
          ...prevObj,
          [editLang]: {
            entradilla: val.entradilla || '',
            texto: val.texto || '',
            frase_destacada: val.frase_destacada || '',
            estado: editLang === pLang ? 'original' : 'revisada'
          }
        };
      }
    });
  }

  // 3. Cierre: la estructura bilingüe canónica tiene prioridad absoluta
  let cierreBilingue = {
    es: { titulo: 'Cierre', parrafos: [], estado: 'original' },
    ca: { titulo: 'Tancament', parrafos: [], estado: 'sin_traduccion' },
    ...(existingBilingue.cierre || {}),
    ...(data.cierre || {})
  };
  const hasExplicitCierre = data.cierre && data.cierre[editLang];
  if (!hasExplicitCierre && (data.cierre_titulo !== undefined || data.cierre_parrafos !== undefined)) {
    cierreBilingue[editLang] = {
      titulo: data.cierre_titulo !== undefined ? data.cierre_titulo : (cierreBilingue[editLang]?.titulo || (editLang === 'ca' ? 'Tancament' : 'Cierre')),
      parrafos: data.cierre_parrafos !== undefined ? data.cierre_parrafos : (cierreBilingue[editLang]?.parrafos || []),
      estado: cierreBilingue[editLang]?.estado || (editLang === pLang ? 'original' : 'revisada')
    };
  }

  const bilingueJson = JSON.stringify({
    presentacion: presBilingue,
    introducciones_areas: introBilingue,
    cierre: cierreBilingue
  });

  const presMain = presBilingue[pLang] || {};
  const presSec = presBilingue[secLang] || {};
  const cierreMain = cierreBilingue[pLang] || {};
  const cierreSec = cierreBilingue[secLang] || {};

  db.run(`
    INSERT OR REPLACE INTO textos_generales (
      proyecto_id, presentacion_titulo, presentacion_entradilla,
      presentacion_parrafos_json, presentacion_traduccion_json,
      introducciones_areas_json, cierre_titulo, cierre_parrafos_json,
      cierre_traduccion_json, presentacion_estado_traduccion,
      cierre_estado_traduccion, introducciones_traduccion_json,
      introducciones_estado_traduccion_json, bilingue_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    projectId,
    presMain.titulo || (pLang === 'ca' ? 'Presentació' : 'Presentación'),
    presMain.entradilla || '',
    JSON.stringify(presMain.parrafos || []),
    JSON.stringify(presSec.parrafos || []),
    JSON.stringify(introBilingue),
    cierreMain.titulo || (pLang === 'ca' ? 'Tancament' : 'Cierre'),
    JSON.stringify(cierreMain.parrafos || []),
    JSON.stringify(cierreSec.parrafos || []),
    presSec.estado || 'sin_traduccion',
    cierreSec.estado || 'sin_traduccion',
    JSON.stringify(data.introducciones_traduccion || {}),
    JSON.stringify(data.introducciones_estado_traduccion || {}),
    bilingueJson,
    now
  ]);

  db.run(`UPDATE proyectos SET updated_at = ? WHERE id = ?`, [now, projectId]);
  save();
  return true;
}

async function getCatalogInfo() {
  const db = await getDb();
  const info = queryOne(db, `SELECT * FROM catalogo_info WHERE id = 'marco_principal'`);
  const areas = queryAll(db, `SELECT * FROM areas ORDER BY orden ASC`);
  const medidas = queryAll(db, `SELECT * FROM medidas ORDER BY orden ASC`);

  return {
    info,
    areas: areas.map(a => ({
      ...a,
      medidas: medidas.filter(m => m.area_id === a.id)
    }))
  };
}

async function duplicateProject(projectId) {
  const db = await getDb();
  const original = queryOne(db, `SELECT * FROM proyectos WHERE id = ?`, [projectId]);
  if (!original) throw new Error('Proyecto no encontrado');

  const newId = 'proj_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();
  const copyName = `${original.municipio} (Copia)`;

  db.run(`
    INSERT INTO proyectos (
      id, fuente_id, municipio, provincia, comunidad_autonoma, partido, organizacion, mandato,
      idioma_principal, idioma_secundario, habitantes, fecha_electoral, lema,
      presupuesto_municipal, presupuesto_inversiones, empresas_municipales_json,
      servicios_json, logo_path, codigo_ine, poblacion_fuente, poblacion_ano,
      poblacion_modificada, organizacion_modificada, mapeo_fuentes_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newId, original.fuente_id || 'fuente_marco_oficial', copyName, original.provincia, original.comunidad_autonoma,
    original.partido, `${original.partido} ${copyName}`, original.mandato,
    original.idioma_principal, original.idioma_secundario, original.habitantes,
    original.fecha_electoral, original.lema, original.presupuesto_municipal,
    original.presupuesto_inversiones, original.empresas_municipales_json,
    original.servicios_json, original.logo_path,
    original.codigo_ine, original.poblacion_fuente || 'Idescat / INE',
    original.poblacion_ano || '2025', original.poblacion_modificada || 0,
    original.organizacion_modificada || 0,
    original.mapeo_fuentes_json || '{}',
    now, now
  ]);

  // Clone source links (principal & complementarias)
  const fuentesRel = queryAll(db, `SELECT * FROM proyecto_fuentes WHERE proyecto_id = ?`, [projectId]);
  for (const pf of fuentesRel) {
    const newPfId = `pf_${newId}_${pf.fuente_id}`;
    db.run(`
      INSERT OR REPLACE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida)
      VALUES (?, ?, ?, ?, ?)
    `, [newPfId, newId, pf.fuente_id, pf.rol, now]);
  }
  const hasPrincipal = fuentesRel.some(f => f.rol === 'principal');
  if (!hasPrincipal) {
    const pFuenteId = original.fuente_id || 'fuente_marco_oficial';
    db.run(`
      INSERT OR REPLACE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida)
      VALUES (?, ?, ?, 'principal', ?)
    `, [`pf_${newId}_${pFuenteId}`, newId, pFuenteId, now]);
  }

  // Copy decisions
  const decisiones = queryAll(db, `SELECT * FROM decisiones_medidas WHERE proyecto_id = ?`, [projectId]);
  for (const d of decisiones) {
    const newDecId = `dec_${newId}_${d.medida_id}`;
    db.run(`
      INSERT INTO decisiones_medidas (
        id, proyecto_id, medida_id, estado, version_municipal_titulo,
        version_municipal_texto, version_municipal_explicacion, nota_interna,
        estado_idioma_secundario, traduccion_titulo, traduccion_texto, traduccion_explicacion,
        estado_traduccion, propuesta_ia_texto, propuesta_ia_titulo, propuesta_ia_tipo,
        propuesta_ia_fecha, texto_anterior, titulo_anterior, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newDecId, newId, d.medida_id, d.estado, d.version_municipal_titulo,
      d.version_municipal_texto, d.version_municipal_explicacion, d.nota_interna,
      d.estado_idioma_secundario || 'sin_traducir', d.traduccion_titulo || null,
      d.traduccion_texto || null, d.traduccion_explicacion || null,
      d.estado_traduccion || 'sin_traduccion', d.propuesta_ia_texto || null,
      d.propuesta_ia_titulo || null, d.propuesta_ia_tipo || null,
      d.propuesta_ia_fecha || null, d.texto_anterior || null,
      d.titulo_anterior || null, now
    ]);
  }

  // Copy own measures
  const propias = queryAll(db, `SELECT * FROM medidas_propias WHERE proyecto_id = ?`, [projectId]);
  for (const p of propias) {
    const newPropId = 'prop_' + crypto.randomBytes(6).toString('hex');
    db.run(`
      INSERT INTO medidas_propias (
        id, proyecto_id, area_id, codigo, orden, posicion, posicion_referencia_id,
        titulo, texto, explicacion, nota_interna, estado,
        traduccion_titulo, traduccion_texto, traduccion_explicacion,
        estado_traduccion, propuesta_ia_texto, propuesta_ia_titulo, texto_anterior,
        fuente_origen_id, medida_origen_id, numero_origen, fuente_nombre,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newPropId, newId, p.area_id, p.codigo || null, p.orden || 999,
      p.posicion || 'fin', p.posicion_referencia_id || null,
      p.titulo || null, p.texto, p.explicacion || null, p.nota_interna || null,
      p.estado || 'incluida',
      p.traduccion_titulo || null, p.traduccion_texto || null, p.traduccion_explicacion || null,
      p.estado_traduccion || 'sin_traduccion', p.propuesta_ia_texto || null,
      p.propuesta_ia_titulo || null, p.texto_anterior || null,
      p.fuente_origen_id || null, p.medida_origen_id || null,
      p.numero_origen || null, p.fuente_nombre || null,
      now, now
    ]);
  }

  // Copy general texts
  const genTexts = queryOne(db, `SELECT * FROM textos_generales WHERE proyecto_id = ?`, [projectId]);
  if (genTexts) {
    db.run(`
      INSERT INTO textos_generales (
        proyecto_id, presentacion_titulo, presentacion_entradilla, presentacion_parrafos_json,
        presentacion_traduccion_json, introducciones_areas_json, cierre_titulo,
        cierre_parrafos_json, cierre_traduccion_json, presentacion_estado_traduccion,
        cierre_estado_traduccion, introducciones_traduccion_json,
        introducciones_estado_traduccion_json, bilingue_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newId, genTexts.presentacion_titulo, genTexts.presentacion_entradilla,
      genTexts.presentacion_parrafos_json, genTexts.presentacion_traduccion_json,
      genTexts.introducciones_areas_json, genTexts.cierre_titulo,
      genTexts.cierre_parrafos_json, genTexts.cierre_traduccion_json,
      genTexts.presentacion_estado_traduccion || 'sin_traduccion',
      genTexts.cierre_estado_traduccion || 'sin_traduccion',
      genTexts.introducciones_traduccion_json || '{}',
      genTexts.introducciones_estado_traduccion_json || '{}',
      genTexts.bilingue_json || '{}',
      now
    ]);
  }

  save();
  return newId;
}

async function duplicateProjectForMunicipio(sourceProjectId, newMunicipioData, fichaData = null) {
  const db = await getDb();
  const original = queryOne(db, `SELECT * FROM proyectos WHERE id = ?`, [sourceProjectId]);
  if (!original) throw new Error('Proyecto origen no encontrado');

  const newId = 'proj_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();

  const newMun = (newMunicipioData.nombre || newMunicipioData.municipio || '').trim();
  let partido = original.partido || 'Podemos';
  const mandato = original.mandato || '2027–2031';
  let organizacion = `${partido} ${newMun}`.trim();
  let lema = null;
  let fechaElectoral = null;
  let presupuestoMun = null;
  let presupuestoInv = null;
  let empresas = [];
  let servicios = {};
  let logoPath = null;
  let poblacionOficial = newMunicipioData.poblacion || null;
  let poblacionFuente = newMunicipioData.fuente_poblacion || 'Idescat / INE';
  let poblacionAno = newMunicipioData.ano_poblacion || '2025';
  let habitantes = poblacionOficial;
  let poblacionModificada = 0;
  let organizacionModificada = 0;

  if (fichaData) {
    if (fichaData.partido) partido = fichaData.partido;
    if (fichaData.organizacion) {
      organizacion = fichaData.organizacion;
      organizacionModificada = 1;
    }
    if (fichaData.lema) lema = fichaData.lema;
    if (fichaData.fecha_electoral) fechaElectoral = fichaData.fecha_electoral;
    if (fichaData.presupuesto_municipal !== null && fichaData.presupuesto_municipal !== undefined) {
      presupuestoMun = fichaData.presupuesto_municipal;
    }
    if (fichaData.presupuesto_inversiones !== null && fichaData.presupuesto_inversiones !== undefined) {
      presupuestoInv = fichaData.presupuesto_inversiones;
    }
    if (fichaData.empresas_municipales && fichaData.empresas_municipales.length > 0) {
      empresas = fichaData.empresas_municipales;
    }
    if (fichaData.servicios && Object.keys(fichaData.servicios).length > 0) {
      servicios = fichaData.servicios;
    }
    if (fichaData.logo_path) logoPath = fichaData.logo_path;
    if (fichaData.poblacion_usuario) {
      habitantes = fichaData.poblacion_usuario;
      poblacionModificada = 1;
    }
  }

  db.run(`
    INSERT INTO proyectos (
      id, fuente_id, municipio, provincia, comunidad_autonoma, partido, organizacion, mandato,
      idioma_principal, idioma_secundario, habitantes, fecha_electoral, lema,
      presupuesto_municipal, presupuesto_inversiones, empresas_municipales_json,
      servicios_json, logo_path, codigo_ine, poblacion_fuente, poblacion_ano,
      poblacion_modificada, organizacion_modificada, mapeo_fuentes_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newId, original.fuente_id || 'fuente_marco_oficial', newMun, newMunicipioData.provincia || '', newMunicipioData.comunidad_autonoma || 'Cataluña',
    partido, organizacion, mandato,
    original.idioma_principal, original.idioma_secundario, habitantes,
    fechaElectoral, lema, presupuestoMun,
    presupuestoInv, JSON.stringify(empresas),
    JSON.stringify(servicios), logoPath,
    newMunicipioData.codigo_ine || null, poblacionFuente,
    poblacionAno, poblacionModificada, organizacionModificada,
    original.mapeo_fuentes_json || '{}',
    now, now
  ]);

  // Clone source links (principal & complementarias)
  const fuentesRel = queryAll(db, `SELECT * FROM proyecto_fuentes WHERE proyecto_id = ?`, [sourceProjectId]);
  for (const pf of fuentesRel) {
    const newPfId = `pf_${newId}_${pf.fuente_id}`;
    db.run(`
      INSERT OR REPLACE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida)
      VALUES (?, ?, ?, ?, ?)
    `, [newPfId, newId, pf.fuente_id, pf.rol, now]);
  }
  const hasPrincipal = fuentesRel.some(f => f.rol === 'principal');
  if (!hasPrincipal) {
    const pFuenteId = original.fuente_id || 'fuente_marco_oficial';
    db.run(`
      INSERT OR REPLACE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida)
      VALUES (?, ?, ?, 'principal', ?)
    `, [`pf_${newId}_${pFuenteId}`, newId, pFuenteId, now]);
  }

  // Clone decisions
  const decisiones = queryAll(db, `SELECT * FROM decisiones_medidas WHERE proyecto_id = ?`, [sourceProjectId]);
  for (const d of decisiones) {
    const newDecId = `dec_${newId}_${d.medida_id}`;
    db.run(`
      INSERT INTO decisiones_medidas (
        id, proyecto_id, medida_id, estado, version_municipal_titulo,
        version_municipal_texto, version_municipal_explicacion, nota_interna,
        estado_idioma_secundario, traduccion_titulo, traduccion_texto, traduccion_explicacion,
        estado_traduccion, propuesta_ia_texto, propuesta_ia_titulo, propuesta_ia_tipo,
        propuesta_ia_fecha, texto_anterior, titulo_anterior, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newDecId, newId, d.medida_id, d.estado, d.version_municipal_titulo,
      d.version_municipal_texto, d.version_municipal_explicacion, d.nota_interna,
      d.estado_idioma_secundario || 'sin_traducir', d.traduccion_titulo || null,
      d.traduccion_texto || null, d.traduccion_explicacion || null,
      d.estado_traduccion || 'sin_traduccion', d.propuesta_ia_texto || null,
      d.propuesta_ia_titulo || null, d.propuesta_ia_tipo || null,
      d.propuesta_ia_fecha || null, d.texto_anterior || null,
      d.titulo_anterior || null, now
    ]);
  }

  // Clone own measures
  const propias = queryAll(db, `SELECT * FROM medidas_propias WHERE proyecto_id = ?`, [sourceProjectId]);
  for (const p of propias) {
    const newPropId = 'prop_' + crypto.randomBytes(6).toString('hex');
    db.run(`
      INSERT INTO medidas_propias (
        id, proyecto_id, area_id, codigo, orden, posicion, posicion_referencia_id,
        titulo, texto, explicacion, nota_interna, estado,
        traduccion_titulo, traduccion_texto, traduccion_explicacion,
        estado_traduccion, propuesta_ia_texto, propuesta_ia_titulo, texto_anterior,
        fuente_origen_id, medida_origen_id, numero_origen, fuente_nombre,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newPropId, newId, p.area_id, p.codigo || null, p.orden || 999,
      p.posicion || 'fin', p.posicion_referencia_id || null,
      p.titulo || null, p.texto, p.explicacion || null, p.nota_interna || null,
      p.estado || 'incluida',
      p.traduccion_titulo || null, p.traduccion_texto || null, p.traduccion_explicacion || null,
      p.estado_traduccion || 'sin_traduccion', p.propuesta_ia_texto || null,
      p.propuesta_ia_titulo || null, p.texto_anterior || null,
      p.fuente_origen_id || null, p.medida_origen_id || null,
      p.numero_origen || null, p.fuente_nombre || null,
      now, now
    ]);
  }

  // Clone general texts
  const genTexts = queryOne(db, `SELECT * FROM textos_generales WHERE proyecto_id = ?`, [sourceProjectId]);
  if (genTexts) {
    db.run(`
      INSERT INTO textos_generales (
        proyecto_id, presentacion_titulo, presentacion_entradilla, presentacion_parrafos_json,
        presentacion_traduccion_json, introducciones_areas_json, cierre_titulo,
        cierre_parrafos_json, cierre_traduccion_json, presentacion_estado_traduccion,
        cierre_estado_traduccion, introducciones_traduccion_json,
        introducciones_estado_traduccion_json, bilingue_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newId, genTexts.presentacion_titulo, genTexts.presentacion_entradilla,
      genTexts.presentacion_parrafos_json, genTexts.presentacion_traduccion_json,
      genTexts.introducciones_areas_json, genTexts.cierre_titulo,
      genTexts.cierre_parrafos_json, genTexts.cierre_traduccion_json,
      genTexts.presentacion_estado_traduccion || 'sin_traduccion',
      genTexts.cierre_estado_traduccion || 'sin_traduccion',
      genTexts.introducciones_traduccion_json || '{}',
      genTexts.introducciones_estado_traduccion_json || '{}',
      genTexts.bilingue_json || '{}',
      now
    ]);
  }

  save();
  return newId;
}

async function renameProject(projectId, newMunicipio) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(`UPDATE proyectos SET municipio = ?, updated_at = ? WHERE id = ?`, [newMunicipio.trim(), now, projectId]);
  save();
  return true;
}

const MAX_IMPORT_JSON_BYTES = 25 * 1024 * 1024; // 25 MB: amplio para proyectos reales grandes, previene DoS por memoria
const ALLOWED_DECISION_STATES = new Set(['sin_revisar', 'incluida', 'adaptada', 'en_duda', 'descartada']);
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function sanitizeUntrustedJson(val, depth = 0) {
  if (depth > 20) {
    throw new Error('Formato de archivo inválido: estructura JSON demasiado profunda');
  }
  if (val === null || val === undefined) return val;
  const t = typeof val;
  if (t === 'string' || t === 'boolean') return val;
  if (t === 'number') {
    if (!Number.isFinite(val)) {
      throw new Error('Formato de archivo inválido: valor numérico no finito');
    }
    return val;
  }
  if (t !== 'object') {
    throw new Error('Formato de archivo inválido: tipo de dato no permitido');
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeUntrustedJson(item, depth + 1));
  }
  const clean = {};
  for (const key of Object.keys(val)) {
    if (DANGEROUS_OBJECT_KEYS.has(key)) {
      continue;
    }
    clean[key] = sanitizeUntrustedJson(val[key], depth + 1);
  }
  return clean;
}

function isPlainObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

function requireOptString(val, fieldName, maxLen = 5000, allowPrimitiveCoerce = false) {
  if (val === null || val === undefined) return null;
  if (allowPrimitiveCoerce && (typeof val === 'number' || typeof val === 'boolean')) {
    val = String(val);
  }
  if (typeof val !== 'string') {
    throw new Error(`Formato de archivo inválido: el campo "${fieldName}" debe ser una cadena de texto`);
  }
  if (val.length > maxLen) {
    throw new Error(`Formato de archivo inválido: el campo "${fieldName}" supera la longitud máxima permitida`);
  }
  return val;
}

function requireOptNumber(val, fieldName) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'object' || typeof val === 'boolean') {
    throw new Error(`Formato de archivo inválido: el campo numérico "${fieldName}" no es válido`);
  }
  const n = typeof val === 'number' ? val : Number(String(val).trim());
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Formato de archivo inválido: el campo numérico "${fieldName}" debe ser un número positivo válido`);
  }
  return n;
}

function normalizeValidatedJsonField(val, fieldName, expectedKind = 'object', fallback = '{}') {
  if (val === null || val === undefined || val === '') return fallback;
  let parsed = val;
  if (typeof val === 'string') {
    if (val.length > 5 * 1024 * 1024) {
      throw new Error(`Formato de archivo inválido: el campo "${fieldName}" es excesivamente grande`);
    }
    try {
      parsed = JSON.parse(val);
    } catch (e) {
      throw new Error(`Formato de archivo inválido: JSON malformado en "${fieldName}"`);
    }
  }
  if (expectedKind === 'array') {
    if (!Array.isArray(parsed)) {
      throw new Error(`Formato de archivo inválido: "${fieldName}" debe contener una lista JSON`);
    }
  } else if (expectedKind === 'object') {
    if (!isPlainObject(parsed)) {
      throw new Error(`Formato de archivo inválido: "${fieldName}" debe contener un objeto JSON`);
    }
  } else if (expectedKind === 'any') {
    if (!Array.isArray(parsed) && !isPlainObject(parsed)) {
      throw new Error(`Formato de archivo inválido: "${fieldName}" debe contener una estructura JSON válida`);
    }
  }
  const sanitized = sanitizeUntrustedJson(parsed);
  return JSON.stringify(sanitized);
}

function validateImportedProjectJson(rawInput) {
  let parsedData = rawInput;
  if (typeof rawInput === 'string') {
    if (Buffer.byteLength(rawInput, 'utf8') > MAX_IMPORT_JSON_BYTES) {
      throw new Error('El archivo JSON supera el límite máximo permitido (25 MB)');
    }
    try {
      parsedData = JSON.parse(rawInput);
    } catch (e) {
      throw new Error('Archivo JSON inválido o corrupto: no se pudo interpretar su sintaxis');
    }
  }

  if (!isPlainObject(parsedData)) {
    throw new Error('Formato de archivo inválido: la raíz del archivo debe ser un objeto JSON');
  }

  const data = sanitizeUntrustedJson(parsedData);

  if (data.version_formato !== undefined && data.version_formato !== null) {
    requireOptString(data.version_formato, 'version_formato', 32, true);
  }

  if (!isPlainObject(data.proyecto)) {
    throw new Error('Formato de archivo inválido: falta el objeto principal "proyecto"');
  }

  const p = data.proyecto;
  const rawMunicipio = requireOptString(p.municipio, 'proyecto.municipio', 300);
  if (!rawMunicipio || !rawMunicipio.trim()) {
    throw new Error('Formato de archivo inválido: "proyecto.municipio" es obligatorio y no puede estar vacío');
  }
  const municipio = rawMunicipio.trim();
  const provincia = requireOptString(p.provincia, 'proyecto.provincia', 200) || '';
  const comunidad_autonoma = requireOptString(p.comunidad_autonoma, 'proyecto.comunidad_autonoma', 200) || '';
  const partido = requireOptString(p.partido, 'proyecto.partido', 300) || 'Podemos';
  const organizacion = requireOptString(p.organizacion, 'proyecto.organizacion', 300) || '';
  const mandato = requireOptString(p.mandato, 'proyecto.mandato', 100) || '2027–2031';
  const idioma_principal = requireOptString(p.idioma_principal, 'proyecto.idioma_principal', 10) || 'es';
  const idioma_secundario = requireOptString(p.idioma_secundario, 'proyecto.idioma_secundario', 10) || 'ca';

  if (!['es', 'ca'].includes(idioma_principal) || !['es', 'ca'].includes(idioma_secundario)) {
    throw new Error('Formato de archivo inválido: los códigos de idioma deben ser "es" o "ca"');
  }

  const habitantes = requireOptNumber(p.habitantes, 'proyecto.habitantes');
  const fecha_electoral = requireOptString(p.fecha_electoral, 'proyecto.fecha_electoral', 50);
  const lema = requireOptString(p.lema, 'proyecto.lema', 1000);
  const presupuesto_municipal = requireOptNumber(p.presupuesto_municipal, 'proyecto.presupuesto_municipal');
  const presupuesto_inversiones = requireOptNumber(p.presupuesto_inversiones, 'proyecto.presupuesto_inversiones');
  const empresas_municipales_json = normalizeValidatedJsonField(
    p.empresas_municipales_json !== undefined ? p.empresas_municipales_json : p.empresas_municipales,
    'proyecto.empresas_municipales_json',
    'array',
    '[]'
  );
  const servicios_json = normalizeValidatedJsonField(
    p.servicios_json !== undefined ? p.servicios_json : p.servicios,
    'proyecto.servicios_json',
    'object',
    '{}'
  );
  const mapeo_fuentes_json = normalizeValidatedJsonField(
    p.mapeo_fuentes_json !== undefined ? p.mapeo_fuentes_json : p.mapeo_fuentes,
    'proyecto.mapeo_fuentes_json',
    'object',
    '{}'
  );
  const codigo_ine = requireOptString(p.codigo_ine, 'proyecto.codigo_ine', 32, true);
  const poblacion_fuente = requireOptString(p.poblacion_fuente, 'proyecto.poblacion_fuente', 200) || 'Idescat / INE';
  const poblacion_ano = requireOptString(p.poblacion_ano, 'proyecto.poblacion_ano', 20, true) || '2025';
  const poblacion_modificada = p.poblacion_modificada ? 1 : 0;
  const organizacion_modificada = p.organizacion_modificada ? 1 : 0;
  const fuente_id = requireOptString(p.fuente_id, 'proyecto.fuente_id', 200) || 'fuente_marco_oficial';

  const validatedDecisiones = [];
  if (data.decisiones !== undefined && data.decisiones !== null) {
    if (!Array.isArray(data.decisiones)) {
      throw new Error('Formato de archivo inválido: "decisiones" debe ser una lista');
    }
    if (data.decisiones.length > 10000) {
      throw new Error('Formato de archivo inválido: número de decisiones excede el límite permitido');
    }
    for (let i = 0; i < data.decisiones.length; i++) {
      const d = data.decisiones[i];
      if (!isPlainObject(d)) {
        throw new Error(`Formato de archivo inválido: decisión en posición ${i} no es un objeto válido`);
      }
      const medida_id = requireOptString(d.medida_id, `decisiones[${i}].medida_id`, 200);
      if (!medida_id || !medida_id.trim()) {
        throw new Error(`Formato de archivo inválido: falta medida_id en decisiones[${i}]`);
      }
      const rawEstado = requireOptString(d.estado, `decisiones[${i}].estado`, 50) || 'sin_revisar';
      if (!ALLOWED_DECISION_STATES.has(rawEstado)) {
        throw new Error(`Formato de archivo inválido: estado "${rawEstado}" no permitido en decisiones[${i}]`);
      }
      const estado = rawEstado === 'descartada' ? 'sin_revisar' : rawEstado;

      validatedDecisiones.push({
        medida_id: medida_id.trim(),
        estado,
        version_municipal_titulo: requireOptString(d.version_municipal_titulo, `decisiones[${i}].version_municipal_titulo`, 2000),
        version_municipal_texto: requireOptString(d.version_municipal_texto, `decisiones[${i}].version_municipal_texto`, 100000),
        version_municipal_explicacion: requireOptString(d.version_municipal_explicacion, `decisiones[${i}].version_municipal_explicacion`, 100000),
        nota_interna: requireOptString(d.nota_interna, `decisiones[${i}].nota_interna`, 50000),
        estado_idioma_secundario: requireOptString(d.estado_idioma_secundario, `decisiones[${i}].estado_idioma_secundario`, 50) || 'sin_traducir',
        traduccion_titulo: requireOptString(d.traduccion_titulo, `decisiones[${i}].traduccion_titulo`, 2000),
        traduccion_texto: requireOptString(d.traduccion_texto, `decisiones[${i}].traduccion_texto`, 100000),
        traduccion_explicacion: requireOptString(d.traduccion_explicacion, `decisiones[${i}].traduccion_explicacion`, 100000),
        estado_traduccion: requireOptString(d.estado_traduccion, `decisiones[${i}].estado_traduccion`, 50) || 'sin_traduccion',
        propuesta_ia_texto: requireOptString(d.propuesta_ia_texto, `decisiones[${i}].propuesta_ia_texto`, 100000),
        propuesta_ia_titulo: requireOptString(d.propuesta_ia_titulo, `decisiones[${i}].propuesta_ia_titulo`, 2000),
        propuesta_ia_tipo: requireOptString(d.propuesta_ia_tipo, `decisiones[${i}].propuesta_ia_tipo`, 100),
        propuesta_ia_fecha: requireOptString(d.propuesta_ia_fecha, `decisiones[${i}].propuesta_ia_fecha`, 100),
        texto_anterior: requireOptString(d.texto_anterior, `decisiones[${i}].texto_anterior`, 100000),
        titulo_anterior: requireOptString(d.titulo_anterior, `decisiones[${i}].titulo_anterior`, 2000)
      });
    }
  }

  const validatedPropias = [];
  if (data.medidas_propias !== undefined && data.medidas_propias !== null) {
    if (!Array.isArray(data.medidas_propias)) {
      throw new Error('Formato de archivo inválido: "medidas_propias" debe ser una lista');
    }
    if (data.medidas_propias.length > 5000) {
      throw new Error('Formato de archivo inválido: número de medidas propias excede el límite permitido');
    }
    for (let i = 0; i < data.medidas_propias.length; i++) {
      const prop = data.medidas_propias[i];
      if (!isPlainObject(prop)) {
        throw new Error(`Formato de archivo inválido: medida propia en posición ${i} no es un objeto válido`);
      }
      const area_id = requireOptString(prop.area_id, `medidas_propias[${i}].area_id`, 200);
      if (!area_id || !area_id.trim()) {
        throw new Error(`Formato de archivo inválido: falta area_id en medidas_propias[${i}]`);
      }
      const texto = requireOptString(prop.texto, `medidas_propias[${i}].texto`, 100000) || '';
      const titulo = requireOptString(prop.titulo, `medidas_propias[${i}].titulo`, 2000);
      const rawEstado = requireOptString(prop.estado, `medidas_propias[${i}].estado`, 50) || 'incluida';
      if (!ALLOWED_DECISION_STATES.has(rawEstado)) {
        throw new Error(`Formato de archivo inválido: estado "${rawEstado}" no permitido en medidas_propias[${i}]`);
      }
      const ordenVal = (prop.orden !== undefined && prop.orden !== null && Number.isFinite(Number(prop.orden))) ? Number(prop.orden) : 999;

      validatedPropias.push({
        area_id: area_id.trim(),
        codigo: requireOptString(prop.codigo, `medidas_propias[${i}].codigo`, 100, true),
        orden: ordenVal,
        posicion: requireOptString(prop.posicion, `medidas_propias[${i}].posicion`, 50) || 'fin',
        posicion_referencia_id: requireOptString(prop.posicion_referencia_id, `medidas_propias[${i}].posicion_referencia_id`, 200),
        titulo,
        texto,
        explicacion: requireOptString(prop.explicacion, `medidas_propias[${i}].explicacion`, 100000),
        nota_interna: requireOptString(prop.nota_interna, `medidas_propias[${i}].nota_interna`, 50000),
        estado: rawEstado === 'descartada' ? 'sin_revisar' : rawEstado,
        traduccion_titulo: requireOptString(prop.traduccion_titulo, `medidas_propias[${i}].traduccion_titulo`, 2000),
        traduccion_texto: requireOptString(prop.traduccion_texto, `medidas_propias[${i}].traduccion_texto`, 100000),
        traduccion_explicacion: requireOptString(prop.traduccion_explicacion, `medidas_propias[${i}].traduccion_explicacion`, 100000),
        estado_traduccion: requireOptString(prop.estado_traduccion, `medidas_propias[${i}].estado_traduccion`, 50) || 'sin_traduccion',
        propuesta_ia_texto: requireOptString(prop.propuesta_ia_texto, `medidas_propias[${i}].propuesta_ia_texto`, 100000),
        propuesta_ia_titulo: requireOptString(prop.propuesta_ia_titulo, `medidas_propias[${i}].propuesta_ia_titulo`, 2000),
        texto_anterior: requireOptString(prop.texto_anterior, `medidas_propias[${i}].texto_anterior`, 100000),
        fuente_origen_id: requireOptString(prop.fuente_origen_id, `medidas_propias[${i}].fuente_origen_id`, 200),
        medida_origen_id: requireOptString(prop.medida_origen_id, `medidas_propias[${i}].medida_origen_id`, 200),
        numero_origen: requireOptString(prop.numero_origen, `medidas_propias[${i}].numero_origen`, 100, true),
        fuente_nombre: requireOptString(prop.fuente_nombre, `medidas_propias[${i}].fuente_nombre`, 300)
      });
    }
  }

  let validatedGenTexts = null;
  if (data.textos_generales !== undefined && data.textos_generales !== null) {
    if (!isPlainObject(data.textos_generales)) {
      throw new Error('Formato de archivo inválido: "textos_generales" debe ser un objeto');
    }
    const g = data.textos_generales;
    validatedGenTexts = {
      presentacion_titulo: requireOptString(g.presentacion_titulo, 'textos_generales.presentacion_titulo', 2000) || 'Presentación',
      presentacion_entradilla: requireOptString(g.presentacion_entradilla, 'textos_generales.presentacion_entradilla', 50000) || '',
      presentacion_parrafos_json: normalizeValidatedJsonField(g.presentacion_parrafos_json, 'textos_generales.presentacion_parrafos_json', 'any', '[]'),
      presentacion_traduccion_json: normalizeValidatedJsonField(g.presentacion_traduccion_json, 'textos_generales.presentacion_traduccion_json', 'any', '[]'),
      introducciones_areas_json: normalizeValidatedJsonField(g.introducciones_areas_json, 'textos_generales.introducciones_areas_json', 'object', '{}'),
      cierre_titulo: requireOptString(g.cierre_titulo, 'textos_generales.cierre_titulo', 2000) || 'Cierre',
      cierre_parrafos_json: normalizeValidatedJsonField(g.cierre_parrafos_json, 'textos_generales.cierre_parrafos_json', 'any', '[]'),
      cierre_traduccion_json: normalizeValidatedJsonField(g.cierre_traduccion_json, 'textos_generales.cierre_traduccion_json', 'any', '[]'),
      presentacion_estado_traduccion: requireOptString(g.presentacion_estado_traduccion, 'textos_generales.presentacion_estado_traduccion', 50) || 'sin_traduccion',
      cierre_estado_traduccion: requireOptString(g.cierre_estado_traduccion, 'textos_generales.cierre_estado_traduccion', 50) || 'sin_traduccion',
      introducciones_traduccion_json: normalizeValidatedJsonField(g.introducciones_traduccion_json, 'textos_generales.introducciones_traduccion_json', 'object', '{}'),
      introducciones_estado_traduccion_json: normalizeValidatedJsonField(g.introducciones_estado_traduccion_json, 'textos_generales.introducciones_estado_traduccion_json', 'object', '{}'),
      bilingue_json: normalizeValidatedJsonField(g.bilingue_json, 'textos_generales.bilingue_json', 'object', '{}')
    };
  }

  const validatedProyectoFuentes = [];
  if (data.proyecto_fuentes !== undefined && data.proyecto_fuentes !== null) {
    if (!Array.isArray(data.proyecto_fuentes)) {
      throw new Error('Formato de archivo inválido: "proyecto_fuentes" debe ser una lista');
    }
    if (data.proyecto_fuentes.length > 200) {
      throw new Error('Formato de archivo inválido: demasiadas fuentes vinculadas');
    }
    for (let i = 0; i < data.proyecto_fuentes.length; i++) {
      const pf = data.proyecto_fuentes[i];
      if (!isPlainObject(pf)) {
        throw new Error(`Formato de archivo inválido: proyecto_fuentes[${i}] no es un objeto válido`);
      }
      const fId = requireOptString(pf.fuente_id, `proyecto_fuentes[${i}].fuente_id`, 200);
      const rol = requireOptString(pf.rol, `proyecto_fuentes[${i}].rol`, 50) || 'complementaria';
      if (!fId || !fId.trim()) {
        throw new Error(`Formato de archivo inválido: falta fuente_id en proyecto_fuentes[${i}]`);
      }
      if (!['principal', 'complementaria'].includes(rol)) {
        throw new Error(`Formato de archivo inválido: rol "${rol}" no válido en proyecto_fuentes[${i}]`);
      }
      validatedProyectoFuentes.push({
        fuente_id: fId.trim(),
        rol
      });
    }
  }

  return {
    proyecto: {
      fuente_id,
      municipio,
      provincia,
      comunidad_autonoma,
      partido,
      organizacion,
      mandato,
      idioma_principal,
      idioma_secundario,
      habitantes,
      fecha_electoral,
      lema,
      presupuesto_municipal,
      presupuesto_inversiones,
      empresas_municipales_json,
      servicios_json,
      mapeo_fuentes_json,
      codigo_ine,
      poblacion_fuente,
      poblacion_ano,
      poblacion_modificada,
      organizacion_modificada
    },
    proyecto_fuentes: validatedProyectoFuentes,
    decisiones: validatedDecisiones,
    medidas_propias: validatedPropias,
    textos_generales: validatedGenTexts
  };
}

async function exportProjectJson(projectId) {
  const db = await getDb();
  const project = queryOne(db, `SELECT * FROM proyectos WHERE id = ?`, [projectId]);
  if (!project) throw new Error('Proyecto no encontrado');

  const proyecto_fuentes = queryAll(db, `SELECT * FROM proyecto_fuentes WHERE proyecto_id = ?`, [projectId]);
  const decisiones = queryAll(db, `SELECT * FROM decisiones_medidas WHERE proyecto_id = ?`, [projectId]);
  const propias = queryAll(db, `SELECT * FROM medidas_propias WHERE proyecto_id = ?`, [projectId]);
  const genTexts = queryOne(db, `SELECT * FROM textos_generales WHERE proyecto_id = ?`, [projectId]);

  return {
    version_formato: '3.0',
    exportado_el: new Date().toISOString(),
    proyecto: project,
    proyecto_fuentes,
    decisiones,
    medidas_propias: propias,
    textos_generales: genTexts
  };
}

async function importProjectJson(rawData) {
  const validated = validateImportedProjectJson(rawData);

  const db = await getDb();
  const newId = 'proj_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();
  const p = validated.proyecto;

  // Verificar existencia de la fuente principal referenciada (fallback seguro a fuente_marco_oficial)
  const existingSource = queryOne(db, `SELECT id FROM programas_fuente WHERE id = ?`, [p.fuente_id]);
  const effectiveFuenteId = existingSource ? p.fuente_id : 'fuente_marco_oficial';

  db.run('BEGIN TRANSACTION;');
  try {
    db.run(`
      INSERT INTO proyectos (
        id, fuente_id, municipio, provincia, comunidad_autonoma, partido, organizacion, mandato,
        idioma_principal, idioma_secundario, habitantes, fecha_electoral, lema,
        presupuesto_municipal, presupuesto_inversiones, empresas_municipales_json,
        servicios_json, logo_path, codigo_ine, poblacion_fuente, poblacion_ano,
        poblacion_modificada, organizacion_modificada, mapeo_fuentes_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newId, effectiveFuenteId, p.municipio, p.provincia, p.comunidad_autonoma,
      p.partido, p.organizacion, p.mandato,
      p.idioma_principal, p.idioma_secundario, p.habitantes,
      p.fecha_electoral, p.lema, p.presupuesto_municipal,
      p.presupuesto_inversiones, p.empresas_municipales_json,
      p.servicios_json, null,
      p.codigo_ine, p.poblacion_fuente,
      p.poblacion_ano, p.poblacion_modificada, p.organizacion_modificada,
      p.mapeo_fuentes_json,
      now, now
    ]);

    // Vincular proyecto_fuentes preservando fuentes existentes y garantizando fuente principal
    let hasPrincipal = false;
    for (const pf of validated.proyecto_fuentes) {
      const sourceExists = queryOne(db, `SELECT id FROM programas_fuente WHERE id = ?`, [pf.fuente_id]);
      if (sourceExists) {
        if (pf.rol === 'principal') hasPrincipal = true;
        db.run(`
          INSERT OR REPLACE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida)
          VALUES (?, ?, ?, ?, ?)
        `, [`pf_${newId}_${pf.fuente_id}`, newId, pf.fuente_id, pf.rol, now]);
      }
    }
    if (!hasPrincipal) {
      db.run(`
        INSERT OR REPLACE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida)
        VALUES (?, ?, ?, 'principal', ?)
      `, [`pf_${newId}_${effectiveFuenteId}`, newId, effectiveFuenteId, now]);
    }

    for (const d of validated.decisiones) {
      const decId = `dec_${newId}_${d.medida_id}`;
      db.run(`
        INSERT INTO decisiones_medidas (
          id, proyecto_id, medida_id, estado, version_municipal_titulo,
          version_municipal_texto, version_municipal_explicacion, nota_interna,
          estado_idioma_secundario, traduccion_titulo, traduccion_texto, traduccion_explicacion,
          estado_traduccion, propuesta_ia_texto, propuesta_ia_titulo, propuesta_ia_tipo,
          propuesta_ia_fecha, texto_anterior, titulo_anterior, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        decId, newId, d.medida_id, d.estado, d.version_municipal_titulo,
        d.version_municipal_texto, d.version_municipal_explicacion, d.nota_interna,
        d.estado_idioma_secundario, d.traduccion_titulo, d.traduccion_texto, d.traduccion_explicacion,
        d.estado_traduccion, d.propuesta_ia_texto, d.propuesta_ia_titulo, d.propuesta_ia_tipo,
        d.propuesta_ia_fecha, d.texto_anterior, d.titulo_anterior, now
      ]);
    }

    for (const prop of validated.medidas_propias) {
      const propId = 'prop_' + crypto.randomBytes(6).toString('hex');
      db.run(`
        INSERT INTO medidas_propias (
          id, proyecto_id, area_id, codigo, orden, posicion, posicion_referencia_id,
          titulo, texto, explicacion, nota_interna, estado,
          traduccion_titulo, traduccion_texto, traduccion_explicacion,
          estado_traduccion, propuesta_ia_texto, propuesta_ia_titulo, texto_anterior,
          fuente_origen_id, medida_origen_id, numero_origen, fuente_nombre,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        propId, newId, prop.area_id, prop.codigo, prop.orden,
        prop.posicion, prop.posicion_referencia_id,
        prop.titulo, prop.texto, prop.explicacion, prop.nota_interna, prop.estado,
        prop.traduccion_titulo, prop.traduccion_texto, prop.traduccion_explicacion,
        prop.estado_traduccion, prop.propuesta_ia_texto, prop.propuesta_ia_titulo, prop.texto_anterior,
        prop.fuente_origen_id, prop.medida_origen_id, prop.numero_origen, prop.fuente_nombre,
        now, now
      ]);
    }

    if (validated.textos_generales) {
      const g = validated.textos_generales;
      db.run(`
        INSERT INTO textos_generales (
          proyecto_id, presentacion_titulo, presentacion_entradilla, presentacion_parrafos_json,
          presentacion_traduccion_json, introducciones_areas_json, cierre_titulo,
          cierre_parrafos_json, cierre_traduccion_json, presentacion_estado_traduccion,
          cierre_estado_traduccion, introducciones_traduccion_json,
          introducciones_estado_traduccion_json, bilingue_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newId, g.presentacion_titulo, g.presentacion_entradilla, g.presentacion_parrafos_json,
        g.presentacion_traduccion_json, g.introducciones_areas_json, g.cierre_titulo,
        g.cierre_parrafos_json, g.cierre_traduccion_json, g.presentacion_estado_traduccion,
        g.cierre_estado_traduccion, g.introducciones_traduccion_json,
        g.introducciones_estado_traduccion_json, g.bilingue_json, now
      ]);
    } else {
      db.run(`
        INSERT INTO textos_generales (
          proyecto_id, presentacion_titulo, presentacion_entradilla, presentacion_parrafos_json,
          presentacion_traduccion_json, introducciones_areas_json, cierre_titulo,
          cierre_parrafos_json, cierre_traduccion_json, updated_at
        ) VALUES (?, 'Presentación', '', '[]', '[]', '{}', 'Cierre', '[]', '[]', ?)
      `, [newId, now]);
    }

    db.run('COMMIT;');
  } catch (err) {
    try { db.run('ROLLBACK;'); } catch (e) {}
    throw err;
  }

  save();
  return newId;
}

function resolveAreaIntroduction(project, areaId, idioma = null) {
  const generalTexts = project?.textos_generales || {};
  const targetLang = idioma || project?.idioma_principal || 'es';
  const rawArea = generalTexts.introducciones_areas?.[areaId];

  if (!rawArea) {
    return { entradilla: '', texto: '', frase_destacada: '' };
  }

  let entradilla = '';
  let texto = '';
  let frase_destacada = '';

  // 1. Estructura bilingüe { es: {...}, ca: {...} }
  if (typeof rawArea === 'object' && rawArea !== null && (rawArea.es !== undefined || rawArea.ca !== undefined)) {
    const langObj = rawArea[targetLang];
    if (langObj && typeof langObj === 'object') {
      entradilla = langObj.entradilla || '';
      texto = langObj.texto !== undefined ? langObj.texto : (Array.isArray(langObj.parrafos) ? langObj.parrafos.join('\n\n') : '');
      frase_destacada = langObj.frase_destacada || langObj.frase || '';
    }
  }
  // 2. Objeto plano legacy { entradilla, texto, frase_destacada }
  else if (typeof rawArea === 'object' && rawArea !== null) {
    const primaryLang = project?.idioma_principal || 'es';
    if (targetLang === primaryLang) {
      entradilla = rawArea.entradilla || '';
      texto = rawArea.texto !== undefined ? rawArea.texto : (Array.isArray(rawArea.parrafos) ? rawArea.parrafos.join('\n\n') : '');
      frase_destacada = rawArea.frase_destacada || rawArea.frase || '';
    } else {
      const rawTrads = generalTexts.introducciones_traduccion || {};
      const tradObj = rawTrads[areaId];
      if (tradObj && typeof tradObj === 'object') {
        entradilla = tradObj.entradilla || '';
        texto = tradObj.texto || '';
        frase_destacada = tradObj.frase_destacada || tradObj.frase || '';
      }
    }
  }
  // 3. String legacy
  else if (typeof rawArea === 'string' && rawArea.trim()) {
    const primaryLang = project?.idioma_principal || 'es';
    if (targetLang === primaryLang) {
      const raw = rawArea.trim();
      const entMatch = raw.match(/\[Entradilla\]\s*([\s\S]*?)(?=\[(?:Prioritats|Prioridades|Frase destacada)\]|$)/i);
      const txtMatch = raw.match(/\[(?:Prioritats|Prioridades)\]\s*([\s\S]*?)(?=\[Frase destacada\]|$)/i);
      const fraMatch = raw.match(/\[Frase destacada\]\s*"?([\s\S]*?)"?$/i);
      if (entMatch || txtMatch || fraMatch) {
        if (entMatch) entradilla = entMatch[1].trim();
        if (txtMatch) texto = txtMatch[1].trim();
        if (fraMatch) frase_destacada = fraMatch[1].trim();
      } else {
        const pars = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        if (pars.length > 1) {
          entradilla = pars[0];
          texto = pars.slice(1).join('\n\n');
        } else if (pars.length === 1) {
          entradilla = pars[0];
        }
      }
    }
  }

  // Limpieza estricta de tags técnicos para asegurar texto limpio en Word/PDF
  const cleanTag = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/^\[(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text|párrafo explicativo|pàrraf explicatiu)\]:?\s*/gim, '')
      .replace(/^(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text|párrafo explicativo|pàrraf explicatiu)[:\s*]+/gim, '')
      .replace(/\[(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text|párrafo explicativo|pàrraf explicatiu)\]:?\s*/gim, '')
      .replace(/^["'*«»“”]+|["'*«»“”]+$/g, '')
      .trim();
  };

  // Si la frase destacada está embebida en texto o entradilla, extraerla o limpiarla
  if (!frase_destacada) {
    const m = (texto || '').match(/(?:frase destacada|cita)[:\s*]+([^\n\r]+)/i);
    if (m) {
      frase_destacada = m[1].trim();
      texto = texto.replace(/(?:frase destacada|cita)[:\s*]+[^\n\r]+/i, '').trim();
    }
  } else {
    texto = (texto || '').replace(/(?:frase destacada|cita)[:\s*]+[^\n\r]+/gi, '').trim();
  }

  entradilla = (entradilla || '').replace(/(?:frase destacada|cita)[:\s*]+[^\n\r]+/gi, '').trim();

  return {
    entradilla: cleanTag(entradilla),
    texto: cleanTag(texto),
    frase_destacada: cleanTag(frase_destacada)
  };
}

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProjectData,
  deleteProject,
  duplicateProject,
  duplicateProjectForMunicipio,
  renameProject,
  exportProjectJson,
  importProjectJson,
  updateMeasureDecision,
  batchUpdateDecisions,
  addOwnMeasure,
  updateOwnMeasure,
  deleteOwnMeasure,
  updateGeneralTexts,
  getCatalogInfo,
  calculateProjectStats,
  resolveAreaIntroduction,
  validateImportedProjectJson,
  sanitizeUntrustedJson,
  MAX_IMPORT_JSON_BYTES
};


