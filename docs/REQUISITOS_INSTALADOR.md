# Requisitos permanentes del instalador

- appId: org.podemos.constructor.municipal.
- productName y accesos: Constructor de Programas Municipales Podemos.
- author.name: elftemir. No establecer win.publisherName; instalador sin firma.
- Copyright existente: Copyright © 2026 elftemir; consultar antes de cambiarlo.
- nsis.perMachine: true; allowToChangeInstallationDirectory: false. Destino fijo en Program Files.
- Crear el acceso directo del escritorio publico al instalar, reinstalar o actualizar. createDesktopShortcut: "always" y recreacion nativa desde customInstall; no borrar accesos en customUnInstall durante una actualizacion.
- Conservar build/installer.nsh validado en 3.5.6: limpiar entradas huérfanas de HKLM/HKCU en ambas vistas, terminar EnumRegKey al devolver cadena vacía, migrar instalaciones válidas mediante electron-builder y registrar etapas.
- Desinstalación completa de programa, registro y accesos. Borrar datos solo con respuesta afirmativa explícita; al actualizar no preguntar ni borrarlos.
- DisplayVersion procede de package.json. Mantener GUID d88b1329-31ed-5768-a1d9-d8e0626bf064.
- Codex nunca modifica la instalación real de Program Files ni ejecuta el instalador o desinstalador real. Las pruebas sobre ella las realiza el usuario.
- Entregar EXE, blockmap, latest.yml, hashes, archivos de versión y fuentes en instalable. No modificar el repositorio de contenidos ni la descarga de Programas Marco.
