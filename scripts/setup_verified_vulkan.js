// Build-time download only. Never download executable code during inference.
const fs=require('fs'),path=require('path'),https=require('https'),crypto=require('crypto'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),destination=path.join(root,'vendor/llama/vulkan');
const release={build:'b11476',archive_sha256:'5c71e7b749697da4a8d46e9ee55486845cbba27c9dfbecb4007f31ba6610d523',url:'https://github.com/ggml-org/llama.cpp/releases/download/b11476/llama-b11476-bin-win-vulkan-x64.zip'};
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function download(url,remaining=3){return new Promise((resolve,reject)=>{
 const target=new URL(url);if(target.protocol!=='https:'||!['github.com','release-assets.githubusercontent.com'].includes(target.hostname))return reject(Error('Untrusted Vulkan download host'));
 const request=https.get(target,{headers:{'User-Agent':'CPM-runtime-setup'}},response=>{
  if([301,302,303,307,308].includes(response.statusCode)){response.resume();if(!remaining)return reject(Error('Too many redirects'));return download(new URL(response.headers.location,url).href,remaining-1).then(resolve,reject);}
  if(response.statusCode!==200){response.resume();return reject(Error('Vulkan download HTTP '+response.statusCode));}
  const chunks=[];let size=0;response.on('data',chunk=>{size+=chunk.length;if(size>100*1024*1024)request.destroy(Error('Vulkan archive too large'));else chunks.push(chunk);});response.on('end',()=>resolve(Buffer.concat(chunks)));response.on('error',reject);
 });request.setTimeout(30000,()=>request.destroy(Error('Vulkan download timed out')));request.on('error',reject);
});}
async function main(){
 const runtimePins=path.join(root,"src/main/assets/runtime/llama_vulkan_hashes.json");fs.mkdirSync(path.dirname(runtimePins),{recursive:true});fs.copyFileSync(path.join(root,"scripts/llama_vulkan_hashes.json"),runtimePins);
 const pins=JSON.parse(fs.readFileSync(path.join(root,'scripts/llama_vulkan_hashes.json'))),manifestPath=path.join(destination,'manifest.json');
 if(pins.build!==release.build||pins.archive_sha256!==release.archive_sha256)throw Error('Vulkan pins do not match the official archive');
 if(fs.existsSync(manifestPath)&&JSON.stringify(JSON.parse(fs.readFileSync(manifestPath)))===JSON.stringify(pins)&&Object.entries(pins.files).every(([file,digest])=>fs.existsSync(path.join(destination,file))&&sha(fs.readFileSync(path.join(destination,file)))===digest)){console.log('Official Vulkan b11476 verified:',Object.keys(pins.files).length,'files');return;}
 const cache=path.join(root,'scratch/llama-b11476-vulkan.zip');fs.mkdirSync(path.dirname(cache),{recursive:true});
 const bytes=fs.existsSync(cache)&&sha(fs.readFileSync(cache))===release.archive_sha256?fs.readFileSync(cache):await download(release.url);
 if(sha(bytes)!==release.archive_sha256)throw Error('Vulkan archive hash mismatch');fs.writeFileSync(cache,bytes);
 const zip=await JSZip.loadAsync(bytes);fs.mkdirSync(destination,{recursive:true});
 for(const [file,digest]of Object.entries(pins.files)){
  if(!/^[a-zA-Z0-9_.-]+$/.test(file))throw Error('Invalid pinned filename');const entry=zip.file(file);if(!entry)throw Error('Missing Vulkan file '+file);
  const data=await entry.async('nodebuffer');if(sha(data)!==digest)throw Error('Vulkan binary hash mismatch: '+file);fs.writeFileSync(path.join(destination,file),data);
 }
 fs.writeFileSync(manifestPath,JSON.stringify(pins,null,2)+'\n');console.log('Official Vulkan b11476 extracted unchanged:',Object.keys(pins.files).length,'files');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,release};
