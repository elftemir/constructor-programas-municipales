# DECISIONES.md

## 1. Decisiones cerradas

| ID | Tema | Decisión |
|---|---|---|
| D01 | Alcance v1 | Fase 1 sin IA. IA local, traducción asistida y PDF en fase 2. Revisiones con IA, importador OCR y modo oscuro en fase 3. |
| D02 | Programa marco | Se convierte a `data/catalogo_marco.json` durante el desarrollo y se valida una vez mediante `data/catalogo_validacion.html`. |
| D03 | Entrada del marco | Si existen DOCX y PDF del mismo marco: DOCX para estructura/texto; PDF para contraste visual. OCR solo donde no haya texto extraíble fiable. |
| D04 | Idiomas | El catálogo puede guardar `es` y `ca`. Cada texto exportable tiene estado por idioma. |
| D05 | Tipografía de distribución | Inter / Inter Display en aplicación y Word. Las fuentes de referencia no autorizadas para distribución no forman parte del paquete final. |
| D06 | PDF | Fase 2. Conversión mediante Microsoft Word instalado. Sin Word, se entrega DOCX y se indica `Guardar como PDF`. |
| D07 | Competencias IA | La IA solo avisa; no cambia verbos ni reformula para resolver una duda de competencia. |
| D08 | Partido y organización | Partido `Podemos` por defecto y organización `partido + municipio`; ambos editables. |
| D09 | Estados | Sin revisar, Incluida, Adaptada, En duda, Descartada. |
| D10 | Trabajo en equipo | Un proyecto se edita por una persona a la vez. Se comparte exportando proyecto o Word. |
| D11 | Logo | Logo de la agrupación local, PNG o JPG. No usar el escudo municipal ni un logo fijo de Podem Catalunya en el programa. |
| D12 | Longitud IA | Introducciones de área: 80–120 palabras. Presentación: 3–4 ejes; corta 220–300, estándar 350–500. |
| D13 | Datos de ejemplo | Sant Andreu de la Barca solo sirve para pruebas y diseños. |
| D14 | Guardado | Automático; `Guardar ahora` en menú y Ctrl+S. |
| D15 | Pantalla | Aplicación de escritorio 16:9, mínimo 1366 × 768. |
| D16 | Navegación por áreas | Pestañas horizontales superiores tipo navegador/carpeta, nombre completo visible, orden fijo del marco, desplazamiento horizontal si no caben. |
| D17 | Orden | Áreas y medidas originales mantienen orden. Solo las medidas propias se posicionan manualmente dentro del área. |
| D18 | Un programa, dos versiones lingüísticas | Confirmado por el usuario el 11/10/2026: importar un documento castellano y otro catalán crea UN solo programa fuente, con las mismas medidas e identificadores. Los idiomas se guardan por separado dentro de esa fuente. La vista muestra la versión correspondiente al idioma seleccionado en el programa. No crear dos fuentes ni duplicar las medidas por idioma. Se admite importar un solo documento y añadir después el idioma que falta. Conservar el funcionamiento bilingüe validado por el usuario en todas las próximas versiones. |
| D19 | Identidad e instalación Windows | Conservar appId `org.podemos.constructor.municipal`, productName `Constructor de Programas Municipales Podemos`, author.name `elftemir`, sin win.publisherName. Instalación para todos los usuarios, carpeta fija en Program Files y mejoras de limpieza de la 3.5.3. No cambiar el copyright sin consultar. Codex no modifica la carpeta instalada; las pruebas de instalación las realiza el usuario. |
| D20 | Entrega de versiones | Guardar directamente el instalador, blockmap, fuente y verificaciones de cada nueva versión en `instalable/`; actualizar allí `latest.yml`, `VERSION.txt`, `latest.txt`, `SHA256.txt` y las copias del instalador sin versión. `latest.yml` es el archivo usado por electron-updater. El alias mal escrito se retira por decisión del usuario el 12/10/2026: no tiene lectores. No modificar la descarga de Programas Marco desde el repositorio de contenidos. |
| D21 | Correcciones críticas ya incorporadas | Desde la 3.5.0, el OCR simulado se sustituyó por Tesseract local real con `spa` y `cat`; no debe volver a generar medidas ficticias. El prompt castellano incluye «problemas que no estén en el contexto». Ambas correcciones se conservan y verifican en la 3.5.4. |

