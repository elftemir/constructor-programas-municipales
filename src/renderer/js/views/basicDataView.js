const BasicDataView = {
  debounceTimer: null,

  async render(container, project) {
    if (!project) return;

    const empresas = Array.isArray(project.empresas_municipales) ? project.empresas_municipales : [];
    const hasEmpresas = empresas.length > 0;

    const isCa = window.i18n && window.i18n.getLang() === 'ca';

    const logoUrl = safeLogoUrl(project.logo_path);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="title">${window.i18n.t('basic.title')}</h1>
          <p class="subtitle">${window.i18n.t('basic.subtitle')}</p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 8px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
          <button class="btn" id="btn-duplicate-for-municipio">${isCa ? 'Duplicar per a un altre municipi' : 'Duplicar para otro municipio'}</button>
          <button class="btn primary" id="btn-goto-elegir-medidas">${window.i18n.t('basic.btn_next')}</button>
        </div>
      </div>

      <div class="grid-2">
        <!-- Columna Izquierda: Obligatorios y Principales -->
        <div class="card" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px;">
            <h2 class="section-title" style="font-size: 18px; margin: 0;">${isCa ? 'Dades de la candidatura' : 'Datos de la candidatura'}</h2>
            ${project.codigo_ine ? `
              <span class="badge" style="background: var(--surface-muted); border: 1px solid var(--border-field); font-size: 11.5px; padding: 3px 8px; border-radius: var(--radius-sm); color: var(--text-secondary);">
                INE: <b>${escapeHtml(project.codigo_ine)}</b> · ${isCa ? 'Fitxa local vinculada' : 'Ficha local vinculada'}
              </span>
            ` : ''}
          </div>

          <div class="form-group" style="position: relative;">
            <label class="form-label" for="input-municipio">${window.i18n.t('basic.field_municipio')} <span class="required">*</span></label>
            <input type="text" class="input" id="input-municipio" value="${escapeHtml(project.municipio || '')}" placeholder="${isCa ? 'Escriu el nom del municipi…' : 'Escribe el nombre del municipio…'}" autocomplete="off">
            <div id="municipio-autocomplete" class="autocomplete-dropdown" style="display: none;"></div>
            <div class="form-hint">${window.i18n.t('basic.field_municipio_hint')}</div>
          </div>

          <div class="grid-2" style="gap: 12px;">
            <div class="form-group">
              <label class="form-label" for="input-provincia">${window.i18n.t('basic.field_provincia')}</label>
              <input type="text" class="input" id="input-provincia" value="${escapeHtml(project.provincia || '')}" placeholder="Ej. Barcelona">
            </div>
            <div class="form-group">
              <label class="form-label" for="input-comunidad">${window.i18n.t('basic.field_comunidad')}</label>
              <input type="text" class="input" id="input-comunidad" value="${escapeHtml(project.comunidad_autonoma || (isCa ? 'Catalunya' : 'Cataluña'))}" placeholder="Ej. Cataluña">
            </div>
          </div>

          <div class="grid-2" style="gap: 12px;">
            <div class="form-group">
              <label class="form-label" for="input-partido">${window.i18n.t('basic.field_partido')}</label>
              <input type="text" class="input" id="input-partido" value="${escapeHtml(project.partido || 'Podemos')}">
              <div class="form-hint">${isCa ? 'Apareix a la portada: Programa de {{partit}}' : 'Aparece en portada: Programa de {{partido}}'}</div>
            </div>
            <div class="form-group">
              <label class="form-label" for="input-mandato">${window.i18n.t('basic.field_mandato')} <span class="required">*</span></label>
              <input type="text" class="input" id="input-mandato" value="${escapeHtml(project.mandato || '2027–2031')}">
              <div class="form-hint">${isCa ? 'Per defecte: 2027–2031' : 'Por defecto: 2027–2031'}</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="input-organizacion">${window.i18n.t('basic.field_organizacion')}</label>
            <input type="text" class="input" id="input-organizacion" value="${escapeHtml(project.organizacion || '')}" placeholder="Ej. Podemos ${escapeHtml(project.municipio || '')}">
            <div class="form-hint">${window.i18n.t('basic.field_organizacion_hint')}</div>
          </div>

          <div class="grid-2" style="gap: 12px;">
            <div class="form-group">
              <label class="form-label" for="select-idioma-principal">${isCa ? 'Idioma principal' : 'Idioma principal'} <span class="required">*</span></label>
              <select class="select" id="select-idioma-principal">
                <option value="es" ${project.idioma_principal === 'es' ? 'selected' : ''}>Castellano</option>
                <option value="ca" ${project.idioma_principal === 'ca' ? 'selected' : ''}>Català</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${isCa ? 'Segon idioma' : 'Idioma secundario'}</label>
              <input type="text" class="input" disabled value="${project.idioma_principal === 'es' ? 'Català' : 'Castellano'}">
              <div class="form-hint">${isCa ? 'Assignat automàticament.' : 'Asignado automáticamente.'}</div>
            </div>
          </div>

          ${['es', 'ca'].map(lemaLang => `
            <div class="form-group" style="margin-top: 10px;">
              <label class="form-label" for="input-lema-${lemaLang}">${lemaLang === 'es' ? window.i18n.t('lema.field_es') : window.i18n.t('lema.field_ca')}</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="text" class="input" id="input-lema-${lemaLang}" maxlength="60" value="${escapeHtml(window.Lema.getLema(project, lemaLang) || '')}" placeholder="${lemaLang === 'es' ? window.i18n.t('lema.placeholder_es') : window.i18n.t('lema.placeholder_ca')}">
                <button type="button" class="btn small" id="btn-translate-lema-${lemaLang}">${window.i18n.t('lema.translate')}</button>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                <span class="form-hint">${window.i18n.t('basic.field_lema_hint')}</span>
                <span class="form-hint" id="lema-counter-${lemaLang}">${(window.Lema.getLema(project, lemaLang) || '').length}/60</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Columna Derecha: Opcionales, Servicios, Logo -->
        <div style="display: flex; flex-direction: column; gap: 18px;">
          <!-- Datos Electorales y Económicos Opcionales -->
          <div class="card" style="padding: 24px;">
            <h2 class="section-title" style="font-size: 18px; margin-bottom: 14px;">${isCa ? 'Dades electorals i de població' : 'Datos electorales y de población'}</h2>

            <div class="grid-2" style="gap: 12px;">
              <div class="form-group">
                <label class="form-label" for="input-habitantes">${isCa ? 'Habitants' : 'Habitantes'} <span class="optional">(${isCa ? 'Oficial / editable' : 'Oficial / editable'})</span></label>
                <input type="number" class="input" id="input-habitantes" value="${project.habitantes !== null && project.habitantes !== undefined ? project.habitantes : ''}" placeholder="Ej. 27500">
                
                <div id="habitantes-info-container" style="margin-top: 5px; font-size: 12px; line-height: 1.4;">
                  ${project.poblacion_modificada ? `
                    <div style="color: var(--action-primary); font-weight: 500;">
                      ✏️ ${isCa ? 'Població modificada manualment' : 'Población modificada manualmente'} (${Number(project.habitantes || 0).toLocaleString(isCa ? 'ca-ES' : 'es-ES')} hab.)
                      <br><span class="muted">${isCa ? 'Oficial INE/Idescat' : 'Oficial INE/Idescat'} (${project.poblacion_ano || '2025'}): <b>${Number(project.poblacion_oficial || project.habitantes || 0).toLocaleString(isCa ? 'ca-ES' : 'es-ES')} hab.</b></span>
                      <a href="#" id="btn-restore-oficial-poblacion" style="margin-left: 6px; text-decoration: underline; color: var(--action-primary); cursor: pointer;">[${isCa ? 'Restablir oficial' : 'Restablecer oficial'}]</a>
                    </div>
                  ` : (project.habitantes ? `
                    <div class="muted">
                      ${isCa ? 'Població oficial:' : 'Población oficial:'} <b>${Number(project.habitantes).toLocaleString(isCa ? 'ca-ES' : 'es-ES')} hab.</b>
                      <br>${isCa ? 'Font:' : 'Fuente:'} ${escapeHtml(project.poblacion_fuente || 'Idescat / INE')} (${escapeHtml(project.poblacion_ano || '2025')})
                    </div>
                  ` : `
                    <div class="muted">${isCa ? 'Dada oficial assignada automàticament en triar municipi.' : 'Dato oficial asignado automáticamente al elegir municipio.'}</div>
                  `)}
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="input-fecha-electoral">${isCa ? 'Data electoral' : 'Fecha electoral'} <span class="optional">(${isCa ? 'Opcional' : 'Opcional'})</span></label>
                <input type="date" class="input" id="input-fecha-electoral" value="${project.fecha_electoral || ''}">
                <div class="form-error" id="fecha-electoral-error" style="display: none;">${isCa ? 'Les eleccions municipals se celebren en diumenge.' : 'Las elecciones municipales se celebran en domingo.'}</div>
                <div class="form-hint">${isCa ? 'Si s\'introdueix, ha de ser en diumenge.' : 'Si se introduce, debe ser en domingo.'}</div>
              </div>
            </div>

            <div class="grid-2" style="gap: 12px; margin-top: 4px;">
              <div class="form-group">
                <label class="form-label" for="input-presupuesto-mun">${isCa ? 'Pressupost municipal' : 'Presupuesto municipal'} <span class="optional">(${isCa ? 'Opcional €' : 'Opcional €'})</span></label>
                <input type="number" step="any" class="input" id="input-presupuesto-mun" value="${project.presupuesto_municipal || ''}" placeholder="Ej. 25000000">
                <div class="form-hint">${isCa ? 'Últim exercici tancat.' : 'Último ejercicio cerrado.'}</div>
              </div>

              <div class="form-group">
                <label class="form-label" for="input-presupuesto-inv">${isCa ? 'Pressupost inversions' : 'Presupuesto inversiones'} <span class="optional">(${isCa ? 'Opcional €' : 'Opcional €'})</span></label>
                <input type="number" step="any" class="input" id="input-presupuesto-inv" value="${project.presupuesto_inversiones || ''}" placeholder="Ej. 3500000">
              </div>
            </div>
          </div>

          <!-- Empresas Municipales y Servicios -->
          <div class="card" style="padding: 24px;">
            <h2 class="section-title" style="font-size: 18px; margin-bottom: 12px;">${isCa ? 'Empreses i serveis municipals' : 'Empresas y servicios municipales'}</h2>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <div>
                <div style="font-weight: 600; font-size: 14px;">${isCa ? 'Gestió de serveis públics' : 'Gestión de servicios públicos'}</div>
                <div class="muted" style="font-size: 12.5px;">${isCa ? 'Configura la forma de gestió d\'aigua, residus, neteja, etc.' : 'Configura la forma de gestión de agua, residuos, limpieza, etc.'}</div>
              </div>
              <button class="btn" id="btn-configurar-servicios">${isCa ? 'Configurar serveis' : 'Configurar servicios'}</button>
            </div>

            <div style="border-top: 1px solid var(--border-divider); padding-top: 14px;">
              <label class="form-label">${isCa ? 'Existeix alguna empresa municipal?' : '¿Existe alguna empresa municipal?'}</label>
              <div style="display: flex; gap: 16px; margin: 8px 0 12px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="radio-empresa" value="no" ${empresas.length === 0 && project.tiene_empresa === 'no' ? 'checked' : ''}> ${isCa ? 'No' : 'No'}
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="radio-empresa" value="si" ${hasEmpresas || project.tiene_empresa === 'si' ? 'checked' : ''}> ${isCa ? 'Sí' : 'Sí'}
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="radio-empresa" value="ns" ${project.tiene_empresa === 'ns' ? 'checked' : ''}> ${isCa ? 'No ho sé' : 'No lo sé'}
                </label>
              </div>

              <div id="empresas-list-container" style="${hasEmpresas || project.tiene_empresa === 'si' ? 'display: block;' : 'display: none;'}">
                <div id="empresas-tags" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                  ${empresas.map((emp, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--surface-muted); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 13px;">
                      <span>${escapeHtml(emp)}</span>
                      <button class="btn link small btn-remove-empresa" data-idx="${idx}" style="color: var(--action-destructive);">✕</button>
                    </div>
                  `).join('')}
                </div>
                <div style="display: flex; gap: 8px;">
                  <input type="text" class="input" id="input-new-empresa" placeholder="${isCa ? 'Nom de l\'empresa municipal…' : 'Nombre de la empresa municipal…'}">
                  <button class="btn small" id="btn-add-empresa">${isCa ? '+ Afegir' : '+ Añadir'}</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Logo de la agrupación -->
          <div class="card" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h2 class="section-title" style="font-size: 18px;">${isCa ? 'Logo de l\'agrupació local' : 'Logo de la agrupación local'}</h2>
                <p class="subtitle" style="font-size: 12.5px;">${isCa ? 'Opcional · Guardat de forma persistent a l\'aplicació.' : 'Opcional · Guardado de forma persistente en la aplicación.'}</p>
              </div>
              <button class="btn small" id="btn-select-logo">${project.logo_path ? (isCa ? 'Canviar logo' : 'Cambiar logo') : (isCa ? 'Seleccionar logo' : 'Seleccionar logo')}</button>
            </div>

            <div id="logo-preview-box" style="margin-top: 14px; text-align: center; border: 1px dashed var(--border-field); border-radius: var(--radius-default); padding: 14px; background: var(--surface-muted);">
              ${logoUrl ? `
                <div style="position: relative; display: inline-block;">
                  <img src="${escapeHtml(logoUrl)}" alt="Logo local" style="max-height: 80px; max-width: 100%; object-fit: contain;">
                  <button class="btn small destructive" id="btn-remove-logo" style="margin-top: 8px; display: block; margin-left: auto; margin-right: auto;">${isCa ? 'Treure logo' : 'Quitar logo'}</button>
                </div>
              ` : `
                <div class="muted" style="font-size: 13px;">${isCa ? 'Sense logo d\'agrupació local.<br>(L\'espai a la portada quedarà net)' : 'Sin logo de agrupación local.<br>(El espacio en la portada quedará limpio)'}</div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container, project);
  },

  bindEvents(container, project) {
    const btnHelpScreen = container.querySelector('#btn-help-this-screen');
    if (btnHelpScreen) {
      btnHelpScreen.addEventListener('click', () => {
        if (window.Tutorial) window.Tutorial.startSectionTour('basic_data');
      });
    }

    // Duplicate project for another municipality button
    const btnDupMun = container.querySelector('#btn-duplicate-for-municipio');
    if (btnDupMun) {
      btnDupMun.addEventListener('click', () => {
        App.showDuplicateForMunicipioModal(project.id);
      });
    }

    // Organization manual change tracking
    const orgInput = container.querySelector('#input-organizacion');
    if (orgInput) {
      orgInput.addEventListener('input', () => {
        project.organizacion_modificada = 1;
        this.triggerAutosave(project);
      });
    }

    const partidoInput = container.querySelector('#input-partido');
    if (partidoInput) {
      partidoInput.addEventListener('input', () => {
        const p = partidoInput.value.trim() || 'Podemos';
        if (!project.organizacion_modificada && orgInput) {
          const m = container.querySelector('#input-municipio')?.value.trim() || project.municipio || '';
          orgInput.value = m ? `${p} ${m}`.trim() : p;
        }
        this.triggerAutosave(project);
      });
    }

    // Autocomplete for Municipio
    const munInput = container.querySelector('#input-municipio');
    const autoDropdown = container.querySelector('#municipio-autocomplete');
    let autoItems = [];

    if (munInput && autoDropdown) {
      munInput.addEventListener('input', async (e) => {
      const q = e.target.value.trim();
      this.triggerAutosave(project);

      // Auto update organization if not manually edited
      if (!project.organizacion_modificada && orgInput) {
        const p = partidoInput ? (partidoInput.value.trim() || 'Podemos') : 'Podemos';
        orgInput.value = q ? `${p} ${q}`.trim() : p;
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
              autoDropdown.style.display = 'none';
              if (project.municipio && project.municipio.trim() && project.municipio.trim().toLowerCase() !== m.nombre.trim().toLowerCase()) {
                this.confirmChangeMunicipio(container, project, m);
              } else {
                await this.applySelectedMunicipio(container, project, m);
              }
            }
          });
        });
      } else {
        autoDropdown.style.display = 'none';
      }
    });

      document.addEventListener('click', (e) => {
        if (!munInput.contains(e.target) && !autoDropdown.contains(e.target)) {
          autoDropdown.style.display = 'none';
        }
      });
    }


    // Population manual editing detection
    const habInput = container.querySelector('#input-habitantes');
    if (habInput) {
      habInput.addEventListener('input', () => {
        const val = habInput.value.trim();
        const numVal = val ? parseInt(val, 10) : null;
        if (project.poblacion_oficial !== null && project.poblacion_oficial !== undefined) {
          if (numVal !== project.poblacion_oficial) {
            project.poblacion_modificada = 1;
          } else {
            project.poblacion_modificada = 0;
          }
        } else {
          project.poblacion_modificada = 1;
        }
        this.triggerAutosave(project);
      });
    }

    // Restore official population button
    const btnRestorePob = container.querySelector('#btn-restore-oficial-poblacion');
    if (btnRestorePob) {
      btnRestorePob.addEventListener('click', async (e) => {
        e.preventDefault();
        if (project.poblacion_oficial) {
          project.habitantes = project.poblacion_oficial;
          project.poblacion_modificada = 0;
          habInput.value = project.poblacion_oficial;
          await this.saveFormData(project);
          this.render(container, project);
        }
      });
    }

    // Lema character counter
    for (const lemaLang of ['es', 'ca']) {
      const input = container.querySelector('#input-lema-' + lemaLang);
      const counter = container.querySelector('#lema-counter-' + lemaLang);
      const button = container.querySelector('#btn-translate-lema-' + lemaLang);
      input.addEventListener('input', () => {
        counter.textContent = `${input.value.length}/60`;
        this.triggerAutosave(project);
      });
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await window.LemaUi.translate(project, lemaLang, {
            read: lang => container.querySelector('#input-lema-' + lang).value,
            write: async (lang, value) => {
              container.querySelector('#input-lema-' + lang).value = value;
              container.querySelector('#lema-counter-' + lang).textContent = `${value.length}/60`;
              await this.saveFormData(project);
            }
          });
        } catch (err) { alert(err.message); }
        finally { button.disabled = false; }
      });
    }

    // Fecha electoral Sunday validation
    const fechaInput = container.querySelector('#input-fecha-electoral');
    const fechaError = container.querySelector('#fecha-electoral-error');
    fechaInput.addEventListener('change', () => {
      const val = fechaInput.value;
      if (val) {
        const d = new Date(val);
        if (d.getUTCDay() !== 0) {
          fechaError.style.display = 'block';
          fechaInput.style.borderColor = 'var(--action-destructive)';
          return;
        }
      }
      fechaError.style.display = 'none';
      fechaInput.style.borderColor = '';
      this.triggerAutosave(project);
    });

    // Inputs auto-save listeners
    const inputsToWatch = [
      '#input-provincia', '#input-comunidad', '#input-partido', '#input-mandato',
      '#input-organizacion', '#input-presupuesto-mun', '#input-presupuesto-inv'
    ];
    inputsToWatch.forEach(sel => {
      const el = container.querySelector(sel);
      if (el) {
        el.addEventListener('input', () => this.triggerAutosave(project));
        el.addEventListener('change', () => this.triggerAutosave(project));
      }
    });

    // Language switch listener
    const selIdioma = container.querySelector('#select-idioma-principal');
    if (selIdioma) {
      selIdioma.addEventListener('change', async () => {
        const newLang = selIdioma.value;
        project.idioma_principal = newLang;
        project.idioma_secundario = (newLang === 'es') ? 'ca' : 'es';
        await this.saveFormData(project);
        if (window.App && window.App.setLanguage) {
          await window.App.setLanguage(newLang);
        }
      });
    }

    // Radio empresas
    const radioEmpresas = container.querySelectorAll('input[name="radio-empresa"]');
    const empresasContainer = container.querySelector('#empresas-list-container');
    radioEmpresas.forEach(r => {
      r.addEventListener('change', () => {
        if (r.value === 'si') {
          empresasContainer.style.display = 'block';
        } else {
          empresasContainer.style.display = 'none';
        }
        this.triggerAutosave(project);
      });
    });

    // Add / remove empresa
    const btnAddEmpresa = container.querySelector('#btn-add-empresa');
    const inputNewEmpresa = container.querySelector('#input-new-empresa');
    if (btnAddEmpresa && inputNewEmpresa) {
      btnAddEmpresa.addEventListener('click', () => {
        const name = inputNewEmpresa.value.trim();
        if (name) {
          if (!Array.isArray(project.empresas_municipales)) project.empresas_municipales = [];
          project.empresas_municipales.push(name);
          inputNewEmpresa.value = '';
          this.render(container, project);
          this.triggerAutosave(project);
        }
      });
    }

    container.querySelectorAll('.btn-remove-empresa').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        project.empresas_municipales.splice(idx, 1);
        this.render(container, project);
        this.triggerAutosave(project);
      });
    });

    // Logo upload via persistent storage
    const btnSelectLogo = container.querySelector('#btn-select-logo');
    if (btnSelectLogo) {
      btnSelectLogo.addEventListener('click', async () => {
        const logoPath = await window.api.selectLogoFile(project.codigo_ine);
        if (logoPath) {
          project.logo_path = logoPath;
          await window.api.updateProjectData(project.id, { logo_path: logoPath });
          if (project.codigo_ine) {
            await window.api.saveFichaMunicipio({
              codigo_ine: project.codigo_ine,
              municipio: project.municipio,
              provincia: project.provincia,
              comunidad_autonoma: project.comunidad_autonoma,
              logo_path: logoPath
            });
          }
          App.notifySaved();
          this.render(container, project);
        }
      });
    }

    const btnRemoveLogo = container.querySelector('#btn-remove-logo');
    if (btnRemoveLogo) {
      btnRemoveLogo.addEventListener('click', async () => {
        project.logo_path = null;
        await window.api.updateProjectData(project.id, { logo_path: null });
        if (project.codigo_ine) {
          await window.api.saveFichaMunicipio({
            codigo_ine: project.codigo_ine,
            municipio: project.municipio,
            logo_path: null
          });
        }
        App.notifySaved();
        this.render(container, project);
      });
    }

    // Configurar servicios modal
    const btnServicios = container.querySelector('#btn-configurar-servicios');
    if (btnServicios) {
      btnServicios.addEventListener('click', () => {
        this.openServicesModal(project);
      });
    }

    // Continue button
    const btnContinue = container.querySelector('#btn-goto-elegir-medidas');
    if (btnContinue) {
      btnContinue.addEventListener('click', async () => {
        await this.saveFormData(project);
        App.navigateTo('elegir-medidas');
      });
    }
  },

  isChangingMunicipio: false,

  confirmChangeMunicipio(container, project, m) {
    const modalContainer = document.querySelector('#modal-container');
    const munInput = container.querySelector('#input-municipio');

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 540px;">
          <div class="modal-header">
            <h2 class="section-title" style="font-size: 19px;">¿Deseas cambiar el municipio o duplicar el proyecto?</h2>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 14px; line-height: 1.5; margin-bottom: 12px;">
              Este proyecto actualmente está configurado para <b>${escapeHtml(project.municipio)}</b>.
            </p>
            <p class="muted" style="font-size: 13px; line-height: 1.5;">
              Has seleccionado el municipio <b>${escapeHtml(m.nombre)}</b>.<br>
              Puedes cambiar el municipio directamente en este proyecto o bien conservarlo y duplicar todo su trabajo (medidas y textos) en un nuevo proyecto independiente para <b>${escapeHtml(m.nombre)}</b>.
            </p>
          </div>
          <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
            <button class="btn" id="btn-cancel-change-mun">CANCELAR</button>
            <button class="btn" id="btn-dup-change-mun" style="background: var(--surface-muted); border: 1px solid var(--border-field);">DUPLICAR PARA OTRO MUNICIPIO</button>
            <button class="btn primary" id="btn-confirm-change-mun">CAMBIAR MUNICIPIO EN ESTE PROYECTO</button>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'block';

    const closeModals = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    const handleCancel = () => {
      if (munInput) munInput.value = project.municipio || '';
      closeModals();
    };

    modalContainer.querySelector('.btn-close-modal').addEventListener('click', handleCancel);
    modalContainer.querySelector('#btn-cancel-change-mun').addEventListener('click', handleCancel);

    modalContainer.querySelector('#btn-dup-change-mun').addEventListener('click', () => {
      handleCancel();
      App.showDuplicateForMunicipioModal(project.id);
    });

    modalContainer.querySelector('#btn-confirm-change-mun').addEventListener('click', async () => {
      closeModals();
      await this.applySelectedMunicipio(container, project, m);
    });
  },

  async applySelectedMunicipio(container, project, m) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isChangingMunicipio = true;

    // Check if there is an existing local municipal profile
    const fichaExists = await window.api.checkFichaExists(m.codigo_ine);
    if (fichaExists) {
      this.promptFichaMunicipio(container, project, m);
    } else {
      await this.applyOfficialDataOnly(container, project, m);
    }
  },

  promptFichaMunicipio(container, project, m) {
    const modalContainer = document.querySelector('#modal-container');
    const munInput = container.querySelector('#input-municipio');

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 540px;">
          <div class="modal-header">
            <h2 class="section-title" style="font-size: 19px;">Ficha municipal guardada</h2>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 14.5px; line-height: 1.5; margin-bottom: 14px;">
              Se ha detectado una ficha con datos guardados previamente para <b>${escapeHtml(m.nombre)}</b> (INE ${escapeHtml(m.codigo_ine)}) en este equipo.
            </p>
            <p class="muted" style="font-size: 13px; line-height: 1.5;">
              ¿Deseas reutilizar los datos guardados para este municipio (organización, lema, empresas municipales, servicios públicos configurados, presupuestos y logo) o prefieres usar únicamente los datos oficiales?
            </p>
          </div>
          <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
            <button class="btn" id="btn-cancel-ficha">CANCELAR</button>
            <button class="btn" id="btn-ignore-ficha">USAR SOLO DATOS OFICIALES</button>
            <button class="btn primary" id="btn-use-ficha">UTILIZAR DATOS GUARDADOS</button>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'block';

    const closeModals = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    const handleCancel = () => {
      if (munInput) munInput.value = project.municipio || '';
      this.isChangingMunicipio = false;
      closeModals();
    };

    modalContainer.querySelector('.btn-close-modal').addEventListener('click', handleCancel);
    modalContainer.querySelector('#btn-cancel-ficha').addEventListener('click', handleCancel);

    modalContainer.querySelector('#btn-ignore-ficha').addEventListener('click', async () => {
      closeModals();
      await this.applyOfficialDataOnly(container, project, m);
    });

    modalContainer.querySelector('#btn-use-ficha').addEventListener('click', async () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      closeModals();

      const ficha = await window.api.getFichaMunicipio(m.codigo_ine);

      // Atomically update DOM inputs immediately
      if (munInput) munInput.value = m.nombre;
      const provInput = container.querySelector('#input-provincia');
      if (provInput) provInput.value = m.provincia || '';
      const comInput = container.querySelector('#input-comunidad');
      if (comInput) comInput.value = m.comunidad_autonoma || 'Cataluña';

      project.codigo_ine = m.codigo_ine;
      project.municipio = m.nombre;
      project.provincia = m.provincia || '';
      project.comunidad_autonoma = m.comunidad_autonoma || 'Cataluña';
      project.poblacion_oficial = m.poblacion || null;
      project.poblacion_fuente = m.poblacion_fuente || 'Idescat / INE';
      project.poblacion_ano = m.poblacion_ano || '2025';
      project.poblacion_modificada = 0;
      project.habitantes = m.poblacion || null;

      if (ficha) {
        if (ficha.partido) project.partido = ficha.partido;
        if (ficha.organizacion) {
          project.organizacion = ficha.organizacion;
          project.organizacion_modificada = 1;
        } else if (!project.organizacion_modificada) {
          project.organizacion = `${project.partido || 'Podemos'} ${m.nombre}`.trim();
        }
        if (ficha.mandato) project.mandato = ficha.mandato;
        project.lema_es = window.Lema.getLema(ficha, 'es');
        project.lema_ca = window.Lema.getLema(ficha, 'ca');
        project.fecha_electoral = ficha.fecha_electoral || null;
        project.presupuesto_municipal = (ficha.presupuesto_municipal !== null && ficha.presupuesto_municipal !== undefined) ? ficha.presupuesto_municipal : null;
        project.presupuesto_inversiones = (ficha.presupuesto_inversiones !== null && ficha.presupuesto_inversiones !== undefined) ? ficha.presupuesto_inversiones : null;
        project.empresas_municipales = ficha.empresas_municipales || [];
        project.servicios = ficha.servicios || {};
        project.tiene_empresa = (ficha.empresas_municipales && ficha.empresas_municipales.length > 0) ? 'si' : 'no';
        project.logo_path = ficha.logo_path || null;
        project.logo_filename = ficha.logo_filename || null;
        if (ficha.poblacion_usuario) {
          project.habitantes = ficha.poblacion_usuario;
          project.poblacion_modificada = 1;
        }
      }

      await window.api.updateProjectData(project.id, {
        codigo_ine: project.codigo_ine,
        municipio: project.municipio,
        provincia: project.provincia,
        comunidad_autonoma: project.comunidad_autonoma,
        habitantes: project.habitantes,
        poblacion_fuente: project.poblacion_fuente,
        poblacion_ano: project.poblacion_ano,
        poblacion_modificada: project.poblacion_modificada ? 1 : 0,
        partido: project.partido,
        organizacion: project.organizacion,
        organizacion_modificada: project.organizacion_modificada ? 1 : 0,
        mandato: project.mandato,
        lema_es: window.Lema.getLema(project, 'es'),
        lema_ca: window.Lema.getLema(project, 'ca'),
        fecha_electoral: project.fecha_electoral,
        presupuesto_municipal: project.presupuesto_municipal,
        presupuesto_inversiones: project.presupuesto_inversiones,
        empresas_municipales: project.empresas_municipales,
        servicios: project.servicios,
        tiene_empresa: project.tiene_empresa,
        logo_path: project.logo_path,
        logo_filename: project.logo_filename
      });

      this.isChangingMunicipio = false;
      App.updateTopBar(project);
      this.render(container, project);
      App.notifySaved();
    });
  },

  async applyOfficialDataOnly(container, project, m) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isChangingMunicipio = true;

    // Reset municipal-specific data so they are not mixed
    project.codigo_ine = m.codigo_ine;
    project.municipio = m.nombre;
    project.provincia = m.provincia || '';
    project.comunidad_autonoma = m.comunidad_autonoma || 'Cataluña';
    project.poblacion_oficial = m.poblacion || null;
    project.poblacion_fuente = m.poblacion_fuente || 'Idescat / INE';
    project.poblacion_ano = m.poblacion_ano || '2025';
    project.poblacion_modificada = 0;
    project.habitantes = m.poblacion || null;

    const orgInput = container.querySelector('#input-organizacion');
    if (!project.organizacion_modificada) {
      const partido = container.querySelector('#input-partido')?.value.trim() || project.partido || 'Podemos';
      project.organizacion = `${partido} ${m.nombre}`.trim();
      if (orgInput) orgInput.value = project.organizacion;
    } else if (orgInput) {
      project.organizacion = orgInput.value.trim();
    }

    project.lema_es = null;
    project.lema_ca = null;
    project.fecha_electoral = null;
    project.presupuesto_municipal = null;
    project.presupuesto_inversiones = null;
    project.empresas_municipales = [];
    project.servicios = {};
    project.tiene_empresa = 'no';
    project.logo_path = null;
    project.logo_filename = null;

    await window.api.updateProjectData(project.id, {
      codigo_ine: project.codigo_ine,
      municipio: project.municipio,
      provincia: project.provincia,
      comunidad_autonoma: project.comunidad_autonoma,
      habitantes: project.habitantes,
      poblacion_fuente: project.poblacion_fuente,
      poblacion_ano: project.poblacion_ano,
      poblacion_modificada: 0,
      organizacion: project.organizacion,
      organizacion_modificada: project.organizacion_modificada ? 1 : 0,
      lema_es: null,
      lema_ca: null,
      fecha_electoral: null,
      presupuesto_municipal: null,
      presupuesto_inversiones: null,
      empresas_municipales: [],
      servicios: {},
      tiene_empresa: 'no',
      logo_path: null,
      logo_filename: null
    });

    this.isChangingMunicipio = false;
    App.updateTopBar(project);
    this.render(container, project);
    App.notifySaved();
  },


  triggerAutosave(project) {
    if (this.isChangingMunicipio) return;
    App.notifySaving();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      if (this.isChangingMunicipio) return;
      await this.saveFormData(project);
      App.notifySaved();
    }, 450);
  },

  async saveFormData(project) {
    if (this.isChangingMunicipio) return;
    const root = document.querySelector('#view-container');
    if (!root) return;

    const fechaVal = root.querySelector('#input-fecha-electoral')?.value || null;
    let validFecha = fechaVal;
    if (fechaVal) {
      const d = new Date(fechaVal);
      if (d.getUTCDay() !== 0) validFecha = null;
    }

    const radioVal = root.querySelector('input[name="radio-empresa"]:checked')?.value || 'ns';
    const habVal = root.querySelector('#input-habitantes')?.value;

    const data = {
      municipio: root.querySelector('#input-municipio')?.value.trim() || project.municipio,
      provincia: root.querySelector('#input-provincia')?.value.trim() || '',
      comunidad_autonoma: root.querySelector('#input-comunidad')?.value.trim() || 'Cataluña',
      partido: root.querySelector('#input-partido')?.value.trim() || 'Podemos',
      mandato: root.querySelector('#input-mandato')?.value.trim() || '2027–2031',
      organizacion: root.querySelector('#input-organizacion')?.value.trim() || '',
      idioma_principal: root.querySelector('#select-idioma-principal')?.value || 'es',
      idioma_secundario: (root.querySelector('#select-idioma-principal')?.value === 'es') ? 'ca' : 'es',
      lema_es: root.querySelector('#input-lema-es')?.value.trim() || null,
      lema_ca: root.querySelector('#input-lema-ca')?.value.trim() || null,
      habitantes: habVal !== undefined && habVal !== '' && habVal !== null ? parseInt(habVal, 10) : null,
      fecha_electoral: validFecha,
      presupuesto_municipal: root.querySelector('#input-presupuesto-mun')?.value || null,
      presupuesto_inversiones: root.querySelector('#input-presupuesto-inv')?.value || null,
      empresas_municipales: project.empresas_municipales || [],
      servicios: project.servicios || {},
      tiene_empresa: radioVal,
      codigo_ine: project.codigo_ine || null,
      poblacion_fuente: project.poblacion_fuente || 'Idescat / INE',
      poblacion_ano: project.poblacion_ano || '2025',
      poblacion_modificada: project.poblacion_modificada ? 1 : 0,
      organizacion_modificada: project.organizacion_modificada ? 1 : 0
    };

    Object.assign(project, data);
    await window.api.updateProjectData(project.id, data);
    App.updateTopBar(project);

    // Persist to local municipal profile (fichas_municipios)
    if (project.codigo_ine) {
      await window.api.saveFichaMunicipio({
        codigo_ine: project.codigo_ine,
        municipio: data.municipio,
        provincia: data.provincia,
        comunidad_autonoma: data.comunidad_autonoma,
        poblacion_oficial: project.poblacion_oficial || data.habitantes,
        poblacion_usuario: project.poblacion_modificada ? data.habitantes : null,
        fuente_poblacion: project.poblacion_fuente || 'Idescat / INE',
        ano_poblacion: project.poblacion_ano || '2025',
        partido: data.partido,
        organizacion: data.organizacion,
        mandato: data.mandato,
        lema_es: data.lema_es,
        lema_ca: data.lema_ca,
        fecha_electoral: data.fecha_electoral,
        presupuesto_municipal: data.presupuesto_municipal,
        presupuesto_inversiones: data.presupuesto_inversiones,
        empresas_municipales: data.empresas_municipales,
        servicios: data.servicios,
        logo_path: project.logo_path
      });
    }
  },

  openServicesModal(project) {
    const DEFAULT_SERVICES = [
      'Agua',
      'Limpieza viaria',
      'Recogida de residuos',
      'Parques y jardines',
      'Escuelas infantiles / guarderías municipales',
      'Servicio de atención domiciliaria',
      'Teleasistencia',
      'Instalaciones deportivas / piscina municipal',
      'Aparcamientos municipales / zona regulada',
      'Grúa municipal y depósito de vehículos',
      'Cementerio municipal',
      'Alumbrado público',
      'Mantenimiento de edificios y equipamientos municipales'
    ];

    const currentServicios = JSON.parse(JSON.stringify(project.servicios || {}));
    const modalContainer = document.querySelector('#modal-container');

    const options = [
      { val: 'sin_indicar', lbl: 'Sin indicar' },
      { val: 'directa', lbl: 'Gestión municipal / directa' },
      { val: 'externalizada', lbl: 'Externalizada' },
      { val: 'mixta', lbl: 'Mixta' },
      { val: 'no_sabe', lbl: 'No lo sé' }
    ];

    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog" style="max-width: 860px;">
          <div class="modal-header">
            <div>
              <h2 class="section-title" style="font-size: 19px;">Forma de gestión de servicios municipales</h2>
              <div class="muted" style="font-size: 13px;">Indica el modelo de gestión actual para cada servicio.</div>
            </div>
            <button class="btn link btn-close-modal" style="font-size: 18px;">✕</button>
          </div>
          <div class="modal-body" style="padding: 0;">
            <table class="services-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Servicio</th>
                  <th style="width: 50%;">Forma de gestión</th>
                </tr>
              </thead>
              <tbody id="services-table-body">
                ${DEFAULT_SERVICES.map(s => {
                  const val = currentServicios[s] || 'sin_indicar';
                  return `
                    <tr>
                      <td><b>${escapeHtml(s)}</b></td>
                      <td>
                        <select class="select service-select" data-service="${escapeHtml(s)}">
                          ${options.map(o => `<option value="${o.val}" ${val === o.val ? 'selected' : ''}>${o.lbl}</option>`).join('')}
                        </select>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div style="padding: 16px 20px; border-top: 1px solid var(--border-divider); background: var(--surface-muted);">
              <div style="font-weight: 600; font-size: 13.5px; margin-bottom: 8px;">Añadir otros servicios personalizados:</div>
              <div style="display: flex; gap: 8px;">
                <input type="text" class="input" id="input-custom-service" placeholder="Nombre del servicio (ej. Transporte urbano)…" style="background: white;">
                <button class="btn small" id="btn-add-custom-service">+ Añadir servicio</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-close-modal">Cancelar</button>
            <button class="btn primary" id="btn-save-services">Guardar cambios</button>
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

    // Add custom service
    const btnAddCustom = modalContainer.querySelector('#btn-add-custom-service');
    const inputCustom = modalContainer.querySelector('#input-custom-service');
    const tbody = modalContainer.querySelector('#services-table-body');

    btnAddCustom.addEventListener('click', () => {
      const name = inputCustom.value.trim();
      if (name) {
        currentServicios[name] = 'sin_indicar';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><b>${escapeHtml(name)}</b></td>
          <td>
            <select class="select service-select" data-service="${escapeHtml(name)}">
              ${options.map(o => `<option value="${o.val}">${o.lbl}</option>`).join('')}
            </select>
          </td>
        `;
        tbody.appendChild(tr);
        inputCustom.value = '';
      }
    });

    // Save
    modalContainer.querySelector('#btn-save-services').addEventListener('click', async () => {
      const selects = modalContainer.querySelectorAll('.service-select');
      const updated = {};
      selects.forEach(s => {
        const servName = s.dataset.service;
        updated[servName] = s.value;
      });

      project.servicios = updated;
      await window.api.updateProjectData(project.id, { servicios: updated });
      if (project.codigo_ine) {
        await window.api.saveFichaMunicipio({
          codigo_ine: project.codigo_ine,
          municipio: project.municipio,
          servicios: updated
        });
      }
      App.notifySaved();
      closeModals();
    });
  }
};
