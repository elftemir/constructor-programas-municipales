// Build-time acquisition of pinned source archives and copyright notices from the canvas SBOM.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const root = path.resolve(__dirname, '..'); const dest = path.join(root, 'resources/ocr-licenses');
const sbom = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@napi-rs/canvas-win32-x64-msvc/sbom.cdx.json')));
async function main() {
  fs.mkdirSync(path.join(dest, 'sources'), { recursive: true });
  const inventory = [];
  for (const component of sbom.components) {
    if (!component.licenses) continue;
    const license = component.licenses.map(l => l.expression || l.license?.id || '').join('; ');
    const record = { name: component.name, revision: component.version, license };
    if (license.includes('MPL-2.0')) {
      const url = 'https://static.crates.io/crates/' + component.name + '/' + component.name + '-' + component.version + '.crate';
      const response = await fetch(url); if (!response.ok) throw Error(url + ': ' + response.status);
      const buffer = Buffer.from(await response.arrayBuffer()); const file = 'sources/' + component.name + '-' + component.version + '.crate';
      fs.writeFileSync(path.join(dest, file), buffer); record.source = url; record.local = file;
      record.sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    }
    const repo = component.properties?.find(p => p.name === 'cdx:skia:repositoryUrl')?.value;
    if (repo && component.name !== 'freetype') {
      for (const file of ['LICENSE', 'COPYING', 'LICENSE.txt', 'LICENSE.md', 'LICENSE.TXT', 'COPYING.txt']) {
        let url = repo.replace(/\.git$/, '') + '/+/' + component.version + '/' + file + '?format=TEXT';
        if (repo.includes('github.com')) url = repo.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace(/\.git$/, '') + '/' + component.version + '/' + file;
        const response = await fetch(url); if (!response.ok) continue;
        const raw = Buffer.from(await response.arrayBuffer()); const buffer = repo.includes('googlesource') ? Buffer.from(raw.toString().trim(), 'base64') : raw;
        const target = component.name + '-NOTICE.txt'; fs.writeFileSync(path.join(dest, target), buffer);
        record.notice = target; record.source = url; record.sha256 = crypto.createHash('sha256').update(buffer).digest('hex'); break;
      }
    }
    inventory.push(record);
  }
  fs.writeFileSync(path.join(dest, 'COMPONENTS.json'), JSON.stringify(inventory, null, 2));
  fs.writeFileSync(path.join(dest, 'README.txt'), 'OCR licenses and original canvas SBOM.\nMPL-2.0 source archives are included in sources/, unchanged; original copyright notices are inside those archives.\nFreeType: freetype-FTL.txt. Skia: skia-BSD.txt. Canvas: canvas-MIT.txt.\nOther native components and source URLs: COMPONENTS.json.\n');
  console.log('Native license inventory:', inventory.length, 'components');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
