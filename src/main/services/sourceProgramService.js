const { getDb, save } = require('../db/database');

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

function sourceFlags(db, item) {
  // Old catalogues can lack updater metadata; preserve their protection without identifying a particular source.
  const legacyReference = item?.tipo === 'marco_oficial' && !item.content_id && !item.instalado_por_actualizador;
  const isOfficial = Boolean(item?.official) || legacyReference;
  const currentContent = queryOne(db, 'SELECT 1 FROM contenidos_instalados WHERE is_current_official = 1 LIMIT 1');
  const isProtectedOfficial = isOfficial && (Boolean(item?.oficial_actual_protegido) || (legacyReference && !currentContent));
  return { isOfficial, isProtectedOfficial };
}

class SourceProgramService {
  countLinkedProjects(db, fuenteId) {
    const row = queryOne(
      db,
      `SELECT COUNT(DISTINCT pid) as count FROM (
        SELECT id as pid FROM proyectos WHERE fuente_id = ?
        UNION
        SELECT proyecto_id as pid FROM proyecto_fuentes WHERE fuente_id = ?
        UNION
        SELECT proyecto_id as pid FROM medidas_propias WHERE fuente_origen_id = ?
      )`,
      [fuenteId, fuenteId, fuenteId]
    );
    return row ? (Number(row.count) || 0) : 0;
  }

  async getAll(includeArchived = true) {
    const db = await getDb();
    const sql = includeArchived
      ? `SELECT * FROM programas_fuente WHERE retirado_por_prueba = 0 ORDER BY activo DESC, archivado ASC, created_at DESC`
      : `SELECT * FROM programas_fuente WHERE archivado = 0 AND retirado_por_prueba = 0 ORDER BY activo DESC, created_at DESC`;
    const list = queryAll(db, sql);

    return list.map(item => {
      let idiomas = { es: { disponible: false }, ca: { disponible: false } };
      try {
        if (item.idiomas_json) idiomas = JSON.parse(item.idiomas_json);
      } catch (e) {}

      const linkedCount = this.countLinkedProjects(db, item.id);
      const { isOfficial, isProtectedOfficial } = sourceFlags(db, item);

      return {
        ...item,
        activo: Boolean(item.activo),
        archivado: Boolean(item.archivado),
        official: isOfficial,
        es_fixture_prueba: Boolean(item.es_fixture_prueba),
        instalado_por_actualizador: Boolean(item.instalado_por_actualizador),
        oficial_actual_protegido: isProtectedOfficial,
        isProtected: isProtectedOfficial,
        es_oficial_actual: isProtectedOfficial,
        es_oficial_anterior: isOfficial && !isProtectedOfficial,
        idiomas,
        proyectos_vinculados_count: linkedCount
      };
    });
  }

  async getById(id) {
    const db = await getDb();
    const item = queryOne(db, `SELECT * FROM programas_fuente WHERE id = ?`, [id]);
    if (!item) return null;

    let idiomas = { es: { disponible: false }, ca: { disponible: false } };
    try {
      if (item.idiomas_json) idiomas = JSON.parse(item.idiomas_json);
    } catch (e) {}

    const linkedCount = this.countLinkedProjects(db, item.id);
    const { isOfficial, isProtectedOfficial } = sourceFlags(db, item);

    const areas = queryAll(db, `SELECT * FROM areas WHERE fuente_id = ? ORDER BY orden ASC`, [id]);
    const medidas = queryAll(db, `SELECT * FROM medidas WHERE fuente_id = ? ORDER BY orden ASC`, [id]);

    const areasWithMeasures = areas.map(a => ({
      ...a,
      medidas: medidas.filter(m => m.area_id === a.id)
    }));

    return {
      ...item,
      activo: Boolean(item.activo),
      archivado: Boolean(item.archivado),
      official: isOfficial,
      es_fixture_prueba: Boolean(item.es_fixture_prueba),
      instalado_por_actualizador: Boolean(item.instalado_por_actualizador),
      oficial_actual_protegido: isProtectedOfficial,
      isProtected: isProtectedOfficial,
      es_oficial_actual: isProtectedOfficial,
      es_oficial_anterior: isOfficial && !isProtectedOfficial,
      idiomas,
      proyectos_vinculados_count: linkedCount,
      areas: areasWithMeasures,
      medidas
    };
  }

