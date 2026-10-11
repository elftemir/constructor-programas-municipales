# Constructor de Programas Municipales

Aplicación de escritorio para la elaboración, adaptación y gestión de programas municipales a partir de Programas Marco y otras fuentes de referencia.

## Estado del proyecto

Versión actual del código: **3.6.1**.

Disponible para **Windows 10/11 x64**.

## Características principales

- Gestión de Programas fuente.
- Importación de documentos PDF y DOCX.
- Programas Marco en uno o varios idiomas oficiales.
- Adaptación de medidas a programas municipales.
- Gestión de contenidos en Castellano y Català.
- Asistencia mediante inteligencia artificial local.
- Generación de documentos DOCX y PDF.
- Actualización independiente de la aplicación y de los Programas Marco.
- Funcionamiento local: los proyectos y los textos procesados por la IA permanecen en el ordenador del usuario.

## Descargar

El instalador se adjunta en [Releases del repositorio del código](https://github.com/elftemir/constructor-programas-municipales/releases). Descarga el EXE de la versión publicada y, si quieres comprobarlo, su SHA256.txt. No necesitas descargar ni compilar el código para usar el programa.

El actualizador automático utiliza las Releases del [repositorio de actualizaciones](https://github.com/elftemir/constructor-programas-municipales-updates/releases). Ambos destinos deben recibir archivos de la misma compilación.

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
