const GeneralTextsView = {
  currentSubSection: 'presentacion', // 'presentacion', 'introducciones', 'cierre'
  selectedIntroAreaId: null,
  currentLang: null, // 'es' or 'ca'
  activeAiMode: {
    presentacion: 'propio', // 'propio' or 'ia'
    introducciones: 'propio',
    cierre: 'propio'
  },
  debounceTimer: null,

  async render(container, project) {
    if (!project) return;

    if (!this.currentLang) {
      this.currentLang = project.idioma_principal || 'es';
    }

    if (!this.selectedIntroAreaId && project.areas?.length > 0) {
      this.selectedIntroAreaId = project.areas[0].id;
    }

    const textos = project.textos_generales || {
      presentacion: { es: { titulo: 'Presentación', entradilla: '', parrafos: [], estado: 'original' }, ca: { titulo: 'Presentació', entradilla: '', parrafos: [], estado: 'sin_traduccion' } },
      introducciones_areas: {},
      cierre: { es: { titulo: 'Cierre', parrafos: [], estado: 'original' }, ca: { titulo: 'Tancament', parrafos: [], estado: 'sin_traduccion' } }
    };

    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const pLang = project.idioma_principal || 'es';
    const curLang = this.currentLang || pLang;
    const pendingCurrent = this.getPendingGeneralTexts(project, curLang);
    const pendingBannerHtml = pendingCurrent.length > 0 ? `
      <div class="notice warning" id="banner-pending-translations" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #fffbeb; border: 1.5px solid #fde68a;">
        <div>
          <b>⚠️ ${isCa ? `Hi ha ${pendingCurrent.length} textos generals redactats a l'altre idioma pendents de traducció al català.` : `Hay ${pendingCurrent.length} textos generales redactados en el otro idioma pendientes de traducción al castellano.`}</b>
          <div class="muted" style="font-size: 12.5px; margin-top: 2px;">${isCa ? 'Pots traduir-los automàticament en un sol clic amb la IA local per completar el programa.' : 'Puedes traducirlos automáticamente en un solo clic con la IA local para completar el programa.'}</div>
        </div>
        <button class="btn small" id="btn-batch-translate-pending" style="background: #7c3aed; color: white; font-weight: 700; border: none; padding: 6px 14px; cursor: pointer;">
          🌐 ${isCa ? 'Traduir textos pendents' : 'Traducir textos pendientes'}
        </button>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="title">${window.i18n.t('general.title')}</h1>
          <p class="subtitle">${window.i18n.t('general.subtitle')}</p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 8px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <button class="btn primary" id="btn-goto-review">${isCa ? 'Continuar a Revisar i exportar →' : 'Continuar a Revisar y exportar →'}</button>
        </div>
      </div>

      <!-- Barra superior: Selector de subsección y Conmutador de idioma de edición -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <!-- Pestañas de sub-sección -->
        <div style="display: flex; gap: 8px;">
          <button class="btn ${this.currentSubSection === 'presentacion' ? 'primary' : ''}" id="btn-tab-presentacion">${window.i18n.t('general.sec_pres')}</button>
          <button class="btn ${this.currentSubSection === 'introducciones' ? 'primary' : ''}" id="btn-tab-intros">${window.i18n.t('general.sec_areas')} (${project.areas?.length || 12})</button>
          <button class="btn ${this.currentSubSection === 'cierre' ? 'primary' : ''}" id="btn-tab-cierre">${window.i18n.t('general.sec_cierre')}</button>
        </div>

        <!-- Conmutador de idioma de edición -->
        <div style="display: flex; align-items: center; gap: 8px; background: white; padding: 4px 10px; border-radius: var(--radius-default); border: 1px solid var(--border-subtle); box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <span class="muted" style="font-size: 12px; font-weight: 600;">${isCa ? 'Idioma de redacció:' : 'Idioma de redacción:'}</span>
          <button class="btn small ${this.currentLang === 'es' ? 'primary' : 'link'}" id="btn-lang-es" style="${this.currentLang === 'es' ? 'font-weight:700;' : 'color: var(--text-secondary);'}">🇪🇸 Castellano${pLang === 'es' ? ' ★' : ''}</button>
          <button class="btn small ${this.currentLang === 'ca' ? 'primary' : 'link'}" id="btn-lang-ca" style="${this.currentLang === 'ca' ? 'font-weight:700;' : 'color: var(--text-secondary);'}">🐱 Català${pLang === 'ca' ? ' ★' : ''}</button>
        </div>
      </div>

      ${pendingBannerHtml}

      <div id="general-text-body-container">
        ${this.renderSubSection(project, textos)}
      </div>

      <div class="notice info" style="margin-top: 24px;">
        <b>${isCa ? 'Consell de redacció:' : 'Consejo de redacción:'}</b> ${isCa ? 'aquests textos donaran coherència global al programa municipal. Si deixes algun text en blanc, la plantilla Word es generarà amb l\'espai de secció preparat per emplenar-lo directament a Word.' : 'estos textos darán coherencia global al programa municipal. Si dejas algún texto en blanco, la plantilla Word se generará con el espacio de sección preparado para rellenarlo directamente en Word.'}
      </div>
    `;

    this.bindEvents(container, project, textos);
  },

  getPendingGeneralTexts(project, targetLang) {
    const sourceLang = targetLang === 'ca' ? 'es' : 'ca';
    const textos = project?.textos_generales || {};
    const pending = [];

    const hasTechnicalArtifacts = (obj) => {
      if (!obj) return false;
      const s = JSON.stringify(obj);
      return /(?:frase destacada|p[áa]rrafo explicativo|p[àa]rraf explicatiu|\[(?:entradilla|entradeta|frase destacada)\])/i.test(s);
    };

    // Presentacion
    const presObj = textos.presentacion || {};
    const hasSrcPres = presObj[sourceLang] && (presObj[sourceLang].entradilla || (presObj[sourceLang].parrafos && presObj[sourceLang].parrafos.length > 0));
    const tgtPres = presObj[targetLang];
    const hasTgtPres = tgtPres && !hasTechnicalArtifacts(tgtPres) && (tgtPres.entradilla || (tgtPres.parrafos && tgtPres.parrafos.length > 0));
    if (hasSrcPres && !hasTgtPres) pending.push({ type: 'presentacion', label: targetLang === 'ca' ? 'Presentació' : 'Presentación' });

    // Intros
    (project?.areas || []).forEach(a => {
      const introA = (textos.introducciones_areas && textos.introducciones_areas[a.id]) || {};
      const srcIntro = introA[sourceLang] || (typeof introA === 'object' && !introA.es && !introA.ca && sourceLang === project.idioma_principal ? introA : null);
      const tgtIntro = introA[targetLang];
      const hasSrc = srcIntro && (srcIntro.entradilla || srcIntro.texto);
      const hasTgt = tgtIntro && !hasTechnicalArtifacts(tgtIntro) && (tgtIntro.entradilla || tgtIntro.texto);
      if (hasSrc && !hasTgt) pending.push({ type: 'intro', areaId: a.id, label: `${targetLang === 'ca' ? 'Introducció' : 'Introducción'} ${a.nombre}` });
    });

    // Cierre
    const cierreObj = textos.cierre || {};
    const hasSrcCierre = cierreObj[sourceLang] && (cierreObj[sourceLang].parrafos && cierreObj[sourceLang].parrafos.length > 0);
    const tgtCierre = cierreObj[targetLang];
    const hasTgtCierre = tgtCierre && !hasTechnicalArtifacts(tgtCierre) && (tgtCierre.parrafos && tgtCierre.parrafos.length > 0);
    if (hasSrcCierre && !hasTgtCierre) pending.push({ type: 'cierre', label: targetLang === 'ca' ? 'Tancament' : 'Cierre' });

    return pending;
  },

  async batchTranslatePending(project, targetLang = 'ca', onProgress = null) {
    if (!window.api || (!window.api.aiTranslateStructuredText && !window.api.aiTranslateText)) return false;
    const sourceLang = targetLang === 'ca' ? 'es' : 'ca';
    const textos = project.textos_generales ? JSON.parse(JSON.stringify(project.textos_generales)) : {};
    if (!textos.presentacion) textos.presentacion = { es: {}, ca: {} };
    if (!textos.introducciones_areas) textos.introducciones_areas = {};
    if (!textos.cierre) textos.cierre = { es: {}, ca: {} };

    const tasks = [];
    const srcPres = textos.presentacion[sourceLang];
    const tgtPres = textos.presentacion[targetLang];
    const hasTechnicalArtifacts = (obj) => {
      if (!obj) return false;
      const s = JSON.stringify(obj);
      return /(?:frase destacada|p[áa]rrafo explicativo|p[àa]rraf explicatiu|\[(?:entradilla|entradeta|frase destacada)\])/i.test(s);
    };

    const hasSrcPres = srcPres && (srcPres.entradilla || (srcPres.parrafos && srcPres.parrafos.length > 0));
    const hasTgtPres = tgtPres && !hasTechnicalArtifacts(tgtPres) && (tgtPres.entradilla || (tgtPres.parrafos && tgtPres.parrafos.length > 0));
    if (hasSrcPres && !hasTgtPres) tasks.push({ type: 'presentacion', src: srcPres });

    (project.areas || []).forEach(a => {
      const areaObj = textos.introducciones_areas[a.id] || {};
      const srcIntro = areaObj[sourceLang] || (typeof areaObj === 'object' && !areaObj.es && !areaObj.ca && sourceLang === project.idioma_principal ? areaObj : null);
      const tgtIntro = areaObj[targetLang];
      const hasSrc = srcIntro && (srcIntro.entradilla || srcIntro.texto);
      const hasTgt = tgtIntro && !hasTechnicalArtifacts(tgtIntro) && (tgtIntro.entradilla || tgtIntro.texto);
      if (hasSrc && !hasTgt) tasks.push({ type: 'intro', areaId: a.id, src: srcIntro });
    });

    const srcCierre = textos.cierre[sourceLang];
    const tgtCierre = textos.cierre[targetLang];
    const hasSrcCierre = srcCierre && (srcCierre.parrafos && srcCierre.parrafos.length > 0);
    const hasTgtCierre = tgtCierre && !hasTechnicalArtifacts(tgtCierre) && (tgtCierre.parrafos && tgtCierre.parrafos.length > 0);
    if (hasSrcCierre && !hasTgtCierre) tasks.push({ type: 'cierre', src: srcCierre });

    if (tasks.length === 0) return true;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (onProgress) onProgress(i + 1, tasks.length);

      if (task.type === 'presentacion') {
        const objToTranslate = {
          titulo: task.src.titulo || '',
          entradilla: task.src.entradilla || '',
          parrafos: task.src.parrafos || []
        };
        try {
          const res = await window.api.aiTranslateStructuredText({ objeto: objToTranslate, de: sourceLang, a: targetLang });
          const resData = res?.data || res;
          if (resData && (resData.entradilla || (resData.parrafos && resData.parrafos.length > 0))) {
            textos.presentacion[targetLang] = {
              titulo: resData.titulo || (targetLang === 'ca' ? 'Un projecte comú per als barris i els serveis públics' : 'Un proyecto común para los barrios y los servicios públicos'),
              entradilla: resData.entradilla || '',
              parrafos: Array.isArray(resData.parrafos) ? resData.parrafos : [],
              estado: 'propuesta'
            };
          }
        } catch (e) { console.error('Error batch translating presentacion:', e); }
      } else if (task.type === 'intro') {
        const aid = task.areaId;
        const objToTranslate = {
          entradilla: task.src.entradilla || '',
          texto: task.src.texto || '',
          frase_destacada: task.src.frase_destacada || ''
        };
        try {
          const res = await window.api.aiTranslateStructuredText({ objeto: objToTranslate, de: sourceLang, a: targetLang });
          const resData = res?.data || res;
          if (resData && (resData.entradilla || resData.texto)) {
            if (!textos.introducciones_areas[aid]) textos.introducciones_areas[aid] = { es: {}, ca: {} };
            textos.introducciones_areas[aid][targetLang] = {
              entradilla: resData.entradilla || '',
              texto: resData.texto || '',
              frase_destacada: resData.frase_destacada || '',
              estado: 'propuesta'
            };
          }
        } catch (e) { console.error('Error batch translating intro:', e); }
      } else if (task.type === 'cierre') {
        const objToTranslate = {
          titulo: task.src.titulo || '',
          parrafos: task.src.parrafos || []
        };
        try {
          const res = await window.api.aiTranslateStructuredText({ objeto: objToTranslate, de: sourceLang, a: targetLang });
          const resData = res?.data || res;
          if (resData && (resData.parrafos && resData.parrafos.length > 0)) {
            textos.cierre[targetLang] = {
              titulo: resData.titulo || (targetLang === 'ca' ? 'El nostre compromís: fets, paraula i futur' : 'Nuestro compromiso: hechos, palabra y futuro'),
              parrafos: Array.isArray(resData.parrafos) ? resData.parrafos : [],
              estado: 'propuesta'
            };
          }
        } catch (e) { console.error('Error batch translating cierre:', e); }
      }
    }

    project.textos_generales = textos;
    await window.api.updateGeneralTexts(project.id, {
      ...textos,
      idioma_edicion: targetLang
    });
    return true;
  },

  getTranslationBadge(estado, isCa) {
    const map = {
      original: { text: isCa ? 'Original' : 'Original', bg: '#e0f2fe', color: '#0369a1' },
      revisada: { text: isCa ? 'Revisada' : 'Revisada', bg: '#dcfce7', color: '#15803d' },
      propuesta: { text: isCa ? 'Traducció proposada' : 'Traducción propuesta', bg: '#fef3c7', color: '#b45309' },
      traduccion_propuesta: { text: isCa ? 'Traducció proposada' : 'Traducción propuesta', bg: '#fef3c7', color: '#b45309' },
      sin_traduccion: { text: isCa ? 'Sense traducció' : 'Sin traducción', bg: '#f3f4f6', color: '#6b7280' },
      desactualizada: { text: isCa ? 'Desactualitzada' : 'Desactualizada', bg: '#fee2e2', color: '#b91c1c' },
      traduciendo: { text: isCa ? 'Traduint...' : 'Traduciendo...', bg: '#f3e8ff', color: '#7e22ce' },
      error_traduccion: { text: isCa ? 'Error de traducció' : 'Error de traducción', bg: '#fee2e2', color: '#b91c1c' }
    };
    const item = map[estado] || map.sin_traduccion;
    return `<span class="chip" style="background:${item.bg}; color:${item.color}; font-size:11.5px; font-weight:700; padding:3px 8px; border-radius:4px;">${item.text}</span>`;
  },

  renderSubSection(project, textos) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const curLang = this.currentLang || project.idioma_principal || 'es';
    const oppLang = curLang === 'ca' ? 'es' : 'ca';
    const oppLabel = oppLang === 'ca' ? 'Català' : 'Castellano';

    if (this.currentSubSection === 'presentacion') {
      const isAi = this.activeAiMode.presentacion === 'ia';
      const presBilingue = textos.presentacion || {};
      const presData = presBilingue[curLang] || {
        titulo: curLang === 'ca' ? 'Presentació' : 'Presentación',
        entradilla: curLang === project.idioma_principal ? (textos.presentacion_entradilla || '') : '',
        parrafos: curLang === project.idioma_principal ? (textos.presentacion_parrafos || []) : [],
        estado: curLang === project.idioma_principal ? 'original' : (textos.presentacion_estado_traduccion || 'sin_traduccion')
      };
      const presOpp = presBilingue[oppLang] || null;
      const hasOppText = presOpp && ((presOpp.entradilla && presOpp.entradilla.trim().length > 0) || (presOpp.parrafos && presOpp.parrafos.length > 0));

      const fullText = [presData.entradilla || '', ...(presData.parrafos || [])].join('\n\n').trim();
      const wordCount = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
      const badgeHtml = this.getTranslationBadge(presData.estado || (curLang === project.idioma_principal ? 'original' : 'sin_traduccion'), isCa);

      return `
        <div class="card" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h2 class="section-title" style="font-size: 19px; margin: 0;">${isCa ? 'Presentació política del programa' : 'Presentación política del programa'}</h2>
                ${badgeHtml}
                <span class="muted" style="font-size: 12px;">(${curLang.toUpperCase()})</span>
              </div>
              <div class="muted" style="font-size: 13px; margin-top: 4px;">${isCa ? 'Secció 2 de la plantilla Word. Introdueix les raons, prioritats i equip per al mandat.' : 'Sección 2 de la plantilla Word. Introduce las razones, prioridades y equipo para el mandato.'}</div>
            </div>
            
            <div style="display: flex; gap: 8px; align-items: center;">
              ${hasOppText ? `
                <button class="btn small" id="btn-translate-sec-ia" style="background: #faf5ff; color: #7c3aed; border: 1px solid #ddd6fe; font-size: 11.5px; font-weight: 700; padding: 4px 10px;">
                  🌐 ${isCa ? `Traduir amb IA des de ${oppLabel}` : `Traducir con IA desde ${oppLabel}`}
                </button>
              ` : ''}
              <!-- Toggle Modo Propio / Modo IA -->
              <div style="display: flex; background: var(--surface-muted); padding: 3px; border-radius: var(--radius-default); border: 1px solid var(--border-subtle);">
                <button class="btn small ${!isAi ? 'primary' : 'link'}" id="toggle-pres-propio" style="${!isAi ? '' : 'color: var(--text-secondary);'}">✍️ ${isCa ? 'Text propi' : 'Texto propio'}</button>
                <button class="btn small ${isAi ? 'primary' : 'link'}" id="toggle-pres-ia" style="${isAi ? '' : 'color: var(--text-secondary);'}">🤖 ${isCa ? 'Suggeriment IA (Fase 2)' : 'Sugerencia IA (Fase 2)'}</button>
              </div>
            </div>
          </div>

          ${presData.estado === 'traduciendo' ? `
            <div class="notice info" style="margin-bottom: 16px; background: #faf5ff; border: 1.5px solid #ddd6fe; color: #6b21a8; font-weight: 600; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px;">
              <span style="font-size: 16px;">⏳</span> ${isCa ? 'Traduint automàticament amb IA local...' : 'Traduciendo automáticamente con IA local...'}
            </div>
          ` : ''}
          ${presData.estado === 'error_traduccion' ? `
            <div class="notice warning" style="margin-bottom: 16px; background: #fef2f2; border: 1.5px solid #fecaca; color: #991b1b; font-weight: 600; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px;">
              <span style="font-size: 16px;">⚠️</span> ${isCa ? 'Hi ha hagut un error en la traducció automàtica. Pots reintentar-la amb el botó superior.' : 'Hubo un error en la traducción automática. Puedes reintentarla con el botón superior.'}
            </div>
          ` : ''}

          ${isAi ? this.renderAiPreparationCard('presentacion', isCa ? 'Presentació política' : 'Presentación política', project) : `
            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
              <span class="muted" style="font-size: 13px;">${isCa ? 'Paraules redactades:' : 'Palabras redactadas:'} <b>${wordCount}</b> (${isCa ? 'Orientació: 220–300 curta, 350–500 estàndard' : 'Orientación: 220–300 corta, 350–500 estándar'})</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="input-pres-titulo">${window.i18n.t('general.field_pres_title')}</label>
              <input type="text" class="input" id="input-pres-titulo" value="${escapeHtml(presData.titulo || (curLang === 'ca' ? 'Presentació' : 'Presentación'))}">
            </div>

            <div class="form-group">
              <label class="form-label" for="input-pres-entradilla">${window.i18n.t('general.field_pres_lead')}</label>
              <textarea class="textarea" id="input-pres-entradilla" style="min-height: 85px;" placeholder="${isCa ? 'Paràgraf inicial que sintetitza l’esperit del programa…' : 'Párrafo inicial que sintetiza el espíritu del programa…'}">${escapeHtml(presData.entradilla || '')}</textarea>
              <div class="form-hint">${isCa ? 'Apareix a Word amb estil tipogràfic d’entradilla destacada.' : 'Aparece en Word con estilo tipográfico de entradilla destacada.'}</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="input-pres-cuerpo">${window.i18n.t('general.field_pres_body')}</label>
              <textarea class="textarea" id="input-pres-cuerpo" style="min-height: 200px;" placeholder="${isCa ? 'Desenvolupament dels eixos polítics de la candidatura (separa els paràgrafs amb salts de línia)…' : 'Desarrollo de los ejes políticos de la candidatura (separa los párrafos con saltos de línea)…'}">${escapeHtml((presData.parrafos || []).join('\n\n'))}</textarea>
              <div class="form-hint">${isCa ? 'Cada salt de línia doble generarà un paràgraf independent amb estil Text.' : 'Cada salto de línea doble generará un párrafo independiente con estilo Texto.'}</div>
            </div>
          `}
        </div>
      `;
    } else if (this.currentSubSection === 'introducciones') {
      const isAi = this.activeAiMode.introducciones === 'ia';
      const area = project.areas.find(a => a.id === this.selectedIntroAreaId) || project.areas[0];
      const introAreaObj = textos.introducciones_areas?.[area.id];
      const introData = (introAreaObj && introAreaObj[curLang]) || (typeof introAreaObj === 'object' && introAreaObj !== null && !introAreaObj.es && !introAreaObj.ca && curLang === project.idioma_principal ? introAreaObj : { entradilla: '', texto: '', frase_destacada: '', estado: curLang === project.idioma_principal ? 'original' : 'sin_traduccion' });
      const introOpp = (introAreaObj && introAreaObj[oppLang]) || null;
      const hasOppText = introOpp && ((introOpp.entradilla && introOpp.entradilla.trim().length > 0) || (introOpp.texto && introOpp.texto.trim().length > 0));

      const combinedBody = [introData.entradilla || '', introData.texto || ''].filter(Boolean).join('\n\n');
      const words = (combinedBody + ' ' + (introData.frase_destacada || '')).trim().split(/\s+/).filter(Boolean).length;
      const badgeHtml = this.getTranslationBadge(introData.estado || (curLang === project.idioma_principal ? 'original' : 'sin_traduccion'), isCa);

      return `
        <div class="card" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h2 class="section-title" style="font-size: 19px; margin: 0;">${isCa ? 'Introduccions d’àrea temàtica' : 'Introducciones de área temática'}</h2>
                ${badgeHtml}
                <span class="muted" style="font-size: 12px;">(${curLang.toUpperCase()})</span>
              </div>
              <div class="muted" style="font-size: 13px; margin-top: 4px;">${isCa ? 'Cada àrea inclou una introducció pedagògica i una frase destacada per encapçalar el capítol.' : 'Cada área incluye una introducción pedagógica y una frase destacada para encabezar el capítulo.'}</div>
            </div>
            
            <div style="display: flex; gap: 8px; align-items: center;">
              ${hasOppText ? `
                <button class="btn small" id="btn-translate-sec-ia" style="background: #faf5ff; color: #7c3aed; border: 1px solid #ddd6fe; font-size: 11.5px; font-weight: 700; padding: 4px 10px;">
                  🌐 ${isCa ? `Traduir amb IA des de ${oppLabel}` : `Traducir con IA desde ${oppLabel}`}
                </button>
              ` : ''}
              <!-- Toggle Modo Propio / Modo IA -->
              <div style="display: flex; background: var(--surface-muted); padding: 3px; border-radius: var(--radius-default); border: 1px solid var(--border-subtle);">
                <button class="btn small ${!isAi ? 'primary' : 'link'}" id="toggle-intro-propio" style="${!isAi ? '' : 'color: var(--text-secondary);'}">✍️ ${isCa ? 'Text propi' : 'Texto propio'}</button>
                <button class="btn small ${isAi ? 'primary' : 'link'}" id="toggle-intro-ia" style="${isAi ? '' : 'color: var(--text-secondary);'}">🤖 ${isCa ? 'Suggeriment IA (Fase 2)' : 'Sugerencia IA (Fase 2)'}</button>
              </div>
            </div>
          </div>

          <!-- Selector de Área -->
          <div class="form-group">
            <label class="form-label" for="select-intro-area">${isCa ? 'Àrea a redactar' : 'Área a redactar'}</label>
            <select class="select" id="select-intro-area">
              ${project.areas.map(a => `
                <option value="${a.id}" ${a.id === area.id ? 'selected' : ''}>${escapeHtml(a.nombre)}</option>
              `).join('')}
            </select>
          </div>

          ${introData.estado === 'traduciendo' ? `
            <div class="notice info" style="margin-bottom: 16px; background: #faf5ff; border: 1.5px solid #ddd6fe; color: #6b21a8; font-weight: 600; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px;">
              <span style="font-size: 16px;">⏳</span> ${isCa ? 'Traduint automàticament amb IA local...' : 'Traduciendo automáticamente con IA local...'}
            </div>
          ` : ''}
          ${introData.estado === 'error_traduccion' ? `
            <div class="notice warning" style="margin-bottom: 16px; background: #fef2f2; border: 1.5px solid #fecaca; color: #991b1b; font-weight: 600; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px;">
              <span style="font-size: 16px;">⚠️</span> ${isCa ? 'Hi ha hagut un error en la traducció automàtica. Pots reintentar-la amb el botó superior.' : 'Hubo un error en la traducción automática. Puedes reintentarla con el botón superior.'}
            </div>
          ` : ''}

          ${isAi ? this.renderAiPreparationCard('introducciones', `${isCa ? 'Introducció de' : 'Introducción de'} ${area.nombre}`, project, area) : `
            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
              <span class="muted" style="font-size: 13px;">${isCa ? 'Paraules en aquesta àrea:' : 'Palabras en este área:'} <b>${words}</b> (${isCa ? 'Recomanació: 80–120 paraules' : 'Recomendación: 80–120 palabras'})</span>
            </div>

            <!-- Campo 1: INTRODUCCIÓN DEL ÁREA -->
            <div class="form-group">
              <label class="form-label" for="input-intro-cuerpo" style="font-weight: 700; text-transform: uppercase; font-size: 12.5px; letter-spacing: 0.04em;">
                ${isCa ? 'INTRODUCCIÓ DE L’ÀREA' : 'INTRODUCCIÓN DEL ÁREA'}
              </label>
              <textarea class="textarea" id="input-intro-cuerpo" style="min-height: 150px;" placeholder="${isCa ? 'Paràgraf o paràgrafs d’obertura i prioritats polítiques per a aquesta àrea…' : 'Párrafo o párrafos de apertura y prioridades políticas para este área…'}">${escapeHtml(combinedBody)}</textarea>
              <div class="form-hint">${isCa ? 'El primer paràgraf s’utilitzarà com a entradilla i la resta com a desenvolupament de prioritats.' : 'El primer párrafo se utilizará como entradilla y el resto como desarrollo de prioridades.'}</div>
            </div>

            <!-- Campo 2: FRASE DESTACADA -->
            <div class="form-group">
              <label class="form-label" for="input-intro-frase" style="font-weight: 700; text-transform: uppercase; font-size: 12.5px; letter-spacing: 0.04em;">
                ${isCa ? 'FRASE DESTACADA' : 'FRASE DESTACADA'} <span class="optional">(${isCa ? 'Cita al document' : 'Cita en el documento'})</span>
              </label>
              <input type="text" class="input" id="input-intro-frase" value="${escapeHtml(introData.frase_destacada || '')}" placeholder="${isCa ? 'Ex. L’accés a un habitatge digne és la base de tots els drets.' : 'Ej. El acceso a una vivienda digna es la base de todos los derechos.'}">
              <div class="form-hint">${isCa ? 'Frase breu i contundent que apareixerà destacada al bloc d’aquesta àrea.' : 'Frase breve y contundente que aparecerá destacada en el bloque de este área.'}</div>
            </div>
          `}
        </div>
      `;
    } else {
      // Cierre
      const isAi = this.activeAiMode.cierre === 'ia';
      const cierreBilingue = textos.cierre || {};
      const cierreData = cierreBilingue[curLang] || {
        titulo: curLang === 'ca' ? 'Tancament' : 'Cierre',
        parrafos: curLang === project.idioma_principal ? (textos.cierre_parrafos || []) : [],
        estado: curLang === project.idioma_principal ? 'original' : (textos.cierre_estado_traduccion || 'sin_traduccion')
      };
      const cierreOpp = cierreBilingue[oppLang] || null;
      const hasOppText = cierreOpp && cierreOpp.parrafos && cierreOpp.parrafos.length > 0;

      const fullText = (cierreData.parrafos || []).join('\n\n').trim();
      const wordCount = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
      const badgeHtml = this.getTranslationBadge(cierreData.estado || (curLang === project.idioma_principal ? 'original' : 'sin_traduccion'), isCa);

      return `
        <div class="card" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h2 class="section-title" style="font-size: 19px; margin: 0;">${isCa ? 'Tancament i compromisos del programa' : 'Cierre y compromisos del programa'}</h2>
                ${badgeHtml}
                <span class="muted" style="font-size: 12px;">(${curLang.toUpperCase()})</span>
              </div>
              <div class="muted" style="font-size: 13px; margin-top: 4px;">${isCa ? 'Secció 4 de la plantilla Word. Conclou el document amb la crida i compromisos.' : 'Sección 4 de la plantilla Word. Concluye el documento con el llamamiento y compromisos.'}</div>
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
              ${hasOppText ? `
                <button class="btn small" id="btn-translate-sec-ia" style="background: #faf5ff; color: #7c3aed; border: 1px solid #ddd6fe; font-size: 11.5px; font-weight: 700; padding: 4px 10px;">
                  🌐 ${isCa ? `Traduir amb IA des de ${oppLabel}` : `Traducir con IA desde ${oppLabel}`}
                </button>
              ` : ''}
              <!-- Toggle Modo Propio / Modo IA -->
              <div style="display: flex; background: var(--surface-muted); padding: 3px; border-radius: var(--radius-default); border: 1px solid var(--border-subtle);">
                <button class="btn small ${!isAi ? 'primary' : 'link'}" id="toggle-cierre-propio" style="${!isAi ? '' : 'color: var(--text-secondary);'}">✍️ ${isCa ? 'Text propi' : 'Texto propio'}</button>
                <button class="btn small ${isAi ? 'primary' : 'link'}" id="toggle-cierre-ia" style="${isAi ? '' : 'color: var(--text-secondary);'}">🤖 ${isCa ? 'Suggeriment IA (Fase 2)' : 'Sugerencia IA (Fase 2)'}</button>
              </div>
            </div>
          </div>

          ${cierreData.estado === 'traduciendo' ? `
            <div class="notice info" style="margin-bottom: 16px; background: #faf5ff; border: 1.5px solid #ddd6fe; color: #6b21a8; font-weight: 600; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px;">
              <span style="font-size: 16px;">⏳</span> ${isCa ? 'Traduint automàticament amb IA local...' : 'Traduciendo automáticamente con IA local...'}
            </div>
          ` : ''}
          ${cierreData.estado === 'error_traduccion' ? `
            <div class="notice warning" style="margin-bottom: 16px; background: #fef2f2; border: 1.5px solid #fecaca; color: #991b1b; font-weight: 600; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px;">
              <span style="font-size: 16px;">⚠️</span> ${isCa ? 'Hi ha hagut un error en la traducció automàtica. Pots reintentar-la amb el botó superior.' : 'Hubo un error en la traducción automática. Puedes reintentarla con el botón superior.'}
            </div>
          ` : ''}

          ${isAi ? this.renderAiPreparationCard('cierre', isCa ? 'Tancament i compromisos' : 'Cierre y compromisos', project) : `
            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
              <span class="muted" style="font-size: 13px;">${isCa ? 'Paraules:' : 'Palabras:'} <b>${wordCount}</b></span>
            </div>

            <div class="form-group">
              <label class="form-label" for="input-cierre-titulo">${window.i18n.t('general.field_cierre_title')}</label>
              <input type="text" class="input" id="input-cierre-titulo" value="${escapeHtml(cierreData.titulo || (curLang === 'ca' ? 'Tancament' : 'Cierre'))}">
            </div>

            <div class="form-group">
              <label class="form-label" for="input-cierre-cuerpo">${window.i18n.t('general.field_cierre_body')}</label>
              <textarea class="textarea" id="input-cierre-cuerpo" style="min-height: 220px;" placeholder="${isCa ? 'Conclusions, agraïments o crida al vot…' : 'Conclusiones, agradecimientos o llamamiento al voto…'}">${escapeHtml((cierreData.parrafos || []).join('\n\n'))}</textarea>
              <div class="form-hint">${isCa ? 'Cada salt de línia doble crearà un nou paràgraf.' : 'Cada salto de línea doble creará un nuevo párrafo.'}</div>
            </div>
          `}
        </div>
      `;
    }
  },

  renderAiPreparationCard(sectionKey, sectionLabel, project, area = null) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    let contextNote = '';
    let btnText = '';
    let btnId = '';
    let extraControls = '';

    if (sectionKey === 'presentacion') {
      contextNote = isCa
        ? `La IA utilitzarà el municipi (<b>${escapeHtml(project.municipio)}</b>), el mandat (${escapeHtml(project.mandato)}) i les prioritats municipals del programa.`
        : `La IA utilizará el municipio (<b>${escapeHtml(project.municipio)}</b>), el mandato (${escapeHtml(project.mandato)}) y las prioridades municipales del programa.`;
      btnText = isCa ? '🚀 Redactar presentació amb IA' : '🚀 Redactar presentación con IA';
      btnId = 'btn-trigger-ai-pres';
      extraControls = `
        <div style="margin-bottom: 14px; display: flex; gap: 14px; align-items: center;">
          <span style="font-size: 13px; font-weight: 600; color: #4c1d95;">${isCa ? 'Longitud:' : 'Longitud:'}</span>
          <label style="font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="radio" name="pres-length" value="corta" checked />
            ${isCa ? 'Curta (220–300 paraules)' : 'Corta (220–300 palabras)'}
          </label>
          <label style="font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="radio" name="pres-length" value="estandar" />
            ${isCa ? 'Estàndard (350–500 paraules)' : 'Estándar (350–500 palabras)'}
          </label>
        </div>

        <!-- Campo opcional de orientación editorial del usuario -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label" for="input-pres-orientacion" style="font-weight: 700; color: #4c1d95; font-size: 13px;">
            ${isCa ? '¿Què vols transmetre o destacar?' : '¿Qué quieres transmitir o destacar?'}
          </label>
          <textarea class="textarea" id="input-pres-orientacion" style="min-height: 70px; background: white; font-size: 13.5px;" placeholder="${isCa ? 'Opcional. Pots indicar una idea principal, l’enfocament que vols donar o alguna cosa que consideris important que aparegui a la presentació.' : 'Opcional. Puedes indicar una idea principal, el enfoque que quieres dar o algo que consideres importante que aparezca en la presentación.'}"></textarea>
          <div class="form-hint" style="color: #6b21a8; font-size: 12px;">
            ${isCa ? 'Opcional. Guia editorial per a la IA. No s’imprimeix directament al document ni substitueix el text.' : 'Opcional. Guía editorial para la IA. No se imprime directamente en el documento ni sustituye el texto.'}
          </div>
        </div>
      `;
    } else if (sectionKey === 'introducciones') {
      const incCount = area?.medidas ? area.medidas.filter(m => ['incluida', 'adaptada'].includes(m.decision?.estado)).length : 0;
      contextNote = isCa
        ? `La IA redactarà una introducció neta de 80–120 paraules i una frase destacada per a <b>${escapeHtml(area?.nombre || '')}</b> basant-se en les <b>${incCount} mesures incloses</b>.`
        : `La IA redactará una introducción limpia de 80–120 palabras y una frase destacada para <b>${escapeHtml(area?.nombre || '')}</b> basándose en las <b>${incCount} medidas incluidas</b>.`;
      btnText = isCa ? '🚀 Generar introducció d\'àrea amb IA' : '🚀 Generar introducción de área con IA';
      btnId = 'btn-trigger-ai-intro';
    } else {
      contextNote = isCa
        ? `La IA redactarà una cloenda política transformadora de 150–250 paraules per al programa electoral de <b>${escapeHtml(project.municipio)}</b>.`
        : `La IA redactará un cierre político transformador de 150–250 palabras para el programa electoral de <b>${escapeHtml(project.municipio)}</b>.`;
      btnText = isCa ? '🚀 Redactar tancament amb IA' : '🚀 Redactar cierre con IA';
      btnId = 'btn-trigger-ai-cierre';
    }

    return `
      <div style="background: #faf5ff; border: 1.5px solid #d8b4fe; border-radius: var(--radius-lg); padding: 24px; margin-top: 8px;">
        <div style="display: flex; gap: 14px; align-items: flex-start;">
          <div style="font-size: 28px; width: 44px; height: 44px; border-radius: 10px; background: white; border: 1px solid #d8b4fe; display: grid; place-items: center;">✨</div>
          <div style="flex: 1;">
            <div style="font-weight: 800; font-size: 16px; color: #4c1d95;">
              ${isCa ? 'Generador d\'IA Local per a ' + sectionLabel : 'Generador de IA Local para ' + sectionLabel}
            </div>
            <p style="font-size: 13.5px; margin: 6px 0 16px; line-height: 1.5; color: #5b21b6;">
              ${contextNote}
            </p>

            ${extraControls}

            <div style="display: flex; gap: 12px; align-items: center;">
              <button class="btn primary" id="${btnId}" style="background: #7c3aed; font-weight: 700; padding: 10px 18px;">
                ${btnText}
              </button>
            </div>
          </div>
        </div>

        <div class="notice" style="margin-top: 18px; font-size: 12.5px; background: white; border-left: 4px solid #7c3aed; padding: 10px 14px;">
          <b>${isCa ? 'Principi rector:' : 'Principio rector:'}</b> <i>${isCa ? 'La IA proposa, l\'usuari decideix.' : 'La IA propone, el usuario decide.'}</i> ${isCa ? 'Podreu revisar, comparar amb l\'anterior, editar i acceptar o descartar la proposta abans d\'incorporar-la.' : 'Podrás revisar, comparar con el anterior, editar y aceptar o descartar la propuesta antes de incorporarla.'}
        </div>
      </div>
    `;
  },

  bindEvents(container, project, textos) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const curLang = this.currentLang || project.idioma_principal || 'es';
    const oppLang = curLang === 'ca' ? 'es' : 'ca';

    const btnHelpScreen = container.querySelector('#btn-help-this-screen');
    if (btnHelpScreen) {
      btnHelpScreen.addEventListener('click', () => {
        if (window.Tutorial) window.Tutorial.startSectionTour('general_texts');
      });
    }

    container.querySelector('#btn-goto-review').addEventListener('click', async () => {
      await this.saveData(project);
      App.navigateTo('revisar-exportar');
    });

    // Pestañas de subsección
    const btnPres = container.querySelector('#btn-tab-presentacion');
    const btnIntros = container.querySelector('#btn-tab-intros');
    const btnCierre = container.querySelector('#btn-tab-cierre');

    btnPres.addEventListener('click', async () => {
      await this.saveData(project);
      this.currentSubSection = 'presentacion';
      this.render(container, project);
    });

    btnIntros.addEventListener('click', async () => {
      await this.saveData(project);
      this.currentSubSection = 'introducciones';
      this.render(container, project);
    });

    btnCierre.addEventListener('click', async () => {
      await this.saveData(project);
      this.currentSubSection = 'cierre';
      this.render(container, project);
    });

    // Conmutadores de idioma de edición
    const btnLangEs = container.querySelector('#btn-lang-es');
    const btnLangCa = container.querySelector('#btn-lang-ca');
    if (btnLangEs) {
      btnLangEs.addEventListener('click', async () => {
        if (this.currentLang === 'es') return;
        await this.saveData(project);
        this.currentLang = 'es';
        this.render(container, project);
      });
    }
    if (btnLangCa) {
      btnLangCa.addEventListener('click', async () => {
        if (this.currentLang === 'ca') return;
        await this.saveData(project);
        this.currentLang = 'ca';
        this.render(container, project);
      });
    }

    // Toggle Propio / IA
    const togglePresP = container.querySelector('#toggle-pres-propio');
    const togglePresIa = container.querySelector('#toggle-pres-ia');
    if (togglePresP && togglePresIa) {
      togglePresP.addEventListener('click', () => { this.activeAiMode.presentacion = 'propio'; this.render(container, project); });
      togglePresIa.addEventListener('click', () => { this.activeAiMode.presentacion = 'ia'; this.render(container, project); });
    }

    const toggleIntroP = container.querySelector('#toggle-intro-propio');
    const toggleIntroIa = container.querySelector('#toggle-intro-ia');
    if (toggleIntroP && toggleIntroIa) {
      toggleIntroP.addEventListener('click', () => { this.activeAiMode.introducciones = 'propio'; this.render(container, project); });
      toggleIntroIa.addEventListener('click', () => { this.activeAiMode.introducciones = 'ia'; this.render(container, project); });
    }

    const toggleCierreP = container.querySelector('#toggle-cierre-propio');
    const toggleCierreIa = container.querySelector('#toggle-cierre-ia');
    if (toggleCierreP && toggleCierreIa) {
      toggleCierreP.addEventListener('click', () => { this.activeAiMode.cierre = 'propio'; this.render(container, project); });
      toggleCierreIa.addEventListener('click', () => { this.activeAiMode.cierre = 'ia'; this.render(container, project); });
    }

    // Botón de traducción completa de la sección con IA
    const btnTranslateSec = container.querySelector('#btn-translate-sec-ia');
    if (btnTranslateSec) {
      btnTranslateSec.addEventListener('click', () => {
        let objToTranslate = null;
        let originalText = '';
        let taskTitle = '';

        if (this.currentSubSection === 'presentacion') {
          const presOpp = textos.presentacion?.[oppLang] || {};
          objToTranslate = {
            titulo: presOpp.titulo || '',
            entradilla: presOpp.entradilla || '',
            parrafos: presOpp.parrafos || []
          };
          const presCur = textos.presentacion?.[curLang] || {};
          originalText = [presCur.entradilla || '', ...(presCur.parrafos || [])].join('\n\n').trim();
          taskTitle = isCa ? 'Traducció de presentació amb IA' : 'Traducción de presentación con IA';
        } else if (this.currentSubSection === 'introducciones') {
          const introOpp = textos.introducciones_areas?.[this.selectedIntroAreaId]?.[oppLang] || {};
          objToTranslate = {
            entradilla: introOpp.entradilla || '',
            texto: introOpp.texto || '',
            frase_destacada: introOpp.frase_destacada || ''
          };
          const introCur = textos.introducciones_areas?.[this.selectedIntroAreaId]?.[curLang] || {};
          originalText = [introCur.entradilla || '', introCur.texto || '', introCur.frase_destacada ? `Frase destacada: ${introCur.frase_destacada}` : ''].filter(Boolean).join('\n\n');
          taskTitle = isCa ? 'Traducció d’introducció d’àrea amb IA' : 'Traducción de introducción de área con IA';
        } else if (this.currentSubSection === 'cierre') {
          const cierreOpp = textos.cierre?.[oppLang] || {};
          objToTranslate = {
            titulo: cierreOpp.titulo || '',
            parrafos: cierreOpp.parrafos || []
          };
          const cierreCur = textos.cierre?.[curLang] || {};
          originalText = (cierreCur.parrafos || []).join('\n\n').trim();
          taskTitle = isCa ? 'Traducció de tancament amb IA' : 'Traducción de cierre con IA';
        }

        if (!objToTranslate) return;

        AiModalHelper.showProposalModal({
          taskTitle,
          taskMethod: 'aiTranslateStructuredText',
          taskParams: {
            objeto: objToTranslate,
            de: oppLang,
            a: curLang
          },
          originalText,
          onAccept: async (result) => {
            const resData = result.data || result;
            const updatedTextos = JSON.parse(JSON.stringify(textos));

            if (this.currentSubSection === 'presentacion') {
              if (!updatedTextos.presentacion) updatedTextos.presentacion = { es: {}, ca: {} };
              updatedTextos.presentacion[curLang] = {
                titulo: resData.titulo || (curLang === 'ca' ? 'Un projecte comú per als barris i els serveis públics' : 'Un proyecto común para los barrios y los servicios públicos'),
                entradilla: resData.entradilla || '',
                parrafos: Array.isArray(resData.parrafos) ? resData.parrafos : [],
                estado: 'propuesta'
              };
            } else if (this.currentSubSection === 'introducciones') {
              if (!updatedTextos.introducciones_areas) updatedTextos.introducciones_areas = {};
              if (!updatedTextos.introducciones_areas[this.selectedIntroAreaId]) {
                updatedTextos.introducciones_areas[this.selectedIntroAreaId] = { es: {}, ca: {} };
              }
              updatedTextos.introducciones_areas[this.selectedIntroAreaId][curLang] = {
                entradilla: resData.entradilla || '',
                texto: resData.texto || '',
                frase_destacada: resData.frase_destacada || '',
                estado: 'propuesta'
              };
            } else if (this.currentSubSection === 'cierre') {
              if (!updatedTextos.cierre) updatedTextos.cierre = { es: {}, ca: {} };
              updatedTextos.cierre[curLang] = {
                titulo: resData.titulo || (curLang === 'ca' ? 'El nostre compromís: fets, paraula i futur' : 'Nuestro compromiso: hechos, palabra y futuro'),
                parrafos: Array.isArray(resData.parrafos) ? resData.parrafos : [],
                estado: 'propuesta'
              };
            }

            await this.saveData(project, updatedTextos);
            this.render(container, project);
          }
        });
      });
    }

    // Botón de traducción por lote de textos pendientes
    const btnBatch = container.querySelector('#btn-batch-translate-pending');
    if (btnBatch) {
      btnBatch.addEventListener('click', async () => {
        btnBatch.disabled = true;
        btnBatch.textContent = isCa ? 'Traduint…' : 'Traduciendo…';
        await this.batchTranslatePending(project, curLang, (done, total) => {
          btnBatch.textContent = `${isCa ? 'Traduint' : 'Traduciendo'} (${done}/${total})…`;
        });
        await this.render(container, project);
      });
    }

    const stripMd = (s) => (s || '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim();

    // Botón de ejecución IA para Presentación
    const btnTriggerPres = container.querySelector('#btn-trigger-ai-pres');
    if (btnTriggerPres) {
      btnTriggerPres.addEventListener('click', () => {
        const lenEl = container.querySelector('input[name="pres-length"]:checked');
        const longitud = lenEl ? lenEl.value : 'estandar';
        const orientacionEl = container.querySelector('#input-pres-orientacion');
        const orientacion = orientacionEl ? orientacionEl.value.trim() : '';

        // Recopilar ejes y prioridades de área como contexto compacto
        const areaPriorities = [];
        (project.areas || []).forEach(a => {
          const incCount = (a.medidas || []).filter(m => m.decision?.estado === 'incluida' || m.decision?.estado === 'adaptada').length +
                           (a.medidas_propias || []).filter(m => m.estado === 'incluida' || m.estado === 'adaptada').length;
          if (incCount > 0) {
            const areaName = curLang === 'ca' ? (a.nombre_ca || a.nombre) : a.nombre;
            areaPriorities.push(areaName);
          }
        });

        const presCur = textos.presentacion?.[curLang] || {};
        const currentFull = [presCur.entradilla || '', ...(presCur.parrafos || [])].join('\n\n').trim();

        AiModalHelper.showProposalModal({
          taskTitle: isCa ? 'Redacció de presentació política amb IA' : 'Redacción de presentación política con IA',
          taskMethod: 'aiDraftPresentation',
          taskParams: {
            municipio: project.municipio || '',
            partido: project.partido || 'Podemos',
            organizacion: project.partido || 'Podemos',
            lema: project.lema || '',
            habitantes: project.habitantes || null,
            idioma: curLang,
            longitud: longitud === 'corta' ? 'corta' : 'estandar',
            orientacion_usuario: orientacion,
            ejes_prioridades: areaPriorities.slice(0, 8),
            medidas_resumen: areaPriorities.slice(0, 8)
          },
          originalText: currentFull,
          onAccept: async (result) => {
            const resData = result.data || result;
            let titulo = stripMd(result.titulo || resData.titulo);
            let entradilla = stripMd(result.entradilla || resData.entradilla || '');
            let parrafos = Array.isArray(result.parrafos) && result.parrafos.length > 0
              ? result.parrafos.map(stripMd)
              : (Array.isArray(resData.parrafos) && resData.parrafos.length > 0
                  ? resData.parrafos.map(stripMd)
                  : []);

            if (parrafos.length === 0 || (result.texto && result.texto !== [entradilla, ...parrafos].filter(Boolean).join('\n\n'))) {
              const fullText = (result.texto || '').trim();
              const pars = fullText.split(/\n\s*\n/).map(stripMd).filter(Boolean);
              if (pars.length > 1) {
                entradilla = pars[0];
                parrafos = pars.slice(1);
              } else if (pars.length === 1) {
                if (!entradilla) {
                  entradilla = pars[0];
                  parrafos = [];
                } else {
                  parrafos = pars;
                }
              }
            }

            const forbiddenTitles = /^(?:Carta de Presentaci[óo]n|Presentaci[óo]n|Apertura|Cierre|Tancament|Conclusi[óo]n)[\s,:\.]*$/i;
            if (!titulo || forbiddenTitles.test(titulo.trim())) {
              titulo = curLang === 'ca'
                ? `Un projecte comú per a ${project.municipio || 'el municipi'}: serveis públics i drets garantits`
                : `Un proyecto común para ${project.municipio || 'el municipio'}: servicios públicos y derechos garantizados`;
            }

            const updatedTextos = JSON.parse(JSON.stringify(textos));
            if (!updatedTextos.presentacion) updatedTextos.presentacion = { es: {}, ca: {} };
            updatedTextos.presentacion[curLang] = {
              titulo,
              entradilla,
              parrafos,
              estado: curLang === project.idioma_principal ? 'original' : 'revisada'
            };

            if (curLang === project.idioma_principal) {
              updatedTextos.presentacion_titulo = titulo;
              updatedTextos.presentacion_entradilla = entradilla;
              updatedTextos.presentacion_parrafos = parrafos;
            }

            const oppLang = curLang === 'ca' ? 'es' : 'ca';
            const token = Date.now();
            this.activeTranslationTokens = this.activeTranslationTokens || {};
            this.activeTranslationTokens['presentacion_' + oppLang] = token;
            if (!updatedTextos.presentacion[oppLang]) updatedTextos.presentacion[oppLang] = {};
            updatedTextos.presentacion[oppLang].estado = 'traduciendo';
            updatedTextos.presentacion[oppLang]._token = token;

            // 1. Persistir INMEDIATAMENTE el texto original aceptado en SQLite
            await this.saveData(project, updatedTextos);
            this.activeAiMode.presentacion = 'propio';
            this.render(container, project);

            // 2. Ejecutar traducción automática secundaria de forma independiente
            const transOk = await this.autoTranslateSecondary(project, 'presentacion', curLang, { titulo, entradilla, parrafos, token }, updatedTextos);
            if (transOk) {
              await this.saveData(project, updatedTextos);
              this.render(container, project);
            } else {
              if (this.activeTranslationTokens['presentacion_' + oppLang] === token) {
                updatedTextos.presentacion[oppLang].estado = 'error_traduccion';
                await this.saveData(project, updatedTextos);
                this.render(container, project);
              }
            }
          }
        });
      });
    }

    // Botón de ejecución IA para Introducción de Área
    const btnTriggerIntro = container.querySelector('#btn-trigger-ai-intro');
    if (btnTriggerIntro) {
      btnTriggerIntro.addEventListener('click', () => {
        const area = project.areas.find(a => a.id === this.selectedIntroAreaId);
        if (!area) return;

        const introCur = textos.introducciones_areas?.[area.id]?.[curLang] || textos.introducciones_areas?.[area.id] || {};
        const currentIntro = [introCur.entradilla || '', introCur.texto || '', introCur.frase_destacada ? `Frase destacada: ${introCur.frase_destacada}` : ''].filter(Boolean).join('\n\n');
        const incMeasures = (area.medidas || []).filter(m => ['incluida', 'adaptada'].includes(m.decision?.estado));
        const sampleTitles = incMeasures.map(m => {
          if (curLang === 'ca') {
            return (m.decision?.traduccion_titulo || m.decision?.version_municipal_titulo_ca || m.titulo_ca || m.decision?.version_municipal_titulo || m.titulo || '').trim();
          }
          return (m.decision?.version_municipal_titulo || m.titulo || '').trim();
        }).filter(Boolean);

        AiModalHelper.showProposalModal({
          taskTitle: isCa ? `Introducció d'àrea: ${area.nombre}` : `Introducción de área: ${area.nombre}`,
          taskMethod: 'aiDraftAreaIntro',
          taskParams: {
            area: curLang === 'ca' ? (area.nombre_ca || area.nombre) : area.nombre,
            area_nombre: curLang === 'ca' ? (area.nombre_ca || area.nombre) : area.nombre,
            municipio: project.municipio || '',
            medidas_incluidas: sampleTitles.slice(0, 8),
            idioma: curLang
          },
          originalText: currentIntro,
          onAccept: async (result) => {
            const cleanTag = (str) => {
              if (!str) return '';
              return stripMd(str)
                .replace(/^\[(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text)\]:?\s*/gi, '')
                .replace(/^(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita|texto|text)[:\s*]+/gi, '')
                .replace(/^\d+[\.\)]\s*/, '')
                .replace(/^(?:Esta introducción|Aquesta introducció|Esta área|Aquesta àrea|En este apartado|En aquest apartat|En esta sección|En aquesta secció|A continuación|A continuació)[\s,:]+/i, '')
                .replace(/^["'*]+|["'*]+$/g, '')
                .trim();
            };

            let entradilla = cleanTag(result.data?.entradilla || result.entradilla || '');
            let texto = cleanTag(result.data?.texto || result.texto || '');
            let frase = cleanTag(result.data?.frase_destacada || result.frase_destacada || '');

            if (result.texto && (!entradilla && !texto)) {
              const raw = result.texto;
              try {
                const jMatch = raw.match(/\{[\s\S]*?\}/);
                if (jMatch) {
                  const pJson = JSON.parse(jMatch[0]);
                  if (pJson.entradilla) entradilla = cleanTag(pJson.entradilla);
                  if (pJson.texto) texto = cleanTag(pJson.texto);
                  if (pJson.frase_destacada || pJson.frase) frase = cleanTag(pJson.frase_destacada || pJson.frase);
                }
              } catch (e) {}

              if (!entradilla && !texto) {
                const entMatch = raw.match(/\[Entradilla\]\s*([\s\S]*?)(?=\[(?:Prioritats|Prioridades|Frase destacada)\]|$)/i);
                const txtMatch = raw.match(/\[(?:Prioritats|Prioridades)\]\s*([\s\S]*?)(?=\[Frase destacada\]|$)/i);
                const fraMatch = raw.match(/\[Frase destacada\]\s*"?([\s\S]*?)"?$/i);

                if (entMatch || txtMatch || fraMatch) {
                  if (entMatch) entradilla = cleanTag(entMatch[1]);
                  if (txtMatch) texto = cleanTag(txtMatch[1]);
                  if (fraMatch) frase = cleanTag(fraMatch[1]);
                } else {
                  const pars = raw.split(/\n\s*\n/).map(p => cleanTag(p.trim())).filter(Boolean);
                  if (pars.length > 1) {
                    entradilla = pars[0];
                    texto = pars.slice(1).join('\n\n');
                  } else if (pars.length === 1) {
                    entradilla = pars[0];
                  }
                }
              }
            }

            const updatedTextos = JSON.parse(JSON.stringify(textos));
            if (!updatedTextos.introducciones_areas) updatedTextos.introducciones_areas = {};
            if (!updatedTextos.introducciones_areas[area.id]) {
              updatedTextos.introducciones_areas[area.id] = { es: {}, ca: {} };
            }

            updatedTextos.introducciones_areas[area.id][curLang] = {
              entradilla,
              texto,
              frase_destacada: frase,
              estado: curLang === project.idioma_principal ? 'original' : 'revisada'
            };

            const oppLang = curLang === 'ca' ? 'es' : 'ca';
            const token = Date.now();
            this.activeTranslationTokens = this.activeTranslationTokens || {};
            this.activeTranslationTokens[`intro_${area.id}_${oppLang}`] = token;
            if (!updatedTextos.introducciones_areas[area.id][oppLang]) {
              updatedTextos.introducciones_areas[area.id][oppLang] = {};
            }
            updatedTextos.introducciones_areas[area.id][oppLang].estado = 'traduciendo';
            updatedTextos.introducciones_areas[area.id][oppLang]._token = token;

            // 1. Persistir INMEDIATAMENTE el texto original aceptado en SQLite
            await this.saveData(project, updatedTextos);
            this.activeAiMode.introducciones = 'propio';
            this.render(container, project);

            // 2. Ejecutar traducción automática secundaria de forma independiente
            const transOk = await this.autoTranslateSecondary(project, 'introducciones', curLang, { areaId: area.id, entradilla, texto, frase_destacada: frase, token }, updatedTextos);
            if (transOk) {
              await this.saveData(project, updatedTextos);
              this.render(container, project);
            } else {
              if (this.activeTranslationTokens[`intro_${area.id}_${oppLang}`] === token) {
                updatedTextos.introducciones_areas[area.id][oppLang].estado = 'error_traduccion';
                await this.saveData(project, updatedTextos);
                this.render(container, project);
              }
            }
          }
        });
      });
    }

    // Botón de ejecución IA para Cierre
    const btnTriggerCierre = container.querySelector('#btn-trigger-ai-cierre');
    if (btnTriggerCierre) {
      btnTriggerCierre.addEventListener('click', () => {
        const cierreCur = textos.cierre?.[curLang] || {};
        const currentFull = (cierreCur.parrafos || []).join('\n\n').trim();

        const prioridadesContext = [];
        (project.areas || []).forEach(a => {
          (a.medidas || []).forEach(m => {
            if (['incluida', 'adaptada'].includes(m.decision?.estado)) {
              const tit = curLang === 'ca'
                ? (m.decision?.traduccion_titulo || m.decision?.version_municipal_titulo_ca || m.titulo_ca || m.decision?.version_municipal_titulo || m.titulo || '')
                : (m.decision?.version_municipal_titulo || m.titulo || '');
              if (tit) prioridadesContext.push(tit.trim());
            }
          });
        });

        AiModalHelper.showProposalModal({
          taskTitle: isCa ? 'Redacció de tancament del programa amb IA' : 'Redacción de cierre del programa con IA',
          taskMethod: 'aiDraftClosing',
          taskParams: {
            municipio: project.municipio || '',
            partido: project.partido || 'Podemos',
            organizacion: project.partido || 'Podemos',
            lema: project.lema || '',
            medidas_resumen: prioridadesContext.slice(0, 6),
            idioma: curLang
          },
          originalText: currentFull,
          onAccept: async (result) => {
            const resData = result.data || result;
            let titulo = stripMd(result.titulo || resData.titulo);
            let parrafos = Array.isArray(result.parrafos) && result.parrafos.length > 0
              ? result.parrafos.map(stripMd)
              : (Array.isArray(resData.parrafos) && resData.parrafos.length > 0
                  ? resData.parrafos.map(stripMd)
                  : []);

            if (parrafos.length === 0 || (result.texto && result.texto !== parrafos.join('\n\n'))) {
              const raw = (result.texto || result.cuerpo || '').trim();
              const pars = raw.split(/\n\s*\n/).map(stripMd).filter(Boolean);
              parrafos = pars.length > 0 ? pars : [raw];
            }

            const forbiddenCierre = /^(?:Cierre|Tancament|Conclusi[óo]n|Conclusió)[\s,:\.]*$/i;
            if (!titulo || forbiddenCierre.test(titulo.trim())) {
              titulo = curLang === 'ca'
                ? `El nostre compromís amb ${project.municipio || 'el municipi'}: fets, paraula i futur`
                : `Nuestro compromiso con ${project.municipio || 'el municipio'}: hechos, palabra y futuro`;
            }

            const updatedTextos = JSON.parse(JSON.stringify(textos));
            if (!updatedTextos.cierre) updatedTextos.cierre = { es: {}, ca: {} };
            updatedTextos.cierre[curLang] = {
              titulo,
              parrafos,
              estado: curLang === project.idioma_principal ? 'original' : 'revisada'
            };

            if (curLang === project.idioma_principal) {
              updatedTextos.cierre_titulo = titulo;
              updatedTextos.cierre_parrafos = parrafos;
            }

            const oppLang = curLang === 'ca' ? 'es' : 'ca';
            const token = Date.now();
            this.activeTranslationTokens = this.activeTranslationTokens || {};
            this.activeTranslationTokens['cierre_' + oppLang] = token;
            if (!updatedTextos.cierre[oppLang]) updatedTextos.cierre[oppLang] = {};
            updatedTextos.cierre[oppLang].estado = 'traduciendo';
            updatedTextos.cierre[oppLang]._token = token;

            // 1. Persistir INMEDIATAMENTE el texto original aceptado en SQLite
            await this.saveData(project, updatedTextos);
            this.activeAiMode.cierre = 'propio';
            this.render(container, project);

            // 2. Ejecutar traducción automática secundaria de forma independiente
            const transOk = await this.autoTranslateSecondary(project, 'cierre', curLang, { titulo, parrafos, token }, updatedTextos);
            if (transOk) {
              await this.saveData(project, updatedTextos);
              this.render(container, project);
            } else {
              if (this.activeTranslationTokens['cierre_' + oppLang] === token) {
                updatedTextos.cierre[oppLang].estado = 'error_traduccion';
                await this.saveData(project, updatedTextos);
                this.render(container, project);
              }
            }
          }
        });
      });
    }

    // Inputs inside the active subsection
    const bodyContainer = container.querySelector('#general-text-body-container');
    const inputs = bodyContainer.querySelectorAll('input, textarea, select');
    inputs.forEach(inp => {
      if (inp.id === 'select-intro-area') {
        inp.addEventListener('change', async () => {
          await this.saveData(project);
          this.selectedIntroAreaId = inp.value;
          this.render(container, project);
        });
      } else if (inp.id !== 'input-pres-orientacion') {
        inp.addEventListener('input', () => this.triggerAutosave(project));
      }
    });
  },

  triggerAutosave(project) {
    App.notifySaving();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      await this.saveData(project);
      App.notifySaved();
    }, 450);
  },

  async saveData(project, textosOverride = null) {
    let textosToSave = textosOverride;
    const curLang = this.currentLang || project.idioma_principal || 'es';
    const isMainLang = curLang === (project.idioma_principal || 'es');

    // Invalida cualquier traducción secundaria pendiente en caso de edición manual en este idioma
    this.activeTranslationTokens = this.activeTranslationTokens || {};
    this.activeTranslationTokens['presentacion_' + curLang] = 0;
    this.activeTranslationTokens['cierre_' + curLang] = 0;
    if (this.selectedIntroAreaId) {
      this.activeTranslationTokens[`intro_${this.selectedIntroAreaId}_${curLang}`] = 0;
    }

    if (!textosToSave) {
      const root = document.querySelector('#general-text-body-container');
      if (!root) return;

      const textos = project.textos_generales ? JSON.parse(JSON.stringify(project.textos_generales)) : {};
      if (!textos.presentacion) textos.presentacion = { es: {}, ca: {} };
      if (!textos.introducciones_areas) textos.introducciones_areas = {};
      if (!textos.cierre) textos.cierre = { es: {}, ca: {} };

      if (this.currentSubSection === 'presentacion') {
        const tit = root.querySelector('#input-pres-titulo')?.value;
        const ent = root.querySelector('#input-pres-entradilla')?.value;
        const body = root.querySelector('#input-pres-cuerpo')?.value;

        if (tit !== undefined || ent !== undefined || body !== undefined) {
          const prevPres = textos.presentacion[curLang] || {};
          const pars = body !== undefined ? body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : (prevPres.parrafos || []);
          textos.presentacion[curLang] = {
            titulo: tit !== undefined ? tit : (prevPres.titulo || (curLang === 'ca' ? 'Presentació' : 'Presentación')),
            entradilla: ent !== undefined ? ent : (prevPres.entradilla || ''),
            parrafos: pars,
            estado: prevPres.estado || (isMainLang ? 'original' : 'revisada')
          };
          if (isMainLang) {
            textos.presentacion_titulo = textos.presentacion[curLang].titulo;
            textos.presentacion_entradilla = textos.presentacion[curLang].entradilla;
            textos.presentacion_parrafos = pars;
          }
        }
      } else if (this.currentSubSection === 'introducciones') {
        const cuerpo = root.querySelector('#input-intro-cuerpo')?.value;
        const frase = root.querySelector('#input-intro-frase')?.value;

        if (cuerpo !== undefined || frase !== undefined) {
          const cleanTag = (s) => (s || '')
            .replace(/\[(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita)\]:?\s*/gi, '')
            .replace(/^(?:entradilla|entradeta|prioritats|prioridades|frase destacada|cita):?\s*/gim, '')
            .trim();

          let ent = '';
          let txt = '';
          if (cuerpo !== undefined) {
            const cleanCuerpo = cleanTag(cuerpo);
            const pars = cleanCuerpo.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
            if (pars.length > 1) {
              ent = pars[0];
              txt = pars.slice(1).join('\n\n');
            } else if (pars.length === 1) {
              ent = pars[0];
              txt = '';
            }
          }

          const cleanFrase = cleanTag(frase || '').replace(/^["'*]+|["'*]+$/g, '').trim();
          const aid = this.selectedIntroAreaId;

          if (!textos.introducciones_areas[aid]) {
            textos.introducciones_areas[aid] = { es: {}, ca: {} };
          }
          const prevIntro = textos.introducciones_areas[aid][curLang] || {};
          textos.introducciones_areas[aid][curLang] = {
            entradilla: cuerpo !== undefined ? ent : (prevIntro.entradilla || ''),
            texto: cuerpo !== undefined ? txt : (prevIntro.texto || ''),
            frase_destacada: frase !== undefined ? cleanFrase : (prevIntro.frase_destacada || ''),
            estado: prevIntro.estado || (isMainLang ? 'original' : 'revisada')
          };
        }
      } else if (this.currentSubSection === 'cierre') {
        const tit = root.querySelector('#input-cierre-titulo')?.value;
        const body = root.querySelector('#input-cierre-cuerpo')?.value;

        if (tit !== undefined || body !== undefined) {
          const prevCierre = textos.cierre[curLang] || {};
          const pars = body !== undefined ? body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : (prevCierre.parrafos || []);
          textos.cierre[curLang] = {
            titulo: tit !== undefined ? tit : (prevCierre.titulo || (curLang === 'ca' ? 'Tancament' : 'Cierre')),
            parrafos: pars,
            estado: prevCierre.estado || (isMainLang ? 'original' : 'revisada')
          };
          if (isMainLang) {
            textos.cierre_titulo = textos.cierre[curLang].titulo;
            textos.cierre_parrafos = pars;
          }
        }
      }

      textosToSave = textos;
    } else {
      // Sincronizar campos raíz de compatibilidad si es el idioma principal
      if (isMainLang) {
        if (textosToSave.presentacion && textosToSave.presentacion[curLang]) {
          textosToSave.presentacion_titulo = textosToSave.presentacion[curLang].titulo;
          textosToSave.presentacion_entradilla = textosToSave.presentacion[curLang].entradilla;
          textosToSave.presentacion_parrafos = textosToSave.presentacion[curLang].parrafos;
        }
        if (textosToSave.cierre && textosToSave.cierre[curLang]) {
          textosToSave.cierre_titulo = textosToSave.cierre[curLang].titulo;
          textosToSave.cierre_parrafos = textosToSave.cierre[curLang].parrafos;
        }
      }
    }

    project.textos_generales = textosToSave;
    await window.api.updateGeneralTexts(project.id, {
      ...textosToSave,
      idioma_edicion: curLang
    });
  },

  async autoTranslateSecondary(project, section, curLang, data, updatedTextos) {
    if (!window.api || (!window.api.aiTranslateStructuredText && !window.api.aiTranslateText)) return false;
    const oppLang = curLang === 'ca' ? 'es' : 'ca';
    const tokenKey = section === 'introducciones' ? `intro_${data.areaId}_${oppLang}` : `${section}_${oppLang}`;
    const token = data.token;

    try {
      if (section === 'presentacion') {
        const objToTranslate = {
          titulo: data.titulo || '',
          entradilla: data.entradilla || '',
          parrafos: data.parrafos || []
        };
        const res = await window.api.aiTranslateStructuredText({
          objeto: objToTranslate,
          de: curLang,
          a: oppLang
        });
        if (token && this.activeTranslationTokens && this.activeTranslationTokens[tokenKey] !== token) {
          console.log(`[AutoTranslate] Omitiendo guardado de presentación: cambio manual posterior`);
          return false;
        }
        if (res && res.ok === false) {
          console.warn('[AutoTranslate] Error al traducir presentación:', res.error);
          return false;
        }
        const resData = res?.data || res;
        if (resData && (resData.entradilla || (resData.parrafos && resData.parrafos.length > 0))) {
          if (!updatedTextos.presentacion) updatedTextos.presentacion = { es: {}, ca: {} };
          updatedTextos.presentacion[oppLang] = {
            titulo: resData.titulo || (oppLang === 'ca' ? 'Un projecte comú per als barris i els serveis públics' : 'Un proyecto común para los barrios y los servicios públicos'),
            entradilla: resData.entradilla || '',
            parrafos: Array.isArray(resData.parrafos) ? resData.parrafos : [],
            estado: 'propuesta'
          };
          return true;
        }
      } else if (section === 'introducciones') {
        const areaId = data.areaId;
        const objToTranslate = {
          entradilla: data.entradilla || '',
          texto: data.texto || '',
          frase_destacada: data.frase_destacada || ''
        };
        const res = await window.api.aiTranslateStructuredText({
          objeto: objToTranslate,
          de: curLang,
          a: oppLang
        });
        if (token && this.activeTranslationTokens && this.activeTranslationTokens[tokenKey] !== token) {
          console.log(`[AutoTranslate] Omitiendo guardado de intro ${areaId}: cambio manual posterior`);
          return false;
        }
        if (res && res.ok === false) {
          console.warn(`[AutoTranslate] Error al traducir intro ${areaId}:`, res.error);
          return false;
        }
        const resData = res?.data || res;
        if (resData && (resData.entradilla || resData.texto)) {
          if (!updatedTextos.introducciones_areas) updatedTextos.introducciones_areas = {};
          if (!updatedTextos.introducciones_areas[areaId]) updatedTextos.introducciones_areas[areaId] = { es: {}, ca: {} };
          updatedTextos.introducciones_areas[areaId][oppLang] = {
            entradilla: resData.entradilla || '',
            texto: resData.texto || '',
            frase_destacada: resData.frase_destacada || '',
            estado: 'propuesta'
          };
          return true;
        }
      } else if (section === 'cierre') {
        const objToTranslate = {
          titulo: data.titulo || '',
          parrafos: data.parrafos || []
        };
        const res = await window.api.aiTranslateStructuredText({
          objeto: objToTranslate,
          de: curLang,
          a: oppLang
        });
        if (token && this.activeTranslationTokens && this.activeTranslationTokens[tokenKey] !== token) {
          console.log(`[AutoTranslate] Omitiendo guardado de cierre: cambio manual posterior`);
          return false;
        }
        if (res && res.ok === false) {
          console.warn('[AutoTranslate] Error al traducir cierre:', res.error);
          return false;
        }
        const resData = res?.data || res;
        if (resData && (resData.parrafos && resData.parrafos.length > 0)) {
          if (!updatedTextos.cierre) updatedTextos.cierre = { es: {}, ca: {} };
          updatedTextos.cierre[oppLang] = {
            titulo: resData.titulo || (oppLang === 'ca' ? 'El nostre compromís: fets, paraula i futur' : 'Nuestro compromiso: hechos, palabra y futuro'),
            parrafos: Array.isArray(resData.parrafos) ? resData.parrafos : [],
            estado: 'propuesta'
          };
          return true;
        }
      }
    } catch (err) {
      console.warn(`[Auto-traducción ${section}] Error traduciendo automáticamente a ${oppLang}:`, err);
    }
    return false;
  }
};

window.GeneralTextsView = GeneralTextsView;