  async getActive() {
    const db = await getDb();
    let active = queryOne(db, `SELECT * FROM programas_fuente WHERE activo = 1 AND archivado = 0 AND retirado_por_prueba = 0 LIMIT 1`);
    if (!active) {
      // Try to fallback to any non-archived source or default if exists
      const fallback = queryOne(db, `SELECT * FROM programas_fuente WHERE archivado = 0 AND retirado_por_prueba = 0 ORDER BY official DESC, created_at DESC LIMIT 1`);
      if (fallback) {
        db.run(`UPDATE programas_fuente SET activo = 1 WHERE id = ?`, [fallback.id]);
        save();
        active = fallback;
      }
    }
    return active ? await this.getById(active.id) : null;
  }

  async setActive(id) {
    const db = await getDb();
    const item = queryOne(db, `SELECT * FROM programas_fuente WHERE id = ?`, [id]);
    if (!item) throw new Error(`Programa fuente no encontrado: ${id}`);
    if (item.retirado_por_prueba) throw new Error('Este paquete de prueba está retirado y no se puede activar.');
    if (item.archivado) throw new Error('No se puede activar un programa fuente archivado. Restáurelo primero.');

    db.run(`UPDATE programas_fuente SET activo = 0;`);
    db.run(`UPDATE programas_fuente SET activo = 1, updated_at = ? WHERE id = ?;`, [new Date().toISOString(), id]);
    save();

    return await this.getById(id);
  }

  async rename(id, newName) {
    const db = await getDb();
    const item=queryOne(db,'SELECT * FROM programas_fuente WHERE id = ?',[id]);
    if(sourceFlags(db,item).isOfficial)throw new Error('El Programa Marco oficial es de solo lectura y no se puede renombrar.');
    const cleanName = (newName || '').trim();
    if (!cleanName) throw new Error('El nombre del programa fuente no puede estar vacío.');

    db.run(`UPDATE programas_fuente SET nombre = ?, updated_at = ? WHERE id = ?`, [cleanName, new Date().toISOString(), id]);
    save();

    return await this.getById(id);
  }

  async setArchived(id, archive = true) {
    const db = await getDb();
    const item = queryOne(db, `SELECT * FROM programas_fuente WHERE id = ?`, [id]);
    if (item?.retirado_por_prueba) throw new Error('Un paquete de prueba retirado no se puede restaurar.');
    if (!item) throw new Error(`Programa fuente no encontrado: ${id}`);
    if(sourceFlags(db,item).isProtectedOfficial)throw new Error('Solo se puede desactivar un Programa Marco oficial cuando exista una versión oficial posterior.');

    const isArchiving = Boolean(archive);
    if (isArchiving && item.activo) {
      // Desactivar y activar otra fuente no archivada
      db.run(`UPDATE programas_fuente SET activo = 0 WHERE id = ?`, [id]);
      const alternative = queryOne(db, `SELECT id FROM programas_fuente WHERE id != ? AND archivado = 0 LIMIT 1`, [id]);
      if (alternative) {
        db.run(`UPDATE programas_fuente SET activo = 1 WHERE id = ?`, [alternative.id]);
      }
    }

    db.run(`UPDATE programas_fuente SET archivado = ?, updated_at = ? WHERE id = ?`, [
      isArchiving ? 1 : 0,
      new Date().toISOString(),
      id
    ]);
    save();

    return await this.getById(id);
  }

