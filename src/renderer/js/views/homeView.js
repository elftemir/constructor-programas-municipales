/**
 * homeView.js - Nuevo Dashboard de Inicio (Rediseño UX 7/10/2026)
 * Constructor de Programas Municipales - Versión 1.4.2
 */

const HomeView = {
  bootstrapAttempted: false,
  lastBootstrapResult: null,

  async tryBootstrap(container, force = false) {
    if (!window.api.bootstrapOfficialContent) return App.openContentManager();
    const button = container.querySelector('#btn-clean-find');
    if (button) button.disabled = true;
    this.updateBootstrapProgress({ status: 'CHECKING', bootstrapInProgress: true }, container);
    let result;
    try { result = await window.api.bootstrapOfficialContent(force); }
    catch (_) { result = { status: 'EMPTY', reason: 'CATALOG_ERROR' }; }
    this.lastBootstrapResult = result;
    if (App.currentView && App.currentView !== 'home') return;
    if (result.status === 'READY') await this.render(container);
    else if (result.status === 'AVAILABLE') this.renderContentOffer(container, result.item);
    else this.renderNoSources(container, result.reason);
  },

  updateBootstrapProgress(state, container = document) {
    const progress = container.querySelector('#clean-download-progress');
    if (!progress) return;
    const busy = state.bootstrapInProgress || ['DOWNLOADING', 'VERIFYING', 'INSTALLING'].includes(state.status);
    const percent = Number(state.progress?.percent);
    progress.textContent = busy ? window.i18n.t(state.status === 'CHECKING' ? 'clean_start.checking' : 'clean_start.downloading') + (Number.isFinite(percent) ? ' ' + Math.round(percent) + '%' : '') : '';
  },

  renderContentOffer(container, item) {
    this.renderNoSources(container);
    const lang = window.i18n.getLang();
    const title = typeof item.title === 'object' ? item.title[lang] : item.title;
    const panel = container.querySelector('.empty-state-desc');
    if (panel) panel.textContent = String(title || '') + ' · ' + item.content_version;
    const download = container.querySelector('#btn-clean-find');
    if (download) {
      const replacement = download.cloneNode(true); download.replaceWith(replacement);
      replacement.textContent = window.i18n.t('clean_start.download');
      replacement.addEventListener('click', async () => {
        replacement.disabled = true;
        try { await window.api.installContentUpdate(item.content_id); if (App.currentView === 'home') await this.render(container); }
        catch (_) { this.lastBootstrapResult = {status:'EMPTY',reason:'INSTALL_ERROR'}; if (App.currentView === 'home') this.renderNoSources(container, 'INSTALL_ERROR'); }
      });
    }
  },

  renderNoSources(container, reason = null) {
    container.innerHTML = `
      <div class="view-header"><h1 class="title">${window.i18n.t('clean_start.title')}</h1></div>
      <div class="empty-state-box">
        <div class="empty-state-icon">📚</div>
        <div class="empty-state-desc">${window.i18n.t(reason === 'NO_OFFICIAL_CONTENT' ? 'clean_start.no_official' : reason === 'CATALOG_ERROR' || reason === 'INSTALL_ERROR' ? 'clean_start.connection_error' : 'clean_start.message')}</div>
        <div id="clean-download-progress" role="status" aria-live="polite" style="margin-top:12px;"></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;">
          <button class="btn primary large" id="btn-clean-find">${window.i18n.t('clean_start.find')}</button>
          <button class="btn large" id="btn-clean-import">${window.i18n.t('clean_start.import')}</button>
        </div>
      </div>`;
    container.querySelector('#btn-clean-find')?.addEventListener('click', () => this.tryBootstrap(container, true));
    container.querySelector('#btn-clean-import')?.addEventListener('click', () => window.ImportReviewView.openImportModal());
  },

  async render(container) {
    const projects = await window.api.getProjects();
    const sources = await window.api.getSourcePrograms(false);
    if (sources.length === 0) {
      if (this.lastBootstrapResult?.status === 'AVAILABLE') this.renderContentOffer(container, this.lastBootstrapResult.item);
      else this.renderNoSources(container, this.lastBootstrapResult?.reason);
      if (!this.bootstrapAttempted && window.api.bootstrapOfficialContent) {
        this.bootstrapAttempted = true;
        await this.tryBootstrap(container);
      }
      return;
    }
    const lastProjectId = await window.api.getLastOpenedProjectId();
    
    // Cargar e hidratar completamente el programa protagonista con todas sus áreas
    let current = App.currentProject;
    if (!current || !current.areas) {
      let targetId = App.currentProject?.id || lastProjectId;
      if (!targetId && projects.length > 0) {
        targetId = projects[0].id;
      }
      if (targetId) {
        current = await window.api.getProject(targetId);
        if (current) {
          App.currentProject = current;
          App.updateTopBar(current);
        }
      }
    }

    const isCa = window.i18n && window.i18n.getLang() === 'ca';

    // 1. Estado vacío: no hay programas todavía
    if (!current || projects.length === 0) {
      container.innerHTML = `
        <div class="view-header">
          <div class="view-header-left">
            <h1 class="title">${isCa ? 'Inici · Constructor de Programes Municipals' : 'Inicio · Constructor de Programas Municipales'}</h1>
            <p class="subtitle">${isCa ? 'Construcció autònoma i bilingüe de candidatures municipals.' : 'Construcción autónoma y bilingüe de candidaturas municipales.'}</p>
          </div>
        </div>

        <div class="empty-state-box">
          <div class="empty-state-icon">🏛️</div>
          <div class="empty-state-title">${isCa ? 'Encara no tens cap programa municipal' : 'Aún no tienes ningún programa municipal'}</div>
          <div class="empty-state-desc">
            ${isCa ? 'Crea el teu primer programa municipal a partir del catàleg marc oficial de Podem Catalunya o importa un projecte existent per començar a treballar.' : 'Crea tu primer programa municipal a partir del catálogo marco oficial de Podem Catalunya o importa un proyecto existente para comenzar a trabajar.'}
          </div>
          <div style="display: flex; gap: 12px; margin-top: 18px;">
            <button class="btn primary large" id="btn-home-create-first">
              ${isCa ? '+ Nou programa municipal' : '+ Nuevo programa municipal'}
            </button>
            <button class="btn large" id="btn-home-import-first">
              ${isCa ? 'Importar programa (.json)' : 'Importar programa (.json)'}
            </button>
          </div>
        </div>
      `;

      container.querySelector('#btn-home-create-first')?.addEventListener('click', () => App.showCreateProjectModal());
      container.querySelector('#btn-home-import-first')?.addEventListener('click', () => App.importProject());
      return;
    }

    // 2. Hay programa activo: Dashboard Protagonista
    const stats = current.stats || {
      total_marco: 0,
      decididas: 0,
      progreso_pct: 0,
      incluidas: 0,
      adaptadas: 0,
      descartadas: 0,
      en_duda: 0,
      sin_revisar: 0
    };

    const areasWithContent = (current.areas || []).filter(a => {
      const hasMedidas = (a.medidas || []).some(m => m.decision && ['incluida', 'adaptada'].includes(m.decision.estado));
      const hasPropias = (a.medidas_propias || []).length > 0;
      return hasMedidas || hasPropias;
    }).length;

    const updatedDate = new Date(current.updated_at || Date.now()).toLocaleDateString(isCa ? 'ca-ES' : 'es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Detectar último trabajo (última medida decidida o adaptada)
    let lastWorkInfo = null;
    for (const a of current.areas || []) {
      const decided = (a.medidas || []).find(m => m.decision && m.decision.estado !== 'sin_revisar');
      if (decided) {
        lastWorkInfo = {
          areaId: a.id,
          areaNombre: isCa ? (a.nombre_ca || a.nombre) : (a.nombre_es || a.nombre),
          medidaTitulo: isCa ? (decided.titulo_ca || decided.titulo) : (decided.titulo_es || decided.titulo)
        };
        break;
      }
    }

    let fuenteNombre = window.i18n.t('clean_start.no_active');
    try {
      const fuentes = await window.api.getSourcePrograms(true);
      const currentFuente = fuentes.find(f => f.id === current.fuente_id);
      if (currentFuente) fuenteNombre = currentFuente.nombre;
    } catch (e) {}

    const logoUrl = safeLogoUrl(current.logo_path);

    container.innerHTML = `
      <div class="view-header" style="margin-bottom: 20px;">
        <div class="view-header-left">
          <h1 class="title">${isCa ? 'Inici' : 'Inicio'}</h1>
          <p class="subtitle">${isCa ? 'Panell de control del teu programa municipal electoral.' : 'Panel de control de tu programa municipal electoral.'}</p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 10px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <button class="btn" id="btn-goto-fuentes" title="${isCa ? 'Gestionar programes font' : 'Gestionar programas fuente'}">
            📚 ${isCa ? 'Programes font' : 'Programas fuente'}
          </button>
          <button class="btn" id="btn-goto-all-programs" title="${isCa ? 'Veure la llista completa de programes' : 'Ver la lista completa de programas'}">
            📁 ${isCa ? 'Els meus programes' : 'Mis programas'} (${projects.length})
          </button>
        </div>
      </div>

      <!-- Tarjeta Principal Hero: El programa actual es protagonista -->
      <div class="dashboard-hero">
        <div>
          <span class="badge" style="background: #ede9fe; color: #6b21a8; font-weight: 700; font-size: 11.5px; padding: 3px 8px; border-radius: var(--radius-sm); border: 1px solid #c4b5fd;">
            ${isCa ? 'Programa Municipal Actiu' : 'Programa Municipal Activo'}
          </span>
          <div class="dashboard-hero-title" style="margin-top: 8px;">
            ${escapeHtml(current.municipio || (isCa ? 'Sense municipi' : 'Sin municipio'))}
          </div>
          <div style="font-size: 14.5px; color: var(--text-secondary); margin-bottom: 10px; font-weight: 500;">
            ${escapeHtml(current.organizacion || `${current.partido || 'Podemos'} ${current.municipio || ''}`.trim())}
          </div>

          <div class="dashboard-hero-meta">
            <div class="meta-item">
              <span>🗳️</span> <b>${escapeHtml(current.mandato || '2027–2031')}</b>
            </div>
            <div class="meta-item" title="${isCa ? 'Programa font de referència' : 'Programa fuente de referencia'}">
              <span>📚</span> <b>${escapeHtml(fuenteNombre)}</b>
            </div>
            <div class="meta-item">
              <span>📍</span> <span>${escapeHtml(current.provincia || 'Cataluña')}</span>
            </div>
            <div class="meta-item">
              <span>📋</span> <span><b>${areasWithContent} de 12</b> ${isCa ? 'àrees amb contingut' : 'áreas con contenido'}</span>
            </div>
            <div class="meta-item">
              <span>✓</span> <span>${isCa ? 'Programa actual:' : 'Programa actual:'} <b>${stats.incluidas + stats.adaptadas}</b> ${isCa ? 'mesures' : 'medidas'} (${stats.incluidas} ${isCa ? 'incloses' : 'incluidas'}, ${stats.adaptadas} ${isCa ? 'adaptades' : 'adaptadas'})</span>
            </div>
            <div class="meta-item">
              <span>🕒</span> <span>${isCa ? 'Darrera edició:' : 'Última edición:'} ${updatedDate}</span>
            </div>
          </div>

          <div style="display: flex; gap: 12px; align-items: center; margin-top: 8px;">
            <button class="btn primary large" id="btn-hero-continue" style="padding: 12px 24px; font-size: 15px; font-weight: 700;">
              ${isCa ? 'Continuar treballant →' : 'Continuar trabajando →'}
            </button>
            <button class="btn large" id="btn-hero-datos-basicos">
              ⚙ ${isCa ? 'Dades del municipi' : 'Datos del municipio'}
            </button>
          </div>
        </div>

        <!-- Composición gráfica del municipio -->
        <div class="municipio-composition">
          ${logoUrl ? `
            <img src="${escapeHtml(logoUrl)}" alt="Logo local" style="max-height: 85px; max-width: 100%; object-fit: contain; margin-bottom: 8px;">
            <div class="municipio-composition-name">${escapeHtml(current.municipio)}</div>
          ` : `
            <div class="municipio-composition-icon">🏛️</div>
            <div class="municipio-composition-name">${escapeHtml(current.municipio || 'Catalunya')}</div>
            <div class="municipio-composition-sub">
              ${current.codigo_ine ? `INE ${escapeHtml(current.codigo_ine)} · ` : ''}${Number(current.habitantes || current.poblacion_oficial || 0).toLocaleString('es-ES')} hab.
            </div>
          `}
          <div style="font-size: 11px; margin-top: 8px; color: #6b21a8; font-weight: 600; background: rgba(255,255,255,0.7); padding: 2px 8px; border-radius: 10px;">
            ${escapeHtml(current.partido || 'Podemos')} · ${current.idioma_principal === 'ca' ? 'Català' : 'Castellano'}
          </div>
        </div>
      </div>

      <!-- Accesos Rápidos en Inicio -->
      <div style="margin-bottom: 12px;">
        <h2 class="section-title" style="font-size: 17px; margin-bottom: 12px;">
          ${isCa ? 'Accessos ràpids' : 'Accesos rápidos'}
        </h2>
      </div>

      <div class="quick-shortcuts-grid">
        <div class="quick-shortcut-card" id="card-shortcut-areas">
          <div class="quick-shortcut-icon" style="background: #ede9fe; color: #6b21a8;">📋</div>
          <div class="quick-shortcut-info">
            <h3>${isCa ? 'Àrees i mesures' : 'Áreas y medidas'}</h3>
            <p>${isCa ? 'Revisa les àrees i decideix propostes' : 'Revisa las áreas y decide propuestas'}</p>
          </div>
        </div>

        <div class="quick-shortcut-card" id="card-shortcut-preview">
          <div class="quick-shortcut-icon" style="background: #e0f2fe; color: #0284c7;">👁</div>
          <div class="quick-shortcut-info">
            <h3>${isCa ? 'Vista prèvia del document' : 'Vista previa del documento'}</h3>
            <p>${isCa ? 'Mosaico de pàgines maquetades reals' : 'Mosaico de páginas maquetadas reales'}</p>
          </div>
        </div>

        <div class="quick-shortcut-card" id="card-shortcut-export">
          <div class="quick-shortcut-icon" style="background: #f0fdf4; color: #16a34a;">📄</div>
          <div class="quick-shortcut-info">
            <h3>${isCa ? 'Generar documents Word' : 'Generar documentos Word'}</h3>
            <p>${isCa ? 'Exporta el .docx oficial llest per imprimir' : 'Exporta el .docx oficial listo para imprimir'}</p>
          </div>
        </div>
      </div>

      <!-- Último trabajo -->
      <div class="last-work-box">
        <div>
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 4px;">
            ${isCa ? 'Darrer treball' : 'Último trabajo'}
          </div>
          ${lastWorkInfo ? `
            <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">
              ${escapeHtml(lastWorkInfo.areaNombre)} <span style="color: var(--text-secondary); font-weight: 400;">›</span> ${escapeHtml(lastWorkInfo.medidaTitulo)}
            </div>
            <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
              ${isCa ? 'Continua la revisió de mesures en aquest bloc temàtic.' : 'Continúa la revisión de medidas en este bloque temático.'}
            </div>
          ` : `
            <div style="font-size: 15px; font-weight: 600; color: var(--text-secondary);">
              ${isCa ? 'Encara no has començat a revisar mesures en aquest programa.' : 'Aún no has comenzado a revisar medidas en este programa.'}
            </div>
          `}
        </div>
        <button class="btn primary" id="btn-continue-last-work">
          ${isCa ? 'Continuar aquí →' : 'Continuar aquí →'}
        </button>
      </div>

      <!-- Actualizaciones (Fase 3.4A + 3.4B) -->
      <div id="home-updates-zone" style="margin-top: 20px;"></div>
    `;

    // Poblar zona de actualizaciones con estados actuales si disponibles
    const appState = (window.App && window.App.updaterState) ? window.App.updaterState : null;
    const contentState = (window.App && window.App.contentUpdaterState) ? window.App.contentUpdaterState : null;
    HomeView.updateHomeUpdatesZone(appState, contentState);

    this.bindEvents(container, current, lastWorkInfo);
  },

  updateHomeUpdatesZone(appState, contentState) {
    const zone = document.getElementById('home-updates-zone');
    if (!zone) return;
    const isCa = window.i18n && window.i18n.getLang() === 'ca';

    // Determine app update block
    const appStatus = appState && appState.status ? appState.status : 'IDLE';
    let appHtml = '';
    if (appStatus === 'UPDATE_AVAILABLE' || appStatus === 'DOWNLOADING' || appStatus === 'DOWNLOADED') {
      const nextVer = escapeHtml(appState.availableVersion || '');
      const pct = (appStatus === 'DOWNLOADING' && appState.progress) ? ` ${Math.round(appState.progress.percent || 0)} %` : '';
      const label = appStatus === 'UPDATE_AVAILABLE'
        ? `v${nextVer} ${isCa ? 'disponible' : 'disponible'}`
        : appStatus === 'DOWNLOADING'
          ? (isCa ? `Baixant...${pct}` : `Descargando...${pct}`)
          : (isCa ? 'Instal·lant...' : 'Instalando...');
      appHtml = `<span style="color:#4c1d95;font-weight:700;">${label}</span>`;
    } else if (appStatus === 'NO_UPDATE') {
      appHtml = `<span style="color:#166534;">${isCa ? 'Actualitzat' : 'Actualizada'}</span>`;
    } else {
      appHtml = `<span style="color:var(--text-muted);">${isCa ? 'Comprovació pendent' : 'Verificación pendiente'}</span>`;
    }

    // Determine content update block
    const ctStatus = contentState && contentState.status ? contentState.status : 'IDLE';
    let ctHtml = '';
    let ctBtn = '';
    const officialItems = (contentState?.availableItems || []).filter(item => item.official === true && item.is_test_fixture !== true);
    if (ctStatus === 'AVAILABLE' && officialItems.length > 0) {
      ctHtml = `<span style="color:#0284c7;font-weight:700;">${isCa ? 'Nou contingut disponible' : 'Nuevo contenido disponible'}</span>`;
      ctBtn = `<button class="btn small" id="btn-home-view-content" style="margin-left:10px;border-color:#0284c7;color:#0284c7;font-size:11px;padding:3px 8px;">${isCa ? 'VER' : 'VER'}</button>`;
    } else if (ctStatus === 'INSTALLED') {
      ctHtml = `<span style="color:#166534;">${isCa ? 'Contingut actualitzat' : 'Contenido actualizado'}</span>`;
    } else if (ctStatus === 'CHECKING') {
      ctHtml = `<span style="color:var(--text-muted);">${isCa ? 'Comprovant...' : 'Comprobando...'}</span>`;
    } else {
      ctHtml = `<span style="color:var(--text-muted);">${isCa ? 'Contingut actualitzat' : 'Contenido actualizado'}</span>`;
    }

    zone.innerHTML = `
      <div style="background:white;border:1px solid var(--border-subtle);border-radius:10px;padding:14px 18px;display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
        <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.05em;min-width:90px;">
          ${isCa ? 'Actualitzacions' : 'Actualizaciones'}
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <span style="font-weight:700;color:var(--text-secondary);font-size:11.5px;text-transform:uppercase;letter-spacing:0.04em;">${isCa ? 'APLICACIÓ' : 'APLICACIÓN'}</span>
          ${appHtml}
        </div>
        <div style="width:1px;height:20px;background:var(--border-divider);"></div>
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <span style="font-weight:700;color:var(--text-secondary);font-size:11.5px;text-transform:uppercase;letter-spacing:0.04em;">${isCa ? 'CONTINGUTS' : 'CONTENIDOS'}</span>
          ${ctHtml}${ctBtn}
        </div>
        <div style="margin-left:auto;">
          <button class="btn small" id="btn-home-goto-options" style="font-size:11.5px;padding:4px 10px;">${isCa ? 'Opcions' : 'Opciones'} ›</button>
        </div>
      </div>
    `;

    // Bind events in zone
    zone.querySelector('#btn-home-goto-options')?.addEventListener('click', () => {
      if (window.App) window.App.navigateTo('opciones', { focusSection: 'updates' });
    });
    zone.querySelector('#btn-home-view-content')?.addEventListener('click', () => {
      if (window.App && contentState && contentState.availableItems && contentState.availableItems.length > 0) {
        window.App.showContentUpdateDetailModal(officialItems[0]);
      }
    });
  },

  bindEvents(container, current, lastWorkInfo) {
    container.querySelector('#btn-help-this-screen')?.addEventListener('click', () => {
      if (window.Tutorial) window.Tutorial.startSectionTour('home');
    });

    container.querySelector('#btn-goto-fuentes')?.addEventListener('click', () => {
      App.navigateTo('fuentes');
    });

    container.querySelector('#btn-goto-all-programs')?.addEventListener('click', () => {
      App.navigateTo('mis-programas');
    });

    container.querySelector('#btn-hero-continue')?.addEventListener('click', () => {
      App.navigateTo('areas-medidas');
    });

    container.querySelector('#btn-hero-datos-basicos')?.addEventListener('click', () => {
      App.navigateTo('datos-basicos');
    });

    container.querySelector('#card-shortcut-areas')?.addEventListener('click', () => {
      App.navigateTo('areas-medidas');
    });

    container.querySelector('#card-shortcut-preview')?.addEventListener('click', () => {
      App.navigateTo('vista-previa');
    });

    container.querySelector('#card-shortcut-export')?.addEventListener('click', () => {
      App.navigateTo('generar-documentos');
    });

    container.querySelector('#btn-continue-last-work')?.addEventListener('click', () => {
      if (lastWorkInfo) {
        ChooseMeasuresView.currentAreaId = lastWorkInfo.areaId;
      }
      App.navigateTo('areas-medidas');
    });
  }
};

window.HomeView = HomeView;