## 2. Registro de supuestos nuevos

Antigravity añadirá aquí cualquier decisión no cubierta por la documentación antes de consolidarla como requisito.

| Fecha | Supuesto o duda | Decisión | Archivos afectados |
|---|---|---|---|
| 2026-10-05 | Estructura de medidas en `programa_prueba.pdf` | Las 123 medidas del programa de prueba no disponen de título independiente en el PDF fuente; se extraen con `titulo: null` y el texto completo en `texto`, respetando el formato de "Medida sin título" previsto en la documentación y plantilla Word. Las páginas 1 a 3 se extraen como `presentacion`. | `data/catalogo_marco.json`, `data/catalogo_validacion.html` |
| 2026-10-05 | Control de calidad del catálogo (2ª pasada) | Se normalizan 12 artefactos de extracción provocados por cortes de bloques de texto (BT...ET) y cambios de fuente en el PDF fuente, constatando visualmente que corresponden a palabras continuas. Se preservan 9 casos genuinos de errata, sintaxis atípica o mezcla idiomática del documento original marcados como `dudoso: true` con `motivo_duda` específico, garantizando coherencia interna total. | `data/catalogo_marco.json`, `data/catalogo_validacion.html` |
| 2026-10-06 | Implementación de Fase 1 (App de Escritorio Windows) | Se construye la aplicación de escritorio nativa para Windows implementando 100% de la Fase 1: arquitectura desacoplada, navegación superior por pestañas horizontales de áreas completas, triaje ágil (I/D/X/Ctrl+Z), adaptación con original protegido, medidas propias, textos generales, autocompletado INE, exportador directo DOCX editable sobre la plantilla oficial y persistencia SQLite local offline. Se compila el instalador ejecutable NSIS en `instalable/Programa_Electoral_Municipal_Setup_x64.exe`. | `src/`, `package.json`, `instalable/` |



## D22 — 3.5.6: final normal de EnumRegKey
El final de enumeración devuelve cadena vacía sin Errors. Comprobar siempre cpmKey vacío para salir; la prueba NSIS debe simular este final normal y verificar la primitiva nativa mediante lectura. El log debe usar FileSeek END para conservar etapas. No ejecutar instaladores reales ni modificar Program Files desde Codex.

## D23 — Alcance de la 3.6.0
El usuario confirma el 11/10/2026 limitar la entrega a los puntos 2–6: prompts, pruebas, contexto municipal, persistencia segura y exportación PDF con conversor. Se excluyen cambios de portada/candidatura, macOS/Linux, CONTRIBUTING, plantillas de incidencias, CHANGELOG, commits, copyright y marca. Conservar Acerca de e instalador 3.5.6.

## D24 — Acceso de escritorio obligatorio en la 3.6.1
El usuario informa de que la instalación 3.6.0 no deja acceso en el escritorio. Mantener createDesktopShortcut="always" y forzar la recreación mediante el creador nativo al final de customInstall, en contexto all. customUnInstall solo retira accesos durante desinstalación manual, nunca durante actualización. El código de src se conserva byte por byte respecto a 3.6.0.

## D25 — Lema bilingüe: lema_es / lema_ca, uso según idioma de salida
Desde la 3.7.0, proyectos y fichas guardan ambos lemas por separado, con un máximo de 60 caracteres cada uno. La migración 006 conserva el lema anterior en el idioma principal del proyecto (castellano si falta), y en castellano para las fichas, con copia previa en backups/migrations. La columna antigua se conserva para compatibilidad y no decide el texto mostrado. La exportación, la vista previa y la IA seleccionan exclusivamente el lema del idioma de salida. Usar el otro idioma requiere una elección expresa para esa exportación; no se guarda como traducción. No sobrescribir un lema escrito al traducir sin confirmación.

## D26 — Distribución vacía e independencia de contenidos
El instalador se distribuye vacío: sin Programas Marco, proyectos ni datos. El código no contiene ninguna referencia fija a un Programa Marco concreto. El Programa Marco oficial se ofrece desde el repositorio de contenidos al primer arranque; solo se descarga al pulsar el botón. Los paquetes de prueba nunca se instalan ni se anuncian automáticamente.

