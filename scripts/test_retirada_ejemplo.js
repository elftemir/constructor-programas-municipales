const fs=require('fs'),path=require('path'),assert=require('assert'),asar=require('@electron/asar'),vm=require('vm');
const root=path.resolve(__dirname,'..'),base=process.env.TEST_RUN_DIR||path.join(root,'scratch');
fs.mkdirSync(base,{recursive:true});const directory=fs.mkdtempSync(path.join(base,'retire-example-'));
for(const [key,leaf]of Object.entries({APPDATA:'roaming',LOCALAPPDATA:'local',USERPROFILE:'user',TEMP:'temp',TMP:'temp'})){
  process.env[key]=path.join(directory,leaf);fs.mkdirSync(process.env[key],{recursive:true});
}
const database=require('../src/main/db/database'),projects=require('../src/main/services/projectService'),sources=require('../src/main/services/sourceProgramService');
const migrator=require('../src/main/db/migrator'),migration=require('../src/main/db/migrations/007_retire_test_content');
const {ContentUpdateService}=require('../src/main/services/contentUpdateService');
const {assertArchiveHasNoTestContent,forbiddenContent}=require('./auditar_contenido_empaquetado');
async function main(){
 const oldId=['programa','marco','prueba','2027','2031'].join('-');
 const entry={content_id:oldId,content_type:'programa_marco',content_version:'1.0.0',title:{es:'Synthetic ES',ca:'Synthetic CA'},cycle:'test',official:false,is_test_fixture:true,min_app_version:'3.1.3',languages:['es','ca'],stats:{total_areas:1,total_measures:1},package:{filename:'fixture.zip',size_bytes:100,sha256:'a'.repeat(64),download_url:'https://github.com/elftemir/constructor-programas-municipales-content/releases/download/test/fixture.zip'}};
 const official={...entry,content_id:'official-synthetic',official:true,is_test_fixture:false};
 process.env.CPM_ALLOW_TEST_CONTENT='1';const production=new ContentUpdateService();production.isPackagedApp=()=>true;
 assert.equal(production.validateCatalogSchema({schema_version:1,programas_marco:[entry]}).programas_marco.length,0);
 assert.deepEqual(production.validateCatalogSchema({schema_version:1,programas_marco:[entry,official]}).programas_marco.map(item=>item.content_id),[official.content_id]);
 assert.equal(production.validateCatalogSchema({schema_version:1,programas_marco:[{...official,official:undefined}]}).programas_marco.length,0);
 assert.deepEqual(await production.getTestContentItems(),[]);
 production.validatedCatalogMap.set(oldId,entry);await assert.rejects(production.installContentUpdate(oldId,{allowTestFixture:true}),/desarrollo autorizado/);
 const development=new ContentUpdateService();development.isPackagedApp=()=>false;
 delete process.env.CPM_ALLOW_TEST_CONTENT;assert.equal(development.validateCatalogSchema({schema_version:1,programas_marco:[entry]}).programas_marco.length,0);
 process.env.CPM_ALLOW_TEST_CONTENT='1';assert.equal(development.validateCatalogSchema({schema_version:1,programas_marco:[entry]}).programas_marco.length,1);
 console.log('PASS production catalog: only official packages, no manual bypass; development requires explicit environment flag.');
 const filename=path.join(directory,'synthetic.sqlite');let db=await database.getDb(filename,{catalogPath:path.join(__dirname,'fixtures/catalog-minimal.json')});
 const projectId=await projects.createProject({municipio:'Synthetic municipality',lema_es:'Lema ES',lema_ca:'Lema CA'});
 const priorSource=(await sources.getActive()).id;
 db.run("INSERT OR IGNORE INTO proyecto_fuentes (id,proyecto_id,fuente_id,rol,fecha_anadida) VALUES (?,?,?,'principal',?)",['synthetic-link',projectId,priorSource,new Date().toISOString()]);
 for(const table of ['areas','medidas','proyectos','proyecto_fuentes'])db.run('UPDATE '+table+' SET fuente_id = ? WHERE fuente_id = ?',[oldId,priorSource]);
 db.run('UPDATE programas_fuente SET id=?,content_id=?,es_fixture_prueba=1 WHERE id=?',[oldId,oldId,priorSource]);
 const projection=()=>Object.fromEntries(['proyectos','proyecto_fuentes','decisiones_medidas','medidas_propias','textos_generales','areas','medidas','fichas_municipios'].map(table=>[table,db.exec('SELECT * FROM '+table)]));
 const before=projection();const originalProject=await projects.getProject(projectId);assert(originalProject.areas.length>0);
 for(const [id,marked]of [['flag-source',1],['manifest-source',0],['user-import',0]]){
  db.run('INSERT INTO programas_fuente (id,nombre,activo,archivado,tipo,idiomas_json,total_areas,total_medidas,created_at,updated_at,es_fixture_prueba) VALUES (?,?,0,0,?,?,?,?,?,?,?)',[id,id,'importado','{}',0,0,'test','test',marked]);
 }
 db.run('INSERT INTO contenidos_instalados (content_id,fuente_id,content_version,manifest_json,installed_at,updated_at) VALUES (?,?,?,?,?,?)',['manifest-package','manifest-source','1.0.0',JSON.stringify({is_test_fixture:true}),'test','test']);
 for(const table of ['programas_fuente','contenidos_instalados'])db.run('ALTER TABLE '+table+' DROP COLUMN retirado_por_prueba');
 db.run('PRAGMA user_version=6');database.save();database.closeDb();
 db=await database.getDb(filename);
 assert.equal(migrator.getSchemaVersion(db),migrator.TARGET_SCHEMA_VERSION);assert.deepEqual(projection(),before,'All municipal records and source material are unchanged');
 assert.deepEqual((await sources.getAll(true)).map(item=>item.id),['user-import']);
 assert.equal((await sources.getActive()).id,'user-import','A legitimate imported document is not retired');
 assert.equal(db.exec('SELECT retirado_por_prueba FROM programas_fuente WHERE id=?',[oldId])[0].values[0][0],1);
 assert.equal((await projects.getProject(projectId)).lema_ca,'Lema CA');
 assert.equal((await projects.getProject(projectId)).areas[0].medidas.length,originalProject.areas[0].medidas.length);
 await assert.rejects(sources.setArchived(oldId,false),/retirado/);
 const snapshot=Buffer.from(db.export());const result=migration.up(db,migrator);assert.equal(result.retired,0);assert(Buffer.from(db.export()).equals(snapshot),'Second retirement is idempotent');
 const second=await migrator.migrate(db,{dbFilePath:filename});assert.equal(second.migrated,false);
 const backups=fs.readdirSync(path.join(directory,'backups/migrations'));assert(backups.some(file=>file.includes('schema6-to-'+migrator.TARGET_SCHEMA_VERSION)));
 database.closeDb();console.log('PASS schema 7: mandatory backup; test source hidden even with archived items; complete project retained; repeated migration changes nothing.');
 const fixture=path.join(directory,'fixture'),archive=path.join(directory,'fixture.asar');fs.mkdirSync(fixture);
 fs.writeFileSync(path.join(fixture,oldId+'.json'),'{}');await asar.createPackage(fixture,archive);assert.throws(()=>assertArchiveHasNoTestContent(archive),/NO PUBLICAR/);
 fs.unlinkSync(path.join(fixture,oldId+'.json'));fs.writeFileSync(path.join(fixture,'metadata.json'),JSON.stringify({is_test_fixture:true}));await asar.createPackage(fixture,archive);assert.throws(()=>assertArchiveHasNoTestContent(archive),/NO PUBLICAR/);
 fs.unlinkSync(path.join(fixture,'metadata.json'));fs.writeFileSync(path.join(fixture,'empty.json'),'{}');await asar.createPackage(fixture,archive);assertArchiveHasNoTestContent(archive);
 assert(forbiddenContent('safe.json',Buffer.from(JSON.stringify({nested:{is_test_fixture:false}}))));
 console.log('PASS real ASAR: injected example filename or fixture metadata blocks; removal restores passing audit.');
 for(const lang of ['es','ca']){
  const locale=require('../src/renderer/locales/'+lang+'.json');const box={innerHTML:'',querySelector:()=>null};
  const context=vm.createContext({window:{i18n:{t:key=>key.split('.').reduce((v,k)=>v?.[k],locale)}},App:{},document:{},console});
  vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/js/views/homeView.js'),'utf8'),context);
  vm.runInContext('HomeView',context).renderNoSources(box,'NO_OFFICIAL_CONTENT');assert(box.innerHTML.includes(locale.clean_start.no_official));
 }
 console.log('PASS ES/CA: exact official-content-unavailable notice; no sample program displayed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
