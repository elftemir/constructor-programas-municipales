# Compilación y Construcción desde Código Fuente

Guía técnica para compilar **Constructor de Programas Municipales** a partir de su código fuente en Windows (x64).

---

## 1. Requisitos del Sistema

- **Sistema Operativo**: Windows 10 / Windows 11 (64 bits).
- **Node.js**: Versión 18 o superior (recomendado Node.js 20 LTS o 22 LTS).
- **npm**: Versión 9 o superior.
- **PowerShell**: 5.1 o superior (incluido por defecto en Windows).
- **Herramientas de compilación de C++ (opcional/recomendado)**: En caso de que `@electron/rebuild` requiera compilar módulos nativos (habitualmente satisfecho por Node.js con `windows-build-tools` o Visual Studio Build Tools).

---

## 2. Obtención de Dependencias

1. Clonar el repositorio fuente:
   ```bash
   git clone https://github.com/elftemir/constructor-programas-municipales.git
   cd constructor-programas-municipales
   ```

2. Instalar las dependencias exactas de Node.js:
   ```bash
   npm install
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
1. `node scripts/build_i18n.js` (empaqueta los recursos de idioma en `src/renderer/js/i18n.js`).
2. `electron-builder --win --x64 --publish never` (empaqueta el runtime de Electron, copia los recursos necesarios y genera el instalador NSIS).

### Ubicación de artefactos generados

Al completar la compilación, los archivos generados se ubican en el directorio `dist/`:
- `dist/win-unpacked/`: Aplicación empaquetada ejecutable directamente sin instalar.
- `dist/Programa_Electoral_Municipal_Setup_x64_v<VERSION>.exe`: Instalador ejecutable estándar para Windows.
- `dist/Programa_Electoral_Municipal_Setup_x64_v<VERSION>.exe.blockmap`: Mapa de bloques para soporte de actualización diferencial.
- `dist/latest.yml`: Metadatos de actualización de la aplicación.
