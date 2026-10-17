const fs = require('fs'); const path = require('path'); const assert = require('assert');
const vm = require('vm'); const crypto = require('crypto'); const JSZip = require('jszip');
const root = path.resolve(__dirname, '..'); const base = process.env.TEST_RUN_DIR || path.join(root, 'scratch');
fs.mkdirSync(base, { recursive: true }); const dir = fs.mkdtempSync(path.join(base,'empty-distribution-'));
function profiles(folder) {
  for (const [key, leaf] of Object.entries({ APPDATA:'roaming',LOCALAPPDATA:'local',USERPROFILE:'user',TEMP:'temp',TMP:'temp' })) {
    process.env[key]=path.join(folder,leaf); fs.mkdirSync(process.env[key],{recursive:true});
  }
}
profiles(dir);
const database=require('../src/main/db/database'); const projects=require('../src/main/services/projectService');
const sources=require('../src/main/services/sourceProgramService');
const { ContentUpdateService,OFFICIAL_CATALOG_URL }=require('../src/main/services/contentUpdateService');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function packageFixture(id, version, official, isTest=false, min='3.1.3', manifestTest=isTest) {
  const manifest={schema_version:1,content_id:id,content_type:'programa_marco',content_version:version,official,is_test_fixture:manifestTest,
    min_app_version:min,title:{es:'Fuente técnica ES',ca:'Font tècnica CA'},cycle:'test',languages:{},stats:{total_areas:1,total_measures:1}};
  const zip=new JSZip();
  for(const lang of ['es','ca']) {
    const pdf=Buffer.from('%PDF-1.4\n% local synthetic fixture\n%%EOF\n');
    const data=Buffer.from(JSON.stringify({content_id:id,content_version:version,language:{code:lang},areas:[{
      area_id:'a-one',title:'Technical area '+lang,measures:[{measure_id:'m-one',title:'Technical title '+lang,text:'Synthetic test content '+lang}]}]}));
    manifest.languages[lang]={code:lang,data:lang+'/data.json',pdf:lang+'/document.pdf',sha256_data:sha(data),sha256_pdf:sha(pdf)};
    zip.file(lang+'/data.json',data,{createFolders:false}); zip.file(lang+'/document.pdf',pdf,{createFolders:false});
  }
  zip.file('manifest.json',JSON.stringify(manifest)); const buffer=await zip.generateAsync({type:'nodebuffer'});
  const entry={...manifest,is_test_fixture:isTest,languages:['es','ca'],package:{filename:id+'.zip',size_bytes:buffer.length,sha256:sha(buffer),
    download_url:'https://github.com/elftemir/constructor-programas-municipales-content/releases/download/local/'+id+'.zip'}};
  return {entry,buffer};
}
async function scenario(name, fixtures=[], offline=false) {
  database.closeDb(); const folder=path.join(dir,name); profiles(folder);
  const db=await database.getDb(path.join(folder,'database.sqlite'));
  const service=new ContentUpdateService(); const transport={catalogs:0,packages:[]};
  let catalogue=fixtures;
  service.fetchSecureBuffer=async url=>{
    if(url===OFFICIAL_CATALOG_URL) { transport.catalogs++; if(offline) throw Error('Offline fixture');
      return {buffer:Buffer.from(JSON.stringify({schema_version:1,programas_marco:catalogue.map(f=>f.entry)})),redirects:[]}; }
    const item=catalogue.find(f=>f.entry.package.download_url===url); assert(item,'No real network is permitted');
    transport.packages.push(item.entry.content_id);return {buffer:item.buffer,redirects:[]};
  };
  return {db,service,transport,setCatalogue:value=>{catalogue=value;}};
}
function updaterUi(lang) {
  const box={innerHTML:'',querySelector:()=>null}; const locale=require('../src/renderer/locales/'+lang+'.json');
  const context=vm.createContext({console,setTimeout,clearTimeout,escapeHtml:value=>String(value??''),
    document:{getElementById:id=>id==='options-content-updater-status-box'?box:null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    window:{App:{},i18n:{getLang:()=>lang,t:key=>key.split('.').reduce((obj,k)=>obj?.[k],locale)}}});
  vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/js/views/optionsView.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/js/app.js'),'utf8'),context);
  const app=vm.runInContext('App',context);context.window.App=app;
  let notified=null;app.showContentUpdateBanner=item=>{notified=item;};
  return {box,context,app,getNotification:()=>notified};
}
async function main() {
  let current=await scenario('empty');
  for(const table of ['programas_fuente','areas','medidas','proyectos']) assert.equal(current.db.exec('SELECT COUNT(*) FROM '+table)[0].values[0][0],0,table);
  console.log('PASS empty startup: 0 sources, areas, measures, projects.');
  const test=await packageFixture('local-fixture','1.0.0',false,true);
  const officialButTest=await packageFixture('flagged-fixture','2.0.0',true,true);
  current=await scenario('test-only',[test,officialButTest]);
  assert.equal((await current.service.bootstrapOfficialContent()).status,'EMPTY');
  assert.equal((await sources.getAll()).length,0);assert.equal(current.transport.packages.length,0);
  assert.equal(current.service.getStatus().status,'UP_TO_DATE');assert.equal(current.service.getStatus().availableItems.length,0);
  const listed=await current.service.getTestContentItems();assert.equal(listed.length,2);
  await assert.rejects(current.service.installContentUpdate(test.entry.content_id),/Mostrar contenidos de prueba/);
  assert.equal(current.transport.packages.length,0);
  for(const lang of ['es','ca']) {
    const ui=updaterUi(lang); const mixed={status:'AVAILABLE',availableItems:[test.entry]};
    ui.context.window.OptionsView.updateContentUpdaterBox(mixed);
    assert(ui.box.innerHTML.includes(lang==='es'?'No hay contenidos oficiales nuevos':'No hi ha continguts oficials nous'));
    assert(!ui.box.innerHTML.includes('Fuente técnica'));ui.app.handleContentUpdateStatus(mixed);assert.equal(ui.getNotification(),null);
  }
  console.log('PASS test-only catalog: no automatic installation, no notifications, no official updates ES/CA; explicit test browser only.');
  await current.service.installContentUpdate(officialButTest.entry.content_id,{allowTestFixture:true});
  const explicitlyInstalledTest=await sources.getById(officialButTest.entry.content_id);
  assert(!explicitlyInstalledTest.official && !explicitlyInstalledTest.oficial_actual_protegido && explicitlyInstalledTest.es_fixture_prueba,
    'Even a package claiming official is not protected as official when its manifest marks it as a test');
  current=await scenario('offline',[],true);
  assert.equal((await current.service.bootstrapOfficialContent()).status,'EMPTY');assert.equal(current.transport.catalogs,1);
  await current.service.bootstrapOfficialContent();assert.equal(current.transport.catalogs,1,'No network retry loop');
  await current.service.bootstrapOfficialContent(true);assert.equal(current.transport.catalogs,2,'Explicit retry works');
  assert.equal((await sources.getAll()).length,0);
  for(const lang of ['es','ca']) {
    const locale=require('../src/renderer/locales/'+lang+'.json');assert.equal(locale.clean_start.find,'Reintentar');
    assert(locale.clean_start.message.includes(lang==='es'?'Comprueba tu conexión':'Comprova la teva connexió'));
  }
  console.log('PASS offline: empty state and Retry, explicit retry, no partial records.');
  const older=await packageFixture('official-old','0.9.0',true);
  const newest=await packageFixture('programa-marco-2027-2031','1.0.0',true);
  const incompatible=await packageFixture('official-incompatible','9.0.0',true,false,'99.0.0');
  current=await scenario('official',[test,older,incompatible,newest]);
  const statuses=[];current.service.onStatusChange(state=>statuses.push(state.status));
  const result=await current.service.bootstrapOfficialContent();assert.equal(result.status,'AVAILABLE');assert.equal(result.item.content_id,newest.entry.content_id);
  assert.equal(current.transport.packages.length,0,'Official content is offered, never silently downloaded');
  await current.service.installContentUpdate(result.item.content_id);
  assert.deepEqual(current.transport.packages,[newest.entry.content_id]);
  const active=await sources.getActive();assert.equal(active.id,newest.entry.content_id);assert(active.activo&&active.official&&!active.es_fixture_prueba);
  for(const status of ['DOWNLOADING','VERIFYING','INSTALLING'])assert(statuses.includes(status),status);
  const project=await projects.getProject(await projects.createProject({municipio:'Municipio técnico',lema_es:'Prueba',lema_ca:'Prova'}));
  assert.equal(project.fuente_id,active.id);assert.equal(project.areas[0].medidas.length,1);
  assert((await projects.getCatalogInfo()).info.descripcion.includes('Fuente técnica'));
  const update=await packageFixture(newest.entry.content_id,'2.0.0',true);
  current.setCatalogue([update]);await current.service.checkForContentUpdates({source:'auto'});
  assert.equal(current.service.getStatus().status,'AVAILABLE');assert.equal((await sources.getActive()).content_version,'1.0.0');
  await current.service.bootstrapOfficialContent();assert.equal(current.transport.packages.length,1,'Existing data never silently replaced');
  for(const lang of ['es','ca']) {
    const ui=updaterUi(lang);ui.context.window.OptionsView.updateContentUpdaterBox({status:'AVAILABLE',availableItems:[test.entry,update.entry]});
    assert(ui.box.innerHTML.includes('Nuevo contenido disponible')||ui.box.innerHTML.includes('Nou contingut disponible'));
    ui.app.handleContentUpdateStatus({status:'AVAILABLE',availableItems:[test.entry,update.entry]});assert.equal(ui.getNotification().content_id,update.entry.content_id);
  }
  const preserved=()=>Object.fromEntries(['proyectos','proyecto_fuentes','decisiones_medidas','medidas_propias','textos_generales','fichas_municipios'].map(table=>[table,current.db.exec('SELECT * FROM '+table+' ORDER BY rowid')]));
  const beforeUpdate=preserved();await current.service.installContentUpdate(update.entry.content_id);
  assert.equal((await sources.getActive()).content_version,'2.0.0');assert.deepEqual(preserved(),beforeUpdate,'An official 2.0.0 update preserves every municipal record');
  assert.equal((await projects.getProject(project.id)).areas[0].medidas.length,1);
  console.log('PASS newest compatible official: full hash/ZIP pipeline, active bilingual source, project creation; later update requires confirmation.');
  const tampered=await packageFixture('mislabelled-manifest','4.0.0',true,false,'3.1.3',true);
  current=await scenario('manifest-guard',[tampered]);
  const tamperedOffer=await current.service.bootstrapOfficialContent();assert.equal(tamperedOffer.status,'AVAILABLE');
  await assert.rejects(current.service.installContentUpdate(tamperedOffer.item.content_id));assert.equal((await sources.getAll()).length,0);
  console.log('PASS manifest test flag mismatch rejected before persisting.');
  const files=require('../package.json').build.files;
  for(const exclusion of ['!src/main/assets/data/catalogo_marco.json','!data/catalogo_marco.json','!**/catalogo_validacion.html','!**/extracted_raw.txt','!**/*.sqlite','!**/*.db','!**/*.pdf','!scripts/**'])assert(files.includes(exclusion),exclusion);
  const { assertNoFixedReferences, AI_INSTALLER_FILE, AI_INSTALLER_COMMENTS } = require('./verificar_desvinculacion');
  for (const comment of AI_INSTALLER_COMMENTS) assertNoFixedReferences(AI_INSTALLER_FILE,comment);
  for (const reference of ['Programa Marco 2027','Fase 1 en textos de catálogo','Catálogo bilingüe 1.4.1','Catàleg bilingüe v1.4.1','123 medidas','123 mesures','12 áreas','12 àrees','catalogo_marco','fuente_marco_oficial']) {
    assert.throws(() => assertNoFixedReferences('src/renderer/locales/es.json',reference),/Referencia fija/,reference);
  }
  assert.throws(() => assertNoFixedReferences('src/renderer/locales/es.json','// FASE 1: Preparando instalación'),/Referencia fija/,'The exception is restricted to the AI installer file');
  assert.throws(() => assertNoFixedReferences(AI_INSTALLER_FILE,'// FASE 1: Programa Marco 2027'),/Referencia fija/,'A political reference is never ignored, even in a comment');
  assert.throws(() => assertNoFixedReferences(AI_INSTALLER_FILE,'// FASE 1: Catálogo histórico'),/Referencia fija/,'Only the exact reviewed installer comments are accepted');
  function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
    const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);
    else if(/\.(js|json|html|css)$/i.test(file))assertNoFixedReferences(path.relative(root,file),fs.readFileSync(file,'utf8'));
  }}walk(path.join(root,'src'));
  console.log('PASS fixed-reference filter: only exact AI installer comments ignored; real program references cause failure; 0 fixed references in src.');
  database.closeDb();
}
main().catch(error=>{database.closeDb();console.error(error);process.exitCode=1;});
