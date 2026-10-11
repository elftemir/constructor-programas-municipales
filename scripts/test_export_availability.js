const assert = require('assert'); const fs = require('fs'); const vm = require('vm'); const path = require('path');
async function main() {
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/js/views/reviewExportView.js'), 'utf8');
  for (const lang of ['es', 'ca']) for (const canConvert of [false, true]) {
    const context = { window: { i18n: { getLang: () => lang, t: key => key }, api: { getExportDir: async () => 'Test', detectPdfConverters: async () => ({ canConvert, libreOfficeAvailable: canConvert }) } }, escapeHtml: s => s || '', console };
    vm.createContext(context); vm.runInContext(source + ';this.view=ReviewExportView;', context);
    context.view.bindEvents = () => {};
    const container = { innerHTML: '' };
    await context.view.render(container, { municipio: 'Prueba', areas: [], idioma_principal: lang });
    const pdf = container.innerHTML.match(/<input[^>]*value="pdf"[^>]*>/)[0];
    const docx = container.innerHTML.match(/<input[^>]*value="docx"[^>]*>/)[0];
    assert.equal(pdf.includes('disabled'), !canConvert); assert(!docx.includes('disabled'));
    assert.equal(container.innerHTML.includes('btn-download-libreoffice'), !canConvert);
    if (!canConvert) assert(container.innerHTML.includes(lang === 'ca' ? 'gratuït' : 'gratuito'));
  }
  // Run the exact IPC allow-list handler without starting Electron or opening a browser.
  const mainSource = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
  const start = mainSource.indexOf("  ipcMain.handle('shell:openExternalUrl'");
  const end = mainSource.indexOf('\n  // PDF Export', start);
  let handler; let opened;
  vm.runInNewContext(mainSource.slice(start, end), { ipcMain: { handle: (_, fn) => handler = fn }, shell: { openExternal: async url => opened = url }, console });
  assert.equal(await handler(null, 'https://www.libreoffice.org/download/'), true);
  assert.equal(opened, 'https://www.libreoffice.org/download/');
  for (const url of ['https://www.libreoffice.org/download/?next=bad', 'https://www.libreoffice.org.evil/download/', 'file:///C:/test', 'javascript:alert(1)']) assert.equal(await handler(null, url), false);
  console.log('PASS export: PDF disabled without converter in ES/CA; DOCX remains enabled; LibreOffice download exact URL only.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
