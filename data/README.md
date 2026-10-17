# Datos incluidos en el código fuente

## Municipios de Cataluña

`municipios_ine.csv` y `municipios_catalunya.json` contienen **947 municipios de Cataluña**. No son una muestra de desarrollo. La fuente declarada en las filas es **Idescat / INE** y el campo `ano_poblacion` contiene **2025** en los 947 registros de ambos archivos. Este año describe la población guardada, no una actualización automática de los datos.

El CSV está codificado en UTF-8, utiliza punto y coma como separador y comillas para los valores que lo necesitan. Sus columnas son:

| Campo | Contenido |
|---|---|
| `codigo_ine` | Código del municipio de cinco dígitos; tratarlo como texto para conservar ceros iniciales. |
| `nombre` | Nombre del municipio. |
| `provincia` | Provincia. |
| `comunidad_autonoma` | Cataluña. |
| `poblacion` | Número de habitantes guardado. |
| `fuente_poblacion` | Fuente declarada: Idescat / INE. |
| `ano_poblacion` | Año de referencia de la población: 2025. |
| `codigos_postales` | Códigos postales como texto; en CSV, separados por comas dentro del valor. |

El JSON es una lista con esos mismos campos y añade `codigo_completo`, el código ampliado de seis dígitos. `codigos_postales` es una lista de cadenas en JSON.

Las copias de los municipios bajo `src/main/assets/data/` permiten cargar los datos en la aplicación empaquetada. Al actualizar el conjunto, comprobar también su coherencia con las copias de recursos; no completar municipios o cifras inventados.

## Catálogo de modelos de IA descargables

`ai_models.json` describe los modelos opcionales que se descargan desde Hugging Face: identificador, nombre, repositorio (`repoId`), archivo GGUF, cuantización, tamaño, SHA-256, memoria recomendada y licencia con su enlace cuando está documentada. Consultar también la sección de modelos descargables de `THIRD_PARTY_NOTICES.md`.

Los archivos de los modelos no forman parte del repositorio ni del instalador. Se descargan cuando el usuario los solicita desde la pantalla de IA. El catálogo no contiene los datos ni los proyectos del usuario.
