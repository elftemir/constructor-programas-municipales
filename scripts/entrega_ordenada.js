// Local delivery only. No Git, uploads, installer execution or real-profile operations.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),JSZip=require('jszip');
const {listPublicFiles,installerChecks}=require('./preparar_publicacion');
const {publicAudit,finalAudit,sha}=require('./auditar_entrega');
const PUBLICATIONS=require('./publicacion_guia').PUBLICATIONS;
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
function requireApproval(file){
 if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').trimEnd().split(/\r?\n/).at(-1)!=='LISTO PARA REVISIÓN')throw Error('Informe final no aprobado: NO PUBLICAR');
}
function inside(file,base){const relative=path.relative(path.resolve(base),path.resolve(file));if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Destination must be inside the selected workspace');}
function guide(version,exe){return `GUÍA DE SUBIDA ${version} — LA SUBIDA LA HACES TÚ

A. CONTENIDOS
1. GitHub Desktop: selecciona constructor-programas-municipales-content. Comprueba el nombre arriba. Repository → Show in Explorer.
2. En la raíz reemplaza catalog.json por el de 3_contenidos y copia el ZIP de esa carpeta. No copies toda la carpeta.
3. Commit «Programa Marco provisional 2027-2031 v1.0.0» → Push origin. Debe volver a Fetch origin.
4. Web del MISMO repositorio -content: Releases → Draft a new release. Etiqueta programa-marco-2027-2031-v1.0.0; título «Programa Marco 2027–2031 (versión provisional) v1.0.0»; adjunta el ZIP y publica la release estable.
   Es obligatorio: catalog.json descarga desde Releases; copiar el ZIP a la raíz no crea esa URL.
5. Abre el download_url del catálogo y comprueba que descarga el ZIP. El catálogo completo sustituye al anterior y ya no ofrece el ejemplo.

B. CÓDIGO FUENTE
1. GitHub Desktop: elige constructor-programas-municipales, SIN -updates. Comprueba arriba el nombre y Repository → Show in Explorer.
2. Explorador: Ver → Mostrar → Elementos ocultos. Conserva la carpeta .git; borra los demás archivos SOLO en tu clon local de ese repositorio. Haz primero una copia si hay trabajo propio sin guardar.
3. Pega el CONTENIDO de 1_codigo-fuente, incluidos .github y .gitignore, no la carpeta exterior.
4. GitHub Desktop: revisa Changes, escribe «Versión ${version}», pulsa Commit to main y Push origin. El botón debe volver a Fetch origin.
5. History → clic derecho en ese commit → Create Tag → v${version} → Create Tag → Push origin.
6. Si falta v3.6.1 en GitHub, localiza en History el commit de 3.6.1 (busca su mensaje y comprueba package.json en ese commit). Clic derecho → Create Tag → v3.6.1 → Push origin. Si no puedes identificarlo con certeza, no lo etiquetes sobre otro commit.
7. NO crees v3.7.0: esa versión no se publicó. NO pegues instaladores, contenidos, informes de esta entrega ni _anteriores en el repositorio de código.

C. ACTUALIZACIONES
1. Web: elftemir/constructor-programas-municipales-updates → Releases → Draft a new release.
2. Choose a tag → v${version} (Create new tag on publish si falta). Título «Versión ${version}».
3. Abre 2_release-actualizaciones/NOTAS_RELEASE_${version}.md y pega su texto en la descripción.
4. Adjunta SOLO ${exe}, ${exe}.blockmap y latest.yml. Espera a que terminen las tres cargas. El MD se pega, no se adjunta.
5. No marques pre-release. Revisa y pulsa Publish release.

D. COMPROBACIÓN MANUAL
1. En un entorno aislado con 3.6.1: Configuración → Comprobar actualizaciones debe ofrecer ${version}. Instálala allí y verifica que conserva proyectos.
2. Instalación limpia de ${version}: no hay Programas Marco instalados; Inicio ofrece el provisional tras publicar A. Solo se descarga al pulsar el botón y queda activo con dos áreas y cuatro medidas.
3. Si A no se ha publicado todavía, es correcto ver el aviso de que no hay Programa Marco oficial disponible; el ejemplo nunca debe aparecer.
4. Sigue PRUEBA_INSTALACION_LIMPIA_${version}.txt de la carpeta instalable. Este proceso no ha realizado ninguna subida.
`;}
function manualGuide(version,exe){return `PRUEBA DE INSTALACIÓN LIMPIA ${version}

Opción recomendada: Espacio aislado de Windows (Windows 10/11 Pro, Enterprise o Education).
1. Inicio → buscar «Activar o desactivar las características de Windows» → marcar «Espacio aislado de Windows» → Aceptar. Reinicia si Windows lo pide. Requiere virtualización habilitada. En Home utiliza la alternativa siguiente.
2. Abre Espacio aislado de Windows, copia ${exe} desde tu equipo y pégalo dentro. Ejecuta el instalador dentro, acepta el permiso y pulsa Instalar.
3. Al cerrar el espacio aislado se descartan sus datos; tus proyectos del equipo principal no se tocan.

Alternativa en tu equipo (has indicado que ya no tienes datos del Constructor):
1. Cierra el Constructor. Win+R → %APPDATA% y luego %LOCALAPPDATA%. Comprueba que no existen las carpetas «Constructor de Programas Municipales Podemos» ni «constructor-programas-municipales»; comprueba también «constructor-programas-municipales-updater» en Local.
2. Si encuentras alguna, NO la borres. Copia la carpeta completa como respaldo y renómbrala temporalmente añadiendo .respaldo-antes-${version}. Si prefieres, usa el espacio aislado.
3. Ejecuta ${exe}, acepta el permiso y pulsa Instalar. No ejecutes un BAT ni el archivo blockmap.
4. Restauración de un respaldo: cierra el programa, renombra la carpeta de prueba con .prueba-${version} y devuelve a la carpeta respaldada su nombre original, en la misma ubicación. No mezcles los contenidos de ambas carpetas.

QUÉ DEBE VERSE
1. Configuración de Windows → Aplicaciones: una sola entrada, versión ${version}. En Program Files está el ejecutable y su desinstalador. Hay un acceso directo en el escritorio público.
2. Inicio y Programas fuente: sin fuentes instaladas, proyectos, fichas, logos ni textos propios de municipios. Acerca de: ${version}.
3. Antes de publicar el contenido provisional, aviso «Todavía no hay un Programa Marco oficial disponible». Después de publicarlo, tarjeta provisional, versión 1.0.0, botón Descargar y progreso. Nada se descarga en silencio.
4. Pulsa Descargar. Debe quedar una fuente activa, con dos áreas y cuatro medidas, nunca el antiguo paquete de ejemplo. Crea un proyecto de prueba.
5. Escribe lemas distintos ES/CA; cambia el idioma y exporta Word y PDF en ambos idiomas. Cada documento muestra su lema. PDF necesita Word o LibreOffice; sin ellos Word sigue disponible.
6. Descarga un modelo desde IA por elección propia. Automático compara CPU/GPU sin bloquear la redacción. Puedes elegir CPU/GPU y Volver a detectar; un fallo de GPU vuelve a CPU con aviso.
7. Genera un texto: banner no bloqueante, etiqueta del motor y tooltip del modelo. Entendido lo cierra; un cambio de motor vuelve a avisar. Reiniciar inicia otra sesión. Word/PDF y el texto copiado no incluyen avisos ni etiquetas.
8. Prueba sin conexión: aviso, Reintentar e Importar documento; no se instala un ejemplo.

REINSTALACIÓN Y DESINSTALACIÓN (hazlas en el espacio aislado si conservas proyectos)
a) Instalación limpia: una línea ${version}; carpeta de Program Files y acceso de escritorio; datos vacíos en AppData.
b) Instala ${version} encima: sigue una línea y el proyecto de prueba continúa.
c) Desinstala y responde No: desaparecen la entrada, Program Files y accesos; los proyectos siguen en AppData.
d) Reinstala; desinstala y responde Sí: desaparecen entrada, carpeta, accesos y las carpetas de datos indicadas por el desinstalador.
e) SOLO dentro del espacio aislado: instala, borra allí el «Uninstall ... .exe» y ejecuta de nuevo el instalador. Debe recuperar la instalación y dejar una sola entrada.
Las pruebas a–e no han sido ejecutadas en tu instalación real.
`;}
async function verifyContent(directory,phrases){
 const catalog=JSON.parse(fs.readFileSync(path.join(directory,'catalog.json'))),files=fs.readdirSync(directory).filter(name=>name.endsWith('.zip'));
 if(files.length!==1||catalog.programas_marco?.length!==1)throw Error('Expected one complete provisional package');
 const entry=catalog.programas_marco[0],bytes=fs.readFileSync(path.join(directory,files[0]));
 if(entry.content_id!=='programa-marco-2027-2031'||entry.content_version!=='1.0.0'||entry.official!==true||entry.package?.sha256!==sha(bytes)||entry.package?.size_bytes!==bytes.length||entry.package?.filename!==files[0])throw Error('Invalid provisional metadata/hash');
 const zip=await JSZip.loadAsync(bytes);let text=JSON.stringify(catalog);
 const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
 if(manifest.content_id!==entry.content_id||manifest.content_version!==entry.content_version||manifest.official!==true)throw Error('Invalid internal provisional manifest');
 for(const lang of ['es','ca']){
  const description=manifest.languages?.[lang];if(!description||description.official!==true)throw Error('Missing official language');
  for(const type of ['pdf','data']){
   const name=description[type];if(typeof name!=='string'||name.includes('..')||!zip.file(name))throw Error('Invalid content member');
   const data=await zip.file(name).async('nodebuffer');if(data.length!==description['size_'+type]||sha(data)!==description['sha256_'+type])throw Error('Invalid internal content hash');
  }
 }
 for(const item of Object.values(zip.files))if(!item.dir&&/\.json$/.test(item.name))text+='\n'+await item.async('string');
 if(text.includes('is_test_fixture')||text.includes('programa-marco-prueba'))throw Error('Example metadata in content');
 for(const phrase of phrases)if(text.replace(/\s+/g,' ').includes(phrase))throw Error('Private program in content');
 return files[0];
}
async function deliver(root,options){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),version=pkg.version,workspace=path.resolve(options.workspace);
 const publications=path.resolve(options.publications),installable=path.resolve(options.installable),report=path.resolve(options.report);
 inside(root,workspace);inside(publications,workspace);inside(installable,workspace);
 if(path.basename(publications)!==PUBLICATIONS||!fs.existsSync(publications))throw Error('Existing publication directory required');
 requireApproval(report);
 const proof=JSON.parse(fs.readFileSync(path.join(root,'scratch/AUDITORIA_FINAL_'+version+'.json')));
 if(proof.errors.length||proof.payload.executedInstaller!==false)throw Error('Final audit not approved');
 const clone=JSON.parse(fs.readFileSync(path.join(root,'scratch/CLON_LIMPIO_'+version+'.json')));
 if(clone.npmCi!==0||clone.setup!==0||clone.npmTest!==0)throw Error('Clean-clone verification failed');
 if(options.build!==false){
  const cli=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  const dist=path.join(root,'dist');if(fs.existsSync(dist))fs.renameSync(dist,path.join(root,'scratch/dist-anterior-'+stamp()));
  const build=spawnSync(process.execPath,[cli,'run','build'],{cwd:root,env:process.env,windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024});
  fs.writeFileSync(path.join(root,'scratch/BUILD_ENTREGA_'+version+'.txt'),(build.stdout||'')+(build.stderr||''));
  if(build.status!==0)throw Error('Fresh delivery build failed');
 }
 const phrases=proof.source.phrases.map(item=>item.text),audit=await finalAudit(root,phrases),installer=installerChecks(root,pkg);
 const source=await publicAudit(root,phrases);
 if(source.errors.length||installer.errors.length)throw Error('Delivery validation failed');
 if(JSON.stringify(source.entries)!==JSON.stringify(proof.source.entries))throw Error('Source differs from reviewed and clean-tested source');
 const contentDir=path.resolve(options.content),contentZip=await verifyContent(contentDir,phrases);
 const stage=fs.mkdtempSync(path.join(root,'scratch/entrega-')),sourceDir=path.join(stage,'1_codigo-fuente'),updates=path.join(stage,'2_release-actualizaciones'),content=path.join(stage,'3_contenidos');
 for(const dir of [sourceDir,updates,content])fs.mkdirSync(dir);
 for(const item of source.entries){const target=path.join(sourceDir,item.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,item.file),target);if(sha(fs.readFileSync(target))!==item.sha256)throw Error('Source copy differs');}
 const assets=[installer.exe,installer.exe+'.blockmap','latest.yml'];
 for(const file of assets)fs.copyFileSync(path.join(root,'dist',file),path.join(updates,file));
 const notes=fs.readFileSync(path.join(root,'CHANGELOG.md'),'utf8').match(new RegExp('## '+version.replaceAll('.','\\.')+'\\s*\\n([\\s\\S]*?)(?=\\n## |$)'))?.[1];
 if(!notes)throw Error('Version notes missing');
 fs.writeFileSync(path.join(updates,'NOTAS_RELEASE_'+version+'.md'),'# Versión '+version+'\n\n'+notes.trim()+'\n\nLa aplicación se instala vacía. El Programa Marco provisional se descarga por elección del usuario; los modelos de IA son opcionales. PDF necesita Word o LibreOffice.\n');
 for(const file of ['catalog.json',contentZip])fs.copyFileSync(path.join(contentDir,file),path.join(content,file));
 fs.writeFileSync(path.join(stage,'GUIA_SUBIDA_GITHUB_'+version+'.txt'),guide(version,installer.exe));
 const finalReport=fs.readFileSync(report,'utf8').trimEnd().replace(/\nLISTO PARA REVISIÓN$/,'')+'\n\nCompilación final de entrega: '+new Date().toISOString()+'; '+installer.size+' bytes; SHA256 '+installer.sha256+'. ASAR y payload repetidos: APROBADOS.\n\nLISTO PARA REVISIÓN\n';
 fs.writeFileSync(report,finalReport);
 fs.writeFileSync(path.join(stage,'INFORME_FINAL_'+version+'.md'),finalReport);
 const publicationReport=`INFORME DE PUBLICACIÓN ${version}\nFecha: ${new Date().toISOString()}\nEXE: ${installer.exe}\nTamaño: ${installer.size} bytes; ${(installer.size/1048576).toFixed(2)} MiB\nSHA256: ${installer.sha256}\nSHA512: ${installer.sha512}\nlatest.yml: versión, nombre, tamaño y SHA512 coinciden.\nCódigo público: ${source.entries.length} archivos, ${source.totalBytes} bytes; marcadores personales 0 (autor/cuenta pública permitidos); cuatro frases privadas: 0.\nClon limpio: npm ci APROBADO; setup CPU/Vulkan/OCR APROBADO; npm test APROBADO (${clone.batteries}).\nASAR: ${audit.packed.asarFiles} archivos; resources: ${audit.packed.resourcesFiles}; payload EXE: ${audit.payload.files.length} archivos idénticos byte a byte. Sin Programa Marco, modelos ni datos.\nContenido provisional: official=true, sin marcas de pruebas y sin texto privado; ZIP SHA256 ${sha(fs.readFileSync(path.join(content,contentZip)))}.\nExcluidos: node_modules, dist, out, runtime CPU/Vulkan/OCR, GGUF, bases, logs, scratch, informes internos y Programas Marco. Los manifiestos verificables sí se incluyen.\nLista 1_codigo-fuente:\n${source.entries.map(item=>item.file+'; '+item.bytes+'; '+item.sha256).join('\n')}\nLista 2_release-actualizaciones:\n${[...assets,'NOTAS_RELEASE_'+version+'.md'].join('\n')}\nLista 3_contenidos:\n${['catalog.json',contentZip].join('\n')}\nGuía e informe final incluidos; no se ha ejecutado NSIS ni realizado commit, push o subida. Las pruebas gráficas de instalación y actualización quedan en la guía manual.\nMotivo: todas las comprobaciones automáticas aprobadas; entrega lista para la revisión y subida manual del mantenedor.\nLISTO PARA SUBIR\n`;
 fs.writeFileSync(path.join(stage,'INFORME_PUBLICACION_'+version+'.txt'),publicationReport);
 fs.mkdirSync(installable,{recursive:true});
 const old=fs.readdirSync(installable).filter(name=>name!=='_anteriores');
 if(old.length){let previous='anterior';const versionFile=path.join(installable,'VERSION.txt');if(fs.existsSync(versionFile))previous=fs.readFileSync(versionFile,'utf8').match(/\d+\.\d+\.\d+/)?.[0]||previous;
  let archive=path.join(installable,'_anteriores',previous);if(fs.existsSync(archive))archive+='_'+stamp();inside(archive,installable);fs.mkdirSync(archive,{recursive:true});for(const name of old){const origin=path.join(installable,name);inside(origin,installable);fs.renameSync(origin,path.join(archive,name));}}
 for(const file of assets){fs.copyFileSync(path.join(updates,file),path.join(installable,file));if(sha(fs.readFileSync(path.join(updates,file)))!==sha(fs.readFileSync(path.join(installable,file))))throw Error('Asset copies differ');}
 fs.writeFileSync(path.join(installable,'SHA256.txt'),installer.sha256+'  '+installer.exe+'\n');
 fs.writeFileSync(path.join(installable,'VERSION.txt'),version+'\nFecha: '+new Date().toISOString()+'\nTamaño: '+(installer.size/1048576).toFixed(2)+' MiB\nSHA256: '+installer.sha256+'\n');
 fs.writeFileSync(path.join(installable,'PRUEBA_INSTALACION_LIMPIA_'+version+'.txt'),manualGuide(version,installer.exe));
 const destination=path.join(publications,'V'+version);inside(destination,workspace);let stageToMove=stage;
 if(fs.existsSync(destination)){const archive=destination+'_anterior_'+stamp();inside(archive,workspace);fs.renameSync(destination,archive);if(stage.startsWith(destination+path.sep))stageToMove=path.join(archive,path.relative(destination,stage));}
 fs.renameSync(stageToMove,destination);
 console.log('Entrega local terminada: '+destination+'\nInstalable: '+installable+'\nNo se ha subido nada a GitHub.');return {destination,installer};
}
function args(){const values={};for(let n=2;n<process.argv.length;n+=2)values[process.argv[n].replace(/^--/,'')]=process.argv[n+1];return values;}
if(require.main===module){const opts=args(),root=path.resolve(opts.root||path.join(__dirname,'..'));deliver(root,opts).catch(error=>{console.error('NO SUBIR: '+error.message);process.exitCode=1;});}
module.exports={deliver,requireApproval,inside,guide,manualGuide,verifyContent};
