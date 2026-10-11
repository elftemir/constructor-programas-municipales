const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const { createCanvas } = require('@napi-rs/canvas');
const texts = [
  'ÁREA 1. VIVIENDA Y SERVICIOS PÚBLICOS\n\n1. Crearemos una oficina municipal de vivienda.\n2. Mejoraremos los parques y las bibliotecas públicas.\n3. Garantizaremos la atención a las personas mayores.',
  "ÀREA 2. HABITATGE I SERVEIS PÚBLICS\n\n1. Crearem una oficina municipal d'habitatge.\n2. Millorarem els parcs i les biblioteques públiques.\n3. Garantirem l'atenció a les persones grans."
];
function pdf(pages) {
  const objects = [null, null]; const add = data => { objects.push(Buffer.isBuffer(data) ? data : Buffer.from(data, 'latin1')); return objects.length; };
  const stream = (attributes, buffer) => Buffer.concat([Buffer.from('<< ' + attributes + ' /Length ' + buffer.length + ' >>\nstream\n'), buffer, Buffer.from('\nendstream')]);
  const pageIds = [];
  for (const page of pages) {
    let resources, content;
    if (page.image) {
      const canvas = createCanvas(2480, 3508); const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'black'; ctx.font = '42px Arial';
      page.text.split('\n').forEach((line, i) => ctx.fillText(line, 140, 220 + i * 80));
      const img = add(stream('/Type /XObject /Subtype /Image /Width 2480 /Height 3508 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', canvas.toBuffer('image/jpeg')));
      resources = '/XObject << /Im0 ' + img + ' 0 R >>'; content = 'q 595 0 0 842 0 0 cm /Im0 Do Q';
      canvas.width = canvas.height = 1;
    } else {
      const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      resources = '/Font << /F1 ' + font + ' 0 R >>';
      content = 'BT /F1 12 Tf 40 780 Td 20 TL ' + page.text.split('\n').map(line => '(' + line.replace(/[\\()]/g, '\\$&') + ') Tj T*').join('\n') + ' ET';
    }
    const contents = add(stream('', Buffer.from(content, 'latin1')));
    pageIds.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << ' + resources + ' >> /Contents ' + contents + ' 0 R >>'));
  }
  objects[0] = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>');
  objects[1] = Buffer.from('<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pageIds.map(id => id + ' 0 R').join(' ') + '] >>');
  const chunks = [Buffer.from('%PDF-1.4\n')], offsets = [0]; let length = chunks[0].length;
  objects.forEach((object, i) => { offsets.push(length); const chunk = Buffer.concat([Buffer.from((i + 1) + ' 0 obj\n'), object, Buffer.from('\nendobj\n')]); chunks.push(chunk); length += chunk.length; });
  chunks.push(Buffer.from('xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' + offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + length + '\n%%EOF'));
  return Buffer.concat(chunks);
}
function generate() {
  const dir = path.join(__dirname, 'fixtures'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ocr-scanned.pdf'), pdf(texts.map(text => ({ text, image: true }))));
  fs.writeFileSync(path.join(dir, 'ocr-es.pdf'), pdf([{ text: texts[0], image: true }]));
  fs.writeFileSync(path.join(dir, 'ocr-ca.pdf'), pdf([{ text: texts[1], image: true }]));
  fs.writeFileSync(path.join(dir, 'ocr-mixed.pdf'), pdf([{ text: texts[0], image: false }, { text: texts[1], image: true }]));
  fs.writeFileSync(path.join(dir, 'ocr-unstructured.pdf'), pdf([{ text: 'Este documento contiene un texto narrativo sin ninguna medida numerada.\nEl contenido debe conservarse para la revisión humana.', image: true }]));
  return { dir, texts };
}
if (require.main === module) generate();
module.exports = { generate, texts };
