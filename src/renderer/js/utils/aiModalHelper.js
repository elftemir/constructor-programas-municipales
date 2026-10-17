/**
 * aiModalHelper.js - Modales interactivos para el Asistente IA (Fase 2)
 *
 * Principio: LA IA PROPONE. EL USUARIO DECIDE.
 * Ninguna propuesta se aplica sin confirmación expresa del usuario.
 * Cada operación ofrece: Aceptar, Editar antes de aceptar, Regenerar y Descartar.
 */

const AiModalHelper = {
  renderMarkedText(text,warnings=[],isCa=false){
    const encode=value=>escapeHtml(String(value||'')).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const ranges=warnings.filter(w=>Number.isInteger(w.start)&&Number.isInteger(w.end)&&w.start>=0&&w.end>w.start&&w.end<=text.length&&(text.slice(w.start,w.end)===(w.displayFragment||w.fragment))).sort((a,b)=>a.start-b.start||b.end-a.end);
    let at=0,html='';for(const warning of ranges){if(warning.start<at)continue;html+=encode(text.slice(at,warning.start))+'<mark class="ai-warning-mark" style="background:#fef08a;color:inherit" title="'+encode(isCa?warning.message_ca:warning.message_es)+'">'+encode(text.slice(warning.start,warning.end))+'</mark>';at=warning.end;}return html+encode(text.slice(at));
  },

  showTitleModal(measure, project, onSelected) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const modalContainer = document.querySelector('#modal-container') || document.body;

    const modalHtml = `
      <div class="modal-overlay" id="ai-title-modal-overlay">
        <div class="modal-dialog" style="max-width: 640px;">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">💡</span>
              <div>
                <h2 style="font-size: 17px; font-weight: 800; margin: 0; color: #1e1b4b;">
                  ${isCa ? 'Suggeriments de títol amb IA' : 'Sugerencias de título con IA'}
                </h2>
                <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-size: 11px; font-weight: 700;">
                  ${isCa ? '100% Local · El catàleg oficial no es modifica' : '100% Local · El catálogo oficial no se modifica'}
                </span>
              </div>
            </div>
            <button class="btn small link" id="btn-close-title-modal" style="font-size: 18px; line-height: 1;">✕</button>
          </div>

          <div class="modal-body">
            <p style="font-size: 13.5px; line-height: 1.5; color: var(--text-secondary); margin: 0 0 16px 0;">
              ${isCa
                ? 'La IA analitza el contingut de la mesura i proposa 3 alternatives concises (4 a 12 paraules). Trieu la que millor representi la proposta per desar-la com a títol municipal:'
                : 'La IA analiza el contenido de la medida y propone 3 alternativas concisas (4 a 12 palabras). Elige la que mejor represente la propuesta para guardarla como título municipal:'}
            </p>

            <div id="ai-title-loading" style="padding: 30px; text-align: center;">
              <div style="font-size: 28px; margin-bottom: 10px;">⏳</div>
              <div style="font-size: 14px; font-weight: 600; color: #4c1d95;">
                ${isCa ? 'Generant propostes de títol amb IA local…' : 'Generando propuestas de título con IA local…'}
              </div>
            </div>

            <div id="ai-title-options-container" style="display: none; display: flex; flex-direction: column; gap: 12px;"></div>

            <div id="ai-title-custom-box" style="display: none; margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
              <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">
                ${isCa ? 'Pots editar el títol seleccionat abans d\'assignar-lo:' : 'Puedes editar el título seleccionado antes de asignarlo:'}
              </label>
              <input type="text" id="ai-selected-title-input" class="input" style="width: 100%; font-weight: 600;" value="" />
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn" id="btn-cancel-title-modal">
              ${isCa ? 'Descartar' : 'Descartar'}
            </button>
            <button class="btn primary" id="btn-apply-title-modal" disabled style="background: #7c3aed;">
              ✓ ${isCa ? 'Assignar títol municipal' : 'Asignar título municipal'}
            </button>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHtml;
    const overlay = wrapper.firstElementChild;
    modalContainer.appendChild(overlay);
    modalContainer.style.display = 'block';

    const loadingEl = overlay.querySelector('#ai-title-loading');
    const optionsEl = overlay.querySelector('#ai-title-options-container');
    const customBox = overlay.querySelector('#ai-title-custom-box');
    const inputTitle = overlay.querySelector('#ai-selected-title-input');
    const btnApply = overlay.querySelector('#btn-apply-title-modal');
    const btnClose = overlay.querySelector('#btn-close-title-modal');
    const btnCancel = overlay.querySelector('#btn-cancel-title-modal');

    const closeModal = () => {
      overlay.remove();
      modalContainer.style.display = 'none';
    };
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    let selectedTitle = '';

    const executeGeneration = async () => {
      loadingEl.style.display = 'block';
      optionsEl.style.display = 'none';
      btnApply.disabled = true;

      try {
        const res = await (window.GenerationApi || window.api).aiSuggestTitles({
          projectId: project.id,
          texto: measure.texto || measure.explicacion || '',
          tituloActual: measure.titulo || '',
          municipio: project.municipio || '',
          idioma: project.idioma_principal || 'es'
        });

        const titulos = (Array.isArray(res?.data?.titulos) && res.data.titulos.length > 0)
          ? res.data.titulos
          : (Array.isArray(res?.titulos) && res.titulos.length > 0)
            ? res.titulos
            : [];

        if (titulos.length === 0) {
          throw new Error(isCa ? 'No s\'han pogut generar propostes de títol vàlides.' : 'No se han podido generar propuestas de título válidas.');
        }

        loadingEl.style.display = 'none';
        optionsEl.style.display = 'flex';

        optionsEl.innerHTML = titulos.map((t, idx) => {
          const words = t.trim().split(/\s+/).filter(Boolean).length;
          return `
            <div class="title-option-card" data-title="${escapeHtml(t)}" style="padding: 14px 16px; border: 1.5px solid #cbd5e1; border-radius: 8px; cursor: pointer; transition: all 0.15s; background: white;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 700; color: #6b21a8; text-transform: uppercase;">
                  ${isCa ? 'Opció' : 'Opción'} ${idx + 1}
                </span>
                <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 11px;">
                  ${words} ${isCa ? 'paraules' : 'palabras'}
                </span>
              </div>
              <div style="font-size: 14.5px; font-weight: 700; color: #1e293b; line-height: 1.35;">
                ${escapeHtml(t)}
              </div>
            </div>
          `;
        }).join('');
        window.GenerationUi?.markResult(res,optionsEl);

        // Manejar selección de opción
        optionsEl.querySelectorAll('.title-option-card').forEach(card => {
          card.addEventListener('click', () => {
            optionsEl.querySelectorAll('.title-option-card').forEach(c => {
              c.style.borderColor = '#cbd5e1';
              c.style.background = 'white';
            });
            card.style.borderColor = '#7c3aed';
            card.style.background = '#faf5ff';

            selectedTitle = card.dataset.title;
            if (inputTitle) inputTitle.value = selectedTitle;
            if (customBox) customBox.style.display = 'block';
            btnApply.disabled = false;
          });
        });

        // Seleccionar la primera por defecto
        const firstCard = optionsEl.querySelector('.title-option-card');
        if (firstCard) firstCard.click();

      } catch (err) {
        loadingEl.innerHTML = `
          <div style="color: #dc2626; font-weight: 700; margin-bottom: 8px;">
            ⚠ ${escapeHtml(err.message || (isCa ? 'No s\'han pogut generar propostes de títol.' : 'No se han podido generar propuestas de título.'))}
          </div>
          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 14px;">
            <button class="btn small" id="btn-cancel-titles-err">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn small primary" id="btn-retry-titles" style="background: #7c3aed;">${isCa ? 'Reintentar' : 'Reintentar'}</button>
          </div>
        `;
        const btnRetry = loadingEl.querySelector('#btn-retry-titles');
        if (btnRetry) btnRetry.addEventListener('click', executeGeneration);
        const btnCancelErr = loadingEl.querySelector('#btn-cancel-titles-err');
        if (btnCancelErr) btnCancelErr.addEventListener('click', closeModal);
      }
    };

    btnApply.addEventListener('click', () => {
      const finalTitle = inputTitle ? inputTitle.value.trim() : selectedTitle;
      if (finalTitle) {
        closeModal();
        if (onSelected) onSelected(finalTitle);
      }
    });

    executeGeneration();
  },

  showProposalModal({
    taskTitle,
    taskMethod,
    taskParams,
    originalText = '',
    onAccept,
    onRegenerate
  }) {
    if(window.TextFormat){const embedded=window.TextFormat.internalObject(originalText);if(embedded){const section=embedded.entradilla!==undefined?'presentacion':'cierre';originalText=window.TextFormat.display(section,window.TextFormat.format(section,embedded));}}
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const modalContainer = document.querySelector('#modal-container') || document.body;

    const modalHtml = `
      <div class="modal-overlay" id="ai-proposal-modal-overlay">
        <div class="modal-dialog" style="max-width: 860px;">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">✨</span>
              <div>
                <h2 style="font-size: 17px; font-weight: 800; margin: 0; color: #1e1b4b;">
                  ${escapeHtml(taskTitle)}
                </h2>
                <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-size: 11px; font-weight: 700;">
                  ${isCa ? 'La IA proposa. L\'usuari decideix.' : 'La IA propone. El usuario decide.'}
                </span>
              </div>
            </div>
            <button class="btn small link" id="btn-close-proposal-modal" style="font-size: 18px; line-height: 1;">✕</button>
          </div>

          <div class="modal-body">
            <div id="ai-proposal-loading" style="padding: 36px 20px; text-align: center;">
              <div style="font-size: 32px; margin-bottom: 12px;">⚙️</div>
              <div style="font-size: 16px; font-weight: 700; color: #4c1d95; margin-bottom: 4px;">
                ${isCa ? 'Generant amb IA local…' : 'Generando con IA local…'}
              </div>
              <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                <b>${isCa ? 'Model:' : 'Modelo:'}</b> Qwen 2.5 3B
              </div>
              <div style="display: inline-block; background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 20px; padding: 5px 16px; font-size: 13px; font-weight: 700; color: #6b21a8; margin-bottom: 12px;">
                ⏱️ ${isCa ? 'Temps transcorregut:' : 'Tiempo transcurrido:'} <span id="ai-elapsed-seconds">0</span> s
              </div>
              <div style="font-size: 12.5px; color: #64748b; margin-bottom: 18px;">
                ${isCa ? 'Aquesta operació pot trigar uns segons.' : 'Esta operación puede tardar unos segundos.'}
              </div>
              <div>
                <button class="btn small" id="btn-cancel-loading-proposal">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
              </div>
            </div>

            <div id="ai-proposal-content" style="display: none;">
              <!-- Comparación Visual: Original vs Propuesta -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px;">
                <!-- Texto Actual/Original -->
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column;">
                  <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: space-between;">
                    <span>${isCa ? 'Text original / actual' : 'Texto original / actual'}</span>
                    <span id="orig-words-badge" class="badge" style="background: #e2e8f0; color: #475569; font-size: 10.5px;"></span>
                  </div>
                  <div id="ai-orig-text-display" style="font-size: 13.5px; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap; flex: 1;">
                    ${escapeHtml(originalText || (isCa ? '(Sense text previ)' : '(Sin texto previo)'))}
                  </div>
                </div>

                <!-- Propuesta de la IA -->
                <div style="background: #faf5ff; border: 1.5px solid #d8b4fe; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column;">
                  <div style="font-size: 12px; font-weight: 700; color: #6b21a8; text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: space-between;">
                    <span>${isCa ? 'Proposta de la IA' : 'Propuesta de la IA'}</span>
                    <span id="prop-words-badge" class="badge" style="background: #e9d5ff; color: #6b21a8; font-size: 10.5px;"></span>
                  </div>
                  <div id="ai-prop-text-display" style="font-size: 14px; line-height: 1.6; color: #1e1b4b; white-space: pre-wrap; flex: 1;"></div>
                  <textarea id="ai-prop-text-editor" class="textarea" style="display: none; width: 100%; height: 160px; font-size: 14px; line-height: 1.6;"></textarea>
                </div>
              </div>

              <!-- Avisos de verificación anti-alucinaciones -->
              <div id="ai-avisos-box" style="display: none; background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 12.5px; color: #92400e;">
                <div style="font-weight: 700; margin-bottom: 4px;">⚠ ${isCa ? 'Avisos de verificació de la IA:' : 'Avisos de verificación de la IA:'}</div>
                <div id="ai-avisos-list"></div>
              </div>
            </div>
          </div>

          <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 8px;">
              <button class="btn" id="btn-discard-proposal">
                ✕ ${isCa ? 'Descartar' : 'Descartar'}
              </button>
              <button class="btn" id="btn-regenerate-proposal" style="color: #6b21a8;">
                ↻ ${isCa ? 'Regenerar' : 'Regenerar'}
              </button>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn" id="btn-edit-proposal">
                ✏ ${isCa ? 'Editar abans d\'acceptar' : 'Editar antes de aceptar'}
              </button>
              <button class="btn primary" id="btn-accept-proposal" style="background: #7c3aed; font-weight: 700;">
                ✓ ${isCa ? 'Acceptar proposta' : 'Aceptar propuesta'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHtml;
    const overlay = wrapper.firstElementChild;
    modalContainer.appendChild(overlay);
    modalContainer.style.display = 'block';

    const loadingEl = overlay.querySelector('#ai-proposal-loading');
    const contentEl = overlay.querySelector('#ai-proposal-content');
    const displayEl = overlay.querySelector('#ai-prop-text-display');
    const editorEl = overlay.querySelector('#ai-prop-text-editor');
    const origBadge = overlay.querySelector('#orig-words-badge');
    const propBadge = overlay.querySelector('#prop-words-badge');
    const avisosBox = overlay.querySelector('#ai-avisos-box');
    const avisosList = overlay.querySelector('#ai-avisos-list');

    const btnClose = overlay.querySelector('#btn-close-proposal-modal');
    const btnDiscard = overlay.querySelector('#btn-discard-proposal');
    const btnRegen = overlay.querySelector('#btn-regenerate-proposal');
    const btnEdit = overlay.querySelector('#btn-edit-proposal');
    const btnAccept = overlay.querySelector('#btn-accept-proposal');

    let currentResult = null;
    let isEditing = false;
    let timerInterval = null;
    let elapsedSeconds = 0;
    let isCancelled = false;
    let generationRequestId=null;

    const startTimer = () => {
      elapsedSeconds = 0;
      const el = overlay.querySelector('#ai-elapsed-seconds');
      if (el) el.textContent = '0';
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        elapsedSeconds++;
        const timerEl = overlay.querySelector('#ai-elapsed-seconds');
        if (timerEl) timerEl.textContent = String(elapsedSeconds);
      }, 1000);
    };

    const stopTimer = () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };

    const closeModal = () => {
      isCancelled = true;
      if(generationRequestId)window.api.aiCancelGeneration?.({generationRequestId}).catch(()=>{});
      stopTimer();
      overlay.remove();
      modalContainer.style.display = 'none';
    };
    btnClose.addEventListener('click', closeModal);
    btnDiscard.addEventListener('click', closeModal);

    if (originalText && origBadge) {
      origBadge.textContent = `${originalText.trim().split(/\s+/).length} ${isCa ? 'paraules' : 'palabras'}`;
    }

    const runTask = async () => {
      isCancelled = false;
      isEditing=false;displayEl.style.display='block';editorEl.style.display='none';
      btnRegen.disabled=true;
      generationRequestId=window.crypto?.randomUUID?.()||('generation-'+Date.now()+'-'+Math.random().toString(16).slice(2));
      startTimer();
      loadingEl.style.display = 'block';
      contentEl.style.display = 'none';
      btnAccept.disabled = true;
      btnEdit.disabled = true;

      const btnCancelLoading = overlay.querySelector('#btn-cancel-loading-proposal');
      if (btnCancelLoading) {
        btnCancelLoading.onclick = closeModal;
      }

      try {
        if(!taskMethod.startsWith('aiTranslate')&&taskParams.generationTask&&window.WritingContract){
          const minimum=window.WritingContract.minimumState(taskParams.generationTask,taskParams.selectedMeasures||[],taskParams.idioma||'es',taskParams);
          if(!minimum.allowed){btnRegen.disabled=true;btnRegen.title=minimum.message;throw new Error(minimum.message);}
        }
        currentResult = await (window.GenerationApi || window.api)[taskMethod]({ projectId: typeof App !== 'undefined' ? App.currentProject?.id : undefined, ...taskParams, generationRequestId });
        stopTimer();
        if (isCancelled) return;

        if (currentResult && currentResult.ok === false) {
          if (currentResult?.error?.code === 'BUILTIN_ENGINE_ERROR' || currentResult?.canFallbackToSelectedModel) {
            loadingEl.innerHTML = `
              <div style="color: #dc2626; font-weight: 700; margin-bottom: 8px; font-size: 15px; text-align: center;">
                ⚠ ${isCa ? 'No s\'ha pogut realitzar la traducció amb el motor lingüístic integrat.' : 'No se ha podido realizar la traducción con el motor lingüístico integrado.'}
              </div>
              <div style="font-size: 13px; color: #64748b; margin-bottom: 16px; text-align: center; line-height: 1.5;">
                ${isCa ? 'El text original no s\'ha modificat. Pots reintentar la traducció o utilitzar excepcionalment el model d\'IA seleccionat a la configuració.' : 'El texto original no se ha modificado. Puedes reintentar la traducción o usar excepcionalmente el modelo de IA seleccionado en la configuración.'}
              </div>
              <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                <button class="btn small" id="btn-cancel-proposal-err">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
                <button class="btn small" id="btn-retry-proposal" style="border: 1.5px solid #7c3aed; color: #7c3aed; background: white; font-weight: 700;">🔄 ${isCa ? 'Reintentar' : 'Reintentar'}</button>
                <button class="btn small primary" id="btn-use-selected-model" style="background: #7c3aed; font-weight: 700;">🤖 ${isCa ? 'Utilitzar excepcionalment el model IA seleccionat' : 'Usar excepcionalmente el modelo IA seleccionado'}</button>
              </div>
            `;
            const cancelBtn = loadingEl.querySelector('#btn-cancel-proposal-err');
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
            const retryBtn = loadingEl.querySelector('#btn-retry-proposal');
            if (retryBtn) retryBtn.addEventListener('click', () => {
              taskParams.useSelectedModel = false;
              runTask();
            });
            const fallbackBtn = loadingEl.querySelector('#btn-use-selected-model');
            if (fallbackBtn) fallbackBtn.addEventListener('click', () => {
              taskParams.useSelectedModel = true;
              runTask();
            });
            return;
          }
          const errMsg = (currentResult.error && currentResult.error.message) || currentResult.message || 'Error en la petición de IA';
          const codes=currentResult.meta?.qualityErrors||[];
          const key=codes.includes('LANGUAGE_MIX')?'ai.rejectionLanguage':codes.some(c=>['TRUNCATED','FRAGMENT_LENGTH','TOO_SHORT','TOO_LONG'].includes(c))?'ai.rejectionLength':codes.some(c=>['OTHER_MUNICIPALITY','UNSUPPORTED_NUMBER','UNSUPPORTED_PROBLEM','ELECTORAL_CLAIM','UNSUPPORTED_MEASURE_CHANGE','INVENTED_SLOGAN'].includes(c))?'ai.rejectionContent':'ai.rejectionFormat';
          throw new Error(codes.length?window.i18n.t('ai.rejectedProposal')+' '+window.i18n.t(key)+'.':errMsg);
        }

        const generatedText = currentResult?.texto || currentResult?.data?.texto || currentResult?.data?.introduccion || currentResult?.introduccion || currentResult?.frase_destacada || '';
        if (!generatedText || !generatedText.trim()) {
          throw new Error(isCa ? 'No s\'ha rebut una proposta vàlida.' : 'No se ha recibido una propuesta válida.');
        }

        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        btnAccept.disabled = false;
        btnEdit.disabled = false;

        displayEl.innerHTML = this.renderMarkedText(generatedText,currentResult.qualityWarnings||[],isCa);
        window.GenerationUi?.markResult(currentResult,displayEl);
        editorEl.value = generatedText;

        if (propBadge) {
          const w = generatedText.trim().split(/\s+/).filter(Boolean).length;
          propBadge.textContent = `${w} ${isCa ? 'paraules' : 'palabras'}`;
        }

        const visibleWarnings=currentResult.qualityWarnings?.length?window.WritingWarnings.messages(currentResult.qualityWarnings,isCa?'ca':'es'):(currentResult.avisos||[]);
        if (visibleWarnings.length > 0) {
          avisosBox.style.display = 'block';
          avisosList.innerHTML = visibleWarnings.map(a => `<div>• ${escapeHtml(a)}</div>`).join('');
        } else {
          avisosBox.style.display = 'block';
          avisosList.textContent = window.WritingWarnings.clearMessage(isCa?'ca':'es');
        }
      } catch (err) {
        stopTimer();
        if (isCancelled) return;
        const isBuiltinErr = err.code === 'BUILTIN_ENGINE_ERROR' || (err.message && err.message.includes('motor lingüístico integrado'));
        if (isBuiltinErr) {
          loadingEl.innerHTML = `
            <div style="color: #dc2626; font-weight: 700; margin-bottom: 8px; font-size: 15px; text-align: center;">
              ⚠ ${isCa ? 'No s\'ha pogut realitzar la traducció amb el motor lingüístic integrat.' : 'No se ha podido realizar la traducción con el motor lingüístico integrado.'}
            </div>
            <div style="font-size: 13px; color: #64748b; margin-bottom: 16px; text-align: center; line-height: 1.5;">
              ${isCa ? 'El text original no s\'ha modificat. Pots reintentar la traducció o utilitzar excepcionalment el model d\'IA seleccionat a la configuració.' : 'El texto original no se ha modificado. Puedes reintentar la traducción o usar excepcionalmente el modelo de IA seleccionado en la configuración.'}
            </div>
            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <button class="btn small" id="btn-cancel-proposal-err">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
              <button class="btn small" id="btn-retry-proposal" style="border: 1.5px solid #7c3aed; color: #7c3aed; background: white; font-weight: 700;">🔄 ${isCa ? 'Reintentar' : 'Reintentar'}</button>
              <button class="btn small primary" id="btn-use-selected-model" style="background: #7c3aed; font-weight: 700;">🤖 ${isCa ? 'Utilitzar excepcionalment el model IA seleccionat' : 'Usar excepcionalmente el modelo IA seleccionado'}</button>
            </div>
          `;
          const cancelBtn = loadingEl.querySelector('#btn-cancel-proposal-err');
          if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
          const retryBtn = loadingEl.querySelector('#btn-retry-proposal');
          if (retryBtn) retryBtn.addEventListener('click', () => {
            taskParams.useSelectedModel = false;
            runTask();
          });
          const fallbackBtn = loadingEl.querySelector('#btn-use-selected-model');
          if (fallbackBtn) fallbackBtn.addEventListener('click', () => {
            taskParams.useSelectedModel = true;
            runTask();
          });
          return;
        }

        loadingEl.innerHTML = `
          <div style="color: #dc2626; font-weight: 700; margin-bottom: 8px;">
            ⚠ ${escapeHtml(err.message || (isCa ? 'No s\'ha rebut una proposta vàlida.' : 'No se ha recibido una propuesta válida.'))}
          </div>
          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 14px;">
            <button class="btn small" id="btn-cancel-proposal-err">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn small primary" id="btn-retry-proposal" style="background: #7c3aed;">${isCa ? 'Reintentar' : 'Reintentar'}</button>
          </div>
        `;
        const retryBtn = loadingEl.querySelector('#btn-retry-proposal');
        if (retryBtn) retryBtn.addEventListener('click', runTask);
        const cancelErrBtn = loadingEl.querySelector('#btn-cancel-proposal-err');
        if (cancelErrBtn) cancelErrBtn.addEventListener('click', closeModal);
      }finally{
        generationRequestId=null;
        const minimum=!taskMethod.startsWith('aiTranslate')&&taskParams.generationTask&&window.WritingContract?.minimumState(taskParams.generationTask,taskParams.selectedMeasures||[],taskParams.idioma||'es',taskParams);
        btnRegen.disabled=minimum?!minimum.allowed:false;
      }
    };

    btnRegen.addEventListener('click', () => {
      if (onRegenerate) onRegenerate();
      runTask();
    });

    btnEdit.addEventListener('click', () => {
      if (!isEditing) {
        isEditing = true;
        displayEl.style.display = 'none';
        editorEl.style.display = 'block';
        editorEl.focus();
        btnEdit.textContent = isCa ? '👁 Vista prèvia' : '👁 Vista previa';
      } else {
        isEditing = false;
        displayEl.textContent = editorEl.value;
        displayEl.style.display = 'block';
        editorEl.style.display = 'none';
        btnEdit.textContent = isCa ? '✏ Editar abans d\'acceptar' : '✏ Editar antes de aceptar';
        if (propBadge) {
          const w = editorEl.value.trim().split(/\s+/).filter(Boolean).length;
          propBadge.textContent = `${w} ${isCa ? 'paraules' : 'palabras'}`;
        }
      }
    });

    btnAccept.addEventListener('click', () => {
      const finalText = isEditing ? editorEl.value : (currentResult?.texto || currentResult?.introduccion || editorEl.value);
      const writingTask=taskParams.generationTask||({aiDraftPresentation:'redactar_presentacion',aiDraftAreaIntro:'redactar_introduccion_area',aiDraftClosing:'redactar_cierre'})[taskMethod];
      let accepted;
      try{accepted=window.TextFormat.normalizeProposal(currentResult,writingTask,isEditing?finalText:null);}catch(error){window.alert(isCa?'La proposta té un format intern incorrecte. Revisa-la abans d’acceptar-la.':'La propuesta tiene un formato interno incorrecto. Revísala antes de aceptarla.');return;}
      closeModal();
      if (onAccept) {
        onAccept(accepted);
      }
    });

    runTask();
  }
};

window.AiModalHelper = AiModalHelper;
