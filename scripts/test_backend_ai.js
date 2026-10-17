const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(root,'scratch/backend-tests-'));
for(const [key,leaf]of Object.entries({APPDATA:'roaming',LOCALAPPDATA:'local',USERPROFILE:'user',TEMP:'temp',TMP:'temp'})){process.env[key]=path.join(directory,leaf);fs.mkdirSync(process.env[key],{recursive:true});}
const {BackendSelection,parseDevices,candidateDevices,validateBackendRequest}=require('../src/main/services/ai/backendSelection');
const {LlamaServerManager}=require('../src/main/services/ai/aiProvider');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const model=path.join(directory,'synthetic.gguf');fs.writeFileSync(model,Buffer.alloc(2*1024*1024));
function fixture(name,stdout='',failure=null){
 const base=path.join(directory,name),pins={};
 for(const backend of ['cpu','vulkan']){const dir=path.join(base,'vendor/llama',backend);fs.mkdirSync(dir,{recursive:true});const bytes=Buffer.from('synthetic '+backend);fs.writeFileSync(path.join(dir,'llama-server.exe'),bytes);pins[backend]={build:'b11476',files:{'llama-server.exe':sha(bytes)}};fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(pins[backend]));}
 let probes=0;const selection=new BackendSelection({root:base,pins,configFile:path.join(base,'settings.json'),appVersion:'3.8.0',exec:(file,args,options,done)=>{probes++;assert.deepEqual(args,['--list-devices']);assert.equal(options.timeout,10000);assert.equal(options.windowsHide,true);done(failure,stdout,'');}});
 return {base,selection,getProbes:()=>probes};
}
async function main(){
 const dedicated='Available devices:\n  Vulkan0: NVIDIA Dedicated (8192 MiB, 7000 MiB free)';
 const cases=[['none',''],['software','Vulkan0: llvmpipe (8192 MiB, 7000 MiB free)'],['integrated','Vulkan0: Intel UHD (1 MiB, 1 MiB free)'],['corrupt','Vulkan0: unexpected device data'],['timeout','',Object.assign(Error('Synthetic timeout'),{killed:true})]];
 for(const [name,output,error]of cases){const {selection}=fixture(name,output,error);await selection.detect(model,()=>{throw Error('No candidate may be benchmarked');});assert.equal(selection.getStatus().backend,'cpu');}
 assert.equal(candidateDevices(parseDevices(dedicated),1024**3).length,1);
 assert.equal(candidateDevices(parseDevices('Vulkan0: SwiftShader (8 GiB, 7 GiB free)'),1024**3).length,0);
 const fast=fixture('fast',dedicated);let benchmarks=0;
 await fast.selection.detect(model,async options=>{benchmarks++;return {tokensPerSecond:options.backend==='gpu'?40:10,valid:true};});
 assert.equal(fast.selection.getStatus().backend,'gpu');assert.equal(benchmarks,2);assert.equal(fast.getProbes(),1);
 await fast.selection.detect(model,()=>{throw Error('Cached result must not be benchmarked twice');});
 assert.equal(fast.getProbes(),1);assert((await fast.selection.select(model)).backend==='gpu');
 const persisted=JSON.parse(fs.readFileSync(path.join(fast.base,'settings.json')));assert(persisted.modelHash&&persisted.key&&persisted.date);assert.equal(persisted.llamaVersion,'b11476');
 fs.appendFileSync(path.join(fast.base,'vendor/llama/vulkan/llama-server.exe'),'tampered');
 assert.equal((await fast.selection.select(model)).backend,'cpu');assert.equal(fast.selection.getStatus().status,'gpu-failed');
 assert.equal(fast.getProbes(),1,'A failed GPU is not probed again for the same key');
 fast.selection.reset();assert.equal(fast.selection.config.key,undefined);
 const slow=fixture('integrated-slow','Vulkan0: Intel Iris (8192 MiB, 7000 MiB free)');
 await slow.selection.detect(model,async options=>({tokensPerSecond:options.backend==='gpu'?12:10,valid:true}));assert.equal(slow.selection.getStatus().backend,'cpu');
 const changed=fixture('version-change',dedicated);changed.selection.config.key='old-version';assert((await changed.selection.select(model)).needsDetection);
 assert.deepEqual(validateBackendRequest({mode:'gpu'}),{mode:'gpu'});for(const value of [{mode:'invalid'},null,[],{path:'unsafe'},'cpu'])assert.throws(()=>validateBackendRequest(value));
 const manager=new LlamaServerManager();let running=0,retries=0,failed=0;
 manager.scheduleDetection=()=>{};manager.backendSelection.markFailed=()=>{failed++;};
 manager.ensureServerRunning=async(_,__,forced)=>{if(!running)running++;assert.equal(running,1);manager.activeBackend=forced?.backend||'gpu';return 'http://127.0.0.1:1';};
 manager.stopServer=async()=>{running=0;};
 const response=await manager.withRequest(model,'synthetic',async()=>{retries++;if(manager.activeBackend==='gpu')throw Error('GPU process closed mid-request');return 'CPU result';});
 assert.equal(response,'CPU result');assert.equal(retries,3,'Unhealthy server: one GPU recovery attempt, then a single CPU attempt');assert.equal(failed,1);assert.equal(running,1);await manager.stopServer();
 const {loadCompilerWhitelist,classifyPath}=require('./auditar_rutas');const policy=loadCompilerWhitelist();
 const ci=['D:','a','llama.cpp','x'].join('/'),file='vendor/llama/vulkan/fake.dll';assert(classifyPath(ci,file,sha(Buffer.from(ci)),policy).blocking,'A fake Vulkan file with a provider prefix must fail');
 console.log('PASS GPU: six device cases, software/low VRAM discarded, speed threshold/integrated, cache/key/reset, corrupted hash -> CPU, one retry after GPU exit, one server, strict IPC and fake Vulkan rejection.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
