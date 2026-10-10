/**
 * structuralClassifier.js - Motor de Clasificación Jerárquica Documental Adaptable (Fase 3.0.1)
 *
 * Pipeline Multi-Etapa:
 * 1. Análisis Global de Patrones (frecuencia de estilos, tamaños, headings, numeración, detección de medidas declaradas).
 * 2. Segmentación Macro (Front Matter / Portada, Índice flexible, Cuerpo programático, Back Matter / Cierre).
 * 3. Identificación y Validación Contextual de Candidatas a Área (sin equivalencia directa Heading1=Área ni fontSize=Área).
 * 4. Extracción y Delimitación de Contenido de Área (Introducción de área, Subáreas, Medidas).
 * 5. Preservación estricta del parser de medidas de alta precisión (boldPrefix + normalSuffix, títulos separados, dos puntos, viñetas).
 * 6. Eliminación del fallback indiscriminado (text.length >= 15).
 * 7. Sistema de confianza (alta, media, baja), métricas y alertas estructurales.
 * 8. Soporte opcional para clasificación de ambigüedades con IA local.
 */

class StructuralClassifier {
  constructor() {
    // Verbos de acción / propuesta típicos de medidas electorales (ES y CA)
    this.actionVerbsRegex = /^(?:crear(?:emos)?|impulsar(?:emos)?|garantizar(?:emos)?|fomentar(?:emos)?|desarrollar(?:emos)?|promover(?:emos)?|establecer(?:emos)?|rehabilitar(?:emos)?|construir(?:emos)?|ampliar(?:emos)?|poner(?:emos)?|dotar(?:emos)?|reforzar(?:emos)?|implementar(?:emos)?|facilitar(?:emos)?|asegurar(?:emos)?|aprobar(?:emos)?|revisar(?:emos)?|pacificar(?:emos)?|modernizar(?:emos)?|recuperar(?:emos)?|apoyar(?:emos)?|organizar(?:emos)?|crear(?:em)?|impulsar(?:em)?|garantir(?:em)?|fomentar(?:em)?|desenvolupar(?:em)?|promoure(?:m)?|establir(?:em)?|rehabilitar(?:em)?|construir(?:em)?|ampliar(?:em)?|posar(?:em)?|dotar(?:em)?|reforçar(?:em)?|implementar(?:em)?|assegurar(?:em)?|aprovar(?:em)?|pacificar(?:em)?|recuperar(?:em)?|suprimir(?:emos|em)?|eliminar(?:emos|em)?)\b/i;

    // Patrones de introducción / objetivos de área o generales
    this.introPrefixRegex = /^(?:objetivo\s+del\s+área|objectiu\s+de\s+l'àrea|objetivo(?:\s+del\s+ámbito)?|objectiu(?:\s+de\s+l'àmbit)?|objetivo(?:s)?(?:\s+generales)?|objectiu(?:s)?|introducción|introducció|presentación|presentació|diagnóstico|diagnòstic|en\s+este\s+ámbito|en\s+aquest\s+àmbit|nuestro\s+objetivo|el\s+nostre\s+objectiu|este\s+programa\s+parte|aquest\s+programa\s+parteix|las\s+propuestas\s+que\s+siguen|les\s+propostes\s+que\s+segueixen)[\:\.]?/i;

