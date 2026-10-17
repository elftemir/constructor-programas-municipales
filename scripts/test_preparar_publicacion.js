const fs = require('fs'); const path = require('path'); const assert = require('assert'); const { spawnSync } = require('child_process');
const { prepare, listPublicFiles, auditSource, installerChecks, forbiddenReason } = require('./preparar_publicacion');
const root = path.resolve(__dirname, '..');
const base = fs.mkdtempSync(path.join(root, 'scratch/publication-tests-'));
const PUBLICATIONS = require('./publicacion_guia').PUBLICATIONS;
function write(dir, file, data = 'fixture') { const p = path.join(dir, file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
function fixture() {
  const dir = fs.mkdtempSync(path.join(base, 'case-'));
  const real = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  real.version = '0.0.1'; real.scripts.build = 'echo fixture --publish never';
  write(dir, 'package.json', JSON.stringify(real)); write(dir, 'package-lock.json', '{}'); write(dir, '.gitignore', 'ignored/\nnode_modules/\n.env*\n');
  for (const file of ['README.md', 'SOURCE_BUILD.md', 'CONTRIBUTING.md', 'docs/REQUISITOS_INSTALADOR.md', '.github/ISSUE_TEMPLATE/error_programa.md', '.github/ISSUE_TEMPLATE/importacion_marco.md', '.github/ISSUE_TEMPLATE/propuesta_mejora.md', 'scripts/preparar_publicacion.js']) write(dir, file);
  write(dir, 'CHANGELOG.md', '# Historial\n\n## 0.0.1\n\n- Cambio de prueba.\n- Segundo cambio de prueba.\n\n## 0.0.0\n\n- Cambio anterior.\n');
  write(dir, 'src/main/assets/templates/portada_programa_editable.docx', Buffer.from([1, 2, 3]));
  const nsh = fs.readFileSync(path.join(root, 'build/installer.nsh')); write(dir, 'build/installer.nsh', nsh);
  write(dir, 'ignored/private.txt'); write(dir, 'scratch/private.txt'); write(dir, PUBLICATIONS + '/another/private.txt'); write(dir, '.env');
  return dir;
}
function fakeBuild(dir, corrupt = false) {
  const version = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).version;
  const exe = `Programa_Electoral_Municipal_Setup_x64_v${version}.exe`;
  const bytes = Buffer.alloc(1024, 65); write(dir, 'dist/' + exe, bytes); write(dir, 'dist/' + exe + '.blockmap', '{}');
  const hash = require('crypto').createHash('sha512').update(bytes).digest('base64');
  write(dir, 'dist/latest.yml', `version: ${version}\npath: ${exe}\nsha512: ${corrupt ? 'incorrect' : hash}\nfiles:\n  - url: ${exe}\n    size: 1024\n    sha512: ${hash}\n`);
}
async function main() {
  const ordered=require('./entrega_ordenada');
  const approval=path.join(base,'approval.md');
  assert.throws(()=>ordered.requireApproval(approval),/no aprobado/);
  fs.writeFileSync(approval,'Informe\nNO PUBLICAR\n');assert.throws(()=>ordered.requireApproval(approval),/no aprobado/);
  fs.writeFileSync(approval,'Informe\nLISTO PARA REVISIÓN\n');ordered.requireApproval(approval);
  fs.appendFileSync(approval,'Cambio pendiente\n');assert.throws(()=>ordered.requireApproval(approval),/no aprobado/);
  assert.throws(()=>ordered.inside(path.dirname(base),base),/inside/);
  ordered.inside(path.join(base,'child'),base);
  const orderedGuide=ordered.guide('3.8.0','setup.exe');
  assert(orderedGuide.includes('NO crees v3.7.0'));assert(orderedGuide.includes('v3.6.1'));
  assert(orderedGuide.includes('programa-marco-2027-2031-v1.0.0'));
  assert(orderedGuide.includes('History')&&orderedGuide.includes('Create Tag'));
  const contentDir=path.join(base,'provisional');fs.mkdirSync(contentDir);
  const z=new(require('jszip'))(),manifest={content_id:'programa-marco-2027-2031',content_version:'1.0.0',official:true,languages:{}};
  const digest=bytes=>require('crypto').createHash('sha256').update(bytes).digest('hex');
  for(const lang of ['es','ca']){manifest.languages[lang]={official:true};for(const type of ['pdf','data']){const name=lang+'/synthetic.'+(type==='pdf'?'pdf':'json'),bytes=Buffer.from(type==='pdf'?'synthetic PDF bytes':'{}');z.file(name,bytes);Object.assign(manifest.languages[lang],{[type]:name,['size_'+type]:bytes.length,['sha256_'+type]:digest(bytes)});}}
  z.file('manifest.json',JSON.stringify(manifest));const zipBytes=await z.generateAsync({type:'nodebuffer'}),zipName='provisional.zip';
  fs.writeFileSync(path.join(contentDir,zipName),zipBytes);
  const catalog={programas_marco:[{content_id:manifest.content_id,content_version:'1.0.0',official:true,package:{filename:zipName,sha256:digest(zipBytes),size_bytes:zipBytes.length}}]};
  fs.writeFileSync(path.join(contentDir,'catalog.json'),JSON.stringify(catalog));assert.equal(await ordered.verifyContent(contentDir,[]),zipName);
  catalog.programas_marco[0].official=false;fs.writeFileSync(path.join(contentDir,'catalog.json'),JSON.stringify(catalog));await assert.rejects(ordered.verifyContent(contentDir,[]),/metadata/);
  catalog.programas_marco[0].official=true;catalog.programas_marco[0].is_test_fixture=true;fs.writeFileSync(path.join(contentDir,'catalog.json'),JSON.stringify(catalog));await assert.rejects(ordered.verifyContent(contentDir,[]),/Example metadata/);
  let dir = fixture(); const listed = listPublicFiles(dir);
  assert(listed.files.includes('package.json'));
  assert(!listed.files.some(f => /ignored|scratch|\.env|another/.test(f)));
  for (const file of ['data/model.gguf', 'output/latest.yml', 'backup/a.txt', 'src/key.pem', '01_PROGRAMA_MARCO/a.txt', 'data/extracted_raw.txt', 'data/catalogo_validacion.html', 'src/main/assets/data/catalogo_otro.json', PUBLICATIONS + '/V0.0.0/file.js']) assert(forbiddenReason(file), file);
  const seq = [];
  const done = await prepare(dir, { skipPackagedCheck: true, run: async args => { seq.push(args.join(' ')); if (args[0] === 'run') fakeBuild(dir); return { code: 0, output: 'RESUMEN FINAL\nPASS fixture' }; } });
  assert.deepEqual(seq, ['test', 'run build']);
  for (const file of ['GUIA_SUBIDA_GITHUB.txt', 'INFORME_PUBLICACION.txt', 'NOTAS_VERSION.md', 'PRUEBA_INSTALACION_LIMPIA.txt', 'codigo-fuente/package.json', 'instalador/latest.yml', 'instalador/SHA256.txt']) assert(fs.existsSync(path.join(done.destination, file)), file);
  assert(done.report.startsWith('PREPARACION CORRECTA'));
  assert(done.report.includes('DISTRIBUCIÓN LIMPIA'));
  assert(fs.readFileSync(path.join(done.destination, 'NOTAS_VERSION.md'), 'utf8').includes('Cambio de prueba'));
  const notes = fs.readFileSync(path.join(done.destination, 'NOTAS_VERSION.md'), 'utf8');
  assert(notes.includes('Segundo cambio de prueba'));
  assert(!notes.includes('Cambio anterior'));
  assert(notes.includes('El instalador lo distribuye directamente el autor'));
  const instructions = fs.readFileSync(path.join(done.destination, 'GUIA_SUBIDA_GITHUB.txt'), 'utf8');
  const codeStep = instructions.split('C) PASO 2:')[1].split('D) PASO 3:')[0];
  assert(codeStep.includes('ETIQUETA OBLIGATORIA'));
  assert(codeStep.includes('History') && codeStep.includes('Create Tag') && codeStep.includes('Push origin'));
  assert(codeStep.includes('Create new tag on publish'));
  assert(codeStep.includes('NO adjuntes ningún EXE'));
  assert(!codeStep.includes('Programa_Electoral_Municipal_Setup'));
  const reportBefore = fs.readFileSync(path.join(done.destination, 'INFORME_PUBLICACION.txt'));
  await assert.rejects(prepare(dir, { run: () => { throw Error('Must not execute'); } }), /no se sobrescribe/i);
  assert(fs.readFileSync(path.join(done.destination, 'INFORME_PUBLICACION.txt')).equals(reportBefore));
  dir = fixture(); await assert.rejects(prepare(dir, { run: async () => ({ code: 1, output: 'FAIL fixture' }) }), /npm test/);
  assert(!fs.existsSync(path.join(dir, PUBLICATIONS, 'V0.0.1')));
  dir = fixture(); let calls = 0;
  await assert.rejects(prepare(dir, { run: async () => ({ code: ++calls === 1 ? 0 : 1, output: 'fixture' }) }), /npm run build/);
  assert(!fs.existsSync(path.join(dir, PUBLICATIONS, 'V0.0.1')));
  dir = fixture(); fakeBuild(dir, true); assert(installerChecks(dir, JSON.parse(fs.readFileSync(path.join(dir, 'package.json')))).errors.some(e => e.includes('SHA512')));
  await assert.rejects(prepare(dir, { skipPackagedCheck: true, run: async () => ({ code: 0, output: 'fixture' }) }), err => fs.readFileSync(err.reportPath, 'utf8').startsWith('NO PUBLICAR'));
  assert(!fs.existsSync(path.join(dir, PUBLICATIONS, 'V0.0.1')));
  const personal = ['C:', 'Users', 'persona-de-prueba', 'Documents'].join(path.win32.sep);
  const privateEmail = ['ejemplo', 'private.invalid'].join('@');
  write(dir, 'privacy.txt', personal + '\n' + privateEmail + '\n' + ['const', 'token', '=', JSON.stringify('credential-' + 'x'.repeat(25))].join(' '));
  const privacy = auditSource(dir, ['privacy.txt']); assert.equal(privacy.errors.length, 3);
  write(dir, 'privacy.csv', fs.readFileSync(path.join(dir, 'privacy.txt')));
  assert.equal(auditSource(dir, ['privacy.csv']).errors.length, 3);
  write(dir, 'privacy-utf16.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(fs.readFileSync(path.join(dir, 'privacy.txt'), 'utf8'), 'utf16le')]));
  assert.equal(auditSource(dir, ['privacy-utf16.txt']).errors.length, 3);
  write(dir, 'technical.js', 'const max_tokens = 512;'); assert.equal(auditSource(dir, ['technical.js']).errors.length, 0);
  write(dir, 'LICENSE.txt', ['autor', ['license-author', 'public.invalid'].join('@')].join(' ')); assert.equal(auditSource(dir, ['LICENSE.txt']).errors.length, 0);
  // Validate the requested git mode, including a forbidden file tracked by mistake.
  const gitDir = fixture();
  const init = spawnSync('git', ['-C', gitDir, 'init', '-b', 'main'], { windowsHide: true, encoding: 'utf8' });
  if (init.status === 0) {
    assert.equal(spawnSync('git', ['-C', gitDir, 'add', 'package.json'], { windowsHide: true }).status, 0);
    assert.equal(spawnSync('git', ['-C', gitDir, 'add', '-f', '.env'], { windowsHide: true }).status, 0);
    const gitFiles = listPublicFiles(gitDir); assert(gitFiles.mode.startsWith('git ls-files')); assert(!gitFiles.files.includes('.env')); assert(gitFiles.files.includes('CHANGELOG.md'));
  } else throw Error('Git no disponible para comprobar ls-files');
  console.log('PASS publication: git/ignore filtering; no publication-folder recursion; exact source/assets; immutable version; test/build failures create no version folder; bad hashes produce NO PUBLICAR; private values blocked and technical/license references listed.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
