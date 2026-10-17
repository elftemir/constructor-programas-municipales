const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(root,'scratch/home-380-'));
for(const [key,leaf]of Object.entries({APPDATA:'roaming',LOCALAPPDATA:'local',USERPROFILE:'user',TEMP:'temp',TMP:'temp'})){process.env[key]=path.join(directory,leaf);fs.mkdirSync(process.env[key],{recursive:true});}
const database=require('../src/main/db/database'),{ContentUpdateService}=require('../src/main/services/contentUpdateService');
function ui(lang,result,hasProject=false){
 const locale=require('../src/renderer/locales/'+lang+'.json'),nodes={};
 const node=selector=>nodes[selector]||(nodes[selector]={textContent:'',disabled:false,events:{},addEventListener(type,callback){this.events[type]=callback;},cloneNode(){const n={...this,events:{}};return n;},replaceWith(n){nodes[selector]=n;}});
 const box={innerHTML:'',querySelector:node}; let installed=false,imports=0;
 const context=vm.createContext({console,document:{},App:{currentView:'home',currentProject:null,openContentManager(){}},window:{
  i18n:{getLang:()=>lang,t:key=>key.split('.').reduce((v,k)=>v?.[k],locale)},ImportReviewView:{openImportModal(){imports++;}},
  api:{getProjects:async()=>hasProject?[{id:'synthetic-project'}]:[],getSourcePrograms:async()=>installed?[{id:'official'}]:[],bootstrapOfficialContent:async()=>result,installContentUpdate:async()=>{installed=true;},getLastOpenedProjectId:async()=>null}
 }});
 vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/js/views/homeView.js'),'utf8'),context);
 return {view:context.window.HomeView,box,nodes,locale,getInstalled:()=>installed,getImports:()=>imports};
}
async function main(){
 for(const lang of ['es','ca']){
  for(const reason of ['NO_OFFICIAL_CONTENT','CATALOG_ERROR']){
   const sample=ui(lang,{status:'EMPTY',reason},true);await sample.view.render(sample.box);
   assert(sample.box.innerHTML.includes(reason==='NO_OFFICIAL_CONTENT'?sample.locale.clean_start.no_official:sample.locale.clean_start.connection_error));
   await sample.view.render(sample.box);
   assert(sample.box.innerHTML.includes(reason==='NO_OFFICIAL_CONTENT'?sample.locale.clean_start.no_official:sample.locale.clean_start.connection_error),'Notice survives navigation or language refresh');
   assert(sample.box.innerHTML.includes(sample.locale.clean_start.find));assert(sample.box.innerHTML.includes(sample.locale.clean_start.import));
   sample.nodes['#btn-clean-import'].events.click();assert.equal(sample.getImports(),1);
  }
  const offer=ui(lang,{status:'AVAILABLE',item:{content_id:'official',title:{es:'Official ES',ca:'Official CA'},content_version:'1.0.0'}});
  await offer.view.render(offer.box);assert(!offer.getInstalled(),'No silent download');
  assert(offer.nodes['.empty-state-desc'].textContent.includes(lang==='es'?'Official ES':'Official CA'));
  assert.equal(offer.nodes['#btn-clean-find'].textContent,offer.locale.clean_start.download);
  offer.view.updateBootstrapProgress({status:'DOWNLOADING',progress:{percent:47}},offer.box);assert(offer.nodes['#clean-download-progress'].textContent.includes('47%'));
  await offer.nodes['#btn-clean-find'].events.click();assert(offer.getInstalled(),'Download requires button click');
 }
 await database.getDb(path.join(directory,'synthetic.sqlite'));
 const service=new ContentUpdateService();service.isPackagedApp=()=>true;
 const entry={content_id:'official-local',content_type:'programa_marco',content_version:'1.0.0',title:{es:'Local ES',ca:'Local CA'},official:true,min_app_version:'3.1.3',languages:['es','ca'],stats:{total_areas:1,total_measures:1},package:{filename:'local.zip',size_bytes:100,sha256:'a'.repeat(64),download_url:'https://github.com/elftemir/constructor-programas-municipales-content/releases/download/local/local.zip'}};
 let release;service.fetchSecureBuffer=()=>new Promise(resolve=>{release=()=>resolve({buffer:Buffer.from(JSON.stringify({schema_version:1,programas_marco:[entry]}))});});
 const checking=service.checkForContentUpdates();await new Promise(resolve=>setTimeout(resolve,20));
 let finished=false;const bootstrap=service.bootstrapOfficialContent().then(result=>{finished=true;return result;});
 await new Promise(resolve=>setTimeout(resolve,20));assert(!finished,'Bootstrap must await the concurrent catalog request');
 release();await checking;const offered=await bootstrap;assert.equal(offered.status,'AVAILABLE');assert.equal(offered.item.content_id,entry.content_id);
 assert.equal((await database.getDb()).exec('SELECT COUNT(*) FROM programas_fuente')[0].values[0][0],0);
 database.closeDb();console.log('PASS Inicio ES/CA: no officials, offline, retry/import, projects retained, safe offer, click-only download, visible progress; concurrent checks share one request.');
}
main().catch(error=>{database.closeDb();console.error(error);process.exitCode=1;});