    // Patrones explícitos de numeración de medida
    this.measureNumberPrefixRegex = /^(?:medida|mesura|propuesta|proposta)?\s*([0-9]{1,2}(?:\.[0-9]{1,3})+)[\.\:\-\)\s]\s*(.*)$/i;
    this.simpleNumberedRegex = /^([0-9]{1,3})[\.\)\-]\s+(.*)$/;

    // Patrones de cierre / Back Matter
    this.backMatterRegex = /^(?:nota\s+final|epílogo|epíleg|conclusi(?:ón|ones)|conclusions|créditos|crèdits|anexo|annex)[\:\.]?$/i;

    // Patrones flexibles de cabecera de índice (TOC)
    this.tocHeaderRegex = /^(?:índice|sumario|taula\s+de\s+continguts?|taula\s+de\s+contingut|índex|continguts?)(?:\s+d[e']\s*[a-zà-ú\s]+)?[\:\.]?$/i;
  }

  normalizeTitle(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/^(?:área|àrea|bloque|bloc|eje|eix)?\s*[0-9ivxlcdm]+[\.\:\-\s·]+/i, '')
      .replace(/^[0-9]{1,2}\.[\s\t]+/, '')
      .replace(/[\.\s\t_]{2,}\s*\d+$/, '')
      .replace(/\s+\d{1,3}$/, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  classifyDocument(blocks) {
    if (!blocks || blocks.length === 0) {
      const empty = [];
      empty.areas = [];
      empty.metadata = {};
      empty.stats = { totalAreas: 0, totalSubareas: 0, totalMeasures: 0, requiresReviewCount: 0 };
      return empty;
    }

    // 1. Análisis global de frecuencias y patrones documentales
    const profile = this.profileDocument(blocks);

    // 2. Detección flexible y estructural del índice (TOC)
    const tocInfo = this.detectToc(blocks);

    // 3. Segmentación Macro: Front Matter, Candidatas a Área, Back Matter
    const segmentation = this.segmentDocument(blocks, tocInfo, profile);

    // 4. Validación contextual de Áreas y asignación de contenido interno
    const validatedAreas = this.validateAndBuildAreas(segmentation, tocInfo, profile);

    // 5. Estadísticas de coherencia y calidad
    const stats = this.computeDocumentStats(validatedAreas, profile);

    // Enriquecer el array resultante para máxima compatibilidad
    validatedAreas.areas = validatedAreas;
    validatedAreas.metadata = {
      cover: segmentation.coverBlocks.map(b => b.text).join('\n'),
      presentation: segmentation.presentationBlocks.map(b => b.text).join('\n\n'),
      tocEntries: tocInfo.entries,
      backMatter: segmentation.backMatterBlocks.map(b => b.text).join('\n\n'),
      declaredMeasures: profile.declaredMeasures
    };
    validatedAreas.stats = stats;

    return validatedAreas;
  }

  profileDocument(blocks) {
    const styleFreq = {};
    const headingFreq = { 1: 0, 2: 0, 3: 0 };
    let boldPrefixCount = 0;
    let listCount = 0;
    let declaredMeasures = null;

    for (const b of blocks) {
      const text = (b.text || '').trim();
      if (b.pStyle) styleFreq[b.pStyle] = (styleFreq[b.pStyle] || 0) + 1;
      if (b.headingLevel) headingFreq[b.headingLevel] = (headingFreq[b.headingLevel] || 0) + 1;
      if (b.boldPrefix && b.normalSuffix && b.boldPrefix.length >= 3 && b.normalSuffix.length >= 10) {
        boldPrefixCount++;
      }
      if (b.isList) listCount++;

      // Buscar si el documento declara explícitamente el número de medidas (ej. "200 medidas")
      if (!declaredMeasures) {
        const mDecl = text.match(/\b([1-9][0-9]{1,3})\s+(?:medidas|mesures|propuestas|propostes)\b/i);
        if (mDecl) declaredMeasures = parseInt(mDecl[1], 10);
      }
    }

    return {
      totalBlocks: blocks.length,
      styleFreq,
      headingFreq,
      boldPrefixCount,
      listCount,
      declaredMeasures
    };
  }

  detectToc(blocks) {
    let tocStartIndex = -1;
    let tocEndIndex = -1;
    const entries = [];

    // Buscar cabecera de índice en los primeros 50 bloques
    for (let i = 0; i < Math.min(blocks.length, 50); i++) {
      const b = blocks[i];
      const text = (b.text || '').trim();

      if (this.tocHeaderRegex.test(text)) {
        tocStartIndex = i;
        break;
      }
    }

    if (tocStartIndex !== -1) {
      // Recolectar entradas dentro del índice
      for (let j = tocStartIndex + 1; j < Math.min(blocks.length, tocStartIndex + 45); j++) {
        const b = blocks[j];
        const text = (b.text || '').trim();

        // El índice termina si encontramos un Heading 1 fuera de tabla y sin número de página
        if (b.headingLevel === 1 && !b.isTable && !/\d+$/.test(text)) {
          tocEndIndex = j - 1;
          break;
        }

        const isTocItem = b.isTable ||
                          b.isTocEntry ||
                          /[\.]{2,}\s*\d+$/.test(text) ||
                          /\s+\d{1,3}$/.test(text) ||
                          /^(?:área|àrea|bloque|bloc|eje|eix)?\s*[0-9ivxlcdm]+[\.\:\-\s]+/i.test(text);

        if (isTocItem) {
          const norm = this.normalizeTitle(text);
          if (norm && norm.length >= 3 && norm.length <= 80 && !entries.includes(norm)) {
            entries.push(norm);
          }
          tocEndIndex = j;
        } else if (text.length > 150) {
          tocEndIndex = j - 1;
          break;
        }
      }
    } else {
      // Detección estructural de TOC si no hubo cabecera con palabra clave
      for (let i = 0; i < Math.min(blocks.length, 30); i++) {
        const b = blocks[i];
        const text = (b.text || '').trim();
        if (/[\.]{3,}\s*\d+$/.test(text) || (b.isTable && /^[0-9]{1,2}[\.\s]/.test(text))) {
          if (tocStartIndex === -1) tocStartIndex = i;
          const norm = this.normalizeTitle(text);
          if (norm && !entries.includes(norm)) entries.push(norm);
          tocEndIndex = i;
        }
      }
    }

    return {
      hasToc: tocStartIndex !== -1 && entries.length > 0,
      startIndex: tocStartIndex,
      endIndex: tocEndIndex,
      entries
    };
  }

  segmentDocument(blocks, tocInfo, profile) {
    const coverBlocks = [];
    const presentationBlocks = [];
    const backMatterBlocks = [];
    const candidateSections = [];

    let currentSection = null;
    let isPastFrontMatter = false;
    let isBackMatter = false;

    const tocStart = tocInfo.startIndex;
    const tocEnd = tocInfo.endIndex;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const text = (b.text || '').trim();

      // Descartar números de página aislados o artefactos
      if (!text || /^\d{1,3}$/.test(text) || /^p[aá]gina\s+\d+/i.test(text)) {
        continue;
      }

      // Si estamos dentro del rango del índice, omitir del flujo de áreas y medidas
      if (tocInfo.hasToc && i >= tocStart && i <= tocEnd) {
        continue;
      }

      // Detectar Back Matter en el último tercio del documento
      if (i > blocks.length * 0.7) {
        if (b.headingLevel === 1 && (this.backMatterRegex.test(text) || /^(?:nota\s+final|conclusi)/i.test(text))) {
          isBackMatter = true;
        }
      }

      if (isBackMatter) {
        backMatterBlocks.push(b);
        continue;
      }

      // Evaluar si el bloque es un candidato a cabecera de Área
      const isCandidateArea = this.isAreaCandidateHeader(b, tocInfo.entries, blocks, i);

      if (isCandidateArea) {
        isPastFrontMatter = true;
        currentSection = {
          headerBlock: b,
          headerIndex: i,
          title: text,
          blocks: []
        };
        candidateSections.push(currentSection);
      } else {
        if (currentSection) {
          currentSection.blocks.push(b);
        } else {
          // Bloques anteriores a la primera candidata a área (Front Matter)
          if (!isPastFrontMatter) {
            const isPresentationHeader = /^(?:presentaci[oó]n|pr[oó]logo|introducci[oó]n\s+general|carta\s+de)/i.test(text);
            if (isPresentationHeader || presentationBlocks.length > 0 || (tocInfo.hasToc && i > tocEnd)) {
              presentationBlocks.push(b);
            } else {
              coverBlocks.push(b);
            }
          }
        }
      }
    }

    return {
      coverBlocks,
      presentationBlocks,
      candidateSections,
      backMatterBlocks
    };
  }

  isAreaCandidateHeader(b, tocEntries, blocks, index) {
    const text = (b.text || '').trim();
    if (!text) return false;

    // Descartar portada, índice o presentación general
    if (/^(?:programa\s+electoral|elecciones|eleccions|candidatura)/i.test(text)) return false;
    if (this.tocHeaderRegex.test(text)) return false;
    if (/^(?:presentaci[oó]n|pr[oó]logo|saluda|introducci[oó]n\s+general)[\:\.]?$/i.test(text)) return false;
    if (this.backMatterRegex.test(text)) return false;

    // Descartar si es claramente una medida con verbo de propuesta o prefijo numérico
    if (this.actionVerbsRegex.test(text)) return false;
    if (this.introPrefixRegex.test(text)) return false;
    if (this.measureNumberPrefixRegex.test(text)) return false;

    // Portada inicial (< 8 bloques): evitar falsos positivos por fuentes grandes
    if (index < 8 && !/^(?:[0-9]{1,2}[\.\:\-\s]+[A-ZÁÉÍÓÚÀÈÒÇ]|área|àrea|bloque|eje)/i.test(text)) {
      if (b.fontSize >= 28 || /mandato|mayo\s+de|maig\s+de|versión/i.test(text)) return false;
    }

    // 1. Coincidencia con entrada del índice (Señal muy fuerte)
    const norm = this.normalizeTitle(text);
    if (norm && tocEntries.length > 0) {
      if (tocEntries.some(tc => norm === tc || (tc.length >= 6 && norm.includes(tc)))) {
        return true;
      }
    }

    // 2. Patrón explícito de Área / Bloque / Eje
    if (/^(?:área|àrea|bloque|bloc|eje|eix)\s+[0-9ivxlcdm]+[\.\:\-\s]/i.test(text)) return true;

    // 3. Numeración tipo "1. Derechos sociales y cuidados" o "01. DERECHOS..."
    if (/^(?:[0-9]{1,2})\.[\s\t]+([A-ZÁÉÍÓÚÀÈÒÇ\w\s]{4,80})$/.test(text)) {
      const match = text.match(/^(?:[0-9]{1,2})\.[\s\t]+(.*)$/);
      if (match && !this.actionVerbsRegex.test(match[1])) {
        return true;
      }
    }

    // 4. Heading 1 como candidato condicional (solo si no es texto largo narrativo)
    if (b.headingLevel === 1) {
      if (text.length <= 80 && !text.endsWith('.')) {
        return true;
      }
    }

    return false;
  }

  validateAndBuildAreas(segmentation, tocInfo, profile) {
    const validatedAreas = [];
    const candidateSections = segmentation.candidateSections;

    for (let sIdx = 0; sIdx < candidateSections.length; sIdx++) {
      const section = candidateSections[sIdx];
      const text = section.title.trim();
      const norm = this.normalizeTitle(text);

      const parsedContent = this.parseAreaContent(section.blocks, String(validatedAreas.length + 1));

      // VALIDACIÓN CONTEXTUAL:
      // ¿Es un Área programática real con propuestas, o un bloque narrativo falso positivo?
      const hasMeasures = parsedContent.measures.length > 0;
      const hasSubareas = parsedContent.subareas.length > 0;
      const matchesToc = tocInfo.entries ? tocInfo.entries.some(tc => norm === tc || (tc.length >= 6 && norm.includes(tc))) : false;

      const isValidArea = (hasMeasures && parsedContent.measures.length >= 1) ||
                          (hasSubareas && parsedContent.measures.length > 0) ||
                          matchesToc;

      if (isValidArea) {
        let cleanTitle = text
          .replace(/^(?:área|àrea|bloque|bloc|eje|eix)\s+[0-9ivxlcdm]+[\.\:\-\s]*/i, '')
          .replace(/^[0-9]{1,2}\.[\s\t]+/, '')
          .trim() || text;

        validatedAreas.push({
          title: cleanTitle,
          sourceNumber: String(validatedAreas.length + 1),
          confidence: matchesToc || (hasSubareas && hasMeasures) ? 'alta' : 'media',
          introduction: parsedContent.introduction,
          subareas: parsedContent.subareas,
          measures: parsedContent.measures
        });
      } else {
        // Si no tiene medidas y estaba antes de las áreas reales, anexar a Presentación general
        if (validatedAreas.length === 0) {
          segmentation.presentationBlocks.push(section.headerBlock, ...section.blocks);
        } else if (sIdx === candidateSections.length - 1) {
          // Si está al final de todo y no tiene medidas, es Back Matter
          segmentation.backMatterBlocks.push(section.headerBlock, ...section.blocks);
        }
      }
    }

    // Si el documento era completamente plano y no detectó áreas estructuradas:
    if (validatedAreas.length === 0 && candidateSections.length > 0) {
      const allBlocks = [];
      candidateSections.forEach(s => {
        allBlocks.push(s.headerBlock, ...s.blocks);
      });
      const parsedContent = this.parseAreaContent(allBlocks, '1');
      if (parsedContent.measures.length > 0) {
        validatedAreas.push({
          title: 'Programa General',
          sourceNumber: '1',
          confidence: 'media',
          introduction: parsedContent.introduction,
          subareas: parsedContent.subareas,
          measures: parsedContent.measures
        });
      }
    }

    return validatedAreas;
  }

  parseAreaContent(blocks, areaSourceNum) {
    let introduction = '';
    const subareas = [];
    const measures = [];

    let currentSubarea = '';
    let measureCounter = 0;
    let foundFirstProposal = false;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const text = (b.text || '').trim();
      if (!text) continue;

      // 1. Subárea (Heading 2, numeración x.y, o Apartado)
      const isSubarea = (b.headingLevel === 2) ||
        (/^(?:[0-9]{1,2}\.[0-9]{1,2})\s+([A-ZÁÉÍÓÚÀÈÒÇ\w\s]{4,70})$/.test(text) && !this.actionVerbsRegex.test(text)) ||
        (/^(?:subárea|subàrea|apartado|apartat)\s+[0-9ivxlcdm]+/i.test(text));

      if (isSubarea) {
        currentSubarea = text
          .replace(/^(?:subárea|subàrea|apartado|apartat)\s+[0-9ivxlcdm]+[\.\:\-\s]*/i, '')
          .replace(/^[0-9]{1,2}\.[0-9]{1,2}\s+/, '')
          .trim();
        if (!subareas.includes(currentSubarea)) {
          subareas.push(currentSubarea);
        }
        foundFirstProposal = true;
        continue;
      }

      // 2. Introducción de Área ("Objetivo del área...", etc., o texto previo a la primera propuesta)
      const isIntroMatch = this.introPrefixRegex.test(text);
      if (isIntroMatch || (!foundFirstProposal && subareas.length === 0 && !this.isMeasureCandidate(b, blocks, i))) {
        introduction = introduction ? `${introduction}\n\n${text}` : text;
        continue;
      }

      // 3. Medida: boldPrefix + normalSuffix (PARSER ORIGINAL PRESERVADO INTACTO)
      if (b.boldPrefix && b.normalSuffix && b.boldPrefix.length >= 3 && b.normalSuffix.length >= 10) {
        foundFirstProposal = true;
        measureCounter++;

        let cleanTitle = this.cleanMeasureTitle(b.boldPrefix);
        let sNum = this.extractSourceNumber(b.boldPrefix) || `${areaSourceNum}.${measureCounter}`;

        measures.push({
          sourceNumber: sNum,
          subarea: currentSubarea,
          title: cleanTitle,
          text: b.normalSuffix.trim(),
          explanation: '',
          sourcePage: b.sourcePage || null,
          confidence: 'alta',
          requiresReview: false,
          dudoso: false,
          reviewReason: null,
          tipo: 'medida'
        });
        continue;
      }

      // 4. Medida: Título en bloque i + Cuerpo en bloque i+1
      const nextBlock = blocks[i + 1];
      const isSeparateTitleBody = this.isTitleCandidate(b) &&
                                  nextBlock &&
                                  !this.isTitleCandidate(nextBlock) &&
                                  !this.introPrefixRegex.test(nextBlock.text || '') &&
                                  (nextBlock.text || '').length > 25;

      if (isSeparateTitleBody) {
        foundFirstProposal = true;
        measureCounter++;

        let cleanTitle = this.cleanMeasureTitle(b.text);
        let bodyText = (nextBlock.text || '').trim();
        let sNum = this.extractSourceNumber(b.text) || `${areaSourceNum}.${measureCounter}`;

        measures.push({
          sourceNumber: sNum,
          subarea: currentSubarea,
          title: cleanTitle,
          text: bodyText,
          explanation: '',
          sourcePage: b.sourcePage || null,
          confidence: 'alta',
          requiresReview: false,
          dudoso: false,
          reviewReason: null,
          tipo: 'medida'
        });

        i++; // Saltar el bloque de cuerpo ya absorbido
        continue;
      }

      // 5. Medida: "TÍTULO: Texto de propuesta"
      const colonMatch = text.match(/^([A-ZÁÉÍÓÚÀÈÒÇ0-9\s]{3,65})\:\s+(.+)$/);
      if (colonMatch && colonMatch[2].length >= 15) {
        foundFirstProposal = true;
        measureCounter++;

        measures.push({
          sourceNumber: `${areaSourceNum}.${measureCounter}`,
          subarea: currentSubarea,
          title: colonMatch[1].trim(),
          text: colonMatch[2].trim(),
          explanation: '',
          sourcePage: b.sourcePage || null,
          confidence: 'alta',
          requiresReview: false,
          dudoso: false,
          reviewReason: null,
          tipo: 'medida'
        });
        continue;
      }

      // 6. Medida: Viñeta / Lista / Numeración / Verbo de propuesta política
      if (this.isMeasureCandidate(b, blocks, i)) {
        foundFirstProposal = true;
        measureCounter++;

        let sNum = this.extractSourceNumber(text) || `${areaSourceNum}.${measureCounter}`;
        let cleanText = text.replace(/^[\-•\*\–]\s*/, '').replace(/^[0-9]+[\.\)]\s*/, '').trim();

        measures.push({
          sourceNumber: sNum,
          subarea: currentSubarea,
          title: '', // Título vacío legítimo
          text: cleanText,
          explanation: '',
          sourcePage: b.sourcePage || null,
          confidence: 'alta',
          requiresReview: false,
          dudoso: false,
          reviewReason: null,
          tipo: 'medida'
        });
        continue;
      }

      // 7. Párrafo suelto dentro del área: NUEVO FALLBACK RESTRINGIDO
      // (Eliminado el antiguo `text.length >= 15 -> medida`)
      if (foundFirstProposal && this.hasPolicySyntax(text)) {
        measureCounter++;
        let sNum = `${areaSourceNum}.${measureCounter}`;
        measures.push({
          sourceNumber: sNum,
          subarea: currentSubarea,
          title: '',
          text: text,
          explanation: '',
          sourcePage: b.sourcePage || null,
          confidence: 'media',
          requiresReview: true,
          dudoso: true,
          reviewReason: 'Propuesta sin formato de lista ni verbo explícito',
          tipo: 'medida'
        });
      } else {
        // Si no ha habido propuestas previas, es parte de la introducción del área
        if (!foundFirstProposal) {
          introduction = introduction ? `${introduction}\n\n${text}` : text;
        }
      }
    }

    return {
      introduction,
      subareas,
      measures
    };
  }

  isTitleCandidate(b) {
    const text = (b.text || '').trim();
    if (!text || text.length > 90 || text.endsWith('.')) return false;
    if (this.introPrefixRegex.test(text)) return false;
    if (b.headingLevel === 3) return true;
    if (b.allBold && text.split(/\s+/).length <= 10) return true;
    if (this.measureNumberPrefixRegex.test(text) && text.length < 80) return true;
    return false;
  }

  isMeasureCandidate(b, blocks, index) {
    const text = (b.text || '').trim();
    if (!text || text.length < 15) return false;
    if (this.introPrefixRegex.test(text)) return false;

    // Lista o viñeta
    if (b.isList || /^[\-•\*\–]\s+/.test(text)) return true;

    // Prefijo numérico explícito de medida
    if (this.measureNumberPrefixRegex.test(text) || this.simpleNumberedRegex.test(text)) return true;

    // Verbo de propuesta política
    if (this.actionVerbsRegex.test(text)) return true;

    return false;
  }

  hasPolicySyntax(text) {
    return /\b(?:se\s+crear[aá]|se\s+impulsar[aá]|se\s+fomentar[aá]|se\s+destinar[aá]|compromiso|ajuntament|ayuntamiento|municipal)\b/i.test(text);
  }

  cleanMeasureTitle(str) {
    return (str || '')
      .replace(/^[0-9]+(?:\.[0-9]+)*[\.\:\-\s·]+/, '')
      .replace(/^[\-•\*\–]\s*/, '')
      .replace(/[\:\.\-]$/, '')
      .trim();
  }

  extractSourceNumber(str) {
    const match = (str || '').match(/^((?:medida|mesura|propuesta|proposta)?\s*[0-9]+(?:\.[0-9]+)*)/i);
    return match ? match[1].replace(/^(?:medida|mesura|propuesta|proposta)\s*/i, '').trim() : null;
  }

  computeDocumentStats(areas, profile) {
    let totalMeasures = 0;
    let totalSubareas = 0;
    let totalAreaIntros = 0;
    let requiresReviewCount = 0;

    areas.forEach(a => {
      totalSubareas += (a.subareas || []).length;
      if (a.introduction) totalAreaIntros++;
      (a.measures || []).forEach(m => {
        totalMeasures++;
        if (m.requiresReview || m.dudoso) requiresReviewCount++;
      });
    });

    const alerts = [];
    if (profile.declaredMeasures && profile.declaredMeasures !== totalMeasures) {
      alerts.push(`El documento declara ${profile.declaredMeasures} medidas pero se han detectado ${totalMeasures}.`);
    }

    areas.forEach(a => {
      if ((a.measures || []).length === 0) {
        alerts.push(`El área "${a.title}" no contiene ninguna medida detectada.`);
      }
    });

    let overallConfidence = 'alta';
    if (requiresReviewCount > 0 || alerts.length > 0) {
      overallConfidence = 'media';
    }

    return {
      totalAreas: areas.length,
      totalSubareas,
      totalMeasures,
      totalAreaIntros,
      requiresReviewCount,
      declaredMeasures: profile.declaredMeasures,
      overallConfidence,
      alerts
    };
  }
}

module.exports = new StructuralClassifier();
