function cleanInstallGuide(version, exe) {
  return String.raw`PRUEBA DE INSTALACIÓN LIMPIA — ${version}

Objetivo: probar el instalador ${exe} con un perfil vacío y conservar tus datos.
Codex no ejecuta el instalador ni modifica tus carpetas personales. Estas pruebas las haces tú.

OPCIÓN 1 — RECOMENDADA: ESPACIO AISLADO DE WINDOWS

Disponible en Windows 10/11 Pro, Enterprise y Education; no en Home. Si tienes Home, utiliza la opción 2.
1. Guarda tu trabajo. Busca «Activar o desactivar las características de Windows» en Inicio.
2. Marca «Espacio aislado de Windows» (Windows Sandbox), acepta y reinicia si Windows lo pide.
   Si la función no aparece o no se puede activar, puede faltar virtualización en el equipo; utiliza la opción 2.
3. Abre «Espacio aislado de Windows» desde Inicio. Verás un escritorio de Windows temporal.
4. En tu Windows normal, copia SOLO ${exe} de la carpeta instalador (Ctrl+C).
5. Pégalo en el escritorio del espacio aislado (Ctrl+V). No copies tus carpetas de proyectos ni configures carpetas compartidas con ellas.
6. Dentro del espacio aislado, ejecuta ese EXE, acepta el permiso e instala.
7. Haz las comprobaciones de más abajo. Program Files y AppData serán los del espacio aislado.
8. Word o LibreOffice del ordenador principal no están disponibles dentro: instala allí un conversor si quieres probar PDF.
   Si no hay conversor, prueba Word (.docx) y comprueba que PDF explica por qué no puede generarse.
9. Guarda fuera únicamente los documentos de prueba que quieras conservar. Cierra el espacio aislado al terminar.
   Al cerrarlo se descarta todo lo instalado o creado dentro. Tus proyectos del ordenador principal siguen intactos.

OPCIÓN 2 — PERFIL TEMPORAL EN TU WINDOWS, CON COPIA PREVIA

Esta opción sustituye la aplicación instalada por ${version}; protege los datos apartando sus carpetas.
Si una carpeta de las siguientes no existe, anótalo y sáltala. No crees datos de ejemplo dentro de una carpeta real.

PREPARAR Y APARTAR TUS DATOS
1. Cierra el Constructor por completo. Si sigue en la bandeja, sal también desde ella. En Administrador de tareas confirma que su proceso ha terminado.
2. Crea una carpeta «Copia Constructor antes de prueba ${version}» en un lugar seguro, preferiblemente otro disco.
3. Pulsa Win+R, escribe %APPDATA% y acepta. Copia ENTERAS a esa copia de seguridad las carpetas:
   - Constructor de Programas Municipales Podemos
   - constructor-programas-municipales (si existe; datos de versiones anteriores)
   Guárdalas dentro de una subcarpeta «Roaming». No basta con copiar solo la base de datos: incluye logos, configuración y copias.
4. Pulsa Win+R, escribe %LOCALAPPDATA% y acepta. Copia a «Local» de tu copia de seguridad:
   - Constructor de Programas Municipales Podemos (modelos y datos locales)
   - constructor-programas-municipales-updater (si existe)
5. Comprueba que la copia contiene los archivos y ocupa un tamaño similar al original.
   Conserva también tus documentos exportados y cualquier logo guardado fuera de estas carpetas. No se borran durante la prueba.
6. Vuelve a %APPDATA% y renombra las carpetas originales existentes añadiendo «.ANTES_PRUEBA_${version}» al final.
7. En %LOCALAPPDATA% haz lo mismo con las dos carpetas indicadas. Si ese nombre ya existe, añade la fecha/hora y ANOTA el nombre exacto.
   Renombra las carpetas; no borres nada y no mezcles la copia con otras carpetas de igual nombre.
8. Ejecuta ${exe} e instala encima de la aplicación anterior. No ejecutes una desinstalación con borrado de datos.
9. Abre el Constructor. Al no encontrar las carpetas habituales, creará datos nuevos y vacíos. Haz las comprobaciones de abajo.
   Si aparecen tus programas antiguos, para: alguna carpeta no se apartó. Cierra la aplicación y restaura siguiendo los pasos siguientes.

RESTAURAR EXACTAMENTE TUS DATOS
1. Cierra el Constructor por completo y verifica en Administrador de tareas que ha terminado.
2. En %APPDATA%, aparta las carpetas NUEVAS de la prueba renombrándolas con «.SOLO_PRUEBA_${version}» (o un nombre único).
   Haz lo mismo en %LOCALAPPDATA%. Así conservas la prueba por separado y queda libre el nombre original.
3. Renombra cada carpeta «.ANTES_PRUEBA_${version}» al nombre exacto que tenía antes:
   %APPDATA%\Constructor de Programas Municipales Podemos
   %APPDATA%\constructor-programas-municipales (solo si existía)
   %LOCALAPPDATA%\Constructor de Programas Municipales Podemos
   %LOCALAPPDATA%\constructor-programas-municipales-updater (solo si existía)
4. Si falta una carpeta apartada, copia su carpeta ENTERA desde la copia de seguridad al lugar correspondiente, sin sobrescribir una carpeta existente.
   Roaming corresponde a %APPDATA%; Local corresponde a %LOCALAPPDATA%. Nunca juntes una base antigua con los datos nuevos de prueba.
5. Abre el Constructor ${version} y confirma que vuelven tus proyectos, fuentes, logos y lemas originales.
6. Mantén la copia de seguridad hasta verificarlo todo. No desinstales respondiendo «Sí, borrar datos» después de restaurarlos.
   Las carpetas SOLO_PRUEBA contienen únicamente la prueba; puedes conservarlas apartadas.

QUÉ COMPROBAR EN EL PERFIL VACÍO

1. Al abrir con perfil vacío, la base comienza sin fuentes ni proyectos. Inicio intenta descargar automáticamente el Marco oficial compatible más reciente.
   Mientras descarga aparece el progreso en castellano o catalán. Si no hay internet o ningún Marco oficial, aparece:
   «Todavía no tienes ningún Programa Marco. Comprueba tu conexión o importa un documento (PDF o DOCX)».
   En catalán debe aparecer el mensaje equivalente. Los botones Reintentar e Importar documento funcionan.
2. Programas fuente y Mis programas: no hay fuentes ni proyectos. No hay datos, lemas, logos ni textos precargados de Sant Andreu de la Barca o Pallejà.
   Estos municipios sí pueden aparecer en el buscador de municipios, que conserva los 947 municipios reales; eso no es un proyecto precargado.
3. Crear programa / Datos básicos: sin fuente debe llevar al inicio guiado. IA, Configuración, Ayuda y Acerca de abren sin errores.
4. Si existe un Marco oficial compatible, comprueba que se descarga solo y queda ACTIVO. No debe aparecer ninguna fuente política fija precargada.
   Si el catálogo solo tiene paquetes de prueba, no se descarga nada automáticamente y Actualizaciones dice «No hay contenidos oficiales nuevos».
   No aparece «Mostrar contenidos de prueba» en el instalador distribuido. Ninguna vía de producción permite instalar el ejemplo.
   Si no hay un Marco oficial en el catálogo, el mensaje debe ser «Todavía no hay un Programa Marco oficial disponible.» (y su equivalente catalán).
   Si no hay Marco oficial o conexión, también puedes importar PDF/DOCX propios de prueba.
   Si ya habías guardado fuentes o proyectos antes de actualizar, se conservan; para comprobar el arranque vacío utiliza este entorno aislado.
5. Crea un proyecto de prueba y selecciona su fuente. Partido predeterminado: Podemos. Mandato: 2027–2031.
   Introduce un municipio de prueba y escribe lema ES «Juntos mejoramos» y lema CA «Junts millorem».
6. Incluye al menos una medida. Cambia entre castellano y catalán: un solo programa y una sola medida con textos de cada idioma, sin duplicados.
7. Generar documentos: exporta Word en ES y en CA (o ambos, dos archivos). Comprueba el lema correspondiente en cada portada.
   Repite con PDF si Word o LibreOffice está instalado en el entorno de prueba. Abre los archivos y comprueba páginas, texto y lemas.
8. Borra los campos de portada en el proyecto de prueba y exporta: no deben aparecer textos de Sant Andreu de la Barca ni Pallejà.
9. Acerca de: versión ${version}, autor elftemir. Escritorio: aparece el acceso directo.
10. Configuración → Aplicaciones: una sola entrada del Constructor con versión ${version}.
    En el entorno de prueba, la aplicación está en C:\Program Files\Constructor de Programas Municipales Podemos.
11. Cierra y abre otra vez: el contenido y proyecto de prueba se conservan. Después restaura tus datos o cierra Windows Sandbox.
12. La limpieza de datos antiguos está probada automáticamente con una base sintética: esquema 7, copia previa, ejemplo retirado y proyecto completo. No prepares esta prueba borrando datos reales.

Documentación oficial de Microsoft:
https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/
https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install
`;
}
module.exports = { cleanInstallGuide };
