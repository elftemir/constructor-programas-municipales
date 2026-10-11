/**
 * helpView.js - Vista de Ayuda, Preguntas Frecuentes y Tutoriales
 * Constructor de Programas Municipales - Versión 1.4.0
 * 
 * Contiene:
 * - 4 Tarjetas de acción rápida ("No encuentro una medida", "No sé cómo adaptar una medida",
 *   "No sé qué me falta antes de exportar", "No encuentro mi Word exportado")
 * - Lanzadores de los 7 tutoriales específicos y el tutorial global
 * - Preguntas Frecuentes (FAQ) interactivas con buscador en tiempo real
 * - 100% bilingüe (Castellano / Català) con window.i18n.t()
 */

const HelpView = {
  faqItems: [
    {
      id: 'faq-1',
      question_es: '¿Puedo inventar y añadir medidas propias no presentes en el marco?',
      question_ca: 'Puc inventar i afegir mesures pròpies no presents al marc?',
      answer_es: 'Sí, totalmente. Desde "Áreas y medidas" pulsa en "+ Añadir medida propia". Podrás redactar una propuesta local desde cero y asignarla a cualquiera de las 12 áreas temáticas. Se incluirá automáticamente en la exportación oficial de Word.',
      answer_ca: 'Sí, totalment. Des d\'"Àrees i mesures" prem a "+ Afegir mesura pròpia". Podràs redactar una proposta local des de zero i assignar-la a qualsevol de les 12 àrees temàtiques. S\'incorporarà automàticament a l\'exportació oficial de Word.',
      category: 'measures'
    },
    {
      id: 'faq-2',
      question_es: '¿Qué ocurre si dejo medidas con el estado "En duda"?',
      question_ca: 'Què passa si deixo mesures amb l\'estat "En dubte"?',
      answer_es: 'Las medidas que continúen marcadas como "En duda" NO se exportarán al documento Word final. Puedes comprobarlo en la "Vista previa" paginada o resolverlas directamente en "Áreas y medidas" antes de exportar.',
      answer_ca: 'Les mesures que continuïn marcades com a "En dubte" NO s\'exportaran al document Word final. Pots comprovar-ho a la "Vista prèvia" paginada o resoldre-les directament a "Àrees i mesures" abans d\'exportar.',
      category: 'review'
    },
    {
      id: 'faq-3',
      question_es: '¿Se modifica o se pierde el texto original del programa marco al adaptar una medida?',
      question_ca: 'Es modifica o es perd el text original del programa marc en adaptar una mesura?',
      answer_es: 'Jamás. El texto del programa marco de Podem Catalunya está estrictamente protegido y permanece inalterable en la base de datos de referencia. Solo se edita tu copia municipal, y siempre puedes pulsar "Restablecer oficial" para recuperar el texto marco.',
      answer_ca: 'Mai. El text del programa marc de Podem Catalunya està estrictament protegit i roman inalterable a la base de dades de referència. Només s\'edita la teva còpia municipal, i sempre pots prémer "Restablir oficial" per recuperar el text marc.',
      category: 'measures'
    },
    {
      id: 'faq-4',
      question_es: '¿Cómo puedo exportar el programa electoral en castellano y en catalán a la vez?',
      question_ca: 'Com puc exportar el programa electoral en castellà i en català alhora?',
      answer_es: 'En "Generar documentos", en el selector "Idioma del documento a exportar", selecciona la opción "Ambos idiomas (Dos documentos separados)". La aplicación generará dos archivos Word (.docx) independientes e idénticos en diseño y formato.',
      answer_ca: 'A "Generar documents", al selector "Idioma del document a exportar", selecciona l\'opció "Tots dos idiomes (Dos documents separats)". L\'aplicació generarà dos fitxers Word (.docx) independents i idèntics en disseny i format.',
      category: 'export'
    },
    {
      id: 'faq-5',
      question_es: '¿Dónde se guarda el logotipo municipal y en qué formato debe estar?',
      question_ca: 'On es desa el logotip municipal i en quin format ha d\'estar?',
      answer_es: 'El logotipo se guarda de forma persistente en los datos del municipio y en la carpeta del usuario. Se recomienda en formato PNG (con fondo transparente) o JPG. Se inserta automáticamente en la portada oficial con dimensiones proporcionales garantizadas.',
      answer_ca: 'El logotip es desa de forma persistent a les dades del municipi i a la carpeta de l\'usuari. Es recomana en format PNG (amb fons transparent) o JPG. S\'insereix automàticament a la portada oficial amb dimensions proporcionals garantides.',
      category: 'municipality'
    },
    {
      id: 'faq-6',
      question_es: '¿Puedo cambiar de municipio una vez creado el proyecto o duplicar para otro pueblo?',
      question_ca: 'Puc canviar de municipi un cop creat el projecte o duplicar per a un altre poble?',
      answer_es: 'Sí. Puedes acceder a la sección "Mis programas" y usar la opción "Duplicar para otro municipio", que copia todas las decisiones de medidas y textos para otra localidad en un solo clic, o bien editar los datos básicos en la ficha municipal.',
      answer_ca: 'Sí. Pots accedir a la secció "Mis programes" i utilitzar l\'opció "Duplicar per a un altre municipi", que copia totes les decisions de mesures i textos per a una altra localitat en un sol clic, o bé editar les dades bàsiques a la fitxa municipal.',
      category: 'municipality'
    },
    {
      id: 'faq-7',
      question_es: '¿La aplicación necesita conexión a internet para funcionar?',
      question_ca: 'L\'aplicació necessita connexió a internet per funcionar?',
      answer_es: 'No. El Constructor de Programas Municipales funciona de forma 100% autónoma y sin conexión. Los 947 municipios de Cataluña, el censo oficial, el catálogo marco completo y los archivos Word se procesan íntegramente de manera local en tu ordenador.',
      answer_ca: 'No. El Constructor de Programes Municipals funciona de forma 100% autònoma i fora de línia. Els 947 municipis de Catalunya, el cens oficial, el catàleg marc complet i els fitxers Word es processen íntegrament de manera local al teu ordinador.',
      category: 'general'
    },
    {
      id: 'faq-8',
      question_es: '¿Qué tipografías y formatos utiliza el documento Word exportado?',
      question_ca: 'Quines tipografies i formats utilitza el document Word exportat?',
      answer_es: 'El documento utiliza la identidad visual oficial de Podem Catalunya: Bebas Neue en titulares de portada y grandes lemas, e Inter / Inter Display en textos y medidas. Las fuentes van incrustadas en el archivo para que se vea idéntico en cualquier ordenador con Word.',
      answer_ca: 'El document utilitza la identitat visual oficial de Podem Catalunya: Bebas Neue en titulars de portada i grans lemes, i Inter / Inter Display en textos i mesures. Les fonts van incrustades al fitxer perquè es vegi idèntic a qualsevol ordinador amb Word.',
      category: 'export'
    },
    {
      id: 'faq-ai-1',
      question_es: '¿Es obligatorio usar Inteligencia Artificial?',
      question_ca: 'És obligatori utilitzar Intel·ligència Artificial?',
      answer_es: 'No, en absoluto. La IA es 100% opcional y complementaria. El Constructor de Programas Municipales funciona perfectamente sin activar la IA, permitiendo seleccionar, redactar, adaptar y exportar programas completos con total normalidad.',
      answer_ca: 'No, en absolut. La IA és 100% opcional i complementària. El Constructor de Programes Municipals funciona perfectament sense activar la IA, permetent seleccionar, redactar, adaptar i exportar programes complets amb total normalitat.',
      category: 'ai'
    },
    {
      id: 'faq-ai-2',
      question_es: '¿Dónde se procesan los textos? ¿Se envía algo a internet?',
      question_ca: 'On es processen els textos? S\'envia alguna cosa a internet?',
      answer_es: 'Absolutamente nada sale de tu ordenador. Todo el procesamiento de IA es 100% local y privado. Ningún dato del municipio, texto ni propuesta se envía a servidores externos ni a la nube, garantizando confidencialidad total y funcionamiento sin conexión a internet.',
      answer_ca: 'Absolutament res no surt del teu ordinador. Tot el processament de IA és 100% local i privat. Cap dada del municipi, text ni proposta s\'envia a servidors externs ni al núvol, garantint confidencialitat total i funcionament sense connexió a internet.',
      category: 'ai'
    },
    {
      id: 'faq-ai-3',
      question_es: '¿Qué requisitos de hardware se recomiendan para ejecutar IA local?',
      question_ca: 'Quins requisits de maquinari es recomanen per executar IA local?',
      answer_es: 'Para el motor integrado ligero no se requiere nada especial (funciona en cualquier PC). Para modelos GGUF neuronales (como Gemma 2 2B o Qwen 2.5 7B), se recomienda un procesador de 4 o más núcleos y al menos 8 GB de RAM (o 16 GB para modelos de 7B/8B). Puedes consultar el diagnóstico automático en la sección "Inteligencia Artificial".',
      answer_ca: 'Per al motor integrat lleuger no cal res especial (funciona en qualsevol PC). Per a models GGUF neuronals (com Gemma 2 2B o Qwen 2.5 7B), es recomana un processador de 4 o més nuclis i almenys 8 GB de RAM (o 16 GB per a models de 7B/8B). Pots consultar el diagnòstic automàtic a la secció "Intel·ligència Artificial".',
      category: 'ai'
    },
    {
      id: 'faq-ai-4',
      question_es: '¿Qué significa el principio "La IA propone, el usuario decide"?',
      question_ca: 'Què significa el principi "La IA proposa, l\'usuari decideix"?',
      answer_es: 'Es la regla rectora del sistema: la IA jamás sobreescribe texto de forma automática ni toma decisiones políticas por ti. Ante cualquier generación o mejora, se muestra una ventana de comparación donde puedes Aceptar, Editar antes de aceptar, Regenerar o Descartar la propuesta.',
      answer_ca: 'És la regla rectora del sistema: la IA mai no sobreescriu text de manera automàtica ni pren decisions polítiques per tu. Davant de qualsevol generació o millora, es mostra una finestra de comparació on pots Acceptar, Editar abans d\'acceptar, Regenerar o Descartar la proposta.',
      category: 'ai'
    },
    {
      id: 'faq-ai-5',
      question_es: '¿Cómo funciona la sugerencia de títulos para medidas sin título?',
      question_ca: 'Com funciona el suggeriment de títols per a mesures sense títol?',
      answer_es: 'Cuando una medida del programa marco carece de título propio, aparece el botón destacado "✨ Sugerir título con IA". La IA analiza el cuerpo de la propuesta y genera tres alternativas breves (entre 4 y 12 palabras), ejecutivas y con verbos de acción para que elijas la que mejor encaje o la personalices.',
      answer_ca: 'Quan una mesura del programa marc no té títol propi, apareix el botó destacat "✨ Suggerir títol amb IA". La IA analitza el cos de la proposta i genera tres alternatives breus (entre 4 i 12 paraules), executives i amb verbs d\'acció perquè triïs la que millor s\'ajusti o la personalitzis.',
      category: 'ai'
    },
    {
      id: 'faq-ai-6',
      question_es: '¿Se modifica o se altera el catálogo marco oficial al usar IA?',
      question_ca: 'Es modifica o s\'altera el catàleg marc oficial en utilitzar IA?',
      answer_es: 'Jamás. El catálogo oficial de Podem Catalunya está blindado en la base de datos de sólo lectura. Cualquier título sugerido, texto adaptado o propuesta desarrollada por la IA se almacena exclusivamente en tu proyecto municipal, manteniendo siempre la posibilidad de restablecer el texto marco oficial.',
      answer_ca: 'Mai. El catàleg oficial de Podem Catalunya està blindat a la base de dades de només lectura. Qualsevol títol suggerit, text adaptat o proposta desenvolupada per la IA s\'emmagatzema exclusivament al teu projecte municipal, mantenint sempre la possibilitat de restablir el text marc oficial.',
      category: 'ai'
    },
    {
      id: 'faq-ai-7',
      question_es: '¿Cómo funciona el ciclo de vida de las traducciones (Revisada / Traducción propuesta / Desactualizada)?',
      question_ca: 'Com funciona el cicle de vida de les traduccions (Revisada / Traducció proposada / Desactualitzada)?',
      answer_es: 'Permite un control riguroso de la coherencia bilingüe: "Revisada" indica que un humano ha validado la traducción; "Traducción propuesta" señala que la IA ha generado el texto y está pendiente de validación; y "Desactualizada" se activa automáticamente si modificas el texto original en castellano después de haber traducido al catalán (o viceversa).',
      answer_ca: 'Permet un control rigorós de la coherència bilingüe: "Revisada" indica que un humà ha validat la traducció; "Traducció proposada" assenyala que la IA ha generat el text i està pendent de validació; i "Desactualitzada" s\'activa automàticament si modifiques el text original en castellà després d\'haver traduït al català (o viceversa).',
      category: 'ai'
    },
    {
      id: 'faq-ai-8',
      question_es: '¿Qué es el verificador anti-alucinaciones?',
      question_ca: 'Què és el verificador anti-al·lucinacions?',
      answer_es: 'Es un filtro de seguridad local que revisa las respuestas generadas por la IA para detectar cifras presupuestarias inventadas, referencias legales inexistentes, fechas concretas no fundamentadas o promesas fuera de competencias municipales, alertándote de forma visible para que no se filtren errores.',
      answer_ca: 'És un filtre de seguretat local que revisa les respostes generades per la IA per detectar xifres pressupostàries inventades, referències legals inexistents, dates concretes no fonamentades o promeses fora de competències municipals, alertant-te de forma visible perquè no es filtrin errors.',
      category: 'ai'
    },
    {
      id: 'faq-ai-9',
      question_es: '¿Por qué la Presentación y el Cierre se entregan inicialmente vacíos?',
      question_ca: 'Per què la Presentació i el Tancament es lliuren inicialment buits?',
      answer_es: 'La carta de presentación a la ciudadanía y el cierre del programa son compromisos políticos y personales que dependen del candidato o de la asamblea local de cada municipio. Por respeto a la autonomía local no vienen prefijados, aunque la IA puede redactar un primer borrador personalizado con un solo clic.',
      answer_ca: 'La carta de presentació a la ciutadania i el tancament del programa són compromisos polítics i personals que depenen del candidat o de l\'assemblea local de cada municipi. Per respecte a l\'autonomia local no vénen prefixats, tot i que la IA pot redactar un primer esborrany personalitzat amb un sol clic.',
      category: 'ai'
    },
    {
      id: 'faq-ai-10',
      question_es: '¿Cómo se genera el PDF final y por qué requiere Microsoft Word o LibreOffice?',
      question_ca: 'Com es genera el PDF final i per què requereix Microsoft Word o LibreOffice?',
      answer_es: 'Para garantizar un documento editorialmente perfecto, el sistema genera primero el archivo maestro oficial en Word (.docx) con todas sus fuentes, colores corporativos e imágenes maquetadas, y luego utiliza el conversor de Microsoft Word o LibreOffice de tu equipo para convertirlo a PDF de alta resolución sin desmaquetar nada.',
      answer_ca: 'Per garantir un document editorialment perfecte, el sistema genera primer el fitxer mestre oficial en Word (.docx) amb totes les seves fonts, colors corporatius i imatges maquetades, i després utilitza el conversor de Microsoft Word o LibreOffice del teu equip per convertir-lo a PDF d\'alta resolució sense desmaquetar res.',
      category: 'export'
    },
    {
      id: 'faq-ai-11',
      question_es: '¿Puedo borrar los modelos de IA descargados para liberar espacio en disco?',
      question_ca: 'Puc esborrar els models d\'IA descarregats per alliberar espai al disc?',
      answer_es: 'Sí. En el panel de "Inteligencia Artificial", cada modelo dispone de un botón de eliminación. Al pulsarlo, el archivo GGUF se borra por completo de tu disco duro y puedes volver a descargarlo en cualquier momento si lo deseas.',
      answer_ca: 'Sí. Al panell d\'"Intel·ligència Artificial", cada model disposa d\'un botó d\'eliminació. En prémer-lo, el fitxer GGUF s\'esborra completament del teu disc dur i pots tornar a descarregar-lo en qualsevol moment si ho desitges.',
      category: 'ai'
    },
    {
      id: 'faq-ai-12',
      question_es: '¿Qué modelo de IA debo elegir según mi ordenador?',
      question_ca: 'Quin model d\'IA he de triar segons el meu ordinador?',
      answer_es: 'Si tu equipo tiene 8 GB de RAM o recursos estándar, el motor integrado o modelos de 2B parámetros (como Gemma 2 2B) ofrecen respuestas inmediatas sin ralentizaciones. Si cuentas con 16 GB de RAM o más y procesador potente, modelos de 7B u 8B (como Qwen 2.5 7B o Llama 3.1 8B) aportarán mayor riqueza estilística y precisión sintáctica.',
      answer_ca: 'Si el teu equip té 8 GB de RAM o recursos estàndard, el motor integrat o models de 2B paràmetres (com Gemma 2 2B) ofereixen respostes immediates sense alentiments. Si disposes de 16 GB de RAM o més i processador potent, models de 7B o 8B (com Qwen 2.5 7B o Llama 3.1 8B) aportaran major riquesa estilística i precisió sintàctica.',
      category: 'ai'
    },
    {
      id: 'faq-sources-1',
      question_es: '¿Qué es un Programa Fuente y cómo se diferencia del programa marco?',
      question_ca: 'Què és un Programa Font i com es diferencia del programa marc?',
      answer_es: 'Un Programa Fuente es el documento político o catálogo base a partir del cual se generan los programas municipales. El Programa Marco oficial es la fuente de referencia de partida, pero ahora puedes gestionar múltiples programas fuente (autonómicos, sectoriales o de mandatos anteriores) e incluso importar los tuyos propios.',
      answer_ca: 'Un Programa Font és el document polític o catàleg base a partir del qual es generen els programes municipals. El Programa Marc oficial és la font de referència de partida, però ara pots gestionar múltiples programes font (autonòmics, sectorials o de mandats anteriors) i fins i tot importar els teus propis.',
      category: 'sources'
    },
    {
      id: 'faq-sources-2',
      question_es: '¿Puedo importar mi propio documento como programa fuente?',
      question_ca: 'Puc importar el meu propi document com a programa font?',
      answer_es: 'Sí. Desde la sección "Programas fuente" puedes importar documentos propios en formatos Word (.docx) o PDF. El sistema analizará la estructura y extraerá las áreas temáticas y propuestas para utilizarlas como base en tus nuevos proyectos municipales.',
      answer_ca: 'Sí. Des de la secció "Programes font" pots importar documents propis en formats Word (.docx) o PDF. El sistema analitzarà l\'estructura i n\'extraurà les àrees temàtiques i propostes per utilitzar-les com a base en els teus nous projectes municipals.',
      category: 'sources'
    },
    {
      id: 'faq-sources-3',
      question_es: '¿Qué ocurre si no tengo ningún programa marco instalado o deseo instalar otros?',
      question_ca: 'Què passa si no tinc cap programa marc instal·lat o vull instal·lar-ne d\'altres?',
      answer_es: 'La aplicación incluye de serie el marco oficial protegido. Si necesitas nuevos programas marco o contenidos actualizados, puedes obtenerlos desde el canal de contenidos o instalarlos directamente desde la gestión de Programas Fuente.',
      answer_ca: 'L\'aplicació inclou de sèrie el marc oficial protegit. Si necessites nous programes marc o continguts actualitzats, pots obtenir-los des del canal de continguts o instal·lar-los directament des de la gestió de Programes Font.',
      category: 'sources'
    },
    {
      id: 'faq-sources-4',
      question_es: '¿Los programas marco están disponibles en varios idiomas oficiales?',
      question_ca: 'Els programes marc estan disponibles en diversos idiomes oficials?',
      answer_es: 'Sí. Los programas marco oficiales se proporcionan de forma bilingüe (castellano y catalán) con textos originales aprobados para cada lengua, sin depender de traducción automática no supervisada.',
      answer_ca: 'Sí. Els programes marc oficials es proporcionen de forma bilingüe (castellà i català) amb textos originals aprovats per a cada llengua, sense dependre de traducció automàtica no supervisada.',
      category: 'sources'
    },
    {
      id: 'faq-updates-1',
      question_es: '¿Cómo sé si hay una nueva versión de la aplicación o de los contenidos?',
      question_ca: 'Com sé si hi ha una nova versió de l\'aplicació o dels continguts?',
      answer_es: 'Tanto en la pantalla de Inicio como en Configuración verás el estado de actualizaciones. Si estás conectado a internet, la app comprueba periódicamente si existen nuevas versiones del instalador o nuevos paquetes de contenidos aprobados.',
      answer_ca: 'Tant a la pantalla d\'Inici com a Configuració veuràs l\'estat de les actualitzacions. Si estàs connectat a internet, l\'app comprova periòdicament si existeixen noves versions de l\'instal·lador o nous paquets de continguts aprovats.',
      category: 'updates'
    },
    {
      id: 'faq-updates-2',
      question_es: '¿Cuál es la diferencia entre actualizar la aplicación y actualizar los contenidos?',
      question_ca: 'Quina és la diferència entre actualitzar l\'aplicació i actualitzar els continguts?',
      answer_es: 'Actualizar la aplicación renueva el software ejecutable (mejoras de interfaz, nuevas herramientas o correcciones técnicas). Actualizar los contenidos descarga o renueva catálogos políticos de referencia sin modificar el código del programa.',
      answer_ca: 'Actualitzar l\'aplicació renova el programari executable (millores d\'interfície, noves eines o correccions tècniques). Actualitzar els continguts descarrega o renova catàlegs polítics de referència sense modificar el codi del programa.',
      category: 'updates'
    },
    {
      id: 'faq-updates-3',
      question_es: '¿Se pierden mis proyectos municipales al actualizar la aplicación o los contenidos?',
      question_ca: 'Es perden els meus projectes municipals en actualitzar l\'aplicació o els continguts?',
      answer_es: 'No. Tus programas municipales y borradores se guardan en la carpeta de datos de usuario de tu ordenador y quedan totalmente intactos y protegidos tras cualquier actualización de software o catálogo.',
      answer_ca: 'No. Els teus programes municipals i esborranys es guarden a la carpeta de dades d\'usuari del teu ordinador i queden totalment intactes i protegits després de qualsevol actualització de programari o catàleg.',
      category: 'updates'
    },
    {
      id: 'faq-updates-4',
      question_es: '¿Cambia automáticamente la fuente de mis proyectos en curso al actualizar un catálogo?',
      question_ca: 'Canvia automàticament la font dels meus projectes en curs en actualitzar un catàleg?',
      answer_es: 'No. Cada proyecto municipal conserva la fuente y las decisiones con las que fue creado para no alterar trabajos en marcha. Eres tú quien decide si deseas iniciar un nuevo proyecto con la nueva fuente o continuar con la existente.',
      answer_ca: 'No. Cada projecte municipal conserva la font i les decisions amb què va ser creat per no alterar treballs en marxa. Ets tu qui decideix si vols iniciar un nou projecte amb la nova font o continuar amb l\'existent.',
      category: 'updates'
    },
    {
      id: 'faq-updates-5',
      question_es: '¿Puedo seguir trabajando completamente sin conexión a internet si no deseo actualizar?',
      question_ca: 'Puc continuar treballant completament sense connexió a internet si no vull actualitzar?',
      answer_es: 'Por supuesto. La aplicación está diseñada bajo el principio "offline-first". La comprobación de actualizaciones es opcional y puedes trabajar, editar, redactar con IA local y exportar documentos sin necesidad de conexión alguna.',
      answer_ca: 'I tant. L\'aplicació està dissenyada sota el principi "offline-first". La comprovació d\'actualitzacions és opcional i pots treballar, editar, redactar amb IA local i exportar documents sense cap necessitat de connexió.',
      category: 'updates'
    },
    {
      id: 'faq-import-1',
      question_es: '¿Qué formatos de archivo puedo importar y cómo funciona el reconocimiento de texto (OCR)?',
      question_ca: 'Quins formats de fitxer puc importar i com funciona el reconeixement de text (OCR)?',
      answer_es: 'Puedes importar documentos en formato Microsoft Word (.docx) y archivos PDF. Si un PDF contiene texto digital se extrae de inmediato; si se trata de un documento escaneado, el módulo de OCR local procesa las imágenes para recuperar las propuestas.',
      answer_ca: 'Pots importar documents en format Microsoft Word (.docx) i fitxers PDF. Si un PDF conté text digital s\'extreu immediatament; si es tracta d\'un document escanejat, el mòdul d\'OCR local processa les imatges per recuperar les propostes.',
      category: 'import'
    },
    {
      id: 'faq-export-1',
      question_es: '¿Qué contenidos se incluyen exactamente al exportar el programa electoral?',
      question_ca: 'Quins continguts s\'inclouen exactament en exportar el programa electoral?',
      answer_es: 'El documento final exportado incluye la portada oficial con lema y logotipo local, el índice general, la presentación política de la candidatura, las 12 áreas temáticas con sus introducciones y propuestas aprobadas (incluidas y adaptadas), el texto de cierre y la contraportada. Las medidas marcadas "En duda" o "Descartadas" nunca se incluyen en la exportación.',
      answer_ca: 'El document final exportat inclou la portada oficial amb lema i logotip local, l\'índex general, la presentació política de la candidatura, les 12 àrees temàtiques amb les seves introduccions i propostes aprovades (incloses i adaptades), el text de cloenda i la contraportada. Les mesures marcades "En dubte" o "Descartades" mai no s\'inclouen a l\'exportació.',
      category: 'export'
    },
    {
      id: 'faq-privacy-1',
      question_es: '¿Dónde se almacenan mis datos y qué información recopila la aplicación?',
      question_ca: 'On s\'emmagatzemen les meves dades i quina informació recopila l\'aplicació?',
      answer_es: 'Todos tus proyectos, textos, logotipos y configuraciones se almacenan exclusivamente en el disco duro local de tu equipo. La aplicación NO recopila telemetría, NO tiene cookies, NO envía estadísticas de uso ni transmite ningún dato a servidores externos.',
      answer_ca: 'Tots els teus projectes, textos, logotips i configuracions s\'emmagatzemen exclusivament al disc dur local del teu equip. L\'aplicació NO recopila telemetria, NO té galetes, NO envia estadístiques d\'ús ni transmet cap dada a servidors externs.',
      category: 'privacy'
    },
    {
      id: 'faq-privacy-2',
      question_es: '¿Dónde puedo consultar la Política de Privacidad oficial completa?',
      question_ca: 'On puc consultar la Política de Privadesa oficial completa?',
      answer_es: 'Puedes consultarla en cualquier momento, incluso sin conexión a internet, accediendo a "Configuración" > "Acerca de la aplicación" y pulsando el botón "Política de privacidad". También está disponible en el archivo PRIVACY.md de la documentación del software.',
      answer_ca: 'Pots consultar-la en qualsevol moment, fins i tot sense connexió a internet, accedint a "Configuració" > "Quant a l\'aplicació" i prement el botó "Política de privadesa". També està disponible al fitxer PRIVACY.md de la documentació del programari.',
      category: 'privacy'
    },
    {
      id: 'faq-license-1',
      question_es: '¿Bajo qué licencia se distribuye el programa y dónde está su código fuente?',
      question_ca: 'Sota quina llicència es distribueix el programa i on es troba el seu codi font?',
      answer_es: 'Constructor de Programas Municipales es software libre distribuido bajo la licencia GNU General Public License v3.0 o posterior (GPL-3.0-or-later). Su código fuente completo, auditable y descargable está publicado en GitHub: https://github.com/elftemir/constructor-programas-municipales.',
      answer_ca: 'Constructor de Programes Municipals és programari lliure distribuït sota la llicència GNU General Public License v3.0 o posterior (GPL-3.0-or-later). El seu codi font complet, auditable i descarregable està publicat a GitHub: https://github.com/elftemir/constructor-programas-municipales.',
      category: 'general'
    }
  ],

  async render(container, params = {}) {
    const isCa = window.i18n && window.i18n.getLang() === 'ca';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <h1 class="title">${window.i18n.t('help.title')}</h1>
          <p class="subtitle">${window.i18n.t('help.subtitle')}</p>
        </div>
        <div class="view-header-right" style="display: flex; gap: 10px;">
          <button class="btn" id="btn-relaunch-welcome">
            ℹ️ ${isCa ? 'Benvinguda' : 'Bienvenida'}
          </button>
          <button class="btn primary" id="btn-run-interactive-tour">
            🎯 ${window.i18n.t('help.btn_start_tour')}
          </button>
        </div>
      </div>

      <!-- SECCIÓN 1: CUATRO TARJETAS DE ACCIÓN RÁPIDA -->
      <div style="margin-bottom: 28px;">
        <h2 class="section-title" style="font-size: 18px; margin-bottom: 14px; color: var(--text-primary);">
          ${isCa ? 'Accions ràpides i solucions immediates' : 'Acciones rápidas y soluciones inmediatas'}
        </h2>
        
        <div class="grid-2" style="gap: 16px;">
          <!-- Tarjeta 1: No encuentro una medida -->
          <div class="card" style="padding: 20px; border-left: 4px solid #8B5CF6; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 20px;">🔍</span>
                <h3 style="font-size: 15.5px; font-weight: 700; margin: 0; color: #6D28D9;">
                  ${isCa ? 'NO TROBO UNA MESURA' : 'NO ENCUENTRO UNA MEDIDA'}
                </h3>
              </div>
              <p style="font-size: 13.5px; color: #4B5563; line-height: 1.5; margin: 0 0 14px;">
                ${isCa
                  ? 'Utilitza el cercador per text a la barra de l\'àrea o canvia els filtres d\'estat (Incloses / En dubte / Totes). També pots afegir noves mesures pròpies.'
                  : 'Utiliza el buscador por texto en la barra del área o cambia los filtros de estado (Incluidas / En duda / Todas). También puedes añadir nuevas medidas propias.'}
              </p>
            </div>
            <div>
              <button class="btn small primary" id="btn-quick-jump-choose" style="background: #7C3AED; border-color: #7C3AED;">
                ${isCa ? '→ Anar a Àrees i mesures' : '→ Ir a Áreas y medidas'}
              </button>
            </div>
          </div>

          <!-- Tarjeta 2: No sé cómo adaptar una medida -->
          <div class="card" style="padding: 20px; border-left: 4px solid #3B82F6; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 20px;">✎</span>
                <h3 style="font-size: 15.5px; font-weight: 700; margin: 0; color: #1D4ED8;">
                  ${isCa ? 'NO SÉ COM ADAPTAR UNA MESURA' : 'NO SÉ CÓMO ADAPTAR UNA MEDIDA'}
                </h3>
              </div>
              <p style="font-size: 13.5px; color: #4B5563; line-height: 1.5; margin: 0 0 14px;">
                ${isCa
                  ? 'A la targeta vertical de la mesura, prem el botó "Adaptar". Podràs editar la redacció municipal mantenint el text marc com a referència inalterable.'
                  : 'En la tarjeta vertical de la medida, pulsa el botón "Adaptar". Podrás editar la redacción municipal manteniendo el texto marco como referencia inalterable.'}
              </p>
            </div>
            <div>
              <button class="btn small primary" id="btn-quick-jump-adapt" style="background: #2563EB; border-color: #2563EB;">
                ${isCa ? '→ Anar a Àrees i mesures' : '→ Ir a Áreas y medidas'}
              </button>
            </div>
          </div>

          <!-- Tarjeta 3: Configurar y usar la IA Local -->
          <div class="card" style="padding: 20px; border-left: 4px solid #10B981; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 20px;">✨</span>
                <h3 style="font-size: 15.5px; font-weight: 700; margin: 0; color: #047857;">
                  ${isCa ? 'INTEL·LIGÈNCIA ARTIFICIAL LOCAL' : 'INTELIGENCIA ARTIFICIAL LOCAL'}
                </h3>
              </div>
              <p style="font-size: 13.5px; color: #4B5563; line-height: 1.5; margin: 0 0 14px;">
                ${isCa
                  ? 'Configura els models locals, comprova el maquinari o fes servir l\'assistent per suggerir títols, millorar redacció o traduir de forma 100% privada.'
                  : 'Configura los modelos locales, comprueba tu hardware o usa el asistente para sugerir títulos, mejorar redacción o traducir de forma 100% privada.'}
              </p>
            </div>
            <div>
              <button class="btn small primary" id="btn-quick-jump-ai" style="background: #059669; border-color: #059669;">
                ${isCa ? '→ Anar a Intel·ligència Artificial' : '→ Ir a Inteligencia Artificial'}
              </button>
            </div>
          </div>

          <!-- Tarjeta 4: Revisar y Exportar Word + PDF -->
          <div class="card" style="padding: 20px; border-left: 4px solid #F59E0B; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 20px;">📄</span>
                <h3 style="font-size: 15.5px; font-weight: 700; margin: 0; color: #B45309;">
                  ${isCa ? 'EXPORTACIÓ WORD I PDF' : 'EXPORTACIÓN WORD Y PDF'}
                </h3>
              </div>
              <p style="font-size: 13.5px; color: #4B5563; line-height: 1.5; margin: 0 0 14px;">
                ${isCa
                  ? 'Genera el document oficial en Word (.docx) i PDF final d\'alta resolució mitjançant el conversor natiu sense desmaquetar res.'
                  : 'Genera el documento oficial en Word (.docx) y PDF final de alta resolución mediante el conversor nativo sin desmaquetar nada.'}
              </p>
            </div>
            <div>
              <button class="btn small primary" id="btn-quick-jump-export" style="background: #D97706; border-color: #D97706;">
                ${isCa ? '→ Anar a Generar documents' : '→ Ir a Generar documentos'}
              </button>
            </div>
          </div>

          <!-- Tarjeta 5: Actualizaciones de Software y Contenidos -->
          <div class="card" style="padding: 20px; border-left: 4px solid #0284C7; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 20px;">🔄</span>
                <h3 style="font-size: 15.5px; font-weight: 700; margin: 0; color: #0369A1;">
                  ${isCa ? 'ACTUALITZACIONS' : 'ACTUALIZACIONES'}
                </h3>
              </div>
              <p style="font-size: 13.5px; color: #4B5563; line-height: 1.5; margin: 0 0 14px;">
                ${isCa
                  ? 'Distingeix entre actualitzacions del programari i sincronització de continguts polítics. Comprova noves versions sense perdre cap projecte ni alterar treballs en marxa.'
                  : 'Distingue entre actualizaciones de la aplicación y sincronización de contenidos políticos. Comprueba nuevas versiones sin perder ningún proyecto ni alterar trabajos en marcha.'}
              </p>
            </div>
            <div>
              <button class="btn small primary" id="btn-quick-jump-updates" style="background: #0284C7; border-color: #0284C7;">
                ${isCa ? '→ Configurar actualitzacions' : '→ Configurar actualizaciones'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 2: LANZADORES DE TUTORIALES POR PANTALLA -->
      <div class="card" style="padding: 22px; margin-bottom: 28px;">
        <h2 class="section-title" style="font-size: 17.5px; margin-bottom: 6px;">
          ${isCa ? 'Tutorials guiats per secció' : 'Tutoriales guiados por sección'}
        </h2>
        <p class="muted" style="font-size: 13px; margin: 0 0 16px;">
          ${isCa
            ? 'Inicia una guia interactiva pas a pas sobre qualsevol apartat de l\'aplicació:'
            : 'Inicia una guía interactiva paso a paso sobre cualquier apartado de la aplicación:'}
        </p>

        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <button class="btn small" data-tour-section="home">
            🏠 ${isCa ? 'Inici' : 'Inicio'}
          </button>
          <button class="btn small" data-tour-section="programs">
            📁 ${isCa ? 'Els meus programes' : 'Mis programas'}
          </button>
          <button class="btn small" data-tour-section="source_programs">
            📚 ${isCa ? 'Programes font' : 'Programas fuente'}
          </button>
          <button class="btn small" data-tour-section="choose_measures">
            📋 ${isCa ? 'Àrees i mesures' : 'Áreas y medidas'}
          </button>
          <button class="btn small" data-tour-section="general_texts">
            📝 ${isCa ? 'Textos del programa' : 'Textos del programa'}
          </button>
          <button class="btn small" data-tour-section="preview">
            👁 ${isCa ? 'Vista prèvia' : 'Vista previa'}
          </button>
          <button class="btn small" data-tour-section="review_export">
            📄 ${isCa ? 'Generar documents' : 'Generar documentos'}
          </button>
          <button class="btn small" data-tour-section="ai">
            ✨ ${isCa ? 'Intel·ligència Artificial' : 'Inteligencia Artificial'}
          </button>
          <button class="btn small" data-tour-section="options">
            ⚙ ${isCa ? 'Configuració i actualitzacions' : 'Configuración y actualizaciones'}
          </button>
        </div>
      </div>

      <!-- SECCIÓN 3: PREGUNTAS FRECUENTES (FAQ) CON BUSCADOR -->
      <div class="card" style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 class="section-title" style="font-size: 18px; margin: 0 0 4px;">
              ${isCa ? 'Preguntes més freqüents (FAQ)' : 'Preguntas más frecuentes (FAQ)'}
            </h2>
            <div class="muted" style="font-size: 13px;">
              ${isCa ? 'Dubtes habituals sobre la confecció del programa i la IA local' : 'Dudas habituales sobre la confección del programa y la IA local'}
            </div>
          </div>
          <div style="width: 300px; max-width: 100%;">
            <input type="text" id="faq-search-input" class="input" placeholder="${isCa ? 'Cercar a les preguntes…' : 'Buscar en las preguntas…'}" style="font-size: 13px;">
          </div>
        </div>

        <div id="faq-list-container" style="display: flex; flex-direction: column; gap: 12px;">
          ${this.renderFaqList(this.faqItems, isCa)}
        </div>
      </div>
    `;

    // Event listeners para saltos rápidos
    container.querySelector('#btn-quick-jump-choose')?.addEventListener('click', () => {
      if (App.currentProject) App.navigateTo('areas-medidas');
      else alert(isCa ? 'Primer obre o crea un programa municipal.' : 'Primero abre o crea un programa municipal.');
    });

    container.querySelector('#btn-quick-jump-adapt')?.addEventListener('click', () => {
      if (App.currentProject) App.navigateTo('areas-medidas');
      else alert(isCa ? 'Primer obre o crea un programa municipal.' : 'Primero abre o crea un programa municipal.');
    });

    container.querySelector('#btn-quick-jump-ai')?.addEventListener('click', () => {
      App.navigateTo('ai');
    });

    container.querySelector('#btn-quick-jump-export')?.addEventListener('click', () => {
      if (App.currentProject) App.navigateTo('revisar-exportar');
      else alert(isCa ? 'Primer obre o crea un programa municipal.' : 'Primero abre o crea un programa municipal.');
    });

    container.querySelector('#btn-quick-jump-updates')?.addEventListener('click', () => {
      App.navigateTo('opciones', { focusSection: 'updates' });
    });

    // Tour general
    container.querySelector('#btn-run-interactive-tour')?.addEventListener('click', () => {
      if (window.Tutorial) window.Tutorial.startTour();
    });

    // Modal de bienvenida
    container.querySelector('#btn-relaunch-welcome')?.addEventListener('click', () => {
      if (window.Tutorial) window.Tutorial.showWelcomeModal();
    });

    // Botones de tutoriales específicos
    container.querySelectorAll('button[data-tour-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.tourSection;
        if (window.Tutorial) {
          window.Tutorial.startSectionTour(sec);
        }
      });
    });

    // Buscador interactivo de preguntas frecuentes
    const searchInput = container.querySelector('#faq-search-input');
    const faqContainer = container.querySelector('#faq-list-container');
    if (searchInput && faqContainer) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = this.faqItems.filter(item => {
          const q = (isCa ? item.question_ca : item.question_es).toLowerCase();
          const a = (isCa ? item.answer_ca : item.answer_es).toLowerCase();
          return q.includes(query) || a.includes(query);
        });
        faqContainer.innerHTML = this.renderFaqList(filtered, isCa);
        this.bindFaqToggles(faqContainer);
      });
    }

    this.bindFaqToggles(container);

    if (params.faqQuery || params.query) {
      const q = (params.faqQuery || params.query).trim();
      if (searchInput) {
        searchInput.value = q;
        searchInput.dispatchEvent(new Event('input'));
      }
    }
  },

  renderFaqList(items, isCa) {
    if (!items || items.length === 0) {
      return `
        <div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13.5px;">
          ${isCa ? 'No s\'ha trobat cap resposta que coincideixi amb la cerca.' : 'No se ha encontrado ninguna respuesta que coincida con la búsqueda.'}
        </div>
      `;
    }

    return items.map(item => `
      <div class="faq-item" style="border: 1px solid var(--border-subtle); border-radius: var(--radius-default); background: var(--surface-panel); overflow: hidden;">
        <button class="faq-question-btn" style="width: 100%; text-align: left; background: none; border: none; padding: 14px 18px; font-size: 14px; font-weight: 600; color: var(--text-primary); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
          <span>${escapeHtml(isCa ? item.question_ca : item.question_es)}</span>
          <span class="faq-icon" style="font-size: 16px; color: var(--action-primary); transition: transform 0.2s;">▾</span>
        </button>
        <div class="faq-answer" style="display: none; padding: 0 18px 14px 18px; font-size: 13.5px; color: #4B5563; line-height: 1.6; border-top: 1px dashed var(--border-subtle); margin-top: 4px; padding-top: 10px;">
          ${escapeHtml(isCa ? item.answer_ca : item.answer_es)}
        </div>
      </div>
    `).join('');
  },

  bindFaqToggles(container) {
    container.querySelectorAll('.faq-question-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const answer = item.querySelector('.faq-answer');
        const icon = btn.querySelector('.faq-icon');
        const isOpen = answer.style.display === 'block';

        if (isOpen) {
          answer.style.display = 'none';
          if (icon) icon.textContent = '▾';
        } else {
          answer.style.display = 'block';
          if (icon) icon.textContent = '▴';
        }
      });
    });
  }
};

window.HelpView = HelpView;
