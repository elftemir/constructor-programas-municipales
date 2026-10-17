const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),vm=require('vm');
const root=path.resolve(__dirname,'..'),base=process.env.CPM_TEST_ROOT||path.join(root,'scratch');fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'availability-'));
for(const key of ['APPDATA','LOCALAPPDATA','USERPROFILE','TEMP','TMP']){process.env[key]=path.join(dir,key);fs.mkdirSync(process.env[key],{recursive:true});}
const service=require('../src/main/services/ai/aiService');const source=require('../src/main/services/ai/generationSource');
async function main(){
 const bytes=Buffer.alloc(1000004);bytes.write('GGUF');const file=path.join(dir,'synthetic.gguf');fs.writeFileSync(file,bytes);const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 service.catalog=[{id:'synthetic-model',filename:'synthetic.gguf',name:'Synthetic verified model',sha256:hash}];service.getModelFilePath=()=>file;
 const manager=service.serverManager;manager.backendSelection.verify=async()=>{};manager.process={pid:123};manager.status='READY';manager.activeModelId='synthetic-model';manager.activeModelPath=file;manager.activeBackend='gpu';manager.activeRuntimePath=path.join(dir,'vulkan/llama-server.exe');manager.actualGpuLayers=35;manager.backendSelection.config.device='Synthetic GPU';
 manager.actualGpuLayers=0;manager.captureGpuLayers('load_tensors: offlo');manager.captureGpuLayers('aded 35/35 layers to GPU');assert.equal(manager.actualGpuLayers,35,'Layer diagnostics survive split log chunks');
 source.recordFallback('ai-failed');const available=await service.getAvailability();assert.equal(available.engine,'ia-gpu');assert(available.available,'Last automatic operation must not mask a usable model');const diag=manager.getDiagnosticInfo();assert.equal(diag.runtimePath,manager.activeRuntimePath);assert.equal(diag.gpuLayers,35);assert.equal(diag.device,'Synthetic GPU');
 service.catalog[0].sha256='0'.repeat(64);assert(!(await service.getAvailability()).available,'Corrupt model is unavailable');service.catalog[0].sha256=hash;manager.activeBackend='cpu';assert.equal((await service.getAvailability()).engine,'ia-cpu');manager.process=null;manager.status='STOPPED';assert.equal(manager.getDiagnosticInfo().runtimePath,null,'No running server has no active path');
 const i18n=require('../src/renderer/js/i18n');
 for(const lang of ['es','ca']){
  i18n.currentLang=lang;const locale=require('../src/renderer/locales/'+lang+'.json');const visit=(object,prefix='')=>{for(const [key,value]of Object.entries(object)){const name=prefix?prefix+'.'+key:key;if(typeof value==='object')visit(value,name);else{const params={};for(const token of String(value).matchAll(/\{+([A-Za-z0-9_]+)\}+/g))params[token[1]]='Synthetic value';assert(!/\{[^}]*\}/.test(i18n.t(name,params)),name);}}};visit(locale);
  assert(i18n.t('generation.gpu_banner',{model:'Synthetic verified model'}).includes('Synthetic verified model'));
  const node=()=>({textContent:'',hidden:true,children:[],events:{},replaceChildren(){this.children=[];},append(...items){this.children.push(...items);},addEventListener(e,cb){this.events[e]=cb;},remove(){},insertAdjacentElement(_,item){this.badge=item;}});
  const nodes={'#generation-engine-indicator':node(),'#generation-banner':node()};const ctx=vm.createContext({Set,WeakMap,Proxy,window:{i18n,api:{},App:{}},document:{querySelector:id=>nodes[id],createElement:node}});vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/js/utils/generationUi.js'),'utf8'),ctx);const ui=ctx.window.GenerationUi;
  ui.acceptAvailability(available);assert(nodes['#generation-engine-indicator'].textContent.includes(available.modelName));
  let banners=0;const original=ui.showBanner.bind(ui);ui.showBanner=(...args)=>{banners++;original(...args);};
  for(let n=0;n<5;n++){ui.consume({ok:true,availability:available,generation:{engine:'ia-gpu',modelName:available.modelName}});ui.bannerOpen=false;nodes['#generation-banner'].hidden=true;const translation={ok:true,availability:available,generation:{engine:'sin-ia',labelOnly:true}};ui.consume(translation);const output=node();ui.markResult(translation,output);assert(output.badge.textContent.includes(locale.generation.translation_label));assert(nodes['#generation-engine-indicator'].textContent.includes(available.modelName));}
  assert.equal(banners,1,'Five writing/translation alternations announce once');
  ui.consume({ok:false,error:{code:'INVALID_GENERATION'},availability:available});assert.equal(ui.banner.key,'generation.failed_retry');assert(!nodes['#generation-banner'].children[0].textContent.includes('{'));assert(ui.availability.available);
  ui.consume({ok:true,availability:available,generation:{engine:'sin-ia',fallbackReason:'ai-failed'}});assert.equal(ui.banner.key,'generation.failed_fallback');assert(ui.availability.available);
  const cpu={...available,engine:'ia-cpu'};ui.consumeBackendState({status:'gpu-failed',availability:cpu});const count=banners;ui.consume({ok:true,availability:cpu,generation:{engine:'ia-cpu',modelName:cpu.modelName,fallbackReason:'gpu-failed'}});assert.equal(banners,count,'GPU event/response do not duplicate warning');
  ui.acceptAvailability({available:false,engine:'sin-ia',modelName:null});assert(nodes['#generation-engine-indicator'].textContent.endsWith(locale.generation.no_ai_short));
  const box={innerHTML:'',style:{}};const diagnostic={...diag,serverRunning:true,serverReady:true,backend:'gpu',modelName:available.modelName,runtimeAvailable:true};
  const view=vm.createContext({console,window:{api:{aiGetSpecs:async()=>({}),aiGetDiagnostic:async()=>diagnostic}},escapeHtml:value=>String(value),document:{querySelector:id=>id==='#spec-server-status-box'?box:null}});
  vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/js/views/aiView.js'),'utf8'),view);await view.window.AiView.loadSpecs(lang==='ca');assert(box.innerHTML.includes('Vulkan'));assert(box.innerHTML.includes('Synthetic GPU'));assert(box.innerHTML.includes('35'));assert(box.innerHTML.includes(manager.activeRuntimePath));
 }
 console.log('PASS verified model availability independent of last operation; active runtime/device/layers; real ES/CA interpolation for every locale; five alternations, retry/fallback/GPU banners and distinct translation labels.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
