# Cómo contribuir

El proyecto se desarrolla y distribuye para Windows 10/11 x64. Para preparar el entorno se recomienda Node.js 24 y npm; el lockfile fija las dependencias.

## Preparar y ejecutar

```powershell
npm ci
node scripts/setup_llama_runtime.js
npm run setup:ocr
node scripts/build_i18n.js
npm start
```

Los recursos de IA y OCR se descargan al preparar el entorno. No se incluyen modelos GGUF, bases de datos de usuarios ni Programas Marco privados en el repositorio fuente. Los contenidos oficiales se descargan o se importan desde la aplicación.

## Verificar cambios

```powershell
npm test
npm run build
node scripts/test_packaged_ocr.js
node scripts/test_nsis_initialization.js
node scripts/test_nsis_shortcuts.js
```

Las pruebas usan perfiles y bases aisladas en scratch. Los tests de conversión PDF se omiten cuando no hay Word ni LibreOffice. Las comprobaciones NSIS requieren el compilador descargado por electron-builder durante la compilación.

Revisar manualmente las pantallas afectadas en castellano y catalán. Las pruebas del instalador deben realizarse con datos de prueba y cubrir instalación limpia, reinstalación, actualización, acceso del escritorio y desinstalación conservando o borrando datos.

## Proponer un cambio

1. Abrir una incidencia con la plantilla adecuada y explicar el problema o la mejora.
2. Crear una rama para el cambio y mantenerlo centrado en esa incidencia.
3. Ejecutar las pruebas y describir los resultados en la propuesta de incorporación (pull request).
4. Actualizar la documentación cuando cambie el comportamiento.

No adjuntar proyectos reales, contraseñas ni datos personales. Los ejemplos de importación deben ser sintéticos o estar autorizados para compartirlos.

## Reglas que deben conservarse

- Respetar [los requisitos del instalador](docs/REQUISITOS_INSTALADOR.md): identidad, editor, destino y protección de datos.
- Mantener un único programa fuente con versiones ES/CA separadas, sin duplicar medidas.
- No introducir OCR simulado ni texto de relleno presentado como extracción.
- La IA propone; el usuario revisa y acepta.
- Las bases y perfiles reales no se utilizan para las pruebas automatizadas.

## Preparar una publicación local

```powershell
npm run preparar-publicacion
```

El comando comprueba pruebas y compilación, copia una raíz de repositorio limpia y prepara instalador, metadatos, informe y guía en una carpeta nueva por versión. Nunca sobrescribe una carpeta existente ni sube archivos a GitHub. Antes de publicar hay que leer el informe y completar las pruebas manuales indicadas en la guía.