## D27 — Cierre de 3.7.0 antes de la GPU
El usuario confirma cerrar primero 3.7.0: distribución vacía, auditoría ASAR y retirada del ejemplo. La GPU y los avisos de motor quedan exclusivamente para una 3.8.0 posterior a publicar 3.7.0. En producción solo se aceptan paquetes official=true sin marca de prueba. En desarrollo las pruebas requieren CPM_ALLOW_TEST_CONTENT=1. La migración 007 retira fuentes de prueba sin borrar proyectos. No se buscan ni abren bases reales.

Los binarios CPU oficiales b11476 se conservan intactos. Solo en vendor/llama y con SHA256 igual al manifiesto oficial se admiten rutas del prefijo de compilación de GitHub Actions del proveedor. Las demás rutas de la unidad prohibida y los marcadores personales siguen bloqueados. El informe conserva las rutas observadas como evidencia.

## D28 — Entrega ordenada y revisión 3.8.0
Solo se prepara una entrega final si su informe termina en LISTO PARA REVISIÓN. Código, actualizaciones y contenidos se separan; se conservan las entregas anteriores sin borrarlas. La 3.7.0 no se publicó ni se etiqueta. La 3.8.0 incorpora sus cambios y corrige la diferencia de DEFAULT mediante esquema 8. Las referencias públicas al autor y la cuenta elftemir son válidas; las rutas de perfiles personales están prohibidas. Nunca se hace commit, push ni subida automática. Los detalles operativos locales se conservan fuera del código publicable.

## D29 — Alcance final autorizado de 3.8.0
El último encargo sustituye la espera de D27: la 3.7.0 no se publica y sus arreglos se incorporan en 3.8.0, trabajando en copia separada. Se conserva NSIS e identidad. CPU y Vulkan b11476 se verifican con sus hashes oficiales; la GPU debe superar un 30 % la velocidad de CPU para la selección automática. Máximo un servidor y retorno a CPU con un solo reintento. Los avisos proceden del motor principal y no se persisten ni exportan. La entrega final sustituye D20: seis archivos instalables y carpetas separadas de código, release y contenidos; se archiva todo contenido anterior sin borrarlo.

## D30 — Versión 3.8.1
La 3.8.0 tampoco se publica. La 3.8.1 parte de su código final y conserva las carpetas anteriores. Mínimos de medidas en una única constante; ningún JSON de generación se muestra o guarda en bruto. Los fallos de calidad permiten un reintento y no se ocultan con plantillas. Toda reparación de textos guardados requiere confirmación y copia previa; la exportación solo transforma su copia. Disponibilidad del motor, procedencia del resultado y avisos son estados distintos. Se retira Qwen 2.5 3B del uso por su licencia, sin borrar archivos sin permiso; se ofrece Qwen3 4B Apache-2.0 verificado. No cambian NSIS ni identidad. Trabajo, perfiles y pruebas quedan fuera de la entrega de cuatro carpetas. No se etiqueta 3.7.0 ni 3.8.0 y no se realizan subidas automáticas.

## D31 — Criterios de redacción y disponibilidad 3.8.1
Presentación/cierre requieren tres medidas seleccionadas; introducción, una de su área. Catalán directo tras comparar cinco casos por modelo y opción. Generación normal 0,65 y repetición 1,10; un reintento estricto y rechazo visible, sin respaldo silencioso. El indicador depende de disponibilidad verificada en el proceso principal, mientras cada resultado conserva su motor real. Qwen 1.5B permanece por defecto por memoria; Qwen3 4B Apache de Unsloth es la opción de calidad, revisión y hash fijados. La retirada del 3B solo borra su archivo por petición y confirmación del usuario. El aviso de retirada se confirma una vez; el de generación se limita a la sesión y a fallos involuntarios. Ni 3.7.0 ni 3.8.0 se etiquetan o publican.

La revisión manual de las salidas obligó a reforzar el control de idioma, los lemas no aportados y la finalidad de la vivienda pública. El formato de generación catalán usa claves catalanas y se normaliza a los campos habituales antes del renderer. Se conserva la respuesta sin corregir su contenido político; los casos rechazados no se ofrecen. El control es defensivo, no una garantía de corrección lingüística o semántica, y se mantiene la revisión humana.

