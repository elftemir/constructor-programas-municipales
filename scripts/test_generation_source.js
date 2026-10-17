const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),testRoot=process.env.CPM_TEST_ROOT||path.join(root,'scratch');fs.mkdirSync(testRoot,{recursive:true});
const dir=fs.mkdtempSync(path.join(testRoot,'generation-source-'));
for(const [key,leaf]of Object.entries({APPDATA:'roaming',LOCALAPPDATA:'local',USERPROFILE:'user',TEMP:'temp',TMP:'temp'})){process.env[key]=path.join(dir,leaf);fs.mkdirSync(process.env[key],{recursive:true});}
const source=require('../src/main/services/ai/generationSource'),service=require('../src/main/services/ai/aiService');
function renderer(lang){
 const locale=require('../src/renderer/locales/'+lang+'.json');const nodes={};
 const node=()=>({textContent:'',hidden:true,children:[],events:{},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},addEventListener(event,callback){this.events[event]=callback;},remove(){this.removed=true;},insertAdjacentElement(where,item){this.badge=item;}});
 for(const id of ['#generation-banner','#generation-engine-indicator'])nodes[id]=node();
 let engine='ia-gpu',fallbackReason=null,labelOnly=false,available=true,availableEngine='ia-gpu';const frozenApi=Object.freeze({aiBackendState:async()=>({availability:{available,engine:availableEngine,modelName:available?'Synthetic model':null}}),aiCorrectText:async()=>({ok:true,texto:'Clean generated text',availability:{available,engine:availableEngine,modelName:available?'Synthetic model':null},generation:{engine,modelName:engine==='sin-ia'?null:'Synthetic model',fallbackReason,labelOnly}})});
 const app={navigateTo(view,params){this.view=view;this.params=params;}};
 const ctx=vm.createContext({console,Set,Map,WeakMap,Proxy,window:{api:frozenApi,i18n:{t:(key,params={})=>key.split('.').reduce((v,k)=>v?.[k],locale).replace('{model}',params.model||'')},App:app},document:{querySelector:id=>nodes[id]||null,createElement:node}});
 vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/js/utils/generationUi.js'),'utf8'),ctx);
 return {ctx,nodes,node,app,ui:ctx.window.GenerationUi,api:ctx.window.GenerationApi,setEngine:(value,reason=null,only=false)=>{engine=value;fallbackReason=reason;labelOnly=only;if(value!=='sin-ia')availableEngine=value;else if(!reason&&!only){available=false;availableEngine='sin-ia';}},locale};
}
async function main(){
 assert(fs.readFileSync(path.join(root,'scripts/build_i18n.js'),'utf8').includes('window.GenerationUi?.refresh()'),'Language generator preserves generation UI refresh');
 service.catalog=[{id:'synthetic',name:'Synthetic model'}];
 for(const backend of ['gpu','cpu']){
  service.getActiveProvider=async()=>({name:'LlamaCppProvider',generate:async()=>{source.recordNative(backend,'synthetic');return {ok:true,texto:'Synthetic output',data:{texto:'Synthetic output'}};}});
  const response=await service.corregirTexto({texto:'Synthetic input',idioma:'es'});assert.equal(response.generation.engine,'ia-'+backend);assert.equal(response.generation.modelName,'Synthetic model');
 }
 const beforeTranslation=source.getState();
 const translation=await service.traducirTexto({texto:'Mejoraremos los servicios públicos.',idioma_origen:'es',idioma_destino:'ca',idioma:'ca'});
 assert(translation.ok);assert.equal(translation.generation.engine,'sin-ia');assert.equal(translation.generation.labelOnly,true);assert.equal(translation.generation.fallbackReason,null);
 assert.deepEqual(source.getState(),beforeTranslation,'Deliberate translation preserves writing-engine state');
 const gpuRecovery=await source.run({synthetic:'Synthetic model'},async()=>{source.recordFallback('gpu-failed');source.recordNative('cpu','synthetic');return {ok:true};});
 assert.equal(gpuRecovery.generation.fallbackReason,'gpu-failed');assert.equal(gpuRecovery.generation.engine,'ia-cpu');
 service.getActiveProvider=async()=>service.builtinEngine;
 const automatic=await service.resumirTexto({texto:'Synthetic text without a model.',idioma:'es'});assert.equal(automatic.generation.engine,'sin-ia');
 service.getActiveProvider=async()=>({name:'LlamaCppProvider',generate:async()=>{throw Error('Synthetic neural failure');}});
 const fallback=await service.corregirTexto({texto:'Synthetic fallback text',idioma:'es'});assert(fallback.ok);assert.equal(fallback.generation.engine,'sin-ia');assert.equal(fallback.generation.fallbackReason,'ai-failed');assert.equal(fallback.generation.labelOnly,false);
 const failedTranslation=await service.traducirTexto({texto:'Mejoraremos los servicios públicos.',idioma:'ca',useSelectedModel:true});
 assert(failedTranslation.ok);assert.equal(failedTranslation.generation.fallbackReason,'ai-failed');assert.equal(failedTranslation.generation.labelOnly,false,'Failed selected-model translation is a real fallback');
 const concurrent=await Promise.all(['cpu','gpu'].map((backend,index)=>source.run({synthetic:'Synthetic model'},async()=>{await new Promise(resolve=>setTimeout(resolve,10-index*5));source.recordNative(backend,'synthetic');return {ok:true};})));
 assert.deepEqual(concurrent.map(result=>result.generation.engine),['ia-cpu','ia-gpu'],'Each concurrent request retains its own provenance');
 for(const lang of ['es','ca']){
  const ui=renderer(lang);await ui.ui.init();
  ui.nodes['#generation-engine-indicator'].events.click();assert.equal(ui.app.view,'configuracion');assert.equal(ui.app.params.focusSection,'ia');
  const result=await ui.api.aiCorrectText({});assert.equal(ui.ui.lastShownEngine,'ia-gpu');assert(!ui.nodes['#generation-banner'].hidden);
  assert(ui.nodes['#generation-banner'].children[0].textContent.includes('Synthetic model'));
  ui.nodes['#generation-banner'].children[1].events.click();assert(ui.nodes['#generation-banner'].hidden);
  await ui.api.aiCorrectText({});assert(ui.nodes['#generation-banner'].hidden,'Same engine is announced once');
  ui.setEngine('sin-ia',null,true);const deliberate=await ui.api.aiCorrectText({});assert(ui.nodes['#generation-banner'].hidden,'Built-in translation does not redisplay the banner');assert.equal(ui.ui.state.engine,'ia-gpu');
  const translatedOutput=ui.node();ui.ui.markResult(deliberate,translatedOutput);assert(translatedOutput.badge.textContent.includes(ui.locale.generation.translation_label),'Built-in translation still has its truthful label');
  ui.setEngine('ia-gpu');await ui.api.aiCorrectText({});assert(ui.nodes['#generation-banner'].hidden,'Returning from built-in translation does not announce again');
  ui.setEngine('ia-cpu');await ui.api.aiCorrectText({});assert(ui.nodes['#generation-banner'].hidden,'Intentional CPU selection does not redisplay the banner');
  ui.setEngine('ia-gpu');await ui.api.aiCorrectText({});assert(ui.nodes['#generation-banner'].hidden,'Intentional GPU selection does not redisplay the banner');
  ui.ui.acceptSource({engine:'ia-cpu',modelName:'Synthetic model',fallbackReason:'gpu-failed'});assert(!ui.nodes['#generation-banner'].hidden,'GPU failure event immediately redisplays banner');
  ui.nodes['#generation-banner'].children[1].events.click();ui.setEngine('ia-cpu','gpu-failed');const cpu=await ui.api.aiCorrectText({});assert(ui.nodes['#generation-banner'].hidden,'Response does not duplicate the failure event');
  const output=ui.node();output.textContent=cpu.texto;ui.ui.markResult(cpu,output);assert.equal(output.textContent,cpu.texto,'Label is not part of copied result text');assert.equal(output.badge.title,'Synthetic model');
  assert(output.badge.textContent.includes(ui.locale.generation.cpu_label));
  ui.setEngine('sin-ia','ai-failed');await ui.api.aiCorrectText({});assert(!ui.nodes['#generation-banner'].hidden);assert(ui.nodes['#generation-banner'].children[0].textContent.includes(lang==='es'?'sin IA':'sense IA'));
  const restarted=renderer(lang);await restarted.ui.init();await restarted.api.aiCorrectText({});assert(!restarted.nodes['#generation-banner'].hidden,'Fresh session announces again');
  const translationFirst=renderer(lang);await translationFirst.ui.init();translationFirst.setEngine('sin-ia',null,true);await translationFirst.api.aiCorrectText({});assert(translationFirst.nodes['#generation-banner'].hidden,'First translation has only its label');
  translationFirst.setEngine('ia-gpu');await translationFirst.api.aiCorrectText({});assert(!translationFirst.nodes['#generation-banner'].hidden,'First writing result still announces after a translation');
  const noModel=renderer(lang);await noModel.ui.init();noModel.setEngine('sin-ia');await noModel.api.aiCorrectText({});assert(!noModel.nodes['#generation-banner'].hidden,'First writing result without a model announces');
 }
 const database=require('../src/main/db/database'),projects=require('../src/main/services/projectService');
 const db=await database.getDb(path.join(dir,'synthetic.sqlite'),{catalogPath:path.join(__dirname,'fixtures/catalog-minimal.json')});
 const id=await projects.createProject({municipio:'Synthetic export municipality',lema_es:'Synthetic ES',lema_ca:'Synthetic CA'});
 const project=await projects.getProject(id),measure=project.areas[0].medidas[0];
 db.run('INSERT INTO decisiones_medidas (id,proyecto_id,medida_id,estado,version_municipal_texto) VALUES (?,?,?,?,?)',['synthetic-decision',id,measure.id,'adaptada',fallback.texto]);database.save();
 const freshProject=await projects.getProject(id);
 const outfile=path.join(dir,'source-free.docx');const exported=await require('../src/main/services/docxExporter').exportProjectToDocx(freshProject,{outputPath:outfile,idioma:'es'});
 const filename=exported.filePath||exported.path||outfile;const zip=await JSZip.loadAsync(fs.readFileSync(filename));
 const xml=await zip.file('word/document.xml').async('string');assert(xml.includes(fallback.texto),'Export contains the actual generated measure');for(const forbidden of ['generation-engine-label','Motor de redacción:','IA local · procesador','Sin IA · método automático','No hay inteligencia artificial disponible'])assert(!xml.includes(forbidden));
 const stored=db.exec('SELECT * FROM decisiones_medidas')[0];assert(!JSON.stringify(stored).includes('generation.engine'));
 const pdfExporter=require('../src/main/services/pdfExporter');
 if(pdfExporter.detectConverters().canConvert){
  const pdf=await pdfExporter.exportProjectWithPdf(id,{outputPath:outfile,idioma:'es'});assert(pdf.success,pdf.message);
  const canvas=require('@napi-rs/canvas');for(const name of ['DOMMatrix','ImageData','Path2D'])global[name]=canvas[name];
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(pdf.pdfPath)),useSystemFonts:false,disableFontFace:true});const doc=await loading.promise;
  let text='';for(let page=1;page<=doc.numPages;page++)text+=(await(await doc.getPage(page)).getTextContent()).items.map(item=>item.str).join(' ');
  assert(text.includes('Synthetic fallback text'));for(const forbidden of ['Motor de redacción:','IA local · procesador','Sin IA · método automático','No hay inteligencia artificial disponible'])assert(!text.includes(forbidden));await loading.destroy();
 }else console.log('SKIP PDF provenance export: Word/LibreOffice not installed; DOCX validated.');
 database.closeDb();console.log('PASS main provenance GPU/CPU/no-AI/failure and concurrency; ES/CA banners once/new session/failure only, intentional translation label only, no duplicate event/response, frozen API, model label outside clipboard, DOCX and database without UI metadata.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
