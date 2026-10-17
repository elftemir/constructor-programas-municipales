/**
 * sourceProgramsView.js - Gestor de Programas Fuente (Fase 3.1)
 * Permite gestionar múltiples programas fuente (Marco oficial, DOCX, PDF, etc.)
 */

const SourceProgramsView = {
  sources: [],
  showArchived: false,

  async render(container) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;
    this.sources = await window.api.getSourcePrograms(true);
    const contentStatus = await window.api.getContentUpdateStatus?.();

    const filteredSources = this.showArchived
      ? this.sources
      : this.sources.filter(s => !s.archivado);

    const activeSource = this.sources.find(s => s.activo) || this.sources[0];

    container.innerHTML = `
      <div class="view-header" style="margin-bottom: 24px;">
        <div class="view-header-left">
          <div class="label" style="color: #7c3aed; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11.5px;">
            ${isCa ? 'Gestió de fonts' : 'Gestión de fuentes'}
          </div>
          <h1 class="title" style="font-size: 26px; font-weight: 800; margin: 4px 0 8px; color: #1e1b4b;">
            📚 ${isCa ? 'Programes font' : 'Programas fuente'}
          </h1>
          <p class="subtitle" style="font-size: 14px; color: var(--text-secondary); margin: 0; max-width: 760px; line-height: 1.5;">
            ${isCa
              ? 'Gestiona els documents polítics de referència (programa marc, autonòmic, estatal o municipal anterior). Els nous projectes utilitzaran la font activa seleccionada.'
              : 'Gestiona los documentos políticos de referencia (programa marco, autonómico, estatal o municipal anterior). Los nuevos proyectos utilizarán la fuente activa seleccionada.'}
          </p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 12px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <button class="btn primary" id="btn-import-new-source" style="background: #7c3aed; border-color: #6d28d9; font-weight: 700; padding: 9px 18px; display: flex; align-items: center; gap: 8px;">
            <span>➕</span> ${isCa ? 'Importar programa font' : 'Importar programa fuente'}
          </button>
        </div>
      </div>

      <!-- Barra de estado y filtros -->
      <div style="background: white; border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">
            ${isCa ? 'Font activa per a nous projectes:' : 'Fuente activa para nuevos proyectos:'}
          </span>
          <span class="badge" style="background: ${activeSource ? '#ecfdf5' : '#fef3c7'}; color: ${activeSource ? '#047857' : '#92400e'}; font-weight: 700; border: 1px solid ${activeSource ? '#a7f3d0' : '#fde68a'}; padding: 4px 10px; font-size: 13px;">
            ${activeSource ? '⭐ ' + escapeHtml(activeSource.nombre) : (isCa ? 'Cap font activa' : 'Ninguna fuente activa')}
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); cursor: pointer;">
            <input type="checkbox" id="chk-show-archived" ${this.showArchived ? 'checked' : ''} style="cursor: pointer;" />
            ${isCa ? 'Mostrar programes arxivats' : 'Mostrar programas archivados'}
          </label>
        </div>
      </div>

      <!-- Listado de fuentes o Estado Vacío -->
      ${filteredSources.length === 0 ? `
        <div class="empty-state-box" style="background: white; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 48px 24px; text-align: center; margin-top: 10px;">
          <div style="font-size: 42px; margin-bottom: 12px;">📚</div>
          <h2 style="font-size: 18px; font-weight: 800; color: #1e1b4b; margin: 0 0 8px;">
            ${window.i18n.t('clean_start.no_official')}
          </h2>
          <p style="font-size: 14px; color: var(--text-secondary); max-width: 540px; margin: 0 auto 20px; line-height: 1.5;">
            ${isCa
              ? 'L’aplicació no inclou continguts polítics per defecte. Pots buscar actualitzacions de continguts oficials o importar un document propi (PDF o DOCX).'
              : 'La aplicación no incluye contenidos políticos por defecto. Puedes buscar actualizaciones de contenidos oficiales o importar un documento propio (PDF o DOCX).'}
          </p>
          <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <button class="btn primary" id="btn-empty-check-content" style="background: #0284c7; border-color: #0369a1; font-weight: 700;">
              <span>🌐</span> ${isCa ? 'Cercar continguts oficials' : 'Buscar contenidos oficiales'}
            </button>
            <button class="btn" id="btn-empty-import-source" style="font-weight: 700;">
              <span>➕</span> ${isCa ? 'Importar programa font' : 'Importar programa fuente'}
            </button>
          </div>
        </div>
      ` : `
        <div class="sources-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px;">
          ${filteredSources.map(s => this.renderSourceCard(s, isCa)).join('')}
        </div>
      `}
    `;

    if (contentStatus?.testContentEnabled === true) container.innerHTML += `
      <div class="card" style="padding:16px;margin-top:20px;">
        <label><input type="checkbox" id="chk-show-test-content"> ${window.i18n.t('clean_start.show_tests')}</label>
        <div id="test-content-list" style="margin-top:12px;" aria-live="polite"></div>
      </div>`;
    container.querySelector('#chk-show-test-content')?.addEventListener('change', async event => {
      const list = container.querySelector('#test-content-list');
      list.innerHTML = '';
      if (!event.target.checked) return;
      const items = await window.api.getTestContentItems();
      if (!event.target.checked) return;
      list.innerHTML = items.length ? items.map((item,index) => {
        const title = typeof item.title === 'object' ? (isCa ? item.title.ca : item.title.es) : item.title;
        return `<div style="padding:12px;border:1px solid #f59e0b;margin-top:8px;">
          <b>${window.i18n.t('clean_start.test_label')}</b> · ${escapeHtml(title)}
          <button class="btn small" data-test-content-index="${index}" ${item.compatible_with_app === false ? 'disabled' : ''}>${window.i18n.t('clean_start.view_test')}</button>
        </div>`;
      }).join('') : window.i18n.t('clean_start.no_tests');
      list.querySelectorAll('[data-test-content-index]').forEach(button => button.addEventListener('click', () => {
        App.showContentUpdateDetailModal(items[Number(button.dataset.testContentIndex)], { allowTestFixture: true });
      }));
    });
    this.bindEvents(container);
  },

  renderSourceCard(source, isCa) {
    const isDefault = source.official && source.oficial_actual_protegido;
    const esAvail = Boolean(source.idiomas?.es?.disponible);
    const caAvail = Boolean(source.idiomas?.ca?.disponible);
    const isProtected = Boolean(source.isProtected);
    const isOfficial = Boolean(source.official);
    const isCurrentOfficial = isOfficial && isProtected;
    const isPreviousOfficial = isOfficial && !isProtected;

    return `
      <div class="card source-card" data-id="${source.id}" style="padding: 20px; border-radius: 12px; border: 1.5px solid ${source.activo ? '#7c3aed' : 'var(--border-subtle)'}; background: white; display: flex; flex-direction: column; justify-content: space-between; box-shadow: ${source.activo ? '0 4px 14px rgba(124, 58, 237, 0.1)' : 'none'}; position: relative;">
        <div>
          <!-- Cabecera de la tarjeta -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 10px;">
            <div>
              <h2 style="font-size: 17px; font-weight: 800; margin: 0 0 4px; color: #1e1b4b; display: flex; align-items: center; gap: 8px;">
                ${escapeHtml(source.nombre)}
              </h2>
              <div style="font-size: 12px; color: var(--text-muted);">
                ${source.tipo === 'marco_oficial' ? (isOfficial ? (isCa ? 'Catàleg marc oficial' : 'Catálogo marco oficial') : window.i18n.t('clean_start.test_label')) : (source.tipo?.toUpperCase() || 'DOCUMENTO')}
                ${source.origen_archivo ? ` · ${escapeHtml(source.origen_archivo)}` : ''}
              </div>
            </div>

            <div style="display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap;">
              ${source.activo ? `
                <span class="badge" style="background: #7c3aed; color: white; font-weight: 700; font-size: 11px;">
                  ${isCa ? 'ACTIVA' : 'ACTIVA'}
                </span>
              ` : ''}
              ${source.archivado ? `
                <span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 600; font-size: 11px;">
                  ${isCa ? 'ARXIVADA' : 'ARCHIVADA'}
                </span>
              ` : ''}
              ${isCurrentOfficial ? `
                <span class="badge" style="background: #f0fdf4; color: #166534; font-weight: 700; font-size: 11px; border: 1px solid #bbf7d0;">
                  🔒 ${isCa ? 'OFICIAL ACTUAL' : 'OFICIAL ACTUAL'}
                </span>
              ` : ''}
              ${isPreviousOfficial ? `
                <span class="badge" style="background: #f8fafc; color: #334155; font-weight: 700; font-size: 11px; border: 1px solid #cbd5e1;">
                  ${isCa ? 'OFICIAL ANTERIOR' : 'OFICIAL ANTERIOR'}
                </span>
              ` : ''}
              ${!isOfficial ? `
                <span class="badge" style="background: #fffbeb; color: #92400e; font-weight: 700; font-size: 11px; border: 1px solid #fde68a;">
                  ${isCa ? 'NO OFICIAL' : 'NO OFICIAL'}
                </span>
              ` : ''}
            </div>
          </div>

          <!-- Métricas de la fuente -->
          <div style="display: flex; gap: 14px; margin-bottom: 14px; padding: 10px 12px; background: #f8fafc; border-radius: 8px; font-size: 12.5px;">
            <div>
              <strong style="color: #334155;">${source.total_areas || 0}</strong> ${isCa ? 'àrees' : 'áreas'}
            </div>
            <div style="color: var(--border-subtle);">|</div>
            <div>
              <strong style="color: #334155;">${source.total_medidas || 0}</strong> ${isCa ? 'mesures' : 'medidas'}
            </div>
            <div style="color: var(--border-subtle);">|</div>
            <div title="${isCa ? 'Projectes que utilitzen aquesta font' : 'Proyectos que utilizan esta fuente'}">
              <strong style="color: #7c3aed;">${source.proyectos_vinculados_count || 0}</strong> ${isCa ? 'projectes' : 'proyectos'}
            </div>
          </div>

          <!-- Estado lingüístico -->
          <div style="margin-bottom: 18px;">
            <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 6px;">
              ${isCa ? 'Idiomes disponibles' : 'Idiomas disponibles'}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <span class="badge" style="font-size: 11.5px; padding: 3px 8px; background: ${esAvail ? '#dcfce7; color: #166534;' : '#f1f5f9; color: #64748b;'}">
                ${esAvail ? (isCa ? '✓ Castellà' : '✓ Castellano') : (isCa ? 'Castellà no disponible' : 'Castellano no disponible')}
              </span>
              <span class="badge" style="font-size: 11.5px; padding: 3px 8px; background: ${caAvail ? '#dcfce7; color: #166534;' : '#f1f5f9; color: #64748b;'}">
                ${caAvail ? '✓ Català' : (isCa ? 'Català no disponible' : 'Catalán no disponible')}
              </span>
            </div>
          </div>
        </div>

        <!-- Acciones de la fuente -->
        <div style="border-top: 1px solid var(--border-divider); padding-top: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${!source.activo && !source.archivado ? `
              <button class="btn small primary btn-activate-source" data-id="${source.id}" style="background: #10b981; border-color: #059669; font-weight: 700;">
                ⭐ ${isCa ? 'Seleccionar com activa' : 'Seleccionar como activa'}
              </button>
            ` : ''}

            ${!isOfficial && !caAvail && !source.archivado ? `
              <button class="btn small btn-add-language" data-id="${source.id}" data-lang="ca" style="color: #7c3aed; border-color: #ddd6fe;">
                🌐 ${isCa ? 'Afegir versió en català' : 'Añadir versión en catalán'}
              </button>
            ` : ''}

            ${!isOfficial && !esAvail && !source.archivado ? `
              <button class="btn small btn-add-language" data-id="${source.id}" data-lang="es" style="color: #7c3aed; border-color: #ddd6fe;">
                🌐 ${isCa ? 'Afegir versió en castellà' : 'Añadir versión en castellano'}
              </button>
            ` : ''}

            ${!isOfficial?`<button class="btn small btn-rename-source" data-id="${source.id}" data-name="${escapeHtml(source.nombre)}">
              ✏️ ${isCa ? 'Reanomenar' : 'Renombrar'}
            </button>`:''}

            ${!isProtected ? `
              ${source.archivado ? `
                <button class="btn small btn-restore-source" data-id="${source.id}">
                  ↩️ ${isCa ? 'Restaurar' : 'Restaurar'}
                </button>
              ` : `
                <button class="btn small btn-archive-source" data-id="${source.id}">
                  📦 ${isCa ? 'Arxivar' : 'Archivar'}
                </button>
              `}

              ${!isOfficial?`<button class="btn small btn-delete-source" data-id="${source.id}" data-name="${escapeHtml(source.nombre)}" data-linked="${source.proyectos_vinculados_count || 0}" style="color: #dc2626;">
                🗑️ ${isCa ? 'Eliminar' : 'Eliminar'}
              </button>`:''}
            ` : `
              <span style="font-size: 12px; color: var(--text-muted); padding: 4px 8px;" title="${isCa ? 'Programa marc oficial actual protegit' : 'Programa marco oficial actual protegido'}">
                🔒 ${isCa ? 'Protegida' : 'Protegida'}
              </span>
            `}
          </div>
        </div>
      </div>
    `;
  },

  bindEvents(container) {
    const isCa = window.i18n ? window.i18n.getLang() === 'ca' : false;

    container.querySelector('#btn-help-this-screen')?.addEventListener('click', () => {
      if (window.Tutorial) window.Tutorial.startSectionTour('source_programs');
    });

    // Toggle mostrar archivados
    const chkArchived = container.querySelector('#chk-show-archived');
    if (chkArchived) {
      chkArchived.addEventListener('change', (e) => {
        this.showArchived = e.target.checked;
        this.render(container);
      });
    }

    // Importar nueva fuente
    const btnImport = container.querySelector('#btn-import-new-source');
    if (btnImport) {
      btnImport.addEventListener('click', () => {
        if (window.ImportReviewView) {
          window.ImportReviewView.openImportModal();
        }
      });
    }

    // Botones del estado vacío
    const btnEmptyCheck = container.querySelector('#btn-empty-check-content');
    if (btnEmptyCheck) {
      btnEmptyCheck.addEventListener('click', () => {
        if (window.App) {
          window.App.openContentManager();
        }
      });
    }

    const btnEmptyImport = container.querySelector('#btn-empty-import-source');
    if (btnEmptyImport) {
      btnEmptyImport.addEventListener('click', () => {
        if (window.ImportReviewView) {
          window.ImportReviewView.openImportModal();
        }
      });
    }

    // Activar fuente
    container.querySelectorAll('.btn-activate-source').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await window.api.setActiveSourceProgram(id);
          App.notifySaved();
          this.render(container);
        } catch (err) {
          alert(err.message);
        }
      });
    });

    // Renombrar fuente
    container.querySelectorAll('.btn-rename-source').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const currentName = btn.dataset.name;
        this.showRenameModal(id, currentName, isCa, container);
      });
    });

    // Archivar fuente
    container.querySelectorAll('.btn-archive-source').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await window.api.archiveSourceProgram(id, true);
          App.notifySaved();
          this.render(container);
        } catch (err) {
          alert(err.message);
        }
      });
    });

    // Restaurar fuente
    container.querySelectorAll('.btn-restore-source').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await window.api.archiveSourceProgram(id, false);
          App.notifySaved();
          this.render(container);
        } catch (err) {
          alert(err.message);
        }
      });
    });

    // Añadir segundo idioma a la fuente
    container.querySelectorAll('.btn-add-language').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const targetLang = btn.dataset.lang;
        if (window.ImportReviewView) {
          window.ImportReviewView.openAddLanguageModal(id, targetLang);
        }
      });
    });

    // Eliminar fuente (con protección estricta)
    container.querySelectorAll('.btn-delete-source').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        const linkedCount = parseInt(btn.dataset.linked, 10) || 0;
        this.showDeleteModal(id, name, linkedCount, isCa, container);
      });
    });
  },

  showRenameModal(id, currentName, isCa, container) {
    const modalContainer = document.querySelector('#modal-container') || document.body;
    modalContainer.innerHTML = `
      <div class="modal-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
        <div class="modal-dialog" style="max-width: 480px; width: 100%; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
          <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 14px; color: #1e1b4b;">
            ✏️ ${isCa ? 'Reanomenar programa font' : 'Renombrar programa fuente'}
          </h2>
          <div style="margin-bottom: 18px;">
            <label style="font-size: 13px; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 6px;">
              ${isCa ? 'Nom del programa font' : 'Nombre del programa fuente'}
            </label>
            <input type="text" id="input-rename-source" class="input" style="width: 100%; font-size: 15px; font-weight: 600; padding: 10px;" value="${escapeHtml(currentName)}" />
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn" id="btn-modal-cancel">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="btn-modal-confirm" style="background: #7c3aed; border-color: #6d28d9; font-weight: 700;">
              ${isCa ? 'Desar canvi' : 'Guardar cambio'}
            </button>
          </div>
        </div>
      </div>
    `;
    modalContainer.style.display = 'block';

    const input = modalContainer.querySelector('#input-rename-source');
    input.focus();
    input.select();

    const close = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    modalContainer.querySelector('#btn-modal-cancel').addEventListener('click', close);
    modalContainer.querySelector('#btn-modal-confirm').addEventListener('click', async () => {
      const val = (input.value || '').trim();
      if (!val) return;
      try {
        await window.api.renameSourceProgram(id, val);
        close();
        App.notifySaved();
        this.render(container);
      } catch (err) {
        alert(err.message);
      }
    });
  },

  showDeleteModal(id, name, linkedCount, isCa, container) {
    const modalContainer = document.querySelector('#modal-container') || document.body;

    if (linkedCount > 0) {
      // Advertencia estricta: NO eliminar directamente si hay proyectos vinculados
      modalContainer.innerHTML = `
        <div class="modal-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
          <div class="modal-dialog" style="max-width: 500px; width: 100%; background: white; border-radius: 12px; padding: 26px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
            <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px;">
              <span style="font-size: 30px; line-height: 1;">⚠️</span>
              <div>
                <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 6px; color: #b45309;">
                  ${isCa ? 'No es pot eliminar el programa font' : 'No se puede eliminar el programa fuente'}
                </h2>
                <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                  ${isCa
                    ? `Aquest programa font està sent utilitzat actualment per <b>${linkedCount} projecte(s)</b>. Per mantenir la integritat i evitar projectes trencats, pots arxivar la font en lloc d'eliminar-la.`
                    : `Este programa fuente está siendo utilizado actualmente por <b>${linkedCount} proyecto(s)</b>. Para mantener la integridad y evitar proyectos rotos, puedes archivar la fuente en lugar de eliminarla.`}
                </p>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button class="btn" id="btn-modal-cancel">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
              <button class="btn primary" id="btn-modal-archive" style="background: #f59e0b; border-color: #d97706; font-weight: 700;">
                📦 ${isCa ? 'Arxivar programa font' : 'Archivar programa fuente'}
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

      modalContainer.querySelector('#btn-modal-cancel').addEventListener('click', close);
      modalContainer.querySelector('#btn-modal-archive').addEventListener('click', async () => {
        await window.api.archiveSourceProgram(id, true);
        close();
        App.notifySaved();
        this.render(container);
      });
    } else {
      // Sin proyectos vinculados: permitir eliminar tras confirmación
      modalContainer.innerHTML = `
        <div class="modal-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
          <div class="modal-dialog" style="max-width: 480px; width: 100%; background: white; border-radius: 12px; padding: 26px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
            <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px;">
              <span style="font-size: 30px; line-height: 1;">🗑️</span>
              <div>
                <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 6px; color: #dc2626;">
                  ${isCa ? 'Eliminar programa font?' : '¿Eliminar programa fuente?'}
                </h2>
                <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                  ${isCa
                    ? `Estàs segur que vols eliminar permanentment <b>${escapeHtml(name)}</b>? Aquesta acció no es pot desfer.`
                    : `¿Estás seguro de que deseas eliminar permanentemente <b>${escapeHtml(name)}</b>? Esta acción no se puede deshacer.`}
                </p>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button class="btn" id="btn-modal-cancel">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
              <button class="btn primary" id="btn-modal-delete" style="background: #dc2626; border-color: #b91c1c; font-weight: 700;">
                ${isCa ? 'Eliminar definitivament' : 'Eliminar definitivamente'}
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

      modalContainer.querySelector('#btn-modal-cancel').addEventListener('click', close);
      modalContainer.querySelector('#btn-modal-delete').addEventListener('click', async () => {
        try {
          await window.api.deleteSourceProgram(id);
          close();
          App.notifySaved();
          this.render(container);
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }
};

window.SourceProgramsView = SourceProgramsView;