  async canDelete(id) {
    const db = await getDb();
    const item = queryOne(db, `SELECT * FROM programas_fuente WHERE id = ?`, [id]);
    const linked = this.countLinkedProjects(db, id);
    const { isOfficial, isProtectedOfficial } = sourceFlags(db, item);

    return {
      canDelete: linked === 0 && !isOfficial,
      linkedProjectsCount: linked,
      isProtected: isOfficial,
      isProtectedOfficial,
      isOfficial
    };
  }

  async delete(id) {
    const db = await getDb();
    const check = await this.canDelete(id);
    if (check.isOfficial) {
      throw new Error('El Programa Marco oficial es de solo lectura y no puede eliminarse.');
    }
    if (!check.canDelete) {
      throw new Error(`Este programa fuente está siendo utilizado por ${check.linkedProjectsCount} proyecto(s). No se puede eliminar directamente.`);
    }

    const wasActive = queryOne(db, `SELECT activo FROM programas_fuente WHERE id = ?`, [id])?.activo;

    db.run('BEGIN TRANSACTION;');
    try {
      db.run(`DELETE FROM medidas WHERE fuente_id = ?`, [id]);
      db.run(`DELETE FROM areas WHERE fuente_id = ?`, [id]);
      try {
        db.run(`DELETE FROM contenidos_instalados WHERE fuente_id = ? OR content_id = ?`, [id, id]);
      } catch (e) {}
      db.run(`DELETE FROM programas_fuente WHERE id = ?`, [id]);

      if (wasActive) {
        // Si la fuente eliminada estaba activa, activar el Programa Marco oficial actual
        const currentOfficial = queryOne(
          db,
          `SELECT id FROM programas_fuente
           WHERE official = 1
             AND oficial_actual_protegido = 1
             AND id != ?
           LIMIT 1`,
          [id]
        );
        const alternative = currentOfficial || queryOne(db, 'SELECT id FROM programas_fuente WHERE archivado = 0 ORDER BY created_at LIMIT 1');
        if (alternative) db.run(`UPDATE programas_fuente SET activo = 1 WHERE id = ?`, [alternative.id]);
      }
      db.run('COMMIT;');
    } catch (err) {
      try { db.run('ROLLBACK;'); } catch (e) {}
      throw err;
    }

    save();
    return true;
  }

  async createImportedSource(data) {
    if (!data.versions) return this.createSourceProgram(data);
    const versions = data.versions;
    const langs = ['es', 'ca'].filter(lang => versions[lang]);
    if (!langs.length || Object.keys(versions).some(lang => !['es', 'ca'].includes(lang))) throw new Error('Selecciona al menos un archivo en castellano o catalán.');
    for (const lang of langs) if (!Array.isArray(versions[lang].areas) || !versions[lang].areas.length) throw new Error('Revisa las áreas del documento antes de confirmar.');
    const db = await getDb();
    let source;
    db.run('BEGIN TRANSACTION');
    try {
      const firstLang = langs[0]; const first = versions[firstLang];
      source = await this.createSourceProgram({ nombre: data.nombre, tipo: first.format,
        idioma_inicial: firstLang, origen_archivo: first.filePath, areas: first.areas,
        ocr_metadata: first.ocr_metadata, setAsActive: Boolean(data.setAsActive) }, { deferSave: true });
      if (langs.length === 2) {
        const second = versions[langs[1]];
        source = await this.addLanguageToSource(source.id, langs[1], { areas: second.areas,
          origen_archivo: second.filePath, ocr_metadata: second.ocr_metadata }, { deferSave: true, externalTransaction: true });
      }
      db.run('COMMIT');
    } catch (error) { db.run('ROLLBACK'); throw error; }
    save();
    return source;
  }

