const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const structuralClassifier = require('./structuralClassifier');

class DocxExtractor {
  async extract(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('Archivo DOCX inválido: no contiene word/document.xml');
    }

    const docXmlStr = await docXmlFile.async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(docXmlStr, 'application/xml');

    const body = doc.getElementsByTagName('w:body')[0];
    if (!body) {
      throw new Error('Archivo DOCX sin contenido legible en w:body');
    }

    const paragraphsAndTables = [];
    for (let i = 0; i < body.childNodes.length; i++) {
      const node = body.childNodes[i];
      if (node.nodeName === 'w:p') {
        const parsedP = this.parseParagraph(node);
        if (parsedP && (parsedP.text.trim() || parsedP.isHeading)) {
          parsedP.index = paragraphsAndTables.length;
          parsedP.isTable = false;
          paragraphsAndTables.push(parsedP);
        }
      } else if (node.nodeName === 'w:tbl') {
        const parsedTbl = this.parseTable(node);
        parsedTbl.forEach(p => {
          p.index = paragraphsAndTables.length;
          p.isTable = true;
          paragraphsAndTables.push(p);
        });
      }
    }

    return structuralClassifier.classifyDocument(paragraphsAndTables);
  }

  parseParagraph(pNode) {
    let pStyle = '';
    let isList = false;
    let maxFontSize = 0;

    const pPr = pNode.getElementsByTagName('w:pPr')[0];
    if (pPr) {
      const pStyleNode = pPr.getElementsByTagName('w:pStyle')[0];
      if (pStyleNode) {
        pStyle = pStyleNode.getAttribute('w:val') || '';
      }

      const numPr = pPr.getElementsByTagName('w:numPr')[0];
      if (numPr) {
        isList = true;
      }

      const szNode = pPr.getElementsByTagName('w:sz')[0];
      if (szNode) {
        const szVal = parseInt(szNode.getAttribute('w:val') || '0', 10);
        if (szVal > 0) maxFontSize = Math.round(szVal / 2);
      }
    }

    const runs = [];
    let fullText = '';
    const childNodes = pNode.childNodes;

    for (let i = 0; i < childNodes.length; i++) {
      const child = childNodes[i];
      if (child.nodeName === 'w:r') {
        let isBold = false;
        let isItalic = false;
        let rFontSize = 0;

        const rPr = child.getElementsByTagName('w:rPr')[0];
        if (rPr) {
          const bNode = rPr.getElementsByTagName('w:b')[0];
          if (bNode) {
            const bVal = bNode.getAttribute('w:val');
            isBold = (bVal !== '0' && bVal !== 'false');
          }

          const iNode = rPr.getElementsByTagName('w:i')[0];
          if (iNode) {
            const iVal = iNode.getAttribute('w:val');
            isItalic = (iVal !== '0' && iVal !== 'false');
          }

          const rSz = rPr.getElementsByTagName('w:sz')[0];
          if (rSz) {
            const szVal = parseInt(rSz.getAttribute('w:val') || '0', 10);
            if (szVal > 0) rFontSize = Math.round(szVal / 2);
          }
        }

        if (rFontSize > maxFontSize) maxFontSize = rFontSize;

        const tNodes = child.getElementsByTagName('w:t');
        let rText = '';
        for (let j = 0; j < tNodes.length; j++) {
          rText += tNodes[j].textContent || '';
        }

        if (rText) {
          runs.push({ text: rText, isBold, isItalic, fontSize: rFontSize });
          fullText += rText;
        }
      }
    }

    const cleanText = fullText.replace(/\s+/g, ' ').trim();
    if (!cleanText) return null;

    const lowerStyle = pStyle.toLowerCase();
    const isHeading1 = lowerStyle.includes('heading 1') || lowerStyle.includes('heading1') || lowerStyle.includes('título 1') || lowerStyle.includes('titulo 1');
    const isHeading2 = lowerStyle.includes('heading 2') || lowerStyle.includes('heading2') || lowerStyle.includes('título 2') || lowerStyle.includes('titulo 2');
    const isHeading3 = lowerStyle.includes('heading 3') || lowerStyle.includes('heading3') || lowerStyle.includes('título 3') || lowerStyle.includes('titulo 3');

    // Analizar negrita inicial y completa
    let boldPrefix = '';
    let normalSuffix = '';
    let boldDone = false;
    let boldChars = 0;

    for (const r of runs) {
      if (r.isBold && !boldDone) {
        boldPrefix += r.text;
        boldChars += r.text.length;
      } else {
        boldDone = true;
        normalSuffix += r.text;
      }
    }

    const allBold = runs.length > 0 && boldChars >= cleanText.length * 0.9;

    return {
      text: cleanText,
      pStyle,
      isHeading: isHeading1 || isHeading2 || isHeading3,
      headingLevel: isHeading1 ? 1 : (isHeading2 ? 2 : (isHeading3 ? 3 : 0)),
      fontSize: maxFontSize,
      allBold,
      isList,
      runs,
      boldPrefix: boldPrefix.trim(),
      normalSuffix: normalSuffix.trim()
    };
  }

  parseTable(tblNode) {
    const results = [];
    const rows = tblNode.getElementsByTagName('w:tr');
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].getElementsByTagName('w:tc');
      for (let c = 0; c < cells.length; c++) {
        const pNodes = cells[c].getElementsByTagName('w:p');
        for (let p = 0; p < pNodes.length; p++) {
          const parsed = this.parseParagraph(pNodes[p]);
          if (parsed) {
            results.push(parsed);
          }
        }
      }
    }
    return results;
  }
}

module.exports = new DocxExtractor();
