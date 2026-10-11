const pdfParse = require('pdf-parse');
const structuralClassifier = require('./structuralClassifier');

class PdfExtractor {
  async extract(buffer) {
    try {
      const data = await pdfParse(buffer);
      const numPages = data.numpages || 1;
      const rawText = data.text || '';
      const cleanRaw = rawText.trim();

      // Detección de PDF escaneado (texto vacío o anormalmente bajo)
      const avgCharsPerPage = cleanRaw.length / Math.max(1, numPages);
      const isScanned = cleanRaw.length < 50 || avgCharsPerPage < 30;

      if (isScanned) {
        return {
          isScanned: true,
          pageCount: numPages,
          areas: []
        };
      }

      const areas = this.structurePdfText(rawText);
      return {
        isScanned: false,
        pageCount: numPages,
        areas
      };
    } catch (err) {
      return {
        isScanned: true,
        pageCount: 1,
        areas: []
      };
    }
  }

  structurePdfText(text, options = {}) {
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const blocks = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const isShortHeader = line.length <= 65 && (/^[A-ZÁÉÍÓÚÀÈÒÇ0-9\s]{4,65}$/.test(line) || /^[0-9]{1,2}\.[\s\t]+[A-Z]/.test(line));
      const isListOrNum = /^[\-•\*\–]\s+/.test(line) || /^[0-9]+(?:\.[0-9]+)*[\.\:\-\)]\s+/.test(line);

      blocks.push({
        index: blocks.length,
        text: line,
        allBold: isShortHeader,
        headingLevel: isShortHeader ? 1 : 0,
        isList: isListOrNum
      });
    }

    return structuralClassifier.classifyDocument(blocks, options);
  }
}

module.exports = new PdfExtractor();
