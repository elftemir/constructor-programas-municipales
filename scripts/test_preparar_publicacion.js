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
  write(dir, 'CHANGELOG.md', '## 0.0.1\n\n- Cambio de prueba.\n');
  write(dir, 'src/main/assets/templates/portada_programa_sant_andreu_editable.docx', Buffer.from([1, 2, 3]));
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
  let dir = fixture(); const listed = listPublicFiles(dir);
  assert(listed.files.includes('package.json'));
  assert(!listed.files.some(f => /ignored|scratch|\.env|another/.test(f)));
  for (const file of ['data/model.gguf', 'output/latest.yml', 'backup/a.txt', 'src/key.pem', '01_PROGRAMA_MARCO/a.txt', PUBLICATIONS + '/V0.0.0/file.js']) assert(forbiddenReason(file), file);
  const seq = [];
  const done = await prepare(dir, { skipPackagedCheck: true, run: async args => { seq.push(args.join(' ')); if (args[0] === 'run') fakeBuild(dir); return { code: 0, output: 'RESUMEN FINAL\nPASS fixture' }; } });
  assert.deepEqual(seq, ['test', 'run build']);
  for (const file of ['GUIA_SUBIDA_GITHUB.txt', 'INFORME_PUBLICACION.txt', 'NOTAS_VERSION.md', 'codigo-fuente/package.json', 'instalador/latest.yml', 'instalador/SHA256.txt']) assert(fs.existsSync(path.join(done.destination, file)), file);
  assert(done.report.startsWith('PREPARACION CORRECTA'));
  assert(fs.readFileSync(path.join(done.destination, 'NOTAS_VERSION.md'), 'utf8').includes('Cambio de prueba'));
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
