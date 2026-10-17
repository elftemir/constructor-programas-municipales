const fs=require('fs');const path=require('path');const assert=require('assert');const crypto=require('crypto');
const asar=require('@electron/asar');
const {archiveMemberPath,listArchiveFiles}=require('./auditar_distribucion_limpia');
const {loadCompilerWhitelist,classifyPath,scanBufferPaths,validateCompilerWhitelist}=require('./auditar_rutas');
const {auditSource}=require('./preparar_publicacion');
const {assertNoFixedReferences,AI_INSTALLER_FILE,AI_INSTALLER_COMMENTS}=require('./verificar_desvinculacion');
const root=path.resolve(__dirname,'..');const base=process.env.TEST_RUN_DIR||path.join(root,'scratch');
fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'audit-regression-'));
async function main(){
  const fixture=path.join(dir,'fixture');const relative='node_modules/@fontsource/inter/package.json';
  fs.mkdirSync(path.dirname(path.join(fixture,relative)),{recursive:true});
  fs.writeFileSync(path.join(fixture,relative),'{}');const archive=path.join(dir,'fixture.asar');
  await asar.createPackage(fixture,archive);
  assert.deepEqual(listArchiveFiles(archive),[relative]);
  for(const name of [relative,relative.replaceAll('/','\\'),'/'+relative,'\\'+relative.replaceAll('/','\\')]){
    assert.equal(asar.extractFile(archive,archiveMemberPath(name)).toString(),'{}');
  }
  console.log('PASS real ASAR fixture: nested scopes/fonts, directory filtering, slash/backslash and leading separators.');
  for(const comment of AI_INSTALLER_COMMENTS)assertNoFixedReferences(AI_INSTALLER_FILE,comment);
  for(const reference of ['Programa Marco 2027','Fase 1 en texto de catálogo','Catálogo bilingüe 1.4.1','123 medidas','12 áreas','catalogo_marco','fuente_marco_oficial']){
    assert.throws(()=>assertNoFixedReferences('src/renderer/locales/es.json',JSON.stringify(reference)),/Referencia fija/);
  }
  assert.throws(()=>assertNoFixedReferences(AI_INSTALLER_FILE,'// FASE 1: Programa Marco 2027'),/Referencia fija/);
  assert.throws(()=>assertNoFixedReferences('src/renderer/other.js','// FASE 1: Preparando instalación'),/Referencia fija/);
  assert.throws(()=>assertNoFixedReferences(AI_INSTALLER_FILE,JSON.stringify('// FASE 1: Preparando instalación')),/Referencia fija/,'A displayed string is not a code comment');
  console.log('PASS FASE filter: exact AI installer code comments only; every real program reference throws.');
  const policy=loadCompilerWhitelist();const reviewed=policy.entries[0];
  assert(classifyPath(reviewed.path,reviewed.file,reviewed.sha256,policy).exception);
  assert(classifyPath(reviewed.path+'.different',reviewed.file,reviewed.sha256,policy).blocking,'No prefix exception');
  assert(classifyPath(reviewed.path,reviewed.file+'.different',reviewed.sha256,policy).blocking,'Exact file');
  assert(classifyPath(reviewed.path,reviewed.file,'0'.repeat(64),policy).blocking,'Exact binary hash');
  const privatePaths=[
    ['C:','Users',['el','fte'].join(''),'private.sqlite'].join('\\'),
    ['C:','Temp',['Mis','Documentos'].join(' '),'file.txt'].join('\\'),
    ['C:','Temp',['Codex','GPT'].join(' '),'file.txt'].join('\\'),
    ['D:','workspace','file.txt'].join('\\'),
    ['D:',''].join('\\'),
    ['C:','Temp','ñ',['el','fte'].join(''),'file.txt'].join('\\'),
    ['','home',['el','fte'].join(''),'file.txt'].join('/'),['','Users',['el','fte'].join(''),'file.txt'].join('/')
  ];
  for(const value of privatePaths){
    const forged={schema_version:1,entries:[{...reviewed,path:value}]};
    assert(classifyPath(value,reviewed.file,reviewed.sha256,forged).blocking,'Private markers have priority');
    assert.throws(()=>validateCompilerWhitelist(forged),/Private path/);
    for(const encoding of ['utf8','utf16le'])assert(scanBufferPaths('test.native',Buffer.from(value+'\0',encoding),policy).blocked.length>0,value+' '+encoding);
    const file=path.join(dir,'private-fixture.txt');fs.writeFileSync(file,value);
    assert(auditSource(dir,['private-fixture.txt']).errors.length>0,'Source code must also block '+value);
  }
  for(const value of [['','home','runner','work','source.c'].join('/'),['','Users','runner','work','source.c'].join('/')]){
    assert(classifyPath(value,reviewed.file,reviewed.sha256,policy).blocking,'Unreviewed third-party-looking path is not automatically allowed');
  }
  assert.throws(()=>validateCompilerWhitelist({schema_version:1,entries:[{...reviewed,path:reviewed.path+'*'}]}),/wildcards/);
  const pdfDateCode=Buffer.from(JSON.stringify('date.startsWith("D:")'));
  assert.equal(scanBufferPaths('ocr-runtime/node_modules/pdfjs-dist/build/pdf.sandbox.mjs',pdfDateCode,policy).blocked.length,0);
  const actualDrivePath=['D:','private','file.txt'].join('\\');
  assert(scanBufferPaths('ocr-runtime/node_modules/pdfjs-dist/build/pdf.sandbox.mjs',Buffer.from(actualDrivePath),policy).blocked.length>0);
  const vendorFile='vendor/llama/cpu/ggml-base.dll';
  const vendorBytes=fs.readFileSync(path.join(root,vendorFile));
  const reviewedHash=crypto.createHash('sha256').update(vendorBytes).digest('hex');
  const buildPath=['D:','a','llama.cpp','source.c'].join('/');
  assert(classifyPath(buildPath,vendorFile,reviewedHash,policy).exception);
  assert(classifyPath(buildPath.replaceAll('/','\\'),vendorFile,reviewedHash,policy).exception);
  assert(classifyPath(buildPath,vendorFile,'0'.repeat(64),policy).blocking);
  assert(scanBufferPaths(vendorFile,Buffer.from(buildPath+'\0'),policy).blocked.length>0,'A fake vendor file has no exception');
  for(const marker of [['el','fte'].join(''),['Mis','Documentos'].join(' '),['Codex','GPT'].join(' ')])assert(classifyPath(buildPath+'/'+marker,vendorFile,reviewedHash,policy).blocking);
  assert(classifyPath(['D:','other','source.c'].join('/'),vendorFile,reviewedHash,policy).blocking);
  const originalNativeScan=scanBufferPaths(vendorFile,vendorBytes,policy);assert.equal(originalNativeScan.blocked.length,0);assert(originalNativeScan.allowed.length>0);
  console.log('PASS official CPU: normalized CI prefix plus exact vendor file/hash; fake vendor, other drives/paths and private markers rejected.');
  const pe=Buffer.alloc(2048);pe.write('MZ');pe.writeUInt32LE(128,60);pe.writeUInt32LE(0x4550,128);
  pe.writeUInt16LE(1,134);pe.writeUInt16LE(240,148);pe.write('.text',392);pe.writeUInt32LE(512,408);pe.writeUInt32LE(1024,412);pe.writeUInt32LE(0x60000020,428);
  const meaningful=['D:','private','file.txt'].join('\\');Buffer.from(meaningful+'\0').copy(pe,1024);
  assert(scanBufferPaths('test.native',pe,policy).blocked.some(item=>item.path===meaningful),'A real private path is detected even in a PE executable section');
  const vendor=fs.readFileSync(path.join(root,'resources',reviewed.file));
  assert.equal(crypto.createHash('sha256').update(vendor).digest('hex'),reviewed.sha256);
  const scanned=scanBufferPaths(reviewed.file,vendor,policy);
  assert.equal(scanned.blocked.length,0);assert.equal(scanned.allowed.length,policy.entries.length);
  assert.deepEqual(new Set(scanned.allowed.map(entry=>entry.path)),new Set(policy.entries.map(entry=>entry.path)));
  console.log('PASS exact compiler whitelist: '+scanned.allowed.length+' reviewed paths; unknown paths, prefix/file/hash changes and all private markers blocked in binary and source. Original vendor bytes retained.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
