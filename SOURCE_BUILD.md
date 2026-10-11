# Compilación y Construcción desde Código Fuente

Guía técnica para compilar **Constructor de Programas Municipales** a partir de su código fuente en Windows (x64).

---

## 1. Requisitos del Sistema

- **Sistema Operativo**: Windows 10 / Windows 11 (64 bits).
- **Node.js**: Versión 24 o superior, o 22.13.0 como mínimo. Probado con Node 24 y Electron 44.5.1.
- **npm**: Versión 9 o superior.
- **PowerShell**: 5.1 o superior (incluido por defecto en Windows).
- **Herramientas de compilación de C++ (opcional/recomendado)**: En caso de que `@electron/rebuild` requiera compilar módulos nativos (usar Visual Studio Build Tools si hiciera falta).

---

## 2. Obtención de Dependencias

1. Clonar el repositorio fuente:
   ```bash
   git clone https://github.com/elftemir/constructor-programas-municipales.git
   cd constructor-programas-municipales
   ```

2. Instalar las dependencias exactas de Node.js:
   ```bash
   npm ci
   ```

> **Nota sobre contenidos**: El repositorio de código fuente contiene la arquitectura de software completa y las plantillas creadas por el autor. No incluye Programas Marco ni documentos políticos preinstalados; estos se descargan o importan opcionalmente una vez instalada la aplicación a través del gestor de contenidos oficial o del importador universal.

---

## 3. Preparación del AI Runtime Local (llama.cpp)

Para la funcionalidad de asistencia local de redacción, la aplicación integra los binarios de ejecución CPU de `llama.cpp` en `resources/ai-runtime/llama.cpp`.

El proyecto incluye un script automatizado para descargar y descomprimir la versión binaria verificada (b11476 CPU x64):

```bash
node scripts/setup_llama_runtime.js
```

Este comando descarga el paquete oficial de release de `llama.cpp` y ubica `llama-server.exe` junto a sus bibliotecas dinámicas (`.dll`) en la carpeta `resources/ai-runtime/llama.cpp/`.

---

## 4. Ejecución en Modo Desarrollo

Para lanzar y depurar la aplicación en caliente:

1. Compilar los archivos de internacionalización (`locales`):
   ```bash
   node scripts/build_i18n.js
   ```

2. Arrancar Electron:
   ```bash
   npm start
   ```

---

## 5. Compilación del Instalador (Build de Producción)

Para empaquetar la aplicación y generar el instalador ejecutable de Windows:

```bash
npm run build
```

Este comando ejecuta internamente:
1. `node scripts/setup_ocr_runtime.js` (prepara y verifica los recursos OCR locales).
2. `electron-builder --win --x64 --publish never` (empaqueta el runtime de Electron, copia los recursos necesarios y genera el instalador NSIS).

Desde la 3.5.3, compilar no regenera `src/renderer/js/i18n.js`: se empaqueta el archivo existente. Si se cambian expresamente los recursos de idioma, se debe ejecutar `node scripts/build_i18n.js` durante el desarrollo antes de verificar y empaquetar.

### Ubicación de artefactos generados

Al completar la compilación, los archivos generados se ubican en el directorio `dist/`:
- `dist/win-unpacked/`: Aplicación empaquetada ejecutable directamente sin instalar.
- `dist/Programa_Electoral_Municipal_Setup_x64_v<VERSION>.exe`: Instalador ejecutable estándar para Windows.
- `dist/Programa_Electoral_Municipal_Setup_x64_v<VERSION>.exe.blockmap`: Mapa de bloques para soporte de actualización diferencial.
- `dist/latest.yml`: Metadatos de actualización de la aplicación.

## OCR local de la versión 3.5.0

Instalar dependencias exactas con `npm ci` y preparar el OCR con `npm run setup:ocr`. El script descarga spa/cat del commit fijo de tessdata_fast solo durante la preparación; valida SHA-256, verifica el core instalado y genera un manifiesto de integridad. Los avisos, fuentes MPL y licencias están incluidos en `resources/ocr-licenses/`.

El runtime standalone se copia fuera del ASAR mediante `extraResources` y `scripts/pack_ocr_runtime.js`, que comprueba todos los hashes después de empaquetar. Es necesario incluir el hook de empaquetado en el repositorio.

Ejecutar `npm test`; las pruebas PDF se omiten si no hay Word ni LibreOffice, y `node scripts/test_electron_ocr.js`. La aplicación no necesita LibreOffice para reconocer texto; solo lo utilizan las pruebas de exportación y la exportación PDF si no hay Word.

Después de compilar, ejecutar `node scripts/test_packaged_ocr.js` para comprobar el motor dentro del ASAR y los recursos del ejecutable empaquetado. La prueba utiliza un perfil independiente y no instala la aplicación.

Las pruebas generan su propio catálogo sintético y usan perfiles y bases independientes en scratch. El código fuente publicable excluye los Programas Marco y las bases de datos reales. Los documentos escaneados de prueba se generan mediante scripts/generate_ocr_fixtures.js.

Los instaladores y mapas de bloques se publican como assets de GitHub Releases. Subir conjuntamente el EXE con nombre versionado, su blockmap y latest.yml. No sustituir latest.yml por latest.txt o lastest.txt. Mantener las URLs y el repositorio de actualizaciones configurados en package.json.

## Importación conjunta de idiomas (3.5.2)

Funcionamiento validado por el usuario y conservado en la 3.5.4: dos documentos ES/CA pertenecen a un único programa fuente; las medidas se muestran según el idioma seleccionado, sin duplicar fuentes ni medidas. Ver las decisiones permanentes en `DECISIONES.md`.

La ventana de importación acepta un archivo castellano y uno catalán opcionales para una sola fuente. El análisis y el OCR se revisan por idioma; el guardado conjunto usa una transacción. `scripts/test_import_batch.js`, incluido en npm test, verifica creación conjunta, versión única, reversión si las estructuras no coinciden y el flujo de revisión y cancelación. El script de comprobación empaquetada también verifica la creación conjunta dentro del ASAR.

## Preparación local de una publicación

Versión actual: 3.6.1. Ejecutar `npm run preparar-publicacion` después de preparar las dependencias y el runtime de llama.cpp. El comando lee package.json, impide sobrescribir una carpeta de versión existente, ejecuta npm test y npm run build, aplica .gitignore y genera código fuente, instalador y guía. No realiza commits, push ni publicaciones.

El informe comprueba exclusiones, archivos grandes, posibles datos privados, identidad y hashes. Las coincidencias técnicas o de licencias se listan para revisión sin confundirse con credenciales. Si una comprobación falla, el informe empieza por NO PUBLICAR. Las pruebas manuales Windows deben completarse antes de subir.

Usar únicamente los archivos de instalador de la carpeta de publicación recién generada: la compilación puede cambiar las huellas aunque el número de versión sea el mismo. No mezclar sus metadatos con copias de instalable anteriores.
