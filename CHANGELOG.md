# Historial de cambios

## 3.8.5
- Portada neutra sin lema, municipio ni fecha de ejemplo; los campos vacíos se omiten en la exportación.
- Limitación conocida del corrector aceptada: 14/17 términos; las palabras catalanas válidas mal usadas requieren revisión humana.
- Textos largos con seis medidas como mínimo y sin recorrer grupos repetidos para rellenar.
- Corrector local catalán/castellano con sugerencias, avisos agrupados y revisión honesta de título, entradilla y párrafos.
- Recomendación de Qwen3 4B para catalán y equipos con recursos suficientes.
- Traducción bidireccional con confirmación antes de reemplazar, propuesta revisable y botón para actualizar textos desactualizados.
- Programas Marco oficiales protegidos y proyectos conservados al actualizar contenido. Herramienta documentada para empaquetar dos DOCX.
- Sin Programa Marco provisional ni datos precargados.

## 3.8.4

- La propuesta se muestra con avisos de idioma, datos, repeticiones y longitud, marcando el fragmento para revisarlo. Editar, regenerar y aceptar siguen siendo decisiones del usuario.
- Solo vacíos, JSON irrecuperable, instrucciones filtradas, bucles claros, afirmaciones electorales y cargos inventados bloquean y permiten un reintento.
- Las presentaciones largas conservan sus fragmentos válidos y avisan de las ideas omitidas.
- Corrección limitada de la conjunción castellana en texto catalán, sin tocar nombres, siglas o citas; el resto son sugerencias.
- Se retiran reglas ligadas a ejemplos concretos. Configuración de IA muestra el motivo del uso de CPU y permite volver a detectar.
- Distribución vacía, datos locales, OCR bilingüe e identidad del instalador conservados.

## 3.8.3

- Los rechazos de una propuesta no desactivan la GPU; recuperación y detección automática coordinadas.
- Avisos claros de rechazo por idioma, longitud o contenido.
- Detección y reparación con copia previa de JSON truncado; se conserva el texto disponible y se avisa de lo que falta.
- Importación por estructura visual: títulos en negrita sin numerar, viñetas de Word y medidas de varias líneas; cabeceras y pies repetidos descartados.
- Detección de capas de texto superpuestas y OCR local en el idioma seleccionado, con las viñetas de color conservadas.
- Dos documentos ES/CA siguen formando una sola fuente. Distribución vacía e identidad del instalador conservadas.

Este historial se reconstruye a partir de la conversación y los informes locales. La última versión publicada indicada por el mantenedor es la 3.6.1; la 3.7.0 no se publicó. No se atribuyen cambios a versiones intermedias sin información comprobable.

## 3.8.2

- Corrige la aceptación de propuestas: título, entradilla y párrafos conservan sus campos; una entradilla vacía o igual al título toma el primer párrafo sin duplicarlo.
- Amplía la reparación consentida a JSON catalán duplicado, escapado o repartido en campos, con estado desactualizado; conserva copia previa y convierte únicamente la copia exportada.
- Comprueba salud y slots del servidor, cierra conexiones al cancelar o vencer el plazo, recupera el mismo backend antes de CPU y evita marcar errores de contenido como fallos de GPU.
- Dimensiona contexto, tokens y tiempos según longitud; compone las presentaciones largas por partes y valida su longitud final. Registra fin de respuesta, truncamiento y validaciones en metadatos técnicos sin textos personales.
- Rechaza afirmaciones de victoria electoral y listas; las instrucciones presentan una propuesta de candidatura en primera persona del plural.

## 3.8.1

