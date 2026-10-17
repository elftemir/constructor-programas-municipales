require('./blockOcrNetwork');
const path = require('path');
const { pathToFileURL } = require('url');
const { createCanvas } = require('@napi-rs/canvas');
const { createWorker } = require('tesseract.js');
const layout = require('./pdfLayout');

function sufficient(text) {
  return (text.match(/[\p{L}\p{N}]/gu) || []).length >= 40 && text.trim().split(/\s+/).length >= 3 && !text.includes('\uFFFD');
}
function clean(text) {
  return text.replace(/(\p{L})-\r?\n(?=\p{Ll})/gu, '$1').replace(/[ \t]+\n/g, '\n').trim();
}
function grayscale(canvas) {
  const ctx = canvas.getContext('2d'); const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < image.data.length; i += 4) {
    // Preserve pale coloured bullets as well as dark text on a white page.
    const value = Math.min(image.data[i],image.data[i + 1],image.data[i + 2]);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value; histogram[value]++;
  }
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * histogram[i];
  const total = canvas.width * canvas.height; let weight = 0, partial = 0, max = 0, threshold = 127;
  for (let i = 0; i < 256; i++) {
    weight += histogram[i]; if (!weight || weight === total) continue;
    partial += i * histogram[i];
    const variance = weight * (total - weight) * (partial / weight - (sum - partial) / (total - weight)) ** 2;
    if (variance > max) { max = variance; threshold = i; }
  }
  for (let i = 0; i < image.data.length; i += 4) {
    const value = image.data[i] <= threshold ? 0 : 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
}
function directText(content) {
  let text = '';
  for (const item of content.items) text += item.str + (item.hasEOL ? '\n' : ' ');
  return text.trim();
}
process.once('message', async ({ buffer, mode, language, cache, workers }) => {
  let pdf, loadingTask; const pool = [];
  try {
    const pdfjs = await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
    const pdfBytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer.data);
    loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false,fontExtraProperties:true,
      useSystemFonts: false, cMapUrl: path.join(__dirname, 'node_modules/pdfjs-dist/cmaps') + '/',
      cMapPacked: true, standardFontDataUrl: path.join(__dirname, 'node_modules/pdfjs-dist/standard_fonts') + '/',
      wasmUrl: path.join(__dirname, 'node_modules/pdfjs-dist/wasm') + '/' });
    pdf = await loadingTask.promise;
    const pages = new Array(pdf.numPages); let completed = 0, ocrCount = 0, duration = 0;
    async function getTesseract(index) {
      if (!pool[index]) {
        try { pool[index] = await createWorker(language === 'both' ? 'spa+cat' : language === 'ca' ? 'cat' : 'spa', 1, {
          langPath: path.join(__dirname, 'languages'), gzip: false, cachePath: cache, cacheMethod: 'none',
          corePath: path.join(__dirname, 'node_modules/tesseract.js-core'),
          workerPath: path.join(__dirname, 'tesseractLocalWorker.js'),
          logger: info => { if (info.status === 'recognizing text') progress(info.progress); }
        }); } catch { throw Error('OCR_UNAVAILABLE'); }
        await pool[index].setParameters({ preserve_interword_spaces: '1' });
      }
      return pool[index];
    }
    function progress(fraction = 0) {
      process.send?.({ type: 'progress', data: { current: Math.min(completed + 1, pdf.numPages), total: pdf.numPages,
        percent: Math.min(99, Math.round((completed + fraction) / pdf.numPages * 100)),
        remainingSeconds: ocrCount ? Math.ceil(duration / ocrCount * (pdf.numPages - completed) / 1000) : null } });
    }
    async function pageJob(pageNo, workerIndex) {
      const page = await pdf.getPage(pageNo); let canvas;
      try {
        const content=await page.getTextContent(),text=directText(content),overlap=layout.overlapping(content.items);
        await page.getOperatorList();
        for(const item of content.items)try{item.bold=layout.fontIsBold(page.commonObjs.get(item.fontName));}catch{}
        const nativeHeight=page.getViewport({scale:1}).height,nativeLayout=layout.nativeLines(content.items,pageNo,nativeHeight);
        const native = sufficient(text)&&!overlap.mixed;
        if (native || mode === 'inspect') {
          pages[pageNo - 1] = { page: pageNo, text: native ? clean(text) : '', origin: native ? 'native' : 'pending',
            mixedTextLayer:overlap.mixed,overlapPairs:overlap.pairs,height:nativeHeight,nativeLayout,nativeHeight,
            confidence: null, lines: native ? layout.nativeLines(content.items,pageNo,page.getViewport({scale:1}).height) : [] };
        } else {
          const start = Date.now(); const worker = await getTesseract(workerIndex);
          const viewport = page.getViewport({ scale: 300 / 72 });
          if (viewport.width * viewport.height > 24_000_000) throw Error('OCR_PAGE_TOO_LARGE');
          canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: 'white' }).promise;
          grayscale(canvas);
          const { data } = await worker.recognize(canvas.toBuffer('image/png'), {}, { text: true, blocks: true });
          const lines = (data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []))
            .map(line => ({ text: line.text.trim(), confidence: line.confidence,page:pageNo,origin:'ocr',x:line.bbox?.x0||0,y:line.bbox?.y0||0,height:(line.bbox?.y1||0)-(line.bbox?.y0||0) }));
          if (!data.text.trim()) throw Error('OCR_EMPTY_PAGE');
          const elapsedMs = Date.now() - start; duration += elapsedMs; ocrCount++;
          pages[pageNo - 1] = { page: pageNo, text: clean(data.text), rawText: data.text, origin: 'ocr',
            confidence: data.confidence, lines, elapsedMs,height:viewport.height,nativeLayout,nativeHeight,mixedTextLayer:overlap.mixed,overlapPairs:overlap.pairs };
        }
      } catch (error) {
        if (error.message === 'OCR_UNAVAILABLE') throw error;
        pages[pageNo - 1] = { page: pageNo, text: '', origin: 'failed', confidence: null, lines: [] };
      } finally {
        if (canvas) { canvas.width = 1; canvas.height = 1; } page.cleanup(); completed++; progress();
      }
    }
    for (let page = 1; page <= pdf.numPages; page += workers) {
      await Promise.all(Array.from({ length: Math.min(workers, pdf.numPages - page + 1) }, (_, i) => pageJob(page + i, i)));
    }
    const nativeStructure=layout.structure(pages.map(p=>({page:p.page,height:p.nativeHeight,lines:p.nativeLayout||[]}))),kept=new Set(nativeStructure.lines);
    for(const p of pages){
      if(p.origin==='ocr'&&p.nativeLayout?.length&&nativeStructure.areas.length){
        const scale=p.height/p.nativeHeight,position=entry=>({x:entry.position.x*scale,y:(entry.position.y-entry.position.height*.8)*scale,height:entry.position.height*scale});
        const excluded=p.nativeLayout.filter(l=>!kept.has(l)&&(l.y<p.nativeHeight*.13||l.y>p.nativeHeight*.87));
        p.layoutHints={headings:nativeStructure.areas.filter(a=>a.sourcePage===p.page).map(position),bullets:nativeStructure.areas.flatMap(a=>a.measures).filter(m=>m.sourcePage===p.page).map(position),excluded:excluded.map(l=>({from:(l.y-l.height*1.5)*scale,to:(l.y+l.height)*scale}))};
      }
      delete p.nativeLayout;delete p.nativeHeight;
    }
    const summary = { native: pages.filter(p => p.origin === 'native').length,
      ocr: pages.filter(p => p.origin === 'ocr').length,
      lowConfidence: pages.filter(p => p.origin === 'ocr' && (p.confidence < 80 || p.lines.some(l => l.confidence < 80))).length,
      failed: pages.filter(p => p.origin === 'failed').length, pending: pages.filter(p => p.origin === 'pending').length,
      mixed:pages.filter(p=>p.mixedTextLayer).length,
      averageMs: ocrCount ? Math.round(duration / ocrCount) : 0 };
    if (mode !== 'inspect' && !pages.some(p => p.text)) throw Error('OCR_NO_TEXT');
    process.send?.({ type: 'result', data: { pages, summary } });
  } catch (error) {
    if (process.env.OCR_DEBUG === '1') console.error(error);
    process.send?.({ type: 'error', code: error.message === 'OCR_NO_TEXT' ? 'OCR_NO_TEXT' : 'OCR_UNAVAILABLE' });
  } finally {
    await Promise.all(pool.map(worker => worker.terminate()));
    if (loadingTask) await loadingTask.destroy(); process.disconnect();
  }
});

