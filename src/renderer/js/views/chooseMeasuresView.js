/**
 * chooseMeasuresView.js - Vista de Áreas y Medidas (Flujo Vertical Aprobado Bloque B)
 * Constructor de Programas Municipales - Versión 1.4.2
 */

const ChooseMeasuresView = {
  currentAreaId: null,
  searchQuery: '',
  stateFilter: 'todos',
  originFilter: 'todos',
  undoHistory: [],
  currentSourceId: null,
  projectSources: [],
  sourceMappings: {},
  complementaryAreaId: null,
  complementarySourceData: null,
  incorporatedMeasures: [],

  async render(container, project) {
    if (!project || !project.areas || project.areas.length === 0) return;

    const isCa = window.i18n && window.i18n.getLang() === 'ca';

    // Cargar fuentes asociadas al proyecto
    try {
      const sourcesData = await window.api.getProjectSources(project.id);
      this.projectSources = sourcesData.fuentes || [];
      this.sourceMappings = sourcesData.mapeos || {};
    } catch (err) {
      console.warn('Error al cargar fuentes del proyecto:', err);
      this.projectSources = [{
        id: project.fuente_id || 'fuente_marco_oficial',
        nombre: 'Programa Marco 2027',
        rol: 'principal',
        esPrincipal: true
      }];
      this.sourceMappings = {};
    }

    const principalSource = this.projectSources.find(f => f.esPrincipal) || this.projectSources[0];

    if (!this.currentSourceId || !this.projectSources.find(f => f.id === this.currentSourceId)) {
      this.currentSourceId = principalSource ? principalSource.id : (project.fuente_id || 'fuente_marco_oficial');
    }

    const isComplementary = principalSource && this.currentSourceId !== principalSource.id;

    if (isComplementary) {
      await this.renderComplementaryView(container, project, isCa, principalSource);
      return;
    }

    // Verify current area exists in project
    if (!this.currentAreaId || !project.areas.find(a => a.id === this.currentAreaId)) {
      this.currentAreaId = project.areas[0].id;
    }

    const currentAreaIndex = project.areas.findIndex(a => a.id === this.currentAreaId);
    const currentArea = project.areas[currentAreaIndex];
    const totalAreas = project.areas.length;

    // Measures in this area
    const frameworkMeasures = currentArea.medidas || [];
    const ownMeasures = (currentArea.medidas_propias || []).map(p => ({
      ...p,
      is_propia: true,
      decision: { estado: 'adaptada' }
    }));
    const allAreaMeasures = [...frameworkMeasures, ...ownMeasures];

    // Count statistics for active area
    let countIncluidas = 0;
    let countDuda = 0;
    let countSinRevisar = 0;

    allAreaMeasures.forEach(m => {
      const est = m.is_propia ? (m.estado || 'incluida') : (m.decision?.estado || 'sin_revisar');
      if (est === 'incluida' || est === 'adaptada') countIncluidas++;
      else if (est === 'en_duda') countDuda++;
      else countSinRevisar++;
    });

    // Filter measures for display
    let filteredItems = [...allAreaMeasures];

    if (this.originFilter === 'marco') {
      filteredItems = filteredItems.filter(m => !m.is_propia && m.decision?.estado !== 'adaptada');
    } else if (this.originFilter === 'adaptada') {
      filteredItems = filteredItems.filter(m => !m.is_propia && m.decision?.estado === 'adaptada');
    } else if (this.originFilter === 'propia') {
      filteredItems = filteredItems.filter(m => m.is_propia);
    }

    if (this.stateFilter !== 'todos') {
      filteredItems = filteredItems.filter(m => {
        const est = m.is_propia ? 'incluida' : (m.decision?.estado || 'sin_revisar');
        if (this.stateFilter === 'incluida') return est === 'incluida' || est === 'adaptada';
        return est === this.stateFilter;
      });
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      filteredItems = filteredItems.filter(m => {
        const cod = (m.codigo || '').toLowerCase();
        const tit = (m.titulo || '').toLowerCase();
        const txt = (m.texto || '').toLowerCase();
        const exp = (m.explicacion || '').toLowerCase();
        return cod.includes(q) || tit.includes(q) || txt.includes(q) || exp.includes(q);
      });
    }

    // Area introduction text
    const rawCustomIntro = project.textos_generales?.introducciones_areas?.[currentArea.id] || '';
    let customIntro = '';
    if (typeof rawCustomIntro === 'object' && rawCustomIntro !== null) {
      const langIntro = (rawCustomIntro.es || rawCustomIntro.ca) ? (rawCustomIntro[isCa ? 'ca' : 'es'] || rawCustomIntro.es || rawCustomIntro.ca) : rawCustomIntro;
      customIntro = [langIntro.entradilla, langIntro.texto].filter(Boolean).join('\n\n') || '';
    } else if (typeof rawCustomIntro === 'string') {
      customIntro = rawCustomIntro;
    }
    const catalogIntro = currentArea.descripcion || currentArea.introduccion || '';
    const activeIntro = customIntro || catalogIntro;

    container.innerHTML = `
      <div class="view-header" style="margin-bottom: 16px;">
        <div class="view-header-left">
          <h1 class="title">${isCa ? 'Àrees i mesures' : 'Áreas y medidas'}</h1>
          <p class="subtitle">${isCa ? 'Revisa i decideix les propostes que formaran part del programa municipal.' : 'Revisa y decide las propuestas que formarán parte del programa municipal.'}</p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 12px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <div class="muted" style="text-align: right; font-size: 13px;">
            <div>${isCa ? 'Progrés global' : 'Progreso global'}: <b>${project.stats?.progreso_pct || 0}%</b></div>
            <div style="font-size: 12px; margin-top: 2px;">
              ${project.stats?.decididas || 0}/${project.stats?.total_marco || 123} ${isCa ? 'decidides' : 'decididas'}
            </div>
          </div>
        </div>
      </div>

      <!-- BARRA DE SELECCIÓN DE FUENTE DEL PROYECTO -->
      <section class="card" style="padding: 10px 16px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">
            ${isCa ? 'Programa font:' : 'Programa fuente:'}
          </span>
          <select class="select" id="select-project-source" style="font-weight: 700; font-size: 13.5px; min-width: 300px; height: 38px; border-color: #cbd5e1;">
            ${this.projectSources.map(f => `
              <option value="${f.id}" ${f.id === this.currentSourceId ? 'selected' : ''}>
                ${escapeHtml(f.nombre)} ${f.esPrincipal ? (isCa ? '(Principal)' : '(Principal)') : (isCa ? '(Complementari)' : '(Complementario)')}
              </option>
            `).join('')}
            <option value="__add_new__">+ ${isCa ? 'Afegir programa font al projecte…' : 'Añadir programa fuente al proyecto…'}</option>
          </select>
          <span class="badge" style="background: #e0e7ff; color: #3730a3; font-size: 11.5px; font-weight: 600;">
            ✓ ${isCa ? 'Font principal' : 'Fuente principal'}
          </span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn small" id="btn-add-source-modal" style="font-weight: 600;">
            + ${isCa ? 'Afegir programa font' : 'Añadir programa fuente'}
          </button>
        </div>
      </section>

      <!-- A) BARRA SUPERIOR DEL ÁREA -->
      <section class="area-top-header">
        <div class="area-nav-controls">
          <button class="btn small" id="btn-area-prev" ${currentAreaIndex === 0 ? 'disabled' : ''} title="${isCa ? 'Àrea anterior' : 'Área anterior'}">
            ←
          </button>
          
          <select class="select" id="select-area-nav" style="font-weight: 700; font-size: 14.5px; min-width: 320px; max-width: 460px; height: 38px;">
            ${project.areas.map((a, idx) => `
              <option value="${a.id}" ${a.id === this.currentAreaId ? 'selected' : ''}>
                ${isCa ? 'Àrea' : 'Área'} ${idx + 1}. ${escapeHtml(a.nombre)}
              </option>
            `).join('')}
          </select>

          <button class="btn small" id="btn-area-next" ${currentAreaIndex === totalAreas - 1 ? 'disabled' : ''} title="${isCa ? 'Àrea següent' : 'Área siguiente'}">
            →
          </button>

          <span class="muted" style="font-size: 13px; margin-left: 6px;">
            ${isCa ? 'Àrea' : 'Área'} <b>${currentAreaIndex + 1}</b> ${isCa ? 'de' : 'de'} <b>${totalAreas}</b> · <b>${allAreaMeasures.length}</b> ${isCa ? 'mesures' : 'medidas'}
          </span>
        </div>

        <!-- Badges de resumen del área activa -->
        <div class="area-badges-bar">
          <span class="badge" id="badge-area-incluidas" style="background: #ecfdf5; color: #065f46; font-weight: 600; border: 1px solid #a7f3d0; padding: 4px 9px;">
            ● ${countIncluidas} ${isCa ? 'incloses' : 'incluidas'}
          </span>
          <span class="badge" id="badge-area-duda" style="background: #fffbeb; color: #92400e; font-weight: 600; border: 1px solid #fde68a; padding: 4px 9px;">
            ● ${countDuda} ${isCa ? 'en dubte' : 'en duda'}
          </span>
          <span class="badge" id="badge-area-sinrevisar" style="background: #eff6ff; color: #1e40af; font-weight: 600; border: 1px solid #bfdbfe; padding: 4px 9px;">
            ● ${countSinRevisar} ${isCa ? 'sense revisar' : 'sin revisar'}
          </span>
        </div>
      </section>

      <!-- B) BLOQUE DE INTRODUCCIÓN DEL ÁREA -->
      <section class="area-intro-card">
        <div style="flex: 1; padding-right: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-weight: 700; font-size: 13px; color: #581c87; text-transform: uppercase; letter-spacing: 0.04em;">
              ${isCa ? 'Introducció de l\'àrea' : 'Introducción del área'}
            </span>
            ${customIntro ? `
              <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-size: 11px;">${isCa ? 'Personalitzada' : 'Personalizada'}</span>
            ` : `
              <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 11px;">${isCa ? 'Catàleg marc' : 'Catálogo marco'}</span>
            `}
          </div>
          ${activeIntro ? `
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.45; max-height: 48px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
              ${escapeHtml(activeIntro)}
            </p>
          ` : `
            <p class="muted" style="margin: 0; font-size: 12.5px; font-style: italic;">
              ${isCa ? 'Aquesta àrea no té introducció municipal personalitzada (s\'utilitzarà la del catàleg marc si existeix).' : 'Esta área no tiene introducción municipal personalizada (se usará la del catálogo marco si existe).'}
            </p>
          `}
        </div>
        <div>
          <button class="btn small" id="btn-edit-area-intro" style="white-space: nowrap;">
            ✏ ${customIntro ? (isCa ? 'Editar introducció' : 'Editar introducción') : (isCa ? 'Ver / Personalitzar' : 'Ver / Personalizar')}
          </button>
        </div>
      </section>

      <!-- C) BUSCADOR Y FILTROS RÁPIDOS -->
      <div class="toolbar" style="margin-bottom: 16px; gap: 10px;">
        <div class="search-box" style="flex: 1; min-width: 220px;">
          <span class="search-icon">🔍</span>
          <input type="text" class="input" id="input-search-measures" placeholder="${isCa ? 'Cercar per codi, títol o contingut…' : 'Buscar por código, título o contenido…'}" value="${escapeHtml(this.searchQuery)}">
        </div>

        <select class="select" id="select-state-filter" style="width: auto; height: 38px;">
          <option value="todos" ${this.stateFilter === 'todos' ? 'selected' : ''}>${isCa ? 'Estat: Tots' : 'Estado: Todas'}</option>
          <option value="sin_revisar" ${this.stateFilter === 'sin_revisar' ? 'selected' : ''}>${isCa ? 'Sense revisar' : 'Sin revisar'}</option>
          <option value="incluida" ${this.stateFilter === 'incluida' ? 'selected' : ''}>${isCa ? 'Incloses / Adaptades' : 'Incluidas / Adaptadas'}</option>
          <option value="en_duda" ${this.stateFilter === 'en_duda' ? 'selected' : ''}>${isCa ? 'En dubte' : 'En duda'}</option>
        </select>

        <select class="select" id="select-origin-filter" style="width: auto; height: 38px;">
          <option value="todos" ${this.originFilter === 'todos' ? 'selected' : ''}>${isCa ? 'Origen: Tots' : 'Origen: Todos'}</option>
          <option value="marco" ${this.originFilter === 'marco' ? 'selected' : ''}>${isCa ? 'Catàleg marc' : 'Catálogo marco'}</option>
          <option value="adaptada" ${this.originFilter === 'adaptada' ? 'selected' : ''}>${isCa ? 'Adaptades' : 'Adaptadas'}</option>
          <option value="propia" ${this.originFilter === 'propia' ? 'selected' : ''}>${isCa ? 'Propostes pròpies' : 'Propuestas propias'}</option>
        </select>

        <button class="btn small primary" id="btn-add-own-measure">
          + ${isCa ? 'Afegir mesura pròpia' : 'Añadir medida propia'}
        </button>
      </div>

      <!-- D) LISTA VERTICAL DE TARJETAS DE MEDIDA -->
      <section id="measures-vertical-list" style="margin-bottom: 24px;">
        ${filteredItems.length === 0 ? `
          <div class="card" style="padding: 40px 20px; text-align: center;">
            <p class="muted" style="margin: 0; font-size: 14px;">
              ${isCa ? 'No s\'han trobat mesures amb els filtres aplicats.' : 'No se han encontrado medidas con los filtros aplicados.'}
            </p>
          </div>
        ` : filteredItems.map(m => this.renderVerticalMeasureCard(m, project, isCa)).join('')}
      </section>

      <!-- E) PIE DEL ÁREA -->
      <section class="card" style="background: var(--surface-panel); border: 1px solid var(--border-subtle); padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div id="area-footer-status">
          ${countSinRevisar > 0 ? `
            <span style="font-size: 13.5px; color: #1e40af; font-weight: 500;">
              ⏳ ${isCa ? `Queden <b>${countSinRevisar}</b> mesures sense revisar en aquesta àrea.` : `Quedan <b>${countSinRevisar}</b> medidas sin revisar en esta área.`}
            </span>
          ` : countDuda > 0 ? `
            <span style="font-size: 13.5px; color: #92400e; font-weight: 500;">
              ⚠️ ${isCa ? `Hi ha <b>${countDuda}</b> mesures en dubte en aquesta àrea.` : `Hay <b>${countDuda}</b> medidas en duda en esta área.`}
              <button class="btn small link" id="btn-filter-doubts" style="color: #b45309; text-decoration: underline; margin-left: 6px;">${isCa ? 'Revisar' : 'Revisar'}</button>
            </span>
          ` : `
            <span style="font-size: 13.5px; color: #15803d; font-weight: 600;">
              ✓ ${isCa ? 'Totes les mesures d\'aquesta àrea han estat revisades.' : 'Todas las medidas de esta área han sido revisadas.'}
            </span>
          `}
        </div>

        <div style="display: flex; gap: 10px;">
          ${currentAreaIndex < totalAreas - 1 ? `
            <button class="btn primary" id="btn-footer-next-area">
              ${isCa ? 'Següent àrea →' : 'Siguiente área →'}
            </button>
          ` : `
            <button class="btn primary" id="btn-footer-go-preview">
              ${isCa ? 'Anar a Vista prèvia →' : 'Ir a Vista previa →'}
            </button>
          `}
        </div>
      </section>
    `;

    this.bindEvents(container, project);
  },

  renderVerticalMeasureCard(m, project, isCa) {
    const isPropia = !!m.is_propia;
    const est = isPropia ? 'incluida' : (m.decision?.estado || 'sin_revisar');
    const isAdapted = !isPropia && est === 'adaptada';

    let cardStateClass = 'state-unreviewed';
    if (est === 'incluida' || est === 'adaptada') cardStateClass = 'state-incluida';
    else if (est === 'en_duda') cardStateClass = 'state-duda';

    const code = m.codigo || (isPropia ? 'P' : '');
    const hasCustomTitle = !isPropia && m.decision?.version_municipal_titulo && m.decision.version_municipal_titulo.trim();
    const hasCatalogTitle = m.titulo && m.titulo.trim();
    const titleText = hasCustomTitle ? m.decision.version_municipal_titulo : (hasCatalogTitle ? m.titulo : (isCa ? '(Mesura sense títol)' : '(Medida sin título)'));
    const isUntitled = !hasCustomTitle && !hasCatalogTitle;
    const bodyText = (m.decision?.version_municipal_texto && m.decision.version_municipal_texto.trim()) || m.texto || m.explicacion || '';
    const originalText = m.texto || m.explicacion || '';

    // Badges
    let originBadge = `<span class="badge" style="background: #f1f5f9; color: #475569; font-size: 11px;">${isCa ? 'Marc' : 'Marco'}</span>`;
    if (isPropia) {
      if (m.fuente_nombre) {
        originBadge = `<span class="badge" style="background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 600;" title="${escapeHtml(m.fuente_nombre)}">📥 ${escapeHtml(m.fuente_nombre)}</span>`;
      } else {
        originBadge = `<span class="badge" style="background: #f3e8ff; color: #6b21a8; font-size: 11px; font-weight: 600;">${isCa ? 'Pròpia' : 'Personalizada'}</span>`;
      }
    } else if (isAdapted) {
      originBadge = `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 600;">${isCa ? 'Adaptada' : 'Adaptada'}</span>`;
    }

    const tradEstado = m.decision?.estado_traduccion || 'sin_traduccion';
    let tradBadge = '';
    if (tradEstado === 'revisada') {
      tradBadge = `<span class="badge" style="background: #dcfce7; color: #166534; font-size: 11px;">🌐 ${isCa ? 'Traducció revisada' : 'Traducción revisada'}</span>`;
    } else if (tradEstado === 'propuesta' || tradEstado === 'traduccion_propuesta') {
      tradBadge = `<span class="badge" style="background: #e0e7ff; color: #3730a3; font-size: 11px;">🌐 ${isCa ? 'Traducció proposada' : 'Traducción propuesta'}</span>`;
    } else if (tradEstado === 'desactualizada') {
      tradBadge = `<span class="badge" style="background: #fee2e2; color: #991b1b; font-size: 11px;" title="${isCa ? 'El text original ha canviat des de l\'última traducció' : 'El texto original ha cambiado desde la última traducción'}">⚠ ${isCa ? 'Traducció desactualitzada' : 'Traducción desactualizada'}</span>`;
    }

    return `
      <div class="measure-card-vertical ${cardStateClass}" id="card-measure-${m.id}" data-measure-id="${m.id}" data-is-propia="${isPropia ? '1' : '0'}">
        <!-- Columna Izquierda: Información completa de la medida -->
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            ${code ? `<span style="font-size: 12.5px; font-weight: 700; color: #581c87; background: #f5f3ff; border: 1px solid #ddd6fe; padding: 2px 7px; border-radius: 4px;">${escapeHtml(code)}</span>` : ''}
            ${originBadge}
            ${tradBadge}
            ${isAdapted ? `
              <span style="font-size: 12px; color: #0284c7; font-weight: 500;">
                ℹ ${isCa ? 'Mesura adaptada al municipi' : 'Medida adaptada al municipio'}
              </span>
            ` : ''}
          </div>

          <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
            <h3 style="font-size: 15.5px; font-weight: 700; margin: 0; color: ${isUntitled ? '#94a3b8' : 'var(--text-primary)'}; line-height: 1.35; ${isUntitled ? 'font-style: italic;' : ''}">
              ${escapeHtml(titleText)}
            </h3>
            ${isUntitled ? `
              <button class="btn btn-sm btn-suggest-title-ia" data-id="${m.id}" type="button" style="background: #faf5ff; color: #7c3aed; border: 1.5px solid #d8b4fe; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;" title="${isCa ? 'Generar propostes de títol amb IA' : 'Generar propuestas de título con IA'}">
                ✨ ${isCa ? 'Suggerir títol amb IA' : 'Sugerir título con IA'}
              </button>
            ` : ''}
          </div>

          <div style="font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); margin-bottom: 12px;">
            ${escapeHtml(bodyText)}
          </div>

          <!-- Si está adaptada, bloque colapsable o botón para ver texto marco original -->
          ${isAdapted && originalText && originalText.trim() !== bodyText.trim() ? `
            <div id="orig-text-box-${m.id}" style="display: none; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; font-size: 12.5px; color: #64748b;">
              <div style="font-weight: 600; margin-bottom: 4px; color: #475569;">${isCa ? 'Text oficial del catàleg marc:' : 'Texto oficial del catálogo marco:'}</div>
              <div>${escapeHtml(originalText)}</div>
            </div>
          ` : ''}

          <!-- Acciones secundarias -->
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            ${!isPropia ? `
              <button class="btn small btn-adapt-measure" data-id="${m.id}" title="${isCa ? 'Editar redacció per al municipi' : 'Editar redacción para el municipio'}">
                ✏ ${isCa ? 'Adaptar' : 'Adaptar'}
              </button>
              ${isAdapted && originalText && originalText.trim() !== bodyText.trim() ? `
                <button class="btn small link btn-toggle-orig" data-id="${m.id}" style="font-size: 12px; color: #4b5563;">
                  👁 ${isCa ? 'Veure text original' : 'Ver original'}
                </button>
                <button class="btn small link btn-restore-orig" data-id="${m.id}" style="font-size: 12px; color: #dc2626;">
                  ↺ ${isCa ? 'Restablir oficial' : 'Restablecer oficial'}
                </button>
              ` : ''}
            ` : `
              <button class="btn small btn-edit-own" data-id="${m.id}">
                ✏ ${isCa ? 'Editar' : 'Editar'}
              </button>
              <button class="btn small destructive btn-delete-own" data-id="${m.id}">
                🗑 ${isCa ? 'Eliminar' : 'Eliminar'}
              </button>
            `}

            <!-- Menú Asistente IA -->
            <div class="ai-dropdown-wrapper" style="position: relative; display: inline-block;">
              <button class="btn small btn-open-ai-menu" data-id="${m.id}" type="button" style="background: #faf5ff; color: #6b21a8; border: 1px solid #d8b4fe; font-weight: 600;">
                ✨ ${isCa ? 'Assistent IA ▾' : 'Asistente IA ▾'}
              </button>
              <div class="ai-dropdown-menu" id="ai-menu-${m.id}" style="display: none; position: absolute; left: 0; bottom: 100%; margin-bottom: 4px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 20px rgba(0,0,0,0.12); z-index: 100; min-width: 220px; padding: 6px 0;">
                <button class="ai-menu-item btn-ai-action" data-action="suggest_title" data-id="${m.id}" style="width: 100%; text-align: left; padding: 7px 14px; background: none; border: none; font-size: 12.5px; cursor: pointer; color: #4c1d95;">💡 ${isCa ? 'Suggerir títol' : 'Sugerir título'}</button>
                <button class="ai-menu-item btn-ai-action" data-action="adapt" data-id="${m.id}" style="width: 100%; text-align: left; padding: 7px 14px; background: none; border: none; font-size: 12.5px; cursor: pointer; color: #1e293b;">🏛️ ${isCa ? 'Adaptar al municipi' : 'Adaptar al municipio'}</button>
                <button class="ai-menu-item btn-ai-action" data-action="develop" data-id="${m.id}" style="width: 100%; text-align: left; padding: 7px 14px; background: none; border: none; font-size: 12.5px; cursor: pointer; color: #1e293b;">📝 ${isCa ? 'Desenvolupar mesura' : 'Desarrollar medida'}</button>
                <button class="ai-menu-item btn-ai-action" data-action="improve" data-id="${m.id}" style="width: 100%; text-align: left; padding: 7px 14px; background: none; border: none; font-size: 12.5px; cursor: pointer; color: #1e293b;">✍️ ${isCa ? 'Millorar redacció' : 'Mejorar redacción'}</button>
                <button class="ai-menu-item btn-ai-action" data-action="correct" data-id="${m.id}" style="width: 100%; text-align: left; padding: 7px 14px; background: none; border: none; font-size: 12.5px; cursor: pointer; color: #1e293b;">🔍 ${isCa ? 'Corregir text' : 'Corregir texto'}</button>
                <button class="ai-menu-item btn-ai-action" data-action="summarize" data-id="${m.id}" style="width: 100%; text-align: left; padding: 7px 14px; background: none; border: none; font-size: 12.5px; cursor: pointer; color: #1e293b;">✂️ ${isCa ? 'Resumir mesura' : 'Resumir medida'}</button>
                <button class="ai-menu-item btn-ai-action" data-action="translate" data-id="${m.id}" style="width: 100%; text-align: left; padding: 7px 14px; background: none; border: none; font-size: 12.5px; cursor: pointer; color: #1e293b; border-top: 1px solid #f1f5f9;">🌐 ${isCa ? 'Traduir ES ↔ CA' : 'Traducir ES ↔ CA'}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Columna Derecha: Decisión excluyente con 2 radios (clic en activo desmarca a sin_revisar) -->
        <div class="measure-decision-column">
          <label class="decision-radio-btn ${est === 'incluida' || est === 'adaptada' ? 'active-incluida' : ''}">
            <input type="radio" name="decision-${m.id}" value="incluida" ${est === 'incluida' || est === 'adaptada' ? 'checked' : ''} data-id="${m.id}" data-is-propia="${isPropia ? '1' : '0'}" data-was-checked="${est === 'incluida' || est === 'adaptada' ? 'true' : 'false'}">
            <span>● ${isCa ? 'Inclosa' : 'Incluida'}</span>
          </label>

          <label class="decision-radio-btn ${est === 'en_duda' ? 'active-duda' : ''}">
            <input type="radio" name="decision-${m.id}" value="en_duda" ${est === 'en_duda' ? 'checked' : ''} data-id="${m.id}" data-is-propia="${isPropia ? '1' : '0'}" data-was-checked="${est === 'en_duda' ? 'true' : 'false'}">
            <span>● ${isCa ? 'En dubte' : 'En duda'}</span>
          </label>
        </div>
      </div>
    `;
  },

  scrollToAreaStart(container) {
    const scroller = document.querySelector('.main-content') || document.querySelector('#main-content');
    if (!scroller) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const areaHeader = container.querySelector('.area-top-header');
    if (areaHeader) {
      const topPos = areaHeader.offsetTop;
      scroller.scrollTo({ top: Math.max(0, topPos - 12), behavior: 'auto' });
    } else {
      scroller.scrollTo({ top: 0, behavior: 'auto' });
    }
  },

  bindEvents(container, project) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';

    // Project source selector
    const selectProjectSource = container.querySelector('#select-project-source');
    if (selectProjectSource) {
      selectProjectSource.addEventListener('change', async (e) => {
        const val = e.target.value;
        if (val === '__add_new__') {
          selectProjectSource.value = this.currentSourceId;
          this.showAddSourceModal(project, container);
        } else {
          this.currentSourceId = val;
          await this.render(container, project);
        }
      });
    }

    const btnAddSourceModal = container.querySelector('#btn-add-source-modal');
    if (btnAddSourceModal) {
      btnAddSourceModal.addEventListener('click', () => {
        this.showAddSourceModal(project, container);
      });
    }

    // Help screen button
    const btnHelp = container.querySelector('#btn-help-this-screen');
    if (btnHelp) {
      btnHelp.addEventListener('click', () => {
        if (window.Tutorial) window.Tutorial.startSectionTour('choose_measures');
      });
    }

    // Area navigation dropdown
    const selectAreaNav = container.querySelector('#select-area-nav');
    if (selectAreaNav) {
      selectAreaNav.addEventListener('change', (e) => {
        this.currentAreaId = e.target.value;
        this.render(container, project);
        requestAnimationFrame(() => this.scrollToAreaStart(container));
      });
    }

    // Previous / Next Area buttons
    const btnPrev = container.querySelector('#btn-area-prev');
    const btnNext = container.querySelector('#btn-area-next');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        const currIdx = project.areas.findIndex(a => a.id === this.currentAreaId);
        if (currIdx > 0) {
          this.currentAreaId = project.areas[currIdx - 1].id;
          this.render(container, project);
          requestAnimationFrame(() => this.scrollToAreaStart(container));
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const currIdx = project.areas.findIndex(a => a.id === this.currentAreaId);
        if (currIdx < project.areas.length - 1) {
          this.currentAreaId = project.areas[currIdx + 1].id;
          this.render(container, project);
          requestAnimationFrame(() => this.scrollToAreaStart(container));
        }
      });
    }

    // Edit Area Introduction
    const btnEditIntro = container.querySelector('#btn-edit-area-intro');
    if (btnEditIntro) {
      btnEditIntro.addEventListener('click', () => {
        const currentArea = project.areas.find(a => a.id === this.currentAreaId);
        if (currentArea) {
          this.showAreaIntroModal(currentArea, project, container);
        }
      });
    }

    // Filters and search
    const searchInput = container.querySelector('#input-search-measures');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render(container, project);
      });
    }

    const stateFilterSelect = container.querySelector('#select-state-filter');
    if (stateFilterSelect) {
      stateFilterSelect.addEventListener('change', (e) => {
        this.stateFilter = e.target.value;
        this.render(container, project);
      });
    }

    const originFilterSelect = container.querySelector('#select-origin-filter');
    if (originFilterSelect) {
      originFilterSelect.addEventListener('change', (e) => {
        this.originFilter = e.target.value;
        this.render(container, project);
      });
    }

    // Add own measure
    const btnAddOwn = container.querySelector('#btn-add-own-measure');
    if (btnAddOwn) {
      btnAddOwn.addEventListener('click', () => {
        App.showAddOwnMeasureModal(this.currentAreaId);
      });
    }

    // Radio decisions (toggleable: clicking active option unchecks to sin_revisar)
    container.querySelectorAll('.decision-radio-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const radio = btn.querySelector('input[type="radio"]');
        if (!radio) return;
        const mid = radio.dataset.id;
        const isPropia = radio.dataset.isPropia === '1';
        const wasChecked = radio.dataset.wasChecked === 'true';
        const card = container.querySelector(`#card-measure-${mid}`);
        const allRadios = card ? card.querySelectorAll('.decision-radio-btn input[type="radio"]') : [];

        if (wasChecked) {
          // Uncheck and revert to sin_revisar
          radio.checked = false;
          radio.dataset.wasChecked = 'false';
          await this.handleDecisionRadioChange(mid, 'sin_revisar', isPropia, project, container);
        } else {
          // Check this radio and uncheck sibling
          allRadios.forEach(r => {
            r.checked = (r === radio);
            r.dataset.wasChecked = (r === radio ? 'true' : 'false');
          });
          await this.handleDecisionRadioChange(mid, radio.value, isPropia, project, container);
        }
      });
    });

    // Secondary action: Adapt measure
    container.querySelectorAll('.btn-adapt-measure').forEach(btn => {
      btn.addEventListener('click', () => {
        App.openMeasureDetail(btn.dataset.id, false);
      });
    });

    // Toggle original text
    container.querySelectorAll('.btn-toggle-orig').forEach(btn => {
      btn.addEventListener('click', () => {
        const box = container.querySelector(`#orig-text-box-${btn.dataset.id}`);
        if (box) {
          box.style.display = box.style.display === 'none' ? 'block' : 'none';
        }
      });
    });

    // Restore original
    container.querySelectorAll('.btn-restore-orig').forEach(btn => {
      btn.addEventListener('click', async () => {
        App.notifySaving();
        await window.api.updateMeasureDecision(project.id, btn.dataset.id, { restaurar_original: true });
        await App.refreshCurrentProject();
        App.notifySaved();
        this.render(container, App.currentProject);
      });
    });

    // Sugerir título con IA
    container.querySelectorAll('.btn-suggest-title-ia').forEach(btn => {
      btn.addEventListener('click', () => {
        const mid = btn.dataset.id;
        const currentArea = project.areas.find(a => a.id === this.currentAreaId);
        const m = currentArea?.medidas?.find(x => x.id === mid) || (currentArea?.medidas_propias || []).find(x => x.id === mid);
        if (!m) return;

        AiModalHelper.showTitleModal(m, project, async (chosenTitle) => {
          App.notifySaving();
          await window.api.updateMeasureDecision(project.id, mid, { version_municipal_titulo: chosenTitle });
          await App.refreshCurrentProject();
          App.notifySaved();
          this.render(container, App.currentProject);
        });
      });
    });

    // Abrir/cerrar dropdown del Asistente IA
    container.querySelectorAll('.btn-open-ai-menu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mid = btn.dataset.id;
        const menu = container.querySelector(`#ai-menu-${mid}`);
        const wasOpen = menu && menu.style.display === 'block';

        container.querySelectorAll('.ai-dropdown-menu').forEach(m => m.style.display = 'none');
        if (menu && !wasOpen) {
          menu.style.display = 'block';
        }
      });
    });

    document.addEventListener('click', () => {
      container.querySelectorAll('.ai-dropdown-menu').forEach(m => m.style.display = 'none');
    });

    // Acciones del Asistente IA
    container.querySelectorAll('.btn-ai-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const mid = btn.dataset.id;
        const action = btn.dataset.action;
        container.querySelectorAll('.ai-dropdown-menu').forEach(m => m.style.display = 'none');

        const currentArea = project.areas.find(a => a.id === this.currentAreaId);
        const m = currentArea?.medidas?.find(x => x.id === mid) || (currentArea?.medidas_propias || []).find(x => x.id === mid);
        if (!m) return;

        const bodyText = (m.decision?.version_municipal_texto && m.decision.version_municipal_texto.trim()) || m.texto || m.explicacion || '';
        const titleText = m.decision?.version_municipal_titulo || m.titulo || '';

        if (action === 'suggest_title') {
          AiModalHelper.showTitleModal(m, project, async (chosenTitle) => {
            App.notifySaving();
            await window.api.updateMeasureDecision(project.id, mid, { version_municipal_titulo: chosenTitle });
            await App.refreshCurrentProject();
            App.notifySaved();
            this.render(container, App.currentProject);
          });
          return;
        }

        let taskTitle = '';
        let taskMethod = '';
        const idioma = project.idioma_principal || 'es';

        if (action === 'adapt') {
          taskTitle = isCa ? `Adaptar proposta per a ${project.municipio}` : `Adaptar propuesta para ${project.municipio}`;
          taskMethod = 'aiAdaptMeasure';
        } else if (action === 'develop') {
          taskTitle = isCa ? 'Desenvolupar mesura (màx 50 paraules)' : 'Desarrollar medida (máx 50 palabras)';
          taskMethod = 'aiDevelopMeasure';
        } else if (action === 'improve') {
          taskTitle = isCa ? 'Millorar redacció i to' : 'Mejorar redacción y tono';
          taskMethod = 'aiImproveWriting';
        } else if (action === 'correct') {
          taskTitle = isCa ? 'Corregir ortografia i estil' : 'Corregir ortografía y estilo';
          taskMethod = 'aiCorrectText';
        } else if (action === 'summarize') {
          taskTitle = isCa ? 'Resumir mesura' : 'Resumir medida';
          taskMethod = 'aiSummarizeText';
        } else if (action === 'translate') {
          taskTitle = isCa ? 'Traduir mesura (CA ↔ ES)' : 'Traducir medida (ES ↔ CA)';
          taskMethod = 'aiTranslateText';
        }

        AiModalHelper.showProposalModal({
          taskTitle,
          taskMethod,
          taskParams: {
            texto: bodyText,
            titulo: titleText,
            municipio: project.municipio || '',
            habitantes: project.habitantes || null,
            idioma,
            idioma_destino: idioma === 'es' ? 'ca' : 'es',
            longitud: 'media'
          },
          originalText: bodyText,
          onAccept: async (result) => {
            App.notifySaving();
            if (action === 'translate') {
              await window.api.updateMeasureDecision(project.id, mid, {
                traduccion_texto: result.texto,
                estado_traduccion: 'revisada'
              });
            } else {
              await window.api.updateMeasureDecision(project.id, mid, {
                version_municipal_texto: result.texto,
                estado: 'adaptada',
                propuesta_ia_texto: result.texto,
                propuesta_ia_tipo: action,
                propuesta_ia_fecha: new Date().toISOString()
              });
            }
            await App.refreshCurrentProject();
            App.notifySaved();
            this.render(container, App.currentProject);
          }
        });
      });
    });

    // Edit/delete own measure
    container.querySelectorAll('.btn-edit-own').forEach(btn => {
      btn.addEventListener('click', () => {
        App.openMeasureDetail(btn.dataset.id, true);
      });
    });

    container.querySelectorAll('.btn-delete-own').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm(isCa ? 'Eliminar aquesta proposta pròpia?' : '¿Eliminar esta propuesta propia?')) {
          App.notifySaving();
          await window.api.deleteOwnMeasure(btn.dataset.id);
          await App.refreshCurrentProject();
          App.notifySaved();
          this.render(container, App.currentProject);
        }
      });
    });

    // Footer buttons
    const btnFilterDoubts = container.querySelector('#btn-filter-doubts');
    if (btnFilterDoubts) {
      btnFilterDoubts.addEventListener('click', () => {
        this.stateFilter = 'en_duda';
        this.render(container, project);
      });
    }

    const btnFooterNext = container.querySelector('#btn-footer-next-area');
    if (btnFooterNext) {
      btnFooterNext.addEventListener('click', () => {
        const currIdx = project.areas.findIndex(a => a.id === this.currentAreaId);
        if (currIdx < project.areas.length - 1) {
          this.currentAreaId = project.areas[currIdx + 1].id;
          this.render(container, project);
          requestAnimationFrame(() => this.scrollToAreaStart(container));
        }
      });
    }

    const btnFooterPreview = container.querySelector('#btn-footer-go-preview');
    if (btnFooterPreview) {
      btnFooterPreview.addEventListener('click', () => {
        App.navigateTo('vista-previa');
      });
    }
  },

  async handleDecisionRadioChange(measureId, nuevoEstado, isPropia, project, container) {
    App.notifySaving();

    const card = container.querySelector(`#card-measure-${measureId}`);
    if (card) {
      // Update visual state classes immediately
      card.classList.remove('state-incluida', 'state-duda', 'state-descartada', 'state-unreviewed');
      if (nuevoEstado === 'incluida') card.classList.add('state-incluida');
      else if (nuevoEstado === 'en_duda') card.classList.add('state-duda');
      else card.classList.add('state-unreviewed');

      // Update active radio button classes and datasets
      const column = card.querySelector('.measure-decision-column');
      if (column) {
        column.querySelectorAll('.decision-radio-btn').forEach(btn => {
          btn.classList.remove('active-incluida', 'active-duda', 'active-descartada');
          const input = btn.querySelector('input');
          if (input) {
            if (input.value === nuevoEstado) {
              input.checked = true;
              input.dataset.wasChecked = 'true';
              if (nuevoEstado === 'incluida') btn.classList.add('active-incluida');
              else if (nuevoEstado === 'en_duda') btn.classList.add('active-duda');
            } else {
              input.checked = false;
              input.dataset.wasChecked = 'false';
            }
          }
        });
      }
    }

    try {
      if (isPropia) {
        await window.api.updateOwnMeasure(measureId, { estado: nuevoEstado });
      } else {
        await window.api.updateMeasureDecision(project.id, measureId, { estado: nuevoEstado });
      }

      await App.refreshCurrentProject();
      App.notifySaved();

      // Refresh top badges and footer without full rebuild
      this.refreshCounters(container, App.currentProject);
    } catch (err) {
      alert('Error al guardar la decisión: ' + err.message);
    }
  },

  refreshCounters(container, project) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const currentArea = project.areas.find(a => a.id === this.currentAreaId);
    if (!currentArea) return;

    const allAreaMeasures = [
      ...(currentArea.medidas || []),
      ...(currentArea.medidas_propias || []).map(p => ({ ...p, is_propia: true }))
    ];

    let inc = 0, dbt = 0, sin = 0;
    allAreaMeasures.forEach(m => {
      const est = m.is_propia ? (m.estado || 'incluida') : (m.decision?.estado || 'sin_revisar');
      if (est === 'incluida' || est === 'adaptada') inc++;
      else if (est === 'en_duda') dbt++;
      else sin++;
    });

    const bInc = container.querySelector('#badge-area-incluidas');
    const bDbt = container.querySelector('#badge-area-duda');
    const bSin = container.querySelector('#badge-area-sinrevisar');

    if (bInc) bInc.innerHTML = `● ${inc} ${isCa ? 'incloses' : 'incluidas'}`;
    if (bDbt) bDbt.innerHTML = `● ${dbt} ${isCa ? 'en dubte' : 'en duda'}`;
    if (bSin) bSin.innerHTML = `● ${sin} ${isCa ? 'sense revisar' : 'sin revisar'}`;

    const footerStatus = container.querySelector('#area-footer-status');
    if (footerStatus) {
      if (sin > 0) {
        footerStatus.innerHTML = `
          <span style="font-size: 13.5px; color: #1e40af; font-weight: 500;">
            ⏳ ${isCa ? `Queden <b>${sin}</b> mesures sense revisar en aquesta àrea.` : `Quedan <b>${sin}</b> medidas sin revisar en esta área.`}
          </span>
        `;
      } else if (dbt > 0) {
        footerStatus.innerHTML = `
          <span style="font-size: 13.5px; color: #92400e; font-weight: 500;">
            ⚠️ ${isCa ? `Hi ha <b>${dbt}</b> mesures en dubte en aquesta àrea.` : `Hay <b>${dbt}</b> medidas en duda en esta área.`}
            <button class="btn small link" id="btn-filter-doubts" style="color: #b45309; text-decoration: underline; margin-left: 6px;">${isCa ? 'Revisar' : 'Revisar'}</button>
          </span>
        `;
        const btnF = footerStatus.querySelector('#btn-filter-doubts');
        if (btnF) {
          btnF.addEventListener('click', () => {
            this.stateFilter = 'en_duda';
            this.render(container, project);
            requestAnimationFrame(() => this.scrollToAreaStart(container));
          });
        }
      } else {
        footerStatus.innerHTML = `
          <span style="font-size: 13.5px; color: #15803d; font-weight: 600;">
            ✓ ${isCa ? 'Totes les mesures d\'aquesta àrea han estat revisades.' : 'Todas las medidas de esta área han sido revisadas.'}
          </span>
        `;
      }
    }
  },

  showAreaIntroModal(area, project, container) {
    const rawIntro = (project.textos_generales?.introducciones_areas && project.textos_generales.introducciones_areas[area.id]) || '';
    let currentIntro = '';
    if (typeof rawIntro === 'object' && rawIntro !== null) {
      const langIntro = (rawIntro.es || rawIntro.ca) ? (rawIntro[isCa ? 'ca' : 'es'] || rawIntro.es || rawIntro.ca) : rawIntro;
      currentIntro = [langIntro.entradilla, langIntro.texto].filter(Boolean).join('\n\n') || '';
    } else if (typeof rawIntro === 'string') {
      currentIntro = rawIntro;
    }
    const catalogIntro = area.descripcion || area.introduccion || '';

    const modalContainer = document.querySelector('#modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 680px;">
          <div class="modal-header">
            <div>
              <h2 class="section-title" style="font-size: 18.5px;">${isCa ? 'Introducció de l\'àrea' : 'Introducción del área'}: ${escapeHtml(area.nombre)}</h2>
              <div class="muted" style="font-size: 13px;">${isCa ? 'Text que encapçala aquest bloc temàtic al document Word final.' : 'Texto que encabeza este bloque temático en el documento Word final.'}</div>
            </div>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>
          <div class="modal-body">
            ${catalogIntro ? `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px;">
                <div style="font-weight: 700; font-size: 12px; color: #475569; text-transform: uppercase; margin-bottom: 4px;">
                  ${isCa ? 'Introducció de referència del catàleg marc:' : 'Introducción de referencia del catálogo marco:'}
                </div>
                <div style="font-size: 13px; color: #64748b; line-height: 1.45;">
                  ${escapeHtml(catalogIntro)}
                </div>
              </div>
            ` : ''}

            <div class="form-group">
              <label class="form-label" for="modal-input-area-intro">
                ${isCa ? 'Introducció municipal personalitzada' : 'Introducción municipal personalizada'}
              </label>
              <textarea class="textarea" id="modal-input-area-intro" style="min-height: 160px; font-size: 14px; line-height: 1.5;" placeholder="${isCa ? 'Escriu la introducció local per a aquesta àrea… (Si es deixa en blanc, s\'utilitzarà la del catàleg marc).' : 'Escribe la introducción local para esta área… (Si se deja en blanco, se usará la del catálogo marco).'}">${escapeHtml(currentIntro)}</textarea>
              <div class="form-hint">
                ${isCa ? 'Aquest text apareixerà immediatament sota el títol de l\'àrea al document Word.' : 'Este texto aparecerá inmediatamente bajo el título del área en el documento Word.'}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-close-modal">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="modal-btn-save-area-intro">${isCa ? 'Desar introducció' : 'Guardar introducción'}</button>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'block';

    const closeModals = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', closeModals));

    modalContainer.querySelector('#modal-btn-save-area-intro').addEventListener('click', async () => {
      const newIntro = modalContainer.querySelector('#modal-input-area-intro').value.trim();
      const currentGeneral = project.textos_generales || {};
      const updatedIntros = { ...(currentGeneral.introducciones_areas || {}) };
      const prevIntro = updatedIntros[area.id];
      if (typeof prevIntro === 'object' && prevIntro !== null && (prevIntro.es || prevIntro.ca)) {
        const langKey = isCa ? 'ca' : 'es';
        updatedIntros[area.id] = {
          ...prevIntro,
          [langKey]: {
            ...(prevIntro[langKey] || {}),
            texto: newIntro
          }
        };
      } else {
        updatedIntros[area.id] = newIntro;
      }

      App.notifySaving();
      await window.api.updateGeneralTexts(project.id, {
        ...currentGeneral,
        introducciones_areas: updatedIntros
      });

      await App.refreshCurrentProject();
      App.notifySaved();
      closeModals();
      this.render(container, App.currentProject);
    });
  },

  async renderComplementaryView(container, project, isCa, principalSource) {
    App.notifySaving();
    try {
      this.complementarySourceData = await window.api.getSourceProgram(this.currentSourceId);
      this.incorporatedMeasures = await window.api.getIncorporatedMeasures(project.id, this.currentSourceId);
    } catch (err) {
      console.error('Error al cargar programa fuente complementario:', err);
    }
    App.notifySaved();

    const compSource = this.complementarySourceData || { nombre: 'Programa Complementario', areas: [] };
    const compAreas = compSource.areas || [];

    if (!this.complementaryAreaId || !compAreas.find(a => a.id === this.complementaryAreaId)) {
      this.complementaryAreaId = compAreas[0]?.id || null;
    }

    const currentCompAreaIndex = compAreas.findIndex(a => a.id === this.complementaryAreaId);
    const currentCompArea = currentCompAreaIndex >= 0 ? compAreas[currentCompAreaIndex] : compAreas[0];
    const totalCompAreas = compAreas.length;
    const compMeasures = currentCompArea ? (currentCompArea.medidas || []) : [];

    const mappedTargetAreaId = currentCompArea ? (this.sourceMappings[this.currentSourceId]?.[currentCompArea.id]) : null;
    const mappedTargetArea = mappedTargetAreaId ? project.areas.find(a => a.id === mappedTargetAreaId) : null;

    // Filtrar medidas
    let filteredItems = [...compMeasures];
    if (this.stateFilter === 'incluida') {
      filteredItems = filteredItems.filter(m => this.incorporatedMeasures.some(im => im.medida_origen_id === m.id));
    } else if (this.stateFilter === 'sin_revisar') {
      filteredItems = filteredItems.filter(m => !this.incorporatedMeasures.some(im => im.medida_origen_id === m.id));
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      filteredItems = filteredItems.filter(m => {
        const cod = (m.numero_origen || m.codigo || '').toLowerCase();
        const tit = (m.titulo_es || m.titulo || '').toLowerCase();
        const txt = (m.texto_es || m.texto || '').toLowerCase();
        const exp = (m.explicacion_es || m.explicacion || '').toLowerCase();
        return cod.includes(q) || tit.includes(q) || txt.includes(q) || exp.includes(q);
      });
    }

    container.innerHTML = `
      <div class="view-header" style="margin-bottom: 16px;">
        <div class="view-header-left">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="badge" style="background: #e0e7ff; color: #3730a3; font-weight: 700; font-size: 12px;">${isCa ? 'Font complementària' : 'Fuente complementaria'}</span>
            <h1 class="title" style="margin: 0; font-size: 22px;">${escapeHtml(compSource.nombre)}</h1>
          </div>
          <p class="subtitle" style="margin: 0;">${isCa ? 'Explora les propostes d\'aquesta font i tria quines vols incorporar al teu programa municipal.' : 'Explora las propuestas de esta fuente y elige cuáles quieres incorporar a tu programa municipal.'}</p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 10px; align-items: center;">
          <button class="btn primary" id="btn-back-to-principal" style="font-weight: 600;">
            ← ${isCa ? 'Tornar al programa principal' : 'Volver al programa principal'}
          </button>
        </div>
      </div>

      <!-- BARRA DE SELECCIÓN DE FUENTE DEL PROYECTO -->
      <section class="card" style="padding: 10px 16px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">
            ${isCa ? 'Programa font:' : 'Programa fuente:'}
          </span>
          <select class="select" id="select-project-source" style="font-weight: 700; font-size: 13.5px; min-width: 300px; height: 38px; border-color: #cbd5e1;">
            ${this.projectSources.map(f => `
              <option value="${f.id}" ${f.id === this.currentSourceId ? 'selected' : ''}>
                ${escapeHtml(f.nombre)} ${f.esPrincipal ? (isCa ? '(Principal)' : '(Principal)') : (isCa ? '(Complementari)' : '(Complementario)')}
              </option>
            `).join('')}
            <option value="__add_new__">+ ${isCa ? 'Afegir programa font al projecte…' : 'Añadir programa fuente al proyecto…'}</option>
          </select>
          <span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 11.5px; font-weight: 600;">
            ✓ ${this.incorporatedMeasures.length} ${isCa ? 'mesures incorporades' : 'medidas incorporadas'}
          </span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn small destructive" id="btn-remove-comp-source">
            🗑 ${isCa ? 'Treure font del projecte' : 'Quitar fuente del proyecto'}
          </button>
          <button class="btn small" id="btn-add-source-modal" style="font-weight: 600;">
            + ${isCa ? 'Afegir programa font' : 'Añadir programa fuente'}
          </button>
        </div>
      </section>

      <!-- BANNER DE INFO Y CORRESPONDENCIA -->
      <div class="notice info" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <b>ℹ ${isCa ? 'Informació de la font:' : 'Información de la fuente:'}</b>
          ${compSource.total_areas || totalCompAreas} ${isCa ? 'àrees' : 'áreas'} · ${compSource.total_medidas || 0} ${isCa ? 'mesures' : 'medidas'}.
          ${mappedTargetArea ? `
            ${isCa ? 'Correspondència configurada per defecte amb l\'àrea del projecte:' : 'Correspondencia configurada por defecto con el área del proyecto:'} <b>${escapeHtml(mappedTargetArea.nombre)}</b>
          ` : `
            ${isCa ? 'Quan incorporis una mesura, podràs assignar-la a qualsevol àrea del teu programa municipal.' : 'Cuando incorpores una medida, podrás asignarla a cualquier área de tu programa municipal.'}
          `}
        </div>
      </div>

      <!-- A) BARRA SUPERIOR DE NAVEGACIÓN DE ÁREAS COMPLEMENTARIAS -->
      ${totalCompAreas > 0 ? `
        <section class="area-top-header" style="margin-bottom: 16px;">
          <div class="area-nav-controls">
            <button class="btn small" id="btn-comp-area-prev" ${currentCompAreaIndex === 0 ? 'disabled' : ''} title="${isCa ? 'Àrea anterior' : 'Área anterior'}">
              ←
            </button>
            
            <select class="select" id="select-comp-area-nav" style="font-weight: 700; font-size: 14.5px; min-width: 320px; max-width: 460px; height: 38px;">
              ${compAreas.map((a, idx) => `
                <option value="${a.id}" ${a.id === this.complementaryAreaId ? 'selected' : ''}>
                  ${isCa ? 'Àrea' : 'Área'} ${idx + 1}. ${escapeHtml(a.nombre || a.title || 'Área ' + (idx + 1))}
                </option>
              `).join('')}
            </select>

            <button class="btn small" id="btn-comp-area-next" ${currentCompAreaIndex === totalCompAreas - 1 ? 'disabled' : ''} title="${isCa ? 'Àrea següent' : 'Área siguiente'}">
              →
            </button>

            <span class="muted" style="font-size: 13px; margin-left: 6px;">
              ${isCa ? 'Àrea' : 'Área'} <b>${currentCompAreaIndex + 1}</b> ${isCa ? 'de' : 'de'} <b>${totalCompAreas}</b> · <b>${compMeasures.length}</b> ${isCa ? 'mesures' : 'medidas'}
            </span>
          </div>
        </section>
      ` : ''}

      <!-- C) BUSCADOR Y FILTROS -->
      <div class="toolbar" style="margin-bottom: 16px; gap: 10px;">
        <div class="search-box" style="flex: 1; min-width: 220px;">
          <span class="search-icon">🔍</span>
          <input type="text" class="input" id="input-comp-search-measures" placeholder="${isCa ? 'Cercar mesures en aquest programa font…' : 'Buscar medidas en este programa fuente…'}" value="${escapeHtml(this.searchQuery)}">
        </div>

        <select class="select" id="select-comp-state-filter" style="width: auto; height: 38px;">
          <option value="todos" ${this.stateFilter === 'todos' ? 'selected' : ''}>${isCa ? 'Estat: Totes' : 'Estado: Todas'}</option>
          <option value="incluida" ${this.stateFilter === 'incluida' ? 'selected' : ''}>${isCa ? 'Ja incorporades' : 'Ya incorporadas'}</option>
          <option value="sin_revisar" ${this.stateFilter === 'sin_revisar' ? 'selected' : ''}>${isCa ? 'Pendents d\'incorporar' : 'Pendientes de incorporar'}</option>
        </select>
      </div>

      <!-- LISTA DE MEDIDAS DE LA FUENTE COMPLEMENTARIA -->
      <section id="comp-measures-list" style="margin-bottom: 24px; display: flex; flex-direction: column; gap: 14px;">
        ${filteredItems.length === 0 ? `
          <div class="card" style="padding: 40px 20px; text-align: center;">
            <p class="muted" style="margin: 0; font-size: 14px;">
              ${isCa ? 'No s\'han trobat mesures en aquesta àrea amb els filtres aplicats.' : 'No se han encontrado medidas en esta área con los filtros aplicados.'}
            </p>
          </div>
        ` : filteredItems.map(m => {
          const inc = this.incorporatedMeasures.find(im => im.medida_origen_id === m.id);
          const incArea = inc ? project.areas.find(a => a.id === inc.area_id) : null;
          const code = m.numero_origen || m.codigo || '';
          const tit = (isCa ? (m.titulo_ca || m.titulo_es || m.titulo) : (m.titulo_es || m.titulo)) || (isCa ? '(Mesura sense títol)' : '(Medida sin título)');
          const isUntitled = !m.titulo_es && !m.titulo_ca && !m.titulo;
          const body = (isCa ? (m.texto_ca || m.texto_es || m.texto) : (m.texto_es || m.texto)) || (m.explicacion_es || m.explicacion || '');

          return `
            <div class="card" style="padding: 16px 20px; border-left: 5px solid ${inc ? '#10b981' : '#cbd5e1'}; background: ${inc ? '#f0fdf4' : 'var(--surface-panel)'};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 260px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
                    ${code ? `<span style="font-size: 12px; font-weight: 700; color: #4338ca; background: #e0e7ff; border: 1px solid #c7d2fe; padding: 2px 6px; border-radius: 4px;">${escapeHtml(code)}</span>` : ''}
                    ${inc ? `
                      <span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 11.5px; font-weight: 700; border: 1px solid #a7f3d0;">
                        ✓ ${isCa ? 'Incorporada al programa' : 'Incorporada al programa'} · ${isCa ? 'Àrea:' : 'Área:'} <b>${escapeHtml(incArea ? incArea.nombre : inc.area_id)}</b>
                      </span>
                    ` : `
                      <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 11px;">
                        ○ ${isCa ? 'Disponible' : 'Disponible'}
                      </span>
                    `}
                  </div>

                  <h3 style="font-size: 15.5px; font-weight: 700; margin: 0 0 8px; color: ${isUntitled ? '#94a3b8' : 'var(--text-primary)'}; ${isUntitled ? 'font-style: italic;' : ''}">
                    ${escapeHtml(tit)}
                  </h3>

                  <div style="font-size: 13.5px; line-height: 1.5; color: var(--text-secondary);">
                    ${escapeHtml(body)}
                  </div>
                </div>

                <!-- Botones de acción -->
                <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end; min-width: 170px;">
                  ${inc ? `
                    <button class="btn small btn-change-comp-target" data-measure-id="${m.id}" style="width: 100%; white-space: nowrap;">
                      ✏ ${isCa ? 'Canviar àrea de destí' : 'Cambiar área de destino'}
                    </button>
                    <button class="btn small destructive btn-remove-inc-measure" data-own-id="${inc.id}" style="width: 100%; white-space: nowrap;">
                      🗑 ${isCa ? 'Retirar del programa' : 'Retirar del programa'}
                    </button>
                  ` : `
                    <button class="btn small primary btn-incorporate-comp-measure" data-measure-id="${m.id}" style="width: 100%; font-weight: 700; white-space: nowrap;">
                      + ${isCa ? 'Incorporar al programa' : 'Incorporar al programa'}
                    </button>
                  `}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </section>

      <!-- PIE -->
      <section class="card" style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0;">
        <span class="muted" style="font-size: 13px;">
          ${isCa ? `S'han incorporat <b>${this.incorporatedMeasures.length}</b> propostes d'aquest programa a les àrees municipals.` : `Se han incorporado <b>${this.incorporatedMeasures.length}</b> propuestas de este programa a las áreas municipales.`}
        </span>
        <button class="btn primary" id="btn-footer-back-to-principal" style="font-weight: 600;">
          ← ${isCa ? 'Tornar al programa principal' : 'Volver al programa principal'}
        </button>
      </section>
    `;

    this.bindComplementaryEvents(container, project, isCa, principalSource, currentCompArea, compSource);
  },

  bindComplementaryEvents(container, project, isCa, principalSource, currentCompArea, compSource) {
    const compAreas = compSource.areas || [];

    // Project source selector
    const selectProjectSource = container.querySelector('#select-project-source');
    if (selectProjectSource) {
      selectProjectSource.addEventListener('change', async (e) => {
        const val = e.target.value;
        if (val === '__add_new__') {
          selectProjectSource.value = this.currentSourceId;
          this.showAddSourceModal(project, container);
        } else {
          this.currentSourceId = val;
          await this.render(container, project);
        }
      });
    }

    // Back to principal buttons
    const btnBack = container.querySelector('#btn-back-to-principal');
    const btnFooterBack = container.querySelector('#btn-footer-back-to-principal');
    const goPrincipal = async () => {
      this.currentSourceId = principalSource.id;
      await this.render(container, project);
      requestAnimationFrame(() => this.scrollToAreaStart(container));
    };
    if (btnBack) btnBack.addEventListener('click', goPrincipal);
    if (btnFooterBack) btnFooterBack.addEventListener('click', goPrincipal);

    // Add source modal
    const btnAddModal = container.querySelector('#btn-add-source-modal');
    if (btnAddModal) {
      btnAddModal.addEventListener('click', () => {
        this.showAddSourceModal(project, container);
      });
    }

    // Remove complementary source button
    const btnRemoveSource = container.querySelector('#btn-remove-comp-source');
    if (btnRemoveSource) {
      btnRemoveSource.addEventListener('click', async () => {
        App.notifySaving();
        const check = await window.api.removeSourceFromProject(project.id, compSource.id, false);
        App.notifySaved();

        if (check.canRemove) {
          if (confirm(isCa ? 'Eliminar aquest programa font complementari del projecte?' : '¿Eliminar este programa fuente complementario del proyecto?')) {
            App.notifySaving();
            await window.api.removeSourceFromProject(project.id, compSource.id, true);
            this.currentSourceId = principalSource.id;
            await App.refreshCurrentProject();
            App.notifySaved();
            await this.render(container, App.currentProject);
          }
        } else {
          this.showRemoveSourceModal(compSource, project, container, check, principalSource);
        }
      });
    }

    // Area navigation dropdown
    const selectCompAreaNav = container.querySelector('#select-comp-area-nav');
    if (selectCompAreaNav) {
      selectCompAreaNav.addEventListener('change', (e) => {
        this.complementaryAreaId = e.target.value;
        this.renderComplementaryView(container, project, isCa, principalSource);
      });
    }

    // Prev / Next area buttons
    const btnCompPrev = container.querySelector('#btn-comp-area-prev');
    const btnCompNext = container.querySelector('#btn-comp-area-next');
    const currIdx = compAreas.findIndex(a => a.id === this.complementaryAreaId);

    if (btnCompPrev) {
      btnCompPrev.addEventListener('click', () => {
        if (currIdx > 0) {
          this.complementaryAreaId = compAreas[currIdx - 1].id;
          this.renderComplementaryView(container, project, isCa, principalSource);
        }
      });
    }

    if (btnCompNext) {
      btnCompNext.addEventListener('click', () => {
        if (currIdx < compAreas.length - 1) {
          this.complementaryAreaId = compAreas[currIdx + 1].id;
          this.renderComplementaryView(container, project, isCa, principalSource);
        }
      });
    }

    // Search input
    const inputSearch = container.querySelector('#input-comp-search-measures');
    if (inputSearch) {
      inputSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderComplementaryView(container, project, isCa, principalSource);
      });
    }

    // Filter select
    const selectFilter = container.querySelector('#select-comp-state-filter');
    if (selectFilter) {
      selectFilter.addEventListener('change', (e) => {
        this.stateFilter = e.target.value;
        this.renderComplementaryView(container, project, isCa, principalSource);
      });
    }

    // Incorporate buttons
    container.querySelectorAll('.btn-incorporate-comp-measure').forEach(btn => {
      btn.addEventListener('click', () => {
        const mid = btn.dataset.measureId;
        const m = currentCompArea?.medidas?.find(x => x.id === mid);
        if (m) {
          this.showIncorporateModal(m, currentCompArea, compSource, project, container);
        }
      });
    });

    // Change target area buttons
    container.querySelectorAll('.btn-change-comp-target').forEach(btn => {
      btn.addEventListener('click', () => {
        const mid = btn.dataset.measureId;
        const m = currentCompArea?.medidas?.find(x => x.id === mid);
        if (m) {
          this.showIncorporateModal(m, currentCompArea, compSource, project, container);
        }
      });
    });

    // Remove incorporated measure
    container.querySelectorAll('.btn-remove-inc-measure').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ownId = btn.dataset.ownId;
        if (confirm(isCa ? 'Retirar aquesta mesura del teu programa municipal?' : '¿Retirar esta medida de tu programa municipal?')) {
          App.notifySaving();
          await window.api.deleteOwnMeasure(ownId);
          await App.refreshCurrentProject();
          App.notifySaved();
          await this.render(container, App.currentProject);
        }
      });
    });
  },

  showIncorporateModal(m, compArea, compSource, project, container) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const mappedTargetAreaId = this.sourceMappings[compSource.id]?.[compArea.id] || project.areas[0]?.id;
    const existingInc = this.incorporatedMeasures.find(im => im.medida_origen_id === m.id);
    const activeTargetAreaId = existingInc ? existingInc.area_id : mappedTargetAreaId;

    const code = m.numero_origen || m.codigo || '';
    const tit = (isCa ? (m.titulo_ca || m.titulo_es || m.titulo) : (m.titulo_es || m.titulo)) || '';
    const body = (isCa ? (m.texto_ca || m.texto_es || m.texto) : (m.texto_es || m.texto)) || (m.explicacion_es || m.explicacion || '');

    const modalContainer = document.querySelector('#modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 620px;">
          <div class="modal-header">
            <div>
              <h2 class="section-title" style="font-size: 18px; margin: 0;">
                ${isCa ? 'Incorporar mesura al programa municipal' : 'Incorporar medida al programa municipal'}
              </h2>
              <div class="muted" style="font-size: 13px; margin-top: 3px;">
                ${isCa ? 'Font d\'origen:' : 'Fuente de origen:'} <b>${escapeHtml(compSource.nombre)}</b>
              </div>
            </div>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>

          <div class="modal-body" style="padding: 16px 20px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px;">
              ${code ? `<span style="font-size: 11px; font-weight: 700; color: #4338ca; background: #e0e7ff; padding: 1px 5px; border-radius: 3px; display: inline-block; margin-bottom: 4px;">${escapeHtml(code)}</span>` : ''}
              <div style="font-weight: 700; font-size: 14.5px; color: var(--text-primary); margin-bottom: 4px;">
                ${escapeHtml(tit || (isCa ? '(Sense títol)' : '(Sin título)'))}
              </div>
              <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.45; max-height: 90px; overflow-y: auto;">
                ${escapeHtml(body)}
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label class="form-label" for="modal-select-target-area" style="font-weight: 700; font-size: 13.5px;">
                ${isCa ? 'En quina àrea del teu programa municipal vols incloure aquesta mesura?' : '¿En qué área de tu programa municipal quieres incluir esta medida?'}
              </label>
              <select class="select" id="modal-select-target-area" style="font-size: 14px; font-weight: 600; height: 40px;">
                ${project.areas.map((a, idx) => `
                  <option value="${a.id}" ${a.id === activeTargetAreaId ? 'selected' : ''}>
                    ${isCa ? 'Àrea' : 'Área'} ${idx + 1}. ${escapeHtml(a.nombre)}
                  </option>
                `).join('')}
              </select>
            </div>

            <div style="margin-top: 12px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-primary); cursor: pointer;">
                <input type="checkbox" id="modal-chk-save-mapping" checked style="accent-color: #6366f1;">
                <span>${isCa ? 'Recordar correspondència per a aquesta àrea d\'origen' : 'Recordar correspondencia para esta área de origen'}</span>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-close-modal">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="modal-btn-confirm-incorporate" style="font-weight: 700;">
              ${isCa ? 'Incorporar al programa' : 'Incorporar al programa'}
            </button>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'block';

    const closeModal = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', closeModal));

    modalContainer.querySelector('#modal-btn-confirm-incorporate').addEventListener('click', async () => {
      const targetAreaId = modalContainer.querySelector('#modal-select-target-area').value;
      const saveMapping = modalContainer.querySelector('#modal-chk-save-mapping').checked;

      App.notifySaving();
      try {
        await window.api.incorporateMeasure(project.id, {
          medidaId: m.id,
          fuenteId: compSource.id,
          targetAreaId,
          titulo: m.titulo_es || m.titulo || '',
          texto: m.texto_es || m.texto || '',
          explicacion: m.explicacion_es || m.explicacion || '',
          numeroOrigen: m.numero_origen || m.codigo || '',
          fuenteNombre: compSource.nombre
        });

        if (saveMapping) {
          await window.api.saveSourceAreaMapping(project.id, compSource.id, compArea.id, targetAreaId);
        }

        await App.refreshCurrentProject();
        App.notifySaved();
        closeModal();
        await this.render(container, App.currentProject);
      } catch (err) {
        alert('Error al incorporar la medida: ' + err.message);
      }
    });
  },

  async showAddSourceModal(project, container) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    let allSources = [];
    try {
      allSources = await window.api.getSourcePrograms(false);
    } catch (e) {
      console.warn('Error al obtener programas fuente:', e);
    }

    const available = allSources.filter(s => !this.projectSources.some(ps => ps.id === s.id));

    const modalContainer = document.querySelector('#modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 640px;">
          <div class="modal-header">
            <div>
              <h2 class="section-title" style="font-size: 18px; margin: 0;">
                ${isCa ? 'Afegir programa font al projecte' : 'Añadir programa fuente al proyecto'}
              </h2>
              <div class="muted" style="font-size: 13px; margin-top: 3px;">
                ${isCa ? 'Tria un programa font per incorporar mesures addicionals a aquest projecte municipal.' : 'Elige un programa fuente para incorporar medidas adicionales a este proyecto municipal.'}
              </div>
            </div>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>

          <div class="modal-body" style="padding: 16px 20px;">
            ${available.length === 0 ? `
              <div style="text-align: center; padding: 20px 10px;">
                <p class="muted" style="font-size: 13.5px; margin-bottom: 16px;">
                  ${isCa ? 'No hi ha altres programes font registrats a l\'aplicació per afegir.' : 'No hay otros programas fuente registrados en la aplicación para añadir.'}
                </p>
                <button class="btn primary" id="modal-btn-go-import">
                  📥 ${isCa ? 'Importar un nou document (DOCX / PDF)' : 'Importar un nuevo documento (DOCX / PDF)'}
                </button>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto;">
                ${available.map(s => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <div>
                      <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px;">
                        ${escapeHtml(s.nombre)}
                      </div>
                      <div class="muted" style="font-size: 12px;">
                        ${s.tipo ? `<span class="badge" style="font-size: 10.5px; padding: 1px 5px; margin-right: 6px;">${escapeHtml(s.tipo)}</span>` : ''}
                        ${s.total_areas || 0} ${isCa ? 'àrees' : 'áreas'} · ${s.total_medidas || 0} ${isCa ? 'mesures' : 'medidas'}
                      </div>
                    </div>
                    <button class="btn small primary btn-add-source-to-proj" data-source-id="${s.id}">
                      + ${isCa ? 'Afegir' : 'Añadir'}
                    </button>
                  </div>
                `).join('')}
              </div>
              <div style="border-top: 1px solid #e2e8f0; margin-top: 16px; padding-top: 14px; text-align: center;">
                <button class="btn link" id="modal-btn-go-import" style="font-size: 13px;">
                  📥 ${isCa ? 'O importar un nou document font (DOCX / PDF)' : 'O importar un nuevo documento fuente (DOCX / PDF)'}
                </button>
              </div>
            `}
          </div>

          <div class="modal-footer">
            <button class="btn btn-close-modal">${isCa ? 'Tancar' : 'Cerrar'}</button>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'block';

    const closeModal = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', closeModal));

    const btnGoImport = modalContainer.querySelector('#modal-btn-go-import');
    if (btnGoImport) {
      btnGoImport.addEventListener('click', () => {
        closeModal();
        App.navigateTo('importador');
      });
    }

    modalContainer.querySelectorAll('.btn-add-source-to-proj').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sourceId = btn.dataset.sourceId;
        App.notifySaving();
        try {
          await window.api.addSourceToProject(project.id, sourceId, 'complementaria');
          this.currentSourceId = sourceId;
          await App.refreshCurrentProject();
          App.notifySaved();
          closeModal();
          await this.render(container, App.currentProject);
        } catch (err) {
          alert('Error al añadir fuente: ' + err.message);
        }
      });
    });
  },

  showRemoveSourceModal(compSource, project, container, checkResult, principalSource) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const modalContainer = document.querySelector('#modal-container');

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 540px;">
          <div class="modal-header">
            <h2 class="section-title" style="font-size: 18px; margin: 0; color: #dc2626;">
              ⚠️ ${isCa ? 'Treure font del projecte' : 'Quitar fuente del proyecto'}
            </h2>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>

          <div class="modal-body" style="padding: 16px 20px;">
            <p style="font-size: 14px; line-height: 1.5; color: var(--text-primary); margin-bottom: 16px;">
              ${isCa
                ? `Hi ha <b>${checkResult.incorporatedCount}</b> mesures d'aquesta font incorporades al programa municipal.`
                : `Hay <b>${checkResult.incorporatedCount}</b> medidas de esta fuente incorporadas al programa municipal.`}
              <br><br>
              ${isCa
                ? '¿Desitges conservar-les al programa o eliminar-les també?'
                : '¿Deseas conservarlas en el programa o eliminarlas también?'}
            </p>
          </div>

          <div class="modal-footer" style="flex-wrap: wrap; gap: 8px;">
            <button class="btn btn-close-modal">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn" id="modal-btn-keep-measures" style="font-weight: 600;">
              ${isCa ? 'Conservar mesures al programa' : 'Conservar medidas en el programa'}
            </button>
            <button class="btn destructive" id="modal-btn-delete-measures" style="font-weight: 600;">
              ${isCa ? 'Eliminar mesures també' : 'Eliminar medidas también'}
            </button>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'block';

    const closeModal = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', closeModal));

    const executeRemoval = async (forceMode) => {
      App.notifySaving();
      try {
        await window.api.removeSourceFromProject(project.id, compSource.id, forceMode);
        this.currentSourceId = principalSource.id;
        await App.refreshCurrentProject();
        App.notifySaved();
        closeModal();
        await this.render(container, App.currentProject);
      } catch (err) {
        alert('Error al quitar fuente: ' + err.message);
      }
    };

    modalContainer.querySelector('#modal-btn-keep-measures').addEventListener('click', () => executeRemoval('keep'));
    modalContainer.querySelector('#modal-btn-delete-measures').addEventListener('click', () => executeRemoval('delete'));
  }
};

window.ChooseMeasuresView = ChooseMeasuresView;
