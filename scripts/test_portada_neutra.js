// Synthetic documents only; no database, user profile or installer is opened.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const exporter = require('../src/main/services/docxExporter');

async function contents(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const parts = [];
  for (const name of Object.keys(zip.files).filter(name => /\.(xml|rels)$/.test(name))) {
    const xml = await zip.file(name).async('string');
    exporter.assertWellFormed(xml, name);
    parts.push(xml);
  }
  const xml = await zip.file('word/document.xml').async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  for (const fallback of [...doc.getElementsByTagName('mc:Fallback')]) fallback.parentNode.removeChild(fallback);
  const visible = [...doc.getElementsByTagName('w:t')].map(node => node.textContent).join(' ');
  return { raw: parts.join('\n'), xml, visible };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const base = process.env.TEST_RUN_DIR || path.join(root, 'scratch');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'neutral-cover-'));
  const template = path.join(root, 'src/main/assets/templates/portada_programa_editable.docx');
  const neutral = await contents(template);
  for (const marker of ['Municipio', 'Candidatura', 'Lema de campaña', 'Elecciones municipales']) {
    assert(neutral.visible.includes(marker), 'Neutral template marker: ' + marker);
  }
  assert(!/POLÍTICAS|HONESTAS|28 de mayo|Sant Andreu|Pallej[àa]/i.test(neutral.raw), 'No examples in text, shape names or metadata');
  assert(!fs.readdirSync(path.dirname(template)).some(name => name.includes('sant_andreu')), 'Only neutral template name');
  for (const lang of ['es', 'ca']) {
    const project = { id: 'neutral-cover', municipio: '', partido: '', organizacion: '', mandato: '',
      idioma_principal: lang, lema_es: '', lema_ca: '', fecha_electoral: null, logo_path: null,
      areas: [], textos_generales: {} };
    const before = JSON.stringify(project);
    const output = path.join(dir, 'empty-' + lang + '.docx');
    const result = await exporter.exportProjectToDocx(project, { idioma: lang, outputPath: output });
    assert(!result.warnings.some(text => /Portada:/.test(text)), 'Neutral template must be used without fallback');
    const empty = await contents(output);
    assert(!/Municipio|Candidatura|Lema de|campaña|campanya|Elecciones municipales|Eleccions municipals|28 de mayo|POLÍTICAS|HONESTAS|Sant Andreu|Pallej[àa]/i.test(empty.visible), 'Empty fields leave no sample text');
    assert(!/POLÍTICAS|HONESTAS|28 de mayo|Sant Andreu|Pallej[àa]/i.test(empty.raw), 'No hidden legacy sample text');
    assert.equal(JSON.stringify(project), before, 'Export does not modify the project');

    const filled = { ...project, municipio: 'Vila Serena', partido: 'Candidatura veïnal',
      lema_es: 'Cuidamos nuestro municipio', lema_ca: 'Cuidem el nostre municipi', fecha_electoral: '2031-05-25' };
    const named = await exporter.exportProjectToDocx(filled, { idioma: lang, outputPath: path.join(dir, 'filled-' + lang + '.docx') });
    assert(!named.warnings.some(text => /Portada:/.test(text)));
    const filledContents = await contents(named.filePath);
    const shown = filledContents.visible;
    for (const match of filledContents.xml.matchAll(/<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g)) {
      if (!match[0].includes('<w:txbxContent>')) continue;
      const sizes = [...match[0].matchAll(/<w:sz w:val="(\d+)"\/>/g)].map(node => node[1]);
      assert.equal(new Set(sizes).size, 1, 'DrawingML and VML fallback use identical text sizes');
    }
    assert(shown.includes('Vila Serena'));
    assert(shown.includes(lang === 'ca' ? 'CUIDEM EL NOSTRE MUNICIPI' : 'CUIDAMOS NUESTRO MUNICIPIO'));
    assert(shown.includes(lang === 'ca' ? 'Eleccions municipals · 25 de maig de 2031' : 'Elecciones municipales · 25 de mayo de 2031'));
    assert(!shown.includes(lang === 'ca' ? 'CUIDAMOS' : 'CUIDEM'), 'Slogan belongs to the output language');
  }
  console.log('PASS neutral cover ES/CA: neutral template and metadata; missing slogan/date/municipality cleared; supplied fields and language preserved.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
