# Constructor de Programas Municipales

Aplicación de escritorio para la elaboración, adaptación y gestión de programas municipales a partir de Programas Marco y otras fuentes de referencia.

## Estado del proyecto

Versión actual del código: **3.8.1**. Ni la 3.7.0 ni la 3.8.0 se publicaron; sus cambios se incorporan aquí.

Disponible para **Windows 10/11 x64**.

## Características principales

- Gestión de Programas fuente.
- Importación de documentos PDF y DOCX.
- Programas Marco en uno o varios idiomas oficiales.
- Adaptación de medidas a programas municipales.
- Gestión de contenidos en Castellano y Català.
- Asistencia mediante inteligencia artificial local en CPU o GPU Vulkan, con detección, comparación de velocidad y retorno automático al procesador.
- Avisos del motor real de cada texto; las etiquetas no se guardan ni exportan.
- Generación de documentos DOCX y PDF.
- Actualización independiente de la aplicación y de los Programas Marco.
- Funcionamiento local: los proyectos y los textos procesados por la IA permanecen en el ordenador del usuario.
- Instalación limpia: empieza sin Programas Marco, proyectos, lemas ni logos personales. Inicio permite buscar contenidos o importar documentos PDF/DOCX; los datos de instalaciones anteriores se conservan.

## Descargar

El instalador lo distribuye directamente el autor. Para solicitarlo: elftemir@hotmail.com. Este repositorio contiene el código fuente; consulta [SOURCE_BUILD.md](SOURCE_BUILD.md) para compilarlo.

El actualizador automático utiliza las Releases del [repositorio de actualizaciones](https://github.com/elftemir/constructor-programas-municipales-updates/releases).

## Requisitos

- Windows 10 u 11 de 64 bits (x64).
- La exportación DOCX funciona sin Word o LibreOffice; PDF requiere uno de esos conversores instalados. Si falta, la aplicación muestra una explicación y el enlace oficial de LibreOffice.
- La IA es opcional y local; los requisitos de memoria dependen del modelo elegido.

## Código fuente

Este repositorio contiene el código fuente de **Constructor de Programas Municipales**.

Los instaladores y archivos de actualización de la aplicación se distribuyen por separado.

Los Programas Marco y demás contenidos descargables se gestionan también de forma independiente y pueden estar sujetos a sus propias condiciones de uso o licencia.

## Privacidad

Constructor de Programas Municipales está diseñado para trabajar principalmente de forma local.

Los proyectos y los textos procesados por la IA permanecen en el ordenador del usuario.

La aplicación no incorpora telemetría propia ni utiliza los contenidos de los proyectos para entrenar modelos de inteligencia artificial.

Consulta la política completa:

[Política de privacidad](PRIVACY.md)

## Licencia del Software

**Constructor de Programas Municipales** es software libre.

Copyright © 2026 **elftemir**

Este programa puede redistribuirse y/o modificarse bajo los términos de la **GNU General Public License**, publicada por la Free Software Foundation, **versión 3 de la licencia o, a elección del usuario, cualquier versión posterior**.

SPDX-License-Identifier: GPL-3.0-or-later

Consulta el archivo [LICENSE](LICENSE) para ver el texto completo de la GNU General Public License v3.

## Alcance de la Licencia y Derechos de Terceros

- La licencia **GNU GPL v3 o posterior** cubre estrictamente el **código fuente y la arquitectura de software** del proyecto.
- Los **Programas Marco**, textos programáticos, documentos políticos, modelos editoriales, logotipos, emblemas y recursos gráficos de organizaciones políticas o administraciones públicas pueden estar sujetos a derechos de autor, derechos morales o normativas de propiedad industrial/marcas independientes de este software. La licencia GPL del código fuente no otorga derechos sobre marcas registradas, identidades corporativas ni contenidos políticos de terceros.

## Autor y Contacto

- **Autor**: elftemir
- **Contacto**: elftemir@hotmail.com

## Desarrollo y colaboración

Consulta [CONTRIBUTING.md](CONTRIBUTING.md), [SOURCE_BUILD.md](SOURCE_BUILD.md) y [CHANGELOG.md](CHANGELOG.md). Para preparar una carpeta local de publicación: `npm run preparar-publicacion`. Este comando no sube nada a GitHub.

## Modelos de redacción local

Qwen 2.5 1.5B (Apache-2.0) sigue recomendado por defecto por su menor consumo de memoria. Qwen3 4B Instruct 2507 (Apache-2.0, sin pensamiento) ofrece mayor calidad y está recomendado para 8 GB de RAM o GPU. Su GGUF Q4_K_M procede de Unsloth: no se encontró un GGUF oficial accesible públicamente; revisión y SHA-256 fijados en `data/ai_models.json`. Los modelos se descargan solo por petición del usuario y nunca se incluyen en el instalador.
