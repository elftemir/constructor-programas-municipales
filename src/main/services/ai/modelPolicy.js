const fs=require('fs'),crypto=require('crypto');
const DEFAULT_MODEL_ID='qwen2.5-1.5b-instruct-q4',QUALITY_MODEL_ID='qwen3-4b-instruct-2507-q4';
// Identification of an old download is retained only for explicit removal.
const RETIRED_MODEL=Object.freeze({id:'qwen2.5-3b-instruct-q4',filename:'qwen2.5-3b-instruct-q4_k_m.gguf',sha256:'626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d'});
function isRetired(model){return [model?.id,model?.repoId,model?.filename,model?.name,model?.hfModel].some(value=>/qwen[\s._-]*2[._]5[\s/_-]*3b/i.test(String(value||'')))||model?.sha256===RETIRED_MODEL.sha256;}
function verifyFileSha256(file,expected){let fd;try{if(!/^[a-f0-9]{64}$/i.test(expected||''))return false;fd=fs.openSync(file,'r');const hash=crypto.createHash('sha256'),chunk=Buffer.alloc(1024*1024);let n;while((n=fs.readSync(fd,chunk,0,chunk.length,null))>0)hash.update(chunk.subarray(0,n));return hash.digest('hex')===expected.toLowerCase();}catch(_){return false;}finally{if(fd!==undefined)fs.closeSync(fd);}}
module.exports={DEFAULT_MODEL_ID,QUALITY_MODEL_ID,RETIRED_MODEL,isRetired,verifyFileSha256};
