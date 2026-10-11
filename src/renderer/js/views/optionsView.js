/**
 * optionsView.js - Vista de Opciones y Configuración del Sistema
 * Constructor de Programas Municipales - Versión 1.3.0
 */

const OptionsView = {
  async render(container, params = {}) {
    const ver = await window.api.getAppVersion();
    const exportDir = await window.api.getExportDir();
    let activeSource = null;
    try {
      activeSource = await window.api.getActiveSourceProgram();
    } catch (e) {}
    const lang = window.i18n ? window.i18n.getLang() : 'es';
    const isCa = lang === 'ca';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="title">${isCa ? 'Opcions i configuració' : 'Opciones y configuración'}</h1>
          <p class="subtitle">${isCa ? 'Gestió d\'idioma, còpies de seguretat, carpetes d\'exportació i dades del sistema.' : 'Gestión de idioma, copias de seguridad, carpetas de exportación y datos del sistema.'}</p>
        </div>
        <div class="view-header-right">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
        </div>
      </div>

      <div class="grid-2">
        <!-- Columna Izquierda: Idioma y Carpeta de Exportación -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <!-- Selector de idioma global de la aplicación -->
          <div class="card" style="padding: 24px;">
            <h2 class="section-title" style="font-size: 18px; margin-bottom: 8px;">
              ${isCa ? 'Idioma de la interfície i de l\'aplicació' : 'Idioma de la interfaz y de la aplicación'}
            </h2>
            <p class="muted" style="font-size: 13px; margin-bottom: 14px;">
              ${isCa
                ? 'Canvia l\'idioma global dels menús, formularis, taulers i notificacions.'
                : 'Cambia el idioma global de los menús, formularios, paneles y notificaciones.'}
            </p>

            <div class="form-group" style="margin-bottom: 0;">
              <select class="select" id="select-global-language" style="max-width: 260px;">
                <option value="es" ${!isCa ? 'selected' : ''}>Castellano (Español)</option>
                <option value="ca" ${isCa ? 'selected' : ''}>Català</option>
              </select>
            </div>
          </div>

          <!-- Carpeta de Exportación -->
          <div class="card" style="padding: 24px;">
            <h2 class="section-title" style="font-size: 18px; margin-bottom: 8px;">
              ${isCa ? 'Carpeta d\'exportació de documents' : 'Carpeta de exportación de documentos'}
            </h2>
            <p class="muted" style="font-size: 13px; margin-bottom: 14px;">
              ${isCa
                ? 'Ubicació predeterminada on es desaran els documents Microsoft Word (.docx) exportats.'
                : 'Ubicación predeterminada donde se guardarán los documentos Microsoft Word (.docx) exportados.'}
            </p>

            <div style="background: var(--surface-muted); padding: 12px 14px; border-radius: var(--radius-default); border: 1px solid var(--border-subtle); margin-bottom: 14px;">
              <div class="label" style="font-size: 11px; margin-bottom: 4px;">${isCa ? 'Ruta configurada actualment:' : 'Ruta configurada actualmente:'}</div>
              <div id="options-export-path" style="font-family: monospace; font-size: 13px; color: var(--text-primary); word-break: break-all;">
                ${escapeHtml(exportDir)}
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn small primary" id="btn-opt-change-export">${isCa ? 'Canviar carpeta…' : 'Cambiar carpeta…'}</button>
              <button class="btn small" id="btn-opt-open-export">${isCa ? 'Obrir carpeta' : 'Abrir carpeta'}</button>
              <button class="btn small" id="btn-opt-reset-export">${isCa ? 'Restablir predeterminada' : 'Restablecer predeterminada'}</button>
            </div>
            <div class="form-hint" style="margin-top: 8px;">
              ${isCa ? 'Per defecte:' : 'Por defecto:'} <code>Documentos\\Constructor de Programas Municipales\\Exportaciones</code>
            </div>
          </div>

          <!-- Información de la Aplicación / Acerca de -->
          <div class="card" style="padding: 24px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <h2 class="section-title" style="font-size: 18px; margin: 0;">
                ${isCa ? 'Quant a l\'aplicació' : 'Acerca de la aplicación'}
              </h2>
              <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-weight: 700; font-size: 11px;">
                GPL-3.0-or-later
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13.5px;">
              <div>
                <span class="muted">${isCa ? 'Aplicació:' : 'Aplicación:'}</span>
                <b>${escapeHtml(ver.appName || 'Constructor de Programas Municipales')}</b>
              </div>
              <div>
                <span class="muted">${isCa ? 'Versió del programari:' : 'Versión del software:'}</span>
                <b>v${escapeHtml(ver.version || '3.4.0')}</b>
              </div>
              <div>
                <span class="muted">${isCa ? 'Autor i mantenidor:' : 'Autor y mantenedor:'}</span>
                <b>${escapeHtml(ver.author || 'elftemir')}</b>
              </div>
              <div>
                <span class="muted">${isCa ? 'Contacte:' : 'Contacto:'}</span>
                <span style="display: inline-flex; align-items: center; gap: 6px;">
                  <b>${escapeHtml(ver.authorEmail || 'elftemir@hotmail.com')}</b>
                  <button class="btn small link" id="btn-about-contact-mail" style="padding: 0 4px; font-size: 12px; text-decoration: underline;" title="${isCa ? 'Obrir client de correu' : 'Abrir cliente de correo'}">${isCa ? 'Enviar correu' : 'Enviar correo'}</button>
                </span>
              </div>
              <div>
                <span class="muted">${isCa ? 'Llicència:' : 'Licencia:'}</span>
                <b>GNU GPL-3.0-or-later</b> <span class="muted">(${isCa ? 'Programari lliure' : 'Software libre'})</span>
              </div>
              <div>
                <span class="muted">${isCa ? 'Codi font:' : 'Código fuente:'}</span>
                <div style="margin-top: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <code style="font-size: 12px; background: var(--surface-muted); padding: 4px 6px; border-radius: 4px;">https://github.com/elftemir/constructor-programas-municipales</code>
                  <button class="btn small link" id="btn-about-open-repo" style="padding: 2px 6px; font-size: 12px; text-decoration: underline;">${isCa ? 'Obrir al navegador' : 'Abrir en navegador'}</button>
                  <button class="btn small" id="btn-about-copy-repo" style="padding: 2px 8px; font-size: 11px;">${isCa ? 'Copiar enllaç' : 'Copiar enlace'}</button>
                </div>
              </div>
            </div>

            <!-- Accesos a documentación legal y privacidad sin internet -->
            <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-divider);">
              <div style="font-weight: 700; font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">
                ${isCa ? 'DOCUMENTACIÓ I TRANSPARÈNCIA' : 'DOCUMENTACIÓN Y TRANSPARENCIA'}
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn small primary" id="btn-about-open-privacy" style="background: #15803d; border-color: #166534;">
                  🛡️ ${isCa ? 'Política de privadesa' : 'Política de privacidad'}
                </button>
                <button class="btn small" id="btn-about-open-license">
                  ⚖️ ${isCa ? 'Llicència GPL' : 'Licencia GPL'}
                </button>
                <button class="btn small" id="btn-about-open-third-party">
                  📜 ${isCa ? 'Llicències de tercers' : 'Licencias de terceros'}
                </button>
              </div>
            </div>

            <div class="notice info" style="margin-top: 18px; font-size: 12.5px;">
              <b>${isCa ? 'Privadesa local:' : 'Privacidad local:'}</b>
              ${isCa
                ? ' Tots els teus programes, adaptacions i dades municipals es guarden de forma estrictament local al teu ordinador.'
                : ' Todos tus programas, adaptaciones y datos municipales se guardan de forma estrictamente local en tu ordenador.'}
            </div>
          </div>
        </div>

        <!-- Columna Derecha: Copias de seguridad y Actualizaciones -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <!-- Copias de seguridad y proyectos portátiles -->
          <div class="card" style="padding: 24px;">
            <h2 class="section-title" style="font-size: 18px; margin-bottom: 16px;">
              ${isCa ? 'Còpies de seguretat i programes' : 'Copias de seguridad y proyectos'}
            </h2>

            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <div style="font-weight: 600; font-size: 14px;">${isCa ? 'Importar programa portàtil (.json)' : 'Importar proyecto portátil (.json)'}</div>
                <div class="muted" style="font-size: 12.5px; margin: 4px 0 8px;">
                  ${isCa
                    ? 'Carrega un arxiu de còpia de seguretat o un programa compartit per una altra agrupació en format .json.'
                    : 'Carga un archivo de respaldo o un programa compartido por otra agrupación en formato .json.'}
                </div>
                <button class="btn" id="btn-options-import-json">${isCa ? 'Importar programa (.json)…' : 'Importar proyecto (.json)…'}</button>
              </div>

              ${App.currentProject ? `
                <div style="border-top: 1px solid var(--border-divider); padding-top: 14px;">
                  <div style="font-weight: 600; font-size: 14px;">${isCa ? 'Exportar còpia de seguretat actual' : 'Exportar copia de seguridad actual'}</div>
                  <div class="muted" style="font-size: 12.5px; margin: 4px 0 8px;">
                    ${isCa
                      ? `Crea un arxiu JSON portàtil de còpia de seguretat del programa de <b>${escapeHtml(App.currentProject.municipio)}</b>.`
                      : `Crea un archivo JSON portátil de respaldo del programa de <b>${escapeHtml(App.currentProject.municipio)}</b>.`}
                  </div>
                  <button class="btn primary" id="btn-options-export-json">${isCa ? 'Exportar còpia de seguretat (.json)…' : 'Exportar copia de seguridad (.json)…'}</button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Actualizaciones unificadas (Fase 3.4A + 3.4B) -->
          <div class="card" id="card-options-updates" style="padding: 24px; scroll-margin-top: 20px;">
            <h2 class="section-title" style="font-size: 18px; margin-bottom: 8px;">
              ${isCa ? 'Actualitzacions' : 'Actualizaciones'}
            </h2>
            <p class="muted" style="font-size: 13px; margin-bottom: 14px;">
              ${isCa
                ? 'Comprova si hi ha noves versions de l\'aplicació o nous paquets de contingut oficials disponibles.'
                : 'Comprueba si hay nuevas versiones de la aplicación o nuevos paquetes de contenido oficiales disponibles.'}
            </p>

            <!-- Bloque APLICACIÓN -->
            <div style="margin-bottom: 16px; padding: 14px; background: var(--surface-muted); border: 1px solid var(--border-subtle); border-radius: var(--radius-default);">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px;">
                <div style="font-weight: 700; font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">
                  ${isCa ? 'APLICACIÓ' : 'APLICACIÓN'}
                </div>
                <div style="font-size: 13px;">
                  <span class="muted">${isCa ? 'Versió instal·lada:' : 'Versión instalada:'}</span>
                  <b>v${escapeHtml(ver.version || '3.4.0')}</b>
                </div>
              </div>
              <div id="options-updater-status-box"></div>
            </div>

            <!-- Bloque CONTENIDOS -->
            <div style="margin-bottom: 16px; padding: 14px; background: var(--surface-muted); border: 1px solid var(--border-subtle); border-radius: var(--radius-default);">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px;">
                <div style="font-weight: 700; font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;">
                  ${isCa ? 'CONTINGUTS' : 'CONTENIDOS'}
                </div>
              </div>
              <div id="options-content-updater-status-box"></div>
            </div>

            <!-- Botón único COMPROBAR -->
            <div style="display: flex; justify-content: flex-end;">
              <button class="btn primary" id="btn-opt-check-all-updates">
                ${isCa ? 'Comprovar actualitzacions' : 'Comprobar actualizaciones'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);

    if (params && params.focusSection === 'updates') {
      setTimeout(() => {
        const upEl = document.getElementById('card-options-updates');
        if (upEl) {
          upEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          upEl.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
          upEl.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.4)';
          upEl.style.borderColor = '#7c3aed';
          setTimeout(() => {
            upEl.style.boxShadow = '';
            upEl.style.borderColor = '';
          }, 2400);
        }
      }, 80);
    }

    // Cargar estado inicial de app updater
    if (window.api && typeof window.api.getUpdateStatus === 'function') {
      try {
        const upStatus = await window.api.getUpdateStatus();
        this.updateUpdaterBox(upStatus);
      } catch (e) {}
    }
    // Usar estado en caché o null para app
    if (window.App && window.App.updaterState) {
      this.updateUpdaterBox(window.App.updaterState);
    }

    // Cargar estado inicial de content updater
    if (window.api && typeof window.api.getContentUpdateStatus === 'function') {
      try {
        const ctStatus = await window.api.getContentUpdateStatus();
        this.updateContentUpdaterBox(ctStatus);
      } catch (e) {}
    }
    if (window.App && window.App.contentUpdaterState) {
      this.updateContentUpdaterBox(window.App.contentUpdaterState);
    }
  },

  updateUpdaterBox(state) {
    const box = document.getElementById('options-updater-status-box');
    const btnCheck = document.getElementById('btn-opt-check-updates');
    if (!box) return;

    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const status = state && state.status ? state.status : 'IDLE';
    const curVer = escapeHtml((state && state.currentVersion) || '3.1.3');
    const nextVer = escapeHtml((state && state.availableVersion) || '');
    const safeNotes = escapeHtml((state && state.releaseNotes) || (isCa ? 'Sense notes addicionals de la versió.' : 'Sin notas adicionales de la versión.'));

    if (btnCheck) {
      btnCheck.disabled = (status === 'CHECKING' || status === 'DOWNLOADING' || status === 'DOWNLOADED');
    }

    if (status === 'IDLE') {
      box.innerHTML = `
        <div style="background: var(--surface-muted); border: 1px solid var(--border-subtle); border-radius: var(--radius-default); padding: 12px 14px; font-size: 13px; color: var(--text-secondary);">
          ${isCa
            ? 'Prem «Comprovar actualitzacions» per consultar si hi ha una versió més recent disponible.'
            : 'Pulsa «Comprobar actualizaciones» para consultar si hay una versión más reciente disponible.'}
        </div>
      `;
      return;
    }

    if (status === 'CHECKING') {
      box.innerHTML = `
        <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: var(--radius-default); padding: 12px 14px; font-size: 13.5px; color: #4c1d95; font-weight: 600;">
          ${isCa ? 'Comprovant...' : 'Comprobando...'}
        </div>
      `;
      return;
    }

    if (status === 'NO_UPDATE') {
      box.innerHTML = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-default); padding: 12px 14px; font-size: 13.5px; color: #166534;">
          <b>${isCa ? 'Estàs actualitzat' : 'Estás actualizado'}</b> ·
          <span>${isCa ? `Versió instal·lada v${curVer}` : `Versión instalada v${curVer}`}</span>
        </div>
      `;
      return;
    }

    if (status === 'UPDATE_AVAILABLE') {
      box.innerHTML = `
        <div style="background: #faf5ff; border: 1.5px solid #c084fc; border-radius: var(--radius-default); padding: 16px;">
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
            <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 12px; max-height: 150px; overflow-y: auto; white-space: pre-wrap; font-size: 12.5px; line-height: 1.5;">${safeNotes}</div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn small primary" id="btn-opt-update-download">${isCa ? 'ACTUALITZAR ARA' : 'ACTUALIZAR AHORA'}</button>
            <button class="btn small" id="btn-opt-update-dismiss">${isCa ? 'MÉS TARD' : 'MÁS TARDE'}</button>
          </div>
        </div>
      `;

      const btnDl = box.querySelector('#btn-opt-update-download');
      const btnDismiss = box.querySelector('#btn-opt-update-dismiss');
      if (btnDl) {
        btnDl.addEventListener('click', async () => {
          btnDl.disabled = true;
          try {
            await window.api.downloadUpdate();
          } catch (err) {
            console.warn('Error al iniciar descarga:', err);
          }
        });
      }
      if (btnDismiss) {
        btnDismiss.addEventListener('click', () => {
          if (window.App && typeof window.App.dismissGlobalUpdateBanner === 'function') {
            window.App.dismissGlobalUpdateBanner('UPDATE_AVAILABLE');
          }
          box.innerHTML = `
            <div style="background: var(--surface-muted); border: 1px solid var(--border-subtle); border-radius: var(--radius-default); padding: 12px 14px; font-size: 13px; color: var(--text-secondary);">
              ${isCa
                ? `Nova versió v${nextVer} disponible. Pots actualitzar en qualsevol moment.`
                : `Nueva versión v${nextVer} disponible. Puedes actualizar en cualquier momento.`}
            </div>
          `;
        });
      }
      return;
    }

    if (status === 'DOWNLOADING') {
      const pct = state.progress && typeof state.progress.percent === 'number' ? state.progress.percent : 0;
      box.innerHTML = `
        <div style="background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: var(--radius-default); padding: 14px 16px;">
          <div style="font-weight: 700; font-size: 14px; color: #4c1d95; margin-bottom: 8px;">
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
        </div>
      `;
      return;
    }

    if (status === 'DOWNLOADED') {
      box.innerHTML = `
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: var(--radius-default); padding: 16px;">
          <div style="font-weight: 800; font-size: 15px; color: #166534; margin-bottom: 6px;">
            ${isCa ? 'Instal·lant actualització i reiniciant automàticament...' : 'Instalando actualización y reiniciando automáticamente...'}
          </div>
          <div style="font-size: 13px; color: var(--text-secondary);">
            ${isCa
              ? 'Constructor de Programes Municipals es tancarà uns segons i es tornarà a obrir automàticament.'
              : 'Constructor de Programas Municipales se cerrará unos segundos y volverá a abrirse automáticamente.'}
          </div>
        </div>
      `;
      return;
    }

    if (status === 'ERROR') {
      // Si el error proviene únicamente del chequeo silencioso de arranque y el usuario aún no ha pulsado manualmente, mostrar estado neutro
      if (state.silent && state.lastCheckSource === 'auto' && state.errorCode !== 'DOWNLOAD_ERROR') {
        box.innerHTML = `
          <div style="background: var(--surface-muted); border: 1px solid var(--border-subtle); border-radius: var(--radius-default); padding: 12px 14px; font-size: 13px; color: var(--text-secondary);">
            ${isCa
              ? 'Prem «Comprovar actualitzacions» per consultar si hi ha una versió més recent disponible.'
              : 'Pulsa «Comprobar actualizaciones» para consultar si hay una versión más reciente disponible.'}
          </div>
        `;
        return;
      }

      const isDlError = state.errorCode === 'DOWNLOAD_ERROR';
      const errTitle = isDlError
        ? (isCa ? 'No s\'ha pogut baixar l\'actualització' : 'No se ha podido descargar la actualización')
        : (isCa ? 'Error en comprovar' : 'Error al comprobar');
      const errMsg = escapeHtml(
        (isCa ? (state.errorCa || state.error) : state.error) ||
        (isCa ? 'No s\'ha pogut comprovar l\'estat de les actualitzacions.' : 'No se ha podido comprobar el estado de las actualizaciones.')
      );
      box.innerHTML = `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-default); padding: 12px 14px; font-size: 13px; color: #991b1b;">
          <div style="font-weight: 700; margin-bottom: 4px;">${errTitle}</div>
          <div>${errMsg}</div>
        </div>
      `;
    }
  },

  updateContentUpdaterBox(state) {
    const box = document.getElementById('options-content-updater-status-box');
    if (!box) return;
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const status = state && state.status ? state.status : 'IDLE';

    if (status === 'IDLE' || status === 'CHECKING') {
      box.innerHTML = `
        <div style="font-size: 13px; color: var(--text-secondary);">
          ${status === 'CHECKING'
            ? (isCa ? 'Comprovant continguts...' : 'Comprobando contenidos...')
            : (isCa ? 'Prem «Comprovar actualitzacions» per consultar si hi ha nou contingut oficial disponible.' : 'Pulsa «Comprobar actualizaciones» para consultar si hay nuevo contenido oficial disponible.')}
        </div>`;
      return;
    }

    if (status === 'NO_CONTENT' || status === 'UP_TO_DATE') {
      box.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:var(--radius-default);padding:10px 12px;font-size:13.5px;color:#166534;">
          <b>${isCa ? 'Continguts actualitzats' : 'Contenidos actualizados'}</b>
        </div>`;
      return;
    }

    if ((status === 'AVAILABLE' || status === 'CONTENT_AVAILABLE') &&
        (state.availableItems && state.availableItems.length > 0 || state.availableItem)) {
      const item = (state.availableItems && state.availableItems[0]) || state.availableItem;
      const rawTitle = typeof item.title === 'object' ? (isCa ? (item.title?.ca || item.title?.es) : (item.title?.es || item.title?.ca)) : (item.title_es || item.title || '');
      const title = escapeHtml(rawTitle);
      const isOfficial = item.official === true;
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

      box.innerHTML = `
        <div style="background:#f0f9ff;border:1.5px solid #7dd3fc;border-radius:var(--radius-default);padding:14px;">
          <div style="font-weight:800;font-size:14px;color:#0c4a6e;margin-bottom:6px;">
            ${isCa ? 'Nou contingut disponible' : 'Nuevo contenido disponible'}
          </div>
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${title}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${escapeHtml(langs)} · ${escapeHtml(officialLabel)}</div>
          <button class="btn small primary" id="btn-opt-view-content" style="background:#0284c7;border-color:#0369a1;font-weight:700;">
            ${isCa ? 'VER CONTINGUT' : 'VER CONTENIDO'}
          </button>
        </div>`;

      box.querySelector('#btn-opt-view-content')?.addEventListener('click', () => {
        if (window.App && typeof window.App.showContentUpdateDetailModal === 'function') {
          window.App.showContentUpdateDetailModal(item);
        }
      });
      return;
    }

    if (status === 'INSTALLED') {
      box.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:var(--radius-default);padding:10px 12px;font-size:13.5px;color:#166534;">
          <b>${isCa ? 'Contingut instal·lat correctament.' : 'Contenido instalado correctamente.'}</b>
        </div>`;
      return;
    }

    if (status === 'ERROR') {
      const errMsg = escapeHtml((isCa ? state.errorCa : state.error) || (isCa ? 'Error en comprovar continguts.' : 'Error al comprobar contenidos.'));
      box.innerHTML = `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-default);padding:10px 12px;font-size:13px;color:#991b1b;">
          ${errMsg}
        </div>`;
    }
  },

  bindEvents(container) {
    const btnHelpScreen = container.querySelector('#btn-help-this-screen');
    if (btnHelpScreen) {
      btnHelpScreen.addEventListener('click', () => {
        if (window.Tutorial) window.Tutorial.startSectionTour('options');
      });
    }

    const selLang = container.querySelector('#select-global-language');
    if (selLang) {
      selLang.addEventListener('change', async (e) => {
        const newLang = e.target.value;
        await App.setLanguage(newLang);
      });
    }

    const pathDisplay = container.querySelector('#options-export-path');

    const btnChange = container.querySelector('#btn-opt-change-export');
    if (btnChange) {
      btnChange.addEventListener('click', async () => {
        const newDir = await window.api.selectExportDir();
        if (newDir && pathDisplay) {
          pathDisplay.textContent = newDir;
        }
      });
    }

    const btnOpen = container.querySelector('#btn-opt-open-export');
    if (btnOpen) {
      btnOpen.addEventListener('click', async () => {
        await window.api.openExportDir();
      });
    }

    const btnReset = container.querySelector('#btn-opt-reset-export');
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        const defDir = await window.api.resetExportDir();
        if (pathDisplay) {
          pathDisplay.textContent = defDir;
        }
      });
    }

    const btnImport = container.querySelector('#btn-options-import-json');
    if (btnImport) {
      btnImport.addEventListener('click', async () => {
        try {
          const res = await window.api.loadProjectFromFile();
          if (!res.canceled && res.id) {
            await App.openProject(res.id);
          }
        } catch (err) {
          alert('Error al importar: ' + err.message);
        }
      });
    }

    const btnExport = container.querySelector('#btn-options-export-json');
    if (btnExport && App.currentProject) {
      btnExport.addEventListener('click', async () => {
        try {
          const res = await window.api.saveProjectToFile(App.currentProject.id);
          if (!res.canceled) {
            const isCa = window.i18n && window.i18n.getLang() === 'ca';
            alert(isCa ? 'Còpia de seguretat desada a:\n' + res.filePath : 'Copia de seguridad guardada con éxito en:\n' + res.filePath);
          }
        } catch (err) {
          alert('Error al exportar: ' + err.message);
        }
      });
    }

    // Botón unificado COMPROBAR (app + contenidos)
    const btnCheckAll = container.querySelector('#btn-opt-check-all-updates');
    if (btnCheckAll) {
      btnCheckAll.addEventListener('click', async () => {
        btnCheckAll.disabled = true;
        this.updateUpdaterBox({ status: 'CHECKING' });
        this.updateContentUpdaterBox({ status: 'CHECKING' });

        try {
          const [appRes, ctRes] = await Promise.allSettled([
            window.api && typeof window.api.checkForUpdates === 'function' ? window.api.checkForUpdates() : Promise.resolve(null),
            window.api && typeof window.api.checkContentUpdates === 'function' ? window.api.checkContentUpdates() : Promise.resolve(null)
          ]);
          if (appRes.status === 'fulfilled' && appRes.value) this.updateUpdaterBox(appRes.value);
          else if (appRes.status === 'rejected') this.updateUpdaterBox({ status: 'ERROR', silent: false, error: appRes.reason?.message || 'Error' });
          if (ctRes.status === 'fulfilled' && ctRes.value) this.updateContentUpdaterBox(ctRes.value);
          else if (ctRes.status === 'rejected') this.updateContentUpdaterBox({ status: 'ERROR', error: ctRes.reason?.message || 'Error' });
        } catch (err) {
          this.updateUpdaterBox({ status: 'ERROR', silent: false, error: err?.message || 'Error' });
        } finally {
          btnCheckAll.disabled = false;
        }
      });
    }

    // Acciones de Acerca de y Documentación legal
    const btnPrivacy = container.querySelector('#btn-about-open-privacy');
    if (btnPrivacy) {
      btnPrivacy.addEventListener('click', () => {
        const isCa = window.i18n && window.i18n.getLang() === 'ca';
        this.showLegalDocModal('privacy', isCa ? 'Política de privadesa' : 'Política de privacidad', isCa);
      });
    }

    const btnLicense = container.querySelector('#btn-about-open-license');
    if (btnLicense) {
      btnLicense.addEventListener('click', () => {
        const isCa = window.i18n && window.i18n.getLang() === 'ca';
        this.showLegalDocModal('license', isCa ? 'Llicència GNU General Public License v3' : 'Licencia GNU General Public License v3', isCa);
      });
    }

    const btnThirdParty = container.querySelector('#btn-about-open-third-party');
    if (btnThirdParty) {
      btnThirdParty.addEventListener('click', () => {
        const isCa = window.i18n && window.i18n.getLang() === 'ca';
        this.showLegalDocModal('thirdParty', isCa ? 'Llicències i crèdits de tercers' : 'Licencias y créditos de terceros', isCa);
      });
    }

    const btnRepo = container.querySelector('#btn-about-open-repo');
    if (btnRepo) {
      btnRepo.addEventListener('click', async () => {
        if (window.api?.openExternalUrl) {
          await window.api.openExternalUrl('https://github.com/elftemir/constructor-programas-municipales');
        }
      });
    }

    const btnCopyRepo = container.querySelector('#btn-about-copy-repo');
    if (btnCopyRepo) {
      btnCopyRepo.addEventListener('click', async () => {
        const isCa = window.i18n && window.i18n.getLang() === 'ca';
        try {
          await navigator.clipboard.writeText('https://github.com/elftemir/constructor-programas-municipales');
          const oldTxt = btnCopyRepo.textContent;
          btnCopyRepo.textContent = isCa ? '✓ Copiat!' : '✓ ¡Copiado!';
          setTimeout(() => { btnCopyRepo.textContent = oldTxt; }, 2000);
        } catch (e) {
          alert('https://github.com/elftemir/constructor-programas-municipales');
        }
      });
    }

    const btnMail = container.querySelector('#btn-about-contact-mail');
    if (btnMail) {
      btnMail.addEventListener('click', async () => {
        if (window.api?.openExternalUrl) {
          await window.api.openExternalUrl('mailto:elftemir@hotmail.com');
        }
      });
    }
  },

  renderMarkdownToHtml(mdText) {
    if (!mdText) return '';
    const lines = mdText.split('\n');
    let html = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (!line) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        continue;
      }

      // Headers
      if (line.startsWith('### ')) {
        if (inList) { html += '</ul>'; inList = false; }
        const txt = escapeHtml(line.slice(4));
        html += `<h4 style="font-size: 14.5px; font-weight: 700; margin: 16px 0 6px; color: #1e1b4b;">${txt}</h4>`;
        continue;
      }
      if (line.startsWith('## ')) {
        if (inList) { html += '</ul>'; inList = false; }
        const txt = escapeHtml(line.slice(3));
        html += `<h3 style="font-size: 16px; font-weight: 800; margin: 20px 0 8px; color: #1e1b4b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${txt}</h3>`;
        continue;
      }
      if (line.startsWith('# ')) {
        if (inList) { html += '</ul>'; inList = false; }
        const txt = escapeHtml(line.slice(2));
        html += `<h2 style="font-size: 18px; font-weight: 800; margin: 10px 0 10px; color: #0f172a;">${txt}</h2>`;
        continue;
      }

      // Unordered lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) {
          html += '<ul style="margin: 6px 0 10px 20px; padding: 0; line-height: 1.6;">';
          inList = true;
        }
        let itemTxt = escapeHtml(line.slice(2));
        itemTxt = itemTxt.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        itemTxt = itemTxt.replace(/\*([^*]+)\*/g, '<i>$1</i>');
        itemTxt = itemTxt.replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">$1</code>');
        html += `<li style="margin-bottom: 4px; color: #334155;">${itemTxt}</li>`;
        continue;
      }

      if (inList) {
        html += '</ul>';
        inList = false;
      }

      // Paragraph formatting
      let pTxt = escapeHtml(line);
      pTxt = pTxt.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      pTxt = pTxt.replace(/\*([^*]+)\*/g, '<i>$1</i>');
      pTxt = pTxt.replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">$1</code>');
      html += `<p style="margin: 0 0 10px; line-height: 1.65; color: #334155;">${pTxt}</p>`;
    }

    if (inList) {
      html += '</ul>';
    }
    return html;
  },

  async showLegalDocModal(docType, modalTitle, isCa) {
    const modalContainer = document.querySelector('#modal-container') || document.body;
    let contentText = '';
    try {
      if (window.api && typeof window.api.getLegalDoc === 'function') {
        contentText = await window.api.getLegalDoc(docType);
      } else {
        contentText = 'API de lectura legal no disponible.';
      }
    } catch (err) {
      contentText = isCa
        ? `Error en carregar el document local: ${err.message}`
        : `Error al cargar el documento local: ${err.message}`;
    }

    let renderedBody = '';
    if (docType === 'license') {
      renderedBody = `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12.5px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; word-break: break-word; user-select: text;">${escapeHtml(contentText)}</div>`;
    } else {
      renderedBody = `<div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; font-size: 13.5px; line-height: 1.65; color: #1e293b; user-select: text;">${this.renderMarkdownToHtml(contentText)}</div>`;
    }

    modalContainer.innerHTML = `
      <div class="modal-overlay" style="z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(2px);">
        <div class="modal-dialog" style="max-width: 860px; width: 92%; max-height: 88vh; background: #ffffff; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid var(--border-subtle); overflow: hidden;">
          <div class="modal-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-divider); display: flex; align-items: center; justify-content: space-between; background: var(--surface-app);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">${docType === 'privacy' ? '🛡️' : (docType === 'license' ? '⚖️' : '📜')}</span>
              <h2 style="font-size: 17px; font-weight: 800; margin: 0; color: #1e1b4b;">
                ${escapeHtml(modalTitle)}
              </h2>
            </div>
            <button class="btn small" id="btn-modal-legal-close-x" style="padding: 4px 10px; font-size: 14px; font-weight: 700; border-radius: 6px;">✕</button>
          </div>
          <div class="modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #f8fafc;">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; padding: 8px 12px; background: #ffffff; border-radius: 6px; border: 1px solid var(--border-subtle);">
              ℹ️ ${isCa
                ? 'Document oficial emmagatzemat localment a l\'aplicació. Accessible sense connexió a Internet.'
                : 'Documento oficial almacenado localmente en la aplicación. Accesible sin conexión a Internet.'}
            </div>
            ${renderedBody}
          </div>
          <div class="modal-footer" style="padding: 14px 24px; border-top: 1px solid var(--border-divider); display: flex; align-items: center; justify-content: space-between; background: var(--surface-app);">
            <span class="muted" style="font-size: 12px;">Constructor de Programas Municipales · GNU GPL-3.0-or-later</span>
            <button class="btn primary" id="btn-modal-legal-close-btn" style="min-width: 100px;">
              ${isCa ? 'Tancar' : 'Cerrar'}
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

    const btnX = modalContainer.querySelector('#btn-modal-legal-close-x');
    if (btnX) btnX.addEventListener('click', closeModal);

    const btnClose = modalContainer.querySelector('#btn-modal-legal-close-btn');
    if (btnClose) btnClose.addEventListener('click', closeModal);

    const overlay = modalContainer.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }
  }
};

window.OptionsView = OptionsView;


