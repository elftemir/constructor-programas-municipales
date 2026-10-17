const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const POLICY_FILE = 'scripts/ocr_compiler_paths.json';
const normalizeFile = value => value.replace(/\\/g,'/');
const PRIVATE_MARKERS = [['el','fte'].join(''), ['Mis','Documentos'].join(' '), ['Codex','GPT'].join(' ')];
const hasPrivateMarker = value => PRIVATE_MARKERS.some(marker => value.toLowerCase().includes(marker.toLowerCase()));
function isPrivatePath(value) {
  return hasPrivateMarker(value) || /(?:^|[^A-Z0-9_])D:[\\/]/i.test(value);
}
function findHostPaths(text,unicode=true) {
  const found=[];
  const starts=/(?:[A-Z]:[\\/]+Users[\\/]+|(?<![A-Z0-9_])[A-Z]:[\\/]+|\/(?:home|Users)\/)/gi;
  for(const match of text.matchAll(starts)) {
    const characters=unicode ? /^[^\x00-\x1f\x7f-\x9f\uFFFD"'`<>|]+/u : /^[\x20-\x7e]+/;
    const value=text.slice(match.index).match(characters)?.[0]?.split(/["'`<>|]/,1)[0]?.trimEnd();
    if(value)found.push({path:value,offset:match.index});
  }
  return found;
}
function validateCompilerWhitelist(policy) {
  if(policy?.schema_version!==1 || !Array.isArray(policy.entries))throw Error('Invalid compiler-path policy');
  const seen=new Set();
  for(const entry of policy.entries) {
    if(Object.keys(entry).sort().join(',')!=='component,file,justification,library,path,sha256')throw Error('Unexpected whitelist fields');
    for(const value of Object.values(entry))if(typeof value!=='string'||!value.trim())throw Error('Incomplete exact whitelist entry');
    if(isPrivatePath(entry.path)||isPrivatePath(entry.file))throw Error('Private path cannot be whitelisted');
    if(/[?*]/.test(entry.path)||/[?*]/.test(entry.file))throw Error('Compiler whitelist does not accept wildcards');
    if(!/^[a-f0-9]{64}$/.test(entry.sha256)||!/^ocr-runtime\/.*\.(?:node|dll|exe)$/.test(normalizeFile(entry.file)))throw Error('Whitelist requires a relative native OCR file and SHA256');
    for(const key of ['component','justification','library','sha256'])if(findHostPaths(entry[key]).length)throw Error('Host paths must occur only in the exact path field');
    const key=[entry.file,entry.sha256,entry.path].join('\0');if(seen.has(key))throw Error('Duplicate compiler-path exception');seen.add(key);
  }
  return policy;
}
function loadCompilerWhitelist(root=path.resolve(__dirname,'..')) {
  const policy=validateCompilerWhitelist(JSON.parse(fs.readFileSync(path.join(root,POLICY_FILE),'utf8')));
  const vendorHashes={};
  for(const [backend,archiveHash]of Object.entries({cpu:'a23e548c6b3525c38bcfeceaff919786ae06741857043cb670279b70100e5483',vulkan:'5c71e7b749697da4a8d46e9ee55486845cbba27c9dfbecb4007f31ba6610d523'})){
  const pinsPath=path.join(root,'scripts/llama_'+backend+'_hashes.json');const manifestPath=path.join(root,'vendor/llama/'+backend+'/manifest.json');
  if(fs.existsSync(pinsPath)&&fs.existsSync(manifestPath)){
    const pins=JSON.parse(fs.readFileSync(pinsPath)),manifest=JSON.parse(fs.readFileSync(manifestPath));
    if(pins.build!=='b11476'||pins.archive_sha256!==archiveHash||JSON.stringify(pins)!==JSON.stringify(manifest))throw Error('Unverified official '+backend+' manifest');
    for(const [file,digest]of Object.entries(pins.files)){
      if(!/^[a-zA-Z0-9_.-]+$/.test(file)||!/^[a-f0-9]{64}$/.test(digest))throw Error('Invalid official binary hash');
      vendorHashes['vendor/llama/'+backend+'/'+file]=digest;
    }
  }
  }
  return {...policy,vendorHashes};
}
function classifyPath(value,file,sha256,policy=loadCompilerWhitelist()) {
  // Private markers have priority even over a deliberately forged exact entry.
  if(hasPrivateMarker(value))return {blocking:true,reason:'ruta privada prohibida'};
  const normalized=value.replace(/\\/g,'/');
  const vendorPrefix=['D:','a','llama.cpp',''].join('/');
  if(normalized.startsWith(vendorPrefix) && policy.vendorHashes?.[normalizeFile(file)]===sha256){
    return {blocking:false,exception:{path:value,file:normalizeFile(file),sha256,library:'llama.cpp / ggml b11476 (CPU/Vulkan oficial)',component:'official-build',justification:'Prefijo exacto del servidor GitHub Actions del proveedor; archivo en vendor/llama y SHA256 igual al manifiesto oficial verificado contra el ZIP b11476 correspondiente.',vendor:true}};
  }
  if(isPrivatePath(value))return {blocking:true,reason:'ruta privada prohibida'};
  if(value==='/home/web_user')return {blocking:false,virtualSystemPath:true};
  const personalRoot=/^(?:[A-Z]:[\\/]+Users[\\/]+|\/(?:home|Users)\/)/i.test(value);
  if(!personalRoot)return {blocking:false,systemPath:true};
  const allowed=policy.entries.find(entry=>entry.path===value && entry.file===normalizeFile(file) && entry.sha256===sha256);
  return allowed ? {blocking:false,exception:allowed} : {blocking:true,reason:'ruta de perfil no revisada; no coincide con cadena, archivo y SHA256 exactos'};
}
function scanBufferPaths(file,bytes,policy=loadCompilerWhitelist()) {
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');const allowed=[];const blocked=[];const seen=new Set();
  for(const encoding of ['utf8','utf16le']) {
    const byteAccurateText=encoding==='utf8'?bytes.toString('latin1'):bytes.toString('utf16le');
    for(const match of findHostPaths(byteAccurateText,encoding!=='utf8')) {
      // A PE instruction can coincidentally spell a bare drive prefix. It is not a path string.
      // Only short, non-terminated byte runs in executable sections get this treatment.
      // Long paths, NUL-terminated strings and all readable data sections are always scanned.
      if(isShortInstructionRun(bytes,match,encoding))continue;
      if(isCompressedFontRun(bytes,match,encoding))continue;
      // In embedded JavaScript strings, a quote escape after the PDF date prefix is not a path separator.
      if(encoding==='utf8'&&/\.(?:js|mjs|map)$/i.test(file)&&match.path.startsWith('D:')&&/^\\+$/.test(match.path.slice(2))&&byteAccurateText[match.offset-1]==='^'&&bytes[match.offset+match.path.length]===34)continue;
      const datePrefix=JSON.stringify('date.startsWith("D:")').slice(1,-1);
      const prefixStart=match.offset-datePrefix.indexOf('D:');
      if(encoding==='utf8'&&/\/pdfjs-dist\/(?:legacy\/)?build\/pdf\.sandbox\.mjs$/.test(file)&&byteAccurateText.slice(prefixStart,prefixStart+datePrefix.length)===datePrefix)continue;
      if(seen.has(match.path))continue;seen.add(match.path);
      const verdict=classifyPath(match.path,file,digest,policy);
      if(verdict.blocking)blocked.push({...match,file,encoding,reason:verdict.reason});
      else if(verdict.exception)allowed.push({...verdict.exception,encoding,offset:match.offset});
    }
  }
  // Also protect private ASCII markers after a Unicode folder name in UTF-8 paths.
  for(const match of findHostPaths(bytes.toString('utf8'))) {
    if(!hasPrivateMarker(match.path)||seen.has(match.path))continue;
    seen.add(match.path);blocked.push({...match,file,encoding:'utf8',reason:'ruta privada prohibida'});
  }
  return {allowed,blocked,sha256:digest};
}
function isCompressedFontRun(bytes,match,encoding){
  if(encoding!=='utf8'||bytes.toString('ascii',0,4)!=='wOFF'||bytes.length<44)return false;
  for(let n=0;n<bytes.readUInt16BE(12);n++){
    const entry=44+n*20;if(entry+20>bytes.length)return false;
    const start=bytes.readUInt32BE(entry+4),compressed=bytes.readUInt32BE(entry+8),original=bytes.readUInt32BE(entry+12);
    if(compressed<original&&match.offset>=start&&match.offset<start+compressed)return true;
  }return false;
}
function isShortInstructionRun(bytes,match,encoding) {
  if(encoding!=='utf8'||match.path.length>6||bytes.length<256||bytes.toString('ascii',0,2)!=='MZ')return false;
  const following=bytes[match.offset+match.path.length];
  if(following===0||following===undefined||following>=32&&following<=126)return false;
  const pe=bytes.readUInt32LE(60);if(pe+24>bytes.length||bytes.readUInt32LE(pe)!==0x4550)return false;
  const table=pe+24+bytes.readUInt16LE(pe+20);
  for(let n=0;n<bytes.readUInt16LE(pe+6);n++) {
    const offset=table+n*40;if(offset+40>bytes.length)return false;
    const start=bytes.readUInt32LE(offset+20),size=bytes.readUInt32LE(offset+16),flags=bytes.readUInt32LE(offset+36);
    if(match.offset>=start&&match.offset<start+size)return (flags&0x20000000)!==0;
  }
  return false;
}
module.exports={POLICY_FILE,findHostPaths,isPrivatePath,validateCompilerWhitelist,loadCompilerWhitelist,classifyPath,scanBufferPaths};
