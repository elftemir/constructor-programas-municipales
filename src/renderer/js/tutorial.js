/**
 * tutorial.js - Sistema educativo integral y tutorial guiado en profundidad
 * Constructor de Programas Municipales - Versión 1.4.0
 * 
 * Incluye:
 * - Tour guiado global completo (7 pasos)
 * - 7 tutoriales específicos por pantalla (datos básicos, elegir medidas,
 *   adaptar medidas, textos generales, revisar/exportar, marco, opciones)
 * - Foco visual (spotlight) con halo resplandeciente, flecha direccional y máscara oscura
 * - Tarjeta flotante con contador de pasos, botones anterior, siguiente, saltar y finalizar
 * - Modal de bienvenida inicial (persistido en localStorage)
 * - 100% bilingüe (Castellano / Català)
 */

const Tutorial = {
  currentStep: 0,
  steps: [],
  currentSection: null,

  init() {
    this.checkFirstLaunch();
  },

  checkFirstLaunch() {
    const hasSeen = localStorage.getItem('tutorial_first_run_completed');
    if (!hasSeen) {
      setTimeout(() => {
        this.showWelcomeModal();
      }, 400);
    }
  },

  showWelcomeModal() {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const modalContainer = document.querySelector('#modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay" id="welcome-modal-overlay">
        <div class="modal-dialog" style="max-width: 620px; padding: 32px; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
          <div style="text-align: center; margin-bottom: 22px;">
            <div style="display: flex; justify-content: center; margin-bottom: 12px;">
              <img src="assets/icons/emblema_adaptador_municipal_programa_marco.png" alt="Logo" style="width: 52px; height: 52px; object-fit: contain;" />
            </div>
            <h2 class="section-title" style="font-size: 23px; color: var(--action-primary); margin-bottom: 8px;">
              ${window.i18n.t('welcome.title')}
            </h2>
            <p style="font-size: 14.5px; color: var(--text-secondary); line-height: 1.5; margin: 0 auto; max-width: 520px;">
              ${window.i18n.t('welcome.desc')}
            </p>
          </div>

          <div style="background: #fbf9ff; border: 1px solid #e9d5ff; border-radius: var(--radius-default); padding: 18px 22px; margin-bottom: 24px;">
            <div style="font-size: 13.5px; line-height: 1.85; color: #374151;">
              <div>✓ <b>${isCa ? 'Catàleg marc bilingüe unificat:' : 'Catálogo marco bilingüe unificado:'}</b> 12 ${isCa ? 'àrees i' : 'áreas y'} 123 ${isCa ? 'propostes oficials en català i castellà.' : 'propuestas oficiales en catalán y castellano.'}</div>
              <div>✓ <b>${isCa ? 'Adaptació local protegida:' : 'Adaptación local protegida:'}</b> ${isCa ? 'redacta la versió municipal sense alterar el text marc original.' : 'redacta la versión municipal sin alterar el texto marco original.'}</div>
              <div>✓ <b>${isCa ? 'Revisió guiada de dubtes:' : 'Revisión guiada de dudas:'}</b> ${isCa ? 'resol totes les propostes pendents en un sol flux de treball.' : 'resuelve todas las propuestas pendientes en un solo flujo de trabajo.'}</div>
              <div>✓ <b>${isCa ? 'Exportació Word (.docx) oficial:' : 'Exportación Word (.docx) oficial:'}</b> ${isCa ? 'portada oficial, estils tipogràfics i generació en un o ambdós idiomes.' : 'portada oficial, estilos tipográficos y generación en uno o ambos idiomas.'}</div>
              <div>✓ <b>${isCa ? 'Privadesa 100% fora de línia:' : 'Privacidad 100% fuera de línea:'}</b> ${isCa ? 'tots els projectes i dades es guarden exclusivament al teu ordinador.' : 'todos los proyectos y datos se guardan exclusivamente en tu ordenador.'}</div>
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center;">
            <button class="btn" id="btn-welcome-skip" style="padding: 10px 18px; font-weight: 500;">
              ${window.i18n.t('welcome.btn_start')}
            </button>
            <button class="btn primary" id="btn-welcome-tour" style="padding: 10px 20px; font-weight: 600;">
              🎯 ${window.i18n.t('welcome.btn_tour')}
            </button>
          </div>
        </div>
      </div>
    `;

    modalContainer.style.display = 'flex';

    const closeWelcome = () => {
      localStorage.setItem('tutorial_first_run_completed', 'true');
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    const btnSkip = modalContainer.querySelector('#btn-welcome-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', closeWelcome);
    }

    const btnTour = modalContainer.querySelector('#btn-welcome-tour');
    if (btnTour) {
      btnTour.addEventListener('click', () => {
        closeWelcome();
        this.startTour();
      });
    }
  },

  /**
   * Tour guiado general de toda la aplicación
   */
  startTour() {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    this.currentSection = 'global';
    this.steps = [
      {
        selector: '.top-bar',
        title: isCa ? 'Barra superior i estat' : 'Barra superior y estado',
        content: isCa
          ? 'Mostra el nom del programa municipal actiu, l\'indicador de desat automàtic i el botó per tancar o desar ràpidament.'
          : 'Muestra el nombre del programa municipal activo, el indicador de guardado automático y el botón para cerrar o guardar rápidamente.'
      },
      {
        selector: '.sidebar',
        title: isCa ? 'Navegació principal' : 'Navegación principal',
        content: isCa
          ? 'Estructura clara de treball: Inici (protagonista), Mis programes, Àrees i mesures, Vista prèvia paginada i Generar documents.'
          : 'Estructura clara de trabajo: Inicio (protagonista), Mis programas, Áreas y medidas, Vista previa paginada y Generar documentos.'
      },
      {
        selector: '#nav-inicio',
        title: isCa ? '1. Inici: El teu programa municipal' : '1. Inicio: Tu programa municipal',
        content: isCa
          ? 'El programa actiu és el protagonista absolut. Visualitza la fitxa de candidatura, els indicadors en temps real i continua ràpidament l\'últim treball.'
          : 'El programa activo es el protagonista absoluto. Visualiza la ficha de candidatura, los indicadores en tiempo real y continúa rápidamente el último trabajo.'
      },
      {
        selector: '#nav-mis-programas',
        title: isCa ? 'Gestió de programes' : 'Gestión de programas',
        content: isCa
          ? 'Crea nous programes municipals, duplica projectes complets per a altres municipis i gestiona còpies de seguretat en format JSON.'
          : 'Crea nuevos programas municipales, duplica proyectos completos para otros municipios y gestiona copias de seguridad en formato JSON.'
      },
      {
        selector: '#nav-areas-medidas',
        title: isCa ? '2. Àrees i mesures' : '2. Áreas y medidas',
        content: isCa
          ? 'Fluxe vertical àgil per a les 12 àrees. Llegeix el text complet de cada proposta i tria directament entre Inclosa o En dubte.'
          : 'Flujo vertical ágil para las 12 áreas. Lee el texto completo de cada propuesta y elige directamente entre Incluida o En duda.'
      },
      {
        selector: '#nav-vista-previa',
        title: isCa ? '3. Vista prèvia paginada' : '3. Vista previa paginada',
        content: isCa
          ? 'Mosaico de pàgines A4 reals i lector ampliat per comprovar la maquetació exacta abans de generar el fitxer definitiu.'
          : 'Mosaico de páginas A4 reales y lector ampliado para comprobar la maquetación exacta antes de generar el archivo definitivo.'
      },
      {
        selector: '#nav-generar-docs',
        title: isCa ? '4. Generar documents' : '4. Generar documentos',
        content: isCa
          ? 'Exportació oficial a Microsoft Word (.docx) amb portada professional, estils corporatius de Podem i sortida en català, castellà o ambdós.'
          : 'Exportación oficial a Microsoft Word (.docx) con portada profesional, estilos corporativos de Podemos y salida en castellano, catalán o ambos.'
      },
      {
        selector: '#nav-ia',
        title: isCa ? 'Intel·ligència artificial (Opcional · Fase 2)' : 'Inteligencia artificial (Opcional · Fase 2)',
        content: isCa
          ? 'Mòdul preparatori de suport en redacció que funcionarà de manera 100% autònoma i privada al teu propi ordinador.'
          : 'Módulo preparatorio de apoyo en redacción que funcionará de forma 100% autónoma y privada en tu propio ordenador.'
      }
    ];

    this.currentStep = 0;
    this.renderTourOverlay();
  },

  /**
   * Tutoriales específicos por pantalla
   */
  startSectionTour(sectionKey) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    this.currentSection = sectionKey;

    switch (sectionKey) {
      case 'datos-basicos':
      case 'basic_data':
        this.steps = [
          {
            selector: '#input-municipio, .form-group:has(#input-municipio)',
            title: isCa ? 'Cerca de municipi' : 'Búsqueda de municipio',
            content: isCa
              ? 'Escriu el nom del municipi per cercar entre els 947 municipis de Catalunya. Recupera automàticament el cens oficial Idescat/INE 2025.'
              : 'Escribe el nombre del municipio para buscar entre los 947 municipios de Cataluña. Recupera automáticamente el censo oficial Idescat/INE 2025.'
          },
          {
            selector: '#input-lema, .form-group:has(#input-lema)',
            title: isCa ? 'Lema de campanya' : 'Lema de campaña',
            content: isCa
              ? 'Introdueix el lema local (màxim 60 caràcters). Apareixerà en caràcters destacats a la portada oficial en tipografia Bebas Neue.'
              : 'Introduce el lema local (máximo 60 caracteres). Aparecerá en caracteres destacados en la portada oficial en tipografía Bebas Neue.'
          },
          {
            selector: '#btn-select-logo, .form-group:has(#btn-select-logo)',
            title: isCa ? 'Logotip municipal' : 'Logotipo municipal',
            content: isCa
              ? 'Selecciona una imatge PNG o JPG del logotip local de la candidatura per a la portada oficial.'
              : 'Selecciona una imagen PNG o JPG del logotipo local de la candidatura para la portada oficial.'
          },
          {
            selector: '#btn-save-basic-data, .view-footer button.primary',
            title: isCa ? 'Desar canvis' : 'Guardar cambios',
            content: isCa
              ? 'Prem aquest botó per desar tota la informació territorial i continuar a la selecció de propostes.'
              : 'Pulsa este botón para guardar toda la información territorial y continuar a la selección de propuestas.'
          }
        ];
        break;

      case 'elegir-medidas':
      case 'choose_measures':
      case 'areas-medidas':
        this.steps = [
          {
            selector: '.area-top-header',
            title: isCa ? 'Barra de navegació de l\'àrea' : 'Barra de navegación del área',
            content: isCa
              ? 'Desplegable amb les 12 àrees oficials, fletxes anterior/següent i comptadors d\'estat (incloses, en dubte, pendents).'
              : 'Desplegable con las 12 áreas oficiales, flechas anterior/siguiente y contadores de estado (incluidas, en duda, pendientes).'
          },
          {
            selector: '.area-intro-card',
            title: isCa ? 'Introducció de l\'àrea' : 'Introducción del área',
            content: isCa
              ? 'Mostra la introducció de referència del catàleg marc o et permet redactar una introducció municipal personalitzada per encapçalar la secció.'
              : 'Muestra la introducción de referencia del catálogo marco o te permite redactar una introducción municipal personalizada para encabezar la sección.'
          },
          {
            selector: '.toolbar',
            title: isCa ? 'Cercador i filtres ràpids' : 'Buscador y filtros rápidos',
            content: isCa
              ? 'Cerca per text en temps real i filtra per estat o origen (Marc, Adaptades o Propostes pròpies).'
              : 'Busca por texto en tiempo real y filtra por estado u origen (Marco, Adaptadas o Propuestas propias).'
          },
          {
            selector: '.measure-card-vertical:first-child',
            title: isCa ? 'Targeta vertical de proposta' : 'Tarjeta vertical de propuesta',
            content: isCa
              ? 'Conté el codi del marc, títol en negreta, redacció completa i el botó per adaptar el text a la realitat local.'
              : 'Contiene el código del marco, título en negrita, redacción completa y el botón para adaptar el texto a la realidad local.'
          },
          {
            selector: '.measure-card-vertical:first-child .measure-decision-column',
            title: isCa ? 'Columna de decisió directa' : 'Columna de decisión directa',
            content: isCa
              ? 'Opcions de decisió directa (Inclosa, En dubte). Pots activar o desactivar la selecció amb un clic i es desa immediatament.'
              : 'Opciones de decisión directa (Incluida, En duda). Puedes activar o desactivar la selección con un clic y se guarda inmediatamente.'
          }
        ];
        break;

      case 'adaptar-medidas':
      case 'adapt_measure':
        this.steps = [
          {
            selector: '.adapt-orig-card, .adapt-card-original',
            title: isCa ? 'Text marc original (Protegit)' : 'Texto marco original (Protegido)',
            content: isCa
              ? 'Aquesta columna mostra la proposta original de Podem Catalunya. Està bloquejada contra edició perquè mantinguis sempre la referència exacta.'
              : 'Esta columna muestra la propuesta original de Podem Catalunya. Está bloqueada contra edición para que mantengas siempre la referencia exacta.'
          },
          {
            selector: '#adapt-edit-texto, .adapt-card-municipal',
            title: isCa ? 'Versió municipal' : 'Versión municipal',
            content: isCa
              ? 'Redacta aquí la proposta adaptada a la realitat local. Els canvis es desen automàticament de forma immediata.'
              : 'Redacta aquí la propuesta adaptada a la realidad local. Los cambios se guardan automáticamente de forma inmediata.'
          },
          {
            selector: '#adapt-edit-exp',
            title: isCa ? 'Explicació i desenvolupament' : 'Explicación y desarrollo',
            content: isCa
              ? 'Detalla justificacions, fases o dades locals adicionals que s\'exportaran al document final.'
              : 'Detalla justificaciones, fases o datos locales adicionales que se exportarán al documento final.'
          },
          {
            selector: '#btn-save-adaptation, #btn-done-adaptation',
            title: isCa ? 'Enllestir adaptació' : 'Finalizar adaptación',
            content: isCa
              ? 'Prem per tornar al llistat de mesures amb la proposta marcada com a Adaptada.'
              : 'Pulsa para volver al listado de medidas con la propuesta marcada como Adaptada.'
          }
        ];
        break;

      case 'textos-generales':
      case 'general_texts':
        this.steps = [
          {
            selector: '#pres-title, #pres-lead',
            title: isCa ? 'Presentació política' : 'Presentación política',
            content: isCa
              ? 'Redacta el missatge central i l\'entradeta de la candidatura per encapçalar el document electoral.'
              : 'Redacta el mensaje central y la entradilla de la candidatura para encabezar el documento electoral.'
          },
          {
            selector: '#pres-body',
            title: isCa ? 'Cos de la presentació' : 'Cuerpo de la presentación',
            content: isCa
              ? 'Pàrrafs d\'argumentari polític que s\'incorporaran a la secció 2 del document Word.'
              : 'Párrafos de argumentario político que se incorporarán a la sección 2 del documento Word.'
          },
          {
            selector: '#cierre-body',
            title: isCa ? 'Text de cloenda' : 'Texto de cierre',
            content: isCa
              ? 'Agraïments, crida al vot i missatge final abans de la contraportada.'
              : 'Agradecimientos, llamada al voto y mensaje final antes de la contraportada.'
          }
        ];
        break;

      case 'revisar-exportar':
      case 'review_export':
        this.steps = [
          {
            selector: '.export-summary-box',
            title: isCa ? 'Balanç de propostes' : 'Balance de propuestas',
            content: isCa
              ? 'Comprova el recompte total de mesures que formaran part del document Word (incloses, adaptades i pròpies).'
              : 'Comprueba el recuento total de medidas que formarán parte del documento Word (incluidas, adaptadas y propias).'
          },
          {
            selector: '#btn-review-doubts, .review-doubts-card',
            title: isCa ? 'Revisió guiada de dubtes' : 'Revisión guiada de dudas',
            content: isCa
              ? 'Assistent que et permet resoldre totes les mesures pendents una per una abans de la impressió final.'
              : 'Asistente que te permite resolver todas las medidas pendientes una por una antes de la impresión final.'
          },
          {
            selector: '#export-lang-select, .export-lang-group',
            title: isCa ? 'Idioma d\'exportació' : 'Idioma de exportación',
            content: isCa
              ? 'Tria si vols generar el document en català, en castellà o en tots dos idiomes en fitxers separats.'
              : 'Elige si deseas generar el documento en catalán, en castellano o en ambos idiomas en archivos separados.'
          },
          {
            selector: '#btn-export-docx, #btn-export-word',
            title: isCa ? 'Generar document Word (.docx)' : 'Generar documento Word (.docx)',
            content: isCa
              ? 'Genera el document oficial editable amb portada oficial, estils tipogràfics i taula de continguts.'
              : 'Genera el documento oficial editable con portada oficial, estilos tipográficos y tabla de contenidos.'
          }
        ];
        break;

      case 'marco':
      case 'framework':
        this.steps = [
          {
            selector: '.view-header',
            title: isCa ? 'Catàleg marc de referència' : 'Catálogo marco de referencia',
            content: isCa
              ? 'Consulta l\'estructura íntegra de les 12 àrees i 123 mesures del programa de Podem Catalunya.'
              : 'Consulta la estructura íntegra de las 12 áreas y 123 medidas del programa de Podem Catalunya.'
          },
          {
            selector: '#marco-lang-toggle, .lang-toggle-btn',
            title: isCa ? 'Selector bilingüe del marc' : 'Selector bilingüe del marco',
            content: isCa
              ? 'Alterna en qualsevol moment entre la versió en castellà i la versió en català del text marc oficial.'
              : 'Alterna en cualquier momento entre la versión en castellano y la versión en catalán del texto marco oficial.'
          }
        ];
        break;

      case 'opciones':
      case 'options':
        this.steps = [
          {
            selector: '#opt-lang-select, .options-lang-card',
            title: isCa ? 'Idioma de la interfície' : 'Idioma de la interfaz',
            content: isCa
              ? 'Canvia l\'idioma global de l\'aplicació entre català i castellà amb un sol clic.'
              : 'Cambia el idioma global de la aplicación entre catalán y castellano con un solo clic.'
          },
          {
            selector: '#opt-folder-input, .options-folder-card',
            title: isCa ? 'Carpeta de documents' : 'Carpeta de documentos',
            content: isCa
              ? 'Configura la ubicació on es desaran els documents Word exportats.'
              : 'Configura la ubicación donde se guardarán los documentos Word exportados.'
          }
        ];
        break;

      default:
        this.startTour();
        return;
    }

    this.currentStep = 0;
    this.renderTourOverlay();
  },

  renderTourOverlay() {
    let overlay = document.querySelector('#tour-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tour-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.zIndex = '99999';
      overlay.style.pointerEvents = 'auto';
      document.body.appendChild(overlay);
    }

    const step = this.steps[this.currentStep];
    const isCa = window.i18n && window.i18n.getLang() === 'ca';
    const isLast = this.currentStep === this.steps.length - 1;

    // Localizar elemento objetivo
    let targetEl = null;
    if (step.selector) {
      const selectors = step.selector.split(',').map(s => s.trim());
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) {
            targetEl = el;
            break;
          }
        } catch (e) {}
      }
    }

    let targetRect = {
      top: window.innerHeight * 0.25,
      left: window.innerWidth * 0.25,
      width: Math.min(500, window.innerWidth * 0.5),
      height: 120
    };

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const rect = targetEl.getBoundingClientRect();
      targetRect = {
        top: Math.max(10, rect.top),
        left: Math.max(10, rect.left),
        width: Math.max(80, rect.width),
        height: Math.max(40, rect.height)
      };
    }

    // Calcular posición de la tarjeta emergente y de la flecha
    const popoverWidth = 380;
    let popoverTop = targetRect.top + targetRect.height + 16;
    let popoverLeft = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
    let arrowPlacement = 'top';

    // Ajustes de límites de pantalla
    if (popoverLeft < 16) popoverLeft = 16;
    if (popoverLeft + popoverWidth > window.innerWidth - 16) {
      popoverLeft = window.innerWidth - popoverWidth - 16;
    }

    if (popoverTop + 240 > window.innerHeight) {
      // Posicionar encima
      popoverTop = Math.max(16, targetRect.top - 240);
      arrowPlacement = 'bottom';
    }

    overlay.innerHTML = `
      <!-- Máscara con foco y halo resplandeciente -->
      <div style="position: absolute; top: ${targetRect.top - 6}px; left: ${targetRect.left - 6}px; width: ${targetRect.width + 12}px; height: ${targetRect.height + 12}px; border-radius: 8px; box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.72), 0 0 0 4px #8B5CF6, 0 0 24px rgba(139, 92, 246, 0.7); pointer-events: none; z-index: 100000; transition: all 0.25s ease;"></div>

      <!-- Tarjeta explicativa con flecha indicadora -->
      <div style="position: absolute; top: ${popoverTop}px; left: ${popoverLeft}px; width: ${popoverWidth}px; background: #ffffff; border-radius: 12px; box-shadow: 0 25px 35px -5px rgba(0, 0, 0, 0.35), 0 10px 15px -5px rgba(0, 0, 0, 0.2); z-index: 100001; padding: 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        
        <!-- Flecha direccional -->
        <div style="position: absolute; ${arrowPlacement === 'top' ? 'top: -8px;' : 'bottom: -8px;'} left: 32px; width: 16px; height: 16px; background: #ffffff; transform: rotate(45deg); box-shadow: ${arrowPlacement === 'top' ? '-2px -2px 4px rgba(0,0,0,0.06)' : '2px 2px 4px rgba(0,0,0,0.06)'};"></div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: #7C3AED; letter-spacing: 0.6px;">
            ${isCa ? `Pas ${this.currentStep + 1} de ${this.steps.length}` : `Paso ${this.currentStep + 1} de ${this.steps.length}`}
          </span>
          <button id="btn-tour-close" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #9CA3AF; padding: 0 4px; line-height: 1;">✕</button>
        </div>

        <h3 style="font-size: 17px; font-weight: 700; color: #111827; margin: 0 0 8px; line-height: 1.3;">
          ${step.title}
        </h3>

        <p style="font-size: 13.5px; color: #4B5563; line-height: 1.55; margin: 0 0 18px;">
          ${step.content}
        </p>

        <div style="display: flex; justify-content: space-between; align-items: center; pt-2; border-top: 1px solid #f3f4f6; padding-top: 14px;">
          <button id="btn-tour-skip" style="background: none; border: none; font-size: 12.5px; color: #6B7280; cursor: pointer; text-decoration: underline; padding: 0;">
            ${isCa ? 'Saltar guia' : 'Saltar guía'}
          </button>
          
          <div style="display: flex; gap: 8px;">
            ${this.currentStep > 0 ? `
              <button id="btn-tour-prev" style="padding: 6px 12px; font-size: 12.5px; border: 1px solid #D1D5DB; background: #ffffff; color: #374151; font-weight: 500; border-radius: 6px; cursor: pointer;">
                ${isCa ? 'Anterior' : 'Anterior'}
              </button>
            ` : ''}
            <button id="btn-tour-next" style="padding: 7px 16px; font-size: 12.5px; border: none; background: #7C3AED; color: #ffffff; font-weight: 600; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);">
              ${isLast ? (isCa ? 'Finalitzar' : 'Finalizar') : (isCa ? 'Següent ›' : 'Siguiente ›')}
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    overlay.querySelector('#btn-tour-close').addEventListener('click', () => this.endTour());
    overlay.querySelector('#btn-tour-skip').addEventListener('click', () => this.endTour());

    const btnPrev = overlay.querySelector('#btn-tour-prev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (this.currentStep > 0) {
          this.currentStep--;
          this.renderTourOverlay();
        }
      });
    }

    const btnNext = overlay.querySelector('#btn-tour-next');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (isLast) {
          this.endTour();
        } else {
          this.currentStep++;
          this.renderTourOverlay();
        }
      });
    }
  },

  endTour() {
    const overlay = document.querySelector('#tour-overlay');
    if (overlay) overlay.remove();
  }
};

window.Tutorial = Tutorial;
