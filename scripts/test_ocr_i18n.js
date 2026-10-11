const fs = require('fs'); const path = require('path'); const vm = require('vm'); const assert = require('assert');
const context = { window: {}, console };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/renderer/js/i18n.js'), 'utf8'), context);
const i18n = context.window.i18n;
for (const lang of ['es', 'ca']) {
  i18n.setLang(lang);
  const progress = i18n.t('ocr.progress', { current: 2, total: 3 });
  assert(progress.includes('2') && progress.includes('3') && !progress.includes('{'));
  assert(!i18n.t('ocr.summary', { native: 1, ocr: 2, lowConfidence: 0, failed: 0 }).includes('{'));
  for (const code of ['OCR_CANCELLED', 'OCR_UNAVAILABLE', 'OCR_NO_TEXT', 'OCR_BUSY', 'OCR_INVALID_LANGUAGE', 'OCR_INVALID_FILE']) {
    assert(i18n.t('ocr.' + code).length > 20);
  }
}
console.log('PASS OCR messages and interpolated counts in ES/CA');
