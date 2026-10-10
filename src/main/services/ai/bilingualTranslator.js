/**
 * bilingualTranslator.js - Motor Lingüístico Bilingüe de Alta Precisión (ES <-> CA)
 * Especializado en lenguaje político, municipal, social y administrativo.
 *
 * Principio:
 * - 100% Determinista, offline, local (0 llamadas externas, 0 alucinaciones).
 * - Traduce campo a campo respetando estrictamente las estructuras canónicas JSON.
 * - Vocabulario exhaustivo y reglas morfosintácticas y de apostrofación normativas (IEC / Pompeu Fabra).
 */

// 1. Frases y expresiones idiomáticas compuestas (de mayor a menor longitud)
const PHRASES_ES_TO_CA = [
  // Expresiones políticas y programáticas
  ["en el corazón de", "al cor de"],
  ["en el término municipal de", "al terme municipal de"],
  ["en el ámbito municipal de", "en l'àmbit municipal de"],
  ["por qué importa", "per què és important"],
  ["qué queremos cambiar", "què volem canviar"],
  ["qué compromiso asumimos", "quin compromís assumim"],
  ["rendición de cuentas", "retiment de comptes"],
  ["rendir cuentas", "retre comptes"],
  ["contrato democrático", "contracte democràtic"],
  ["servicios públicos esenciales", "serveis públics essencials"],
  ["servicios públicos", "serveis públics"],
  ["servicio público", "servei públic"],
  ["gestión pública directa", "gestió pública directa"],
  ["gestión pública", "gestió pública"],
  ["derecho a una vivienda digna", "dret a un habitatge digne"],
  ["derecho a una vivienda", "dret a un habitatge"],
  ["derecho a la vivienda", "dret a l'habitatge"],
  ["vivienda como derecho", "habitatge com a dret"],
  ["viviendas comunitarias", "habitatges comunitaris"],
  ["vivienda comunitaria", "habitatge comunitari"],
  ["viviendas para mayores", "habitatges per a gent gran"],
  ["vivienda para mayores", "habitatge per a gent gran"],
  ["vivienda digna", "habitatge digne"],
  ["viviendas adecuadas", "habitatges adequats"],
  ["un hogar digno", "una llar digna"],
  ["un hogar adecuado", "una llar adequada"],
  ["un hogar", "una llar"],
  ["hogares dignos", "llars dignes"],
  ["derechos sociales", "drets socials"],
  ["derecho social", "dret social"],
  ["derechos garantizados", "drets garantits"],
  ["derecho garantizado", "dret garantit"],
  ["mayoría social", "majoria social"],
  ["gente corriente", "gent corrent"],
  ["vecinos y vecinas", "veïns i veïnes"],
  ["vecinas y vecinos", "veïnes i veïns"],
  ["vecino y vecina", "veí i veïna"],
  ["vecina y vecino", "veïna i veí"],
  ["en el día a día", "en el dia a dia"],
  ["día a día", "dia a dia"],
  ["vida cotidiana", "vida quotidiana"],
  ["vida diaria", "vida diària"],
  ["calidad de vida", "qualitat de vida"],
  ["mantenimiento inmediato", "manteniment immediat"],
  ["accesibilidad urbana", "accessibilitat urbana"],
  ["eliminación de postes", "eliminació de pals"],
  ["línea de telefonía y electricidad", "línia de telefonia i electricitat"],
  ["igualdad real", "igualtat real"],
  ["justicia social", "justícia social"],
  ["justicia económica", "justícia econòmica"],
  ["dignidad laboral", "dignitat laboral"],
  ["todas las voces se escuchen", "totes les veus s'escoltin"],
  ["todas las voces", "totes les veus"],
  ["se cuiden entre sí", "es cuidin entre si"],
  ["hechos y no en promesas vacías", "fets i no en promeses buides"],
  ["hechos y no promesas", "fets i no promeses"],
  ["promesas vacías", "promeses buides"],
  ["soluciones concretas", "solucions concretes"],
  ["solución concreta", "solució concreta"],
  ["voto de confianza", "vot de confiança"],
  ["resultados reales", "resultats reals"],
  ["resultado real", "resultat real"],
  ["compromiso público", "compromís públic"],
  ["responsabilidad pública", "responsabilitat pública"],
  ["modelo de ciudad", "model de ciutat"],
  ["modelo de municipio", "model de municipi"],
  ["cada calle y cada barrio", "cada carrer i cada barri"],
  ["barrio a barrio", "barri a barri"],
  ["carrer a carrer", "calle a calle"],
  ["calle a calle", "carrer a carrer"],
  ["nuestras aspiraciones colectivas", "les nostres aspiracions col·lectives"],
  ["no es un concepto abstracto", "no és un concepte abstracte"],
  ["sino una realidad", "sinó una realitat"],
  ["más inclusiva y accesible", "més inclusiva i accessible"],
  ["más inclusivo y accesible", "més inclusiu i accessible"],
  ["ciudad amable y barrios cuidados", "ciutat amable i barris cuidats"],
  ["ciudad amable", "ciutat amable"],
  ["barrios cuidados", "barris cuidats"],
  ["la educación y la cultura", "l'educació i la cultura"],
  ["educación y cultura", "educació i cultura"],
  ["los niños y jóvenes", "els infants i joves"],
  ["niños y jóvenes", "infants i joves"],
  ["son el futuro de nuestra ciudad", "són el futur de la nostra ciutat"],
  ["espacios públicos", "espais públics"],
  ["espacio público", "espai públic"],
  ["entidades culturales y sociales", "entitats culturals i socials"],
  ["entidades culturales", "entitats culturals"],
  ["entidades sociales", "entitats socials"],
  ["puedan prosperar", "puguin prosperar"],
  ["para construir un mañana inclusivo y equitativo", "per construir un demà inclusiu i equitatiu"],
  ["para construir un mañana inclusiva y equitativa", "per construir un demà inclusiu i equitatiu"],
  ["un mañana inclusivo", "un demà inclusiu"],
  ["familias mayores", "famílies grans"],
  ["personas mayores", "gent gran"],
  ["gente mayor", "gent gran"],
  ["en precarias condiciones", "en condicions precàries"],
  ["falta de viviendas", "falta d'habitatges"],
  ["gobernar con responsabilidad pública", "governar amb responsabilitat pública"],
  ["quienes más lo necesitan", "qui més ho necessita"],
  ["enfrentan desafíos diarios", "afronten reptes diaris"],
  ["desafíos diarios", "reptes diaris"],
  ["ayuda integral y eficiente", "ajuda integral i eficient"],
  ["dotando a las vecinas y vecinos", "dotant les veïnes i veïns"],
  ["con los recursos necesarios", "amb els recursos necessaris"],
  ["atención integral a las familias vulnerables", "atenció integral a les famílies vulnerables"],
  ["familias vulnerables", "famílies vulnerables"],
  ["prioridad pública", "prioritat pública"],
  ["oficina de trámites de servicios sociales", "oficina de tràmits de serveis socials"],
  ["agilizar ayudas y prestaciones", "agilitzar ajuts i prestacions"],
  ["ayudas y prestaciones", "ajuts i prestacions"],
  ["situaciones de riesgo en la infancia", "situacions de risc en la infància"],
  ["municipio solidario y eficaz", "municipi solidari i eficaç"],
  ["políticas de salud", "polítiques de salut"],
  ["políticas de igualdad", "polítiques d'igualtat"],
  ["políticas públicas", "polítiques públiques"],
  ["política pública", "política pública"],
  ["donde la igualdad forme parte de todas las políticas municipales", "on la igualtat formi part de totes les polítiques municipals"],
  ["ninguna persona vea limitada su vida por razón de género", "cap persona vegi limitada la seva vida per raó de gènere"],
  ["orientación sexual o identidad", "orientació sexual o identitat"],
  ["reforzar los recursos de igualdad", "reforçar els recursos d'igualtat"],
  ["apoyar los cuidados y la conciliación", "donar suport a les cures i a la conciliació"],
  ["prevenir las violencias machistas", "prevenir les violències masclistes"],
  ["violencia machista", "violència masclista"],
  ["violencias machistas", "violències masclistes"],
  ["participación de las mujeres", "participació de les dones"],
  ["se construye también desde cada política municipal", "es construeix també des de cada política municipal"],
  ["democracia, transparencia y participación", "democràcia, transparència i participació"],
  ["medi ambiente", "medi ambient"],
  ["entre sí", "entre si"],
  ["puede moverse", "pot moure's"],
  ["pueden moverse", "poden moure's"],
  ["por eso", "per això"],
  ["de todos", "de tothom"],
  ["a todos", "a tothom"],
  ["para todos", "per a tothom"],
  ["comprometido a", "compromès a"],
  ["comprometida a", "compromesa a"],
  ["en hechos y no en promesas vacías", "en fets i no en promeses buides"],
  ["en hechos y no en promesas", "en fets i no en promesas"],
  ["con los barrios como prioridad", "amb els barris com a prioritat"],
  ["nuestra firmeza no es agresiva", "la nostra fermesa no és agressiva"],
  ["nuestra firmeza", "la nostra fermesa"],
  ["un modelo de municipio", "un model de municipi"],
  ["un voto de confianza", "un vot de confiança"],
  ["acciones concretas", "accions concretes"],
  ["acción concreta", "acció concreta"],
  ["una realidad, no una promesa", "una realitat, no una promesa"],
  ["comprometemos nuestro futuro", "comprometem el nostre futur"],
  ["al servicio de los barrios", "al servei dels barris"],
  ["al servicio de las vecinas y vecinos", "al servei de les veïnes i veïns"],
  ["al servicio de la ciudadanía", "al servei de la ciutadania"],
  ["nuestro compromiso", "el nostre compromís"],
  ["nuestro programa", "el nostre programa"],
  ["hechos, palabra y futuro", "fets, paraula i futur"],
  ["fets, paraula i futur", "fets, paraula i futur"],
  ["frente a la resignación", "davant la resignació"],
  ["soluciones viables", "solucions viables"],
  ["forma cercana y honesta", "forma propera i honesta"],
  ["de gobernar con y para la ciudadanía", "de governar amb i per a la ciutadania"],
  ["gobernar con y para la ciudadanía", "governar amb i per a la ciutadania"],
  ["a lo largo de estas páginas", "al llarg d'aquestes pàgines"],
  ["no proponemos promesas vacías", "no proposem promeses buides"],
  ["sin distinciones ni exclusiones", "sense distincions ni exclusions"],
  ["lleno de oportunidades para todos", "ple d'oportunitats per a tothom"],
  ["lleno de oportunidades", "ple d'oportunitats"],
  ["en este bloque", "en aquest bloc"],
  ["establecemos prioridades claras", "establim prioritats clares"],
  ["frente a los problemas reales", "davant dels problemes reals"],
  ["que afectan al vecindario", "que afecten el veïnat"],
  ["explicamos con transparencia", "expliquem amb transparència"],
  ["qué soluciones municipales proponemos", "quines solucions municipals proposem"],
  ["suficiencia de recursos en los barrios", "suficiència de recursos als barris"],
  ["suficiencia de recursos", "suficiència de recursos"],
  ["que se puedan evaluar", "que es puguin avaluar"],
  ["para todos y todas", "per a tothom"],
  ["para todas y todos", "per a tothom"],
  ["para todos", "per a tothom"],
  ["para todas", "per a tothom"],
  ["a todos y todas", "a tothom"],
  ["a todas y todos", "a tothom"]
];

