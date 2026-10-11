const path = require('path');
const SOURCE_REPO = 'https://github.com/elftemir/constructor-programas-municipales';
const UPDATES_REPO = 'https://github.com/elftemir/constructor-programas-municipales-updates';
const PUBLICATIONS = '10_Constructor Carpetas GIHUB';
const psQuote = value => '"' + value.replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '`"') + '"';
function guide(root, version, exe) {
  const publication = path.join(root, PUBLICATIONS, 'V' + version);
  const repo = path.join(root, PUBLICATIONS, 'repositorio-github');
  const source = path.join(publication, 'codigo-fuente');
  return `GUÍA PARA SUBIR LA VERSIÓN ${version} A GITHUB

Esta carpeta solo prepara los archivos. La subida la haces tú.
Publicación preparada: ${publication}
Código: ${SOURCE_REPO} (main)
Actualizaciones: ${UPDATES_REPO}

A) ANTES DE EMPEZAR

1. Abre INFORME_PUBLICACION.txt. Si empieza por NO PUBLICAR, para y corrige el motivo antes de subir.
2. Revisa las coincidencias del análisis de privacidad. Las palabras técnicas y correos de licencias no son por sí mismos contraseñas; confirma que no hay datos privados.
3. Haber realizado las pruebas Windows del EXE de ESTA carpeta:
   - Instalación limpia: una entrada ${version} en Aplicaciones y acceso del escritorio.
   - Reinstalar encima: una entrada, acceso válido y proyectos conservados.
   - Desinstalar respondiendo No: programa y entrada desaparecen; datos conservados.
   - Desinstalar respondiendo Sí: retirar también datos y accesos del usuario.
   - Entrada huérfana: en una instalación de prueba, retirar su desinstalador y reinstalar; debe reparar sin duplicar entradas.
4. El CONTENIDO de codigo-fuente va a la raíz del repositorio del código. No subas la carpeta V${version} completa ni los informes a ese repositorio.
5. El instalador NO se mete en el código: se adjunta a las Releases. Usa solo el EXE, blockmap y latest.yml de instalador de ESTA carpeta, sin mezclarlos con otra compilación.

B) PASO 1: SUBIR EL CÓDIGO CON GITHUB DESKTOP (RECOMENDADO)

1. Instala GitHub Desktop desde https://desktop.github.com/ e inicia sesión con la cuenta elftemir.
2. SOLO LA PRIMERA VEZ: File → Clone repository → URL. Escribe ${SOURCE_REPO} y configura esta carpeta local exacta:
   ${repo}
   Pulsa Clone. No clones dentro de codigo-fuente ni dentro de otra carpeta .git.
3. LAS SIGUIENTES VECES: abre ese repositorio en Desktop, selecciona main y pulsa Fetch origin. Si aparece Pull origin, púlsalo y espera.
4. Antes de sustituir archivos, confirma que no tienes cambios propios sin guardar en ese clon. Si los hay, para y consérvalos antes de continuar.
5. En el Explorador abre repositorio-github. En Windows 11: Ver → Mostrar → Elementos ocultos. En Windows 10: pestaña Vista → Elementos ocultos.
6. Comprueba que estás en la carpeta exacta anterior y que contiene .git. Borra todo su contenido EXCEPTO la carpeta oculta .git. No borres la carpeta raíz ni .git.
7. Abre ${source}, selecciona TODO su contenido (incluidos .gitignore y .github) y cópialo dentro de repositorio-github. Copia los archivos interiores; no una carpeta llamada codigo-fuente.
8. Vuelve a Desktop y revisa todos los cambios: verde = nuevo, amarillo = modificado, rojo = borrado. Los borrados son necesarios para retirar archivos antiguos que ya no deben estar en el repositorio. No debe aparecer ningún instalador, dist ni node_modules.
9. Escribe en Summary: Versión ${version}. Pulsa Commit to main y después Push origin. Hasta Push origin los cambios siguen solo en tu ordenador.

ALTERNATIVA CON POWERSHELL (solo si prefieres comandos)

Primera vez:
git clone --branch main ${SOURCE_REPO}.git ${psQuote(repo)}

Cada vez, incluido después del primer clone:
Set-Location -LiteralPath ${psQuote(repo)}
git switch main
git status
git pull --ff-only origin main

Si hay un error o cambios propios sin guardar, PARA. No continúes con el borrado.
Después de comprobarlo, este bloque verifica la ruta antes de sustituir archivos:

$taskRepoExpected = [IO.Path]::GetFullPath(${psQuote(repo)})
$taskRepo = (Resolve-Path -LiteralPath $taskRepoExpected).Path
$taskSource = (Resolve-Path -LiteralPath ${psQuote(source)}).Path
if (![String]::Equals($taskRepo, $taskRepoExpected, [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta del clon inesperada' }
if (!(Test-Path -LiteralPath (Join-Path $taskRepo '.git') -PathType Container)) { throw 'Falta .git: no se borra nada' }
$taskGitStatus = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo comprobar el estado Git' }
if ($taskGitStatus.Count -gt 0) { throw 'Hay cambios locales: conservarlos antes de sustituir archivos' }
$taskItems = @(Get-ChildItem -LiteralPath $taskRepo -Force | Where-Object { $_.Name -ne '.git' })
foreach ($taskItem in $taskItems) {
  $taskTarget = [IO.Path]::GetFullPath($taskItem.FullName)
  if (!$taskTarget.StartsWith($taskRepo + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Destino fuera del clon' }
  if ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Hay un enlace o junction: revisarlo manualmente' }
}
foreach ($taskItem in $taskItems) { Remove-Item -LiteralPath $taskItem.FullName -Recurse -Force }
Get-ChildItem -LiteralPath $taskSource -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $taskRepo -Recurse -Force }
git add -A
git status

Revisa la lista de git status antes de estos dos comandos:
git commit -m "Versión ${version}"
git push origin main

C) PASO 2: RELEASE EN EL REPOSITORIO DEL CÓDIGO

1. Abre ${SOURCE_REPO}/releases.
2. Pulsa Draft a new release (o Create a new release si aún no hay ninguna).
3. En Choose a tag escribe v${version} y elige crear esa etiqueta sobre main. Si la etiqueta ya existe, para y revisa qué se publicó; no la reemplaces.
4. Título: Constructor de Programas Municipales ${version}.
5. Abre NOTAS_VERSION.md, copia su contenido y pégalo en las notas.
6. Arrastra desde instalador estos DOS archivos:
   ${exe}
   SHA256.txt
7. Marca Set as the latest release. No marques pre-release.
8. Pulsa Publish release. La carpeta de código y los informes no se adjuntan como instalador.

D) PASO 3: RELEASE EN EL REPOSITORIO DE ACTUALIZACIONES

1. Abre ${UPDATES_REPO}/releases.
2. Pulsa Draft a new release. Crea la etiqueta v${version} en ese repositorio; es independiente de la etiqueta del código.
3. Mismo título: Constructor de Programas Municipales ${version}. Pega las mismas NOTAS_VERSION.md.
4. Adjunta LOS TRES archivos, todos de instalador de ESTA carpeta:
   ${exe}
   ${exe}.blockmap
   latest.yml
5. NO marques pre-release. Marca Set as the latest release si aparece.
6. Pulsa Publish release. No lo dejes en borrador: el actualizador necesita una Release publicada con sus tres archivos.

E) COMPROBAR QUE HA SALIDO BIEN

1. Código: main muestra el último commit Versión ${version}; la Release v${version} tiene el EXE y SHA256.txt. Dentro del árbol del código no aparecen node_modules, dist ni EXE.
2. Actualizaciones: Release v${version} publicada, no borrador ni pre-release, con EXE, blockmap y latest.yml.
3. Descarga el EXE publicado y comprueba su huella con Get-FileHash; debe coincidir con SHA256.txt y NOTAS_VERSION.md.
4. Opcional: en un equipo de prueba con una versión anterior, abrir Configuración → Comprobar actualizaciones y comprobar que ofrece ${version}.

F) SI ALGO FALLA

- Pide usuario o contraseña: usa el inicio de sesión de GitHub Desktop o el gestor de credenciales de Git. GitHub no admite la contraseña normal de la cuenta para Git por HTTPS. No pegues credenciales en incidencias ni en archivos del proyecto.
- rejected o non-fast-forward: puede haber cambios nuevos en GitHub. Fetch/Pull en Desktop o git pull --ff-only. Si hay conflictos o el pull falla, para y pide ayuda; no borres cambios para ocultar el problema.
- Archivo demasiado grande: no debe ir un EXE, modelo o compilación dentro del código. Usa las Releases para el instalador. Si ya se añadió a un commit local, no sigas intentando subirlo sin corregir ese commit.
- Error al clonar: revisa cuenta, URL y que la carpeta del clon no contenga otro repositorio.
- Si publicaste un instalador defectuoso, no borres la Release para sustituirlo silenciosamente. Corrige el proyecto y publica una versión nueva con número mayor.
- NUNCA uses git push --force. Si no entiendes un error, para y pide ayuda.

REFERENCIAS
https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop
https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository
https://docs.github.com/en/get-started/git-basics/about-remote-repositories
`;
}
module.exports = { guide, PUBLICATIONS, SOURCE_REPO, UPDATES_REPO };
