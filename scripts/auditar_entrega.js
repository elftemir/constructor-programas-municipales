// Read-only checks of public files and extraction into a new scratch directory.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),JSZip=require('jszip');
const {spawnSync}=require('child_process');
const {listPublicFiles,auditSource,installerChecks}=require('./preparar_publicacion');
const {auditPackage,auditSection}=require('./auditar_distribucion_limpia');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const privateMarkers=[['el','fte'].join(''),['Mis','Documentos'].join(' '),['Codex','GPT'].join(' ')];
async function publicAudit(root,phrases=[]){
 const listing=listPublicFiles(root),base=auditSource(root,listing.files),errors=[...listing.unsafe,...base.errors];
 const phraseResults=phrases.map(text=>({text,files:[]}));
 for(const rel of listing.files){
  const bytes=fs.readFileSync(path.join(root,rel));let text=bytes.toString('utf8')+'\n'+bytes.toString('utf16le');
  if(/\.docx$/i.test(rel)){const zip=await JSZip.loadAsync(bytes);text+='\n'+(await Promise.all(Object.keys(zip.files).filter(name=>name.endsWith('.xml')).map(name=>zip.file(name).async('string')))).join('\n');}
  const withoutPublicAccount=text.replace(/elftemir/gi,'PUBLIC_ACCOUNT');
  if(privateMarkers.some(value=>withoutPublicAccount.toLowerCase().includes(value.toLowerCase()))||/(?:^|[^a-z0-9_])D:[\\/]/i.test(withoutPublicAccount))errors.push(rel+': marcador privado o ruta de unidad prohibida');
  const normalized=text.replace(/\s+/g,' ');
  for(const item of phraseResults)if(normalized.includes(item.text))item.files.push(rel);
 }
 for(const item of phraseResults)if(item.files.length)errors.push('Texto privado en '+item.files.join(', '));
 return {errors,entries:base.entries,totalBytes:base.totalBytes,excluded:listing.excluded,phrases:phraseResults};
}
function walk(dir,base=''){return fs.readdirSync(path.join(dir,base),{withFileTypes:true}).flatMap(entry=>{
 if(entry.isSymbolicLink())throw Error('Unexpected link');const rel=path.join(base,entry.name);
 return entry.isDirectory()?walk(dir,rel):[rel.replaceAll('\\','/')];});}
async function payloadAudit(root){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),installer=installerChecks(root,pkg);
 if(installer.errors.length)throw Error(installer.errors.join('\n'));
 const seven=await require('app-builder-lib/out/toolsets/7zip').getPath7za();
 const dir=fs.mkdtempSync(path.join(root,'scratch/payload-')),outer=path.join(dir,'outer');let inner=path.join(dir,'inner');
 function run(args){const result=spawnSync(seven,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});if(result.status!==0)throw Error('7-Zip: '+(result.error?.message||result.stderr||result.stdout));return result.stdout;}
 const outerList=run(['l',path.join(root,'dist',installer.exe)]);
 run(['x',path.join(root,'dist',installer.exe),'-o'+outer,'-y']);
 const payload=walk(outer).filter(rel=>/(?:^|\/)app-(?:64|x64)\.7z$/.test(rel));let innerList='';
 if(payload.length===1){innerList=run(['l',path.join(outer,payload[0])]);run(['x',path.join(outer,payload[0]),'-o'+inner,'-y']);}
 else if(payload.length===0&&fs.existsSync(path.join(outer,'resources/app.asar'))){inner=outer;innerList='7-Zip extracted the NSIS application payload directly.';}
 else throw Error('Expected exactly one x64 application payload');
 const unpacked=path.join(root,'dist/win-unpacked'),actual=walk(inner),expected=walk(unpacked),errors=[],entries=[];
 for(const rel of expected){const candidate=path.join(inner,rel);if(!fs.existsSync(candidate)){errors.push('Missing payload member: '+rel);continue;}
  const digest=sha(fs.readFileSync(candidate)),baseline=sha(fs.readFileSync(path.join(unpacked,rel)));if(digest!==baseline)errors.push('Payload differs: '+rel);entries.push({file:rel,sha256:digest});}
 for(const rel of actual)if(!expected.includes(rel))errors.push('Unexpected payload member: '+rel);
 fs.writeFileSync(path.join(root,'scratch/LISTADO_PAYLOAD_EXE_'+pkg.version+'.txt'),outerList+'\n'+innerList);
 return {errors,files:entries,installerSha256:installer.sha256,installerBytes:installer.size,executedInstaller:false};
}
async function finalAudit(root,phrases){
 if(phrases.length!==4)throw Error('Four actual private phrases required');
 const source=await publicAudit(root,phrases),packed=await auditPackage(root,{privatePhrases:phrases}),payload=await payloadAudit(root);
 const result={source,packed:{...packed,fullList:undefined,resourceInventory:undefined},payload,errors:[...source.errors,...packed.errors,...payload.errors]};
 const scratch=path.join(root,'scratch'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
 fs.writeFileSync(path.join(scratch,'LISTADO_ASAR_'+version+'.txt'),packed.fullList+'\n');
 fs.writeFileSync(path.join(scratch,'LISTADO_RESOURCES_'+version+'.txt'),packed.resourceInventory+'\n');
 fs.writeFileSync(path.join(scratch,'DISTRIBUCION_VACIA_'+version+'.txt'),auditSection(packed));
 fs.writeFileSync(path.join(scratch,'AUDITORIA_FINAL_'+version+'.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({errors:result.errors,sourceFiles:source.entries.length,asarFiles:packed.asarFiles,resourcesFiles:packed.resourcesFiles,payloadFiles:payload.files.length,sha256:payload.installerSha256},null,2));
 if(result.errors.length)throw Error('NO PUBLICAR');return result;
}
if(require.main===module){const root=path.resolve(__dirname,'..'),phraseFile=process.argv[2];if(!phraseFile)throw Error('Provide private phrase evidence file (local only)');finalAudit(root,JSON.parse(fs.readFileSync(phraseFile))).catch(error=>{console.error(error);process.exitCode=1;});}
module.exports={publicAudit,payloadAudit,finalAudit,sha};