// Construir inverso CA -> ES para expresiones idiomáticas
const PHRASES_CA_TO_ES = PHRASES_ES_TO_CA.map(([es, ca]) => [ca, es]);

// 2. Diccionario de palabras clave (ES -> CA) con preservación semántica
const WORDS_ES_TO_CA = {
  // Artículos y contracciones
  "el": "el",
  "la": "la",
  "los": "els",
  "las": "les",
  "un": "un",
  "una": "una",
  "unos": "uns",
  "unas": "unes",
  "al": "al",
  "del": "del",

  // Pronombres y determinantes
  "este": "aquest",
  "esta": "aquesta",
  "estos": "aquests",
  "estas": "aquestes",
  "esto": "això",
  "ese": "aquell",
  "esa": "aquella",
  "esos": "aquells",
  "esas": "aquelles",
  "eso": "allò",
  "aquel": "aquell",
  "aquella": "aquella",
  "aquellos": "aquells",
  "aquellas": "aquelles",
  "nuestro": "nostre",
  "nuestra": "nostra",
  "nuestros": "nostres",
  "nuestras": "nostres",
  "su": "el seu",
  "sus": "els seus",
  "se": "es",
  "nos": "ens",
  "ellos": "ells",
  "ellas": "elles",
  "nosotros": "nosaltres",
  "nosotras": "nosaltres",
  "todos": "tots",
  "todas": "totes",
  "todo": "tot",
  "toda": "tota",
  "nadie": "ningú",
  "nada": "res",
  "alguien": "algú",
  "cada": "cada",
  "otro": "altre",
  "otra": "altra",
  "otros": "altres",
  "otras": "altres",
  "mismo": "mateix",
  "misma": "mateixa",
  "mismos": "mateixos",
  "mismas": "mateixes",
  "junto": "junt",
  "juntos": "junts",
  "junta": "junta",
  "juntas": "juntes",

  // Conjunciones y adverbios
  "y": "i",
  "e": "i",
  "o": "o",
  "u": "o",
  "pero": "però",
  "sino": "sinó",
  "porque": "perquè",
  "también": "també",
  "tampoco": "tampoc",
  "siempre": "sempre",
  "nunca": "mai",
  "jamás": "mai",
  "donde": "on",
  "cuando": "quan",
  "como": "com",
  "más": "més",
  "menos": "menys",
  "muy": "molt",
  "mucho": "molt",
  "mucha": "molta",
  "muchos": "molts",
  "muchas": "moltes",
  "poco": "poc",
  "poca": "poca",
  "pocos": "pocs",
  "pocas": "poques",
  "ya": "ja",
  "aún": "encara",
  "todavía": "encara",
  "ahora": "ara",
  "después": "després",
  "antes": "abans",
  "aquí": "aquí",
  "allí": "allà",
  "allá": "allà",
  "así": "així",
  "además": "a més",
  "sólo": "només",
  "solo": "només",
  "solamente": "només",
  "incluso": "fins i tot",
  "sobre": "sobre",
  "bajo": "sota",
  "entre": "entre",
  "hacia": "cap a",
  "desde": "des de",
  "hasta": "fins a",
  "con": "amb",
  "sin": "sense",
  "para": "per a",
  "por": "per",
  "frente": "davant",
  "ante": "davant de",
  "bien": "bé",
  "mejor": "millor",
  "mejores": "millors",
  "peor": "pitjor",
  "peores": "pitjors",

  // Sustantivos cívicos y políticos
  "ayuntamiento": "ajuntament",
  "ayuntamientos": "ajuntaments",
  "municipio": "municipi",
  "municipios": "municipis",
  "municipal": "municipal",
  "municipales": "municipals",
  "ciudad": "ciutat",
  "ciudades": "ciutats",
  "pueblo": "poble",
  "pueblos": "pobles",
  "barrio": "barri",
  "barrios": "barris",
  "calle": "carrer",
  "calles": "carrers",
  "plaza": "plaça",
  "plazas": "places",
  "parque": "parc",
  "parques": "parcs",
  "poste": "pal",
  "postes": "pals",
  "árbol": "arbre",
  "árboles": "arbres",
  "arbolado": "arbrat",
  "vecino": "veí",
  "vecina": "veïna",
  "vecinos": "veïns",
  "vecinas": "veïnes",
  "vecindario": "veïnat",
  "ciudadanía": "ciutadania",
  "ciudadano": "ciutadà",
  "ciudadana": "ciutadana",
  "ciudadanos": "ciutadans",
  "ciudadanas": "ciutadanes",
  "persona": "persona",
  "personas": "persones",
  "gente": "gent",
  "familia": "família",
  "familias": "famílies",
  "infancia": "infància",
  "juventud": "joventut",
  "joven": "jove",
  "jóvenes": "joves",
  "mayor": "gran",
  "mayores": "grans",
  "mujer": "dona",
  "mujeres": "dones",
  "gobierno": "govern",
  "gobiernos": "governs",
  "política": "política",
  "políticas": "polítiques",
  "político": "polític",
  "políticos": "polítics",
  "reflejo": "reflex",
  "reflejos": "reflexos",
  "accesibilidad": "accessibilitat",
  "facilidad": "facilitat",
  "facilidades": "facilitats",
  "infraestructura": "infraestructura",
  "infraestructuras": "infraestructures",
  "ambiente": "ambient",
  "ambientes": "ambients",
  "realidad": "realitat",
  "realidades": "realitats",
  "acción": "acció",
  "acciones": "accions",
  "servicio": "servei",
  "servicios": "serveis",
  "gestión": "gestió",
  "derecho": "dret",
  "derechos": "drets",
  "vivienda": "habitatge",
  "viviendas": "habitatges",
  "piso": "pis",
  "pisos": "pisos",
  "hogar": "llar",
  "hogares": "llars",
  "salud": "salut",
  "sanidad": "sanitat",
  "educación": "educació",
  "cultura": "cultura",
  "deporte": "esport",
  "deportes": "esports",
  "trabajo": "treball",
  "trabajos": "treballs",
  "empleo": "ocupació",
  "igualdad": "igualtat",
  "justicia": "justícia",
  "libertad": "llibertat",
  "democracia": "democràcia",
  "participación": "participació",
  "transparencia": "transparència",
  "compromiso": "compromís",
  "compromisos": "compromisos",
  "contrato": "contracte",
  "contratos": "contractes",
  "programa": "programa",
  "programas": "programes",
  "propuesta": "proposta",
  "propuestas": "propostes",
  "medida": "mesura",
  "medidas": "mesures",
  "plan": "pla",
  "planes": "plans",
  "proyecto": "projecte",
  "proyectos": "projectes",
  "prioridad": "prioritat",
  "prioridades": "prioritats",
  "hecho": "fet",
  "hechos": "fets",
  "palabra": "paraula",
  "palabras": "paraules",
  "futuro": "futur",
  "presente": "present",
  "pasado": "passat",
  "esperanza": "esperança",
  "solución": "solució",
  "soluciones": "solucions",
  "problema": "problema",
  "problemas": "problemes",
  "recurso": "recurs",
  "recursos": "recursos",
  "presupuesto": "pressupost",
  "presupuestos": "pressupostos",
  "inversión": "inversió",
  "inversiones": "inversions",
  "impuesto": "impost",
  "impuestos": "impostos",
  "tasa": "taxa",
  "tasas": "taxes",
  "ayuda": "ajuda",
  "ayudas": "ajuts",
  "prestación": "prestació",
  "prestaciones": "prestacions",
  "trámite": "tràmit",
  "trámites": "tràmits",
  "oficina": "oficina",
  "oficinas": "oficines",
  "red": "xarxa",
  "redes": "xarxes",
  "espacio": "espai",
  "espacios": "espais",
  "equipamiento": "equipament",
  "equipamientos": "equipaments",
  "energía": "energia",
  "energías": "energies",
  "agua": "aigua",
  "aguas": "aigües",
  "residuo": "residu",
  "residuos": "residus",
  "medio": "medi",
  "entorno": "entorn",
  "urbanismo": "urbanisme",
  "mantenimiento": "manteniment",
  "acera": "vorera",
  "aceras": "voreres",
  "calzada": "calçada",
  "calzadas": "calçades",
  "asfalto": "asfalt",
  "parque": "parc",
  "parques": "parcs",
  "jardín": "jardí",
  "jardines": "jardins",
  "árbol": "arbre",
  "árboles": "arbres",
  "peatón": "vianant",
  "peatones": "vianants",
  "alumbrado": "enllumenat",
  "iluminación": "il·luminació",
  "limpieza": "neteja",
  "asociación": "associació",
  "asociaciones": "associacions",
  "entidad": "entitat",
  "entidades": "entitats",
  "consejo": "consell",
  "consejos": "consells",
  "comisión": "comissió",
  "comisiones": "comissions",
  "mesa": "taula",
  "mesas": "taules",
  "pacto": "pacte",
  "pactos": "pactes",
  "acuerdo": "acord",
  "acuerdos": "acords",
  "mandato": "mandat",
  "lema": "lema",
  "elección": "elecció",
  "elecciones": "eleccions",
  "candidatura": "candidatura",
  "candidaturas": "candidatures",
  "organización": "organització",
  "partido": "partit",
  "partidos": "partits",
  "voz": "veu",
  "voces": "veus",
  "firmeza": "fermesa",
  "valentía": "valentia",
  "fuerza": "força",
  "seguridad": "seguretat",
  "cuidado": "cura",
  "cuidados": "cures",
  "atención": "atenció",
  "calidad": "qualitat",
  "suficiencia": "suficiència",
  "eficacia": "eficàcia",
  "honestidad": "honestedat",

  // Adjetivos
  "público": "públic",
  "pública": "pública",
  "públicos": "públics",
  "públicas": "públiques",
  "privado": "privat",
  "privada": "privada",
  "privados": "privats",
  "privadas": "privades",
  "social": "social",
  "sociales": "socials",
  "común": "comú",
  "comunes": "comuns",
  "comunitario": "comunitari",
  "comunitaria": "comunitària",
  "comunitarios": "comunitaris",
  "comunitarias": "comunitàries",
  "cercano": "proper",
  "cercana": "propera",
  "cercanos": "propers",
  "cercanas": "properes",
  "fuerte": "fort",
  "fuertes": "forts",
  "claro": "clar",
  "clara": "clara",
  "claros": "clars",
  "claras": "clares",
  "directo": "directe",
  "directa": "directa",
  "directos": "directes",
  "directas": "directes",
  "concreto": "concret",
  "concreta": "concreta",
  "concretos": "concrets",
  "concretas": "concretes",
  "real": "real",
  "reales": "reals",
  "viable": "viable",
  "viables": "viables",
  "necesario": "necessari",
  "necesaria": "necessària",
  "necesarios": "necessaris",
  "necesarias": "necessàries",
  "posible": "possible",
  "posibles": "possibles",
  "imposible": "impossible",
  "fácil": "fàcil",
  "fáciles": "fàcils",
  "difícil": "difícil",
  "difíciles": "difícils",
  "importante": "important",
  "importantes": "importants",
  "prioritario": "prioritari",
  "prioritaria": "prioritària",
  "prioritarios": "prioritaris",
  "prioritarias": "prioritàries",
  "esencial": "essencial",
  "esenciales": "essencials",
  "básico": "bàsic",
  "básica": "bàsica",
  "básicos": "bàsics",
  "básicas": "bàsiques",
  "accesible": "accessible",
  "accesibles": "accessibles",
  "inclusivo": "inclusiu",
  "inclusiva": "inclusiva",
  "inclusivos": "inclusius",
  "inclusivas": "inclusives",
  "sostenible": "sostenible",
  "sostenibles": "sostenibles",
  "saludable": "saludable",
  "saludables": "saludables",
  "digno": "digne",
  "digna": "digna",
  "dignos": "dignes",
  "dignas": "dignes",
  "adecuado": "adequat",
  "adecuada": "adequada",
  "adecuados": "adequats",
  "adecuadas": "adequades",
  "precario": "precari",
  "precaria": "precària",
  "precarios": "precaris",
  "precarias": "precàries",
  "eficiente": "eficient",
  "eficientes": "eficients",
  "eficaz": "eficaç",
  "eficaces": "eficaços",
  "solidario": "solidari",
  "solidaria": "solidària",
  "solidarios": "solidaris",
  "solidarias": "solidàries",
  "democrático": "democràtic",
  "democrática": "democràtica",
  "democráticos": "democràtics",
  "democráticas": "democràtiques",
  "honesto": "honest",
  "honesta": "honesta",
  "honestos": "honests",
  "honestas": "honestes",
  "amable": "amable",
  "amables": "amables",
  "cuidado": "cuidat",
  "cuidada": "cuidada",
  "cuidados": "cuidats",
  "cuidadas": "cuidades",
  "justo": "just",
  "justa": "justa",
  "justos": "justos",
  "justas": "justes",
  "abierto": "obert",
  "abierta": "oberta",
  "abiertos": "oberts",
  "abiertas": "obertes",
  "vacío": "buit",
  "vacía": "buida",
  "vacíos": "buits",
  "vacías": "buides",
  "pleno": "ple",
  "plena": "plena",
  "plenos": "ples",
  "plenas": "plenes",
  "lleno": "ple",
  "llena": "plena",
  "llenos": "ples",
  "llenas": "plenes",
  "agresivo": "agressiu",
  "agresiva": "agressiva",
  "agresivos": "agressius",
  "agresivas": "agressives",
  "equitativo": "equitatiu",
  "equitativa": "equitativa",
  "equitativos": "equitatius",
  "equitativas": "equitatives",
  "vulnerable": "vulnerable",
  "vulnerables": "vulnerables",

  // Verbos (presente, futuro, subjuntivo, infinitivo, participio)
  "queremos": "volem",
  "quiere": "vol",
  "quieren": "volen",
  "querer": "voler",
  "defendemos": "defensem",
  "defiende": "defensa",
  "defienden": "defensen",
  "defender": "defensar",
  "defenderemos": "defensarem",
  "apostamos": "apostem",
  "apuesta": "aposta",
  "apuestan": "aposten",
  "apostar": "apostar",
  "apostaremos": "apostarem",
  "trabajamos": "treballem",
  "trabaja": "treballa",
  "trabajan": "treballen",
  "trabajar": "treballar",
  "trabajaremos": "treballarem",
  "proponemos": "proposem",
  "propone": "proposa",
  "proponen": "proposen",
  "proponer": "proposar",
  "propondremos": "proposarem",
  "garantizamos": "garantim",
  "garantiza": "garanteix",
  "garantizan": "garanteixen",
  "garantizar": "garantir",
  "garantizaremos": "garantirem",
  "impulsamos": "impulsem",
  "impulsa": "impulsa",
  "impulsan": "impulsen",
  "impulsar": "impulsar",
  "impulsaremos": "impulsarem",
  "fomentamos": "fomentem",
  "fomenta": "fomenta",
  "fomentan": "fomenten",
  "fomentar": "fomentar",
  "fomentaremos": "fomentarem",
  "creamos": "creem",
  "crea": "crea",
  "crean": "creen",
  "crear": "crear",
  "crearemos": "crearem",
  "desarrollamos": "desenvolupem",
  "desarrolla": "desenvolupa",
  "desarrollan": "desenvolupen",
  "desarrollar": "desenvolupar",
  "desarrollaremos": "desenvoluparem",
  "construimos": "construïm",
  "construye": "construeix",
  "construyen": "construeixen",
  "construir": "construir",
  "construiremos": "construirem",
  "establecemos": "establim",
  "establece": "estableix",
  "establecen": "estableixen",
  "establecer": "establir",
  "estableceremos": "establirem",
  "aprobamos": "aprovem",
  "aprueba": "aprova",
  "aprueban": "aproven",
  "aprobar": "aprovar",
  "aprobaremos": "aprovarem",
  "promovemos": "promovem",
  "promueve": "promou",
  "promueven": "promouen",
  "promover": "promoure",
  "promoveremos": "promourem",
  "explicamos": "expliquem",
  "explica": "explica",
  "explican": "expliquen",
  "explicar": "explicar",
  "explicaremos": "explicarem",
  "asumimos": "assumim",
  "asume": "assumeix",
  "asumen": "assumeixen",
  "asumir": "assumir",
  "asumiremos": "assumirem",
  "exigimos": "exigim",
  "exige": "exigeix",
  "exigen": "exigeixen",
  "exigir": "exigir",
  "exigiremos": "exigirem",
  "reforzamos": "reforcem",
  "refuerza": "reforça",
  "refuerzan": "reforcen",
  "reforzar": "reforçar",
  "reforzaremos": "reforçarem",
  "transformamos": "transformem",
  "transforma": "transforma",
  "transforman": "transformen",
  "transformar": "transformar",
  "transformaremos": "transformarem",
  "recuperamos": "recuperem",
  "recupera": "recupera",
  "recuperan": "recuperen",
  "recuperar": "recuperar",
  "recuperaremos": "recuperarem",
  "blindamos": "blindem",
  "blinda": "blinda",
  "blindan": "blinden",
  "blindar": "blindar",
  "blindaremos": "blindarem",
  "aseguramos": "assegurem",
  "asegura": "assegura",
  "aseguran": "asseguren",
  "asegurar": "assegurar",
  "aseguraremos": "assegurarem",
  "aseguren": "assegurin",
  "asegure": "asseguri",
  "mejoramos": "millorem",
  "mejora": "millora",
  "mejoran": "milloren",
  "mejorar": "millorar",
  "mejoraremos": "millorarem",
  "actuamos": "actuem",
  "actúa": "actua",
  "actúan": "actuen",
  "actuar": "actuar",
  "actuaremos": "actuarem",
  "hacemos": "fem",
  "hace": "fa",
  "hacen": "fan",
  "hacer": "fer",
  "haremos": "farem",
  "decidimos": "decidim",
  "decide": "decideix",
  "deciden": "decideixen",
  "decidir": "decidir",
  "priorizamos": "prioritzem",
  "prioriza": "prioritza",
  "priorizan": "prioritzen",
  "priorizar": "prioritzar",
  "priorizaremos": "prioritzarem",
  "planteamos": "plantegem",
  "plantea": "planteja",
  "plantean": "plantegen",
  "plantear": "plantejar",
  "plantearemos": "plantejarem",
  "demostramos": "demostrem",
  "demuestra": "demostra",
  "demuestran": "demostren",
  "demostrar": "demostrar",
  "demostraremos": "demostrarem",
  "pedimos": "demanem",
  "pide": "demana",
  "piden": "demanen",
  "pedir": "demanar",
  "presentamos": "presentem",
  "presenta": "presenta",
  "presentan": "presenten",
  "presentar": "presentar",
  "presentaremos": "presentarem",
  "escuchamos": "escoltem",
  "escucha": "escolta",
  "escuchan": "escolten",
  "escuchen": "escoltin",
  "cuidamos": "cuidem",
  "cuida": "cuida",
  "cuidan": "cuiden",
  "cuiden": "cuidin",
  "viven": "viuen",
  "vive": "viu",
  "vivir": "viure",
  "tienen": "tenen",
  "tiene": "té",
  "tenemos": "tenim",
  "tener": "tenir",
  "tendremos": "tindrem",
  "tengan": "tinguin",
  "tenga": "tingui",
  "son": "són",
  "es": "és",
  "somos": "som",
  "ser": "ser",
  "será": "serà",
  "serán": "seran",
  "sea": "sigui",
  "sean": "siguin",
  "están": "estan",
  "está": "està",
  "estamos": "estem",
  "estar": "estar",
  "esté": "estigui",
  "estén": "estiguin",
  "hay": "hi ha",
  "habrá": "hi haurà",
  "pueden": "poden",
  "puede": "pot",
  "podemos": "podem",
  "poder": "poder",
  "podrán": "podran",
  "pueda": "pugui",
  "puedan": "puguin",
  "debe": "ha de",
  "deben": "han de",
  "debemos": "hem de",
  "deber": "haver de",
  "debería": "hauria de",
  "deberían": "haurien de",
  "afecta": "afecta",
  "afectan": "afecten",
  "afectar": "afectar",
  "conecta": "connecta",
  "conectan": "connecten",
  "conectar": "connectar",
  "traducirá": "traduirà",
  "traduce": "tradueix",
  "traducir": "traduir",
  "obstaculizan": "obstaculitzen",
  "obstaculiza": "obstaculitza",
  "disfrutar": "gaudir",
  "disfruten": "gaudeixin",
  "comprometido": "compromès",
  "comprometida": "compromesa",
  "mejorarán": "milloraran",
  "mejorará": "millorarà",
  "comprometemos": "comprometem",
  "basen": "basin",
  "basa": "basa",
  "basan": "basen"
};

