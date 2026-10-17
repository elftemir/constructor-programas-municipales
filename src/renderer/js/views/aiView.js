/**
 * aiView.js - Panel Central de Inteligencia Artificial Local (Fase 2)
 * Constructor de Programas Municipales - Versión 2.0.2
 *
 * Principio rector: LA IA PROPONE. EL USUARIO DECIDE.
 * 100% Local y Privado: Motor llama.cpp nativo en local sin conexión externa.
 */

const TEST_MODES = {
  adaptar_medida: {
    id: 'adaptar_medida',
    icon: '✍️',
    labelEs: 'Adaptar medida',
    labelCa: 'Adaptar mesura',
    descEs: 'Adapta una propuesta marco al contexto municipal específico',
    descCa: 'Adapta una proposta marc al context municipal específic',
    defaultEs: 'Crear una red de comunidades energéticas locales y colocar paneles solares en todos los edificios públicos y cubiertas de equipamientos municipales.',
    defaultCa: 'Crear una xarxa de comunitats energètiques locals i col·locar plaques solars en tots els edificis públics i cobertes d\'equipaments municipals.'
  },
  sugerir_titulos: {
    id: 'sugerir_titulos',
    icon: '💡',
    labelEs: 'Sugerir títulos',
    labelCa: 'Sugerir títols',
    descEs: 'Genera 3 títulos concisos y directos para una propuesta municipal',
    descCa: 'Genera 3 títols concisos i directes per a una proposta municipal',
    defaultEs: 'Fomentar la vivienda pública de alquiler asequible para jóvenes y familias trabajadoras en el municipio mediante rehabilitación de inmuebles vacíos.',
    defaultCa: 'Fomentar l\'habitatge públic de lloguer assequible per a joves i famílies treballadores al municipi mitjançant rehabilitació d\'immobles buits.'
  },
  traduccion: {
    id: 'traduccion',
    icon: '🌐',
    labelEs: 'Traducción ES ↔ CA',
    labelCa: 'Traducció ES ↔ CA',
    descEs: 'Traduce fielmente entre castellano y catalán manteniendo el tono municipal',
    descCa: 'Tradueix fidelment entre castellà i català mantenint el to municipal',
    defaultEs: 'Garantizar el acceso al agua pública municipal y remunicipalizar el servicio de abastecimiento para asegurar tarifas justas.',
    defaultCa: 'Garantir l\'accés a l\'aigua pública municipal i remunicipalitzar el servei d\'abastament per assegurar tarifes justes.'
  },
  presentacion: {
    id: 'presentacion',
    icon: '🏛️',
    labelEs: 'Presentación municipal',
    labelCa: 'Presentació municipal',
    descEs: 'Redacta un borrador introductorio con los ejes clave del programa',
    descCa: 'Redacta un esborrany introductori amb els eixos clau del programa',
    defaultEs: 'Justicia social, vivienda garantizada, transición ecológica justa y servicios públicos de gestión 100% comunitaria.',
    defaultCa: 'Justícia social, habitatge garantit, transició ecològica justa i serveis públics de gestió 100% comunitària.'
  }
};

