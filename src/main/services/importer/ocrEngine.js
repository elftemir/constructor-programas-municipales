const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { fork } = require('child_process');
const { getUserDataDir } = require('../../utils/paths');
const pdfExtractor = require('./pdfExtractor');

function controlled(code) { const error = new Error(code); error.code = code; return error; }
function runtimeDir() {
  const installed = path.join(process.resourcesPath || '', 'ocr-runtime');
  return fs.existsSync(path.join(installed, 'ocrProcess.js')) ? installed : path.resolve(__dirname, '../../../../resources/ocr-runtime');
}
class OcrEngine {
  constructor() { this.active = null; }
  async cancel() {
    const active = this.active;
    if (!active) return;
    active.cancelled = true;
    active.child.kill(); // This process owns all OCR threads.
    await active.exited;
  }
  verifyRuntime(root) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
      for (const required of ['languages/spa.traineddata', 'languages/cat.traineddata', 'ocrProcess.js', 'tesseractLocalWorker.js', 'blockOcrNetwork.js']) {
        if (!manifest.files?.[required]) throw Error('incomplete runtime');
      }
      for (const [file, expected] of Object.entries(manifest.files)) {
        const target = path.resolve(root, file);
        if (!target.startsWith(path.resolve(root) + path.sep)) throw Error('path');
        if (crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== expected) throw Error('integrity');
      }
      return manifest;
    } catch { throw controlled('OCR_UNAVAILABLE'); }
  }
  run(buffer, options = {}) {
    if (this.active) return Promise.reject(controlled('OCR_BUSY'));
    const root = options.runtimeDir || runtimeDir();
    try { this.verifyRuntime(root); } catch (error) { return Promise.reject(error); }
    if (!['es', 'ca', 'both'].includes(options.language || 'es')) return Promise.reject(controlled('OCR_INVALID_LANGUAGE'));
    const cache = path.join(getUserDataDir(), 'ocr-cache');
    fs.mkdirSync(cache, { recursive: true });
    return new Promise((resolve, reject) => {
      const child = fork(path.join(root, 'ocrProcess.js'), [], {
        execPath: process.execPath, windowsHide: true, silent: true, serialization: 'advanced',
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '', NODE_PATH: '' }
      });
      let result = null, failure = null, exitResolve;
      const active = { child, cancelled: false, exited: new Promise(r => { exitResolve = r; }) };
      this.active = active;
      child.stdout.resume(); child.stderr.resume();
      child.on('message', message => {
        if (active.cancelled) return;
        if (message.type === 'progress') options.onProgress?.(message.data);
        if (message.type === 'result') result = message.data;
        if (message.type === 'error') failure = message.code;
      });
      child.on('error', () => { failure = 'OCR_UNAVAILABLE'; });
      child.on('close', code => {
        if (this.active === active) this.active = null;
        exitResolve();
        if (active.cancelled) reject(controlled('OCR_CANCELLED'));
        else if (failure || !result || code !== 0) reject(controlled(failure || 'OCR_UNAVAILABLE'));
        else resolve(result);
      });
      child.send({ buffer, mode: options.mode || 'ocr', language: options.language || 'es', cache,
        workers: options.workers === 2 && os.totalmem() >= 8 * 1024 ** 3 ? 2 : 1 });
    });
  }
  async inspectPdf(buffer) { return this.run(buffer, { mode: 'inspect' }); }
  async processScannedPdf(buffer, options = {}) {
    const result = await this.run(buffer, options);
    const text = result.pages.map(p => p.text).join('\n\n');
    const structured = pdfExtractor.structurePdfText(text, { allowFallbackArea: false });
    const areas = Array.from(structured);
    const normalize = value => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    for (const area of areas) for (const measure of area.measures || []) {
      const target = normalize([measure.title, measure.text].filter(Boolean).join(' '));
      const matches = result.pages.filter(page => normalize(page.text).includes(target) ||
        page.lines.some(line => target.includes(normalize(line.text)) && normalize(line.text).length > 12));
      measure.ocr = matches.some(p => p.origin === 'ocr');
      measure.paginas_origen = matches.map(p => p.page);
      measure.sourcePage = matches[0]?.page || null;
      const uncertain = matches.filter(p => p.origin === 'ocr' && (p.confidence < 80 || p.lines.some(l => l.confidence < 80)));
      if (uncertain.length) {
        measure.dudoso = measure.requiresReview = true;
        measure.motivo_duda = measure.reviewReason = 'Texto reconocido por OCR con baja fiabilidad (página ' + uncertain.map(p => p.page).join(', ') + ')';
      }
    }
    const covered = normalize(areas.map(a => [a.title, a.introduction, ...(a.subareas || []).map(s => s.title || s),
      ...(a.measures || []).map(m => [m.sourceNumber, m.title, m.text].join(' '))].join(' ')).join(' ') +
      [structured.metadata?.cover, structured.metadata?.presentation, structured.metadata?.backMatter].join(' '));
    const unclassified = result.pages.flatMap(p => p.lines.filter(l => !areas.length ||
      (normalize(l.text).length > 3 && !covered.includes(normalize(l.text)) &&
        !areas.some(a => normalize(l.text.replace(/^(?:área|àrea|area|eje|bloc|bloque)\s*\d+[.\s:\-]*/iu, '')).trim() === normalize(a.title || '')))).map(l => ({
      text: l.text, page: p.page, origin: p.origin, confidence: l.confidence
    })));
    return { areas, recognizedText: text, pageCount: result.pages.length, pages: result.pages,
      metadata: { ...structured.metadata, ocrSummary: result.summary, unclassifiedBlocks: unclassified },
      summary: result.summary };
  }
}
module.exports = new OcrEngine();