  async createSourceProgram({ nombre, tipo, origen_archivo, idioma_inicial = 'es', areas = [], setAsActive = false, ocr_metadata = null }, options = {}) {
    const db = await getDb();
    const cleanName = (nombre || '').trim() || 'Nuevo programa fuente';
    const sourceId = `fuente_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const metadataJson = ocr_metadata ? JSON.stringify(ocr_metadata) : null;
    if (metadataJson && metadataJson.length > 20 * 1024 * 1024) throw new Error('OCR_METADATA_TOO_LARGE');

    const isEs = idioma_inicial === 'es';
    const idiomas = {
      es: { disponible: isEs, archivo: isEs ? origen_archivo : null, fecha: isEs ? now : null },
      ca: { disponible: !isEs, archivo: !isEs ? origen_archivo : null, fecha: !isEs ? now : null }
    };

    let totalMedidas = 0;
    areas.forEach(a => {
      totalMedidas += (a.measures || a.medidas || []).length;
    });

    // Desactivar otros si se pide marcar como activo
    if (setAsActive) {
      db.run(`UPDATE programas_fuente SET activo = 0`);
    }

    db.run(
      `INSERT INTO programas_fuente (id, nombre, activo, archivado, tipo, origen_archivo, idiomas_json, total_areas, total_medidas, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sourceId,
        cleanName,
        setAsActive ? 1 : 0,
        0,
        tipo || 'docx',
        origen_archivo || '',
        JSON.stringify(idiomas),
        areas.length,
        totalMedidas,
        now,
        now
      ]
    );

