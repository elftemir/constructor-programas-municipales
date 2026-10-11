# Verificación y alcance de la 3.6.0

Base verificada: 3.5.6, instalada correctamente por el usuario. La entrega se limita a los puntos 2–6 según su última instrucción. Los cambios de portada y candidatura que habían empezado se retiraron. No se incluyen builds para otros sistemas, CONTRIBUTING, plantillas de incidencias, CHANGELOG ni cambios de copyright o marca.

## Estado antes de cada corrección

| Punto | Estado comprobado en la 3.5.6 | Resultado en la 3.6.0 |
|---|---|---|
| 2. Prompt | La frase castellana ya era exactamente «No inventes calles, barrios, equipamientos, datos, conflictos sociales ni problemas que no estén en el contexto.» | Se conserva. Se igualan tres diferencias menores de sentido y listas ES/CA. |
| 3. Tests | La creación ya funcionaba con un catálogo sintético aislado. La versión aceptaba cualquier cadena que empezase por 3.; PDF fallaba sin conversor; el ejecutor paraba ante el primer fallo. | Formato x.y.z estricto; catálogo mínimo de 2 áreas/4 medidas ES/CA para Fase 2; PDF omitido sin conversor; todas las baterías y resumen. |
| 4. Contexto | Se enviaba principalmente municipio; desarrollar_medida pedía un problema concreto sin datos. | Contexto de proyecto y ficha, campos con valor, instrucción de necesidad sin diagnósticos inventados y control de 4096 tokens. |
| 5. SQLite | Guardado directo, errores solo a consola, lectura fallida sustituida por base vacía; algunas rutas de migración no creaban copia. | Temporal único, fsync y renombrado; cinco copias de arranque; restauración confirmada; aviso visible y propagación del error; copia previa obligatoria al migrar. |
| 6. PDF | Ya se detectaba conversor y se mostraba aviso, pero PDF seguía seleccionable. | Opción PDF deshabilitada, DOCX disponible y botón de LibreOffice con URL exacta permitida. |

## Auditoría de prompts

Revisados aiProvider.js, aiService.js y bilingualTranslator.js. aiService coordina operaciones; bilingualTranslator contiene diccionarios y reglas, no prompts de sistema.

Antes de cambiar se comunicaron estas diferencias: catalán «problemes inexistents» frente a castellano «problemas»; «problemes concrets» frente a «problemas vecinales concretos»; listas de títulos prohibidos distintas. Se igualan. Las directrices adicionales para redactar catalán desde contexto castellano son intencionadas y se conservan. La clasificación estructural usa una instrucción castellana compartida y devuelve etiquetas técnicas JSON, sin traducir el documento.

La candidatura fija del sistema se conserva por la exclusión expresa del punto 7. El contexto incluye los datos guardados que el proyecto aporta; no se reescriben proyectos existentes.

## Persistencia

Las copias de arranque se guardan en userData/backups: para la ruta normal, %APPDATA%/constructor-programas-municipales/backups o la carpeta userData configurada por Electron. Son copias de la base existente validada antes de modificarla; se conservan cinco por archivo. Los guardados sucesivos no crean copias.

Las copias de migración quedan en backups/migrations y no se eliminan por la rotación de arranque. Se crea una instantánea consistente antes de comenzar la secuencia transaccional de cambios, también al inicializar un esquema o corregir user_version. Si falla, no se inicia la migración.

Una base ilegible no se sustituye automáticamente por una vacía. Se busca la copia válida de arranque más reciente, se ofrece restaurarla y se conserva el archivo dañado en backups/recovery antes de reemplazarlo. Cancelar deja el original intacto. Si no hay copia válida, se informa y se impide abrir una base vacía.

## Pruebas ejecutadas

Se ejecutó npm test al terminar los puntos 2, 3, 4, 5 y 6. La verificación final de la 3.6.0 pasa 12/12 baterías; Fase 1 y Fase 2 pasan 14/14 cada una. En este equipo hay LibreOffice y la conversión real pasa. La prueba de pantalla simula tanto presencia como ausencia de conversor en ES/CA.

La prueba del contexto captura los prompts de todas las tareas y prueba el límite mediante un servidor local simulado. No evalúa la calidad de un modelo GGUF concreto ni garantiza que una IA nunca invente: la redacción debe revisarse. El tokenizador del modelo local aplica su plantilla y cuenta la entrada; reserva la salida y 64 tokens. Si excede 4096, no inicia inferencia y devuelve un aviso para reducir texto o prioridades.

SQLite se prueba con fallos inyectados de escritura, fsync y rename, apertura de los archivos resultantes, rotación, cancelación/aceptación de restauración, copia antes de migración 4→5 y fallo de esa copia. Los mensajes «Injected…» de la salida son los fallos intencionados de esta prueba.

El NSIS se verifica por separado con el compilador nativo, primitivas simuladas y una enumeración de registro de solo lectura. No se ejecuta el instalador real.

## Pantallas para probar manualmente

1. **Configuración → Acerca de y actualizaciones**: comprobar versión 3.6.0, autor elftemir y aspecto igual. Configuración → Aplicaciones de Windows debe mostrar una única entrada 3.6.0.
2. **Mis programas / Datos básicos**: abrir un proyecto existente y guardar un cambio pequeño. Cerrar y abrir la aplicación; comprobar que permanece y que aparece una copia de arranque en backups. Tras más arranques deben quedar cinco copias de arranque.
3. **Áreas y medidas → Asistente IA**: probar adaptar y desarrollar en castellano y catalán con un proyecto con ficha y otro con solo municipio. Comprobar que la explicación no afirma problemas, barrios o cifras inexistentes. La calidad depende del modelo local instalado.
4. **Textos del programa**: probar presentación, introducción de área y cierre. Con un texto o listado excesivamente largo debe aparecer el aviso del límite de contexto en lugar de intentar una inferencia que lo exceda.
5. **Generar documentos**: con Word o LibreOffice, probar DOCX y PDF en ambos idiomas. En un equipo sin conversor, PDF debe quedar deshabilitado, DOCX funcionar y el botón de descarga abrir únicamente https://www.libreoffice.org/download/.
6. **Restauración y fallo de guardado**: usar una copia de prueba del perfil, nunca el perfil con proyectos reales. Probar base ilegible con copias válidas y permisos de escritura restringidos; verificar la pregunta de restauración, la cancelación que conserva el original y el aviso visible al fallar el guardado.
7. **Instalador/desinstalador**: repetir las pruebas previamente acordadas de reinstalación, desinstalación conservando/borrando datos y reparación de entrada huérfana. Estas operaciones las realiza el usuario.

Referencias técnicas: [Node fs](https://nodejs.org/api/fs.html), [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [LibreOffice oficial](https://www.libreoffice.org/download/).
