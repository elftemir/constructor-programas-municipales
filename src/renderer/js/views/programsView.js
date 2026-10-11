/**
 * programsView.js - Vista de Gestión de Programas Municipales ("Mis programas")
 * Constructor de Programas Municipales - Versión 1.4.2 (Rediseño UX 7/10/2026)
 */

const ProgramsView = {
  async render(container) {
    const projects = await window.api.getProjects();
    const lastProjectId = await window.api.getLastOpenedProjectId();
    const isCa = window.i18n && window.i18n.getLang() === 'ca';

    let sources = [];
    try {
      sources = await window.api.getSourcePrograms(true);
    } catch (e) {}
    this.sourcesMap = {};
    sources.forEach(s => { this.sourcesMap[s.id] = s.nombre; });

    let contentHtml = '';
    if (projects.length === 0) {
      contentHtml = `
        <div class="empty-state-box">
          <div class="empty-state-icon">📁</div>
          <div class="empty-state-title">${isCa ? 'No hi ha cap programa municipal creat' : 'No hay ningún programa municipal creado'}</div>
          <div class="empty-state-desc">${isCa ? 'Comença creant un programa municipal a partir del marc oficial o importa un projecte existent.' : 'Comienza creando un programa municipal a partir del marco oficial o importa un proyecto existente.'}</div>
          <div style="display: flex; gap: 12px; margin-top: 14px;">
            <button class="btn primary large" id="btn-create-first-prog">${isCa ? '+ Nou programa municipal' : '+ Nuevo programa municipal'}</button>
            <button class="btn large" id="btn-import-prog-empty">${isCa ? 'Importar programa (.json)' : 'Importar programa (.json)'}</button>
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="projects-list">
          ${projects.map(p => this.renderProjectCard(p, p.id === (App.currentProject?.id || lastProjectId))).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="title">${isCa ? 'Els meus programes municipals' : 'Mis programas municipales'}</h1>
          <p class="subtitle">${isCa ? 'Gestiona els programes creats, duplica per a altres municipis o importa fitxers .json.' : 'Gestiona los programas creados, duplica para otros municipios o importa archivos .json.'}</p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 10px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <button class="btn" id="btn-programs-goto-fuentes">
            📚 ${isCa ? 'Programes font' : 'Programas fuente'}
          </button>
          <button class="btn primary" id="btn-create-new-prog">
            ${isCa ? '+ Nou programa' : '+ Nuevo programa'}
          </button>
          <button class="btn" id="btn-import-prog">
            ${isCa ? 'Importar (.json)' : 'Importar (.json)'}
          </button>
        </div>
      </div>

      ${contentHtml}
    `;

    this.bindEvents(container);
  },

  renderProjectCard(project, isActive = false) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const stats = project.stats || {
      total_marco: 123,
      decididas: 0,
      progreso_pct: 0,
      incluidas: 0,
      adaptadas: 0,
      descartadas: 0,
      en_duda: 0,
      sin_revisar: 123,
      medidas_propias: 0
    };

    const updatedDate = new Date(project.updated_at).toLocaleDateString(isCa ? 'ca-ES' : 'es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const fuenteNombre = (this.sourcesMap && this.sourcesMap[project.fuente_id]) || 'Programa Marco 2027';

    return `
      <div class="project-card ${isActive ? 'last-active-card' : ''}" data-project-id="${project.id}" style="${isActive ? 'border-color: var(--action-primary); box-shadow: 0 4px 14px rgba(107,33,168,0.1);' : ''}">
        <div class="project-card-top" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="project-card-title" style="font-size: 18px; font-weight: 700; color: var(--text-heading);">
                ${escapeHtml(project.municipio || (isCa ? 'Sense municipi' : 'Sin municipio'))}
              </div>
              ${isActive ? `<span class="badge" style="background: var(--action-primary); color: white; font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); font-weight: 600;">${isCa ? 'Actiu' : 'Activo'}</span>` : ''}
              ${project.codigo_ine ? `<span class="badge" style="background: var(--surface-muted); border: 1px solid var(--border-field); font-size: 11px; padding: 2px 6px; border-radius: var(--radius-sm); color: var(--text-secondary);">INE ${escapeHtml(project.codigo_ine)}</span>` : ''}
            </div>
            <div class="project-card-meta" style="display: flex; gap: 14px; margin-top: 6px; font-size: 13px; color: var(--text-secondary); flex-wrap: wrap;">
              <span><b>${isCa ? 'Font:' : 'Fuente:'}</b> ${escapeHtml(fuenteNombre)}</span>
              <span><b>${isCa ? 'Mandat:' : 'Mandato:'}</b> ${escapeHtml(project.mandato || '2027–2031')}</span>
              <span><b>${isCa ? 'Partit:' : 'Partido:'}</b> ${escapeHtml(project.partido || 'Podemos')}</span>
              <span><b>${isCa ? 'Idioma:' : 'Idioma:'}</b> ${project.idioma_principal === 'ca' ? 'Català' : 'Castellano'}</span>
              <span><b>${isCa ? 'Modificat:' : 'Modificado:'}</b> ${updatedDate}</span>
            </div>
          </div>
          <button class="btn primary btn-open-project" data-id="${project.id}">
            ${isActive ? (isCa ? 'Obrir actiu →' : 'Abrir activo →') : (isCa ? 'Obrir programa' : 'Abrir programa')}
          </button>
        </div>

        <div style="margin: 10px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
            <span class="muted">${isCa ? 'Progrés de decisions:' : 'Progreso de decisiones:'} <b>${stats.decididas} de ${stats.total_marco}</b></span>
            <span style="font-weight: 700; color: var(--action-link);">${stats.progreso_pct}%</span>
          </div>
          <div class="progress-bar-container" style="height: 8px; background: var(--surface-muted); border-radius: 4px; overflow: hidden;">
            <div class="progress-bar-fill" style="width: ${stats.progreso_pct}%; height: 100%; background: var(--action-primary); border-radius: 4px;"></div>
          </div>
        </div>

        <div class="project-card-stats" style="display: flex; gap: 14px; font-size: 12.5px; padding: 8px 12px; background: var(--surface-muted); border-radius: var(--radius-sm); flex-wrap: wrap;">
          <span><b style="color: var(--included-text);">${stats.incluidas}</b> ${isCa ? 'incloses' : 'incluidas'}</span>
          <span><b style="color: var(--adapted-text);">${stats.adaptadas}</b> ${isCa ? 'adaptades' : 'adaptadas'}</span>
          <span><b style="color: var(--doubt-text);">${stats.en_duda}</b> ${isCa ? 'en dubte' : 'en duda'}</span>
          <span><b>${stats.sin_revisar}</b> ${isCa ? 'sense revisar' : 'sin revisar'}</span>
          ${stats.medidas_propias > 0 ? `<span><b style="color: var(--action-primary);">${stats.medidas_propias}</b> ${isCa ? 'pròpies' : 'propias'}</span>` : ''}
        </div>

        <div class="project-card-actions" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 6px;">
          <button class="btn small btn-duplicate-project" data-id="${project.id}">${isCa ? 'Duplicar' : 'Duplicar'}</button>
          <button class="btn small btn-duplicate-municipio-project" data-id="${project.id}">
            ${isCa ? 'Duplicar per a un altre municipi' : 'Duplicar para otro municipio'}
          </button>
          <button class="btn small btn-export-json" data-id="${project.id}">
            ${isCa ? 'Exportar còpia (.json)' : 'Exportar copia (.json)'}
          </button>
          <button class="btn small destructive btn-delete-project" data-id="${project.id}" style="margin-left: auto;">
            ${isCa ? 'Eliminar' : 'Eliminar'}
          </button>
        </div>
      </div>
    `;
  },

  bindEvents(container) {
    container.querySelector('#btn-help-this-screen')?.addEventListener('click', () => {
      if (window.Tutorial) window.Tutorial.startSectionTour('programs');
    });

    container.querySelector('#btn-programs-goto-fuentes')?.addEventListener('click', () => {
      App.navigateTo('fuentes');
    });

    container.querySelectorAll('.btn-open-project').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await App.openProject(id);
      });
    });

    const btnNew = container.querySelector('#btn-create-new-prog');
    if (btnNew) btnNew.addEventListener('click', () => App.showCreateProjectModal());

    const btnFirst = container.querySelector('#btn-create-first-prog');
    if (btnFirst) btnFirst.addEventListener('click', () => App.showCreateProjectModal());

    const btnImport = container.querySelector('#btn-import-prog');
    if (btnImport) btnImport.addEventListener('click', () => App.importProject());

    const btnImportEmpty = container.querySelector('#btn-import-prog-empty');
    if (btnImportEmpty) btnImportEmpty.addEventListener('click', () => App.importProject());

    container.querySelectorAll('.btn-duplicate-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        App.showDuplicateModal(id);
      });
    });

    container.querySelectorAll('.btn-duplicate-municipio-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        App.showDuplicateForMunicipioModal(id);
      });
    });

    container.querySelectorAll('.btn-export-json').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await App.exportProjectJson(id);
      });
    });

    container.querySelectorAll('.btn-delete-project').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await App.deleteProject(id);
      });
    });
  }
};