La detección estadística de idioma usa franc 6.2.0 (MIT), sin red y solo para párrafos suficientemente largos con diferencia clara entre idiomas. Se rechazan también símbolos de generación corrupta y datos de entrada devueltos como texto. La reparación pendiente bloquea el guardado ordinario de su vista formateada hasta obtener consentimiento; generar y aceptar expresamente una nueva propuesta sigue permitido.

## D32 — Recuperación y textos 3.8.2
La 3.8.2 parte de las fuentes finales de 3.8.1, conservadas intactas. Una petición fallida no debe impedir las siguientes: salud y slots antes de inferir, cancelación por cierre real de la conexión, recuperación del mismo backend y CPU si persiste el fallo. Los errores de formato, contexto o longitud no desactivan la GPU. Un slot explícito y contexto de acuerdo con el presupuesto de salida; las presentaciones largas se componen por partes y se validan entre 350 y 500 palabras. El nombre propio del municipio queda excluido del detector de bucles; los umbrales largos dependen de la longitud. Se registra el motivo de fin y cada rechazo, sin guardar prompts o respuestas personales en el log técnico. Reparaciones de JSON solo con confirmación y copia previa; nunca se ejecuta el instalador ni se modifican datos reales. No cambian identidad ni NSIS y no se hace ninguna subida.


## D33 — Versión 3.8.3
Los datos autorizados para depuración se copian a una zona privada y se eliminan al terminar; nunca se incluyen en código, pruebas publicables, paquete o informes públicos. Un error de petición no cambia el backend si el servidor está vivo y responde a salud. La detección automática comparte la cola y su interrupción no desactiva la GPU. La reparación de JSON truncado conserva el texto disponible y avisa de la parte irrecuperable, siempre con confirmación y copia previa. La importación de PDF no depende de IA: usa fuentes, tamaños, posiciones y viñetas; ante capas superpuestas obtiene el texto solo del OCR del idioma pedido, empleando únicamente posiciones como guía de estructura. Mantener NSIS e identidad y no realizar subidas.

## D34 — Validación por dos niveles, 3.8.4
La revisión humana decide sobre avisos de idioma, números, otros municipios, duplicados, listas, problemas, plazos, lemas y longitud. Se marcan sus fragmentos exactos y no provocan rechazo. Solo EMPTY, INVALID_JSON, PROMPT_LEAK, REPETITION claro, ELECTORAL_CLAIM y UNSUPPORTED_PERSON bloquean, con un único reintento. Esta decisión sustituye los rechazos de contenido y lenguaje de D31–D33. Las partes válidas de una presentación larga se conservan: las fallidas se omiten con aviso; se requieren título, entradilla y al menos dos párrafos. No se revalida cada nuevo párrafo junto con todos los anteriores.

Reglas retiradas, una por una:
- Condición específica para vivienda pública y cambio a espacios verdes: no es un validador semántico general.
- Condición específica de rehabilitación de vivienda dentro de un párrafo: mismo motivo.
- Prohibición específica de ampliar o abrir parques públicos a partir de zonas de juego: se sustituye por la instrucción general de no cambiar la finalidad de una medida.
- Glosario condicionado de vivienda pública en el prompt y su reintento especializado: se retiran; el prompt expresa la regla genérica.
- Léxico experimental añadido a partir de errores de un caso concreto (volim, lecçons, desembrement, vostra voce y variantes): se retira. Se conserva solo vocabulario castellano general inequívoco como aviso; no como rechazo.
- Rechazo total por una preposición, artículo o conjunción: se retira. La conjunción y solo se corrige entre palabras en minúscula fuera de citas y nombres, si franc identifica catalán; la propuesta muestra el aviso y el log guarda únicamente el número de cambios. Otras correcciones se sugieren sin aplicar.
- Descartar toda la presentación al fallar un fragmento o revalidar todos los párrafos en cada paso: se retira. La inspección final de similitud entre párrafos produce avisos.

La desactivación de GPU persiste con motivo visible, también tras reabrir Configuración. Volver a detectar limpia la causa anterior y repite la detección. Se mantienen el umbral del 30 %, hashes oficiales y recuperación comprobada por salud. Sin cambios en NSIS ni identidad, sin publicación automática.

