// Build time only: pinned official CPU archive; runtime never downloads binaries.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),https=require('https'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),destination=path.join(root,'vendor/llama/cpu');
const release={build:'b11476',archive_sha256:'a23e548c6b3525c38bcfeceaff919786ae06741857043cb670279b70100e5483',url:'https://github.com/ggml-org/llama.cpp/releases/download/b11476/llama-b11476-bin-win-cpu-x64.zip'};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const permitted=name=>/^(?:llama-server\.exe|llama-server-impl\.dll|llama-common\.dll|llama\.dll|mtmd\.dll|ggml\.dll|ggml-base\.dll|ggml-rpc\.dll|ggml-cpu-[a-z0-9]+\.dll|libomp\.dll|LICENSE-LLVM-OpenMP)$/.test(name);
function download(url,remaining=3){return new Promise((resolve,reject)=>{
 const parsed=new URL(url);if(parsed.protocol!=='https:'||!['github.com','release-assets.githubusercontent.com'].includes(parsed.hostname))return reject(Error('Untrusted binary download host'));
 const request=https.get(parsed,{headers:{'User-Agent':'CPM-verified-runtime'}},response=>{
  if([301,302,303,307,308].includes(response.statusCode)){response.resume();if(!remaining)return reject(Error('Too many redirects'));return download(new URL(response.headers.location,url).href,remaining-1).then(resolve,reject);}
  if(response.statusCode!==200){response.resume();return reject(Error('Binary download HTTP '+response.statusCode));}
  const chunks=[];let total=0;response.on('data',chunk=>{total+=chunk.length;if(total>50*1024*1024)request.destroy(Error('Archive too large'));else chunks.push(chunk);});response.on('end',()=>resolve(Buffer.concat(chunks)));response.on('error',reject);
 });request.setTimeout(30000,()=>request.destroy(Error('Binary download timed out')));request.on('error',reject);
});}
async function main(){
 const runtimePins=path.join(root,"src/main/assets/runtime/llama_cpu_hashes.json");fs.mkdirSync(path.dirname(runtimePins),{recursive:true});fs.copyFileSync(path.join(root,"scripts/llama_cpu_hashes.json"),runtimePins);
 const pinsPath=path.join(root,'scripts/llama_cpu_hashes.json'),manifestPath=path.join(destination,'manifest.json');
 if(fs.existsSync(pinsPath)&&fs.existsSync(manifestPath)){
  const pins=JSON.parse(fs.readFileSync(pinsPath)),manifest=JSON.parse(fs.readFileSync(manifestPath));
  if(JSON.stringify(pins)===JSON.stringify(manifest)&&Object.entries(pins.files).every(([name,digest])=>fs.existsSync(path.join(destination,name))&&sha(fs.readFileSync(path.join(destination,name)))===digest)){console.log('Official CPU b11476 verified, files:',Object.keys(pins.files).length);return;}
 }
 const cache=path.join(root,'scratch/llama-b11476-cpu.zip');fs.mkdirSync(path.dirname(cache),{recursive:true});
 const archive=fs.existsSync(cache)&&sha(fs.readFileSync(cache))===release.archive_sha256?fs.readFileSync(cache):await download(release.url);
 if(sha(archive)!==release.archive_sha256)throw Error('Official archive SHA256 mismatch');fs.writeFileSync(cache,archive);
 const zip=await JSZip.loadAsync(archive);const files={};fs.mkdirSync(destination,{recursive:true});
 for(const [name,entry] of Object.entries(zip.files))if(!entry.dir&&permitted(name)){
  const bytes=await entry.async('nodebuffer');files[name]=sha(bytes);
  const prior=path.join(root,'resources/ai-runtime/llama.cpp',name);
  if(fs.existsSync(prior)&&sha(fs.readFileSync(prior))!==files[name])throw Error('Current CPU binary differs from official b11476: '+name);
  fs.writeFileSync(path.join(destination,name),bytes);
 }
 if(!files['llama-server.exe']||!files['ggml-base.dll'])throw Error('Incomplete CPU archive');
 const manifest={build:release.build,archive_sha256:release.archive_sha256,files:Object.fromEntries(Object.entries(files).sort())};
 if(fs.existsSync(pinsPath)&&JSON.stringify(JSON.parse(fs.readFileSync(pinsPath)))!==JSON.stringify(manifest))throw Error('Archive differs from committed binary hashes');
 fs.writeFileSync(pinsPath,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log('Official CPU b11476 extracted unchanged, files:',Object.keys(files).length);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,release};