const AiView = {
  activeProgressUnsub: null,
  eventsBound: false,
  activeTestMode: 'adaptar_medida',
  currentDiagnostic: null,
  backendUnsubscribe: null,

  async loadBackendControls(container) {
    if(!window.api.aiBackendState)return;
    const t=key=>window.i18n.t(key);
    container.innerHTML+=`<section class="card" id="ai-backend-settings" style="margin-top:20px;padding:20px;">
      <h2>${t('gpu.title')}</h2><label for="ai-backend-mode">${t('gpu.processing')}</label>
      <select id="ai-backend-mode"><option value="auto">${t('gpu.auto')}</option><option value="cpu">${t('gpu.cpu')}</option><option value="gpu">${t('gpu.gpu')}</option></select>
      <p id="ai-backend-status" role="status" aria-live="polite"></p><button class="btn" id="ai-backend-redetect">${t('gpu.redetect')}</button></section>`;
    const display=state=>{
      const mode=container.querySelector('#ai-backend-mode'),status=container.querySelector('#ai-backend-status');
      if(mode)mode.value=state.mode||'auto';
      if(status){let text=state.backend==='gpu'?t('gpu.gpu')+' · '+(state.device?.name||''):t('gpu.cpu');
        if(state.failed||state.status==='gpu-failed')text+=' · '+t('gpu.failure')+(state.failure?' — '+state.failure:'');
        else if(state.fallbackReason==='GPU_BELOW_SPEED_THRESHOLD')text+=' · '+t('gpu.speedReason');
        else if(state.fallbackReason==='NO_COMPATIBLE_GPU')text+=' · '+t('gpu.noCompatibleReason');
        if(['detecting','benchmarking'].includes(state.status))text+=' · '+t('gpu.detecting');
        if(state.cpuTokensPerSecond)text+=' · CPU '+Number(state.cpuTokensPerSecond).toFixed(1)+' tokens/s';
        if(state.gpuTokensPerSecond)text+=' · GPU '+Number(state.gpuTokensPerSecond).toFixed(1)+' tokens/s';status.textContent=text;}
    };
    display(await window.api.aiBackendState());
    this.backendUnsubscribe?.();this.backendUnsubscribe=window.api.onAiBackendState?.(display);
    container.querySelector('#ai-backend-mode')?.addEventListener('change',async event=>display(await window.api.aiBackendState({mode:event.target.value})));
    container.querySelector('#ai-backend-redetect')?.addEventListener('click',async()=>display(await window.api.aiBackendRedetect()));
  },

  async render(container) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';

    container.innerHTML = `
      <div class="view-header" style="margin-bottom: 24px;">
        <div class="view-header-left">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px; flex-wrap: wrap;">
            <h1 class="title" style="margin: 0;">${isCa ? 'Intel·ligència Artificial Local' : 'Inteligencia Artificial Local'}</h1>
            <span class="badge" style="background: #f3e8ff; color: #6b21a8; font-weight: 700; font-size: 12px; border: 1px solid #d8b4fe; padding: 4px 10px;">
              ${isCa ? '100% Local · Privat · Opcional' : '100% Local · Privado · Opcional'}
            </span>
            <span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 700; font-size: 12px; border: 1px solid #a7f3d0; padding: 4px 10px;">
              llama.cpp nativo (Windows x64)
            </span>
          </div>
          <p class="subtitle">
            ${isCa
              ? 'Assistent intel·ligent per redactar, adaptar, sintetitzar i traduir el vostre programa electoral de forma autònoma.'
              : 'Asistente inteligente para redactar, adaptar, sintetizar y traducir tu programa electoral de forma autónoma.'}
          </p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 10px; align-items: center;">
          <button class="btn small btn-help-screen" id="btn-help-this-screen" title="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}" aria-label="${isCa ? 'Ajuda d\'aquesta pantalla' : 'Ayuda de esta pantalla'}"><span class="help-qmark">?</span> ${isCa ? 'Ajuda' : 'Ayuda'}</button>
        </div>
      </div>

      <!-- Garantía de privacidad y principio rector -->
      <section class="card" style="padding: 20px 24px; width: 100%; margin-bottom: 24px; background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%); border: 1.5px solid #d8b4fe; box-sizing: border-box;">
        <div style="display: flex; gap: 18px; align-items: center;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: #8b5cf6; color: white; display: grid; place-items: center; font-size: 24px; flex-shrink: 0;">
            🛡️
          </div>
          <div>
            <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #4c1d95; font-weight: 800;">
              ${isCa ? 'Principi rector: La IA proposa. L\'usuari decideix.' : 'Principio rector: La IA propone. El usuario decide.'}
            </h3>
            <p style="margin: 0; font-size: 13.5px; line-height: 1.5; color: #5b21b6;">
              ${isCa
                ? 'La IA mai no desa ni canvia textos automàticament sense la vostra confirmació expressa. Cap dada municipal, cens ni text surt del vostre equip. Tota la computació s\'executa de manera 100% privada mitjançant el motor natiu llama.cpp.'
                : 'La IA nunca guarda ni modifica textos automáticamente sin tu confirmación expresa. Ningún dato municipal, censo ni texto sale de tu ordenador. Toda la computación se ejecuta de manera 100% privada mediante el motor nativo llama.cpp.'}
            </p>
          </div>
        </div>
      </section>

      <div style="display: grid; grid-template-columns: 1fr; gap: 24px; width: 100%; box-sizing: border-box;">
        <!-- Tarjeta de diagnóstico de hardware y motor -->
        <section class="card" id="ai-specs-card" style="padding: 24px 28px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <h2 style="font-size: 17px; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
              ⚙️ ${isCa ? 'Diagnòstic de maquinari i motor d\'IA' : 'Diagnóstico de hardware y motor de IA'}
            </h2>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-sm" id="btn-refresh-diagnostic" type="button" title="${isCa ? 'Actualitzar diagnòstic' : 'Actualizar diagnóstico'}">
                🔄 ${isCa ? 'Actualitzar' : 'Actualizar'}
              </button>
              <button class="btn btn-sm" id="btn-open-models-dir" type="button" title="${isCa ? 'Obrir carpeta de models' : 'Abrir carpeta de modelos'}">
                📂 ${isCa ? 'Carpeta de models' : 'Carpeta de modelos'}
              </button>
              <button class="btn btn-sm" id="btn-open-custom-catalog-dir" type="button" title="${isCa ? 'Obrir catàleg personalitzat' : 'Abrir catálogo personalizado'}">
                📁 ${isCa ? 'Catàleg personalitzat' : 'Catálogo personalizado'}
              </button>
            </div>
          </div>

          <div id="specs-details" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 16px;">
            <div style="background: var(--surface-muted); padding: 12px 14px; border-radius: var(--radius-sm);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700;">${isCa ? 'Processador (CPU)' : 'Procesador (CPU)'}</div>
              <div id="spec-cpu" style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 4px;">…</div>
            </div>
            <div style="background: var(--surface-muted); padding: 12px 14px; border-radius: var(--radius-sm);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700;">${isCa ? 'Memòria RAM total / lliure' : 'Memoria RAM total / disponible'}</div>
              <div id="spec-ram" style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 4px;">…</div>
            </div>
            <div style="background: var(--surface-muted); padding: 12px 14px; border-radius: var(--radius-sm);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700;">${isCa ? 'Espai en disc disponible' : 'Espacio en disco disponible'}</div>
              <div id="spec-disk" style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 4px;">…</div>
            </div>
            <div style="background: var(--surface-muted); padding: 12px 14px; border-radius: var(--radius-sm);">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700;">${isCa ? 'Estat del motor llama.cpp' : 'Estado motor llama.cpp'}</div>
              <div id="spec-engine" style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 4px;">…</div>
            </div>
          </div>

          <div id="spec-server-status-box" style="padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12.5px; background: #f1f5f9; border: 1px solid #cbd5e1; margin-bottom: 12px; color: #334155;">
            …
          </div>

          <div id="spec-recommendation-box" style="padding: 12px 16px; border-radius: var(--radius-sm); font-size: 13.5px; line-height: 1.5; background: #f8fafc; border: 1px solid #e2e8f0; color: var(--text-secondary);">
            …
          </div>
        </section>

        <!-- Catálogo de modelos locales -->
        <section class="card" style="padding: 24px 28px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h2 style="font-size: 17px; font-weight: 800; margin: 0 0 4px 0;">
                🧠 ${isCa ? 'Catàleg de perfils d\'Intel·ligència Artificial' : 'Catálogo de perfiles de Inteligencia Artificial'}
              </h2>
              <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
                ${isCa
                  ? 'Descarregueu el perfil que millor s\'adapti a la potència del vostre equip. Els fitxers GGUF s\'emmagatzemen al vostre disc local.'
                  : 'Descarga el perfil que mejor se adapte a la potencia de tu equipo. Los archivos GGUF se almacenan en tu disco local.'}
              </p>
            </div>
          </div>

          <div id="models-list" style="display: flex; flex-direction: column; gap: 16px;">
            <div style="padding: 24px; text-align: center; color: var(--text-tertiary);">
              ${isCa ? 'Carregant catàleg de models…' : 'Cargando catálogo de modelos…'}
            </div>
          </div>
        </section>

        <!-- Prueba interactiva de IA -->
        <section class="card" style="padding: 24px 28px;">
          <h2 style="font-size: 17px; font-weight: 800; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
            🧪 ${isCa ? 'Banc de prova ràpida de l\'Assistent IA' : 'Banco de prueba rápida del Asistente IA'}
          </h2>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--text-secondary);">
            ${isCa
              ? 'Trieu la tasca d\'IA que voleu avaluar i comproveu la velocitat i resposta del model actiu.'
              : 'Elige la tarea de IA que deseas evaluar y comprueba la velocidad y respuesta del modelo activo.'}
          </p>

          <!-- Modos de prueba seleccionables -->
          <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;" id="test-mode-selector">
            <button class="btn btn-sm test-mode-btn" data-mode="adaptar_medida" type="button" style="border: 2px solid #7c3aed; background: #ede9fe; color: #5b21b6; font-weight: 700;">
              ✍️ ${isCa ? 'Adaptar mesura' : 'Adaptar medida'}
            </button>
            <button class="btn btn-sm test-mode-btn" data-mode="sugerir_titulos" type="button" style="border: 1px solid #cbd5e1; background: white; color: #334155;">
              💡 ${isCa ? 'Sugerir títols' : 'Sugerir títulos'}
            </button>
            <button class="btn btn-sm test-mode-btn" data-mode="traduccion" type="button" style="border: 1px solid #cbd5e1; background: white; color: #334155;">
              🌐 ${isCa ? 'Traducció ES ↔ CA' : 'Traducción ES ↔ CA'}
            </button>
            <button class="btn btn-sm test-mode-btn" data-mode="presentacion" type="button" style="border: 1px solid #cbd5e1; background: white; color: #334155;">
              🏛️ ${isCa ? 'Presentació municipal' : 'Presentación municipal'}
            </button>
          </div>

          <div id="test-mode-info" style="margin-bottom: 10px; font-size: 12.5px; color: #6d28d9; font-weight: 600;">
            ${TEST_MODES.adaptar_medida[isCa ? 'descCa' : 'descEs']}
          </div>

          <!-- Opciones extras de traducción si aplica -->
          <div id="test-translation-options" style="display: none; align-items: center; gap: 10px; margin-bottom: 12px;">
            <label style="font-size: 12px; font-weight: 700; color: #475569;">${isCa ? 'Direcció:' : 'Dirección:'}</label>
            <select id="test-trans-direction" class="select" style="padding: 4px 10px; font-size: 12.5px;">
              <option value="es_ca">${isCa ? 'Castellà → Català' : 'Castellano → Catalán'}</option>
              <option value="ca_es">${isCa ? 'Català → Castellà' : 'Catalán → Castellano'}</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;">
            <textarea id="ai-test-input" class="textarea" style="width: 100%; min-height: 80px; font-size: 13.5px; line-height: 1.5; resize: vertical;"
              placeholder="${isCa ? 'Escriviu el text per a la prova…' : 'Escribe el texto para la prueba…'}">${TEST_MODES.adaptar_medida[isCa ? 'defaultCa' : 'defaultEs']}</textarea>
            
            <div style="display: flex; justify-content: flex-end;">
              <button class="btn primary" id="btn-run-quick-test" style="min-width: 170px; background: #7c3aed; font-weight: 700;">
                🚀 ${isCa ? 'Executar prova' : 'Ejecutar prueba'}
              </button>
            </div>
          </div>

          <div id="ai-test-result-box" style="display: none; padding: 18px; border-radius: var(--radius-sm); background: #f8fafc; border: 1.5px solid #cbd5e1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">
                  ${isCa ? 'Resultat de la inferència' : 'Resultado de la inferencia'}
                </span>
                <span id="ai-test-task-badge" class="badge" style="background: #ede9fe; color: #6d28d9; font-weight: 700; font-size: 11px;">
                  Adaptar medida
                </span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span id="ai-test-model-badge" class="badge" style="background: #e2e8f0; color: #334155; font-size: 11px;">
                  --
                </span>
                <span id="ai-test-pid-badge" class="badge" style="background: #e2e8f0; color: #334155; font-size: 11px;">
                  PID: --
                </span>
                <span id="ai-test-latency" class="badge" style="background: #e0e7ff; color: #3730a3; font-weight: 700; font-size: 11px;">
                  0 ms
                </span>
              </div>
            </div>

            <div id="ai-test-output" style="font-size: 14px; line-height: 1.6; color: var(--text-primary); white-space: pre-wrap;"></div>
            
            <div id="ai-test-titles-cards" style="display: none; flex-direction: column; gap: 10px; margin-top: 10px;"></div>

            <div id="ai-test-avisos" style="margin-top: 12px; font-size: 12px; color: #b45309; display: none; background: #fffbeb; border: 1px solid #fef3c7; border-left: 3px solid #f59e0b; padding: 8px 12px; border-radius: 4px;"></div>
          </div>
        </section>

        <!-- Guía técnica: Cómo añadir nuevos modelos (Sección 30) -->
        <section class="card" style="padding: 24px 28px; background: #fafafa; border: 1px solid #e2e8f0;">
          <details style="cursor: pointer;">
            <summary style="font-size: 15px; font-weight: 700; color: #334155; user-select: none;">
              📘 ${isCa ? 'Guia tècnica: Com afegir nous models compatibles (llama.cpp / GGUF)' : 'Guía técnica: Cómo añadir nuevos modelos compatibles (llama.cpp / GGUF)'}
            </summary>
            <div style="margin-top: 16px; font-size: 13.5px; line-height: 1.6; color: #475569;">
              <p>
                ${isCa
                  ? 'El sistema compta amb un <b>Catàleg Oficial</b> empaquetat i de només lectura amb els perfils recomanats, i permet afegir un <b>Catàleg Personalitzat</b> sense tocar els fitxers d\'instal·lació ni app.asar. S\'admet qualsevol model en format <code>.gguf</code> compatible amb <code>llama.cpp</code>:'
                  : 'El sistema cuenta con un <b>Catálogo Oficial</b> empaquetado y de solo lectura con los perfiles recomendados, y permite añadir un <b>Catálogo Personalizado</b> sin tocar los archivos de instalación ni app.asar. Se admite cualquier modelo en formato <code>.gguf</code> compatible con <code>llama.cpp</code>:'}
              </p>
              
              <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 6px; margin: 12px 0; border-left: 4px solid #3b82f6;">
                <strong>${isCa ? 'Ruta del Catàleg Personalitzat de l\'Usuari:' : 'Ruta del Catálogo Personalizado del Usuario:'}</strong><br>
                <code id="guide-custom-catalog-path" style="font-size: 12px; word-break: break-all;">%LOCALAPPDATA%\\Constructor de Programas Municipales Podemos\\AI\\catalog\\ai_models.json</code>
              </div>

              <div style="background: #faf5ff; border: 1px solid #d8b4fe; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; font-size: 12.5px; color: #581c87;">
                <strong>${isCa ? 'Camps del catàleg:' : 'Campos del catálogo:'}</strong> <code>id</code>, <code>name</code> (nom), <code>description</code>, <code>provider</code> (huggingface), <code>repoId</code> (organitzacio/repositori), <code>filename</code> (.gguf), <code>format</code> (GGUF), <code>quantization</code> (Q4_K_M), <code>sizeBytes</code>, <code>sha256</code> i <code>license</code>.
              </div>

              <ol style="margin: 8px 0 16px 20px; padding: 0;">
                <li>${isCa ? 'Premeu el botó <b>Obrir carpeta del catàleg</b> a continuació.' : 'Pulsa el botón <b>Abrir carpeta del catálogo</b> a continuación.'}</li>
                <li>${isCa ? 'Creeu o editeu el fitxer <code>ai_models.json</code> copiant la plantilla neutra de sota.' : 'Crea o edita el archivo <code>ai_models.json</code> copiando la plantilla neutra de abajo.'}</li>
                <li>${isCa ? 'Deseu el fitxer <code>.gguf</code> a la carpeta de models, o indiqueu el seu repositori perquè es descarregui automàticament.' : 'Guarda el archivo <code>.gguf</code> en la carpeta de modelos, o indica su repositorio para descargarlo automáticamente.'}</li>
                <li>${isCa ? 'Premeu <b>Actualitzar</b> per carregar el nou model immediatament.' : 'Pulsa <b>Actualizar</b> para cargar el nuevo modelo de inmediato.'}</li>
              </ol>

              <div style="display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;">
                <button class="btn btn-sm" id="btn-open-custom-catalog-dir-guide" type="button">
                  📁 ${isCa ? 'Obrir carpeta del catàleg' : 'Abrir carpeta del catálogo'}
                </button>
                <button class="btn btn-sm" id="btn-open-models-dir-guide" type="button">
                  📂 ${isCa ? 'Obrir carpeta de fitxers GGUF' : 'Abrir carpeta de archivos GGUF'}
                </button>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 700; font-size: 12px; color: #64748b; text-transform: uppercase;">
                  ${isCa ? 'Plantilla JSON genèrica per a ai_models.json' : 'Plantilla JSON genérica para ai_models.json'}
                </span>
                <button class="btn btn-sm" id="btn-copy-model-template" type="button" style="font-size: 11.5px;">
                  📋 ${isCa ? 'Copiar plantilla' : 'Copiar plantilla'}
                </button>
              </div>

              <pre id="model-json-template" style="background: #1e293b; color: #f1f5f9; padding: 14px; border-radius: 6px; font-size: 12px; overflow-x: auto; font-family: monospace;">[
  {
    "id": "modelo-personalizado",
    "name": "Nombre del modelo",
    "description": "Descripción funcional del modelo para redacción municipal.",
    "provider": "huggingface",
    "repoId": "organizacion/repositorio-gguf",
    "filename": "modelo-instruct-q4_k_m.gguf",
    "format": "GGUF",
    "quantization": "Q4_K_M",
    "sizeBytes": 2100000000,
    "recommendedRamGB": 8,
    "sha256": "opcional-sha256-hash",
    "license": "Apache-2.0 / MIT",
    "recommended": false
  }
]</pre>
            </div>
          </details>
        </section>
      </div>
    `;

    await this.loadBackendControls(container);
    await this.loadSpecs(isCa);
    await this.loadModels(isCa);
    this.bindEvents(isCa);
  },

  async loadSpecs(isCa) {
    try {
      const specs = await window.api.aiGetSpecs();
      const diag = await window.api.aiGetDiagnostic();
      this.currentDiagnostic = diag;

      const cpuEl = document.querySelector('#spec-cpu');
      const ramEl = document.querySelector('#spec-ram');
      const diskEl = document.querySelector('#spec-disk');
      const engineEl = document.querySelector('#spec-engine');
      const serverBox = document.querySelector('#spec-server-status-box');
      const recBox = document.querySelector('#spec-recommendation-box');
      const guidePathEl = document.querySelector('#guide-custom-catalog-path');

      if (cpuEl) cpuEl.textContent = `${specs.cpuModel || 'CPU'} (${specs.cpuCores || 4} ${isCa ? 'nuclis' : 'núcleos'}, ${specs.arch || 'x64'})`;
      if (ramEl) ramEl.textContent = `${specs.totalMemGb || 8} GB (${isCa ? 'disp.' : 'disp.'}: ${specs.freeMemGb || 4} GB)`;
      if (diskEl) diskEl.textContent = `${specs.diskFreeGb || 10} GB ${isCa ? 'lliures' : 'libres'}`;

      const runtimeAvailable = !!(diag && diag.runtimeAvailable);
      if (engineEl) {
        if (runtimeAvailable) {
          const srcLabel = diag.runtimeSource === 'app_packaged' 
            ? (isCa ? 'empaquetat' : 'empaquetado') 
            : (diag.runtimeSource || (isCa ? 'natiu' : 'nativo'));
          engineEl.innerHTML = `<span style="color: #16a34a; font-weight: 700;">✓ ${isCa ? 'Detectat' : 'Detectado'}</span> <span style="font-size: 11px; color: #64748b;">(${srcLabel})</span>`;
        } else {
          engineEl.innerHTML = `<span style="color: #dc2626; font-weight: 700;">⚠ ${isCa ? 'No detectat' : 'No detectado'}</span>`;
        }
      }

      if (serverBox) {
        const isRunning = !!(diag && (diag.serverRunning || (diag.serverStatus && diag.serverStatus.isRunning)));
        const isReady = !!diag?.serverReady;
        const serverPort = diag?.port || diag?.serverPort || 55683;
        const serverPid = diag?.pid || diag?.serverPid || '--';
        const modelName = diag?.modelName || diag?.modelId || (isCa ? 'Cap model seleccionat' : 'Ningún modelo seleccionado');
        const runtimePath = isRunning ? diag?.runtimePath : (isCa ? 'Cap servidor en execució' : 'Ningún servidor en ejecución');
        const backendLabel = isRunning ? (diag.backend === 'gpu' ? 'Vulkan' : 'CPU') : (isCa ? 'En espera' : 'En espera');
        const deviceLabel = diag?.device?.name || (typeof diag?.device === 'string' ? diag.device : '') || '—';

        let estadoLabel = isReady ? (isCa ? 'Llest' : 'Listo') : (isRunning ? (isCa ? 'En execució' : 'En ejecución') : (isCa ? 'En espera (sota demanda)' : 'En espera (bajo demanda)'));
        let dotColor = (isReady || isRunning) ? '#16a34a' : '#64748b';

        serverBox.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="font-size: 13.5px;">
                <strong>Motor llama.cpp:</strong> <span style="color: ${runtimeAvailable ? '#16a34a' : '#dc2626'}; font-weight: 700;">${runtimeAvailable ? (isCa ? 'Detectat' : 'Detectado') : (isCa ? 'No detectat' : 'No detectado')}</span>
                &nbsp;·&nbsp;
                <strong>Runtime:</strong> <span style="color: ${runtimeAvailable ? '#16a34a' : '#dc2626'}; font-weight: 700;">${runtimeAvailable ? (isCa ? 'Disponible' : 'Disponible') : (isCa ? 'No disponible' : 'No disponible')}</span>
                &nbsp;·&nbsp;
                <strong>${isCa ? 'Model:' : 'Modelo:'}</strong> <span style="color: #6b21a8; font-weight: 700;">${modelName}</span>
                &nbsp;·&nbsp;
                <strong>${isCa ? 'Estat:' : 'Estado:'}</strong> <span style="color: ${dotColor}; font-weight: 700;">● ${estadoLabel}</span>
              </div>
              ${isRunning ? `<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 700;">127.0.0.1:${serverPort} · PID: ${serverPid}</span>` : ''}
            </div>
            <div style="font-size: 11px; color: #64748b; font-family: monospace; word-break: break-all;">
              <strong>${isCa ? 'Motor actiu:' : 'Motor activo:'}</strong> ${backendLabel} · <strong>${isCa ? 'Dispositiu:' : 'Dispositivo:'}</strong> ${escapeHtml(deviceLabel)} · <strong>${isCa ? 'Capes en GPU:' : 'Capas en GPU:'}</strong> ${Number(diag?.gpuLayers)||0}<br>
              <strong>${isCa ? 'Ruta del servidor:' : 'Ruta del servidor:'}</strong> ${escapeHtml(runtimePath||'—')}
            </div>
          </div>
        `;
        serverBox.style.borderColor = runtimeAvailable ? '#86efac' : '#cbd5e1';
        serverBox.style.background = runtimeAvailable ? '#f0fdf4' : '#f8fafc';
      }

      if (recBox) {
        this.recommendedModelId=specs.recommendedModelId;
        const recoText = isCa ? (specs.recomendacionCa || specs.recomendacion) : specs.recomendacion;
        recBox.innerHTML = `<strong>${isCa ? 'Diagnòstic del sistema:' : 'Diagnóstico del sistema:'}</strong> ${recoText}`;
      }

      if (guidePathEl && diag && diag.customCatalogPath) {
        guidePathEl.textContent = diag.customCatalogPath;
      }
    } catch (e) {
      console.error('Error cargando especificaciones:', e);
    }
  },

  async loadModels(isCa) {
    try {
      const models = await window.api.aiGetModels();
      const diag = await window.api.aiGetDiagnostic();
      this.currentDiagnostic = diag;
      const listEl = document.querySelector('#models-list');
      if (!listEl) return;

      if (!models || models.length === 0) {
        listEl.innerHTML = `<div style="padding: 16px; color: var(--text-tertiary);">${isCa ? 'No s\'han trobat models configurats.' : 'No se encontraron modelos configurados.'}</div>`;
        return;
      }

      const activeModelId = diag?.activeModelId || (models.find(m => m.instalado)?.id);

      listEl.innerHTML = models.map(m => {
        const mb = Math.round(m.tamano_bytes / 1000000);
        const isInstalled = !!m.instalado;
        const isRec = m.id===this.recommendedModelId;
        const isActive = isInstalled && (m.id === activeModelId);

        return `
          <div class="card" style="padding: 18px 20px; border: 1.5px solid ${isActive ? '#a855f7' : (isInstalled ? '#86efac' : (isRec ? '#c084fc' : '#e2e8f0'))}; background: ${isActive ? '#faf5ff' : (isInstalled ? '#f0fdf4' : (isRec ? '#faf5ff' : 'white'))};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 8px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <h3 style="margin: 0; font-size: 15.5px; font-weight: 700; color: var(--text-primary);">${escapeHtml(m.nombre)}</h3>
                  ${isActive ? `<span class="badge" style="background: #7c3aed; color: white; font-weight: 700; font-size: 11px;">★ ${isCa ? 'Actiu' : 'Activo'}</span>` : ''}
                  ${isRec ? `<span class="badge" style="background: #e9d5ff; color: #6b21a8; font-weight: 700; font-size: 11px;">⭐ ${isCa ? 'Recomanat' : 'Recomendado'}</span>` : ''}
                  <span class="badge" style="background: #e2e8f0; color: #334155; font-size: 11px;">${escapeHtml(m.parametros)} · ${escapeHtml(m.cuantizacion)} · ${mb} MB</span>
                  ${isInstalled ? `<span class="badge" style="background: #bbf7d0; color: #166534; font-weight: 700; font-size: 11px;">✓ ${isCa ? 'Instal·lat' : 'Instalado'}</span>` : `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 11px;">⚪ ${isCa ? 'No descarregat' : 'No descargado'}</span>`}
                </div>
                <p style="margin: 6px 0 0 0; font-size: 13px; line-height: 1.45; color: var(--text-secondary);">
                  ${escapeHtml(isCa ? (m.descripcionCa || m.descripcion) : m.descripcion)}
                </p>
                <div style="margin-top: 8px; font-size: 12px;">
                  ${window.i18n.t('ai.license_label')}: <strong>${escapeHtml(m.license || window.i18n.t('ai.license_unknown'))}</strong>
                  ${m.licenseUrl ? `<button type="button" class="btn small btn-model-license" data-url="${escapeHtml(m.licenseUrl)}">${window.i18n.t('ai.license_read')}</button>` : ''}
                </div>
                ${m.licenseRestricted ? `<div role="note" style="margin-top: 8px; padding: 10px; border: 1px solid #f59e0b; background: #fffbeb; color: #92400e; font-size: 12.5px; font-weight: 600;">${m.license === 'qwen-research' ? window.i18n.t('ai.license_qwen_research_warning') : window.i18n.t('ai.license_restricted_warning')}</div>` : ''}
                ${m.archivo_gguf ? `<div style="margin-top: 4px; font-size: 11.5px; color: #64748b; font-family: monospace;">${escapeHtml(m.archivo_gguf)}</div>` : ''}
              </div>

              <div style="display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap;" id="actions-${m.id}">
                ${isInstalled ? `
                  ${!isActive ? `
                    <button class="btn btn-sm btn-activate-model" data-id="${m.id}" type="button" title="${isCa ? 'Activar aquest model' : 'Activar este modelo'}">
                      ✓ ${isCa ? 'Activar' : 'Activar'}
                    </button>
                  ` : ''}
                  <button class="btn btn-sm btn-test-model" data-id="${m.id}" type="button" title="${isCa ? 'Verificació d\'inferència neuronal' : 'Verificación de inferencia neuronal'}">
                    ⚡ ${isCa ? 'Provar' : 'Probar'}
                  </button>
                  <button class="btn btn-sm danger btn-delete-model" data-id="${m.id}" type="button" title="${isCa ? 'Eliminar fitxer del disc' : 'Eliminar archivo del disco'}">
                    🗑️ ${isCa ? 'Eliminar' : 'Eliminar'}
                  </button>
                ` : `
                  <button class="btn btn-sm primary btn-install-model" data-id="${m.id}" type="button">
                    ⬇️ ${isCa ? 'Descarregar' : 'Descargar'}
                  </button>
                `}
              </div>
            </div>

            <!-- Barra de progreso para descargas (12 fases) -->
            <div id="progress-box-${m.id}" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
                <span id="progress-phase-badge-${m.id}" class="badge" style="background: #ede9fe; color: #6d28d9; font-weight: 700; font-size: 11px;">
                  ${isCa ? 'Paso 1/12: Iniciant…' : 'Paso 1/12: Iniciando…'}
                </span>
                <span id="progress-pct-${m.id}" style="font-weight: 700; color: #4338ca;">0%</span>
              </div>
              <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
                <div id="progress-bar-${m.id}" style="height: 100%; width: 0%; background: #8b5cf6; transition: width 0.2s;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--text-secondary);">
                <span id="progress-text-${m.id}">…</span>
                <button class="btn btn-sm danger btn-cancel-download" data-id="${m.id}" type="button" style="font-size: 11px; padding: 2px 8px;">
                  ✕ ${isCa ? 'Cancel·lar' : 'Cancelar'}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Suscribir eventos de descarga en tiempo real
      if (this.activeProgressUnsub) {
        this.activeProgressUnsub();
      }

      this.activeProgressUnsub = window.api.onAiDownloadProgress((prog) => {
        const { modelId, downloadedBytes, totalBytes, percent, speedBytesSec, phase, phaseName, message, etaSeconds } = prog;
        const box = document.getElementById(`progress-box-${modelId}`);
        const bar = document.getElementById(`progress-bar-${modelId}`);
        const pct = document.getElementById(`progress-pct-${modelId}`);
        const txt = document.getElementById(`progress-text-${modelId}`);
        const phaseBadge = document.getElementById(`progress-phase-badge-${modelId}`);

        if (box) box.style.display = 'block';
        if (bar) bar.style.width = `${Math.max(2, percent || 0)}%`;
        if (pct) pct.textContent = `${percent || 0}%`;

        if (phaseBadge && phase) {
          phaseBadge.textContent = `${isCa ? 'Pas' : 'Paso'} ${phase}/12: ${phaseName || ''}`;
        }

        const curMb = downloadedBytes ? (downloadedBytes / 1000000).toFixed(1) : '0';
        const totMb = totalBytes ? (totalBytes / 1000000).toFixed(1) : '0';
        const speedMb = speedBytesSec ? (speedBytesSec / 1000000).toFixed(2) : '0';
        const etaStr = etaSeconds ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s` : '…';

        if (txt) {
          if (message) {
            txt.textContent = `${message.replace(/^FASE\s*/i,isCa?'Pas ':'Paso ')} (${curMb}/${totMb} MB, ${speedMb} MB/s, ETA: ${etaStr})`;
          } else {
            txt.textContent = `${curMb} / ${totMb} MB (${speedMb} MB/s, ETA: ${etaStr})`;
          }
        }
      });
    } catch (e) {
      console.error('Error cargando modelos:', e);
    }
  },

  bindEvents(isCa) {
    if (this.eventsBound) return;
    this.eventsBound = true;

    // Click en botón de ayuda de pantalla
    document.addEventListener('click', (e) => {
      const btnHelp = e.target.closest('#btn-help-this-screen');
      if (btnHelp) {
        if (window.Tutorial) window.Tutorial.startSectionTour('ai');
      }
    });

    // Actualizar diagnóstico
    document.addEventListener('click', async (e) => {
      const btnLicense = e.target.closest('.btn-model-license');
      if (btnLicense) {
        const opened = await window.api.openExternalUrl(btnLicense.dataset.url);
        if (!opened) alert(window.i18n.t('ai.license_link_blocked'));
        return;
      }
      const btnRefresh = e.target.closest('#btn-refresh-diagnostic');
      if (btnRefresh) {
        btnRefresh.disabled = true;
        await this.loadSpecs(isCa);
        await this.loadModels(isCa);
        btnRefresh.disabled = false;
        return;
      }

      // Abrir carpeta de modelos
      const btnOpenDir = e.target.closest('#btn-open-models-dir') || e.target.closest('#btn-open-models-dir-guide');
      if (btnOpenDir) {
        try {
          await window.api.aiOpenModelsFolder();
        } catch (err) {
          console.error('Error abriendo carpeta de modelos:', err);
        }
        return;
      }

      // Abrir carpeta de catálogo personalizado
      const btnOpenCat = e.target.closest('#btn-open-custom-catalog-dir') || e.target.closest('#btn-open-custom-catalog-dir-guide');
      if (btnOpenCat) {
        try {
          await window.api.aiOpenCustomCatalogFolder();
        } catch (err) {
          console.error('Error abriendo carpeta de catálogo:', err);
        }
        return;
      }

      // Copiar plantilla JSON
      const btnCopyTemplate = e.target.closest('#btn-copy-model-template');
      if (btnCopyTemplate) {
        const templateEl = document.querySelector('#model-json-template');
        if (templateEl) {
          navigator.clipboard.writeText(templateEl.textContent.trim());
          const orig = btnCopyTemplate.textContent;
          btnCopyTemplate.textContent = '✓ ' + (isCa ? 'Copiat!' : '¡Copiado!');
          setTimeout(() => { btnCopyTemplate.textContent = orig; }, 2000);
        }
        return;
      }

      // Activar modelo
      const btnActivate = e.target.closest('.btn-activate-model');
      if (btnActivate) {
        const modelId = btnActivate.dataset.id;
        btnActivate.disabled = true;
        try {
          await window.api.aiSetActiveModel(modelId);
          await this.loadModels(isCa);
          await this.loadSpecs(isCa);
        } catch (err) {
          alert('Error: ' + (err.message || err));
        }
        return;
      }

      // Descargar modelo
      const btnInstall = e.target.closest('.btn-install-model');
      if (btnInstall) {
        const modelId = btnInstall.dataset.id;
        btnInstall.disabled = true;
        btnInstall.textContent = isCa ? 'Connectant…' : 'Conectando…';
        
        const progBox = document.getElementById(`progress-box-${modelId}`);
        const txt = document.getElementById(`progress-text-${modelId}`);
        const bar = document.getElementById(`progress-bar-${modelId}`);
        const pct = document.getElementById(`progress-pct-${modelId}`);
        const phaseBadge = document.getElementById(`progress-phase-badge-${modelId}`);

        if (progBox) progBox.style.display = 'block';
        if (phaseBadge) phaseBadge.textContent = isCa ? 'Paso 1/12: Validació…' : 'Paso 1/12: Validación…';
        if (txt) txt.textContent = isCa ? 'Connectant amb el servidor de descàrrega…' : 'Conectando con el servidor de descarga…';
        if (bar) bar.style.width = '3%';
        if (pct) pct.textContent = '…';

        try {
          const res = await window.api.aiInstallModel(modelId);
          if (res && res.ok === false) {
            throw new Error(res.error || res.message || 'Error en la instalación');
          }
          await this.loadModels(isCa);
          await this.loadSpecs(isCa);
        } catch (err) {
          console.error('Error al descargar modelo:', err);
          alert((isCa ? 'Error durant la descàrrega: ' : 'Error durante la descarga: ') + (err.message || err));
          await this.loadModels(isCa);
        }
        return;
      }

      // Cancelar descarga
      const btnCancel = e.target.closest('.btn-cancel-download');
      if (btnCancel) {
        const modelId = btnCancel.dataset.id;
        await window.api.aiCancelDownload(modelId);
        await this.loadModels(isCa);
        return;
      }

      // Eliminar modelo
      const btnDelete = e.target.closest('.btn-delete-model');
      if (btnDelete) {
        const modelId = btnDelete.dataset.id;
        const conf = confirm(isCa ? 'Segur que voleu eliminar aquest model del disc?' : '¿Seguro que deseas eliminar este modelo del disco?');
        if (conf) {
          await window.api.aiDeleteModel(modelId);
          await this.loadModels(isCa);
          await this.loadSpecs(isCa);
        }
        return;
      }

      // Probar modelo individual (verificación neuronal aritmética real)
      const btnTest = e.target.closest('.btn-test-model');
      if (btnTest) {
        const modelId = btnTest.dataset.id;
        btnTest.disabled = true;
        btnTest.textContent = '⏳ …';
        try {
          const res = await window.api.aiTestModel(modelId);
          if (res && res.ok) {
            const mathOp = res.operacion || (res.resultado && res.resultado.operacion) || '';
            const calcObt = res.obtenido !== undefined ? res.obtenido : (res.resultado && res.resultado.obtenido);
            const calcExp = res.esperado !== undefined ? res.esperado : (res.resultado && res.resultado.esperado);
            const tokens = res.tokens_generados || (res.resultado && res.resultado.tokens) || 2;
            const pid = res.serverPid || (res.resultado && res.resultado.pid) || '--';

            let msg = '';
            if (mathOp) {
              msg = isCa
                ? `✓ INFERÈNCIA REAL VERIFICADA AMB LLAMA.CPP\n\n` +
                  `• Model: ${res.modelo || modelId}\n` +
                  `• Servidor natiu PID: ${pid}\n` +
                  `• Desafiament aritmètic: ${mathOp} = ${calcObt} (Esperat: ${calcExp})\n` +
                  `• Tokens generats: ${tokens}\n` +
                  `• Temps d'inferència: ${res.tiempo_ms || 0} ms\n` +
                  `• Verificació neuronal: CORRECTA`
                : `✓ INFERENCIA REAL VERIFICADA CON LLAMA.CPP\n\n` +
                  `• Modelo: ${res.modelo || modelId}\n` +
                  `• Servidor nativo PID: ${pid}\n` +
                  `• Desafío aritmético: ${mathOp} = ${calcObt} (Esperado: ${calcExp})\n` +
                  `• Tokens generados: ${tokens}\n` +
                  `• Tiempo de inferencia: ${res.tiempo_ms || 0} ms\n` +
                  `• Verificación neuronal: CORRECTA`;
            } else {
              const respText = (res.resultado && res.resultado.texto) || res.texto || res.message || 'OK';
              msg = isCa
                ? `✓ Infeència correcta en ${res.tiempo_ms || 0} ms (${res.modelo || modelId}):\n\n"${respText}"`
                : `✓ Inferencia correcta en ${res.tiempo_ms || 0} ms (${res.modelo || modelId}):\n\n"${respText}"`;
            }
            alert(msg);
            await this.loadSpecs(isCa);
          } else {
            alert((isCa ? 'Error en la prova: ' : 'Error en la prueba: ') + (res?.error || res?.message || 'Error desconocido'));
          }
        } catch (err) {
          alert((isCa ? 'Error en la prova: ' : 'Error en la prueba: ') + (err.message || err));
        } finally {
          btnTest.disabled = false;
          btnTest.textContent = isCa ? '⚡ Provar' : '⚡ Probar';
        }
        return;
      }

      // Cambio de modo de prueba interactiva
      const btnMode = e.target.closest('.test-mode-btn');
      if (btnMode) {
        const mode = btnMode.dataset.mode;
        if (!mode || !TEST_MODES[mode]) return;
        AiView.activeTestMode = mode;

        document.querySelectorAll('.test-mode-btn').forEach(b => {
          b.style.border = '1px solid #cbd5e1';
          b.style.background = 'white';
          b.style.color = '#334155';
          b.style.fontWeight = 'normal';
        });
        btnMode.style.border = '2px solid #7c3aed';
        btnMode.style.background = '#ede9fe';
        btnMode.style.color = '#5b21b6';
        btnMode.style.fontWeight = '700';

        const infoEl = document.querySelector('#test-mode-info');
        if (infoEl) {
          infoEl.textContent = TEST_MODES[mode][isCa ? 'descCa' : 'descEs'];
        }

        const transOpt = document.querySelector('#test-translation-options');
        if (transOpt) {
          transOpt.style.display = mode === 'traduccion' ? 'flex' : 'none';
        }

        const inputEl = document.querySelector('#ai-test-input');
        if (inputEl) {
          inputEl.value = TEST_MODES[mode][isCa ? 'defaultCa' : 'defaultEs'];
        }

        const resBox = document.querySelector('#ai-test-result-box');
        if (resBox) resBox.style.display = 'none';
        return;
      }
    });

    // Ejecutar prueba rápida del banco de pruebas
    const btnRunTest = document.querySelector('#btn-run-quick-test');
    if (btnRunTest) {
      btnRunTest.addEventListener('click', async () => {
        const inputEl = document.querySelector('#ai-test-input');
        const text = inputEl ? inputEl.value.trim() : '';
        if (!text) {
          alert(isCa ? 'Si us plau, escriviu un text per a la prova.' : 'Por favor, escribe un texto para la prueba.');
          return;
        }

        btnRunTest.disabled = true;
        btnRunTest.textContent = isCa ? '⏳ Executant…' : '⏳ Ejecutando…';

        const resultBox = document.querySelector('#ai-test-result-box');
        const outputEl = document.querySelector('#ai-test-output');
        const titlesCardsEl = document.querySelector('#ai-test-titles-cards');
        const latencyEl = document.querySelector('#ai-test-latency');
        const avisosEl = document.querySelector('#ai-test-avisos');
        const taskBadge = document.querySelector('#ai-test-task-badge');
        const modelBadge = document.querySelector('#ai-test-model-badge');
        const pidBadge = document.querySelector('#ai-test-pid-badge');

        if (outputEl) outputEl.textContent = '';
        if (titlesCardsEl) {
          titlesCardsEl.innerHTML = '';
          titlesCardsEl.style.display = 'none';
        }
        if (avisosEl) avisosEl.style.display = 'none';

        const mode = AiView.activeTestMode || 'adaptar_medida';
        const opName = TEST_MODES[mode] ? TEST_MODES[mode][isCa ? 'labelCa' : 'labelEs'] : mode;
        if (taskBadge) {
          taskBadge.textContent = opName;
        }

        // Dispatcher explícito (Sección 3.1)
        const actions = {
          sugerir_titulos: (p) => (window.GenerationApi || window.api).aiSuggestTitles(p),
          adaptar_medida: (p) => (window.GenerationApi || window.api).aiAdaptMeasure(p),
          traduccion: (p) => (window.GenerationApi || window.api).aiTranslateText(p),
          presentacion: (p) => (window.GenerationApi || window.api).aiDraftPresentation(p)
        };

        const actionFn = actions[mode];
        if (!actionFn) {
          alert(`Error: Operación no soportada: ${mode}`);
          btnRunTest.disabled = false;
          btnRunTest.textContent = isCa ? '🚀 Executar prova' : '🚀 Ejecutar prueba';
          return;
        }

        const startTime = Date.now();
        try {
          let res = null;

          if (mode === 'sugerir_titulos') {
            res = await actionFn({
              texto: text,
              municipio: 'Sant Adrià de Besòs',
              idioma: isCa ? 'ca' : 'es'
            });
          } else if (mode === 'adaptar_medida') {
            res = await actionFn({
              texto: text,
              municipio: 'Sant Adrià de Besòs',
              idioma: isCa ? 'ca' : 'es'
            });
          } else if (mode === 'traduccion') {
            const dirSelect = document.querySelector('#test-trans-direction');
            const direction = dirSelect ? dirSelect.value : 'es_ca';
            const deLang = direction === 'ca_es' ? 'ca' : 'es';
            const aLang = direction === 'ca_es' ? 'es' : 'ca';
            res = await actionFn({
              texto: text,
              de: deLang,
              a: aLang,
              idioma_destino: aLang
            });
          } else if (mode === 'presentacion') {
            res = await actionFn({
              municipio: 'Sant Adrià de Besòs',
              provincia: 'Barcelona',
              comunidad: 'Catalunya',
              partido: 'Podem',
              puntosClave: text,
              idioma: isCa ? 'ca' : 'es'
            });
          }

          const elapsed = Date.now() - startTime;
          if (resultBox) resultBox.style.display = 'block';
          if (latencyEl) latencyEl.textContent = `${elapsed} ms`;

          const diag = await window.api.aiGetDiagnostic();
          const activeModelName = (diag && (diag.modelName || diag.activeModelId)) || (isCa ? 'Cap model seleccionat' : 'Ningún modelo seleccionado');
          if (modelBadge) modelBadge.textContent = activeModelName;
          if (pidBadge) pidBadge.textContent = `PID: ${(diag && (diag.pid || diag.serverPid)) || '--'}`;

          if (res && res.ok === false) {
            const errMsg = res.error?.message || res.message || 'Error en la petición de IA';
            if (outputEl) outputEl.innerHTML = `<span style="color: #dc2626; font-weight: 700;">Error (${res.error?.code || 'ERROR'}):</span> ${escapeHtml(errMsg)}`;
          } else if (mode === 'sugerir_titulos') {
            const titles = (Array.isArray(res?.data?.titulos) && res.data.titulos.length > 0)
              ? res.data.titulos
              : (Array.isArray(res?.titulos) && res.titulos.length > 0)
                ? res.titulos
                : [];

            if (titles.length > 0) {
              if (outputEl) outputEl.textContent = isCa ? `Operació: ${opName} · Model: ${activeModelName} · Temps: ${elapsed} ms\nPropostes generades:` : `Operación: ${opName} · Modelo: ${activeModelName} · Tiempo: ${elapsed} ms\nPropuestas generadas:`;
              if (titlesCardsEl) {
                titlesCardsEl.style.display = 'flex';
                titlesCardsEl.innerHTML = titles.map((t, idx) => {
                  const words = t.trim().split(/\s+/).filter(Boolean).length;
                  return `
                    <div style="padding: 12px 14px; border: 1.5px solid #d8b4fe; border-radius: 6px; background: white; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                      <div>
                        <div style="font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; margin-bottom: 2px;">
                          ${isCa ? 'Opció' : 'Opción'} ${idx + 1} (${words} ${isCa ? 'paraules' : 'palabras'})
                        </div>
                        <div style="font-size: 14px; font-weight: 700; color: #1e1b4b;">
                          ${escapeHtml(t)}
                        </div>
                      </div>
                      <button class="btn btn-sm btn-copy-title-opt" data-title="${escapeHtml(t)}" type="button" style="font-size: 11px;">
                        📋 ${isCa ? 'Copiar' : 'Copiar'}
                      </button>
                    </div>
                  `;
                }).join('');

                titlesCardsEl.querySelectorAll('.btn-copy-title-opt').forEach(b => {
                  b.addEventListener('click', () => {
                    navigator.clipboard.writeText(b.dataset.title);
                    const orig = b.textContent;
                    b.textContent = '✓';
                    setTimeout(() => { b.textContent = orig; }, 1500);
                  });
                });
              }
            } else {
              if (outputEl) outputEl.innerHTML = `<span style="color: #dc2626; font-weight: 700;">Error:</span> No se han podido generar propuestas de título válidas.`;
            }
          } else {
            const outText = res?.data?.texto || res?.texto || (typeof res === 'string' ? res : JSON.stringify(res, null, 2));
            if (outputEl) outputEl.textContent = outText;

            if (avisosEl) {
              if (res && res.avisos && res.avisos.length > 0) {
                avisosEl.style.display = 'block';
                avisosEl.innerHTML = '<strong>' + (isCa ? 'Avisos anti-al·lucinació:' : 'Avisos anti-alucinación:') + '</strong> ' + res.avisos.join(' · ');
              } else {
                avisosEl.style.display = 'none';
              }
            }
          }
          window.GenerationUi?.markResult(res,outputEl);
        } catch (err) {
          if (resultBox) resultBox.style.display = 'block';
          if (outputEl) outputEl.innerHTML = `<span style="color: #dc2626; font-weight: 700;">Error:</span> ${escapeHtml(err.message || err)}`;
        } finally {
          btnRunTest.disabled = false;
          btnRunTest.textContent = isCa ? '🚀 Executar prova' : '🚀 Ejecutar prueba';
        }
      });
    }
  }
};

window.AiView = AiView;