// Construir inverso CA -> ES
const WORDS_CA_TO_ES = {};
for (const [es, ca] of Object.entries(WORDS_ES_TO_CA)) {
  // En caso de colisión, mantener la traducción más común
  if (!WORDS_CA_TO_ES[ca]) {
    WORDS_CA_TO_ES[ca] = es;
  }
}
// Ajustes manuales del inverso CA -> ES
WORDS_CA_TO_ES["és"] = "es";
WORDS_CA_TO_ES["són"] = "son";
WORDS_CA_TO_ES["té"] = "tiene";
WORDS_CA_TO_ES["tenen"] = "tienen";
WORDS_CA_TO_ES["hi ha"] = "hay";
WORDS_CA_TO_ES["tothom"] = "todos y todas";
WORDS_CA_TO_ES["habitatge"] = "vivienda";
WORDS_CA_TO_ES["habitatges"] = "viviendas";
WORDS_CA_TO_ES["llar"] = "hogar";
WORDS_CA_TO_ES["llars"] = "hogares";
WORDS_CA_TO_ES["ajuntament"] = "ayuntamiento";
WORDS_CA_TO_ES["ajuntaments"] = "ayuntamientos";
WORDS_CA_TO_ES["veí"] = "vecino";
WORDS_CA_TO_ES["veïna"] = "vecina";
WORDS_CA_TO_ES["veïns"] = "vecinos";
WORDS_CA_TO_ES["veïnes"] = "vecinas";
WORDS_CA_TO_ES["proper"] = "cercano";
WORDS_CA_TO_ES["propera"] = "cercana";
WORDS_CA_TO_ES["propers"] = "cercanos";
WORDS_CA_TO_ES["properes"] = "cercanas";
WORDS_CA_TO_ES["retiment de comptes"] = "rendición de cuentas";
WORDS_CA_TO_ES["contracte democràtic"] = "contrato democrático";