## D35 — Revisión externa 3.8.5
Presentación larga disponible con LONG_MIN_SELECTED=6 en el contrato compartido; la selección se verifica en el proceso principal. Cada grupo de medidas se redacta una sola vez, sin volver al principio ni rellenar para alcanzar 350 palabras. Si queda corta, se ofrece con aviso. Se mantienen los reintentos bloqueantes y los fragmentos válidos.
La comprobación lingüística utiliza Hunspell local, diccionarios catalán y castellano y franc por bloque (incluidos título y entradilla). Las sugerencias no se aplican; los nombres aportados, siglas y cifras quedan excluidos. Se agrupan avisos iguales y correcciones, conservando las posiciones individuales para marcar el texto. Nunca se afirma ausencia de problemas: se indica que no se han detectado automáticamente y se exige revisión humana. Una palabra válida puede estar mal usada en contexto; el corrector ortográfico no garantiza gramática ni sentido. No se añaden reglas específicas del anexo para declarar incorrectas palabras que el diccionario reconoce.
Qwen3 4B se recomienda para catalán cuando hay GPU compatible o al menos 16 GB de RAM; Qwen 2.5 1.5B se mantiene para equipos modestos y su limitación catalana se avisa una vez por sesión, con acción voluntaria para descargar/activar. Nunca se descarga un modelo sin pulsar el botón.
Traducir textos existentes no exige medidas seleccionadas. Al aceptar nueva redacción se pregunta en ambos sentidos antes de sustituir contenido del otro idioma; Mantener conserva el texto y marca desactualizado, Actualizar muestra una propuesta con avisos y requiere aceptación. Las fuentes oficiales no se renombran, editan ni borran; solo se archiva una anterior cuando hay otra oficial vigente. Al actualizar contenidos se conservan las copias bilingües de medidas seleccionadas en los proyectos.
No se distribuye el Marco provisional. El oficial se prepara por separado mediante dos DOCX estructurados y comparación estricta de áreas/medidas, sin publicar ni cambiar contenidos remotos. Identidad y NSIS sin cambios.

Límite conocido aceptado expresamente por el usuario en el cierre de la 3.8.5: el corrector marca 14 de los 17 términos de la regresión. «gestion», «toma» y «escut» figuran en el diccionario catalán. Un corrector ortográfico no detecta palabras válidas mal usadas en contexto; no se añaden excepciones para forzar esos tres casos. La revisión humana sigue siendo necesaria.

## D36 — Portada neutra y cierre 3.8.5
La plantilla se llama portada_programa_editable.docx. Conserva el diseño con marcadores neutros de municipio, candidatura, lema y elecciones, sin lema ni fecha de muestra en sus textos, nombres de cuadros o metadatos. Al exportar se sustituyen o vacían los marcadores: si falta el lema, sus cuadros quedan vacíos; si falta la fecha electoral, se omite la línea electoral en lugar de deducir una fecha del mandato. No se repite la matriz nativa de 160 peticiones porque este cambio no afecta a IA; se repiten npm test, copia limpia, compilación y auditorías de ASAR, payload y latest.yml. El Programa Marco se publicará aparte.
La comprobación visual detectó que el ajuste tipográfico solo se aplicaba al cuadro DrawingML, mientras que LibreOffice utilizaba su alternativa VML con el tamaño de muestra. Ambos reciben ahora el mismo tamaño, calculado también con margen para la sustitución de fuente por Inter; se conservan las formas, posiciones y colores. Se verifica la paridad de tamaños en la prueba de portada.

La matriz real con seis medidas detectó truncamientos de Qwen3 4B al pedir la presentación corta como un único JSON de 900 tokens. Subir provisionalmente a 1.800 no evitó el primer truncamiento. Para seis o más medidas, la presentación corta también se redacta por partes: hasta tres grupos disjuntos (frente a seis en larga), un párrafo por grupo, sin ciclos. La salida sigue siendo una sola propuesta y conserva los avisos. Se mantienen presupuestos acotados, los datos seleccionados y los controles bloqueantes; no se desactiva la GPU por un límite de salida. Se repiten las matrices con este código definitivo; los intentos del diagnóstico no se cuentan como resultados finales.
