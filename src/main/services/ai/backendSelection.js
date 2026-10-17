const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFile}=require('child_process');
const {getUserDataDir}=require('../../utils/paths');
const BUILD='b11476',MODES=new Set(['auto','cpu','gpu']);
const pins={cpu:require('../../assets/runtime/llama_cpu_hashes.json'),vulkan:require('../../assets/runtime/llama_vulkan_hashes.json')};
// The pins are packaged as application data by the build; renderer paths are never accepted.
function hashFile(filename){return new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256'),stream=fs.createReadStream(filename);stream.on('data',chunk=>hash.update(chunk));stream.on('error',reject);stream.on('end',()=>resolve(hash.digest('hex')));});}
function parseDevices(text){
 const devices=[];
 for(const line of String(text).split(/\r?\n/)){
  const match=line.match(/^\s*(Vulkan\d+):\s*(.+?)\s*\((\d+(?:\.\d+)?)\s*(MiB|GiB),\s*(\d+(?:\.\d+)?)\s*(MiB|GiB)\s+free\)\s*$/i);
  if(!match)continue;const unit=u=>u.toLowerCase()==='gib'?1024**3:1024**2;
  const total=Number(match[3])*unit(match[4]),free=Number(match[5])*unit(match[6]);
  if(total<=0||free<0||free>total)continue;
  devices.push({id:match[1],name:match[2],totalBytes:total,freeBytes:free,integrated:/intel|iris|uhd|radeon(?:\(tm\))? graphics|apu/i.test(match[2]),software:/llvmpipe|microsoft basic render|swiftshader/i.test(match[2])});
 }return devices;
}
function candidateDevices(devices,modelBytes){return devices.filter(device=>!device.software&&device.totalBytes>=modelBytes*1.2).sort((a,b)=>b.freeBytes-a.freeBytes);}
class BackendSelection{
 constructor(options={}){
  this.root=options.root||process.resourcesPath||path.resolve(__dirname,'../../../..');
  this.configFile=options.configFile||path.join(getUserDataDir(),'ai-backend.json');
  this.appVersion=options.appVersion||require('../../../../package.json').version;
  this.exec=options.exec||execFile;this.hash=options.hash||hashFile;this.pins=options.pins||pins;
  this.config={mode:'auto',backend:'cpu'};try{Object.assign(this.config,JSON.parse(fs.readFileSync(this.configFile,'utf8')));}catch(_){}
  if(!MODES.has(this.config.mode))this.config.mode='auto';
  this.listeners=new Set();this.state={mode:this.config.mode,backend:'cpu',status:'idle',device:null,cpuTokensPerSecond:null,gpuTokensPerSecond:null};
  this.modelCache=null;this.detecting=null;
 }
 async verify(backend){
  const manifest=this.pins[backend],base=path.join(this.root,'vendor/llama',backend);
  if(!manifest||manifest.build!==BUILD)throw Error('Unverified backend manifest');
  const actual=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
  if(JSON.stringify(actual)!==JSON.stringify(manifest))throw Error('Backend manifest differs from application pins');
  for(const [file,digest]of Object.entries(manifest.files)){
   if(!/^[a-zA-Z0-9_.-]+$/.test(file)||await this.hash(path.join(base,file))!==digest)throw Error('Backend binary hash mismatch: '+file);
  }return path.join(base,'llama-server.exe');
 }
 save(){fs.mkdirSync(path.dirname(this.configFile),{recursive:true});const temporary=this.configFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify(this.config,null,2)+'\n');fs.renameSync(temporary,this.configFile);}
 notify(patch){Object.assign(this.state,patch);for(const callback of this.listeners)callback(this.getStatus());}
 onStatus(callback){this.listeners.add(callback);return()=>this.listeners.delete(callback);}
 getStatus(){return JSON.parse(JSON.stringify({...this.state,mode:this.config.mode,failed:!!this.config.failed,failure:this.config.failed?this.config.failure:null,fallbackReason:this.config.fallbackReason||null,...(this.config.failed?{backend:'cpu',status:'gpu-failed'}:{})}));}
 setMode(mode){if(!MODES.has(mode))throw TypeError('Invalid AI processing mode');this.config.mode=mode;this.save();this.notify({mode,backend:mode==='cpu'?'cpu':this.state.backend});}
 reset(){delete this.config.key;delete this.config.failed;delete this.config.failure;delete this.config.fallbackReason;this.config.backend='cpu';this.save();this.notify({backend:'cpu',status:'idle'});}
 async modelKey(modelPath){
  const stat=fs.statSync(modelPath),stamp=modelPath+'|'+stat.size+'|'+stat.mtimeMs;
  if(this.modelCache?.stamp!==stamp)this.modelCache={stamp,digest:await this.hash(modelPath)};
  return {key:this.appVersion+'|'+BUILD+'|'+this.modelCache.digest,modelHash:this.modelCache.digest,modelBytes:stat.size};
 }
 async select(modelPath){
  const model=await this.modelKey(modelPath);let backend='cpu';
  if(this.config.mode!=='cpu'&&this.config.key===model.key&&this.config.backend==='gpu'&&!this.config.failed)backend='gpu';
  let executable;
  try{executable=await this.verify(backend==='gpu'?'vulkan':'cpu');}
  catch(error){if(backend!=='gpu')throw error;this.markFailed(error);backend='cpu';executable=await this.verify('cpu');}
  this.notify({backend,device:backend==='gpu'?this.config.device:null,cpuTokensPerSecond:this.config.cpuTokensPerSecond||null,gpuTokensPerSecond:this.config.gpuTokensPerSecond||null});
  return {backend,executable,ngl:backend==='gpu'?(this.config.ngl||99):0,device:backend==='gpu'?this.config.device:null,model,needsDetection:this.config.mode!=='cpu'&&this.config.key!==model.key};
 }
 markFailed(error){this.config.failed=true;this.config.backend='cpu';this.config.failure=String(error?.message||error).slice(0,300);this.config.date=new Date().toISOString();this.save();console.warn('[AI backend] GPU fallback:',this.config.failure);this.notify({backend:'cpu',status:'gpu-failed',device:null});}
 async listDevices(){
  const executable=await this.verify('vulkan');
  return new Promise((resolve,reject)=>this.exec(executable,['--list-devices'],{timeout:10000,windowsHide:true,maxBuffer:256*1024},(error,stdout,stderr)=>error?reject(error):resolve(parseDevices(String(stdout)+'\n'+String(stderr)))));
 }
 async detect(modelPath,benchmark,signal){
  if(this.detecting)return this.detecting;
  this.detecting=this.detectOnce(modelPath,benchmark,signal).finally(()=>{this.detecting=null;});return this.detecting;
 }
 async detectOnce(modelPath,benchmark,signal){
  const model=await this.modelKey(modelPath);if(this.config.mode==='cpu')return this.getStatus();
  if(this.config.key===model.key)return this.getStatus();
  this.notify({status:'detecting'});
  try{
   const devices=await this.listDevices();if(signal?.aborted)throw Object.assign(Error('Benchmark preempted'),{code:'PREEMPTED'});
   const device=candidateDevices(devices,model.modelBytes)[0];
   if(!device){Object.assign(this.config,{...model,backend:'cpu',device:null,date:new Date().toISOString(),llamaVersion:BUILD,appVersion:this.appVersion,failed:false,failure:null,fallbackReason:'NO_COMPATIBLE_GPU'});this.save();this.notify({backend:'cpu',status:'no-gpu',device:null});return this.getStatus();}
   this.notify({status:'benchmarking',candidate:device});
   // b11476 supports --fit on: unset layers can be reduced to fit device memory.
   const cpu=await benchmark({backend:'cpu',ngl:0,device:null,signal});
   const gpu=await benchmark({backend:'gpu',ngl:99,device,fit:device.freeBytes<model.modelBytes*1.2,signal});
   if(signal?.aborted)throw Object.assign(Error('Benchmark preempted'),{code:'PREEMPTED'});
   if(!cpu.valid||!gpu.valid||!(cpu.tokensPerSecond>0)||!(gpu.tokensPerSecond>0))throw Error('Invalid benchmark output');
   const backend=gpu.tokensPerSecond>=cpu.tokensPerSecond*1.3?'gpu':'cpu';
   Object.assign(this.config,{...model,backend,device,ngl:gpu.ngl||99,cpuTokensPerSecond:cpu.tokensPerSecond,gpuTokensPerSecond:gpu.tokensPerSecond,failed:false,failure:null,fallbackReason:backend==='cpu'?'GPU_BELOW_SPEED_THRESHOLD':null,date:new Date().toISOString(),appVersion:this.appVersion,llamaVersion:BUILD});
   this.save();this.notify({backend,status:'ready',device:backend==='gpu'?device:null,cpuTokensPerSecond:cpu.tokensPerSecond,gpuTokensPerSecond:gpu.tokensPerSecond});return this.getStatus();
  }catch(error){if(error.code==='PREEMPTED'||signal?.aborted){this.notify({status:'idle'});return this.getStatus();}Object.assign(this.config,model);this.markFailed(error);return this.getStatus();}
 }
}
function validateBackendRequest(value){
 if(value===undefined)return {};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['mode','ackRetirement'].includes(key)))throw TypeError('Invalid backend request');
 if(value.mode!==undefined&&!MODES.has(value.mode))throw TypeError('Invalid AI processing mode');
 if(value.ackRetirement!==undefined&&value.ackRetirement!==true)throw TypeError('Invalid retirement acknowledgment');
 return {...(value.mode===undefined?{}:{mode:value.mode}),...(value.ackRetirement?{ackRetirement:true}:{})};
}
module.exports={BackendSelection,parseDevices,candidateDevices,hashFile,MODES,BUILD,validateBackendRequest};
