function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeLogoUrl(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '';
  const trimmed = rawPath.trim();
  // Bloquear esquemas ejecutables o no permitidos
  if (/^(javascript|vbscript|data:(?!image\/))/i.test(trimmed)) return '';
  // Convertir ruta de Windows/local a file URL normalizada
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\') || trimmed.startsWith('/')) {
    const normalized = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
    return encodeURI('file:///' + normalized);
  }
  if (trimmed.startsWith('file://')) {
    return encodeURI(trimmed);
  }
  return '';
}

const App = {
  currentProject: null,
  currentView: 'home',

  async init() {
    const savedLang = localStorage.getItem('app_language') || 'es';
    if (window.i18n) {
      window.i18n.setLang(savedLang);
    }

    this.bindSidebar();
    this.bindTopBar();
    this.bindGlobalShortcuts();
    this.initUpdater();
    if(window.GenerationUi)await window.GenerationUi.init();

    if (window.Tutorial) {
      window.Tutorial.init();
    }

    // Modal discreto de primera activación de Fase 2
    this.checkAiFirstRun();

    // Hidratación determinista y completa al arrancar la app
    try {
      // Esperar brevemente a que la base de datos esté lista
      let retries = 5;
      let projects = await window.api.getProjects();
      while ((!projects || projects.length === 0) && retries > 0) {
        await new Promise(r => setTimeout(r, 100));
        projects = await window.api.getProjects();
        retries--;
      }

      const lastProjectId = await window.api.getLastOpenedProjectId();
      let targetId = lastProjectId;
      if (!targetId && projects && projects.length > 0) {
        targetId = projects[0].id;
      }
      if (targetId) {
        let fullProject = await window.api.getProject(targetId);
        // Asegurar que el proyecto cargue todas las áreas y medidas antes de pintar
        let loadRetries = 5;
        while (fullProject && (!fullProject.areas || fullProject.areas.length === 0 || !fullProject.areas.some(a => a.medidas && a.medidas.length > 0)) && loadRetries > 0) {
          await new Promise(r => setTimeout(r, 120));
          fullProject = await window.api.getProject(targetId);
          loadRetries--;
        }

        if (fullProject) {
          this.currentProject = fullProject;
          if (fullProject.idioma_principal && window.i18n) {
            window.i18n.setLang(fullProject.idioma_principal);
          }
          this.updateTopBar(fullProject);
        }
      }
    } catch (e) {
      console.warn('Error hidratando proyecto inicial:', e);
    }

    // Start on Home view
    await this.navigateTo('home');
  },

  async ensureProjectHydrated() {
    if (!this.currentProject) return null;
    const hasAreas = Array.isArray(this.currentProject.areas) && this.currentProject.areas.length > 0;
    const hasMeasures = hasAreas && this.currentProject.areas.some(a => Array.isArray(a.medidas) && a.medidas.length > 0);

    if (!hasAreas || !hasMeasures) {
      try {
        const full = await window.api.getProject(this.currentProject.id);
        if (full) {
          this.currentProject = full;
          if (full.idioma_principal && window.i18n) {
            window.i18n.setLang(full.idioma_principal);
          }
          this.updateTopBar(full);
        }
      } catch (e) {
        console.warn('Error en ensureProjectHydrated:', e);
      }
    }
    return this.currentProject;
  },

  checkAiFirstRun() {
    if (localStorage.getItem('ai_first_run_v2_dismissed')) return;
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const modalHtml = `
      <div id="ai-first-run-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.65); z-index: 9999; display: grid; place-items: center; padding: 20px;">
        <div class="card" style="max-width: 540px; width: 100%; padding: 30px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); border: 2px solid #d8b4fe;">
          <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
            <div style="width: 48px; height: 48px; border-radius: 12px; background: #faf5ff; border: 1.5px solid #d8b4fe; display: grid; place-items: center; font-size: 26px;">
              ✨
            </div>
            <div>
              <h2 style="font-size: 18px; font-weight: 800; color: #1e1b4b; margin: 0;">
                ${isCa ? 'Nova funció: Intel·ligència Artificial Local (Fase 2)' : 'Nueva función: Inteligencia Artificial Local (Fase 2)'}
              </h2>
              <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-weight: 700; font-size: 11px;">
                ${isCa ? '100% Local · Privat · Opcional' : '100% Local · Privado · Opcional'}
              </span>
            </div>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: var(--text-secondary); margin: 0 0 16px 0;">
            ${isCa
              ? 'El Constructor de Programes Municipals ara inclou eines d\'IA opcionals per suggerir títols, adaptar propostes al municipi, redactar presentacions i traduir entre castellà i català. Tot s\'executa al vostre propi equip sense enviar res a Internet.'
              : 'El Constructor de Programas Municipales ahora incluye herramientas de IA opcionales para sugerir títulos, adaptar propuestas al municipio, redactar presentaciones y traducir entre castellano y catalán. Todo se ejecuta en tu propio ordenador sin enviar nada a Internet.'}
          </p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 22px; font-size: 12.5px; color: #166534;">
            <strong>${isCa ? 'Principi rector:' : 'Principio rector:'}</strong> ${isCa ? 'La IA proposa. L\'usuari decideix. Sempre podeu acceptar, editar o descartar.' : 'La IA propone. El usuario decide. Siempre puedes aceptar, editar o descartar.'}
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn" id="btn-ai-first-run-later">
              ${isCa ? 'Ara no' : 'Ahora no'}
            </button>
            <button class="btn primary" id="btn-ai-first-run-config" style="background: #7c3aed;">
              🚀 ${isCa ? 'Configurar IA' : 'Configurar IA'}
            </button>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);

    const overlay = document.querySelector('#ai-first-run-overlay');
    const btnLater = document.querySelector('#btn-ai-first-run-later');
    const btnConfig = document.querySelector('#btn-ai-first-run-config');

    const closeOverlay = () => {
      localStorage.setItem('ai_first_run_v2_dismissed', 'true');
      if (overlay) overlay.remove();
    };

    if (btnLater) btnLater.addEventListener('click', closeOverlay);
    if (btnConfig) {
      btnConfig.addEventListener('click', () => {
        closeOverlay();
        this.navigateTo('ia');
      });
    }
  },

  bindSidebar() {
    const navItems = document.querySelectorAll('.sidebar .step-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view || item.dataset.step;
        if (!view) return;
        const projectRequired = [
          'areas-medidas', 'vista-previa', 'generar-documentos',
          'elegir-medidas', 'adaptar-medidas', 'datos-basicos',
          'textos-generales', 'revisar-exportar'
        ];
        if (projectRequired.includes(view) && !this.currentProject) {
          const isCa = window.i18n && window.i18n.getLang() === 'ca';
          alert(isCa ? 'Primer has d\'obrir o crear un programa municipal.' : 'Primero debes abrir o crear un programa municipal.');
          return;
        }
        this.navigateTo(view);
      });
    });

    const brandEl = document.querySelector('#nav-brand');
    if (brandEl) {
      brandEl.addEventListener('click', () => {
        this.navigateTo('home');
      });
    }
  },

  bindTopBar() {
    const btnClose = document.querySelector('#btn-close-project');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.closeProject();
      });
    }

    const btnQuickSave = document.querySelector('#btn-quick-save');
    if (btnQuickSave) {
      btnQuickSave.addEventListener('click', () => {
        this.notifySaved();
      });
    }
  },

  bindGlobalShortcuts() {
    if (window.api?.onGlobalSave) {
      window.api.onGlobalSave(() => {
        this.notifySaved();
      });
    }
  },

  async navigateTo(viewName, params = {}) {
    this.currentView = viewName;
    const container = document.querySelector('#view-container');
    if (!container) return;

    const projectRequired = [
      'areas-medidas', 'vista-previa', 'generar-documentos',
      'elegir-medidas', 'adaptar-medidas', 'datos-basicos',
      'textos-generales', 'revisar-exportar'
    ];
    if (projectRequired.includes(viewName)) {
      await this.ensureProjectHydrated();
      if (!this.currentProject) return this.navigateTo('home');
    }

    // Update active nav item in sidebar
    document.querySelectorAll('.sidebar .step-item').forEach(item => {
      item.classList.remove('active');
      const v = item.dataset.view || item.dataset.step;
      if (v === viewName) {
        item.classList.add('active');
      } else if ((viewName === 'elegir-medidas' || viewName === 'areas-medidas') && v === 'areas-medidas') {
        item.classList.add('active');
      } else if ((viewName === 'revisar-exportar' || viewName === 'generar-documentos') && v === 'generar-documentos') {
        item.classList.add('active');
      } else if ((viewName === 'opciones' || viewName === 'configuracion') && v === 'configuracion') {
        item.classList.add('active');
      } else if ((viewName === 'fuentes' || viewName === 'programas-fuente') && v === 'fuentes') {
        item.classList.add('active');
      }
    });

    // Render corresponding view
    switch (viewName) {
      case 'home':
        await HomeView.render(container);
        break;
      case 'mis-programas':
        await ProgramsView.render(container);
        break;
      case 'areas-medidas':
      case 'elegir-medidas':
        await ChooseMeasuresView.render(container, this.currentProject);
        break;
      case 'vista-previa':
        await PreviewView.render(container, this.currentProject);
        break;
      case 'generar-documentos':
      case 'revisar-exportar':
        await ReviewExportView.render(container, this.currentProject);
        break;
      case 'ia':
        await AiView.render(container);
        break;
      case 'datos-basicos':
        await BasicDataView.render(container, this.currentProject);
        break;
      case 'adaptar-medidas':
        await AdaptMeasureView.render(
          container,
          this.currentProject,
          params.measureId,
          params.isPropia || false
        );
        break;
      case 'textos-generales':
        await GeneralTextsView.render(container, this.currentProject);
        break;
      case 'fuentes':
      case 'programas-fuente':
        await SourceProgramsView.render(container);
        break;
      case 'marco':
        await MarcoView.render(container);
        break;
      case 'configuracion':
      case 'opciones':
        await OptionsView.render(container, params);
        break;
      case 'ayuda':
        await HelpView.render(container, params);
        break;
      default:
        await HomeView.render(container);
    }

    // Scroll to top of main view
    document.querySelector('#main-content').scrollTop = 0;
  },

  async openProject(projectId) {
    let project = await window.api.getProject(projectId);
    if (!project) {
      alert('No se pudo cargar el proyecto.');
      return;
    }

    let loadRetries = 5;
    while (project && (!project.areas || project.areas.length === 0 || !project.areas.some(a => a.medidas && a.medidas.length > 0)) && loadRetries > 0) {
      await new Promise(r => setTimeout(r, 120));
      project = await window.api.getProject(projectId);
      loadRetries--;
    }

    this.currentProject = project;

    // Synchronize UI language to project's primary language
    if (project.idioma_principal && window.i18n) {
      window.i18n.setLang(project.idioma_principal);
      localStorage.setItem('app_language', project.idioma_principal);
    }

    this.updateTopBar(project);
    if (window.api && window.api.setLastOpenedProjectId) {
      await window.api.setLastOpenedProjectId(projectId);
    }

    // If municipality is empty, go to basic data, otherwise to choose measures
    if (!project.municipio) {
      await this.navigateTo('datos-basicos');
    } else {
      await this.navigateTo('elegir-medidas');
    }
  },

  closeProject() {
    this.currentProject = null;
    this.updateTopBar(null);
    this.navigateTo('home');
  },

  async refreshCurrentProject() {
    if (!this.currentProject) return;
    const project = await window.api.getProject(this.currentProject.id);
    if (project) {
      this.currentProject = project;
      if (project.idioma_principal && window.i18n) {
        window.i18n.setLang(project.idioma_principal);
      }
      this.updateTopBar(project);
    }
  },

  async refreshCurrentView() {
    if (this.currentProject) {
      await this.refreshCurrentProject();
    }
    await this.navigateTo(this.currentView);
  },

  async setLanguage(lang) {
    if (window.i18n) {
      window.i18n.setLang(lang);
    }
    localStorage.setItem('app_language', lang);
    if (this.currentProject && this.currentProject.idioma_principal !== lang) {
      await window.api.updateProjectData(this.currentProject.id, { idioma_principal: lang });
      await this.refreshCurrentProject();
    }
    await this.refreshCurrentView();
  },

  updateTopBar(project) {
    const titleEl = document.querySelector('#top-project-title');
    const nameBox = document.querySelector('#top-project-name');
    const saveInd = document.querySelector('#top-save-indicator');
    const actionsBox = document.querySelector('#top-actions');

    if (project) {
      titleEl.textContent = `${project.municipio || 'Sin municipio'} · ${project.mandato || '2027–2031'}`;
      nameBox.style.display = 'flex';
      saveInd.style.display = 'flex';
      actionsBox.style.display = 'flex';
    } else {
      nameBox.style.display = 'none';
      saveInd.style.display = 'none';
      actionsBox.style.display = 'none';
    }
  },

  notifySaving() {
    const saveInd = document.querySelector('#top-save-indicator');
    if (saveInd) {
      saveInd.className = 'save-indicator saving';
      const txt = window.i18n ? window.i18n.t('topbar.saving') : 'Guardando…';
      saveInd.innerHTML = `<span>⟳</span> <span>${txt}</span>`;
    }
  },

  notifySaved() {
    const saveInd = document.querySelector('#top-save-indicator');
    if (saveInd) {
      saveInd.className = 'save-indicator saved';
      const txt = window.i18n ? window.i18n.t('topbar.saved') : 'Guardado';
      saveInd.innerHTML = `<span>✓</span> <span>${txt}</span>`;
    }
  },

  openMeasureDetail(measureId, isPropia = false) {
    this.navigateTo('adaptar-medidas', { measureId, isPropia });
  },

  async openContentManager() {
    await this.navigateTo('configuracion');
    const state = await window.api.checkContentUpdates();
    this.handleContentUpdateStatus(state);
    document.querySelector('#options-content-updater-status-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  async showNewProjectModal() {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    let sources = [];
    try {
      sources = await window.api.getSourcePrograms(false);
    } catch (e) {}
    if (!sources || sources.length === 0) {
      await this.navigateTo('home');
      return;
    }
    const activeSource = sources.find(s => s.activo) || sources[0];

    const modalContainer = document.querySelector('#modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 580px;">
          <div class="modal-header">
            <h2 class="section-title" style="font-size: 20px;">${isCa ? 'Crear nou programa municipal' : 'Crear nuevo programa municipal'}</h2>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="position: relative;">
              <label class="form-label" for="modal-input-municipio">${isCa ? 'Municipi' : 'Municipio'} <span class="required">*</span></label>
              <input type="text" class="input" id="modal-input-municipio" placeholder="${isCa ? 'Escriu el nom del municipi…' : 'Escribe el nombre del municipio…'}" autocomplete="off" autofocus>
              <div id="modal-municipio-autocomplete" class="autocomplete-dropdown" style="display: none;"></div>
              <div class="form-hint">${isCa ? 'Escriu per autocompletar entre els 947 municipis de Catalunya o introdueix-ne un de personalitzat.' : 'Escribe para autocompletar entre los 947 municipios de Cataluña o introduce uno personalizado.'}</div>
            </div>

            <!-- Ficha municipal detectada alerta -->
            <div id="modal-ficha-alert" style="display: none; margin-bottom: 16px; padding: 12px 14px; background: #faf5ff; border: 1px solid #d8b4fe; border-radius: var(--radius-sm);">
              <div style="font-weight: 600; font-size: 13px; color: #6b21a8; margin-bottom: 4px;">${isCa ? 'Fitxa municipal trobada' : 'Ficha municipal encontrada'}</div>
              <div style="font-size: 12.5px; color: #4b5563; margin-bottom: 8px;">
                ${isCa
                  ? 'Existeixen dades desades per a aquest municipi (organització, lema, serveis públics, empreses, pressupostos i logotip).'
                  : 'Existen datos guardados para este municipio (organización, lema, servicios públicos, empresas, presupuestos y logo).'}
              </div>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn small primary" id="btn-modal-use-ficha">${isCa ? 'UTILITZAR DADES DESADES' : 'UTILIZAR DATOS GUARDADOS'}</button>
                <button type="button" class="btn small" id="btn-modal-ignore-ficha">${isCa ? 'COMENÇAR SENSE ELLES' : 'EMPEZAR SIN ELLOS'}</button>
              </div>
              <div id="modal-ficha-status" style="font-size: 12px; margin-top: 6px; font-weight: 500; color: #6b21a8;"></div>
            </div>

            <div class="grid-2" style="gap: 12px;">
              <div class="form-group">
                <label class="form-label" for="modal-input-provincia">${isCa ? 'Província' : 'Provincia'}</label>
                <input type="text" class="input" id="modal-input-provincia" placeholder="${isCa ? 'Ex. Barcelona' : 'Ej. Barcelona'}">
              </div>
              <div class="form-group">
                <label class="form-label" for="modal-input-comunidad">${isCa ? 'Comunitat Autònoma' : 'Comunidad Autónoma'}</label>
                <input type="text" class="input" id="modal-input-comunidad" value="${isCa ? 'Catalunya' : 'Cataluña'}" placeholder="${isCa ? 'Ex. Catalunya' : 'Ej. Cataluña'}">
              </div>
            </div>

            <div class="grid-2" style="gap: 12px;">
              <div class="form-group">
                <label class="form-label" for="modal-input-mandato">${isCa ? 'Mandat electoral' : 'Mandato electoral'} <span class="required">*</span></label>
                <input type="text" class="input" id="modal-input-mandato" value="2027–2031">
              </div>
              <div class="form-group">
                <label class="form-label" for="modal-select-idioma">${isCa ? 'Idioma principal' : 'Idioma principal'} <span class="required">*</span></label>
                <select class="select" id="modal-select-idioma">
                  <option value="es" ${!isCa ? 'selected' : ''}>Castellano</option>
                  <option value="ca" ${isCa ? 'selected' : ''}>Català</option>
                </select>
              </div>
            </div>

            <div class="grid-2" style="gap: 12px;">
              <div class="form-group">
                <label class="form-label" for="modal-input-partido">${isCa ? 'Partit' : 'Partido'}</label>
                <input type="text" class="input" id="modal-input-partido" value="Podemos">
              </div>
              <div class="form-group">
                <label class="form-label" for="modal-input-org">${isCa ? 'Organització' : 'Organización'}</label>
                <input type="text" class="input" id="modal-input-org" value="Podemos">
              </div>
            </div>

            <div class="form-group" style="margin-top: 14px;">
              <label class="form-label" for="modal-select-fuente">${isCa ? 'Programa font de referència' : 'Programa fuente de referencia'}</label>
              <select class="select" id="modal-select-fuente">
                ${sources.map(s => `
                  <option value="${s.id}" ${s.id === activeSource.id ? 'selected' : ''}>
                    ${escapeHtml(s.nombre)} ${s.activo ? (isCa ? '(Font activa)' : '(Fuente activa)') : ''}
                  </option>
                `).join('')}
              </select>
              <div class="form-hint">${isCa ? 'Pots gestionar i importar més programes font des del menú lateral.' : 'Puedes gestionar e importar más programas fuente desde el menú lateral.'}</div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-close-modal">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="modal-btn-confirm-create">${isCa ? 'Crear programa' : 'Crear programa'}</button>
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

    // Autocomplete for modal
    const munInput = modalContainer.querySelector('#modal-input-municipio');
    const autoDropdown = modalContainer.querySelector('#modal-municipio-autocomplete');
    const provInput = modalContainer.querySelector('#modal-input-provincia');
    const comInput = modalContainer.querySelector('#modal-input-comunidad');
    const orgInput = modalContainer.querySelector('#modal-input-org');
    const partidoInput = modalContainer.querySelector('#modal-input-partido');
    const fichaAlert = modalContainer.querySelector('#modal-ficha-alert');
    const fichaStatus = modalContainer.querySelector('#modal-ficha-status');

    let autoItems = [];
    let selectedMunicipio = null;
    let useSavedFicha = false;
    let orgManuallyEdited = false;

    orgInput.addEventListener('input', () => {
      orgManuallyEdited = true;
    });

    partidoInput.addEventListener('input', () => {
      if (!orgManuallyEdited) {
        const part = partidoInput.value.trim() || 'Podemos';
        const mun = munInput.value.trim();
        orgInput.value = mun ? `${part} ${mun}`.trim() : part;
      }
    });

    modalContainer.querySelector('#btn-modal-use-ficha').addEventListener('click', () => {
      useSavedFicha = true;
      fichaStatus.textContent = '✓ Se aplicarán los datos guardados de la ficha municipal.';
      fichaStatus.style.color = '#15803d';
    });

    modalContainer.querySelector('#btn-modal-ignore-ficha').addEventListener('click', () => {
      useSavedFicha = false;
      fichaStatus.textContent = 'Empezando desde cero sin datos guardados previos.';
      fichaStatus.style.color = '#6b7280';
    });

    munInput.addEventListener('input', async (e) => {
      const q = e.target.value.trim();
      const part = partidoInput.value.trim() || 'Podemos';
      if (!orgManuallyEdited) {
        orgInput.value = `${part} ${q}`.trim();
      }

      if (q.length < 2) {
        autoDropdown.style.display = 'none';
        return;
      }

      const results = await window.api.searchMunicipios(q);
      if (results && results.length > 0) {
        autoItems = results;
        autoDropdown.innerHTML = results.map((m, idx) => `
          <div class="autocomplete-item" data-idx="${idx}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border-divider);">
            <div style="font-weight: 600; font-size: 13.5px;">${escapeHtml(m.nombre)}</div>
            <div class="muted" style="font-size: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
              <span>${escapeHtml(m.provincia)}</span>
              <span>·</span>
              <span>${Number(m.poblacion || 0).toLocaleString('es-ES')} hab.</span>
              <span>·</span>
              <span>INE ${escapeHtml(m.codigo_ine)}</span>
              ${m.codigos_postales && m.codigos_postales.length > 0 ? `<span>·</span><span>CP ${escapeHtml(m.codigos_postales.join(', '))}</span>` : ''}
            </div>
          </div>
        `).join('');
        autoDropdown.style.display = 'block';

        autoDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', async () => {
            const m = autoItems[parseInt(item.dataset.idx, 10)];
            if (m) {
              selectedMunicipio = m;
              munInput.value = m.nombre;
              provInput.value = m.provincia;
              comInput.value = m.comunidad_autonoma || 'Cataluña';
              autoDropdown.style.display = 'none';
              if (!orgManuallyEdited) {
                orgInput.value = `${part} ${m.nombre}`.trim();
              }

              // Check if municipal profile exists
              const fichaExists = await window.api.checkFichaExists(m.codigo_ine);
              if (fichaExists) {
                fichaAlert.style.display = 'block';
                useSavedFicha = true; // default to true when detected
                fichaStatus.textContent = '✓ Seleccionado: utilizar datos guardados de la ficha.';
                fichaStatus.style.color = '#15803d';
              } else {
                fichaAlert.style.display = 'none';
                useSavedFicha = false;
              }
            }
          });
        });
      } else {
        autoDropdown.style.display = 'none';
      }
    });

    // Confirm create
    modalContainer.querySelector('#modal-btn-confirm-create').addEventListener('click', async () => {
      const mun = munInput.value.trim();
      if (!mun) {
        alert('Por favor, indica el nombre del municipio.');
        munInput.focus();
        return;
      }

      const data = {
        municipio: mun,
        fuente_id: modalContainer.querySelector('#modal-select-fuente')?.value || activeSource.id,
        provincia: provInput.value.trim(),
        comunidad_autonoma: comInput.value.trim() || 'Cataluña',
        mandato: modalContainer.querySelector('#modal-input-mandato').value.trim() || '2027–2031',
        idioma_principal: modalContainer.querySelector('#modal-select-idioma').value,
        partido: partidoInput.value.trim() || 'Podemos',
        organizacion: orgInput.value.trim(),
        organizacion_modificada: orgManuallyEdited ? 1 : 0,
        codigo_ine: selectedMunicipio ? selectedMunicipio.codigo_ine : null,
        habitantes: selectedMunicipio ? selectedMunicipio.poblacion : null,
        poblacion_fuente: selectedMunicipio ? (selectedMunicipio.poblacion_fuente || 'Idescat / INE') : 'Idescat / INE',
        poblacion_ano: selectedMunicipio ? (selectedMunicipio.poblacion_ano || '2025') : '2025',
        poblacion_modificada: 0
      };

      try {
        const newId = await window.api.createProject(data);

        // If user chose to apply saved municipal profile
        if (useSavedFicha && selectedMunicipio && selectedMunicipio.codigo_ine) {
          const ficha = await window.api.getFichaMunicipio(selectedMunicipio.codigo_ine);
          if (ficha) {
            await window.api.updateProjectData(newId, {
              partido: ficha.partido || data.partido,
              organizacion: ficha.organizacion || data.organizacion,
              mandato: ficha.mandato || data.mandato,
              lema_es: window.Lema.getLema(ficha, 'es'),
              lema_ca: window.Lema.getLema(ficha, 'ca'),
              fecha_electoral: ficha.fecha_electoral,
              presupuesto_municipal: ficha.presupuesto_municipal,
              presupuesto_inversiones: ficha.presupuesto_inversiones,
              empresas_municipales: ficha.empresas_municipales,
              servicios: ficha.servicios,
              logo_path: ficha.logo_path,
              habitantes: ficha.poblacion_usuario || ficha.poblacion_oficial || data.habitantes,
              poblacion_modificada: ficha.poblacion_usuario ? 1 : 0
            });
          }
        }

        closeModals();
        await this.openProject(newId);
      } catch (err) {
        alert('Error al crear el programa: ' + err.message);
      }
    });
  },

  async showDuplicateForMunicipioModal(sourceProjectId) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const origProject = await window.api.getProject(sourceProjectId);
    if (!origProject) {
      alert(isCa ? 'Projecte d\'origen no trobat.' : 'Proyecto origen no encontrado.');
      return;
    }

    const modalContainer = document.querySelector('#modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 580px;">
          <div class="modal-header">
            <div>
              <h2 class="section-title" style="font-size: 19px;">${isCa ? 'Duplicar per a un altre municipi' : 'Duplicar para otro municipio'}</h2>
              <div class="muted" style="font-size: 13px;">${isCa ? 'Copia totes les decisions de mesures i textos per a un nou municipi.' : 'Copia todas las decisiones de medidas y textos para un nuevo municipio.'}</div>
            </div>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 13.5px; line-height: 1.5; margin-bottom: 16px;">
              ${isCa
                ? `Es duplicarà el projecte <b>"${escapeHtml(origProject.nombre || origProject.municipio || 'Programa')}"</b> amb totes les seves mesures incloses, adaptades i textos generals.`
                : `Se duplicará el proyecto <b>"${escapeHtml(origProject.nombre || origProject.municipio || 'Programa')}"</b> con todas sus medidas incluidas, adaptadas y textos generales.`}
            </p>

            <div class="form-group" style="position: relative;">
              <label class="form-label" for="dup-input-municipio">${isCa ? 'Nou municipi destinació' : 'Nuevo municipio destino'} <span class="required">*</span></label>
              <input type="text" class="input" id="dup-input-municipio" placeholder="${isCa ? 'Escriu el nom, codi INE o codi postal…' : 'Escribe el nombre, código INE o código postal…'}" autocomplete="off" autofocus>
              <div id="dup-municipio-autocomplete" class="autocomplete-dropdown" style="display: none;"></div>
              <div class="form-hint">${isCa ? 'Cerca entre els 947 municipis de Catalunya per nom, CP o INE.' : 'Busca entre los 947 municipios de Cataluña por nombre, CP o INE.'}</div>
            </div>

            <div class="grid-2" style="gap: 12px; margin-top: 12px;">
              <div class="form-group">
                <label class="form-label" for="dup-input-provincia">${isCa ? 'Província' : 'Provincia'}</label>
                <input type="text" class="input" id="dup-input-provincia" readonly style="background: var(--surface-muted);">
              </div>
              <div class="form-group">
                <label class="form-label" for="dup-input-habitantes">${isCa ? 'Habitants oficials' : 'Habitantes oficiales'}</label>
                <input type="text" class="input" id="dup-input-habitantes" readonly style="background: var(--surface-muted);">
              </div>
            </div>

            <!-- Alerta Ficha guardada -->
            <div id="dup-ficha-alert" style="display: none; margin-top: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 12px;">
              <div style="font-weight: 600; color: #166534; font-size: 13px; margin-bottom: 4px;">
                ${isCa ? 'Fitxa municipal desada detectada' : 'Ficha municipal guardada detectada'}
              </div>
              <p style="font-size: 12.5px; color: #15803d; line-height: 1.4; margin: 0 0 10px 0;">
                ${isCa
                  ? 'Existeixen dades desades prèviament per a aquest municipi (organització, lema, empreses, serveis, pressupostos, logotip).'
                  : 'Existen datos guardados previamente para este municipio (organización, lema, empresas, servicios, presupuestos, logo).'}
              </p>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn small primary" id="btn-dup-use-ficha">${isCa ? 'UTILITZAR DADES DESADES' : 'UTILIZAR DATOS GUARDADOS'}</button>
                <button type="button" class="btn small" id="btn-dup-ignore-ficha">${isCa ? 'UTILITZAR NOMÉS DADES OFICIALS' : 'USAR SOLO DATOS OFICIALES'}</button>
              </div>
              <div id="dup-ficha-status" style="font-size: 11.5px; color: #15803d; margin-top: 6px; font-weight: 500;">
                ${isCa ? '✓ Seleccionat: utilitzar dades desades de la fitxa.' : '✓ Seleccionado: utilizar datos guardados de la ficha.'}
              </div>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn btn-close-modal">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="btn-confirm-duplicate" disabled>${isCa ? 'Duplicar projecte' : 'Duplicar proyecto'}</button>
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

    const munInput = modalContainer.querySelector('#dup-input-municipio');
    const autoDropdown = modalContainer.querySelector('#dup-municipio-autocomplete');
    const provInput = modalContainer.querySelector('#dup-input-provincia');
    const habInput = modalContainer.querySelector('#dup-input-habitantes');
    const fichaAlert = modalContainer.querySelector('#dup-ficha-alert');
    const fichaStatus = modalContainer.querySelector('#dup-ficha-status');
    const btnConfirm = modalContainer.querySelector('#btn-confirm-duplicate');

    let autoItems = [];
    let selectedMunicipio = null;
    let useSavedFicha = false;

    modalContainer.querySelector('#btn-dup-use-ficha').addEventListener('click', () => {
      useSavedFicha = true;
      fichaStatus.textContent = '✓ Seleccionado: utilizar datos guardados de la ficha.';
      fichaStatus.style.color = '#15803d';
    });

    modalContainer.querySelector('#btn-dup-ignore-ficha').addEventListener('click', () => {
      useSavedFicha = false;
      fichaStatus.textContent = '✓ Seleccionado: usar solo datos oficiales (sin lema, ni empresas previas).';
      fichaStatus.style.color = '#6b7280';
    });

    munInput.addEventListener('input', async (e) => {
      const q = e.target.value.trim();
      btnConfirm.disabled = true;
      selectedMunicipio = null;

      if (q.length < 2) {
        autoDropdown.style.display = 'none';
        return;
      }

      const results = await window.api.searchMunicipios(q);
      if (results && results.length > 0) {
        autoItems = results;
        autoDropdown.innerHTML = results.map((m, idx) => `
          <div class="autocomplete-item" data-idx="${idx}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border-divider);">
            <div style="font-weight: 600; font-size: 13.5px;">${escapeHtml(m.nombre)}</div>
            <div class="muted" style="font-size: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
              <span>${escapeHtml(m.provincia)}</span>
              <span>·</span>
              <span>${Number(m.poblacion || 0).toLocaleString('es-ES')} hab.</span>
              <span>·</span>
              <span>INE ${escapeHtml(m.codigo_ine)}</span>
              ${m.codigos_postales && m.codigos_postales.length > 0 ? `<span>·</span><span>CP ${escapeHtml(m.codigos_postales.join(', '))}</span>` : ''}
            </div>
          </div>
        `).join('');
        autoDropdown.style.display = 'block';

        autoDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', async () => {
            const m = autoItems[parseInt(item.dataset.idx, 10)];
            if (m) {
              selectedMunicipio = m;
              munInput.value = m.nombre;
              provInput.value = m.provincia || '';
              habInput.value = m.poblacion ? `${Number(m.poblacion).toLocaleString('es-ES')} hab.` : '';
              autoDropdown.style.display = 'none';
              btnConfirm.disabled = false;

              const fichaExists = await window.api.checkFichaExists(m.codigo_ine);
              if (fichaExists) {
                fichaAlert.style.display = 'block';
                useSavedFicha = true;
                fichaStatus.textContent = '✓ Seleccionado: utilizar datos guardados de la ficha.';
                fichaStatus.style.color = '#15803d';
              } else {
                fichaAlert.style.display = 'none';
                useSavedFicha = false;
              }
            }
          });
        });
      } else {
        autoDropdown.style.display = 'none';
      }
    });

    btnConfirm.addEventListener('click', async () => {
      if (!selectedMunicipio) return;
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Duplicando…';

      try {
        let fichaData = null;
        if (useSavedFicha && selectedMunicipio.codigo_ine) {
          fichaData = await window.api.getFichaMunicipio(selectedMunicipio.codigo_ine);
        }

        const newId = await window.api.duplicateProjectForMunicipio(sourceProjectId, selectedMunicipio, fichaData);
        closeModals();
        await this.openProject(newId);
      } catch (err) {
        alert('Error al duplicar para otro municipio: ' + err.message);
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'Duplicar proyecto';
      }
    });
  },


  showAddOwnMeasureModal(defaultAreaId) {
    if (!this.currentProject) return;

    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const modalContainer = document.querySelector('#modal-container');
    const areas = this.currentProject.areas || [];

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 650px;">
          <div class="modal-header">
            <div>
              <h2 class="section-title" style="font-size: 19px;">${isCa ? 'Afegir mesura pròpia' : 'Añadir medida propia'}</h2>
              <div class="muted" style="font-size: 13px;">${isCa ? 'Crea una nova proposta local específica per al teu municipi.' : 'Crea una nueva propuesta local específica para tu municipio.'}</div>
            </div>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="modal-own-area">${isCa ? 'Àrea temàtica' : 'Área temática'} <span class="required">*</span></label>
              <select class="select" id="modal-own-area">
                ${areas.map(a => `
                  <option value="${a.id}" ${a.id === defaultAreaId ? 'selected' : ''}>${escapeHtml(a.nombre)}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-own-title">${isCa ? 'Títol de la mesura' : 'Título de la medida'} <span class="required">*</span></label>
              <input type="text" class="input" id="modal-own-title" placeholder="${isCa ? 'Ex. Impuls a la cooperativa energètica municipal' : 'Ej. Impulso a la cooperativa energética municipal'}" autofocus>
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-own-text">${isCa ? 'Text de la proposta' : 'Texto de la propuesta'} <span class="required">*</span></label>
              <textarea class="textarea" id="modal-own-text" placeholder="${isCa ? 'Redacció de la mesura que apareixerà al programa electoral…' : 'Redacción de la medida que aparecerá en el programa electoral…'}" style="min-height: 120px;"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-own-exp">${isCa ? 'Explicació o desenvolupament' : 'Explicación o desarrollo'} <span class="optional">(${isCa ? 'Opcional' : 'Opcional'})</span></label>
              <textarea class="textarea" id="modal-own-exp" placeholder="${isCa ? 'Detalls d\'execució, fases o justificació…' : 'Detalles de ejecución, fases o justificación…'}" style="min-height: 70px;"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="modal-own-nota">${isCa ? 'Nota interna de l\'agrupació' : 'Nota interna de la agrupación'} <span class="optional">(${isCa ? 'No s\'exporta' : 'No se exporta'})</span></label>
              <input type="text" class="input" id="modal-own-nota" placeholder="${isCa ? 'Anotacions per a l\'equip local…' : 'Anotaciones para el equipo local…'}">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-close-modal">${isCa ? 'Cancel·lar' : 'Cancelar'}</button>
            <button class="btn primary" id="modal-btn-confirm-own">${isCa ? 'Desar proposta pròpia' : 'Guardar propuesta propia'}</button>
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

    modalContainer.querySelector('#modal-btn-confirm-own').addEventListener('click', async () => {
      const title = modalContainer.querySelector('#modal-own-title').value.trim();
      const text = modalContainer.querySelector('#modal-own-text').value.trim();
      const areaId = modalContainer.querySelector('#modal-own-area').value;
      const exp = modalContainer.querySelector('#modal-own-exp').value.trim() || null;
      const nota = modalContainer.querySelector('#modal-own-nota').value.trim() || null;

      if (!title || !text) {
        alert('Por favor, introduce el título y el texto de la propuesta.');
        return;
      }

      try {
        await window.api.addOwnMeasure(this.currentProject.id, {
          area_id: areaId,
          titulo: title,
          texto: text,
          explicacion: exp,
          nota_interna: nota
        });

        closeModals();
        await this.refreshCurrentProject();
        if (this.currentView === 'elegir-medidas' || this.currentView === 'areas-medidas') {
          ChooseMeasuresView.currentAreaId = areaId;
          await this.navigateTo('areas-medidas');
        }
      } catch (err) {
        alert('Error al guardar la propuesta propia: ' + err.message);
      }
    });
  },

  showCreateProjectModal() {
    this.showNewProjectModal();
  },

  async showDuplicateModal(projectId) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    try {
      const newId = await window.api.duplicateProject(projectId);
      await this.openProject(newId);
    } catch (err) {
      alert((isCa ? 'Error al duplicar el programa: ' : 'Error al duplicar el programa: ') + err.message);
    }
  },

  async exportProjectJson(projectId) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    try {
      const res = await window.api.exportProjectJson(projectId);
      if (res && res.filePath) {
        alert((isCa ? 'Còpia exportada correctament a:\n' : 'Copia exportada correctamente en:\n') + res.filePath);
      }
    } catch (err) {
      alert((isCa ? 'Error en exportar: ' : 'Error al exportar: ') + err.message);
    }
  },

  async deleteProject(projectId) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    if (!confirm(isCa ? 'Segur que vols eliminar aquest programa municipal?' : '¿Seguro que deseas eliminar este programa municipal?')) {
      return;
    }
    try {
      await window.api.deleteProject(projectId);
      if (this.currentProject && this.currentProject.id === projectId) {
        this.closeProject();
      }
      if (this.currentView === 'mis-programas') {
        const container = document.querySelector('#view-container');
        await ProgramsView.render(container);
      } else {
        await this.navigateTo('home');
      }
    } catch (err) {
      alert((isCa ? 'Error en eliminar: ' : 'Error al eliminar: ') + err.message);
    }
  },

  async importProject() {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    try {
      const imported = await window.api.loadProjectFromFile();
      if (imported && imported.id) {
        await this.openProject(imported.id);
      } else if (imported) {
        await this.refreshCurrentView();
      }
    } catch (err) {
      alert((isCa ? 'Error en importar el programa: ' : 'Error al importar el programa: ') + err.message);
    }
  },

  initUpdater() {
    this.updaterState = null;
    this.updaterBannerDismissedForStatus = null;
    if (!window.api || typeof window.api.onUpdateStatus !== 'function') return;

    window.api.onUpdateStatus((state) => {
      this.handleUpdateStatus(state);
    });

    if (typeof window.api.getUpdateStatus === 'function') {
      window.api.getUpdateStatus()
        .then((initialState) => {
          if (initialState) this.handleUpdateStatus(initialState);
        })
        .catch(() => {});
    }

    // Actualizaciones de contenidos (Fase 3.4B)
    this.contentUpdaterState = null;
    if (typeof window.api.onContentUpdateStatus === 'function') {
      window.api.onContentUpdateStatus((state) => {
        this.handleContentUpdateStatus(state);
      });
    }
    if (typeof window.api.getContentUpdateStatus === 'function') {
      window.api.getContentUpdateStatus()
        .then((s) => { if (s) this.handleContentUpdateStatus(s); })
        .catch(() => {});
    }
  },

  handleContentUpdateStatus(state) {
    if (!state || typeof state !== 'object') return;
    this.contentUpdaterState = state;
    if (this.currentView === 'home' && window.HomeView) window.HomeView.updateBootstrapProgress(state);

    // Refresh Options if visible
    if ((this.currentView === 'configuracion' || this.currentView === 'opciones') &&
        window.OptionsView && typeof window.OptionsView.updateContentUpdaterBox === 'function') {
      window.OptionsView.updateContentUpdaterBox(state);
    }

    // Refresh Home if visible
    if (this.currentView === 'home' && window.HomeView && typeof window.HomeView.updateHomeUpdatesZone === 'function') {
      window.HomeView.updateHomeUpdatesZone(this.updaterState, state);
    }

    // Show "available" notification if new content detected
    const officialAvailable = (state.availableItems || []).filter(item => item.official === true && item.is_test_fixture !== true);
    if (!state.bootstrapInProgress && state.status === 'AVAILABLE' && officialAvailable.length > 0 && !this._contentBannerDismissed) {
      this.showContentUpdateBanner(officialAvailable[0]);
    }
    if (state.status !== 'AVAILABLE' || officialAvailable.length === 0 || state.bootstrapInProgress) {
      const existing = document.getElementById('global-content-update-banner');
      if (existing) existing.remove();
      this._contentBannerDismissed = false;
    }
  },

  showContentUpdateBanner(item) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    let banner = document.getElementById('global-content-update-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'global-content-update-banner';
      banner.style.cssText = 'position: fixed; right: 24px; bottom: 24px; width: 420px; max-width: calc(100vw - 48px); background: #ffffff; border: 2px solid #0284c7; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.22); padding: 18px 20px; z-index: 9400; font-size: 13.5px; color: var(--text-primary);';
      document.body.appendChild(banner);
    }
    const rawTitle = typeof item.title === 'object' ? (isCa ? (item.title?.ca || item.title?.es) : (item.title?.es || item.title?.ca)) : (item.title_es || item.title || '');
    const title = escapeHtml(rawTitle);
    const isOfficial = item.official === true && item.is_test_fixture !== true;
    const officialLabel = isOfficial
      ? (isCa ? 'OFICIAL' : 'OFICIAL')
      : (isCa ? 'CONTINGUT DE PROVA · NO OFICIAL' : 'CONTENIDO DE PRUEBA · NO OFICIAL');
    let langsStr = '';
    if (Array.isArray(item.languages)) {
      langsStr = item.languages.map(l => l === 'es' ? 'Castellano' : (l === 'ca' ? 'Català' : l)).join(' · ');
    } else if (item.languages && typeof item.languages === 'object') {
      langsStr = [item.languages.es?.available && 'Castellano', item.languages.ca?.available && 'Català'].filter(Boolean).join(' · ');
    }
    const langs = langsStr || 'Castellano · Català';

    banner.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div style="font-weight:800;font-size:14px;color:#0c4a6e;">
          ${isCa ? 'Nou contingut disponible' : 'Nuevo contenido disponible'}
        </div>
        <button id="btn-content-banner-close" style="background:none;border:none;cursor:pointer;font-size:18px;line-height:1;color:#64748b;" title="${isCa ? 'Tancar' : 'Cerrar'}">✕</button>
      </div>
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${title}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
        ${escapeHtml(langs)} · ${escapeHtml(officialLabel)}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn small" id="btn-content-banner-later">${isCa ? 'MÉS TARD' : 'MÁS TARDE'}</button>
        <button class="btn small primary" id="btn-content-banner-view" style="background:#0284c7;border-color:#0369a1;">${isCa ? 'VER CONTINGUT' : 'VER CONTENIDO'} </button>
      </div>
    `;

    banner.querySelector('#btn-content-banner-close').addEventListener('click', () => {
      this._contentBannerDismissed = true;
      banner.remove();
    });
    banner.querySelector('#btn-content-banner-later').addEventListener('click', () => {
      this._contentBannerDismissed = true;
      banner.remove();
    });
    banner.querySelector('#btn-content-banner-view').addEventListener('click', () => {
      this._contentBannerDismissed = true;
      banner.remove();
      this.showContentUpdateDetailModal(item);
    });
  },

  showContentUpdateDetailModal(item, options = {}) {
    const isTest = item.official !== true || item.is_test_fixture === true;
    if (isTest && options.allowTestFixture !== true) return;
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const modalContainer = document.querySelector('#modal-container') || document.body;

    const rawTitle = typeof item.title === 'object' ? (isCa ? (item.title?.ca || item.title?.es) : (item.title?.es || item.title?.ca)) : (item.title_es || item.title || '');
    const title = escapeHtml(rawTitle);
    const rawSummary = typeof item.summary === 'object' ? (isCa ? (item.summary?.ca || item.summary?.es) : (item.summary?.es || item.summary?.ca)) : (item.summary_es || item.summary || '');
    const summary = escapeHtml(rawSummary);
    const contentVersion = escapeHtml(item.content_version || '');
    const isOfficial = item.official === true && item.is_test_fixture !== true;
    let langsStr = '';
    if (Array.isArray(item.languages)) {
      langsStr = item.languages.map(l => l === 'es' ? 'Castellano' : (l === 'ca' ? 'Català' : l)).join(' · ');
    } else if (item.languages && typeof item.languages === 'object') {
      langsStr = [item.languages.es?.available && 'Castellano', item.languages.ca?.available && 'Català'].filter(Boolean).join(' · ');
    }
    const langs = langsStr || 'Castellano · Català';
    const areasCount = item.stats?.total_areas ?? item.areas_count ?? '—';
    const measuresCount = item.stats?.total_measures ?? item.measures_count ?? '—';
    const officialLabel = isOfficial
      ? (isCa ? 'OFICIAL' : 'OFICIAL')
      : (isCa ? 'CONTINGUT DE PROVA · NO OFICIAL' : 'CONTENIDO DE PRUEBA · NO OFICIAL');
    const officialColor = isOfficial ? '#166534' : '#92400e';
    const officialBg = isOfficial ? '#f0fdf4' : '#fffbeb';
    const officialBorder = isOfficial ? '#bbf7d0' : '#fde68a';

    modalContainer.innerHTML = `
      <div class="modal-overlay" style="z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.65);">
        <div class="modal-dialog" id="content-detail-modal" style="max-width:520px;width:100%;background:white;border-radius:14px;padding:28px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#0284c7;letter-spacing:0.05em;margin-bottom:4px;">
                ${isCa ? 'Actualització de continguts' : 'Actualización de contenidos'}
              </div>
              <h2 style="font-size:19px;font-weight:800;margin:0;color:#1e1b4b;">${title}</h2>
            </div>
            <button id="btn-content-modal-close" style="background:none;border:none;cursor:pointer;font-size:20px;line-height:1;color:#64748b;" title="${isCa ? 'Tancar' : 'Cerrar'}">✕</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;margin-bottom:16px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <span style="background:#e0f2fe;color:#0c4a6e;font-weight:700;font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid #bae6fd;">${escapeHtml(contentVersion)}</span>
              <span style="background:#f1f5f9;color:#334155;font-size:11px;padding:3px 8px;border-radius:6px;">${escapeHtml(langs)}</span>
              <span style="background:${officialBg};color:${officialColor};font-weight:700;font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid ${officialBorder};">${officialLabel}</span>
            </div>
            <div style="display:flex;gap:16px;color:var(--text-secondary);">
              <span>📋 ${areasCount} ${isCa ? 'àrees' : 'áreas'}</span>
              <span>📌 ${measuresCount} ${isCa ? 'mesures' : 'medidas'}</span>
            </div>
          </div>

          ${summary ? `<div style="font-size:13px;color:var(--text-secondary);line-height:1.55;margin-bottom:16px;">${summary}</div>` : ''}

          <div id="content-install-progress" style="display:none;margin-bottom:16px;"></div>

          <div id="content-modal-actions" style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn" id="btn-content-modal-later">${isCa ? 'MÉS TARD' : 'MÁS TARDE'}</button>
            <button class="btn primary" id="btn-content-modal-install" style="background:#0284c7;border-color:#0369a1;font-weight:700;">
              ${isCa ? 'DESCARREGAR CONTINGUT' : 'DESCARGAR CONTENIDO'}
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

    modalContainer.querySelector('#btn-content-modal-close').addEventListener('click', closeModal);
    modalContainer.querySelector('#btn-content-modal-later').addEventListener('click', closeModal);

    const btnInstall = modalContainer.querySelector('#btn-content-modal-install');
    const progressDiv = modalContainer.querySelector('#content-install-progress');
    const actionsDiv = modalContainer.querySelector('#content-modal-actions');

    const setProgress = (msg, isError = false) => {
      progressDiv.style.display = 'block';
      progressDiv.style.cssText = `display:block;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;background:${isError ? '#fef2f2' : '#f0f9ff'};color:${isError ? '#991b1b' : '#0c4a6e'};border:1px solid ${isError ? '#fecaca' : '#bae6fd'};margin-bottom:16px;`;
      progressDiv.textContent = msg;
    };

    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        btnInstall.disabled = true;
        actionsDiv.querySelector('#btn-content-modal-later').disabled = true;
        setProgress(isCa ? 'Baixant contingut...' : 'Descargando contenido...');

        // Subscribe to progress events
        let removeListener = null;
        if (typeof window.api.onContentUpdateStatus === 'function') {
          removeListener = window.api.onContentUpdateStatus((state) => {
            this.handleContentUpdateStatus(state);
            if (state.status === 'DOWNLOADING') {
              const pct = state.progress != null ? ` ${Math.round(state.progress)} %` : '';
              setProgress((isCa ? 'Baixant contingut...' : 'Descargando contenido...') + pct);
            } else if (state.status === 'VERIFYING') {
              setProgress(isCa ? 'Verificant contingut...' : 'Verificando contenido...');
            } else if (state.status === 'INSTALLING') {
              setProgress(isCa ? 'Instal·lant contingut...' : 'Instalando contenido...');
            } else if (state.status === 'INSTALLED') {
              if (removeListener) removeListener();
              setProgress(isCa ? 'Contingut instal·lat correctament.' : 'Contenido instalado correctamente.');
              actionsDiv.innerHTML = `<button class="btn primary" id="btn-content-modal-done" style="background:#0284c7;border-color:#0369a1;">${isCa ? 'TANCAR' : 'CERRAR'}</button>`;
              modalContainer.querySelector('#btn-content-modal-done').addEventListener('click', () => {
                closeModal();
                // Refresh source programs if visible
                if (this.currentView === 'fuentes' || this.currentView === 'programas-fuente') {
                  const container = document.querySelector('#view-container');
                  if (container && window.SourceProgramsView) window.SourceProgramsView.render(container);
                }
              });
            } else if (state.status === 'ERROR') {
              if (removeListener) removeListener();
              const errMsg = (isCa ? state.errorCa : state.error) || (isCa ? 'Error desconegut.' : 'Error desconocido.');
              setProgress(escapeHtml(errMsg), true);
              btnInstall.disabled = false;
              actionsDiv.querySelector('#btn-content-modal-later').disabled = false;
            }
          });
        }

        try {
          await window.api.installContentUpdate(item.content_id || item.id, { allowTestFixture: isTest && options.allowTestFixture === true });
        } catch (err) {
          if (removeListener) removeListener();
          setProgress(escapeHtml(err && err.message ? err.message : (isCa ? 'Error en la instal·lació.' : 'Error en la instalación.')), true);
          btnInstall.disabled = false;
          actionsDiv.querySelector('#btn-content-modal-later') && (actionsDiv.querySelector('#btn-content-modal-later').disabled = false);
        }
      });
    }
  },

  handleUpdateStatus(state) {
    if (!state || typeof state !== 'object') return;
    const prevStatus = this.updaterState ? this.updaterState.status : null;
    this.updaterState = state;

    if (prevStatus !== state.status) {
      this.updaterBannerDismissedForStatus = null;
    }

    if (this.currentView === 'configuracion' && window.OptionsView && typeof window.OptionsView.updateUpdaterBox === 'function') {
      window.OptionsView.updateUpdaterBox(state);
    }

    // Comprobación automática sin actualización o con error de red: silenciosa (Sección 9A)
    if (state.status === 'IDLE' || state.status === 'CHECKING' || state.status === 'NO_UPDATE') {
      this.dismissGlobalUpdateBanner();
      return;
    }

    if (state.status === 'ERROR') {
      if ((state.silent || state.lastCheckSource === 'auto') && state.errorCode !== 'DOWNLOAD_ERROR') {
        this.dismissGlobalUpdateBanner();
        return;
      }
      if (this.currentView === 'configuracion') {
        this.dismissGlobalUpdateBanner();
        return;
      }
    }

    if (
      (
        state.status === 'UPDATE_AVAILABLE' ||
        state.status === 'DOWNLOADING' ||
        state.status === 'DOWNLOADED' ||
        (state.status === 'ERROR' && state.errorCode === 'DOWNLOAD_ERROR')
      ) &&
      this.updaterBannerDismissedForStatus !== state.status
    ) {
      this.showGlobalUpdateBanner(state);
    }
  },

  dismissGlobalUpdateBanner(markDismissedStatus = null) {
    if (markDismissedStatus) {
      this.updaterBannerDismissedForStatus = markDismissedStatus;
    }
    const existing = document.getElementById('global-update-banner');
    if (existing) existing.remove();
  },

  showGlobalUpdateBanner(state) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    let banner = document.getElementById('global-update-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'global-update-banner';
      banner.style.cssText = 'position: fixed; right: 24px; bottom: 24px; width: 420px; max-width: calc(100vw - 48px); background: #ffffff; border: 2px solid #7c3aed; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.22); padding: 18px 20px; z-index: 9500; font-size: 13.5px; color: var(--text-primary);';
      document.body.appendChild(banner);
    }

    const curVer = escapeHtml(state.currentVersion || '3.1.3');
    const nextVer = escapeHtml(state.availableVersion || '');
    const safeNotes = escapeHtml(state.releaseNotes || (isCa ? 'Sense notes addicionals de la versió.' : 'Sin notas adicionales de la versión.'));

    if (state.status === 'UPDATE_AVAILABLE') {
      banner.innerHTML = `
        <div style="font-weight: 800; font-size: 15px; color: #4c1d95; margin-bottom: 10px;">
          ${isCa ? 'Nova versió disponible' : 'Nueva versión disponible'}
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 13px; margin-bottom: 10px;">
          <div><span class="muted">${isCa ? 'Versió instal·lada:' : 'Versión instalada:'}</span> <b>${curVer}</b></div>
          <div><span class="muted">${isCa ? 'Nova versió:' : 'Nueva versión:'}</span> <b>${nextVer}</b></div>
        </div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.45; margin-bottom: 12px;">
          ${isCa
            ? 'Hi ha una nova versió disponible. Si actualitzes ara, l\'aplicació baixarà l\'actualització, es tancarà per instal·lar-la i es tornarà a obrir automàticament.'
            : 'Hay una nueva versión disponible. Si actualizas ahora, la aplicación descargará la actualización, se cerrará para instalarla y volverá a abrirse automáticamente.'}
        </div>
        <div style="margin-bottom: 14px;">
          <div class="muted" style="font-size: 12px; margin-bottom: 4px;">${isCa ? 'Notes de la versió:' : 'Notas de la versión:'}</div>
          <div style="background: var(--surface-muted); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px; max-height: 110px; overflow-y: auto; white-space: pre-wrap; font-size: 12.5px; line-height: 1.45;">${safeNotes}</div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn small" id="btn-global-update-later">${isCa ? 'MÉS TARD' : 'MÁS TARDE'}</button>
          <button class="btn small primary" id="btn-global-update-download">${isCa ? 'ACTUALITZAR ARA' : 'ACTUALIZAR AHORA'}</button>
        </div>
      `;

      const btnLater = banner.querySelector('#btn-global-update-later');
      const btnDownload = banner.querySelector('#btn-global-update-download');
      if (btnLater) {
        btnLater.addEventListener('click', () => this.dismissGlobalUpdateBanner('UPDATE_AVAILABLE'));
      }
      if (btnDownload) {
        btnDownload.addEventListener('click', async () => {
          btnDownload.disabled = true;
          try {
            await window.api.downloadUpdate();
          } catch (err) {
            console.warn('Error iniciando descarga de actualización:', err);
          }
        });
      }
    } else if (state.status === 'DOWNLOADING') {
      const pct = state.progress && typeof state.progress.percent === 'number' ? state.progress.percent : 0;
      banner.innerHTML = `
        <div style="font-weight: 700; font-size: 14.5px; color: #4c1d95; margin-bottom: 8px;">
          ${isCa ? 'Baixant actualització...' : 'Descargando actualización...'} ${pct} %
        </div>
        <div style="width: 100%; height: 8px; background: #ede9fe; border-radius: 999px; overflow: hidden; margin-bottom: 6px;">
          <div style="width: ${pct}%; height: 100%; background: #7c3aed; transition: width 0.2s ease;"></div>
        </div>
        <div class="muted" style="font-size: 12px;">
          ${isCa
            ? 'En finalitzar la baixada, l\'aplicació es tancarà per instal·lar l\'actualització i es tornarà a obrir automàticament.'
            : 'Al finalizar la descarga, la aplicación se cerrará para instalar la actualización y volverá a abrirse automáticamente.'}
        </div>
      `;
    } else if (state.status === 'DOWNLOADED') {
      banner.innerHTML = `
        <div style="font-weight: 800; font-size: 14.5px; color: #166534; margin-bottom: 6px;">
          ${isCa ? 'Instal·lant actualització i reiniciant automàticament...' : 'Instalando actualización y reiniciando automáticamente...'}
        </div>
        <div style="font-size: 12.5px; color: var(--text-secondary);">
          ${isCa
            ? 'Constructor de Programes Municipals es tancarà uns segons i es tornarà a obrir automàticament.'
            : 'Constructor de Programas Municipales se cerrará unos segundos y volverá a abrirse automáticamente.'}
        </div>
      `;
    } else if (state.status === 'ERROR') {
      const errMsg = escapeHtml(
        (isCa ? (state.errorCa || state.error) : state.error) ||
        (isCa
          ? 'No s\'ha pogut baixar l\'actualització. Pots continuar utilitzant l\'aplicació i tornar-ho a provar més tard.'
          : 'No se ha podido descargar la actualización. Puedes seguir utilizando la aplicación e intentarlo de nuevo más tarde.')
      );
      banner.innerHTML = `
        <div style="font-weight: 800; font-size: 14.5px; color: #991b1b; margin-bottom: 6px;">
          ${isCa ? 'No s\'ha pogut baixar l\'actualització' : 'No se ha podido descargar la actualización'}
        </div>
        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
          ${errMsg}
        </div>
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn small" id="btn-global-update-err-close">${isCa ? 'TANCAR' : 'CERRAR'}</button>
        </div>
      `;
      const btnErrClose = banner.querySelector('#btn-global-update-err-close');
      if (btnErrClose) {
        btnErrClose.addEventListener('click', () => this.dismissGlobalUpdateBanner('ERROR'));
      }
    }
  }
};

// Initialize App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