    if (ocr_metadata) {
      db.run('UPDATE programas_fuente SET ocr_metadata_json = ? WHERE id = ?', [metadataJson, sourceId]);
    }
    // Insertar áreas y medidas
    areas.forEach((area, areaIdx) => {
      const areaId = `${sourceId}_area_${areaIdx + 1}`;
      const areaName = area.title || area.nombre || `Área ${areaIdx + 1}`;

      db.run(
        `INSERT INTO areas (id, fuente_id, orden, nombre, nombre_es, nombre_ca, pagina_inicio) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          areaId,
          sourceId,
          areaIdx + 1,
          areaName,
          isEs ? areaName : '',
          !isEs ? areaName : '',
          area.sourcePage || area.pagina_inicio || null
        ]
      );

      const measuresList = area.measures || area.medidas || [];
      measuresList.forEach((m, mIdx) => {
        const mId = `${areaId}_m_${mIdx + 1}`;
        const titleVal = (m.title || m.titulo || '').trim();
        const textVal = (m.text || m.texto || '').trim();
        const numOrigen = m.sourceNumber || m.numero_origen || `${areaIdx + 1}.${mIdx + 1}`;

        db.run(
          `INSERT INTO medidas (id, fuente_id, codigo, orden, area_id, area_nombre, subarea, numero_origen, pagina_origen, titulo, titulo_es, titulo_ca, texto, texto_es, texto_ca, explicacion, explicacion_es, explicacion_ca, pagina_inicio, pagina_fin, dudoso, motivo_duda) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mId,
            sourceId,
            numOrigen,
            mIdx + 1,
            areaId,
            areaName,
            m.subarea || null,
            numOrigen,
            m.sourcePage || null,
            titleVal,
            isEs ? titleVal : '',
            !isEs ? titleVal : '',
            textVal,
            isEs ? textVal : '',
            !isEs ? textVal : '',
            m.explanation || m.explicacion || '',
            isEs ? (m.explanation || m.explicacion || '') : '',
            !isEs ? (m.explanation || m.explicacion || '') : '',
            m.sourcePage || null,
            m.sourcePage || null,
            m.requiresReview || m.dudoso ? 1 : 0,
            m.reviewReason || m.motivo_duda || null
          ]
        );
      });
    });

    if (!options.deferSave) save();
    return await this.getById(sourceId);
  }

  async addLanguageToSource(sourceId, targetLang, { origen_archivo, areas = [], ocr_metadata = null }, options = {}) {
    if (!['es', 'ca'].includes(targetLang)) throw new Error('Idioma no válido: utiliza castellano o catalán.');
    const db = await getDb();
    const source = await this.getById(sourceId);
    if (!source) throw new Error(`Programa fuente no encontrado: ${sourceId}`);
    if(source.official)throw new Error('Los idiomas del Programa Marco oficial solo se actualizan mediante paquetes verificados.');
    if (source.idiomas?.[targetLang]?.disponible) throw new Error('Esta fuente ya tiene una versión en ese idioma.');

    // Validate the whole correspondence before changing any language column.
    const existingAreas = source.areas || [];
    if (!areas.length || areas.length !== existingAreas.length) throw new Error('Las versiones deben tener las mismas áreas. Revisa su estructura antes de asociarlas.');
    const matches = areas.map((area, i) => {
      const existing = existingAreas[i].medidas || [];
      const incoming = area.measures || area.medidas || [];
      if (existing.length !== incoming.length) throw new Error('Las versiones deben tener las mismas medidas por área. Revisa su estructura antes de asociarlas.');
      const used = new Set();
      return incoming.map((measure, index) => {
        if (!(measure.text || measure.texto || '').trim()) throw new Error('Hay una medida sin texto en el idioma que estás asociando. Revisa el documento.');
        const number = measure.sourceNumber || measure.numero_origen;
        const match = number ? existing.find(m => String(m.numero_origen) === String(number)) : existing[index];
        if (!match || used.has(match.id)) throw new Error('La numeración de las medidas no coincide o está duplicada. Revisa ambas versiones.');
        used.add(match.id);
        return match;
      });
    });
    const metadata = JSON.parse(source.ocr_metadata_json || '{}');
    if (ocr_metadata) {
      metadata.languages ||= {};
      for (const lang of ['es', 'ca']) if (source.idiomas?.[lang]?.disponible && metadata.pages && !metadata.languages[lang]) {
        metadata.languages[lang] = { pages: metadata.pages, summary: metadata.summary };
      }
      metadata.languages[targetLang] = ocr_metadata;
    }
    const metadataJson = JSON.stringify(metadata);
    if (metadataJson.length > 20 * 1024 * 1024) throw new Error('OCR_METADATA_TOO_LARGE');

    const now = new Date().toISOString();
    const idiomas = source.idiomas || {};
    idiomas[targetLang] = { disponible: true, archivo: origen_archivo, fecha: now };

    const isCa = targetLang === 'ca';

    // Alinear áreas existentes con nuevas áreas del documento en targetLang
    if (!options.externalTransaction) db.run('BEGIN TRANSACTION');
    try {
    areas.forEach((newArea, idx) => {
      const matchArea = existingAreas[idx];
      if (matchArea) {
        const newAreaName = newArea.title || newArea.nombre || '';
        if (isCa) {
          db.run(`UPDATE areas SET nombre_ca = ? WHERE id = ?`, [newAreaName, matchArea.id]);
        } else {
          db.run(`UPDATE areas SET nombre_es = ? WHERE id = ?`, [newAreaName, matchArea.id]);
        }

        const newMeasures = newArea.measures || newArea.medidas || [];

        newMeasures.forEach((newM, mIdx) => {
          // Intentar emparejar por número de origen o por índice
          const matchM = matches[idx][mIdx];

          if (matchM) {
            const tit = (newM.title || newM.titulo || '').trim();
            const txt = (newM.text || newM.texto || '').trim();
            const exp = (newM.explanation || newM.explicacion || '').trim();

            if (isCa) {
              db.run(
                `UPDATE medidas SET titulo_ca = ?, texto_ca = ?, explicacion_ca = ? WHERE id = ?`,
                [tit, txt, exp, matchM.id]
              );
            } else {
              db.run(
                `UPDATE medidas SET titulo_es = ?, texto_es = ?, explicacion_es = ? WHERE id = ?`,
                [tit, txt, exp, matchM.id]
              );
            }
            if (newM.requiresReview || newM.dudoso) {
              const warning = `[${targetLang}] ${newM.reviewReason || newM.motivo_duda || 'Revisar texto OCR'}`;
              db.run('UPDATE medidas SET dudoso = 1, motivo_duda = ? WHERE id = ?',
                [[matchM.motivo_duda, warning].filter(Boolean).join('; '), matchM.id]);
            }
          }
        });
      }
    });

    db.run(
      `UPDATE programas_fuente SET idiomas_json = ?, ocr_metadata_json = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(idiomas), metadataJson, now, sourceId]
    );
    if (!options.externalTransaction) db.run('COMMIT');
    } catch (error) { if (!options.externalTransaction) db.run('ROLLBACK'); throw error; }
    if (!options.deferSave) save();
    return await this.getById(sourceId);
  }

  async getProjectSources(projectId) {
    const db = await getDb();
    const proj = queryOne(db, `SELECT fuente_id, mapeo_fuentes_json FROM proyectos WHERE id = ?`, [projectId]);
    if (!proj) throw new Error(`Proyecto no encontrado: ${projectId}`);

    const principalId = proj.fuente_id && queryOne(db, 'SELECT id FROM programas_fuente WHERE id = ?', [proj.fuente_id]) ? proj.fuente_id : null;
    const existingPf = queryOne(db, `SELECT * FROM proyecto_fuentes WHERE proyecto_id = ? AND fuente_id = ?`, [projectId, principalId]);
    if (principalId && !existingPf) {
      db.run(
        `INSERT OR IGNORE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida) VALUES (?, ?, ?, 'principal', ?)`,
        [`pf_${projectId}_${principalId}`, projectId, principalId, new Date().toISOString()]
      );
      save();
    }

    const relRows = queryAll(db, `
      SELECT pf.*, f.nombre, f.tipo, f.idiomas_json, f.total_areas, f.total_medidas, f.activo, f.archivado
      FROM proyecto_fuentes pf
      JOIN programas_fuente f ON pf.fuente_id = f.id
      WHERE pf.proyecto_id = ?
      ORDER BY CASE WHEN pf.rol = 'principal' THEN 0 ELSE 1 END, pf.fecha_anadida ASC
    `, [projectId]);

    let mapeos = {};
    try {
      if (proj.mapeo_fuentes_json) mapeos = JSON.parse(proj.mapeo_fuentes_json);
    } catch (e) {}

    return {
      principalId,
      fuentes: relRows.map(r => {
        let idiomas = {};
        try { if (r.idiomas_json) idiomas = JSON.parse(r.idiomas_json); } catch (e) {}
        return {
          id: r.fuente_id,
          nombre: r.nombre,
          rol: r.rol,
          tipo: r.tipo,
          idiomas,
          total_areas: r.total_areas,
          total_medidas: r.total_medidas,
          fecha_anadida: r.fecha_anadida,
          esPrincipal: r.rol === 'principal' || r.fuente_id === principalId
        };
      }),
      mapeos
    };
  }

  async addSourceToProject(projectId, fuenteId, rol = 'complementaria') {
    const db = await getDb();
    const source = queryOne(db, `SELECT * FROM programas_fuente WHERE id = ?`, [fuenteId]);
    if (!source) throw new Error(`Programa fuente no encontrado: ${fuenteId}`);

    const id = `pf_${projectId}_${fuenteId}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO proyecto_fuentes (id, proyecto_id, fuente_id, rol, fecha_anadida) VALUES (?, ?, ?, ?, ?)`,
      [id, projectId, fuenteId, rol, now]
    );
    save();
    return await this.getProjectSources(projectId);
  }

  async removeSourceFromProject(projectId, fuenteId, force = false) {
    const db = await getDb();
    const proj = queryOne(db, `SELECT fuente_id FROM proyectos WHERE id = ?`, [projectId]);
    if (proj && proj.fuente_id === fuenteId) {
      throw new Error('No se puede quitar la fuente principal del proyecto.');
    }

    const countRow = queryOne(db, `SELECT COUNT(*) as count FROM medidas_propias WHERE proyecto_id = ? AND fuente_origen_id = ?`, [projectId, fuenteId]);
    const incCount = countRow ? countRow.count : 0;
    if (incCount > 0 && !force) {
      return {
        canRemove: false,
        incorporatedCount: incCount,
        message: `Este proyecto contiene ${incCount} medida(s) procedentes de esta fuente.`
      };
    }

    if ((force === true || force === 'delete') && incCount > 0) {
      db.run(`DELETE FROM medidas_propias WHERE proyecto_id = ? AND fuente_origen_id = ?`, [projectId, fuenteId]);
    }

    db.run(`DELETE FROM proyecto_fuentes WHERE proyecto_id = ? AND fuente_id = ?`, [projectId, fuenteId]);
    save();
    return {
      canRemove: true,
      success: true,
      sources: await this.getProjectSources(projectId)
    };
  }

  async saveSourceAreaMapping(projectId, fuenteId, fuenteAreaId, targetAreaId) {
    const db = await getDb();
    const proj = queryOne(db, `SELECT mapeo_fuentes_json FROM proyectos WHERE id = ?`, [projectId]);
    if (!proj) throw new Error('Proyecto no encontrado');

    let mapeos = {};
    try {
      if (proj.mapeo_fuentes_json) mapeos = JSON.parse(proj.mapeo_fuentes_json);
    } catch (e) {}

    if (!mapeos[fuenteId]) mapeos[fuenteId] = {};
    mapeos[fuenteId][fuenteAreaId] = targetAreaId;

    db.run(`UPDATE proyectos SET mapeo_fuentes_json = ? WHERE id = ?`, [JSON.stringify(mapeos), projectId]);
    save();
    return mapeos;
  }

  async getIncorporatedMeasures(projectId, fuenteId) {
    const db = await getDb();
    const rows = queryAll(db, `
      SELECT id, medida_origen_id, area_id, titulo, estado
      FROM medidas_propias
      WHERE proyecto_id = ? AND fuente_origen_id = ?
    `, [projectId, fuenteId]);
    return rows;
  }

  async incorporateMeasure(projectId, data) {
    const db = await getDb();
    const {
      medidaId,
      fuenteId,
      targetAreaId,
      titulo = '',
      texto = '',
      explicacion = '',
      numeroOrigen = null,
      fuenteNombre = ''
    } = data;

    if (!targetAreaId) throw new Error('Debe especificar un área de destino en el proyecto.');

    const existing = queryOne(db, `
      SELECT id FROM medidas_propias WHERE proyecto_id = ? AND fuente_origen_id = ? AND medida_origen_id = ?
    `, [projectId, fuenteId, medidaId]);

    const now = new Date().toISOString();
    let propId = existing ? existing.id : `med_prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (existing) {
      db.run(`
        UPDATE medidas_propias SET
          area_id = ?, titulo = ?, texto = ?, explicacion = ?,
          numero_origen = ?, fuente_nombre = ?, estado = 'incluida', updated_at = ?
        WHERE id = ?
      `, [targetAreaId, titulo, texto, explicacion, numeroOrigen, fuenteNombre, now, propId]);
    } else {
      const maxOrdRow = queryOne(db, `SELECT MAX(orden) as max_ord FROM medidas_propias WHERE proyecto_id = ? AND area_id = ?`, [projectId, targetAreaId]);
      const nextOrd = (maxOrdRow && maxOrdRow.max_ord ? maxOrdRow.max_ord : 100) + 1;

      db.run(`
        INSERT INTO medidas_propias (
          id, proyecto_id, area_id, codigo, orden, posicion,
          titulo, texto, explicacion, estado,
          fuente_origen_id, medida_origen_id, numero_origen, fuente_nombre,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'fin', ?, ?, ?, 'incluida', ?, ?, ?, ?, ?, ?)
      `, [
        propId, projectId, targetAreaId, numeroOrigen || null, nextOrd,
        titulo, texto, explicacion,
        fuenteId, medidaId, numeroOrigen, fuenteNombre,
        now, now
      ]);
    }

    save();
    return { success: true, id: propId };
  }
}

module.exports = new SourceProgramService();
