/**
 * adaptMeasureView.js - Vista de Adaptación de Medida Municipal
 * Constructor de Programas Municipales - Versión 2.0.4
 */

const AdaptMeasureView = {
  currentMeasureId: null,
  isPropia: false,
  debounceTimer: null,

  async render(container, project, measureId, isPropia = false) {
    if (!project) return;

    this.currentMeasureId = measureId;
    this.isPropia = isPropia;

    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const pLang = project.idioma_principal || 'es';
    const secLang = pLang === 'ca' ? 'es' : 'ca';
    const secLangLabel = secLang === 'ca' ? 'Català' : 'Castellano';

    // Find measure and its area
    let currentArea = null;
    let measure = null;
    let measureIndex = 1;
    let totalAreaMeasures = 1;

    for (const a of project.areas) {
      if (isPropia) {
        const found = (a.medidas_propias || []).find(p => p.id === measureId);
        if (found) {
          currentArea = a;
          measure = found;
          break;
        }
      } else {
        const idx = a.medidas.findIndex(m => m.id === measureId);
        if (idx !== -1) {
          currentArea = a;
          measure = a.medidas[idx];
          measureIndex = idx + 1;
          totalAreaMeasures = a.medidas.length;
          break;
        }
      }
    }

    if (!measure) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>${isCa ? 'Mesura no trobada' : 'Medida no encontrada'}</h3>
          <button class="btn primary" id="btn-back-to-measures">${isCa ? 'Tornar a Triar mesures' : 'Volver a Elegir medidas'}</button>
        </div>
      `;
      container.querySelector('#btn-back-to-measures').addEventListener('click', () => App.navigateTo('elegir-medidas'));
      return;
    }

    const decision = measure.decision || {
      estado: isPropia ? 'adaptada' : 'sin_revisar',
      version_municipal_titulo: measure.titulo,
      version_municipal_texto: measure.texto,
      version_municipal_explicacion: measure.explicacion,
      nota_interna: '',
      traduccion_titulo: '',
      traduccion_texto: '',
      estado_traduccion: 'sin_traduccion'
    };

    const est = decision.estado || 'sin_revisar';
    let chipClass = 'unreviewed';
    let chipText = window.i18n.t('choose.filter_state_unreviewed');
    if (est === 'incluida') {
      chipClass = 'included';
      chipText = window.i18n.t('choose.filter_state_included');
    } else if (est === 'adaptada') {
      chipClass = 'adapted';
      chipText = isPropia ? window.i18n.t('choose.chip_own') : window.i18n.t('choose.filter_state_adapted');
    } else if (est === 'en_duda') {
      chipClass = 'doubt';
      chipText = window.i18n.t('choose.filter_state_doubt');
    }

    const currentTradEstado = decision.estado_traduccion || (decision.traduccion_texto ? 'propuesta' : 'sin_traduccion');

    // Previous and Next measure in the same area
    let prevId = null;
    let nextId = null;
    if (!isPropia && currentArea) {
      const curIdx = currentArea.medidas.findIndex(m => m.id === measureId);
      if (curIdx > 0) prevId = currentArea.medidas[curIdx - 1].id;
      if (curIdx < currentArea.medidas.length - 1) nextId = currentArea.medidas[curIdx + 1].id;
    }

    container.innerHTML = `
      <div class="view-header" style="margin-bottom: 12px;">
        <div class="view-header-left">
          <div class="label">
            ${escapeHtml(currentArea.nombre)} ${!isPropia ? `· ${isCa ? 'Mesura' : 'Medida'} ${measureIndex} de ${totalAreaMeasures}` : (isCa ? '· Mesura pròpia' : '· Medida propia')}
          </div>
          <h1 class="title" style="font-size: 24px; margin-top: 4px;">
            ${escapeHtml(decision.version_municipal_titulo || measure.titulo || (isCa ? '(Mesura sense títol)' : '(Medida sin título)'))}
          </h1>
        </div>
        <div class="view-header-right" style="display: flex; gap: 8px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <span class="chip ${chipClass}" id="adapt-current-chip">${chipText}</span>
          <button class="btn small" id="btn-back-to-list">${window.i18n.t('adapt.adapt_back_btn')}</button>
        </div>
      </div>

      <!-- Barra de navegación rápida y cambio de estado -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px 18px; border: 1px solid var(--border-subtle); border-radius: var(--radius-default); margin-bottom: 16px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="muted" style="font-size: 13px;">${isCa ? 'Estat de la proposta:' : 'Estado de la propuesta:'}</span>
          <select class="select" id="select-measure-state" style="width: auto; height: 34px; padding: 4px 10px; font-size: 13px;">
            <option value="sin_revisar" ${est === 'sin_revisar' ? 'selected' : ''}>${window.i18n.t('choose.filter_state_unreviewed')}</option>
            <option value="incluida" ${est === 'incluida' ? 'selected' : ''}>${window.i18n.t('choose.filter_state_included')} (${isCa ? 'Text oficial' : 'Texto oficial'})</option>
            <option value="adaptada" ${est === 'adaptada' ? 'selected' : ''}>${window.i18n.t('choose.filter_state_adapted')} (${isCa ? 'Versió municipal' : 'Versión municipal'})</option>
            <option value="en_duda" ${est === 'en_duda' ? 'selected' : ''}>${window.i18n.t('choose.filter_state_doubt')}</option>
          </select>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn small" id="btn-prev-measure" ${!prevId ? 'disabled' : ''}>‹ ${isCa ? 'Anterior' : 'Anterior'}</button>
          <button class="btn small" id="btn-next-measure" ${!nextId ? 'disabled' : ''}>${isCa ? 'Següent ›' : 'Siguiente ›'}</button>
        </div>
      </div>

      <!-- Split View: Original protegido vs Versión municipal editable -->
      <div class="adapt-split-box">
        <!-- Columna Izquierda: Original Protegido -->
        <div class="adapt-panel">
          <div class="card" style="padding: 20px; height: 100%;">
            <div class="label" style="color: var(--action-link);">${window.i18n.t('adapt.protected_badge')}</div>
            <h2 class="section-title" style="font-size: 17px; margin: 8px 0 14px;">${window.i18n.t('adapt.protected_title')}</h2>

            <div class="form-group">
              <label class="form-label">${window.i18n.t('adapt.orig_title_label')}</label>
              <div class="adapt-textarea-readonly" style="min-height: auto; padding: 10px 14px; font-weight: 700;">
                ${escapeHtml(measure.titulo || (isCa ? '(Sense títol al catàleg marc)' : '(Sin título en el catálogo marco)'))}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">${window.i18n.t('adapt.orig_text_label')}</label>
              <div class="adapt-textarea-readonly" style="min-height: 180px;">
                ${escapeHtml(measure.texto || (isCa ? '(Sense text al catàleg marc)' : '(Sin texto en el catálogo marco)'))}
              </div>
            </div>

            ${measure.explicacion ? `
              <div class="form-group">
                <label class="form-label">${window.i18n.t('adapt.orig_exp_label')}</label>
                <div class="adapt-textarea-readonly" style="min-height: 90px; font-size: 13.5px; color: var(--text-secondary);">
                  ${escapeHtml(measure.explicacion)}
                </div>
              </div>
            ` : ''}

            ${measure.dudoso ? `
              <div class="notice" style="margin-top: 14px; font-size: 12.5px;">
                <b>${window.i18n.t('adapt.catalog_doubt_note')}</b> ${escapeHtml(measure.motivo_duda || 'Revisió / Revisión')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Columna Derecha: Versión Municipal Editable + Traducción -->
        <div class="adapt-panel">
          <div class="card" style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
            <div class="label" style="color: var(--included-text);">${window.i18n.t('adapt.municipal_badge')}</div>
            <h2 class="section-title" style="font-size: 17px; margin: 8px 0 14px;">${window.i18n.t('adapt.municipal_title')}</h2>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" for="edit-title" style="margin: 0;">${window.i18n.t('adapt.edit_title_label')}</label>
                <button class="btn btn-sm btn-adapt-suggest-title" type="button" style="background: #faf5ff; color: #7c3aed; border: 1px solid #d8b4fe; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                  ✨ ${isCa ? 'Suggerir títol amb IA' : 'Sugerir título con IA'}
                </button>
              </div>
              <input type="text" class="input" id="edit-title" value="${escapeHtml(decision.version_municipal_titulo || '')}" placeholder="${escapeHtml(window.i18n.t('adapt.edit_title_placeholder'))}">
            </div>

            <div class="form-group" style="flex: 1; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                <label class="form-label" for="edit-text" style="margin: 0;">${window.i18n.t('adapt.edit_text_label')}</label>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  <button class="btn btn-sm btn-adapt-ai-action" data-action="adapt" type="button" style="background: #faf5ff; color: #6b21a8; border: 1px solid #ddd6fe; font-size: 11px; font-weight: 600; padding: 2px 7px;">
                    🏛️ ${isCa ? 'Adaptar' : 'Adaptar'}
                  </button>
                  <button class="btn btn-sm btn-adapt-ai-action" data-action="develop" type="button" style="background: #faf5ff; color: #6b21a8; border: 1px solid #ddd6fe; font-size: 11px; font-weight: 600; padding: 2px 7px;">
                    📝 ${isCa ? 'Desenvolupar' : 'Desarrollar'}
                  </button>
                  <button class="btn btn-sm btn-adapt-ai-action" data-action="improve" type="button" style="background: #faf5ff; color: #6b21a8; border: 1px solid #ddd6fe; font-size: 11px; font-weight: 600; padding: 2px 7px;">
                    ✍️ ${isCa ? 'Millorar' : 'Mejorar'}
                  </button>
                  <button class="btn btn-sm btn-adapt-ai-action" data-action="correct" type="button" style="background: #faf5ff; color: #6b21a8; border: 1px solid #ddd6fe; font-size: 11px; font-weight: 600; padding: 2px 7px;">
                    🔍 ${isCa ? 'Corregir' : 'Corregir'}
                  </button>
                  <button class="btn btn-sm btn-adapt-ai-action" data-action="summarize" type="button" style="background: #faf5ff; color: #6b21a8; border: 1px solid #ddd6fe; font-size: 11px; font-weight: 600; padding: 2px 7px;">
                    ✂️ ${isCa ? 'Resumir' : 'Resumir'}
                  </button>
                  <button class="btn btn-sm btn-adapt-ai-action" data-action="translate" type="button" style="background: #faf5ff; color: #6b21a8; border: 1px solid #ddd6fe; font-size: 11px; font-weight: 600; padding: 2px 7px;">
                    🌐 ${isCa ? 'Traduir' : 'Traducir'}
                  </button>
                </div>
              </div>
              <textarea class="textarea adapt-textarea-editable" id="edit-text" style="flex: 1;" placeholder="${escapeHtml(window.i18n.t('adapt.edit_text_placeholder'))}">${escapeHtml(decision.version_municipal_texto || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-explanation">${window.i18n.t('adapt.edit_exp_label')}</label>
              <textarea class="textarea" id="edit-explanation" style="min-height: 80px;" placeholder="${escapeHtml(window.i18n.t('adapt.edit_exp_placeholder'))}">${escapeHtml(decision.version_municipal_explicacion || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-nota-interna">${window.i18n.t('adapt.edit_note_label')}</label>
              <input type="text" class="input" id="edit-nota-interna" value="${escapeHtml(decision.nota_interna || '')}" placeholder="${escapeHtml(window.i18n.t('adapt.edit_note_placeholder'))}">
            </div>

            <!-- Panel de Traducción Secundaria (Independiente y No Destructiva) -->
            <div style="margin-top: 14px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 14px; border-radius: var(--radius-default);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 700; font-size: 13px; color: #1e293b;">🌐 ${isCa ? `Traducció (${secLangLabel})` : `Traducción (${secLangLabel})`}</span>
                  ${this.getTradChip(currentTradEstado, isCa)}
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <label for="select-trad-estado" class="muted" style="font-size: 12px;">${isCa ? 'Estat:' : 'Estado:'}</label>
                  <select class="select" id="select-trad-estado" style="width: auto; height: 28px; padding: 2px 6px; font-size: 12px;">
                    <option value="sin_traduccion" ${currentTradEstado === 'sin_traduccion' ? 'selected' : ''}>${isCa ? 'Sense traducció' : 'Sin traducción'}</option>
                    <option value="propuesta" ${currentTradEstado === 'propuesta' || currentTradEstado === 'traduccion_propuesta' ? 'selected' : ''}>${isCa ? 'Traducció proposada' : 'Traducción propuesta'}</option>
                    <option value="revisada" ${currentTradEstado === 'revisada' ? 'selected' : ''}>${isCa ? 'Revisada' : 'Revisada'}</option>
                    <option value="desactualizada" ${currentTradEstado === 'desactualizada' ? 'selected' : ''}>${isCa ? 'Desactualitzada' : 'Desactualizada'}</option>
                  </select>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 8px;">
                <label class="form-label" for="edit-trad-title" style="font-size: 12px; margin-bottom: 2px;">${isCa ? `Títol en ${secLangLabel}` : `Título en ${secLangLabel}`}</label>
                <input type="text" class="input" id="edit-trad-title" value="${escapeHtml(decision.traduccion_titulo || '')}" placeholder="${isCa ? `Títol en ${secLangLabel}…` : `Título en ${secLangLabel}…`}" style="font-size: 13px; background: white;">
              </div>

              <div class="form-group" style="margin-bottom: 2px;">
                <label class="form-label" for="edit-trad-text" style="font-size: 12px; margin-bottom: 2px;">${isCa ? `Text en ${secLangLabel}` : `Texto en ${secLangLabel}`}</label>
                <textarea class="textarea" id="edit-trad-text" style="min-height: 80px; font-size: 13px; background: white;" placeholder="${isCa ? `Text de la mesura en ${secLangLabel}…` : `Texto de la medida en ${secLangLabel}…`}">${escapeHtml(decision.traduccion_texto || '')}</textarea>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Barra de acciones inferiores -->
      <div class="adapt-status-banner">
        <div>
          ${!isPropia ? `
            <button class="btn" id="btn-restore-original">${window.i18n.t('adapt.btn_restore')}</button>
          ` : `
            <span class="muted" style="font-size: 13px;">${isCa ? 'Aquesta és una mesura pròpia creada per l\'agrupació.' : 'Esta es una medida propia creada por la agrupación.'}</span>
          `}
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="muted" id="adapt-save-notice" style="font-size: 13px;">${window.i18n.t('adapt.auto_saved')}</span>
          <button class="btn primary large" id="btn-done-adapt" style="font-weight: 700; padding: 10px 20px;">
            💾 ${window.i18n.t('adapt.btn_save')}
          </button>
        </div>
      </div>

      <div class="notice" style="margin-top: 14px;">
        <b>${isCa ? 'Regla de treball:' : 'Regla de trabajo:'}</b> ${window.i18n.t('adapt.rule_notice')}
      </div>
    `;

    this.bindEvents(container, project, measure, currentArea, prevId, nextId, secLangLabel);
  },

  getTradChip(estado, isCa) {
    const map = {
      original: { text: isCa ? 'Original' : 'Original', bg: '#e0f2fe', color: '#0369a1' },
      revisada: { text: isCa ? 'Revisada' : 'Revisada', bg: '#dcfce7', color: '#15803d' },
      propuesta: { text: isCa ? 'Traducció proposada' : 'Traducción propuesta', bg: '#fef3c7', color: '#b45309' },
      traduccion_propuesta: { text: isCa ? 'Traducció proposada' : 'Traducción propuesta', bg: '#fef3c7', color: '#b45309' },
      sin_traduccion: { text: isCa ? 'Sense traducció' : 'Sin traducción', bg: '#f3f4f6', color: '#6b7280' },
      desactualizada: { text: isCa ? 'Desactualitzada' : 'Desactualizada', bg: '#fee2e2', color: '#b91c1c' }
    };
    const item = map[estado] || map.sin_traduccion;
    return `<span class="chip" id="adapt-trad-chip" style="background:${item.bg}; color:${item.color}; font-size:11px; font-weight:700; padding:2px 7px; border-radius:4px;">${item.text}</span>`;
  },

  updateTradChip(state) {
    const chip = document.querySelector('#adapt-trad-chip');
    if (!chip) return;
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const map = {
      original: { text: isCa ? 'Original' : 'Original', bg: '#e0f2fe', color: '#0369a1' },
      revisada: { text: isCa ? 'Revisada' : 'Revisada', bg: '#dcfce7', color: '#15803d' },
      propuesta: { text: isCa ? 'Traducció proposada' : 'Traducción propuesta', bg: '#fef3c7', color: '#b45309' },
      traduccion_propuesta: { text: isCa ? 'Traducció proposada' : 'Traducción propuesta', bg: '#fef3c7', color: '#b45309' },
      sin_traduccion: { text: isCa ? 'Sense traducció' : 'Sin traducción', bg: '#f3f4f6', color: '#6b7280' },
      desactualizada: { text: isCa ? 'Desactualitzada' : 'Desactualizada', bg: '#fee2e2', color: '#b91c1c' }
    };
    const item = map[state] || map.sin_traduccion;
    chip.style.background = item.bg;
    chip.style.color = item.color;
    chip.textContent = item.text;
  },

  bindEvents(container, project, measure, currentArea, prevId, nextId, secLangLabel) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const pLang = project.idioma_principal || 'es';
    const secLang = pLang === 'ca' ? 'es' : 'ca';

    const btnHelpScreen = container.querySelector('#btn-help-this-screen');
    if (btnHelpScreen) {
      btnHelpScreen.addEventListener('click', () => {
        if (window.Tutorial) window.Tutorial.startSectionTour('adapt_measure');
      });
    }

    const editTitle = container.querySelector('#edit-title');
    const editText = container.querySelector('#edit-text');
    const editExp = container.querySelector('#edit-explanation');
    const editNota = container.querySelector('#edit-nota-interna');
    const editTradTitle = container.querySelector('#edit-trad-title');
    const editTradText = container.querySelector('#edit-trad-text');
    const selectTradEstado = container.querySelector('#select-trad-estado');

    // AI Toolbar & Title Suggestion
    const btnSuggestTitle = container.querySelector('.btn-adapt-suggest-title');
    if (btnSuggestTitle) {
      btnSuggestTitle.addEventListener('click', () => {
        AiModalHelper.showTitleModal(measure, project, (chosenTitle) => {
          editTitle.value = chosenTitle;
          handleContentChange();
        });
      });
    }

    container.querySelectorAll('.btn-adapt-ai-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const currentText = editText.value || measure.texto || '';
        const currentTitle = editTitle.value || measure.titulo || '';

        let taskTitle = '';
        let taskMethod = '';

        if (action === 'adapt') {
          taskTitle = isCa ? `Adaptar proposta per a ${project.municipio}` : `Adaptar propuesta para ${project.municipio}`;
          taskMethod = 'aiAdaptMeasure';
        } else if (action === 'develop') {
          taskTitle = isCa ? 'Desenvolupar mesura (màx 50 paraules)' : 'Desarrollar medida (máx 50 palabras)';
          taskMethod = 'aiDevelopMeasure';
        } else if (action === 'improve') {
          taskTitle = isCa ? 'Millorar redacció i estil' : 'Mejorar redacción y estilo';
          taskMethod = 'aiImproveWriting';
        } else if (action === 'correct') {
          taskTitle = isCa ? 'Corregir ortografia i to' : 'Corregir ortografía y tono';
          taskMethod = 'aiCorrectText';
        } else if (action === 'summarize') {
          taskTitle = isCa ? 'Resumir mesura' : 'Resumir medida';
          taskMethod = 'aiSummarizeText';
        } else if (action === 'translate') {
          taskTitle = isCa ? `Traduir mesura al ${secLangLabel}` : `Traducir medida al ${secLangLabel}`;
          taskMethod = 'aiTranslateText';
        }

        AiModalHelper.showProposalModal({
          taskTitle,
          taskMethod,
          taskParams: {
            texto: currentText,
            titulo: currentTitle,
            municipio: project.municipio || '',
            habitantes: project.habitantes || null,
            idioma: pLang,
            idioma_destino: secLang,
            longitud: 'media'
          },
          originalText: action === 'translate' ? (editTradText ? editTradText.value : '') : currentText,
          onAccept: (result) => {
            if (action === 'translate') {
              // NO sobrescribe el idioma original: guarda en los campos de traducción secundaria
              if (editTradText) editTradText.value = result.texto || '';
              if (editTradTitle && result.titulo) editTradTitle.value = result.titulo;
              if (selectTradEstado) selectTradEstado.value = 'propuesta';
              this.updateTradChip('propuesta');
              this.triggerSave(project, measure, true);
            } else {
              editText.value = result.texto;
              handleContentChange();
            }
          }
        });
      });
    });

    const stateSelect = container.querySelector('#select-measure-state');

    // Auto-detect changes to trigger 'adaptada'
    const handleContentChange = () => {
      if (!this.isPropia) {
        const origTitle = measure.titulo || '';
        const origText = measure.texto || '';
        const currentTitle = editTitle.value;
        const currentText = editText.value;

        if (currentTitle !== origTitle || currentText !== origText) {
          if (stateSelect.value !== 'adaptada') {
            stateSelect.value = 'adaptada';
            this.updateChip('adaptada');
          }
        }
      }
      this.triggerSave(project, measure);
    };

    [editTitle, editText, editExp, editNota, editTradTitle, editTradText].forEach(el => {
      if (el) el.addEventListener('input', handleContentChange);
    });

    if (stateSelect) {
      stateSelect.addEventListener('change', () => {
        this.updateChip(stateSelect.value);
        this.triggerSave(project, measure, true);
      });
    }

    if (selectTradEstado) {
      selectTradEstado.addEventListener('change', () => {
        this.updateTradChip(selectTradEstado.value);
        this.triggerSave(project, measure, true);
      });
    }

    // Navigation buttons
    const btnPrev = container.querySelector('#btn-prev-measure');
    if (btnPrev && prevId) {
      btnPrev.addEventListener('click', () => {
        App.openMeasureDetail(prevId, false);
      });
    }

    const btnNext = container.querySelector('#btn-next-measure');
    if (btnNext && nextId) {
      btnNext.addEventListener('click', () => {
        App.openMeasureDetail(nextId, false);
      });
    }

    const btnBack = container.querySelector('#btn-back-to-list');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        App.navigateTo('elegir-medidas');
      });
    }

    // Guardar adaptación button
    const btnDone = container.querySelector('#btn-done-adapt');
    if (btnDone) {
      btnDone.addEventListener('click', async () => {
        await this.saveNow(project, measure, true);
        App.navigateTo('elegir-medidas');
      });
    }

    // Restore original framework text
    const btnRestore = container.querySelector('#btn-restore-original');
    if (btnRestore) {
      btnRestore.addEventListener('click', async () => {
        App.notifySaving();
        await window.api.updateMeasureDecision(project.id, measure.id, {
          restaurar_original: true
        });
        await App.refreshCurrentProject();
        App.notifySaved();
        this.render(container, App.currentProject, measure.id, false);
      });
    }
  },

  updateChip(state) {
    const chip = document.querySelector('#adapt-current-chip');
    if (!chip) return;

    let chipClass = 'unreviewed';
    let chipText = window.i18n.t('choose.filter_state_unreviewed');
    if (state === 'incluida') {
      chipClass = 'included';
      chipText = window.i18n.t('choose.filter_state_included');
    } else if (state === 'adaptada') {
      chipClass = 'adapted';
      chipText = this.isPropia ? window.i18n.t('choose.chip_own') : window.i18n.t('choose.filter_state_adapted');
    } else if (state === 'en_duda') {
      chipClass = 'doubt';
      chipText = window.i18n.t('choose.filter_state_doubt');
    }

    chip.className = `chip ${chipClass}`;
    chip.textContent = chipText;
  },

  triggerSave(project, measure, immediate = false) {
    clearTimeout(this.debounceTimer);
    if (immediate) {
      this.saveNow(project, measure);
    } else {
      this.debounceTimer = setTimeout(() => {
        this.saveNow(project, measure);
      }, 500);
    }
  },

  async saveNow(project, measure, markAsAdapted = false) {
    const editTitle = document.querySelector('#edit-title');
    const editText = document.querySelector('#edit-text');
    const editExp = document.querySelector('#edit-explanation');
    const editNota = document.querySelector('#edit-nota-interna');
    const editTradTitle = document.querySelector('#edit-trad-title');
    const editTradText = document.querySelector('#edit-trad-text');
    const selectTradEstado = document.querySelector('#select-trad-estado');
    const stateSelect = document.querySelector('#select-measure-state');
    if (!editText) return;

    App.notifySaving();

    let targetEstado = stateSelect ? stateSelect.value : 'adaptada';
    if (markAsAdapted && (targetEstado === 'sin_revisar' || targetEstado === 'incluida')) {
      targetEstado = 'adaptada';
    }

    const payload = {
      titulo: editTitle ? editTitle.value : null,
      texto: editText.value,
      explicacion: editExp ? editExp.value : null,
      nota_interna: editNota ? editNota.value : null,
      traduccion_titulo: editTradTitle ? editTradTitle.value : null,
      traduccion_texto: editTradText ? editTradText.value : null,
      estado_traduccion: selectTradEstado ? selectTradEstado.value : 'sin_traduccion'
    };

    if (this.isPropia) {
      await window.api.updateOwnMeasure(measure.id, payload);
    } else {
      await window.api.updateMeasureDecision(project.id, measure.id, {
        estado: targetEstado,
        version_municipal_titulo: payload.titulo,
        version_municipal_texto: payload.texto,
        version_municipal_explicacion: payload.explicacion,
        nota_interna: payload.nota_interna,
        traduccion_titulo: payload.traduccion_titulo,
        traduccion_texto: payload.traduccion_texto,
        estado_traduccion: payload.estado_traduccion
      });
    }

    await App.refreshCurrentProject();
    App.notifySaved();
  }
};

window.AdaptMeasureView = AdaptMeasureView;
