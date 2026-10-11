# Historial de cambios

Este historial se reconstruye a partir de la conversación y los informes locales. La última versión publicada indicada por el mantenedor es la 3.3.0. No se atribuyen cambios a versiones intermedias sin información comprobable.

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