/**
 * Aplica reemplazos de expresiones multipalabra respetando mayúsculas iniciales
 */
function replacePhrases(text, phraseList) {
  let result = text;
  for (const [src, dst] of phraseList) {
    // 1. Minúsculas / insensitive con preservación de mayúscula inicial si corresponde
    const regex = new RegExp(`\\b${escapeRegExp(src)}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return dst.charAt(0).toUpperCase() + dst.slice(1);
      }
      return dst;
    });
  }
  return result;
}

/**
 * Escapa caracteres especiales para RegExp
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Traduce palabras individuales preservando puntuación y mayúsculas
 */
function replaceWords(text, wordMap) {
  // Separar tokens por palabras respetando signos y espacios
  return text.replace(/([A-Za-zÀ-ÿ]+(?:'[A-Za-zÀ-ÿ]+)?)/g, (token) => {
    const lower = token.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(wordMap, lower)) {
      const translated = wordMap[lower];
      // Si el token original era todo mayúsculas
      if (token === token.toUpperCase() && token.length > 1) {
        return translated.toUpperCase();
      }
      // Si el token original tenía la primera letra mayúscula
      if (token[0] === token[0].toUpperCase()) {
        return translated.charAt(0).toUpperCase() + translated.slice(1);
      }
      return translated;
    }
    return token;
  });
}

/**
 * Post-procesamiento morfosintáctico para Catalán:
 * - Apostrofación normativa: l', d', s', m', n'
 * - Contraccions: a + el = al, de + el = del, per a + el = per al, per a + els = per als
 */
function postProcessCatalan(text) {
  let s = text;

  // Contracciones
  s = s.replace(/\ba\s+el\b/gi, (m) => m[0] === 'A' ? 'Al' : 'al');
  s = s.replace(/\ba\s+els\b/gi, (m) => m[0] === 'A' ? 'Als' : 'als');
  s = s.replace(/\bde\s+el\b/gi, (m) => m[0] === 'D' ? 'Del' : 'del');
  s = s.replace(/\bde\s+els\b/gi, (m) => m[0] === 'D' ? 'Dels' : 'dels');
  s = s.replace(/\bper\s+els\b/gi, (m) => m[0] === 'P' ? 'Pels' : 'pels');
  s = s.replace(/\bper\s+el\b/gi, (m) => m[0] === 'P' ? 'Pel' : 'pel');
  s = s.replace(/\bper\s+a\s+el\b/gi, 'per al');
  s = s.replace(/\bper\s+a\s+els\b/gi, 'per als');

  // Apostrofación del artículo 'el' y 'la' ante vocal o h
  // Regla general: l'educació, l'habitatge, l'organització, l'Ajuntament, l'accés, l'esperit, l'esport, etc.
  s = s.replace(/\b(el|la)\s+([aeiouhàèéíòóú])/gi, (match, art, nextChar) => {
    const isUpper = art[0] === art[0].toUpperCase();
    return (isUpper ? "L'" : "l'") + nextChar;
  });

  // Excepción normativa: 'la igualtat', 'la infància', 'la universitat' (la + i/u àtona no s'apostrofa)
  s = s.replace(/\bl'igualtat\b/gi, 'la igualtat');
  s = s.replace(/\bl'infància\b/gi, 'la infància');

  // Apostrofación de la preposición 'de' ante vocal o h
  s = s.replace(/\bde\s+([aeiouhàèéíòóú])/gi, (match, nextChar) => {
    const isUpper = match[0] === 'D';
    return (isUpper ? "D'" : "d'") + nextChar;
  });

  // Pronombre 'es' ante vocal -> s'
  s = s.replace(/\bes\s+([aeiouhàèéíòóú])/gi, "s'$1");

  // Ajustes de limpieza
  s = s.replace(/\bl'\s+/gi, "l'");
  s = s.replace(/\bd'\s+/gi, "d'");
  s = s.replace(/\bs'\s+/gi, "s'");

  return s;
}

/**
 * Post-procesamiento morfosintáctico para Castellano
 */
function postProcessSpanish(text) {
  let s = text;
  s = s.replace(/\ba\s+el\b/gi, (m) => m[0] === 'A' ? 'Al' : 'al');
  s = s.replace(/\bde\s+el\b/gi, (m) => m[0] === 'D' ? 'Del' : 'del');
  s = s.replace(/\bl'([a-záéíóú])/gi, 'el $1');
  s = s.replace(/\bd'([a-záéíóú])/gi, 'de $1');
  s = s.replace(/\bs'([a-záéíóú])/gi, 'se $1');
  return s;
}

/**
 * Traduce un texto simple entre ES y CA
 */
function translateText(text, fromLang = 'es', toLang = 'ca') {
  if (!text || typeof text !== 'string') return '';
  const isToCa = toLang === 'ca';

  let res = text.trim();
  if (isToCa) {
    res = replacePhrases(res, PHRASES_ES_TO_CA);
    res = replaceWords(res, WORDS_ES_TO_CA);
    res = postProcessCatalan(res);
  } else {
    res = replacePhrases(res, PHRASES_CA_TO_ES);
    res = replaceWords(res, WORDS_CA_TO_ES);
    res = postProcessSpanish(res);
  }

  return res;
}

/**
 * Traduce un objeto estructurado respetando estrictamente todas las claves
 */
function translateStructured(sourceObj, fromLang = 'es', toLang = 'ca') {
  if (!sourceObj || typeof sourceObj !== 'object') return {};
  const result = {};

  for (const [key, val] of Object.entries(sourceObj)) {
    if (Array.isArray(val)) {
      result[key] = val.map(item => {
        if (typeof item === 'string') {
          return translateText(item, fromLang, toLang);
        }
        if (typeof item === 'object' && item !== null) {
          return translateStructured(item, fromLang, toLang);
        }
        return item;
      });
    } else if (typeof val === 'string') {
      result[key] = translateText(val, fromLang, toLang);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = translateStructured(val, fromLang, toLang);
    } else {
      result[key] = val;
    }
  }

  // Compatibilidad para vistas que esperan cuerpo o texto sintetizado
  if (result.entradilla && Array.isArray(result.parrafos)) {
    result.cuerpo = result.parrafos.join('\n\n');
    result.texto = [result.entradilla, result.cuerpo].filter(Boolean).join('\n\n');
  } else if (result.parrafos && Array.isArray(result.parrafos)) {
    result.cuerpo = result.parrafos.join('\n\n');
    result.texto = result.cuerpo;
  } else if (result.entradilla && result.texto) {
    result.introduccion = [result.entradilla, result.texto].filter(Boolean).join('\n\n');
  }

  return result;
}

module.exports = {
  translateText,
  translateStructured,
  PHRASES_ES_TO_CA,
  WORDS_ES_TO_CA
};
