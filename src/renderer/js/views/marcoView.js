/**
 * marcoView.js - Vista de Consulta del Programa Marco Bilingüe (Solo lectura)
 * Constructor de Programas Municipales - Versión 1.3.0
 */

const MarcoView = {
  catalogData: null,
  currentAreaId: null,
  searchQuery: '',
  viewLang: 'es', // 'es' or 'ca'

  async render(container) {
    if (!this.catalogData) {
      this.catalogData = await window.api.getCatalogInfo();
    }

    const appLang = window.i18n ? window.i18n.getLang() : 'es';
    if (!this.viewLang) {
      this.viewLang = appLang;
    }
    const isCa = this.viewLang === 'ca';

    const { info, areas = [] } = this.catalogData || {};

    if (!areas || areas.length === 0) {
      container.innerHTML = `
        <div class="view-header">
          <div class="view-header-left">
            <h1 class="title">Programa Marco</h1>
            <p class="subtitle">${isCa ? 'Cap catàleg instal·lat actualment.' : 'Ningún catálogo instalado actualmente.'}</p>
          </div>
        </div>
        <div class="empty-state-box" style="background: white; border: 1px solid var(--border-subtle); border-radius: 12px; padding: 48px 24px; text-align: center; margin-top: 10px;">
          <div style="font-size: 42px; margin-bottom: 12px;">📚</div>
          <h2 style="font-size: 18px; font-weight: 800; color: #1e1b4b; margin: 0 0 8px;">
            ${isCa ? 'No hi ha cap Programa Marc instal·lat' : 'No hay ningún Programa Marco instalado'}
          </h2>
          <p style="font-size: 14px; color: var(--text-secondary); max-width: 540px; margin: 0 auto 20px; line-height: 1.5;">
            ${isCa
              ? 'Pots descarregar un Programa Marc oficial des del menú de configuració o importar un document propi des de la gestió de fonts.'
              : 'Puedes descargar un Programa Marco oficial desde el menú de opciones o importar un documento propio desde la gestión de fuentes.'}
          </p>
          <div style="display: flex; justify-content: center; gap: 12px;">
            <button class="btn primary" id="btn-marco-empty-check" style="background: #0284c7; border-color: #0369a1; font-weight: 700;">
              <span>🌐</span> ${isCa ? 'Cercar continguts oficials' : 'Buscar contenidos oficiales'}
            </button>
            <button class="btn" id="btn-marco-empty-sources" style="font-weight: 700;">
              <span>📚</span> ${isCa ? 'Gestió de fonts' : 'Gestión de fuentes'}
            </button>
          </div>
        </div>
      `;
      container.querySelector('#btn-marco-empty-check')?.addEventListener('click', () => {
        App.navigateTo('configuracion');
        setTimeout(() => document.querySelector('#btn-check-content-updates')?.click(), 150);
      });
      container.querySelector('#btn-marco-empty-sources')?.addEventListener('click', () => {
        App.navigateTo('fuentes-programa');
      });
      return;
    }

    if (!this.currentAreaId && areas.length > 0) {
      this.currentAreaId = areas[0].id;
    }

    const currentArea = areas.find(a => a.id === this.currentAreaId) || areas[0];

    let measures = currentArea ? currentArea.medidas : [];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      measures = measures.filter(m => {
        const tit = ((isCa ? m.titulo_ca : m.titulo_es) || m.titulo || '').toLowerCase();
        const txt = ((isCa ? m.texto_ca : m.texto_es) || m.texto || '').toLowerCase();
        const exp = ((isCa ? m.explicacion_ca : m.explicacion_es) || m.explicacion || '').toLowerCase();
        return tit.includes(q) || txt.includes(q) || exp.includes(q);
      });
    }

    const areaName = currentArea ? (isCa ? (currentArea.nombre_ca || currentArea.nombre) : (currentArea.nombre_es || currentArea.nombre)) : '';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="label" style="color: var(--action-link);">
            ${isCa ? 'Catàleg oficial únic (Castellà / Català)' : 'Catálogo oficial único (Castellano / Catalán)'}
          </div>
          <h1 class="title">Programa Marco 2023–2027</h1>
          <p class="subtitle">
            ${window.i18n.t('framework.subtitle')}
          </p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 10px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <!-- Selector de idioma de visualización del marco -->
          <div style="display: flex; background: var(--surface-muted); padding: 3px; border-radius: var(--radius-default); border: 1px solid var(--border-subtle);">
            <button class="btn small ${!isCa ? 'primary' : 'link'}" id="btn-marco-lang-es" style="${!isCa ? '' : 'color: var(--text-secondary);'}">Castellano</button>
            <button class="btn small ${isCa ? 'primary' : 'link'}" id="btn-marco-lang-ca" style="${isCa ? '' : 'color: var(--text-secondary);'}">Català</button>
          </div>

          ${App.currentProject ? `
            <button class="btn primary" id="btn-return-project">
              ${isCa ? 'Tornar al meu programa municipal →' : 'Volver a mi programa municipal →'}
            </button>
          ` : `
            <button class="btn" id="btn-return-home">
              ${isCa ? 'Tornar a l’inici' : 'Volver al inicio'}
            </button>
          `}
        </div>
      </div>

      <!-- Barra de pestañas horizontales de las 12 áreas -->
      <div class="tabs-wrap">
        <button class="tab-nav-arrow" id="btn-marco-prev" aria-label="Anterior">‹</button>
        <div class="tabs-scroll-container" id="tabs-scroll-marco">
          ${areas.map(a => {
            const aName = isCa ? (a.nombre_ca || a.nombre) : (a.nombre_es || a.nombre);
            return `
              <button class="tab-btn ${a.id === this.currentAreaId ? 'active' : ''}" data-area-id="${a.id}">
                ${escapeHtml(aName)}
              </button>
            `;
          }).join('')}
        </div>
        <button class="tab-nav-arrow" id="btn-marco-next" aria-label="Siguiente">›</button>
      </div>

      <!-- Toolbar de búsqueda -->
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" class="input" id="input-search-marco" placeholder="${isCa ? `Cercar a ${escapeHtml(areaName)}…` : `Buscar en ${escapeHtml(areaName)}…`}" value="${escapeHtml(this.searchQuery)}">
        </div>
        <span class="muted" style="margin-left: auto;">
          ${measures.length} ${isCa ? 'mesures en aquesta àrea (Total marc: 123)' : 'medidas en este área (Total marco: 123)'}
        </span>
      </div>

      <!-- Lista de medidas oficiales del catálogo -->
      <section class="card" style="margin-bottom: 24px;">
        ${measures.length === 0 ? `
          <div style="padding: 36px; text-align: center;" class="muted">
            ${isCa ? 'No s\'han trobat mesures.' : 'No se encontraron medidas.'}
          </div>
        ` : measures.map(m => {
          const tit = isCa ? (m.titulo_ca || m.titulo_es || m.titulo) : (m.titulo_es || m.titulo);
          const txt = isCa ? (m.texto_ca || m.texto_es || m.texto) : (m.texto_es || m.texto);
          const exp = isCa ? (m.explicacion_ca || m.explicacion_es || m.explicacion) : (m.explicacion_es || m.explicacion);

          return `
            <div style="padding: 18px 22px; border-bottom: 1px solid var(--border-divider);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="kbd" style="font-size: 11px;">${escapeHtml(m.codigo || m.id)}</span>
                  <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary);">
                    ${escapeHtml(tit || (isCa ? '(Mesura sense títol)' : '(Medida sin título)'))}
                  </h3>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span class="badge" style="background: #ecfdf5; color: #047857; font-size: 11px;">
                    ${isCa ? 'Bilingüe 1-a-1' : 'Bilingüe 1-a-1'}
                  </span>
                  ${m.dudoso ? `<span class="chip doubt" style="font-size: 11px;">${isCa ? 'Revisió' : 'Revisión'}</span>` : ''}
                </div>
              </div>

              <p style="margin: 6px 0 0; line-height: 1.5; color: var(--text-primary); font-size: 14px;">${escapeHtml(txt || '')}</p>

              ${exp ? `
                <div style="margin-top: 8px; font-size: 13px; color: var(--text-secondary); background: var(--surface-muted); padding: 8px 12px; border-radius: var(--radius-sm);">
                  <b>${isCa ? 'Context / detall:' : 'Contexto / detalle:'}</b> ${escapeHtml(exp)}
                </div>
              ` : ''}

              ${m.dudoso && m.motivo_duda ? `
                <div class="notice" style="margin-top: 8px; font-size: 12px; padding: 6px 10px;">
                  <b>${isCa ? 'Observació del catàleg:' : 'Observación del catálogo:'}</b> ${escapeHtml(m.motivo_duda)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </section>

      <!-- Preparación arquitectónica Fase 2: Estados de traducción -->
      <div class="card" style="padding: 20px; background: #faf5ff; border: 1px solid #e9d5ff; margin-bottom: 24px;">
        <div style="font-weight: 700; font-size: 14px; color: #6b21a8; margin-bottom: 6px;">
          ${isCa ? 'Arquitectura de traducció i importació multillengua (Fase 2):' : 'Arquitectura de traducción e importación multilenguaje (Fase 2):'}
        </div>
        <div style="font-size: 13px; color: #4b5563; line-height: 1.6;">
          ${isCa
            ? 'El model de dades suporta la importació de programes en un o dos idiomes i els 5 estats de cicle de vida de traducció previstos: <code>original</code>, <code>sin_traduccion</code>, <code>traduccion_propuesta</code>, <code>revisada</code> i <code>desactualizada</code>.'
            : 'El modelo de datos soporta la importación de programas en uno o dos idiomas y los 5 estados de ciclo de vida de traducción previstos: <code>original</code>, <code>sin_traduccion</code>, <code>traduccion_propuesta</code>, <code>revisada</code> y <code>desactualizada</code>.'}
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    const btnHelpScreen = container.querySelector('#btn-help-this-screen');
    if (btnHelpScreen) {
      btnHelpScreen.addEventListener('click', () => {
        if (window.Tutorial) window.Tutorial.startSectionTour('framework');
      });
    }

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentAreaId = btn.dataset.areaId;
        this.render(container);
      });
    });

    const scrollContainer = container.querySelector('#tabs-scroll-marco');
    const btnPrev = container.querySelector('#btn-marco-prev');
    const btnNext = container.querySelector('#btn-marco-next');

    if (btnPrev && scrollContainer) {
      btnPrev.addEventListener('click', () => scrollContainer.scrollBy({ left: -220, behavior: 'smooth' }));
    }
    if (btnNext && scrollContainer) {
      btnNext.addEventListener('click', () => scrollContainer.scrollBy({ left: 220, behavior: 'smooth' }));
    }

    const searchInput = container.querySelector('#input-search-marco');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render(container);
      });
    }

    const btnLangEs = container.querySelector('#btn-marco-lang-es');
    if (btnLangEs) {
      btnLangEs.addEventListener('click', () => {
        this.viewLang = 'es';
        this.render(container);
      });
    }

    const btnLangCa = container.querySelector('#btn-marco-lang-ca');
    if (btnLangCa) {
      btnLangCa.addEventListener('click', () => {
        this.viewLang = 'ca';
        this.render(container);
      });
    }

    const btnRetProj = container.querySelector('#btn-return-project');
    if (btnRetProj) btnRetProj.addEventListener('click', () => App.navigateTo('elegir-medidas'));

    const btnRetHome = container.querySelector('#btn-return-home');
    if (btnRetHome) btnRetHome.addEventListener('click', () => App.navigateTo('home'));
  }
};

window.MarcoView = MarcoView;