- Incorpora los cambios de distribución vacía, lema bilingüe, migraciones y GPU de 3.7.0 y 3.8.0, que no se publicaron.
- Exige medidas seleccionadas antes de redactar; interpreta las respuestas estructuradas y rechaza instrucciones, repeticiones y municipios inventados con un único reintento.
- Mantiene el instalador y su identidad; la aplicación se distribuye vacía.
- Aceptar o editar una propuesta guarda texto formateado. Los textos antiguos con JSON se reparan solo con confirmación y copia previa; Word/PDF transforman únicamente la copia exportada y avisan.
- La cabecera muestra la disponibilidad verificada del modelo, la etiqueta identifica la operación real y la traducción integrada no reabre avisos. Se corrige el nombre del modelo y el diagnóstico muestra servidor, backend, dispositivo y capas reales.
- Retira Qwen 2.5 3B por su licencia sin borrar automáticamente los archivos. Añade Qwen3 4B Instruct 2507 Apache-2.0, sin pensamiento, GGUF de Unsloth con revisión y hash fijos; mantiene 1.5B por defecto por memoria y velocidad.
- Elimina los rótulos internos de fases de la interfaz y organiza la entrega local en código, actualizaciones, contenidos opcionales e instalador, con anexo de pruebas reales.
- Refuerza la detección de mezclas de idioma, inglés y lemas inventados; distingue el parque público de viviendas de los espacios verdes. El esquema interno de las respuestas usa claves catalanas cuando redacta en catalán y devuelve siempre los campos de datos habituales a la aplicación.
- Añade detección local de idioma con franc (MIT), rechazo de símbolos corruptos y protección del guardado de textos pendientes de reparación.

## 3.8.0 (no publicada)

- Incluye los cambios de la 3.7.0, que no llegó a publicarse.
- Normaliza las columnas de fuente mediante esquema 8, con conservación y copia previa de los datos.
- Muestra el estado de contenidos en Inicio, permite reintentar sin conexión y ofrece la descarga oficial con progreso tras pulsar el botón.
- Añade aceleración Vulkan con llama.cpp b11476, verificación de binarios, comparación CPU/GPU y retorno automático al procesador cuando falla la gráfica. CUDA queda como posible ampliación.
- Informa del motor real de cada generación mediante banner de sesión, etiqueta y estado permanente; los avisos no se guardan ni exportan.
- El banner reaparece cuando un fallo de IA o GPU cambia el motor. La traducción integrada sin IA muestra únicamente su etiqueta y no interrumpe la sesión de redacción.
- La conversión PDF con LibreOffice usa un perfil temporal aislado.
- Entrega código, actualizaciones y Programa Marco provisional en carpetas separadas. El instalador sigue sin incluir ningún Programa Marco.

### Cambios de 3.7.0 incorporados

- Distribución vacía: sin Programas Marco ni datos; primer arranque guiado y descarga exclusiva de contenidos oficiales. Los paquetes de prueba quedan bloqueados en producción.
- Migración 007 con copia previa: retira fuentes de ejemplo conservando todos los proyectos municipales y su contenido. Auditoría ASAR bloquea ejemplos y metadatos de pruebas.

1. Lema bilingüe: `lema_es` y `lema_ca` en proyectos y fichas; migración 006 con copia previa y conservación del campo antiguo. Dos campos con contador /60, traducción con confirmación de sobrescritura, vista previa sin lema de muestra y selección por idioma en Word, PDF e IA. Aviso antes de exportar si falta el lema del idioma pedido.
2. Distribución documentada correctamente: el instalador se solicita directamente al autor; las Releases del código identifican las fuentes y no adjuntan EXE. Se mantiene el repositorio del actualizador.
3. Pruebas de Word portables: detección existente de LibreOffice, validación XML siempre y omisión justificada de la conversión si falta. Los documentos temporales quedan en la carpeta de pruebas.
4. Documentación de los datos: 947 municipios de Cataluña, columnas reales, fuente declarada Idescat / INE y población de 2025; descripción del catálogo de modelos descargables.
5. Iconos consolidados: ICO original de ventana e instalador; un PNG de interfaz de 256×256, inferior a 100 KB. Retirados los SVG con PNG incrustado y los duplicados.
6. Licencias exactas de los modelos Qwen: Apache-2.0 para 0.5B y 1.5B; Qwen Research para 3B, con aviso de restricciones y enlaces oficiales en la pantalla de modelos y avisos de terceros.
7. Preparación local, sin subidas automáticas. La versión pública se etiqueta `v3.8.0`; no se crea una etiqueta de la 3.7.0 no publicada.

