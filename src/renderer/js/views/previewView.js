/**
 * previewView.js - Vista Previa Paginada (Mosaico A4 y Lector Zoom Aprobado Bloque B)
 * Constructor de Programas Municipales - Versión 1.4.2
 */

const PreviewView = {
  currentZoomPageIndex: 0,
  pages: [],

  async render(container, project) {
    if (!project) return;

    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    this.pages = this.buildDocumentPages(project, isCa);

    // Compute metrics
    let totalIncluded = 0;
    let totalDoubts = 0;
    let areasWithContent = 0;
    let emptyAreas = 0;

    (project.areas || []).forEach(a => {
      const inc = (a.medidas || []).filter(m => m.decision?.estado === 'incluida' || m.decision?.estado === 'adaptada').length
                + (a.medidas_propias || []).filter(p => p.estado === 'incluida' || p.estado === 'adaptada' || (!p.estado && p.estado !== 'sin_revisar' && p.estado !== 'en_duda')).length;
      const dbt = (a.medidas || []).filter(m => m.decision?.estado === 'en_duda').length;
      totalIncluded += inc;
      totalDoubts += dbt;
      if (inc > 0) areasWithContent++;
      else emptyAreas++;
    });

    container.innerHTML = `
      <div class="view-header" style="margin-bottom: 16px;">
        <div class="view-header-left">
          <h1 class="title">${isCa ? 'Vista prèvia del programa' : 'Vista previa del programa'}</h1>
          <p class="subtitle">${isCa ? 'Visualitza la distribució real del contingut per pàgines abans de generar el Word.' : 'Visualiza la distribución real del contenido por páginas antes de generar el Word.'}</p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 10px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <button class="btn" id="btn-back-to-measures">
            ← ${isCa ? 'Tornar a revisar' : 'Volver a revisar'}
          </button>
          <button class="btn primary" id="btn-go-to-export" style="padding: 10px 18px; font-weight: 700;">
            📄 ${isCa ? 'Generar i exportar Word (.docx)' : 'Generar y exportar Word (.docx)'}
          </button>
        </div>
      </div>

      <!-- Barra de métricas y avisos -->
      <section class="card" style="padding: 14px 20px; margin-bottom: 20px; background: var(--surface-panel); border: 1px solid var(--border-subtle);">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 13px; font-weight: 600; padding: 5px 10px;">
            ✓ ${totalIncluded} ${isCa ? 'mesures incloses' : 'medidas incluidas'}
          </span>
          <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-size: 13px; font-weight: 600; padding: 5px 10px;">
            📁 ${areasWithContent} ${isCa ? 'àrees amb contingut' : 'áreas con contenido'} (${project.areas?.length || 12} ${isCa ? 'totals' : 'totales'})
          </span>
          <span class="badge" style="background: #eff6ff; color: #1e40af; font-size: 13px; font-weight: 600; padding: 5px 10px;">
            📄 ${this.pages.length} ${isCa ? 'pàgines estimades' : 'páginas estimadas'}
          </span>

          ${totalDoubts > 0 ? `
            <span class="badge" style="background: #fffbeb; color: #b45309; font-size: 12.5px; font-weight: 600; padding: 5px 10px; margin-left: auto;">
              ⚠️ ${totalDoubts} ${isCa ? 'mesures en dubte (no s\'inclouran al Word final)' : 'medidas en duda (no se incluirán en el Word final)'}
            </span>
          ` : ''}

          ${emptyAreas > 0 ? `
            <span class="badge" style="background: #fef2f2; color: #991b1b; font-size: 12.5px; font-weight: 500; padding: 5px 10px;">
              ℹ ${emptyAreas} ${isCa ? 'àrees sense cap mesura seleccionada' : 'áreas sin ninguna medida seleccionada'}
            </span>
          ` : ''}
        </div>
      </section>

      <!-- MOSAICO DE PÁGINAS -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;">
          ${isCa ? 'Mosaico de pàgines del document' : 'Mosaico de páginas del documento'}
        </h2>
        <span class="muted" style="font-size: 13px;">
          ${isCa ? 'Fes clic sobre qualsevol pàgina per obrir el Lector ampliat' : 'Haz clic sobre cualquier página para abrir el Lector ampliado'}
        </span>
      </div>

      <div class="preview-mosaic-grid">
        ${this.pages.map((p, idx) => this.renderThumbnail(p, idx, isCa)).join('')}
      </div>

      <!-- Lector de páginas (Modal zoom) -->
      <div id="preview-zoom-modal-container" style="display: none;"></div>
    `;

    this.bindEvents(container, project, isCa);
  },

  buildDocumentPages(project, isCa) {
    const pages = [];
    let pageNum = 1;
    const currentLang = isCa ? 'ca' : 'es';

    // 1. Portada
    pages.push({
      num: pageNum++,
      type: 'portada',
      title: isCa ? 'PORTADA' : 'PORTADA',
      lema: project.lema || 'POLÍTICAS HONESTAS',
      municipio: project.municipio || (isCa ? 'MUNICIPI' : 'MUNICIPIO'),
      mandato: project.mandato || '2027–2031',
      partido: project.partido || 'Podemos',
      organizacion: project.organizacion || '',
      logo_path: project.logo_path || null
    });

    // 2. Sumario / Índice
    const tocItems = [];
    const presData = (project.textos_generales?.presentacion && (project.textos_generales.presentacion[currentLang] || project.textos_generales.presentacion[project.idioma_principal])) || {};
    const presEntradilla = (presData.entradilla || project.textos_generales?.presentacion_entradilla || '').trim();
    const presParrafos = (presData.parrafos || project.textos_generales?.presentacion_parrafos || []).filter(p => p && p.trim());
    const presTitulo = presData.titulo || project.textos_generales?.presentacion_titulo || (isCa ? 'Presentació' : 'Presentación');
    const hasPresentationContent = Boolean(presEntradilla.length > 0 || presParrafos.length > 0);
    if (hasPresentationContent) {
      tocItems.push({ title: presTitulo });
    }

    (project.areas || []).forEach(a => {
      const incCount = (a.medidas || []).filter(m => m.decision?.estado === 'incluida' || m.decision?.estado === 'adaptada').length
                     + (a.medidas_propias || []).filter(p => p.estado === 'incluida' || p.estado === 'adaptada' || (!p.estado && p.estado !== 'sin_revisar' && p.estado !== 'en_duda')).length;
      if (incCount > 0) {
        const areaName = isCa ? (a.nombre_ca || a.nombre) : (a.nombre_es || a.nombre);
        tocItems.push({ title: areaName, count: incCount });
      }
    });

    const cierreData = (project.textos_generales?.cierre && (project.textos_generales.cierre[currentLang] || project.textos_generales.cierre[project.idioma_principal])) || {};
    const cierreParrafos = (cierreData.parrafos || project.textos_generales?.cierre_parrafos || []).filter(p => p && p.trim());
    const cierreTitulo = cierreData.titulo || project.textos_generales?.cierre_titulo || (isCa ? 'Clausura' : 'Cierre');
    const hasCierre = cierreParrafos.length > 0;
    if (hasCierre) {
      tocItems.push({ title: cierreTitulo });
    }

    pages.push({
      num: pageNum++,
      type: 'indice',
      title: isCa ? 'ÍNDEX DE CONTINGUTS' : 'ÍNDICE DE CONTENIDOS',
      items: tocItems
    });

    // 3. Presentación (si existe contenido real)
    if (hasPresentationContent) {
      pages.push({
        num: pageNum++,
        type: 'presentacion',
        title: presTitulo,
        entradilla: presEntradilla,
        parrafos: presParrafos
      });
    }

    // 4. Áreas con medidas
    (project.areas || []).forEach((a, aIdx) => {
      const includedMeasures = [
        ...(a.medidas || []).filter(m => m.decision?.estado === 'incluida' || m.decision?.estado === 'adaptada'),
        ...(a.medidas_propias || []).filter(p => p.estado === 'incluida' || p.estado === 'adaptada' || (!p.estado && p.estado !== 'sin_revisar' && p.estado !== 'en_duda')).map(p => ({ ...p, is_propia: true }))
      ];

      if (includedMeasures.length === 0) return;

      const rawIntro = project.textos_generales?.introducciones_areas?.[a.id];
      let intro = '';
      let fraseDestacada = '';
      if (typeof rawIntro === 'object' && rawIntro !== null) {
        const langIntro = (rawIntro.es || rawIntro.ca) ? (rawIntro[currentLang] || rawIntro.es || rawIntro.ca) : rawIntro;
        intro = [langIntro.entradilla, langIntro.texto].filter(Boolean).join('\n\n') || '';
        fraseDestacada = langIntro.frase_destacada || '';
      } else {
        intro = rawIntro || a.descripcion || a.introduccion || '';
      }

      // Chunk measures: 3 to 4 measures per page
      const chunkSize = 4;
      const areaTitle = isCa ? (a.nombre_ca || a.nombre) : (a.nombre_es || a.nombre);
      for (let i = 0; i < includedMeasures.length; i += chunkSize) {
        const chunk = includedMeasures.slice(i, i + chunkSize);
        const isFirstPageOfArea = i === 0;

        pages.push({
          num: pageNum++,
          type: 'area',
          areaId: a.id,
          areaOrden: a.orden || (aIdx + 1),
          title: areaTitle,
          isFirstPageOfArea,
          intro: isFirstPageOfArea ? intro : null,
          frase_destacada: isFirstPageOfArea ? fraseDestacada : null,
          measures: chunk
        });
      }
    });

    // 5. Cierre (si existe)
    if (hasCierre) {
      pages.push({
        num: pageNum++,
        type: 'cierre',
        title: cierreTitulo,
        parrafos: cierreParrafos,
        slogan: project.lema || ''
      });
    }

    return pages;
  },

  renderThumbnail(page, idx, isCa) {
    let contentHtml = '';

    if (page.type === 'portada') {
      contentHtml = `
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-between; text-align: left; padding: 4px;">
          <div>
            <div style="font-size: 8px; font-weight: 900; color: #581c87; line-height: 1.1; margin-bottom: 8px;">
              ${escapeHtml(page.lema)}
            </div>
            <div style="font-size: 7.5px; font-weight: 700; color: #1e1b4b; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1.5px solid #581c87; padding-top: 4px;">
              PROGRAMA ELECTORAL
            </div>
            <div style="font-size: 9px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${escapeHtml(page.municipio)}
            </div>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 4px; font-size: 6.5px; color: #64748b;">
            <div>${escapeHtml(page.partido)} · ${escapeHtml(page.mandato)}</div>
            ${page.organizacion ? `<div style="font-weight: 600; color: #475569;">${escapeHtml(page.organizacion)}</div>` : ''}
          </div>
        </div>
      `;
    } else if (page.type === 'indice') {
      contentHtml = `
        <div style="display: flex; flex-direction: column; gap: 4px; padding: 2px;">
          <div style="font-size: 8px; font-weight: 700; color: #581c87; margin-bottom: 4px; border-bottom: 1px solid #ddd;">
            ${isCa ? 'ÍNDEX' : 'ÍNDICE'}
          </div>
          ${page.items.slice(0, 8).map(it => `
            <div style="display: flex; justify-content: space-between; font-size: 6.5px; border-bottom: 1px dotted #e5e7eb; padding: 1px 0;">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${escapeHtml(it.title)}</span>
              ${it.count ? `<span style="color: #6b21a8; font-weight: 600;">${it.count}</span>` : ''}
            </div>
          `).join('')}
          ${page.items.length > 8 ? `<div style="font-size: 6px; color: #9ca3af; text-align: center;">… y ${page.items.length - 8} más</div>` : ''}
        </div>
      `;
    } else if (page.type === 'presentacion') {
      contentHtml = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="font-size: 8px; font-weight: 700; color: #581c87; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
            ${escapeHtml(page.title)}
          </div>
          ${page.entradilla ? `<div style="font-size: 6.5px; font-weight: 600; color: #334155; line-height: 1.3;">${escapeHtml(page.entradilla)}</div>` : ''}
          ${page.parrafos.slice(0, 3).map(p => `
            <div style="font-size: 6px; color: #475569; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
              ${escapeHtml(p)}
            </div>
          `).join('')}
        </div>
      `;
    } else if (page.type === 'area') {
      contentHtml = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="font-size: 7.5px; font-weight: 700; color: #581c87; border-bottom: 1px solid #ddd; padding-bottom: 2px; text-transform: uppercase;">
            ${escapeHtml(page.title)}
          </div>
          ${page.intro ? `
            <div style="font-size: 6px; color: #64748b; font-style: italic; line-height: 1.25; max-height: 24px; overflow: hidden;">
              ${escapeHtml(page.intro)}
            </div>
          ` : ''}
          ${page.frase_destacada ? `
            <div style="font-size: 5.5px; font-weight: 700; color: #6b21a8; background: #faf5ff; border-left: 2px solid #a855f7; padding: 2px 4px; font-style: italic; margin-top: 2px; line-height: 1.2;">
              «${escapeHtml(page.frase_destacada)}»
            </div>
          ` : ''}
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 2px;">
            ${page.measures.map(m => `
              <div style="border-left: 2px solid #a855f7; padding-left: 3px;">
                <div style="font-size: 6.5px; font-weight: 700; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${m.codigo ? `[${m.codigo}] ` : ''}${escapeHtml(m.titulo || '')}
                </div>
                <div style="font-size: 5.5px; color: #64748b; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2;">
                  ${escapeHtml(m.decision?.version_municipal_texto || m.texto || '')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (page.type === 'cierre') {
      contentHtml = `
        <div style="display: flex; flex-direction: column; gap: 4px; justify-content: space-between; height: 100%;">
          <div>
            <div style="font-size: 8px; font-weight: 700; color: #581c87; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
              ${escapeHtml(page.title)}
            </div>
            ${page.parrafos.slice(0, 3).map(p => `
              <div style="font-size: 6px; color: #475569; line-height: 1.3; margin-top: 4px;">
                ${escapeHtml(p)}
              </div>
            `).join('')}
          </div>
          ${page.slogan ? `
            <div style="text-align: center; font-size: 7.5px; font-weight: 800; color: #581c87; padding-top: 6px; border-top: 1px solid #e2e8f0;">
              ${escapeHtml(page.slogan)}
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="preview-page-sheet" data-page-idx="${idx}" title="${isCa ? 'Clic per ampliar pàgina' : 'Clic para ampliar página'}">
        <div class="preview-sheet-header">
          <span class="preview-sheet-title">${escapeHtml(page.title)}</span>
          <span style="font-size: 9px; font-weight: 700; color: #9ca3af;">${page.num}</span>
        </div>
        <div class="preview-sheet-content">
          ${contentHtml}
        </div>
        <div class="preview-sheet-footer">
          <span>Podemos · Candidatura Municipal</span>
          <span>Pàg. ${page.num}</span>
        </div>
      </div>
    `;
  },

  bindEvents(container, project, isCa) {
    container.querySelector('#btn-help-this-screen')?.addEventListener('click', () => {
      if (window.Tutorial) window.Tutorial.startSectionTour('preview');
    });

    // Navigation buttons
    const btnBack = container.querySelector('#btn-back-to-measures');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        App.navigateTo('areas-medidas');
      });
    }

    const btnExport = container.querySelector('#btn-go-to-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        App.navigateTo('generar-documentos');
      });
    }

    // Click on thumbnail opens Zoom Reader
    container.querySelectorAll('.preview-page-sheet').forEach(sheet => {
      sheet.addEventListener('click', () => {
        const idx = parseInt(sheet.dataset.pageIdx, 10);
        this.openZoomReader(idx, isCa);
      });
    });
  },

  openZoomReader(pageIndex, isCa) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) return;
    this.currentZoomPageIndex = pageIndex;
    const page = this.pages[pageIndex];

    const modalContainer = document.querySelector('#preview-zoom-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="preview-zoom-modal" id="zoom-overlay">
        <div class="preview-zoom-container">
          <!-- Top Toolbar -->
          <div style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: white;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-weight: 700; font-size: 15px; color: #1e293b;">
                ${isCa ? 'Lector de pàgina' : 'Lector de página'}: ${escapeHtml(page.title)}
              </span>
              <span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 600;">
                ${isCa ? 'Pàgina' : 'Página'} ${page.num} ${isCa ? 'de' : 'de'} ${this.pages.length}
              </span>
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn small" id="zoom-btn-prev" ${pageIndex === 0 ? 'disabled' : ''}>
                ← ${isCa ? 'Anterior' : 'Anterior'}
              </button>
              <button class="btn small" id="zoom-btn-next" ${pageIndex === this.pages.length - 1 ? 'disabled' : ''}>
                ${isCa ? 'Següent' : 'Siguiente'} →
              </button>
              <div style="width: 1px; height: 22px; background: #e2e8f0; margin: 0 4px;"></div>
              <button class="btn small link" id="zoom-btn-close" style="font-size: 14px; font-weight: 700;">
                ✕ ${isCa ? 'Tancar' : 'Cerrar'}
              </button>
            </div>
          </div>

          <!-- Page Body -->
          <div class="preview-zoom-body">
            <div class="preview-zoom-paper">
              ${this.renderZoomPaperContent(page, isCa)}
            </div>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'block';

    const closeZoom = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
      if (this._zoomKeyHandler) {
        window.removeEventListener('keydown', this._zoomKeyHandler);
      }
    };

    modalContainer.querySelector('#zoom-btn-close').addEventListener('click', closeZoom);
    modalContainer.querySelector('#zoom-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'zoom-overlay') closeZoom();
    });

    const btnPrev = modalContainer.querySelector('#zoom-btn-prev');
    if (btnPrev && pageIndex > 0) {
      btnPrev.addEventListener('click', () => this.openZoomReader(pageIndex - 1, isCa));
    }

    const btnNext = modalContainer.querySelector('#zoom-btn-next');
    if (btnNext && pageIndex < this.pages.length - 1) {
      btnNext.addEventListener('click', () => this.openZoomReader(pageIndex + 1, isCa));
    }

    // Keyboard navigation in reader
    if (this._zoomKeyHandler) {
      window.removeEventListener('keydown', this._zoomKeyHandler);
    }
    this._zoomKeyHandler = (e) => {
      if (e.key === 'Escape') closeZoom();
      else if (e.key === 'ArrowLeft' && pageIndex > 0) this.openZoomReader(pageIndex - 1, isCa);
      else if (e.key === 'ArrowRight' && pageIndex < this.pages.length - 1) this.openZoomReader(pageIndex + 1, isCa);
    };
    window.addEventListener('keydown', this._zoomKeyHandler);
  },

  renderZoomPaperContent(page, isCa) {
    if (page.type === 'portada') {
      return `
        <div style="min-height: 600px; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid #581c87; padding: 48px 40px; border-radius: 4px;">
          <div>
            <div style="font-size: 32px; font-weight: 900; color: #581c87; line-height: 1.1; margin-bottom: 24px;">
              ${escapeHtml(page.lema)}
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; letter-spacing: 0.08em; border-top: 3px solid #581c87; padding-top: 14px; margin-bottom: 8px;">
              PROGRAMA ELECTORAL
            </div>
            <div style="font-size: 26px; font-weight: 800; color: #0f172a;">
              ${escapeHtml(page.municipio)}
            </div>
          </div>
          <div style="border-top: 2px solid #cbd5e1; padding-top: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <div style="font-size: 15px; font-weight: 700; color: #334155;">${escapeHtml(page.partido)}</div>
              ${page.organizacion ? `<div style="font-size: 14px; color: #64748b; margin-top: 2px;">${escapeHtml(page.organizacion)}</div>` : ''}
              <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Mandato ${escapeHtml(page.mandato)}</div>
            </div>
            ${page.logo_path ? `
              <div style="font-size: 12px; color: #6b21a8; font-weight: 600; border: 1px dashed #c084fc; padding: 8px 12px; border-radius: 4px;">
                [ Logotipo local configurado ]
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (page.type === 'indice') {
      return `
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: #581c87; border-bottom: 2px solid #581c87; padding-bottom: 8px; margin-bottom: 24px;">
            ${isCa ? 'ÍNDEX DE CONTINGUTS' : 'ÍNDICE DE CONTENIDOS'}
          </h2>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${page.items.map(it => `
              <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; border-bottom: 1px dotted #cbd5e1; padding-bottom: 4px;">
                <span style="font-weight: 600; color: #1e293b;">${escapeHtml(it.title)}</span>
                ${it.count ? `<span style="color: #6b21a8; font-weight: 700; font-size: 13px;">${it.count} ${isCa ? 'mesures' : 'medidas'}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (page.type === 'presentacion') {
      return `
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: #581c87; border-bottom: 2px solid #581c87; padding-bottom: 8px; margin-bottom: 20px;">
            ${escapeHtml(page.title)}
          </h2>
          ${page.entradilla ? `
            <div style="font-size: 16px; font-weight: 600; color: #334155; line-height: 1.5; margin-bottom: 18px; font-style: italic;">
              ${escapeHtml(page.entradilla)}
            </div>
          ` : ''}
          <div style="display: flex; flex-direction: column; gap: 14px; font-size: 14.5px; line-height: 1.6; color: #334155;">
            ${page.parrafos.map(p => `<p style="margin: 0;">${escapeHtml(p)}</p>`).join('')}
          </div>
        </div>
      `;
    }

    if (page.type === 'area') {
      return `
        <div>
          <div style="border-bottom: 2px solid #581c87; padding-bottom: 10px; margin-bottom: 18px;">
            <div style="font-size: 12px; font-weight: 700; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.05em;">
              ${isCa ? 'Àrea temàtica' : 'Área temática'}
            </div>
            <h2 style="font-size: 20px; font-weight: 800; color: #1e1b4b; margin: 4px 0 0 0;">
              ${escapeHtml(page.title)}
            </h2>
          </div>

          ${page.intro ? `
            <div style="background: #f8fafc; border-left: 3px solid #8b5cf6; padding: 12px 16px; margin-bottom: 18px; font-size: 13.5px; color: #475569; font-style: italic; line-height: 1.5;">
              ${escapeHtml(page.intro)}
            </div>
          ` : ''}

          ${page.frase_destacada ? `
            <div style="background: #faf5ff; border-left: 4px solid #7c3aed; padding: 12px 18px; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                ${isCa ? 'Frase destacada' : 'Frase destacada'}
              </div>
              <div style="font-size: 14.5px; font-weight: 700; color: #581c87; font-style: italic; line-height: 1.4;">
                «${escapeHtml(page.frase_destacada)}»
              </div>
            </div>
          ` : ''}

          <div style="display: flex; flex-direction: column; gap: 20px;">
            ${page.measures.map(m => `
              <div style="border-left: 3px solid #581c87; padding-left: 14px;">
                <div style="font-size: 12px; font-weight: 700; color: #6b21a8; margin-bottom: 3px;">
                  ${m.codigo ? `${m.codigo} · ` : ''}${m.is_propia ? (isCa ? 'Proposta pròpia' : 'Propuesta propia') : (isCa ? 'Catàleg marc' : 'Catálogo marco')}
                </div>
                <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">
                  ${escapeHtml(m.titulo || '')}
                </h3>
                <div style="font-size: 14px; line-height: 1.55; color: #334155;">
                  ${escapeHtml(m.decision?.version_municipal_texto || m.texto || m.explicacion || '')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (page.type === 'cierre') {
      return `
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: #581c87; border-bottom: 2px solid #581c87; padding-bottom: 8px; margin-bottom: 20px;">
            ${escapeHtml(page.title)}
          </h2>
          <div style="display: flex; flex-direction: column; gap: 14px; font-size: 14.5px; line-height: 1.6; color: #334155; margin-bottom: 36px;">
            ${page.parrafos.map(p => `<p style="margin: 0;">${escapeHtml(p)}</p>`).join('')}
          </div>
          ${page.slogan ? `
            <div style="text-align: center; border-top: 2px solid #e2e8f0; padding-top: 24px; font-size: 22px; font-weight: 900; color: #581c87;">
              ${escapeHtml(page.slogan)}
            </div>
          ` : ''}
        </div>
      `;
    }

    return '';
  }
};

window.PreviewView = PreviewView;
