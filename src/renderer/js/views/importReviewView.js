/**
 * importReviewView.js - Asistente de Extracción, Estructuración y Revisión Humana de Programas Fuente (Fase 3.1)
 * Flujo: Archivo -> Extracción -> Estructuración -> Resumen -> Revisión -> Confirmación
 */

const ImportReviewView = {
  currentImportData: null,
  activeTargetSourceId: null,
  activeTargetLang: null,

  async openImportModal() {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const modalContainer = document.querySelector('#modal-container') || document.body;

    modalContainer.innerHTML = `
      <div class="modal-overlay" id="import-init-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog" style="max-width: 540px; width: 100%; background: white; border-radius: 12px; padding: 28px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #f5f3ff; border: 1.5px solid #ddd6fe; display: grid; place-items: center; font-size: 22px;">
              📥
            </div>
            <div>
              <h2 style="font-size: 19px; font-weight: 800; margin: 0; color: #1e1b4b;">
                ${isCa ? 'Importar nou programa font' : 'Importar nuevo programa fuente'}
              </h2>
              <p style="font-size: 13px; color: var(--text-secondary); margin: 2px 0 0;">
                ${isCa ? 'Formats admesos: Microsoft Word (.docx) i PDF' : 'Formatos admitidos: Microsoft Word (.docx) y PDF'}
              </p>
            </div>
          </div>

          <!-- Selección de idioma del documento -->
          <div style="margin-bottom: 20px;">
            <label style="font-size: 13px; font-weight: 700; color: #334155; display: block; margin-bottom: 8px;">
              ${isCa ? 'Idioma principal del document' : 'Idioma principal del documento'}
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <label class="card" style="padding: 12px 14px; border: 1.5px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="radio" name="import-init-lang" value="es" checked />
                <div>
                  <strong style="display: block; font-size: 14px;">Castellano</strong>
                  <span style="font-size: 11.5px; color: var(--text-muted);">${isCa ? 'Versió en castellà' : 'Versión en castellano'}</span>
                </div>
              </label>
              <label class="card" style="padding: 12px 14px; border: 1.5px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="radio" name="import-init-lang" value="ca" />
                <div>
                  <strong style="display: block; font-size: 14px;">Català</strong>
                  <span style="font-size: 11.5px; color: var(--text-muted);">${isCa ? 'Versió en català' : 'Versión en catalán'}</span>
                </div>
              </label>
            </div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; font-size: 12.5px; color: var(--text-secondary); margin-bottom: 22px; line-height: 1.5;">
            🔒 <b>${isCa ? 'Privadesa 100% local:' : 'Privacidad 100% local:'}</b>
            ${isCa
              ? 'El document original mai es modifica ni s\'envia a cap servei extern. L\'extracció i estructuració es realitzen exclusivament al teu ordinador.'
              : 'El documento original nunca se modifica ni se envía a ningún servicio externo. La extracción y estructuración se realizan exclusivamente en tu ordenador.'}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn" id="btn-import-init-cancel">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="btn-import-init-select-file" style="background: #7c3aed; border-color: #6d28d9; font-weight: 700;">
              📂 ${isCa ? 'Seleccionar fitxer...' : 'Seleccionar archivo...'}
            </button>
          </div>
        </div>
      </div>
    `;
    modalContainer.style.display = 'block';

    const close = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    modalContainer.querySelector('#btn-import-init-cancel').addEventListener('click', close);
    modalContainer.querySelector('#btn-import-init-select-file').addEventListener('click', async () => {
      const selectedLang = modalContainer.querySelector('input[name="import-init-lang"]:checked')?.value || 'es';
      close();
      await this.handleFileSelection(selectedLang);
    });
  },

  async handleFileSelection(language) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const filePath = await window.api.importerSelectFile();
    if (!filePath) return;

    this.showLoadingModal(isCa ? 'Analitzant estructura del document…' : 'Analizando estructura del documento…');

    try {
      const analysis = await window.api.importerAnalyzeDocument(filePath, language);
      this.closeModal();

      if (analysis.isScanned) {
        // PDF escaneado detectado: ofrecer OCR
        this.showOcrPromptModal(filePath, language, analysis.pageCount);
      } else {
        // Documento con texto estructurado: mostrar resumen previo
        analysis.filePath = filePath;
        this.currentImportData = analysis;
        this.showPreReviewSummaryModal(analysis);
      }
    } catch (err) {
      this.closeModal();
      alert(`Error al analizar el documento: ${err.message}`);
    }
  },

  showOcrPromptModal(filePath, language, pageCount) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const modalContainer = document.querySelector('#modal-container') || document.body;

    modalContainer.innerHTML = `
      <div class="modal-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog" style="max-width: 520px; width: 100%; background: white; border-radius: 12px; padding: 26px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
          <div style="display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px;">
            <span style="font-size: 32px; line-height: 1;">📄</span>
            <div>
              <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 6px; color: #1e1b4b;">
                ${isCa ? 'Aquest document sembla necessitar reconeixement de text (OCR)' : 'Este documento parece necesitar reconocimiento de texto (OCR)'}
              </h2>
              <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                ${isCa
                  ? `S'ha detectat que el fitxer PDF conté imatges o no disposa de text seleccionable (${pageCount} pàgines). Pots iniciar el procés de reconeixement de caràcters 100% local en castellà i català.`
                  : `Se ha detectado que el archivo PDF contiene imágenes o carece de texto seleccionable (${pageCount} páginas). Puedes iniciar el proceso de reconocimiento de caracteres 100% local en castellano y catalán.`}
              </p>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px;">
            <button class="btn" id="btn-ocr-cancel">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="btn-ocr-start" style="background: #7c3aed; border-color: #6d28d9; font-weight: 700;">
              ✨ ${isCa ? 'Iniciar OCR' : 'Iniciar OCR'}
            </button>
          </div>
        </div>
      </div>
    `;
    modalContainer.style.display = 'block';

    modalContainer.querySelector('#btn-ocr-cancel').addEventListener('click', () => this.closeModal());
    modalContainer.querySelector('#btn-ocr-start').addEventListener('click', async () => {
      await this.runLocalOcr(filePath, language, pageCount);
    });
  },

  async runLocalOcr(filePath, language, pageCount) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const modalContainer = document.querySelector('#modal-container') || document.body;

    modalContainer.innerHTML = `
      <div class="modal-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog" style="max-width: 480px; width: 100%; background: white; border-radius: 12px; padding: 26px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
          <div style="font-size: 32px; margin-bottom: 12px;">⚙️</div>
          <h3 style="font-size: 17px; font-weight: 800; margin: 0 0 8px; color: #1e1b4b;" id="ocr-progress-title">
            ${isCa ? 'Reconeixent text…' : 'Reconociendo texto...'}
          </h3>
          <p style="font-size: 13.5px; color: var(--text-secondary); margin: 0 0 18px;" id="ocr-progress-status">
            ${isCa ? `Pàgina 1 de ${pageCount}` : `Página 1 de ${pageCount}`}
          </p>

          <div style="background: #f1f5f9; border-radius: 8px; height: 10px; width: 100%; overflow: hidden; margin-bottom: 20px;">
            <div id="ocr-progress-bar" style="background: #7c3aed; height: 100%; width: 5%; transition: width 0.3s;"></div>
          </div>

          <button class="btn link" id="btn-cancel-ocr-process" style="color: #64748b; font-size: 13px;">
            ${isCa ? 'Cancel·lar' : 'Cancelar'}
          </button>
        </div>
      </div>
    `;

    const titleEl = modalContainer.querySelector('#ocr-progress-title');
    const statusEl = modalContainer.querySelector('#ocr-progress-status');
    const barEl = modalContainer.querySelector('#ocr-progress-bar');

    const unsubscribe = window.api.onImporterOcrProgress((prog) => {
      if (statusEl) statusEl.textContent = isCa ? `Pàgina ${prog.current} de ${prog.total}` : `Página ${prog.current} de ${prog.total}`;
      if (barEl) barEl.style.width = `${prog.percent}%`;
    });

    modalContainer.querySelector('#btn-cancel-ocr-process').addEventListener('click', async () => {
      await window.api.importerCancelOcr();
      unsubscribe();
      this.closeModal();
    });

    try {
      const res = await window.api.importerRunOcr(filePath, language);
      unsubscribe();
      this.closeModal();
      res.filePath = filePath;
      this.currentImportData = res;
      this.showPreReviewSummaryModal(res);
    } catch (err) {
      unsubscribe();
      this.closeModal();
      if (!err.message.includes('cancelado')) {
        alert(`Error en el OCR: ${err.message}`);
      }
    }
  },

  showPreReviewSummaryModal(data) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const modalContainer = document.querySelector('#modal-container') || document.body;

    const coverDetected = Boolean(data.metadata?.cover);
    const presDetected = Boolean(data.metadata?.presentation);
    const tocEntriesCount = (data.metadata?.tocEntries || []).length;
    const tocDetected = tocEntriesCount > 0;
    const backDetected = Boolean(data.metadata?.backMatter);

    modalContainer.innerHTML = `
      <div class="modal-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog" style="max-width: 580px; width: 100%; background: white; border-radius: 12px; padding: 26px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <h2 style="font-size: 19px; font-weight: 800; margin: 0 0 4px; color: #1e1b4b;">
                📊 ${isCa ? 'Resum de l\'anàlisi estructural del document' : 'Resumen del análisis estructural del documento'}
              </h2>
              <div style="font-size: 12.5px; color: var(--text-muted);">
                ${data.format?.toUpperCase()} · ${data.language === 'ca' ? 'Català' : 'Castellano'}
              </div>
            </div>
            <span class="badge" style="background: ${data.stats.overallConfidence === 'alta' ? '#ecfdf5' : '#fef3c7'}; color: ${data.stats.overallConfidence === 'alta' ? '#047857' : '#b45309'}; font-weight: 700; font-size: 12px;">
              ${data.stats.overallConfidence === 'alta' ? (isCa ? 'Confiança Alta' : 'Confianza Alta') : (isCa ? 'Revisió recomanada' : 'Revisión recomendada')}
            </span>
          </div>

          <!-- Nombre de la fuente editable -->
          <div style="margin-bottom: 14px;">
            <label style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 6px; display: block;">
              ${isCa ? 'Nom del programa font' : 'Nombre del programa fuente'}
            </label>
            <input type="text" id="input-summary-source-name" class="input" style="width: 100%; font-size: 15px; font-weight: 700; padding: 8px 12px;" value="${escapeHtml(data.sourceName)}" />
          </div>

          <!-- Estructura macro detectada -->
          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;">
            <div style="font-size: 11.5px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
              ${isCa ? 'Seccions del document' : 'Secciones del documento'}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12.5px; color: #334155;">
              <div><b>${isCa ? 'Portada:' : 'Portada:'}</b> ${coverDetected ? '<span style="color:#059669;">✓ Detectada</span>' : '<span style="color:#64748b;">— No detectada</span>'}</div>
              <div><b>${isCa ? 'Presentació general:' : 'Presentación general:'}</b> ${presDetected ? '<span style="color:#059669;">✓ Detectada</span>' : '<span style="color:#64748b;">— No detectada</span>'}</div>
              <div><b>${isCa ? 'Índex:' : 'Índice:'}</b> ${tocDetected ? `<span style="color:#059669;">✓ Detectat (${tocEntriesCount})</span>` : '<span style="color:#64748b;">— No detectat</span>'}</div>
              <div><b>${isCa ? 'Tancament / Nota final:' : 'Cierre / Nota final:'}</b> ${backDetected ? '<span style="color:#059669;">✓ Detectat</span>' : '<span style="color:#64748b;">— No detectat</span>'}</div>
            </div>

            <!-- Recuentos cuantitativos -->
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; gap: 8px;">
              <div>
                <div style="font-size: 20px; font-weight: 800; color: #1e1b4b;">${data.stats.totalAreas}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${isCa ? 'àrees' : 'áreas'}</div>
              </div>
              <div>
                <div style="font-size: 20px; font-weight: 800; color: #4338ca;">${data.stats.totalSubareas || 0}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${isCa ? 'subàrees' : 'subáreas'}</div>
              </div>
              <div>
                <div style="font-size: 20px; font-weight: 800; color: #7c3aed;">${data.stats.totalMeasures}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${isCa ? 'medidas' : 'medidas'}</div>
              </div>
              <div>
                <div style="font-size: 20px; font-weight: 800; color: ${data.stats.requiresReviewCount > 0 ? '#b45309' : '#059669'};">
                  ${data.stats.requiresReviewCount}
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">${isCa ? 'a revisar' : 'a revisar'}</div>
              </div>
            </div>
          </div>

          <!-- Alertas estructurales si las hay -->
          ${(data.stats.alerts && data.stats.alerts.length > 0) ? `
            <div style="background: #fffbeb; border: 1.5px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 12.5px; color: #92400e;">
              <strong>⚠️ ${isCa ? 'Alerta de coherència documental:' : 'Alerta de coherencia documental:'}</strong>
              <ul style="margin: 4px 0 0 16px; padding: 0;">
                ${data.stats.alerts.map(al => `<li>${escapeHtml(al)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
            <button class="btn" id="btn-summary-cancel">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="btn-summary-proceed" style="background: #7c3aed; border-color: #6d28d9; font-weight: 700; padding: 9px 18px;">
              👁 ${isCa ? 'Revisar estructura' : 'Revisar estructura'}
            </button>
          </div>
        </div>
      </div>
    `;
    modalContainer.style.display = 'block';

    const nameInput = modalContainer.querySelector('#input-summary-source-name');
    modalContainer.querySelector('#btn-summary-cancel').addEventListener('click', () => this.closeModal());
    modalContainer.querySelector('#btn-summary-proceed').addEventListener('click', () => {
      data.sourceName = (nameInput.value || '').trim() || data.sourceName;
      this.closeModal();
      this.openHierarchicalReviewScreen(data);
    });
  },

  openHierarchicalReviewScreen(data) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const container = document.querySelector('#view-container');
    if (!container) return;

    let totalMeasures = 0;
    data.areas.forEach(a => {
      (a.measures || []).forEach(m => {
        if (!m.ignored && m.tipo !== 'ignorar' && m.tipo !== 'introduccion' && m.tipo !== 'subarea' && m.tipo !== 'area' && m.tipo !== 'contenido_general') {
          totalMeasures++;
        }
      });
    });

    container.innerHTML = `
      <div class="view-header" style="margin-bottom: 20px;">
        <div class="view-header-left">
          <div class="label" style="color: #7c3aed; font-weight: 700; text-transform: uppercase; font-size: 11.5px;">
            ${isCa ? 'Revisió jeràrquica d\'importació' : 'Revisión jerárquica de importación'}
          </div>
          <h1 class="title" style="font-size: 24px; font-weight: 800; margin: 4px 0 6px; color: #1e1b4b;">
            📑 ${escapeHtml(data.sourceName)}
          </h1>
          <p class="subtitle" style="font-size: 13.5px; color: var(--text-secondary); margin: 0;">
            ${data.areas.length} ${isCa ? 'àrees' : 'áreas'} · <span id="review-total-measures">${totalMeasures}</span> ${isCa ? 'mesures vàlides' : 'medidas válidas'} (${data.language === 'ca' ? 'Català' : 'Castellano'})
          </p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 10px; align-items: center;">
          ${(data.stats.requiresReviewCount > 0) ? `
            <button class="btn" id="btn-review-ai-classify" style="background: #f5f3ff; border: 1.5px solid #d8b4fe; color: #6d28d9; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              🤖 ${isCa ? 'Analitzar elements dubtosos amb IA local' : 'Analizar elementos dudosos con IA local'}
            </button>
          ` : ''}
          <button class="btn" id="btn-review-cancel-all">
            ${isCa ? 'Cancel·lar importació' : 'Cancelar importación'}
          </button>
          <button class="btn primary" id="btn-review-confirm-all" style="background: #10b981; border-color: #059669; font-weight: 700; padding: 9px 18px;">
            ✓ ${isCa ? 'Confirmar importació' : 'Confirmar importación'}
          </button>
        </div>
      </div>

      <!-- Barra informativa -->
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; font-size: 13px; color: #92400e; display: flex; align-items: center; justify-content: space-between;">
        <div>
          💡 <b>${isCa ? 'Guia de revisió estructural:' : 'Guía de revisión estructural:'}</b>
          ${isCa
            ? 'Pots canviar el tipus de cada element (Àrea, Subàrea, Introducció, Mesura o Ignorar). Si canvies un element a "Àrea", dividirà la secció creant una nova àrea. Les introduccions no es compten com a mesures.'
            : 'Puedes cambiar el tipo de cada elemento (Área, Subárea, Introducción, Medida o Ignorar). Si cambias un elemento a "Área", dividirá la sección creando una nueva área. Las introducciones no se computan como medidas.'}
        </div>
      </div>

      <!-- Lista jerárquica de áreas y medidas -->
      <div id="review-areas-tree" style="display: flex; flex-direction: column; gap: 24px; margin-bottom: 40px;">
        ${data.areas.map((area, aIdx) => this.renderAreaBlock(area, aIdx, isCa)).join('')}
      </div>

      <!-- Barra de confirmación flotante inferior -->
      <div style="position: sticky; bottom: 12px; background: white; border: 1.5px solid var(--border-subtle); border-radius: 12px; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15); z-index: 100;">
        <div style="font-size: 13.5px; font-weight: 600; color: var(--text-secondary);">
          ${data.areas.length} ${isCa ? 'àrees preparades per crear el programa font' : 'áreas preparadas para crear el programa fuente'}
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn" id="btn-bottom-cancel">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
          <button class="btn primary" id="btn-bottom-confirm" style="background: #10b981; border-color: #059669; font-weight: 700; padding: 8px 20px;">
            ✓ ${isCa ? 'Confirmar importació' : 'Confirmar importación'}
          </button>
        </div>
      </div>
    `;

    this.bindReviewEvents(container, data);
  },

  renderAreaBlock(area, aIdx, isCa) {
    const validCount = (area.measures || []).filter(m => !m.ignored && m.tipo !== 'ignorar' && m.tipo !== 'introduccion' && m.tipo !== 'subarea' && m.tipo !== 'contenido_general').length;
    return `
      <div class="card area-review-card" data-area-idx="${aIdx}" style="padding: 20px; border-radius: 12px; border: 1.5px solid #cbd5e1; background: #ffffff;">
        <!-- Cabecera de área editable -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 1.5px solid #e2e8f0; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <span style="font-size: 13px; font-weight: 800; background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px;">
              ${isCa ? 'ÀREA' : 'ÁREA'} ${aIdx + 1}
            </span>
            <input type="text" class="input input-area-title" data-area-idx="${aIdx}" value="${escapeHtml(area.title)}" style="font-size: 16px; font-weight: 800; flex: 1; padding: 8px 12px;" />
          </div>
          <div style="font-size: 12px; font-weight: 600; color: var(--text-muted);">
            ${validCount} ${isCa ? 'mesures vàlides' : 'medidas válidas'}
          </div>
        </div>

        ${area.introduction ? `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px; color: #1e40af;">
            <div style="font-weight: 700; margin-bottom: 4px; font-size: 12px; text-transform: uppercase;">
              📝 ${isCa ? 'Introducció de l\'àrea / Objectiu:' : 'Introducción del área / Objetivo:'}
            </div>
            <textarea class="textarea input-area-intro" data-area-idx="${aIdx}" style="width: 100%; min-height: 50px; font-size: 12.5px; border-color: #bfdbfe;">${escapeHtml(area.introduction)}</textarea>
          </div>
        ` : ''}

        <!-- Lista de medidas del área -->
        <div class="measures-review-list" data-area-idx="${aIdx}" style="display: flex; flex-direction: column; gap: 14px;">
          ${(area.measures || []).map((m, mIdx) => this.renderMeasureRow(m, aIdx, mIdx, isCa)).join('')}
        </div>
      </div>
    `;
  },

  renderMeasureRow(m, aIdx, mIdx, isCa) {
    const isIgnored = Boolean(m.ignored) || m.tipo === 'ignorar';
    const isIntro = m.tipo === 'introduccion';
    const isSubarea = m.tipo === 'subarea';
    const hasWarning = m.requiresReview && !isIgnored && !isIntro;

    let borderCol = '#e2e8f0';
    let bgCol = '#ffffff';
    if (isIgnored) {
      bgCol = '#f8fafc';
    } else if (isIntro) {
      borderCol = '#bfdbfe';
      bgCol = '#eff6ff';
    } else if (isSubarea) {
      borderCol = '#e9d5ff';
      bgCol = '#faf5ff';
    } else if (hasWarning) {
      borderCol = '#fde68a';
      bgCol = '#fffdf5';
    }

    return `
      <div class="measure-review-row ${isIgnored ? 'measure-ignored' : ''}" data-area-idx="${aIdx}" data-measure-idx="${mIdx}" style="border: 1.5px solid ${borderCol}; border-radius: 8px; padding: 14px; background: ${bgCol}; opacity: ${isIgnored ? '0.5' : '1'};">
        <!-- Barra superior de la medida -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">
              ${escapeHtml(m.sourceNumber || `${aIdx + 1}.${mIdx + 1}`)}
            </span>

            <!-- Selector de tipo de bloque -->
            <select class="select select-block-type" data-area-idx="${aIdx}" data-measure-idx="${mIdx}" style="font-size: 12px; font-weight: 700; padding: 3px 8px; height: 28px; border-radius: 6px;">
              <option value="medida" ${(!m.tipo || m.tipo === 'medida') && !isIgnored ? 'selected' : ''}>${isCa ? '📌 Mesura' : '📌 Medida'}</option>
              <option value="area">${isCa ? '📂 Convertir en Àrea' : '📂 Convertir en Área'}</option>
              <option value="subarea" ${isSubarea ? 'selected' : ''}>${isCa ? '📁 Subàrea' : '📁 Subárea'}</option>
              <option value="introduccion" ${isIntro ? 'selected' : ''}>${isCa ? '📝 Introducció d\'àrea' : '📝 Introducción de área'}</option>
              <option value="contenido_general" ${m.tipo === 'contenido_general' ? 'selected' : ''}>${isCa ? '📄 Contingut general' : '📄 Contenido general'}</option>
              <option value="ignorar" ${isIgnored ? 'selected' : ''}>${isCa ? '🗑️ Ignorar' : '🗑️ Ignorar'}</option>
            </select>

            ${hasWarning ? `
              <span class="badge" style="background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700;">
                ⚠️ ${escapeHtml(m.reviewReason || (isCa ? 'Revisar' : 'Revisar'))}
              </span>
            ` : ''}
          </div>

          <!-- Acciones en la medida -->
          <div style="display: flex; gap: 6px;">
            <button class="btn small btn-toggle-ignore" data-area-idx="${aIdx}" data-measure-idx="${mIdx}" title="${isIgnored ? 'Restaurar' : 'Ignorar'}">
              ${isIgnored ? '↩️ ' + (isCa ? 'Restaurar' : 'Restaurar') : '🗑️ ' + (isCa ? 'Ignorar' : 'Ignorar')}
            </button>
            <button class="btn small btn-merge-measure" data-area-idx="${aIdx}" data-measure-idx="${mIdx}" title="${isCa ? 'Unir amb la següent mesura' : 'Unir con la siguiente medida'}">
              🔗 ${isCa ? 'Unir' : 'Unir'}
            </button>
            <button class="btn small btn-split-measure" data-area-idx="${aIdx}" data-measure-idx="${mIdx}" title="${isCa ? 'Separar mesura en dues' : 'Separar medida en dos'}">
              ✂️ ${isCa ? 'Separar' : 'Separar'}
            </button>
          </div>
        </div>

        ${!isIntro && m.tipo !== 'contenido_general' ? `
          <!-- Título editable -->
          <div style="margin-bottom: 8px;">
            <input type="text" class="input input-measure-title" data-area-idx="${aIdx}" data-measure-idx="${mIdx}" placeholder="${isCa ? 'Títol de la mesura (opcional)…' : 'Título de la medida (opcional)...'}" value="${escapeHtml(m.title || '')}" style="width: 100%; font-size: 13.5px; font-weight: 700; padding: 7px 10px;" ${isIgnored ? 'disabled' : ''} />
          </div>
        ` : ''}

        <!-- Texto de la medida / contenido editable -->
        <div>
          <textarea class="textarea input-measure-text" data-area-idx="${aIdx}" data-measure-idx="${mIdx}" style="width: 100%; font-size: 13px; line-height: 1.5; padding: 8px 10px; min-height: 64px;" ${isIgnored ? 'disabled' : ''}>${escapeHtml(m.text || '')}</textarea>
        </div>
      </div>
    `;
  },

  bindReviewEvents(container, data) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;

    // Botón de Clasificación con IA local para elementos dudosos
    const btnAiClassify = container.querySelector('#btn-review-ai-classify');
    if (btnAiClassify) {
      btnAiClassify.addEventListener('click', async () => {
        const ambiguous = [];
        data.areas.forEach((a, aIdx) => {
          (a.measures || []).forEach((m, mIdx) => {
            if (m.requiresReview || m.dudoso) {
              ambiguous.push({
                id: `${aIdx}_${mIdx}`,
                aIdx,
                mIdx,
                text: m.text,
                title: m.title
              });
            }
          });
        });

        if (ambiguous.length === 0) {
          alert(isCa ? 'No hi ha elements que requereixin revisió.' : 'No hay elementos que requieran revisión.');
          return;
        }

        btnAiClassify.disabled = true;
        btnAiClassify.textContent = isCa ? 'Classificant amb IA local…' : 'Clasificando con IA local...';

        try {
          const res = await window.api.importerClassifyWithAi(ambiguous, {});
          if (res && res.ok && res.clasificaciones) {
            res.clasificaciones.forEach(c => {
              const [aIdxStr, mIdxStr] = (c.id || '').split('_');
              const aI = parseInt(aIdxStr, 10);
              const mI = parseInt(mIdxStr, 10);
              if (data.areas[aI] && data.areas[aI].measures[mI]) {
                const item = data.areas[aI].measures[mI];
                const mappedType = (c.tipo || '').toLowerCase();
                if (['medida', 'introduccion', 'subarea', 'contenido_general', 'ignorar'].includes(mappedType)) {
                  item.tipo = mappedType;
                  item.requiresReview = false;
                  item.dudoso = false;
                }
              }
            });
            this.openHierarchicalReviewScreen(data);
          } else {
            alert(res.error || (isCa ? 'No s\'ha pogut classificar amb IA.' : 'No se pudo clasificar con IA.'));
            btnAiClassify.disabled = false;
            btnAiClassify.textContent = isCa ? '🤖 Analitzar amb IA local' : '🤖 Analizar con IA local';
          }
        } catch (err) {
          alert(`Error: ${err.message}`);
          btnAiClassify.disabled = false;
          btnAiClassify.textContent = isCa ? '🤖 Analitzar amb IA local' : '🤖 Analizar con IA local';
        }
      });
    }

    // Selector de tipo de bloque (Área, Subárea, Introducción, Medida, Contenido general, Ignorar)
    container.querySelectorAll('.select-block-type').forEach(select => {
      select.addEventListener('change', (e) => {
        const aIdx = parseInt(e.target.dataset.areaIdx, 10);
        const mIdx = parseInt(e.target.dataset.measureIdx, 10);
        const newType = e.target.value;
        const currentArea = data.areas[aIdx];
        const m = currentArea.measures[mIdx];

        if (newType === 'area') {
          // CONVERTIR EN ÁREA:
          const newAreaTitle = (m.title || m.text).substring(0, 80).trim();
          const subsequentMeasures = currentArea.measures.slice(mIdx + 1);

          currentArea.measures = currentArea.measures.slice(0, mIdx);

          const newArea = {
            title: newAreaTitle,
            sourceNumber: String(aIdx + 2),
            subareas: [],
            measures: subsequentMeasures
          };

          data.areas.splice(aIdx + 1, 0, newArea);
          this.openHierarchicalReviewScreen(data);
          return;
        }

        if (newType === 'introduccion') {
          m.tipo = 'introduccion';
          m.ignored = false;
          this.openHierarchicalReviewScreen(data);
          return;
        }

        if (newType === 'subarea') {
          m.tipo = 'subarea';
          m.ignored = false;
          this.openHierarchicalReviewScreen(data);
          return;
        }

        if (newType === 'contenido_general') {
          m.tipo = 'contenido_general';
          m.ignored = false;
          this.openHierarchicalReviewScreen(data);
          return;
        }

        if (newType === 'ignorar') {
          m.tipo = 'ignorar';
          m.ignored = true;
          this.openHierarchicalReviewScreen(data);
          return;
        }

        if (newType === 'medida') {
          m.tipo = 'medida';
          m.ignored = false;
          this.openHierarchicalReviewScreen(data);
          return;
        }
      });
    });

    // Edición de título de área
    container.querySelectorAll('.input-area-title').forEach(input => {
      input.addEventListener('input', (e) => {
        const aIdx = parseInt(e.target.dataset.areaIdx, 10);
        data.areas[aIdx].title = e.target.value.trim();
      });
    });

    // Edición de introducción de área
    container.querySelectorAll('.input-area-intro').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const aIdx = parseInt(e.target.dataset.areaIdx, 10);
        data.areas[aIdx].introduction = e.target.value;
      });
    });

    // Edición de título de medida
    container.querySelectorAll('.input-measure-title').forEach(input => {
      input.addEventListener('input', (e) => {
        const aIdx = parseInt(e.target.dataset.areaIdx, 10);
        const mIdx = parseInt(e.target.dataset.measureIdx, 10);
        data.areas[aIdx].measures[mIdx].title = e.target.value;
      });
    });

    // Edición de texto de medida
    container.querySelectorAll('.input-measure-text').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const aIdx = parseInt(e.target.dataset.areaIdx, 10);
        const mIdx = parseInt(e.target.dataset.measureIdx, 10);
        data.areas[aIdx].measures[mIdx].text = e.target.value;
      });
    });

    // Ignorar / Restaurar medida
    container.querySelectorAll('.btn-toggle-ignore').forEach(btn => {
      btn.addEventListener('click', () => {
        const aIdx = parseInt(btn.dataset.areaIdx, 10);
        const mIdx = parseInt(btn.dataset.measureIdx, 10);
        const m = data.areas[aIdx].measures[mIdx];
        m.ignored = !m.ignored;
        m.tipo = m.ignored ? 'ignorar' : 'medida';
        this.openHierarchicalReviewScreen(data);
      });
    });

    // Unir con la siguiente medida
    container.querySelectorAll('.btn-merge-measure').forEach(btn => {
      btn.addEventListener('click', () => {
        const aIdx = parseInt(btn.dataset.areaIdx, 10);
        const mIdx = parseInt(btn.dataset.measureIdx, 10);
        const area = data.areas[aIdx];
        if (mIdx + 1 >= area.measures.length) {
          alert(isCa ? 'Aquesta és l\'última mesura de l\'àrea; no hi ha cap mesura posterior per unir.' : 'Esta es la última medida del área; no hay medida posterior para unir.');
          return;
        }

        const current = area.measures[mIdx];
        const next = area.measures[mIdx + 1];

        const separator = current.text.endsWith('.') ? ' ' : '. ';
        current.text = current.text + separator + next.text;
        if (!current.title && next.title) {
          current.title = next.title;
        }

        area.measures.splice(mIdx + 1, 1);
        this.openHierarchicalReviewScreen(data);
      });
    });

    // Separar medida
    container.querySelectorAll('.btn-split-measure').forEach(btn => {
      btn.addEventListener('click', () => {
        const aIdx = parseInt(btn.dataset.areaIdx, 10);
        const mIdx = parseInt(btn.dataset.measureIdx, 10);
        const area = data.areas[aIdx];
        const m = area.measures[mIdx];

        const text = m.text || '';
        const half = Math.floor(text.length / 2);
        let splitIdx = text.indexOf('. ', half);
        if (splitIdx === -1) splitIdx = text.indexOf(' ', half);
        if (splitIdx === -1) splitIdx = half;

        const part1 = text.substring(0, splitIdx + 1).trim();
        const part2 = text.substring(splitIdx + 1).trim();

        m.text = part1;
        const newM = {
          sourceNumber: `${m.sourceNumber}.bis`,
          subarea: m.subarea,
          title: '',
          text: part2,
          explanation: '',
          sourcePage: m.sourcePage,
          requiresReview: true,
          dudoso: false,
          reviewReason: 'Medida separada manualmente',
          tipo: 'medida'
        };

        area.measures.splice(mIdx + 1, 0, newM);
        this.openHierarchicalReviewScreen(data);
      });
    });

    // Cancelar importación
    const handleCancel = () => {
      if (confirm(isCa ? 'Vols cancel·lar la importació? Les dades extretes es descartaran.' : '¿Deseas cancelar la importación? Los datos extraídos se descartarán.')) {
        this.currentImportData = null;
        if (this.callingProjectId && window.App) {
          window.App.navigateTo('areas');
        } else if (window.App) {
          window.App.navigateTo('fuentes');
        }
      }
    };
    container.querySelector('#btn-review-cancel-all')?.addEventListener('click', handleCancel);
    container.querySelector('#btn-bottom-cancel')?.addEventListener('click', handleCancel);

    // Confirmar importación
    const handleConfirm = async () => {
      // Filtrar medidas válidas y separar introducciones de área
      const cleanedAreas = data.areas.map(a => {
        const introTexts = [];
        if (a.introduction) introTexts.push(a.introduction);

        const validMeasures = [];
        (a.measures || []).forEach(m => {
          if (m.tipo === 'introduccion') {
            introTexts.push(m.text);
          } else if (!m.ignored && m.tipo !== 'ignorar' && m.tipo !== 'subarea') {
            validMeasures.push(m);
          }
        });

        return {
          ...a,
          introduction: introTexts.join('\n\n'),
          measures: validMeasures
        };
      }).filter(a => a.measures.length > 0 || a.title);

      if (cleanedAreas.length === 0) {
        alert(isCa ? 'No hi ha cap àrea o mesura vàlida per importar.' : 'No hay ningún área o medida válida para importar.');
        return;
      }

      try {
        App.notifySaving();
        const createdSource = await window.api.importerConfirmImport({
          nombre: data.sourceName,
          tipo: data.format,
          origen_archivo: data.filePath,
          idioma_inicial: data.language,
          areas: cleanedAreas,
          setAsActive: false
        });
        App.notifySaved();

        // Si la importación se inició desde un proyecto, asociarla automáticamente como complementaria
        if (this.callingProjectId) {
          await window.api.addSourceToProject(this.callingProjectId, createdSource.id, 'complementaria');
          alert(isCa ? 'Programa font creat i afegit al projecte com a font complementària!' : '¡Programa fuente creado y añadido al proyecto como fuente complementaria!');
          this.callingProjectId = null;
          if (window.App) window.App.navigateTo('areas');
        } else {
          alert(isCa ? 'Programa font creat correctament!' : '¡Programa fuente creado correctamente!');
          if (window.App) window.App.navigateTo('fuentes');
        }
      } catch (err) {
        alert(`Error al confirmar la importación: ${err.message}`);
      }
    };

    container.querySelector('#btn-review-confirm-all')?.addEventListener('click', handleConfirm);
    container.querySelector('#btn-bottom-confirm')?.addEventListener('click', handleConfirm);
  },

  async openAddLanguageModal(sourceId, targetLang) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const targetName = targetLang === 'ca' ? 'Català' : 'Castellano';

    const filePath = await window.api.importerSelectFile();
    if (!filePath) return;

    this.showLoadingModal(isCa ? `Analitzant document en ${targetName}…` : `Analizando documento en ${targetName}...`);

    try {
      const analysis = await window.api.importerAnalyzeDocument(filePath, targetLang);
      this.closeModal();

      if (analysis.isScanned) {
        alert(isCa ? 'El document en aquest idioma és un PDF escanejat que requereix OCR.' : 'El documento en este idioma es un PDF escaneado que requiere OCR.');
        return;
      }

      App.notifySaving();
      await window.api.importerAddLanguage(sourceId, targetLang, {
        origen_archivo: filePath,
        areas: analysis.areas
      });
      App.notifySaved();

      alert(isCa ? `Versió en ${targetName} associada amb èxit a la mateixa font!` : `¡Versión en ${targetName} asociada con éxito a la misma fuente!`);
      if (window.SourceProgramsView) {
        const container = document.querySelector('#view-container');
        if (container) window.SourceProgramsView.render(container);
      }
    } catch (err) {
      this.closeModal();
      alert(`Error al asociar el idioma: ${err.message}`);
    }
  },

  showLoadingModal(text) {
    const modalContainer = document.querySelector('#modal-container') || document.body;
    modalContainer.innerHTML = `
      <div class="modal-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog" style="max-width: 400px; width: 100%; background: white; border-radius: 12px; padding: 26px; text-align: center;">
          <div style="font-size: 30px; margin-bottom: 12px;">⏳</div>
          <h3 style="font-size: 16px; font-weight: 800; margin: 0 0 6px; color: #1e1b4b;">${escapeHtml(text)}</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">100% local</p>
        </div>
      </div>
    `;
    modalContainer.style.display = 'block';
  },

  closeModal() {
    const modalContainer = document.querySelector('#modal-container');
    if (modalContainer) {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    }
  }
};

window.ImportReviewView = ImportReviewView;
