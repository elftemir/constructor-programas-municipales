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
        <div class="modal-dialog" style="max-width: 660px; padding: 30px; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: flex; justify-content: center; margin-bottom: 12px;">
              <img src="assets/icons/emblema_adaptador_municipal_programa_marco.png" alt="Logo" style="width: 52px; height: 52px; object-fit: contain;" />
            </div>
            <h2 class="section-title" style="font-size: 22px; color: var(--action-primary); margin-bottom: 6px;">
              ${window.i18n.t('welcome.title')}
            </h2>
            <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin: 0 auto; max-width: 560px;">
              ${window.i18n.t('welcome.desc')}
            </p>
          </div>

          <div style="background: #fbf9ff; border: 1px solid #e9d5ff; border-radius: var(--radius-default); padding: 16px 20px; margin-bottom: 22px; max-height: 330px; overflow-y: auto;">
            <div style="font-size: 13px; line-height: 1.75; color: #374151; display: flex; flex-direction: column; gap: 6px;">
              <div>✓ <b>${isCa ? '1. Inici:' : '1. Inicio:'}</b> ${isCa ? 'panell principal amb resum del programa actiu, estat de redacció i darreres accions.' : 'panel principal con resumen del programa activo, estado de redacción y últimas acciones.'}</div>
              <div>✓ <b>${isCa ? '2. Els meus programes:' : '2. Mis programas:'}</b> ${isCa ? 'gestió de múltiples candidatures, duplicació entre municipis i còpies de seguretat en format JSON.' : 'gestión de múltiples candidaturas, duplicación entre municipios y copias de seguridad en formato JSON.'}</div>
              <div>✓ <b>${isCa ? '3. Programes font:' : '3. Programas fuente:'}</b> ${isCa ? 'importació i gestió de documents polítics base (PDF, DOCX, programes marc o anteriors).' : 'importación y gestión de documentos políticos base (PDF, DOCX, programas marco o anteriores).'}</div>
              <div>✓ <b>${isCa ? '4. Àrees i mesures:' : '4. Áreas y medidas:'}</b> ${isCa ? 'selecció i adaptació de propostes mantenint el catàleg oficial intacte i protegit.' : 'selección y adaptación de propuestas manteniendo el catálogo oficial intacto y protegido.'}</div>
              <div>✓ <b>${isCa ? '5. Textos del programa:' : '5. Textos del programa:'}</b> ${isCa ? 'redacció de presentació política, entradilles per àrees temàtiques i text de tancament.' : 'redacción de presentación política, entradillas por áreas temáticas y texto de cierre.'}</div>
              <div>✓ <b>${isCa ? '6. Vista prèvia:' : '6. Vista previa:'}</b> ${isCa ? 'mosaïc de pàgines A4 reals i lector ampliat per comprovar la maquetació abans d\'exportar.' : 'mosaico de páginas A4 reales y lector ampliado para comprobar la maquetación antes de exportar.'}</div>
              <div>✓ <b>${isCa ? '7. Generar documents:' : '7. Generar documentos:'}</b> ${isCa ? 'exportació oficial editable a Microsoft Word (.docx) i conversió directa a PDF d\'alta fidelitat.' : 'exportación oficial editable a Microsoft Word (.docx) y conversión directa a PDF de alta fidelidad.'}</div>
              <div>✓ <b>${isCa ? '8. Intel·ligència artificial (Opcional):' : '8. Inteligencia artificial (Opcional):'}</b> ${isCa ? 'suport en redacció i traducció bilingüe 100% autònom i privat al teu ordinador.' : 'apoyo en redacción y traducción bilingüe 100% autónomo y privado en tu ordenador.'}</div>
              <div>✓ <b>${isCa ? '9. Actualitzacions:' : '9. Actualizaciones:'}</b> ${isCa ? 'canal de millores de l\'aplicació i sincronització de nous continguts de manera segura.' : 'canal de mejoras de la aplicación y sincronización de nuevos contenidos de forma segura.'}</div>
              <div>✓ <b>${isCa ? '10. Configuració i privadesa:' : '10. Configuración y privacidad:'}</b> ${isCa ? 'idioma d\'interfície, carpetes locals, política de privadesa i llicència lliure GPL.' : 'idioma de interfaz, carpetas locales, política de privacidad y licencia libre GPL.'}</div>
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
          ? 'Estructura clara de treball: Inici, Els meus programes, Programes font, Àrees i mesures, Textos, Vista prèvia, Generar documents, IA, Ajuda i Configuració.'
          : 'Estructura clara de trabajo: Inicio, Mis programas, Programas fuente, Áreas y medidas, Textos, Vista previa, Generar documentos, IA, Ayuda y Configuración.'
      },
      {
        selector: '#nav-inicio',
        title: isCa ? '1. Inici: El teu programa municipal' : '1. Inicio: Tu programa municipal',
        content: isCa
          ? 'El programa actiu és el protagonista. Visualitza la fitxa de candidatura, els indicadors en temps real i l\'estat de les actualitzacions.'
          : 'El programa activo es el protagonista. Visualiza la ficha de candidatura, los indicadores en tiempo real y el estado de las actualizaciones.'
      },
      {
        selector: '#nav-mis-programas',
        title: isCa ? '2. Els meus programes' : '2. Mis programas',
        content: isCa
          ? 'Crea nous programes municipals, duplica projectes complets per a altres municipis i gestiona còpies de seguretat en format JSON.'
          : 'Crea nuevos programas municipales, duplica proyectos completos para otros municipios y gestiona copias de seguridad en formato JSON.'
      },
      {
        selector: '#nav-fuentes',
        title: isCa ? '3. Programes font' : '3. Programas fuente',
        content: isCa
          ? 'Gestiona els documents polítics de referència (programa marc, autonòmic, estatal o municipal anterior) a partir dels quals es creen els programes.'
          : 'Gestiona los documentos políticos de referencia (programa marco, autonómico, estatal o municipal anterior) a partir de los cuales se crean los programas.'
      },
      {
        selector: '#nav-areas-medidas',
        title: isCa ? '4. Àrees i mesures' : '4. Áreas y medidas',
        content: isCa
          ? 'Fluxe de treball per a les 12 àrees. Llegeix el text complet de cada proposta i tria directament entre Inclosa o En dubte.'
          : 'Flujo de trabajo para las 12 áreas. Lee el texto completo de cada propuesta y elige directamente entre Incluida o En duda.'
      },
      {
        selector: '#nav-textos-generales',
        title: isCa ? '5. Textos del programa' : '5. Textos del programa',
        content: isCa
          ? 'Redacta la presentació política de la candidatura, les introduccions d\'àrea i el text de cloenda del document final.'
          : 'Redacta la presentación política de la candidatura, las introducciones de área y el texto de cierre del documento final.'
      },
      {
        selector: '#nav-vista-previa',
        title: isCa ? '6. Vista prèvia paginada' : '6. Vista previa paginada',
        content: isCa
          ? 'Mosaic de pàgines A4 reals i lector ampliat per comprovar la maquetació exacta abans de generar el fitxer definitiu.'
          : 'Mosaico de páginas A4 reales y lector ampliado para comprobar la maquetación exacta antes de generar el archivo definitivo.'
      },
      {
        selector: '#nav-generar-docs',
        title: isCa ? '7. Generar documents' : '7. Generar documentos',
        content: isCa
          ? 'Exportació oficial a Microsoft Word (.docx) amb portada professional, estils corporatius i sortida en català, castellà o ambdós.'
          : 'Exportación oficial a Microsoft Word (.docx) con portada profesional, estilos corporativos y salida en castellano, catalán o ambos.'
      },
      {
        selector: '#nav-ia',
        title: isCa ? '8. Intel·ligència artificial (Opcional)' : '8. Inteligencia artificial (Opcional)',
        content: isCa
          ? 'Mòdul d\'assistència en redacció, títols i traducció que funciona de manera 100% autònoma i privada al teu propi ordinador.'
          : 'Módulo de asistencia en redacción, títulos y traducción que funciona de forma 100% autónoma y privada en tu propio ordenador.'
      },
      {
        selector: '#nav-configuracion, #home-updates-zone',
        title: isCa ? '9. Actualitzacions i Configuració' : '9. Actualizaciones y Configuración',
        content: isCa
          ? 'Configura l\'idioma, consulta la política de privadesa i gestiona les actualitzacions del programari i dels continguts polítics.'
          : 'Configura el idioma, consulta la política de privacidad y gestiona las actualizaciones del software y de los contenidos políticos.'
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
      case 'home':
        this.steps = [
          {
            selector: '.candidate-hero-card, .view-header',
            title: isCa ? 'Panell d\'Inici' : 'Panel de Inicio',
            content: isCa
              ? 'Mostra el programa municipal actiu amb el lema de campanya, el logotip i l\'últim estat de redacció.'
              : 'Muestra el programa municipal activo con el lema de campaña, el logotipo y el último estado de redacción.'
          },
          {
            selector: '#home-updates-zone',
            title: isCa ? 'Bloc d\'actualitzacions' : 'Bloque de actualizaciones',
            content: isCa
              ? 'Informa de l\'estat de la versió de l\'aplicació i dels continguts. El botó "Opcions" et porta directament a configurar-les.'
              : 'Informa del estado de la versión de la aplicación y de los contenidos. El botón "Opciones" te lleva directamente a configurarlas.'
          },
          {
            selector: '.home-actions-card, #btn-home-continue-working',
            title: isCa ? 'Continuar treballant' : 'Continuar trabajando',
            content: isCa
              ? 'Accés directe per reprendre la feina exactament a la darrera proposta o àrea on estaves treballant.'
              : 'Acceso directo para retomar el trabajo exactamente en la última propuesta o área donde estabas trabajando.'
          }
        ];
        break;

      case 'programs':
      case 'mis-programas':
        this.steps = [
          {
            selector: '.view-header',
            title: isCa ? 'Gestió de programes' : 'Gestión de programas',
            content: isCa
              ? 'Llistat complet de tots els teus projectes municipals creats i guardats al teu equip.'
              : 'Listado completo de todos tus proyectos municipales creados y guardados en tu equipo.'
          },
          {
            selector: '#btn-create-new-prog, #btn-create-first-prog',
            title: isCa ? 'Crear nou programa' : 'Crear nuevo programa',
            content: isCa
              ? 'Inicia un nou programa per a qualsevol municipi seleccionant la font política de referència.'
              : 'Inicia un nuevo programa para cualquier municipio seleccionando la fuente política de referencia.'
          },
          {
            selector: '#btn-import-prog, #btn-import-prog-empty',
            title: isCa ? 'Importar còpies JSON' : 'Importar copias JSON',
            content: isCa
              ? 'Recupera còpies de seguretat o comparteix programes municipals amb companys de forma senzilla.'
              : 'Recupera copias de seguridad o comparte programas municipales con compañeros de forma sencilla.'
          }
        ];
        break;

      case 'fuentes':
      case 'source_programs':
      case 'programas-fuente':
        this.steps = [
          {
            selector: '.view-header',
            title: isCa ? 'Programes font' : 'Programas fuente',
            content: isCa
              ? 'Els programes font són els documents polítics de referència (Programa Marc oficial, autonòmic, estatal o municipal anterior).'
              : 'Los programas fuente son los documentos políticos de referencia (Programa Marco oficial, autonómico, estatal o municipal anterior).'
          },
          {
            selector: '#btn-import-new-source',
            title: isCa ? 'Importar programa font' : 'Importar programa fuente',
            content: isCa
              ? 'Pots importar els teus propis documents en format DOCX o PDF. El sistema n\'extraurà l\'estructura d\'àrees i mesures.'
              : 'Puedes importar tus propios documentos en formato DOCX o PDF. El sistema extraerá la estructura de áreas y medidas.'
          },
          {
            selector: '.badge:has(span), .sources-grid, .card:first-child',
            title: isCa ? 'Font activa' : 'Fuente activa',
            content: isCa
              ? 'La font marcada com a activa serà la plantilla utilitzada quan creïs un nou programa municipal.'
              : 'La fuente marcada como activa será la plantilla utilizada cuando crees un nuevo programa municipal.'
          }
        ];
        break;

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
              ? 'Desplegable amb les àrees oficials, fletxes anterior/següent i comptadors d\'estat (incloses, en dubte, pendents).'
              : 'Desplegable con las áreas oficiales, flechas anterior/siguiente y contadores de estado (incluidas, en duda, pendientes).'
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
              ? 'Conté el codi de la proposta, títol en negreta, redacció completa i el botó per adaptar el text a la realitat local.'
              : 'Contiene el código de la propuesta, título en negrita, redacción completa y el botón para adaptar el texto a la realidad local.'
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
            title: isCa ? 'Text font original (Protegit)' : 'Texto fuente original (Protegido)',
            content: isCa
              ? 'Aquesta columna mostra la proposta original de referència. Està protegida contra edició perquè mantinguis sempre el text base.'
              : 'Esta columna muestra la propuesta original de referencia. Está protegida contra edición para que mantengas siempre el texto base.'
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

      case 'general_texts_presentacion':
        this.steps = [
          {
            selector: '#btn-tab-presentacion',
            title: isCa ? 'Pestanya Presentació' : 'Pestaña Presentación',
            content: isCa
              ? 'Secció dedicada a la presentació política del programa electoral municipal (Secció 2 de la plantilla Word).'
              : 'Sección dedicada a la presentación política del programa electoral municipal (Sección 2 de la plantilla Word).'
          },
          {
            selector: '#input-pres-titulo, #input-pres-entradilla',
            title: isCa ? 'Títol i entradeta destacada' : 'Título y entradilla destacada',
            content: isCa
              ? 'Defineix el títol del capítol i l\'entradeta introductòria que sintetitza el missatge i lideratge de la candidatura.'
              : 'Define el título del capítulo y la entradilla introductoria que sintetiza el mensaje y liderazgo de la candidatura.'
          },
          {
            selector: '#input-pres-cuerpo',
            title: isCa ? 'Cos polític de la presentació' : 'Cuerpo político de la presentación',
            content: isCa
              ? 'Redacta els paràgrafs centrals. Separa amb salts de línia dobles per crear paràgrafs independents maquetats a Word.'
              : 'Redacta los párrafos centrales. Separa con saltos de línea dobles para crear párrafos independientes maquetados en Word.'
          }
        ];
        break;

      case 'general_texts_intros':
      case 'general_texts_introducciones':
        this.steps = [
          {
            selector: '#btn-tab-intros',
            title: isCa ? 'Pestanya Introduccions d\'àrees' : 'Pestaña Introducciones de áreas',
            content: isCa
              ? 'Permet personalitzar la introducció pedagògica de cadascuna de les 12 àrees temàtiques del programa.'
              : 'Permite personalizar la introducción pedagógica de cada una de las 12 áreas temáticas del programa.'
          },
          {
            selector: '#select-intro-area',
            title: isCa ? 'Selector d\'àrea' : 'Selector de área',
            content: isCa
              ? 'Tria l\'àrea temàtica que vols redactar o revisar en aquest moment.'
              : 'Elige el área temática que deseas redactar o revisar en este momento.'
          },
          {
            selector: '#input-intro-cuerpo, #input-intro-frase',
            title: isCa ? 'Entradeta i frase destacada' : 'Entradilla y frase destacada',
            content: isCa
              ? 'El cos s\'utilitza com a obertura de l\'àrea i la frase destacada es maqueta com a cita visual de gran impacte.'
              : 'El cuerpo se utiliza como apertura del área y la frase destacada se maqueta como cita visual de gran impacto.'
          }
        ];
        break;

      case 'general_texts_cierre':
        this.steps = [
          {
            selector: '#btn-tab-cierre',
            title: isCa ? 'Pestanya Tancament' : 'Pestaña Cierre',
            content: isCa
              ? 'Apartat final del programa electoral per al missatge de conclusió, crida al vot i compromisos.'
              : 'Apartado final del programa electoral para el mensaje de conclusión, llamamiento al voto y compromisos.'
          },
          {
            selector: '#input-cierre-titulo, #input-cierre-cuerpo',
            title: isCa ? 'Títol i missatge de cloenda' : 'Título y mensaje de cierre',
            content: isCa
              ? 'Redacta el text que tancarà el document just abans de la contraportada oficial.'
              : 'Redacta el texto que cerrará el documento justo antes de la contraportada oficial.'
          }
        ];
        break;

      case 'textos-generales':
      case 'general_texts':
        this.steps = [
          {
            selector: '#btn-tab-presentacion',
            title: isCa ? 'Subapartats generals' : 'Subapartados generales',
            content: isCa
              ? 'Alterna entre la Presentació política de la candidatura, les Introduccions d\'àrees i el Tancament del programa.'
              : 'Alterna entre la Presentación política de la candidatura, las Introducciones de áreas y el Cierre del programa.'
          },
          {
            selector: '#btn-lang-es, #btn-lang-ca',
            title: isCa ? 'Conmutador d\'idioma' : 'Conmutador de idioma',
            content: isCa
              ? 'Permet redactar o traduir tant la versió en castellà com la versió en català dels textos generals.'
              : 'Permite redactar o traducir tanto la versión en castellano como la versión en catalán de los textos generales.'
          }
        ];
        break;

      case 'vista-previa':
      case 'preview':
        this.steps = [
          {
            selector: '.view-header',
            title: isCa ? 'Vista prèvia paginada' : 'Vista previa paginada',
            content: isCa
              ? 'Comprova la distribució real i estimada de les pàgines del document oficial abans d\'exportar-lo a Word.'
              : 'Comprueba la distribución real y estimada de las páginas del documento oficial antes de exportarlo a Word.'
          },
          {
            selector: '.card:has(.badge)',
            title: isCa ? 'Mètriques del document' : 'Métricas del documento',
            content: isCa
              ? 'Recompte de propostes incloses, àrees cobertes i estimació de pàgines totals del programa.'
              : 'Recuento de propuestas incluidas, áreas cubiertas y estimación de páginas totales del programa.'
          }
        ];
        break;

      case 'revisar-exportar':
      case 'review_export':
      case 'generar-documentos':
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

      case 'ai':
      case 'ia':
        this.steps = [
          {
            selector: '.view-header',
            title: isCa ? 'Intel·ligència Artificial Local' : 'Inteligencia Artificial Local',
            content: isCa
              ? 'Motor d\'intel·ligència artificial que funciona 100% al teu ordinador de manera privada, sense enviar dades enlloc.'
              : 'Motor de inteligencia artificial que funciona 100% en tu ordenador de forma privada, sin enviar datos a ningún sitio.'
          },
          {
            selector: '#ai-specs-card',
            title: isCa ? 'Diagnòstic de maquinari' : 'Diagnóstico de hardware',
            content: isCa
              ? 'Comprova si el teu equip disposa dels requisits adequats per executar models locals lleugers o avançats.'
              : 'Comprueba si tu equipo dispone de los requisitos adecuados para ejecutar modelos locales ligeros o avanzados.'
          },
          {
            selector: '#ai-models-catalog-card',
            title: isCa ? 'Catàleg de models' : 'Catálogo de modelos',
            content: isCa
              ? 'Pots descarregar i activar models neuronals GGUF lliures de diverses mides o fer servir el motor integrat.'
              : 'Puedes descargar y activar modelos neuronales GGUF libres de varios tamaños o usar el motor integrado.'
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
      case 'configuracion':
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
          },
          {
            selector: '#card-options-updates',
            title: isCa ? 'Actualitzacions del programari i continguts' : 'Actualizaciones del software y contenidos',
            content: isCa
              ? 'Comprova versions de l\'aplicació, actualitzacions de continguts i configura la cerca periòdica.'
              : 'Comprueba versiones de la aplicación, actualizaciones de contenidos y configura la búsqueda periódica.'
          },
          {
            selector: '#card-about-app',
            title: isCa ? 'Quant a l\'aplicació i privadesa' : 'Acerca de la aplicación y privacidad',
            content: isCa
              ? 'Consulta l\'autoria, la llicència lliure GPL-3.0 i l\'accés a la Política de Privadesa oficial.'
              : 'Consulta la autoría, la licencia libre GPL-3.0 y el acceso a la Política de Privacidad oficial.'
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
