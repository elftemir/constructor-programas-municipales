/**
 * reviewExportView.js - Vista de Revisión y Exportación
 * Constructor de Programas Municipales - Versión 1.3.0
 * Incluye:
 * - Revisión guiada secuencial de medidas en duda (Workflow guiado)
 * - Exportación Word (.docx) bilingüe independiente (ES, CA o Ambos)
 * - Botones separados para abrir ES, CA y carpeta de destino
 * - Soporte 100% i18n (Castellano / Català)
 */

const ReviewExportView = {
  lastExportResult: null,
  skippedUntitledIds: new Set(),

  async prepareLemaExport(project, languages) {
    const options = {};
    for (const lang of window.Lema.missingLemaLanguages(project, languages)) {
      const action = await this.promptMissingLema(lang);
      if (action === 'write') {
        await window.App.navigateTo('datos-basicos');
        document.querySelector('#input-lema-' + lang)?.focus();
        return null;
      }
      if (action === 'other') options[lang] = { lemaAlternativoConfirmado: true };
      else if (action === 'translate') {
        try { if (!await window.LemaUi.translate(project, lang)) return null; }
        catch (err) { alert(err.message); return null; }
      } else return null;
    }
    return options;
  },

  promptMissingLema(lang) {
    const t = key => window.i18n.t(key);
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="lema-export-title" style="max-width: 620px; padding: 24px;">
        <div style="display: flex; justify-content: space-between; gap: 12px;">
          <h2 id="lema-export-title">${t('lema.missing_title')}</h2>
          <button class="btn small" data-lema-action="cancel" aria-label="${t('lema.close')}">×</button>
        </div>
        <p>${window.i18n.t('lema.missing_body', { lang: lang === 'es' ? t('lema.lang_es') : t('lema.lang_ca') })}</p>
        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px;">
          <button class="btn primary" data-lema-action="translate">${t('lema.translate')}</button>
          <button class="btn" data-lema-action="write">${t('lema.write_now')}</button>
          <button class="btn" data-lema-action="other">${t('lema.use_other')}</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
      const finish = action => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(action); };
      const onKey = event => { if (event.key === 'Escape') finish('cancel'); };
      document.addEventListener('keydown', onKey);
      overlay.querySelectorAll('[data-lema-action]').forEach(button => button.addEventListener('click', () => finish(button.dataset.lemaAction)));
      overlay.querySelector('[data-lema-action="translate"]').focus();
    });
  },

  async render(container, project) {
    if (!project) return;
    this.skippedUntitledIds = new Set();

    const lang = window.i18n ? window.i18n.getLang() : (project.idioma_principal || 'es');
    const isCa = lang === 'ca';

    const stats = project.stats || {
      total_marco: 0,
      decididas: 0,
      progreso_pct: 0,
      incluidas: 0,
      adaptadas: 0,
      descartadas: 0,
      en_duda: 0,
      sin_revisar: 0,
      medidas_propias: 0
    };

    const totalExportable = stats.incluidas + stats.adaptadas + stats.medidas_propias;
    const totalMarco = stats.total_marco ?? 0;
    const incluidasOAdaptadas = stats.incluidas + stats.adaptadas;
    const noIncluidas = Math.max(0, totalMarco - incluidasOAdaptadas);

    // Check general texts status
    const gen = project.textos_generales || {};
    const hasPres = Boolean(gen.presentacion_entradilla || (gen.presentacion_parrafos && gen.presentacion_parrafos.length > 0));
    const hasCierre = Boolean(gen.cierre_parrafos && gen.cierre_parrafos.length > 0);
    const introsCount = Object.keys(gen.introducciones_areas || {}).filter(k => {
      const it = gen.introducciones_areas[k];
      return it && (it.entradilla || it.texto || it.es?.entradilla || it.es?.texto || it.ca?.entradilla || it.ca?.texto);
    }).length;

    // Get export directory & PDF converter status
    const baseExportDir = await window.api.getExportDir();
    const converters = window.api.detectPdfConverters ? await window.api.detectPdfConverters().catch(() => ({ canConvert: false })) : { canConvert: false };
    const munSlug = (project.municipio || 'Municipal')
      .replace(/['’]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/_+/g, '_');
    const targetFolder = `${baseExportDir}\\${munSlug}`;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="title">${window.i18n.t('review.title')}</h1>
          <p class="subtitle">${window.i18n.t('review.subtitle')}</p>
        </div>
        <div class="view-header-right">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
        </div>
      </div>

      ${this.lastExportResult ? this.renderExportSuccess() : ''}

      <!-- Resumen estadístico de la exportación -->
      <div class="export-summary-box">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="label" style="color: var(--action-link);">${window.i18n.t('review.summary_title')}</div>
            <h2 class="section-title" style="font-size: 22px; margin-top: 4px;">
              Programa de ${escapeHtml(project.partido || 'Podemos')} · ${escapeHtml(project.municipio || '')}
            </h2>
            <div class="muted" style="font-size: 13.5px; margin-top: 2px;">
              ${isCa ? 'Mandat' : 'Mandato'} ${escapeHtml(project.mandato || '2027–2031')} · ${project.idioma_principal === 'ca' ? 'Català' : 'Castellano'}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 32px; font-weight: 800; color: var(--action-primary);">${totalExportable}</div>
            <div class="muted" style="font-size: 13px;">${window.i18n.t('review.summary_props')}</div>
          </div>
        </div>

        <div class="export-summary-grid">
          <div class="export-summary-stat">
            <div class="value" style="color: var(--included-text);">${stats.incluidas}</div>
            <div class="lbl">${window.i18n.t('review.stat_included')}</div>
          </div>
          <div class="export-summary-stat">
            <div class="value" style="color: var(--adapted-text);">${stats.adaptadas}</div>
            <div class="lbl">${window.i18n.t('review.stat_adapted')}</div>
          </div>
          <div class="export-summary-stat">
            <div class="value" style="color: var(--action-link);">${stats.medidas_propias}</div>
            <div class="lbl">${window.i18n.t('review.stat_own')}</div>
          </div>
        </div>
      </div>

      <!-- TEXTOS DEL PROGRAMA (Recuperado y prominente) -->
      <div class="card" style="margin-bottom: 24px; padding: 22px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 class="section-title" style="font-size: 17.5px; margin: 0; display: flex; align-items: center; gap: 8px;">
              📝 ${isCa ? 'Textos del programa' : 'Textos del programa'}
            </h3>
            <div class="muted" style="font-size: 13px; margin-top: 2px;">
              ${isCa ? 'Presentació ciutadana, introduccions per àrea temàtica i tancament electoral.' : 'Presentación ciudadana, introducciones por área temática y cierre electoral.'}
            </div>
          </div>
          <button class="btn small" id="btn-open-all-general-texts">
            ${isCa ? 'Obrir editor complet →' : 'Abrir editor completo →'}
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
          <!-- Tarjeta Presentación -->
          <div style="border: 1.5px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 16px; background: var(--surface-default); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 14px;">🏛️ ${isCa ? 'Presentació' : 'Presentación'}</strong>
                <span class="badge" style="font-size: 11px; background: ${hasPres ? '#dcfce7; color: #166534' : '#f1f5f9; color: #475569'}; font-weight: 700;">
                  ${hasPres ? (isCa ? 'Redactada' : 'Redactada') : (isCa ? 'Sense redactar' : 'Sin redactar')}
                </span>
              </div>
              <p class="muted" style="font-size: 12.5px; margin: 0 0 12px 0;">
                ${isCa ? 'Apareix immediatament després de la portada i encapçala el programa electoral.' : 'Aparece inmediatamente tras la portada y encabeza el programa electoral.'}
              </p>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn small" id="btn-edit-presentacion">
                ✏️ ${hasPres ? (isCa ? 'Editar' : 'Editar') : (isCa ? 'Escriure' : 'Escribir')}
              </button>
              <button class="btn small" id="btn-ia-presentacion" style="color: #7c3aed; border-color: #ddd6fe;">
                ✨ ${isCa ? 'Generar amb IA' : 'Generar con IA'}
              </button>
            </div>
          </div>

          <!-- Tarjeta Introducciones por área -->
          <div style="border: 1.5px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 16px; background: var(--surface-default); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 14px;">📋 ${isCa ? 'Introduccions per àrea' : 'Introducciones por área'}</strong>
                <span class="badge" style="font-size: 11px; background: ${introsCount > 0 ? '#dcfce7; color: #166534' : '#f1f5f9; color: #475569'}; font-weight: 700;">
                  ${introsCount} de 12 ${isCa ? 'redactades' : 'redactadas'}
                </span>
              </div>
              <p class="muted" style="font-size: 12.5px; margin: 0 0 12px 0;">
                ${isCa ? 'Text d\'obertura per a cadascun dels 12 blocs temàtics del programa.' : 'Texto de apertura para cada uno de los 12 bloques temáticos del programa.'}
              </p>
            </div>
            <div>
              <button class="btn small" id="btn-edit-introducciones">
                📑 ${isCa ? 'Revisar introduccions' : 'Revisar introducciones'}
              </button>
            </div>
          </div>

          <!-- Tarjeta Cierre -->
          <div style="border: 1.5px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 16px; background: var(--surface-default); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 14px;">✊ ${isCa ? 'Tancament del programa' : 'Cierre del programa'}</strong>
                <span class="badge" style="font-size: 11px; background: ${hasCierre ? '#dcfce7; color: #166534' : '#f1f5f9; color: #475569'}; font-weight: 700;">
                  ${hasCierre ? (isCa ? 'Redactat' : 'Redactado') : (isCa ? 'Sense redactar' : 'Sin redactar')}
                </span>
              </div>
              <p class="muted" style="font-size: 12.5px; margin: 0 0 12px 0;">
                ${isCa ? 'Missatge final de compromís i crida al vot al final del document.' : 'Mensaje final de compromiso y llamamiento al voto al final del documento.'}
              </p>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn small" id="btn-edit-cierre">
                ✏️ ${hasCierre ? (isCa ? 'Editar' : 'Editar') : (isCa ? 'Escriure' : 'Escribir')}
              </button>
              <button class="btn small" id="btn-ia-cierre" style="color: #7c3aed; border-color: #ddd6fe;">
                ✨ ${isCa ? 'Generar amb IA' : 'Generar con IA'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Checklist de validación -->
      <div class="grid-2" style="margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <h3 class="section-title" style="font-size: 16px;">${window.i18n.t('review.checklist_title')}</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="checklist-item">
              <span class="icon">ℹ️</span>
              <div>
                <div class="title">${window.i18n.t('review.not_included_title', { count: noIncluidas })}</div>
                <div class="desc">
                  ${window.i18n.t('review.not_included_desc', {
                    count: noIncluidas,
                    decided: incluidasOAdaptadas,
                    included: stats.incluidas,
                    adapted: stats.adaptadas,
                    own: stats.medidas_propias > 0 ? (isCa ? ` més ${stats.medidas_propias} propostes pròpies` : ` más ${stats.medidas_propias} propuestas propias`) : ''
                  })}
                </div>
              </div>
            </div>

            <!-- Bloque de medidas en duda (Clicable / con botón guiado) -->
            <div class="checklist-item" id="checklist-item-doubt" style="${stats.en_duda > 0 ? 'background: #fffbeb; cursor: pointer;' : ''}">
              <span class="icon">${stats.en_duda === 0 ? '✅' : '⚠️'}</span>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div class="title" style="${stats.en_duda > 0 ? 'color: #b45309; font-weight: 700;' : ''}">
                    ${stats.en_duda === 0 ? window.i18n.t('review.doubt_none_title') : window.i18n.t('review.doubt_some_title', { count: stats.en_duda })}
                  </div>
                  ${stats.en_duda > 0 ? `
                    <button class="btn small" id="btn-trigger-doubt-review" style="background: #F59E0B; color: #ffffff; font-weight: 700; border: none; padding: 5px 12px; cursor: pointer;">
                      ❓ ${window.i18n.t('review.btn_review_doubts')}
                    </button>
                  ` : ''}
                </div>
                <div class="desc">
                  ${stats.en_duda === 0
                    ? window.i18n.t('review.doubt_none_desc')
                    : window.i18n.t('review.doubt_some_desc')}
                </div>
              </div>
            </div>

            <div class="checklist-item">
              <span class="icon">${hasPres ? '✅' : '⚪'}</span>
              <div>
                <div class="title">${hasPres ? window.i18n.t('review.pres_ready_title') : window.i18n.t('review.pres_empty_title')}</div>
                <div class="desc">${hasPres ? window.i18n.t('review.pres_ready_desc') : window.i18n.t('review.pres_empty_desc')}</div>
              </div>
            </div>

            <div class="checklist-item">
              <span class="icon">${introsCount > 0 ? '✅' : '⚪'}</span>
              <div>
                <div class="title">${window.i18n.t('review.intros_title', { count: introsCount, total: (project.areas || []).length })}</div>
                <div class="desc">${window.i18n.t('review.intros_desc')}</div>
              </div>
            </div>

            <div class="checklist-item">
              <span class="icon">${hasCierre ? '✅' : '⚪'}</span>
              <div>
                <div class="title">${hasCierre ? window.i18n.t('review.cierre_ready_title') : window.i18n.t('review.cierre_empty_title')}</div>
                <div class="desc">${hasCierre ? window.i18n.t('review.cierre_ready_desc') : window.i18n.t('review.cierre_empty_desc')}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Parámetros de Exportación y Destino -->
        <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 class="section-title" style="font-size: 16px; margin-bottom: 14px;">${window.i18n.t('review.config_title')}</h3>

            <div class="form-group">
              <label class="form-label" for="select-export-lang">${window.i18n.t('review.lang_select_label')}</label>
              <select class="select" id="select-export-lang">
                <option value="principal" selected>${window.i18n.t('review.lang_principal', { lang: project.idioma_principal === 'ca' ? 'Català' : 'Castellano' })}</option>
                <option value="secundario">${window.i18n.t('review.lang_secundario', { lang: project.idioma_principal === 'ca' ? 'Castellano' : 'Català' })}</option>
                <option value="ambos">${window.i18n.t('review.lang_ambos')}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">${isCa ? 'Format d\'exportació' : 'Formato de exportación'}</label>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
                <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 13.5px; cursor: pointer;">
                  <input type="radio" name="export-format" value="docx" checked style="margin-top: 3px; accent-color: var(--action-primary);" />
                  <div>
                    <div style="font-weight: 700;">Microsoft Word (.docx)</div>
                    <div class="muted" style="font-size: 12px;">${isCa ? 'Document mestre oficial editable' : 'Documento maestro oficial editable'}</div>
                  </div>
                </label>
                <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 13.5px; cursor: pointer;">
                  <input type="radio" name="export-format" value="pdf" ${converters.canConvert ? '' : 'disabled'} style="margin-top: 3px; accent-color: var(--action-primary);" />
                  <div>
                    <div style="font-weight: 700;">PDF (.pdf)</div>
                    <div class="muted" style="font-size: 12px;">${isCa ? 'Document final llest per imprimir i distribuir' : 'Documento final listo para imprimir y distribuir'}</div>
                  </div>
                </label>
              </div>

              <div style="margin-top: 10px; font-size: 12px; padding: 8px 12px; border-radius: 6px; background: ${converters.canConvert ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${converters.canConvert ? '#bbf7d0' : '#fef3c7'}; color: ${converters.canConvert ? '#166534' : '#92400e'};">
                ${converters.wordAvailable
                  ? (isCa ? '✓ Microsoft Word detectat per a conversió nativa a PDF.' : '✓ Microsoft Word detectado para conversión nativa a PDF.')
                  : (converters.libreOfficeAvailable
                    ? (isCa ? '✓ LibreOffice Writer detectat per a conversió a PDF.' : '✓ LibreOffice Writer detectado para conversión a PDF.')
                    : (isCa ? 'Per exportar a PDF cal Microsoft Word o LibreOffice (gratuït). Pots continuar exportant a DOCX. Després d’instal·lar un conversor, torna a aquesta pantalla.' : 'Para exportar a PDF hace falta Microsoft Word o LibreOffice (gratuito). Puedes seguir exportando a DOCX. Después de instalar un conversor, vuelve a esta pantalla.'))}
                ${!converters.canConvert ? `<button class="btn small" id="btn-download-libreoffice" style="margin-top: 8px;">${isCa ? 'Descarregar LibreOffice' : 'Descargar LibreOffice'}</button>` : ''}
              </div>
            </div>

            <div class="form-group" style="margin-top: 14px; background: #FAF9F7; border: 1px solid var(--border-subtle); padding: 12px 14px; border-radius: var(--radius-default);">
              <label class="form-label" style="margin-bottom: 4px;">${window.i18n.t('review.folder_label')}</label>
              <div style="font-family: monospace; font-size: 12.5px; color: var(--text-primary); word-break: break-all; margin-bottom: 8px;" id="export-target-display">
                ${escapeHtml(targetFolder)}
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn small" id="btn-change-folder-export">${window.i18n.t('review.btn_change_folder')}</button>
                <button class="btn small" id="btn-open-folder-export">${window.i18n.t('review.btn_open_folder')}</button>
              </div>
            </div>

            <div class="form-group" style="margin-top: 14px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13.5px;">
                <input type="checkbox" id="chk-open-after-export" checked style="width: 17px; height: 17px; accent-color: var(--action-primary);">
                <span>${window.i18n.t('review.chk_open_after')}</span>
              </label>
            </div>
          </div>

          <div style="margin-top: 24px;">
            <button class="btn primary large" id="btn-export-docx" style="width: 100%; font-size: 16px; padding: 14px;">
              ${window.i18n.t('review.btn_export')}
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container, project, baseExportDir);
  },

  renderExportSuccess() {
    const res = this.lastExportResult;
    const hasWarnings = Array.isArray(res.warnings) && res.warnings.length > 0;
    const isBoth = !!res.isBoth;
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;

    return `
      <div class="notice" style="border-left-color: var(--included-text); background-color: var(--included-bg); color: var(--included-text); margin-bottom: 16px; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="margin: 0 0 4px; font-size: 18px; font-weight: 800;">${window.i18n.t('review.success_title')}</h3>
            <p style="margin: 0 0 10px; font-size: 14px;">${window.i18n.t('review.success_desc')}</p>
            <div style="font-size: 13px; word-break: break-all;">
              ${isBoth ? `
                <div><b>Word ES:</b> <code>${escapeHtml(res.pathEs)}</code></div>
                ${res.pathPdfEs ? `<div><b>PDF ES:</b> <code>${escapeHtml(res.pathPdfEs)}</code></div>` : ''}
                <div style="margin-top: 4px;"><b>Word CA:</b> <code>${escapeHtml(res.pathCa)}</code></div>
                ${res.pathPdfCa ? `<div><b>PDF CA:</b> <code>${escapeHtml(res.pathPdfCa)}</code></div>` : ''}
              ` : `
                <div><b>Word:</b> <code>${escapeHtml(res.filePath)}</code></div>
                ${res.pdfPath ? `<div style="margin-top: 4px;"><b>PDF:</b> <code>${escapeHtml(res.pdfPath)}</code></div>` : ''}
              `}
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap;">
            ${isBoth ? `
              <button class="btn small primary" id="btn-open-doc-es">${window.i18n.t('review.btn_open_doc_es')}</button>
              ${res.pathPdfEs ? `<button class="btn small" id="btn-open-pdf-es" style="background: #dc2626; color: white;">📄 PDF (ES)</button>` : ''}
              <button class="btn small primary" id="btn-open-doc-ca">${window.i18n.t('review.btn_open_doc_ca')}</button>
              ${res.pathPdfCa ? `<button class="btn small" id="btn-open-pdf-ca" style="background: #dc2626; color: white;">📄 PDF (CA)</button>` : ''}
              <button class="btn small" id="btn-show-folder-now">${window.i18n.t('review.btn_show_folder')}</button>
            ` : `
              <button class="btn small primary" id="btn-open-doc-now">${window.i18n.t('review.btn_open_doc')}</button>
              ${res.pdfPath ? `<button class="btn small" id="btn-open-pdf-now" style="background: #dc2626; color: white;">📄 ${isCa ? 'Obrir PDF' : 'Abrir PDF'}</button>` : ''}
              <button class="btn small" id="btn-show-folder-now">${window.i18n.t('review.btn_show_folder')}</button>
            `}
          </div>
        </div>
      </div>

      ${hasWarnings ? `
        <div class="notice" style="border-left-color: #D97706; background-color: #FEF3C7; color: #92400E; margin-bottom: 20px; padding: 16px; border-radius: var(--radius-default); border-left-width: 4px; border-left-style: solid;">
          <div style="font-weight: 700; font-size: 14.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>⚠️ Advertencias:</span>
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.5;">
            ${res.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  },

  bindEvents(container, project, currentBaseDir) {
    container.querySelector('#btn-download-libreoffice')?.addEventListener('click', async () => {
      await window.api.openExternalUrl('https://www.libreoffice.org/download/');
    });
    const btnHelpScreen = container.querySelector('#btn-help-this-screen');
    if (btnHelpScreen) {
      btnHelpScreen.addEventListener('click', () => {
        if (window.Tutorial) window.Tutorial.startSectionTour('review_export');
      });
    }

    const btnChangeDir = container.querySelector('#btn-change-folder-export');
    if (btnChangeDir) {
      btnChangeDir.addEventListener('click', async () => {
        const newDir = await window.api.selectExportDir();
        if (newDir) {
          this.render(container, project);
        }
      });
    }

    const btnOpenDir = container.querySelector('#btn-open-folder-export');
    if (btnOpenDir) {
      btnOpenDir.addEventListener('click', async () => {
        await window.api.openExportDir();
      });
    }

    // Doubt review button
    const btnDoubtReview = container.querySelector('#btn-trigger-doubt-review');
    const doubtItem = container.querySelector('#checklist-item-doubt');
    if (btnDoubtReview) {
      btnDoubtReview.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDoubtReviewModal(project);
      });
    } else if (doubtItem && project.stats?.en_duda > 0) {
      doubtItem.addEventListener('click', () => {
        this.openDoubtReviewModal(project);
      });
    }

    // Handlers para Textos del programa
    container.querySelector('#btn-open-all-general-texts')?.addEventListener('click', () => {
      App.navigateTo('textos-generales');
    });

    container.querySelector('#btn-edit-presentacion')?.addEventListener('click', () => {
      if (window.GeneralTextsView) window.GeneralTextsView.currentSubSection = 'presentacion';
      App.navigateTo('textos-generales');
    });

    container.querySelector('#btn-edit-introducciones')?.addEventListener('click', () => {
      if (window.GeneralTextsView) window.GeneralTextsView.currentSubSection = 'introducciones';
      App.navigateTo('textos-generales');
    });

    container.querySelector('#btn-edit-cierre')?.addEventListener('click', () => {
      if (window.GeneralTextsView) window.GeneralTextsView.currentSubSection = 'cierre';
      App.navigateTo('textos-generales');
    });

    const checkModelAndLaunchAi = async (sectionKey) => {
      try {
        const models = await window.api.aiGetModels();
        const readyModel = models.find(m => m.instalado || m.estado === 'LISTO');
        if (!readyModel) {
          const isCa = window.i18n?.getLang() === 'ca';
          const conf = confirm(isCa
            ? 'Necessites un model d\'IA local llest per utilitzar aquesta funció.\n\nVols anar a Intel·ligència Artificial per descarregar-ne un?'
            : 'Necesitas un modelo de IA local listo para utilizar esta función.\n\n¿Deseas ir a Inteligencia Artificial para descargar uno?');
          if (conf) App.navigateTo('ia');
          return;
        }
        if (window.GeneralTextsView) {
          window.GeneralTextsView.currentSubSection = sectionKey;
          window.GeneralTextsView.activeAiMode[sectionKey] = 'ia';
        }
        App.navigateTo('textos-generales');
      } catch (e) {
        console.error('Error al comprobar modelos:', e);
        App.navigateTo('textos-generales');
      }
    };

    container.querySelector('#btn-ia-presentacion')?.addEventListener('click', () => {
      checkModelAndLaunchAi('presentacion');
    });

    container.querySelector('#btn-ia-cierre')?.addEventListener('click', () => {
      checkModelAndLaunchAi('cierre');
    });

    const openDocFile = async (filePath) => {
      if (!filePath) return;
      const targetPath = filePath.split('\n')[0].trim();
      const err = await window.api.openFile(targetPath);
      if (err) {
        alert(
          'No se pudo abrir automáticamente el documento en Word:\n' +
          err +
          '\n\nPuedes abrirlo manualmente desde la ruta:\n' +
          targetPath
        );
      }
    };

    const btnExport = container.querySelector('#btn-export-docx');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        const formatRadio = container.querySelector('input[name="export-format"]:checked');
        const exportFormat = formatRadio ? formatRadio.value : 'docx';
        const langMode = container.querySelector('#select-export-lang').value;
        const openAfter = container.querySelector('#chk-open-after-export').checked;

        // Detección previa de títulos pendientes en medidas seleccionadas para el programa
        const untitledMeasures = this.detectUntitledSelectedMeasures(project);
        if (untitledMeasures.length > 0) {
          const titleAction = await this.promptMissingTitlesAlert(project, untitledMeasures);
          if (titleAction === 'cancel') {
            return;
          }
          if (titleAction === 'suggest') {
            const wizardFinished = await this.openTitleReviewWizard(project, untitledMeasures);
            if (!wizardFinished) {
              return;
            }
            if (window.App && window.App.refreshCurrentProject) {
              await window.App.refreshCurrentProject();
              project = window.App.currentProject;
            }
          } else if (titleAction === 'continue_without') {
            untitledMeasures.forEach(m => this.skippedUntitledIds.add(m.id));
          }
        }

        const targetLangs = [];
        if (langMode === 'ambos') {
          targetLangs.push('es', 'ca');
        } else if (langMode === 'secundario') {
          targetLangs.push(project.idioma_principal === 'es' ? 'ca' : 'es');
        } else {
          targetLangs.push(project.idioma_principal || 'es');
        }

        const lemaOptions = await this.prepareLemaExport(project, targetLangs);
        if (!lemaOptions) return;

        if (targetLangs.includes('ca')) {
          const pendingCa = window.GeneralTextsView ? window.GeneralTextsView.getPendingGeneralTexts(project, 'ca') : [];
          if (pendingCa.length > 0) {
            const choice = await this.promptPendingCatalanTextsModal(project, pendingCa);
            if (choice === 'cancel') {
              return;
            }
            if (choice === 'translate') {
              btnExport.disabled = true;
              btnExport.textContent = window.i18n.getLang() === 'ca' ? 'Traduint textos amb IA…' : 'Traduciendo textos con IA…';
              try {
                await window.GeneralTextsView.batchTranslatePending(project, 'ca');
                if (window.App && window.App.refreshCurrentProject) {
                  await window.App.refreshCurrentProject();
                  project = window.App.currentProject;
                }
              } catch (err) {
                console.error('Error batch translating for export:', err);
              }
            }
          }
        }

        btnExport.disabled = true;
        btnExport.textContent = exportFormat === 'docx'
          ? window.i18n.t('review.btn_exporting')
          : (window.i18n.getLang() === 'ca' ? 'Generant PDF…' : 'Generando PDF…');

        try {
          let lastRes = null;

          if (exportFormat === 'docx') {
            if (langMode === 'ambos') {
              const res1 = await window.api.exportToDocx(project.id, { idioma: 'es', suffix: '_ES', ...lemaOptions.es });
              const res2 = await window.api.exportToDocx(project.id, { idioma: 'ca', suffix: '_CA', ...lemaOptions.ca });
              lastRes = {
                isBoth: true,
                pathEs: res1.filePath,
                pathCa: res2.filePath,
                filePath: `${res1.filePath}\n${res2.filePath}`,
                warnings: [...(res1.warnings || []), ...(res2.warnings || [])]
              };
            } else if (langMode === 'secundario') {
              const secLang = project.idioma_principal === 'es' ? 'ca' : 'es';
              const res = await window.api.exportToDocx(project.id, { idioma: secLang, suffix: `_${secLang.toUpperCase()}`, ...lemaOptions[secLang] });
              lastRes = { isBoth: false, filePath: res.filePath, warnings: res.warnings || [] };
            } else {
              const primLang = project.idioma_principal || 'es';
              const res = await window.api.exportToDocx(project.id, { idioma: primLang, suffix: `_${primLang.toUpperCase()}`, ...lemaOptions[primLang] });
              lastRes = { isBoth: false, filePath: res.filePath, warnings: res.warnings || [] };
            }
          } else {
            // PDF o Ambos (Word + PDF)
            if (langMode === 'ambos') {
              const res1 = await window.api.exportToPdf(project.id, { idioma: 'es', suffix: '_ES', ...lemaOptions.es });
              const res2 = await window.api.exportToPdf(project.id, { idioma: 'ca', suffix: '_CA', ...lemaOptions.ca });
              lastRes = {
                isBoth: true,
                pathEs: res1.docxPath,
                pathCa: res2.docxPath,
                pathPdfEs: res1.pdfPath,
                pathPdfCa: res2.pdfPath,
                filePath: `${res1.docxPath}\n${res2.docxPath}`,
                pdfPath: `${res1.pdfPath || ''}\n${res2.pdfPath || ''}`.trim(),
                warnings: [...(res1.warnings || []), ...(res2.warnings || [])],
                converters: res1.converters
              };
            } else if (langMode === 'secundario') {
              const secLang = project.idioma_principal === 'es' ? 'ca' : 'es';
              const res = await window.api.exportToPdf(project.id, { idioma: secLang, suffix: `_${secLang.toUpperCase()}`, ...lemaOptions[secLang] });
              lastRes = {
                isBoth: false,
                filePath: res.docxPath,
                pdfPath: res.pdfPath,
                warnings: res.warnings || [],
                converters: res.converters
              };
            } else {
              const primLang = project.idioma_principal || 'es';
              const res = await window.api.exportToPdf(project.id, { idioma: primLang, suffix: `_${primLang.toUpperCase()}`, ...lemaOptions[primLang] });
              lastRes = {
                isBoth: false,
                filePath: res.docxPath,
                pdfPath: res.pdfPath,
                warnings: res.warnings || [],
                converters: res.converters
              };
            }

            if (!lastRes.pdfPath && lastRes.converters && !lastRes.converters.canConvert) {
              alert(
                window.i18n.getLang() === 'ca'
                  ? 'S\'ha generat el document mestre Word (.docx) correctament, però per a la conversió automàtica a PDF es requereix Microsoft Word o LibreOffice instal·lat a l\'equip.'
                  : 'Se ha generado el documento maestro Word (.docx) correctamente, pero para la conversión automática a PDF se requiere Microsoft Word o LibreOffice instalado en el equipo.'
              );
            }
          }

          this.lastExportResult = lastRes;
          await this.render(container, project);

          if (openAfter) {
            if (exportFormat === 'pdf' && lastRes.pdfPath) {
              await openDocFile(lastRes.pathPdfCa || lastRes.pathPdfEs || lastRes.pdfPath);
            } else if (lastRes.isBoth) {
              await openDocFile(lastRes.pathCa || lastRes.pathEs);
            } else if (lastRes.filePath) {
              await openDocFile(lastRes.filePath);
            }
          }
        } catch (err) {
          console.error('Error in export:', err);
          alert('Error al exportar documento:\n' + err.message);
          btnExport.disabled = false;
          btnExport.textContent = window.i18n.t('review.btn_export');
        }
      });
    }

    // Success action buttons
    const btnOpenNow = container.querySelector('#btn-open-doc-now');
    if (btnOpenNow && this.lastExportResult?.filePath) {
      btnOpenNow.addEventListener('click', async () => {
        await openDocFile(this.lastExportResult.filePath);
      });
    }

    const btnOpenPdfNow = container.querySelector('#btn-open-pdf-now');
    if (btnOpenPdfNow && this.lastExportResult?.pdfPath) {
      btnOpenPdfNow.addEventListener('click', async () => {
        await openDocFile(this.lastExportResult.pdfPath);
      });
    }

    const btnOpenEs = container.querySelector('#btn-open-doc-es');
    if (btnOpenEs && this.lastExportResult?.pathEs) {
      btnOpenEs.addEventListener('click', async () => {
        await openDocFile(this.lastExportResult.pathEs);
      });
    }

    const btnOpenPdfEs = container.querySelector('#btn-open-pdf-es');
    if (btnOpenPdfEs && this.lastExportResult?.pathPdfEs) {
      btnOpenPdfEs.addEventListener('click', async () => {
        await openDocFile(this.lastExportResult.pathPdfEs);
      });
    }

    const btnOpenCa = container.querySelector('#btn-open-doc-ca');
    if (btnOpenCa && this.lastExportResult?.pathCa) {
      btnOpenCa.addEventListener('click', async () => {
        await openDocFile(this.lastExportResult.pathCa);
      });
    }

    const btnOpenPdfCa = container.querySelector('#btn-open-pdf-ca');
    if (btnOpenPdfCa && this.lastExportResult?.pathPdfCa) {
      btnOpenPdfCa.addEventListener('click', async () => {
        await openDocFile(this.lastExportResult.pathPdfCa);
      });
    }

    const btnShowFolder = container.querySelector('#btn-show-folder-now');
    if (btnShowFolder) {
      btnShowFolder.addEventListener('click', async () => {
        const targetPath = this.lastExportResult?.pathPdfEs || this.lastExportResult?.pathEs || this.lastExportResult?.pathCa || this.lastExportResult?.pdfPath || this.lastExportResult?.filePath;
        if (targetPath) {
          await window.api.showItemInFolder(targetPath.split('\n')[0].trim());
        }
      });
    }
  },

  /**
   * Revisa secuencialmente todas las medidas en estado 'en_duda' a lo largo de las áreas
   */
  openDoubtReviewModal(project) {
    // Collect all measures in doubt
    const doubtList = [];
    for (const a of project.areas || []) {
      for (const m of a.medidas || []) {
        if (m.decision && m.decision.estado === 'en_duda') {
          doubtList.push({
            ...m,
            areaNombre: a.nombre,
            areaId: a.id
          });
        }
      }
    }

    if (doubtList.length === 0) {
      const isCa = window.i18n && window.i18n.getLang() === 'ca';
      alert(isCa ? 'No hi ha cap mesura en dubte pendent de revisar.' : 'No hay ninguna medida en duda pendiente de revisar.');
      return;
    }

    this.renderDoubtModalStep(project, doubtList, 0);
  },

  renderDoubtModalStep(project, doubtList, index) {
    const modalContainer = document.querySelector('#modal-container');
    if (!modalContainer) return;

    if (doubtList.length === 0 || index >= doubtList.length) {
      // All resolved!
      const isCa = window.i18n && window.i18n.getLang() === 'ca';
      modalContainer.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-dialog" style="max-width: 500px; text-align: center; padding: 32px;">
            <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
            <h2 class="section-title" style="font-size: 20px; color: var(--action-primary); margin-bottom: 8px;">
              ${window.i18n.t('doubt_modal.all_resolved')}
            </h2>
            <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">
              ${isCa
                ? 'Totes les propostes que estaven marcades en dubte han estat revisades i assignades.'
                : 'Todas las propuestas que estaban marcadas en duda han sido revisadas y asignadas.'}
            </p>
            <button class="btn primary large" id="btn-close-doubt-all-done">
              ${isCa ? 'Tornar a Revisar i exportar' : 'Volver a Revisar y exportar'}
            </button>
          </div>
        </div>
      `;
      modalContainer.style.display = 'flex';
      modalContainer.querySelector('#btn-close-doubt-all-done').addEventListener('click', async () => {
        modalContainer.style.display = 'none';
        modalContainer.innerHTML = '';
        await App.refreshCurrentProject();
        ReviewExportView.render(document.querySelector('#view-container'), App.currentProject);
      });
      return;
    }

    const currentItem = doubtList[index];
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const isFirst = index === 0;
    const isLast = index === doubtList.length - 1;

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 680px; padding: 24px;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-divider); padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <div style="font-size: 12px; font-weight: 700; color: #b45309; text-transform: uppercase;">
                ${window.i18n.t('doubt_modal.counter', { current: index + 1, total: doubtList.length })}
              </div>
              <h2 class="section-title" style="font-size: 19px; margin-top: 2px;">
                ${window.i18n.t('doubt_modal.title')}
              </h2>
            </div>
            <button class="btn link" id="btn-doubt-close-x" style="font-size: 20px;">✕</button>
          </div>

          <!-- Body -->
          <div style="max-height: 60vh; overflow-y: auto; padding-right: 4px;">
            <div style="font-size: 13px; color: var(--action-link); font-weight: 600; margin-bottom: 6px;">
              ${escapeHtml(currentItem.areaNombre)}
            </div>

            <div style="background: var(--surface-muted); border: 1px solid var(--border-subtle); border-radius: var(--radius-default); padding: 14px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span class="kbd" style="font-size: 12px;">${escapeHtml(currentItem.codigo || '')}</span>
                <b style="font-size: 15px;">${escapeHtml(currentItem.titulo || '(Sense títol / Sin título)')}</b>
              </div>
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-primary);">
                ${escapeHtml(currentItem.texto || '')}
              </p>
            </div>

            <!-- Motivo de duda o nota interna -->
            ${(currentItem.motivo_duda || currentItem.decision?.nota_interna) ? `
              <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-default); padding: 12px 14px; margin-bottom: 16px;">
                <b style="font-size: 13px; color: #92400e;">${window.i18n.t('doubt_modal.reason_label')}</b>
                <div style="font-size: 13px; color: #78350f; margin-top: 4px;">
                  ${escapeHtml(currentItem.motivo_duda || currentItem.decision?.nota_interna || '')}
                </div>
              </div>
            ` : ''}

            <!-- Campo editable de versión municipal para rápida adaptación -->
            <div class="form-group">
              <label class="form-label" for="doubt-edit-texto">${window.i18n.t('doubt_modal.municipal_label')}</label>
              <textarea class="textarea" id="doubt-edit-texto" style="min-height: 100px; font-size: 14px;">${escapeHtml(currentItem.decision?.version_municipal_texto || currentItem.texto || '')}</textarea>
            </div>
          </div>

          <!-- Footer con acciones directas -->
          <div style="border-top: 1px solid var(--border-divider); padding-top: 16px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 6px;">
              <button class="btn small" id="btn-doubt-prev" ${isFirst ? 'disabled' : ''}>${window.i18n.t('doubt_modal.btn_prev')}</button>
              <button class="btn small" id="btn-doubt-next" ${isLast ? 'disabled' : ''}>${window.i18n.t('doubt_modal.btn_next')}</button>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn small primary" id="btn-doubt-action-include" style="background: #10B981; border-color: #059669;">
                ${window.i18n.t('doubt_modal.btn_include')}
              </button>
              <button class="btn small primary" id="btn-doubt-action-adapt">
                ${window.i18n.t('doubt_modal.btn_adapt')}
              </button>
              <button class="btn small" id="btn-doubt-action-discard">
                ${isCa ? 'Deixar sense revisar' : 'Dejar sin revisar'}
              </button>
              <button class="btn small" id="btn-doubt-action-keep">
                ${window.i18n.t('doubt_modal.btn_keep')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'flex';

    const closeModal = async () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
      await App.refreshCurrentProject();
      ReviewExportView.render(document.querySelector('#view-container'), App.currentProject);
    };

    modalContainer.querySelector('#btn-doubt-close-x').addEventListener('click', closeModal);

    const btnPrev = modalContainer.querySelector('#btn-doubt-prev');
    if (btnPrev && !isFirst) {
      btnPrev.addEventListener('click', () => {
        this.renderDoubtModalStep(project, doubtList, index - 1);
      });
    }

    const btnNext = modalContainer.querySelector('#btn-doubt-next');
    if (btnNext && !isLast) {
      btnNext.addEventListener('click', () => {
        this.renderDoubtModalStep(project, doubtList, index + 1);
      });
    }

    // Action: Incluir
    modalContainer.querySelector('#btn-doubt-action-include').addEventListener('click', async () => {
      await window.api.updateMeasureDecision(project.id, currentItem.id, { estado: 'incluida' });
      doubtList.splice(index, 1);
      const nextIdx = Math.min(index, doubtList.length - 1);
      this.renderDoubtModalStep(project, doubtList, nextIdx);
    });

    // Action: Adaptar
    modalContainer.querySelector('#btn-doubt-action-adapt').addEventListener('click', async () => {
      const textVal = modalContainer.querySelector('#doubt-edit-texto').value;
      await window.api.updateMeasureDecision(project.id, currentItem.id, {
        estado: 'adaptada',
        version_municipal_texto: textVal
      });
      doubtList.splice(index, 1);
      const nextIdx = Math.min(index, doubtList.length - 1);
      this.renderDoubtModalStep(project, doubtList, nextIdx);
    });

    // Action: Dejar sin revisar (fuera del programa)
    modalContainer.querySelector('#btn-doubt-action-discard').addEventListener('click', async () => {
      await window.api.updateMeasureDecision(project.id, currentItem.id, { estado: 'sin_revisar' });
      doubtList.splice(index, 1);
      const nextIdx = Math.min(index, doubtList.length - 1);
      this.renderDoubtModalStep(project, doubtList, nextIdx);
    });

    // Action: Mantener en duda
    modalContainer.querySelector('#btn-doubt-action-keep').addEventListener('click', () => {
      if (index + 1 < doubtList.length) {
        this.renderDoubtModalStep(project, doubtList, index + 1);
      } else {
        closeModal();
      }
    });
  },

  promptPendingCatalanTextsModal(project, pendingItems) {
    return new Promise((resolve) => {
      const modalContainer = document.querySelector('#modal-container');
      if (!modalContainer) {
        resolve('omit');
        return;
      }
      const isCa = window.i18n && window.i18n.getLang() === 'ca';
      const itemsListHtml = pendingItems.map(it => `<li>${escapeHtml(it.label)}</li>`).join('');

      modalContainer.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-dialog" style="max-width: 600px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-divider); padding-bottom: 12px; margin-bottom: 16px;">
              <h2 class="section-title" style="font-size: 18px; margin: 0; color: #b45309; display: flex; align-items: center; gap: 8px;">
                ⚠️ ${isCa ? 'Textos pendents de traducció al català' : 'Textos pendientes de traducción al catalán'}
              </h2>
              <button class="btn link" id="btn-pending-modal-x" style="font-size: 20px;">✕</button>
            </div>
            <div style="font-size: 13.5px; line-height: 1.5; margin-bottom: 16px;">
              <p style="margin-top: 0;">
                ${isCa
                  ? `S'han detectat <b>${pendingItems.length} textos generals</b> redactats en castellà que no tenen versió en català:`
                  : `Se han detectado <b>${pendingItems.length} textos generales</b> redactados en castellano que no tienen versión en catalán:`}
              </p>
              <ul style="max-height: 140px; overflow-y: auto; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px 8px 28px; margin: 10px 0; font-size: 13px;">
                ${itemsListHtml}
              </ul>
              <p style="margin-bottom: 0; color: var(--text-secondary); font-size: 13px;">
                ${isCa
                  ? 'Per garantir la puresa lingüística, el document en català <b>no inclourà mai textos en castellà</b>. Si continues sense traduir-los, aquestes seccions s\'ometran del document català.'
                  : 'Para garantizar la pureza lingüística, el documento en catalán <b>no incluirá nunca textos en castellano</b>. Si continúas sin traducirlos, esas secciones se omitirán del documento catalán.'}
              </p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
              <button class="btn primary" id="btn-pending-modal-translate" style="background: #7c3aed; border-color: #6d28d9; padding: 10px; font-weight: 700;">
                🌐 ${isCa ? 'Traduir textos pendents ara i exportar' : 'Traducir textos pendientes ahora y exportar'}
              </button>
              <button class="btn" id="btn-pending-modal-omit" style="padding: 10px;">
                📄 ${isCa ? 'Continuar sense aquests textos' : 'Continuar sin esos textos'}
              </button>
              <button class="btn link" id="btn-pending-modal-cancel" style="color: var(--text-secondary); padding: 6px;">
                ${isCa ? 'Cancel·lar exportació' : 'Cancelar exportación'}
              </button>
            </div>
          </div>
        </div>
      `;
      modalContainer.style.display = 'flex';

      const cleanup = (result) => {
        modalContainer.style.display = 'none';
        modalContainer.innerHTML = '';
        resolve(result);
      };

      modalContainer.querySelector('#btn-pending-modal-x')?.addEventListener('click', () => cleanup('cancel'));
      modalContainer.querySelector('#btn-pending-modal-cancel')?.addEventListener('click', () => cleanup('cancel'));
      modalContainer.querySelector('#btn-pending-modal-omit')?.addEventListener('click', () => cleanup('omit'));
      modalContainer.querySelector('#btn-pending-modal-translate')?.addEventListener('click', () => cleanup('translate'));
    });
  },

  detectUntitledSelectedMeasures(project) {
    if (!this.skippedUntitledIds) this.skippedUntitledIds = new Set();
    const isCa = (project.idioma_principal === 'ca');
    const result = [];

    (project.areas || []).forEach(area => {
      const areaNombre = isCa ? (area.nombre_ca || area.nombre) : (area.nombre_es || area.nombre);

      // 1. Medidas del catálogo marco
      (area.medidas || []).forEach(m => {
        const est = m.decision?.estado;
        if (est === 'incluida' || est === 'adaptada') {
          if (this.skippedUntitledIds.has(m.id)) return;

          const customTitle = (m.decision?.version_municipal_titulo && m.decision.version_municipal_titulo.trim()) || '';
          const marcoTitle = (m.titulo && m.titulo.trim()) || '';
          const activeTitle = customTitle || marcoTitle;

          // Sin título si es nulo, vacío, solo espacios o número/etiqueta genérica
          if (!activeTitle || /^(?:medida\s*)?\d+[\.\)]?$/i.test(activeTitle)) {
            result.push({
              id: m.id,
              is_propia: false,
              areaId: area.id,
              areaNombre,
              measure: m,
              decision: m.decision
            });
          }
        }
      });

      // 2. Medidas propias municipales
      (area.medidas_propias || []).forEach(p => {
        const isSelected = p.estado === 'incluida' || p.estado === 'adaptada' || (!p.estado && p.estado !== 'sin_revisar' && p.estado !== 'en_duda');
        if (isSelected) {
          if (this.skippedUntitledIds.has(p.id)) return;

          const ownTitle = (p.titulo && p.titulo.trim()) || '';
          if (!ownTitle || /^(?:medida\s*)?\d+[\.\)]?$/i.test(ownTitle)) {
            result.push({
              id: p.id,
              is_propia: true,
              areaId: area.id,
              areaNombre,
              measure: p,
              decision: { estado: p.estado || 'incluida' }
            });
          }
        }
      });
    });

    return result;
  },

  promptMissingTitlesAlert(project, untitledMeasures) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const modalContainer = document.querySelector('#modal-container') || document.body;
    const count = untitledMeasures.length;

    return new Promise(resolve => {
      const modalHtml = `
        <div class="modal-overlay" id="alert-missing-titles-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
          <div class="modal-dialog" style="max-width: 540px; background: white; border-radius: 12px; padding: 26px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
            <div style="display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px;">
              <span style="font-size: 32px; line-height: 1;">⚠️</span>
              <div>
                <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 6px; color: #1e1b4b;">
                  ${isCa ? `Hi ha ${count} mesures del programa sense títol` : `Hay ${count} medidas del programa sin título`}
                </h2>
                <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                  ${isCa
                    ? 'Pots generar propostes de títol amb Intel·ligència Artificial i revisar-les abans de continuar.'
                    : 'Puedes generar propuestas de título con Inteligencia Artificial y revisarlas antes de continuar.'}
                </p>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
              <button class="btn primary large" id="btn-alert-suggest-titles" style="background: #7c3aed; border-color: #6d28d9; justify-content: center; font-size: 14.5px; font-weight: 700; padding: 12px 18px;">
                ✨ ${isCa ? 'Suggerir títols amb IA' : 'Sugerir títulos con IA'}
              </button>
              <button class="btn large" id="btn-alert-continue-without" style="justify-content: center; font-size: 14px; padding: 10px 18px;">
                ${isCa ? 'Continuar sense títols' : 'Continuar sin títulos'}
              </button>
              <button class="btn link" id="btn-alert-cancel" style="justify-content: center; font-size: 13px; color: var(--text-muted); padding: 6px;">
                ${isCa ? 'Cancel·lar' : 'Cancelar'}
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

      const close = (action) => {
        overlay.remove();
        if (modalContainer.children.length === 0) modalContainer.style.display = 'none';
        resolve(action);
      };

      overlay.querySelector('#btn-alert-suggest-titles').addEventListener('click', () => close('suggest'));
      overlay.querySelector('#btn-alert-continue-without').addEventListener('click', () => close('continue_without'));
      overlay.querySelector('#btn-alert-cancel').addEventListener('click', () => close('cancel'));
    });
  },

  openTitleReviewWizard(project, untitledMeasures) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    const modalContainer = document.querySelector('#modal-container') || document.body;
    const totalCount = untitledMeasures.length;

    let currentIndex = 0;
    let titlesAddedCount = 0;
    let titlesSkippedCount = 0;

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'title-review-wizard-overlay';
      overlay.style.cssText = 'z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);';

      const dialog = document.createElement('div');
      dialog.className = 'modal-dialog';
      dialog.style.cssText = 'max-width: 660px; width: 100%; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;';
      overlay.appendChild(dialog);

      modalContainer.appendChild(overlay);
      modalContainer.style.display = 'block';

      const closeWizard = (proceedWithExport) => {
        overlay.remove();
        if (modalContainer.children.length === 0) modalContainer.style.display = 'none';
        resolve(proceedWithExport);
      };

      const renderStep = async (idx) => {
        const item = untitledMeasures[idx];
        const m = item.measure;
        const bodyText = (m.decision?.version_municipal_texto && m.decision.version_municipal_texto.trim())
          || m.texto
          || m.explicacion
          || '';

        dialog.innerHTML = `
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 1px solid var(--border-divider); margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 13.5px; font-weight: 700; color: #581c87; background: #f5f3ff; border: 1px solid #ddd6fe; padding: 3px 10px; border-radius: 6px;">
                ${isCa ? 'Mesura' : 'Medida'} ${idx + 1} ${isCa ? 'de' : 'de'} ${totalCount}
              </span>
              <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600;">
                ${escapeHtml(item.areaNombre)}
              </span>
            </div>
            <button class="btn small link" id="btn-wizard-close-x" style="font-size: 18px; line-height: 1;">✕</button>
          </div>

          <!-- Body -->
          <div style="flex: 1; overflow-y: auto; padding-right: 4px; margin-bottom: 16px;">
            <!-- Título sugerido por IA -->
            <div style="margin-bottom: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label for="wizard-title-input" style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #6b21a8;">
                  ${isCa ? 'Títol suggerit per IA' : 'Título sugerido por IA'}
                </label>
                <div id="wizard-ai-status" style="font-size: 12px; font-weight: 600; color: #6b21a8;">
                  ⏳ ${isCa ? 'Generant títol amb IA local…' : 'Generando título con IA local…'}
                </div>
              </div>
              <input type="text" id="wizard-title-input" class="input" style="width: 100%; font-size: 15px; font-weight: 700; padding: 10px 12px; border: 1.5px solid #cbd5e1; border-radius: 6px;" value="" placeholder="${isCa ? 'Escriu o edita el títol…' : 'Escribe o edita el título…'}" />
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                ${isCa ? 'Pots editar el títol directament en aquest camp abans d\'acceptar.' : 'Puedes editar el título directamente en este campo antes de aceptar.'}
              </div>
            </div>

            <!-- Texto de la propuesta (modo lectura) -->
            <div>
              <label style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 6px; display: block;">
                ${isCa ? 'Text de la proposta (mode lectura)' : 'Texto de la propuesta (modo lectura)'}
              </label>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); max-height: 190px; overflow-y: auto;">
                ${escapeHtml(bodyText)}
              </div>
            </div>
          </div>

          <!-- Footer con acciones -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid var(--border-divider); flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn link" id="btn-wizard-cancel" style="color: #64748b; font-size: 13px;">
                ${isCa ? 'Cancel·lar revisió' : 'Cancelar revisión'}
              </button>
              <button class="btn small" id="btn-wizard-skip">
                ${isCa ? 'Deixar sense títol' : 'Dejar sin título'}
              </button>
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn small" id="btn-wizard-regenerate" style="color: #6b21a8; border-color: #d8b4fe;">
                🔄 ${isCa ? 'Regenerar' : 'Regenerar'}
              </button>
              <button class="btn small primary" id="btn-wizard-accept" style="background: #10b981; border-color: #059669; font-weight: 700; padding: 7px 16px;">
                ✓ ${isCa ? 'Acceptar títol' : 'Aceptar título'}
              </button>
            </div>
          </div>
        `;

        const titleInput = dialog.querySelector('#wizard-title-input');
        const statusEl = dialog.querySelector('#wizard-ai-status');
        const btnRegenerate = dialog.querySelector('#btn-wizard-regenerate');
        const btnAccept = dialog.querySelector('#btn-wizard-accept');
        const btnSkip = dialog.querySelector('#btn-wizard-skip');
        const btnCancel = dialog.querySelector('#btn-wizard-cancel');
        const btnCloseX = dialog.querySelector('#btn-wizard-close-x');

        const fetchTitle = async () => {
          if (btnRegenerate) btnRegenerate.disabled = true;
          if (statusEl) statusEl.innerHTML = `⏳ ${isCa ? 'Generant títol amb IA local…' : 'Generando título con IA local…'}`;

          try {
            const res = await (window.GenerationApi || window.api).aiSuggestTitles({
              texto: bodyText,
              tituloActual: '',
              municipio: project.municipio || '',
              idioma: project.idioma_principal || 'es'
            });

            const titulos = (Array.isArray(res?.data?.titulos) && res.data.titulos.length > 0)
              ? res.data.titulos
              : (Array.isArray(res?.titulos) && res.titulos.length > 0)
                ? res.titulos
                : [];

            if (titulos.length > 0 && titulos[0].trim()) {
              titleInput.value = titulos[0].trim();
              window.GenerationUi?.markResult(res,titleInput);
              if (statusEl) statusEl.innerHTML = `💡 ${isCa ? 'Proposta IA generada' : 'Propuesta IA generada'}`;
            } else {
              if (statusEl) statusEl.innerHTML = `⚠️ ${isCa ? 'No s\'ha pogut generar títol automàtic' : 'No se ha podido generar título automático'}`;
            }
          } catch (err) {
            if (statusEl) statusEl.innerHTML = `⚠️ ${isCa ? 'Error de generació' : 'Error de generación'}`;
          } finally {
            if (btnRegenerate) btnRegenerate.disabled = false;
          }
        };

        fetchTitle();

        // 1. Aceptar título
        btnAccept.addEventListener('click', async () => {
          const val = (titleInput.value || '').trim();
          if (val) {
            btnAccept.disabled = true;
            App.notifySaving();
            if (item.is_propia) {
              await window.api.updateOwnMeasure(item.id, { titulo: val });
            } else {
              await window.api.updateMeasureDecision(project.id, item.id, { version_municipal_titulo: val });
            }
            await App.refreshCurrentProject();
            project = App.currentProject;
            App.notifySaved();
            titlesAddedCount++;
          } else {
            this.skippedUntitledIds.add(item.id);
            titlesSkippedCount++;
          }

          currentIndex++;
          if (currentIndex < totalCount) {
            renderStep(currentIndex);
          } else {
            showCompletionAndProceed();
          }
        });

        // 2. Dejar sin título
        btnSkip.addEventListener('click', () => {
          this.skippedUntitledIds.add(item.id);
          titlesSkippedCount++;
          currentIndex++;
          if (currentIndex < totalCount) {
            renderStep(currentIndex);
          } else {
            showCompletionAndProceed();
          }
        });

        // 3. Regenerar
        btnRegenerate.addEventListener('click', () => {
          fetchTitle();
        });

        // 4. Cancelar revisión
        const handleCancel = () => {
          dialog.innerHTML = `
            <div style="padding: 24px; text-align: center;">
              <div style="font-size: 28px; margin-bottom: 10px;">⏸️</div>
              <h3 style="font-size: 17.5px; font-weight: 800; margin: 0 0 8px; color: #1e1b4b;">
                ${isCa ? 'Vols continuar amb la generació de documents?' : '¿Quieres continuar con la generación de documentos?'}
              </h3>
              <p style="font-size: 13.5px; color: var(--text-secondary); margin: 0 0 20px;">
                ${isCa
                  ? `S'han desat correctament <b>${titlesAddedCount}</b> títols. Les mesures restants romandran sense títol.`
                  : `Se han guardado correctamente <b>${titlesAddedCount}</b> títulos. Las medidas restantes permanecerán sin título.`}
              </p>
              <div style="display: flex; justify-content: center; gap: 12px;">
                <button class="btn" id="btn-cancel-return">
                  ${isCa ? 'Tornar a la pantalla' : 'Volver a la pantalla'}
                </button>
                <button class="btn primary" id="btn-cancel-continue-export" style="background: var(--action-primary);">
                  ${isCa ? 'Continuar amb exportació' : 'Continuar con exportación'}
                </button>
              </div>
            </div>
          `;

          dialog.querySelector('#btn-cancel-return').addEventListener('click', () => {
            closeWizard(false);
          });
          dialog.querySelector('#btn-cancel-continue-export').addEventListener('click', () => {
            for (let i = currentIndex; i < totalCount; i++) {
              this.skippedUntitledIds.add(untitledMeasures[i].id);
            }
            closeWizard(true);
          });
        };

        btnCancel.addEventListener('click', handleCancel);
        btnCloseX.addEventListener('click', handleCancel);
      };

      const showCompletionAndProceed = () => {
        dialog.innerHTML = `
          <div style="padding: 28px 20px; text-align: center;">
            <div style="font-size: 34px; margin-bottom: 10px;">✅</div>
            <h3 style="font-size: 18px; font-weight: 800; margin: 0 0 8px; color: #166534;">
              ${isCa ? 'Revisió de títols completada' : 'Revisión de títulos completada'}
            </h3>
            <p style="font-size: 14px; color: var(--text-secondary); margin: 0 0 16px;">
              ${isCa
                ? `<b>${titlesAddedCount}</b> títols afegits · <b>${titlesSkippedCount}</b> mesures es mantenen sense títol.`
                : `<b>${titlesAddedCount}</b> títulos añadidos · <b>${titlesSkippedCount}</b> medidas se mantienen sin título.`}
            </p>
            <div style="font-size: 13px; color: #6b21a8; font-weight: 600;">
              ${isCa ? 'Continuant automàticament amb la generació del document…' : 'Continuando automáticamente con la generación del documento…'}
            </div>
          </div>
        `;

        setTimeout(() => {
          closeWizard(true);
        }, 1200);
      };

      renderStep(0);
    });
  }
};

window.ReviewExportView = ReviewExportView;