El esquema de datos pasa de 5 a 8. Las versiones antiguas que no admiten el esquema 8 no pueden abrir esos datos de forma segura. Los otros campos detectados en la revisión de idiomas se documentan sin modificarlos. El NSIS y su identidad permanecen como en la 3.6.1; las exclusiones de empaquetado impiden incorporar contenidos privados.

## 3.6.1

- Crea o recupera el acceso directo del escritorio público al instalar, reinstalar y actualizar.
- Respeta la conservación de accesos durante una actualización; los elimina en la desinstalación manual.
- Añade una prueba nativa aislada de enlaces de Windows.
- Prepara documentación de colaboración y un proceso local reutilizable para publicar código e instalador. No realiza subidas automáticas.

## 3.6.0

- Refuerza la equivalencia de los prompts castellano y catalán; conserva la corrección castellana ya incorporada.
- Añade contexto de proyecto y ficha municipal a la redacción con IA y control del límite de 4096 tokens.
- Guardado SQLite atómico, cinco copias de arranque, restauración confirmada y copia previa obligatoria al migrar.
- PDF deshabilitado sin Word o LibreOffice; DOCX disponible y enlace de descarga oficial de LibreOffice.
- Valida versiones x.y.z, utiliza un catálogo mínimo de prueba y resume todas las baterías, sin parar en el primer fallo.

## 3.5.6

- Corrige el bucle infinito del instalador al terminar la enumeración del registro.
- Corrige la prueba que simulaba incorrectamente ese final y conserva todas las etapas del log.
- Instalación real confirmada por el usuario en la conversación.

## 3.5.5

- Ajusta la migración entre instalación por usuario y para todos los usuarios.
- Añade mensajes de error, registro de etapas y BAT de diagnóstico.
- El bloqueo real del instalador continuó; quedó resuelto en la 3.5.6.

## 3.5.4

- Conserva el programa bilingüe de la 3.5.2 y las mejoras del instalador de la 3.5.3.
- Actualiza metadatos y archivos de distribución.
- Se notificaron problemas de instalación; no se considera la corrección definitiva.

## 3.5.3

- Iteración del instalador/desinstalador con identidad fija, destino para todos los usuarios y limpieza de restos.
- Mantiene el programa de la 3.5.2.
- No se dispone de un informe de entrega independiente para reconstruir todos los detalles de esta iteración.

## 3.5.2

- Importa dos archivos opcionales ES/CA como un único programa fuente.
- Revisión por idioma, retorno a la primera revisión y confirmación conjunta.
- Reversión de la importación si la segunda versión no coincide; evita duplicar fuentes y medidas.

## 3.5.1

- Añade a una fuente existente el idioma que falta, incluyendo PDFs escaneados.
- Conserva los identificadores, separa textos ES/CA y valida estructura y numeración.

## 3.5.0

- Sustituye el OCR simulado por Tesseract local real con spa y cat.
- Corrige el prompt castellano para impedir inventar hechos ausentes del contexto.
- Corrige la espera del programa activo al crear proyectos y utiliza datos sintéticos aislados en tests.
- Añade metadatos OCR, revisión, progreso, cancelación e integridad de recursos.

## 3.4.0

Base técnica comprobada para las entregas siguientes. No hay información suficiente para reconstruir una lista independiente y completa de los cambios respecto a la 3.3.0.

## 3.3.0

Última versión publicada indicada por el mantenedor. Se describieron incidencias de OCR, prompts y pruebas sobre ella; no se dispone aquí de su historial original completo.
