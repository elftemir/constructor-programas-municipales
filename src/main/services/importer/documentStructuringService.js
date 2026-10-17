const fs = require('fs');
const path = require('path');
const docxExtractor = require('./docxExtractor');
const pdfExtractor = require('./pdfExtractor');
const ocrEngine = require('./ocrEngine');

class DocumentStructuringService {
  cleanProposedName(filePath) {
    const base = path.basename(filePath, path.extname(filePath));
    return base
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async analyzeDocument(filePath, language = 'es') {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo especificado no existe: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.docx' && ext !== '.pdf') {
      throw new Error(`Formato no soportado (${ext}). Seleccione un archivo .docx o .pdf.`);
    }

    // El archivo original se lee como Buffer en memoria. NUNCA se modifica ni se escribe.
    const buffer = fs.readFileSync(filePath);
    const proposedName = this.cleanProposedName(filePath);

    if (ext === '.docx') {
      const extraction = await docxExtractor.extract(buffer);
      const areas = Array.isArray(extraction) ? extraction : (extraction.areas || []);
      const metadata = extraction.metadata || {};
      const stats = extraction.stats || this.computeStats(areas);
      return {
        sourceName: proposedName,
        language,
        format: 'docx',
        pageCount: null,
        isScanned: false,
        areas,
        metadata,
        stats
      };
    } else {
      let pdfRes;
      try {
        const inspection = await ocrEngine.inspectPdf(buffer);
        const structured = pdfExtractor.structurePages(inspection.pages);
        pdfRes = { isScanned: inspection.summary.pending > 0 || inspection.summary.failed > 0,
          pageCount: inspection.pages.length, ocrPageCount: inspection.summary.pending,
          areas:structured.areas,metadata:structured.metadata,stats:structured.stats,textLayerMixed:inspection.summary.mixed>0 };
      } catch {
        pdfRes = await pdfExtractor.extract(buffer);
      }
      if (pdfRes.isScanned) {
        return {
          sourceName: proposedName,
          language,
          format: 'pdf',
          pageCount: pdfRes.pageCount,
          ocrPageCount: pdfRes.ocrPageCount || pdfRes.pageCount,
          isScanned: true,
          textLayerMixed:!!pdfRes.textLayerMixed,
          areas: [],
          metadata: {},
          stats: { totalAreas: 0, totalMeasures: 0, requiresReviewCount: 0 }
        };
      }

      const areas = Array.isArray(pdfRes) ? pdfRes : (pdfRes.areas || []);
      const metadata = pdfRes.metadata || {};
      const stats = pdfRes.stats || this.computeStats(areas);
      return {
        sourceName: proposedName,
        language,
        format: 'pdf',
        pageCount: pdfRes.pageCount,
        isScanned: false,
        areas,
        metadata,
        stats
      };
    }
  }

  async runOcr(filePath, language = 'es', onProgress = () => {}, options = {}) {
    if (typeof filePath !== 'string' || path.extname(filePath).toLowerCase() !== '.pdf' ||
        !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error('OCR_INVALID_FILE');
    const buffer = fs.readFileSync(filePath);
    const proposedName = this.cleanProposedName(filePath);

    const res = await ocrEngine.processScannedPdf(buffer, { onProgress, language, workers: options.workers });
    const areas = Array.isArray(res) ? res : (res.areas || []);
    const metadata = res.metadata || {};
    const stats = res.stats || this.computeStats(areas);

    return {
      sourceName: proposedName,
      language: language === 'both' ? (options.primaryLanguage || 'es') : language,
      format: 'pdf (ocr)',
      pageCount: res.pageCount,
      isScanned: false,
      areas,
      metadata,
      stats,
      pages: res.pages,
      summary: res.summary
    };
  }

  cancelOcr() {
    return ocrEngine.cancel();
  }

  async classifyWithAi(blocks, context = {}) {
    try {
      const aiService = require('../ai/aiService');
      const diag = await aiService.getDiagnostic();
      if (!diag || (!diag.serverReady && !diag.modelAvailable)) {
        return {
          ok: false,
          error: 'No hay un modelo de IA local activo o instalado en este momento.'
        };
      }

      // Enviar únicamente los bloques ambiguos (máximo 30) con metadatos simplificados
      const sanitizedBlocks = (blocks || []).slice(0, 30).map((b, idx) => ({
        id: b.id || `block_${idx}`,
        pos: b.index !== undefined ? b.index : idx,
        headingLevel: b.headingLevel || 0,
        style: b.pStyle || '',
        text: (b.text || '').substring(0, 300)
      }));

      const res = await aiService.generate('clasificar_bloques_estructurales', {
        blocks: sanitizedBlocks,
        context
      }, { useSelectedModel: true });

      return res;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  computeStats(areas) {
    let totalMeasures = 0;
    let totalSubareas = 0;
    let totalAreaIntros = 0;
    let requiresReviewCount = 0;

    areas.forEach(a => {
      totalSubareas += (a.subareas || []).length;
      if (a.introduction) totalAreaIntros++;
      const list = a.measures || a.medidas || [];
      list.forEach(m => {
        if (!m.ignored && m.tipo !== 'ignorar' && m.tipo !== 'introduccion' && m.tipo !== 'subarea' && m.tipo !== 'area') {
          totalMeasures++;
          if (m.requiresReview || m.dudoso) {
            requiresReviewCount++;
          }
        }
      });
    });

    return {
      totalAreas: areas.length,
      totalSubareas,
      totalMeasures,
      totalAreaIntros,
      requiresReviewCount
    };
  }
}

module.exports = new DocumentStructuringService();
