# Avisos de Licencias de Terceros / Third-Party Notices

Este proyecto (**Constructor de Programas Municipales**) se distribuye bajo la licencia **GNU General Public License v3.0 o posterior (GPL-3.0-or-later)**.

A continuación se relacionan las dependencias, bibliotecas y componentes de terceros utilizados directamente por la aplicación, junto con sus respectivas licencias y avisos correspondientes:

---

## 1. Dependencias Directas de Ejecución (Runtime)

### @fontsource/inter
- **Versión**: 5.3.0
- **Licencia**: SIL Open Font License 1.1 (OFL-1.1)
- **Uso**: Tipografía Inter integrada localmente para la interfaz gráfica.
- **Aviso**: Tipografía distribuida bajo los términos de la SIL Open Font License v1.1. Compatible con la distribución conjunta con aplicaciones GPL.

### @xmldom/xmldom
- **Versión**: 0.9.12
- **Licencia**: MIT License
- **Uso**: Procesamiento y manipulación del árbol XML de documentos DOCX.
- **Aviso**: Copyright (c) 2019-2023 @xmldom team.

### electron-updater
- **Versión**: 6.8.9
- **Licencia**: MIT License
- **Uso**: Comprobación, descarga y aplicación de actualizaciones oficiales de la aplicación desde GitHub Releases.
- **Aviso**: Copyright (c) 2015-present Electron-Builder authors.

### jszip
- **Versión**: 3.10.2
- **Licencia**: MIT License / GPL-3.0-or-later (Dual License)
- **Uso**: Lectura, verificación y empaquetado de archivos comprimidos ZIP (paquetes de actualización de contenidos y estructura DOCX).
- **Aviso**: Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso.

### pdf-parse
- **Versión**: 1.1.1
- **Licencia**: MIT License
- **Uso**: Extracción y análisis de texto de documentos fuente en formato PDF para el importador universal.
- **Aviso**: Copyright (c) Mehdi Baaboura.

### sql.js
- **Versión**: 1.14.2
- **Licencia**: MIT License
- **Uso**: Motor de base de datos SQLite embebido en WebAssembly / Node.js.
- **Aviso**: Copyright (c) 2021 sql.js authors.

---

## 2. Dependencias de Desarrollo y Empaquetado

### electron
- **Versión**: 44.5.1
- **Licencia**: MIT License
- **Uso**: Framework para ejecución de aplicaciones de escritorio multiplataforma basadas en Chromium y Node.js.
- **Aviso**: Copyright (c) Electron contributors.

### electron-builder
- **Versión**: 26.15.3
- **Licencia**: MIT License
- **Uso**: Generación y firma del instalador ejecutable de Windows (NSIS).
- **Aviso**: Copyright (c) 2015-present Electron-Builder authors.

---

## 3. Componentes Binarios Externos

### llama.cpp (AI Runtime)
- **Versión**: Release b11476 (CPU x64)
- **Licencia**: MIT License
- **Uso**: Servidor local de inferencia de modelos de lenguaje (LLM) en formato GGUF (`llama-server.exe` y librerías dinámicas `ggml`).
- **Aviso**: Copyright (c) 2023-2024 Georgi Gerganov y contribuidores de llama.cpp.

### LLVM OpenMP (libomp.dll)
- **Licencia**: Apache-2.0 WITH LLVM-exception
- **Uso**: Biblioteca de paralelismo OpenMP incluida junto a los binarios de `llama.cpp`.
- **Aviso**: Copyright (c) 2003-2019 LLVM Release Team. Texto de licencia conservado en `resources/ai-runtime/llama.cpp/LICENSE-LLVM-OpenMP`.

---

## 4. Datos y Recursos

- **Datos de Municipios (INE / Cataluña)**: Derivados de datos abiertos del Instituto Nacional de Estadística (INE) e Institut d'Estadística de Catalunya (Idescat), utilizados bajo condiciones de reutilización de la información del sector público.

## OCR local incorporado en 3.5.0

Tesseract.js y tesseract.js-core 7.0.0: Apache-2.0; PDF.js (pdfjs-dist) 6.4.299: Apache-2.0; @napi-rs/canvas 1.0.11 y binario Windows x64: MIT. Datos spa y cat de tessdata_fast, commit 87416418657359cb625c412a48b6e1d6d41c29bd: Apache-2.0.

Dependencias transitivas empaquetadas:

- tesseract.js 7.0.0: Apache-2.0
- bmp-js 0.1.0: MIT
- idb-keyval 6.3.0: Apache-2.0
- is-url 1.2.4: MIT
- node-fetch 2.7.0: MIT
- whatwg-url 5.0.0: MIT
- tr46 0.0.3: MIT
- webidl-conversions 3.0.1: BSD-2-Clause
- opencollective-postinstall 2.0.3: MIT
- regenerator-runtime 0.13.11: MIT
- tesseract.js-core 7.0.0: Apache-2.0
- wasm-feature-detect 1.9.0: Apache-2.0
- zlibjs 0.3.1: MIT
- pdfjs-dist 6.4.299: Apache-2.0
- @napi-rs/canvas 1.0.11: MIT
- @napi-rs/canvas-win32-x64-msvc 1.0.11: MIT

El binario de canvas incorpora bibliotecas adicionales, incluidas componentes con MPL-2.0, BSD, FTL, ICU y Zlib. Se distribuye su SBOM original en ocr-runtime/node_modules/@napi-rs/canvas-win32-x64-msvc/sbom.cdx.json y los avisos y fuentes correspondientes en ocr-runtime/licenses/. No se incorpora un motor OCR AGPL.
