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
| D20 | Entrega de versiones | Guardar directamente el instalador, blockmap, fuente y verificaciones de cada nueva versión en `instalable/`; actualizar allí `latest.yml`, `VERSION.txt`, `latest.txt`, `lastest.txt`, `SHA256.txt` y las copias del instalador sin versión. `latest.yml` es el archivo usado por electron-updater. No modificar la descarga de Programas Marco desde el repositorio de contenidos. |
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
