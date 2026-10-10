const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { resolveAssetPath, sanitizeSafeName, resolveSafePath, isPathInside } = require('../utils/paths');
const configService = require('./configService');
const { resolveAreaIntroduction } = require('./projectService');

/* =====================================================================
   Exportador Word — versión corregida y estabilizada (v1.2.1)
   - La portada solo se modifica dentro de los nodos de texto <w:t>
     (nunca con expresiones regulares sobre la estructura XML).
   - Soporte para logo del municipio (PNG/JPG) con detección binaria
     y dimensiones proporcionales (máx 4x3 cm).
   - Todo el XML generado se comprueba antes de guardar: si algo está mal
     formado, la exportación se detiene con un error claro en lugar de
     producir un .docx «dañado».
   - Validación completa del paquete ZIP antes del guardado final.
   ===================================================================== */

// Opciones de maquetación
const RESTART_NUMBERING_AT_AREAS = false;   // true = la primera página de áreas se numera como 1
const PAGE_NUMBERS_IN_FRONT_MATTER = true;  // número de página en Presentación e Índice

const FIXED_TEXTS = {
  es: {
    presentacion: 'Presentación',
    indice: 'Índice',
    medidas: 'Medidas',
    cierre: 'Cierre',
    lema: 'LEMA DE CAMPAÑA',
    programa_de: 'Programa de',
    mandato: 'Mandato',
    elecciones: 'Elecciones municipales',
    footer_doc: 'Programa electoral municipal'
  },
  ca: {
    presentacion: 'Presentació',
    indice: 'Índex',
    medidas: 'Mesures',
    cierre: 'Cloenda',
    lema: 'LEMA DE CAMPANYA',
    programa_de: 'Programa de',
    mandato: 'Mandat',
    elecciones: 'Eleccions municipals',
    footer_doc: 'Programa electoral municipal'
  }
};

const MONTHS = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  ca: ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre']
};

// Textos base de la plantilla de portada (portada_programa_sant_andreu_editable.docx).
const COVER_TEXTS = {
  programa: ['Programa Municipal', 'Programa de Podemos'],
  partido: ['Candidatura', 'Podemos'],
  municipio: ['Municipio', 'Sant Andreu de la Barca'],
  elecciones: 'Elecciones municipales · 28 de mayo de 2027',
  lemaEtiqueta: 'LEMA DE CAMPAÑA',
  lema1: 'POLÍTICAS',
  lema2: 'HONESTAS'
};

// Medidas sin título: párrafo numerado (1.1, 1.2…) con el texto en peso normal.
const STYLE_MEDIDA_SIMPLE =
  '<w:style w:type="paragraph" w:styleId="MedidaSimple"><w:name w:val="Medida (sin título)"/>' +
  '<w:basedOn w:val="Normal"/><w:next w:val="MedidaSimple"/><w:uiPriority w:val="16"/><w:qFormat/>' +
  '<w:pPr><w:keepLines/><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>' +
  '<w:spacing w:before="200" w:after="0" w:line="288" w:lineRule="auto"/>' +
  '<w:ind w:left="1134" w:hanging="1134"/></w:pPr>' +
  '<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>';

const PAGE_PR =
  '<w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1304" w:right="1134" w:bottom="1361" w:left="1134" w:header="567" w:footer="680" w:gutter="0"/>';

/* ------------------------------------------------------------------ texto */

// Caracteres prohibidos en XML 1.0 (p. ej. \v o \f al pegar desde Word o PDF)
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u000B\u000C\u2028\u2029]/g, '\n')   // saltos de línea manuales de Word / PDF
    .replace(INVALID_XML_CHARS, '')
    .replace(/\t/g, ' ');
}

function escapeXml(unsafe) {
  return cleanText(unsafe)
    .replace(/\n/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Acepta texto o lista de textos; cada salto de línea pasa a ser un párrafo de Word.
function toParagraphs(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap(v => cleanText(v).split(/\r?\n/))
    .map(s => s.replace(/[ \u00A0]{2,}/g, ' ').trim())
    .filter(Boolean);
}

function oneLine(value) {
  return toParagraphs(value).join(' ');
}

function sanitizeFilename(name, fallback = 'Municipal') {
  return sanitizeSafeName(name, fallback);
}

function getMandateTwoDigits(mandato) {
  const match = String(mandato).match(/\b(\d{2,4})\b/);
  if (match) {
    const yr = match[1];
    return yr.length === 4 ? yr.slice(2) : yr;
  }
  return '27';
}

function getFirstYear(mandato) {
  const match = String(mandato).match(/\b(\d{4})\b/);
  return match ? match[1] : '2027';
}

// '2027-05-23' -> '23 de mayo de 2027' / '23 de maig de 2027'
function formatElectionDate(isoDate, lang) {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return cleanText(isoDate);
  const [, y, mo, d] = m;
  const month = (MONTHS[lang] || MONTHS.es)[Number(mo) - 1];
  if (!month) return cleanText(isoDate);
  const de = lang === 'ca' && /^[aeiouàèéíòóú]/i.test(month) ? "d'" : 'de ';
  return `${Number(d)} ${de}${month} de ${y}`;
}

/* ------------------------------------------------------------ piezas XML */

function run(text) {
  return `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function para(style, text) {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${text ? run(text) : ''}</w:p>`;
}

// Medidas: numeración explícita en el párrafo (1.1, 1.2…)
function measurePara(style, text) {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr>${run(text)}</w:p>`;
}

function sectionBreak({ footerId = null, restartAt = null } = {}) {
  const footer = footerId ? `<w:footerReference w:type="default" r:id="${footerId}"/>` : '';
  const pgNum = restartAt ? `<w:pgNumType w:start="${restartAt}"/>` : '';
  return `<w:sectPr>${footer}<w:type w:val="nextPage"/>${PAGE_PR}${pgNum}` +
    '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';
}

function sectionBreakParagraph(opts) {
  return `<w:p><w:pPr>${sectionBreak(opts)}</w:pPr></w:p>`;
}

function tocEntry(area) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr>` +
    `<w:hyperlink w:anchor="${area.bookmarkName}" w:history="1">` +
    run(area.codeStr) + '<w:r><w:tab/></w:r>' + run(area.nombre) + '<w:r><w:tab/></w:r>' +
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
    `<w:r><w:instrText xml:space="preserve"> PAGEREF ${area.bookmarkName} \\h </w:instrText></w:r>` +
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
    `<w:r><w:t>${area.estimatedPage}</w:t></w:r>` +
    '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
    '</w:hyperlink></w:p>';
}

/* ------------------------------------------------- comprobación del XML */

function assertWellFormed(xml, partName) {
  const tagRe = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/g;
  const badAmp = /&(?!(?:[A-Za-z][\w.-]*|#\d+|#x[0-9A-Fa-f]+);)/;
  const stack = [];
  let last = 0;
  let m;
  const fail = (msg, pos) => {
    const near = xml.slice(Math.max(0, pos - 80), pos + 80).replace(/\s+/g, ' ');
    throw new Error(`XML no válido en ${partName}: ${msg}. Cerca de: …${near}…`);
  };
  while ((m = tagRe.exec(xml)) !== null) {
    const between = xml.slice(last, m.index);
    const lt = between.indexOf('<');
    if (lt !== -1) fail('etiqueta mal formada', last + lt);
    if (badAmp.test(between)) fail('carácter & sin escapar', last);
    last = tagRe.lastIndex;
    if (m[2] === undefined) continue;
    const [, closing, name, , selfClosing] = m;
    if (closing) {
      const open = stack.pop();
      if (open !== name) fail(`se cierra </${name}> pero estaba abierta <${open || 'ninguna'}>`, m.index);
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  if (xml.slice(last).indexOf('<') !== -1) fail('etiqueta mal formada al final', last);
  if (stack.length) fail(`etiquetas sin cerrar: <${stack.slice(-3).join('>, <')}>`, xml.length - 1);

  // Comprobar que todos los prefijos de espacios de nombres utilizados están declarados
  const declared = new Set(['xml', 'xmlns']);
  const nsMatches = xml.matchAll(/xmlns:([A-Za-z0-9_-]+)=/g);
  for (const match of nsMatches) {
    declared.add(match[1]);
  }
  const prefixRegex = /<(\/?)([A-Za-z0-9_-]+):[A-Za-z0-9_-]+|(?:\s+([A-Za-z0-9_-]+):[A-Za-z0-9_-]+=)/g;
  let pm;
  while ((pm = prefixRegex.exec(xml)) !== null) {
    const p = pm[2] || pm[3];
    if (p && !declared.has(p)) {
      fail(`prefijo XML no declarado «${p}» (provoca error crítico en Microsoft Word)`, pm.index);
    }
  }
}

/* --------------------------------------------------------------- portada */

// Sustituye el contenido de los nodos <w:t> cuyo texto completo es oldText.
function replaceTextNodes(xml, oldText, newText) {
  let count = 0;
  const out = xml.replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, (whole, inner) => {
    if (unescapeXml(inner) !== oldText) return whole;
    count++;
    return `<w:t xml:space="preserve">${escapeXml(newText)}</w:t>`;
  });
  return { xml: out, count };
}

// Anchos de carácter (unidades por em) de las fuentes de la portada, para ajustar textos largos.
const FONT_METRICS = {
  'Bebas Neue|0': { upm: 1000, avg: 389, w: '160,210,336,412,400,589,417,188,276,276,422,400,188,270,188,389,400,400,400,400,400,400,400,400,400,400,188,188,400,400,400,363,696,401,404,383,406,363,344,391,420,192,265,414,344,538,427,400,386,400,403,372,364,402,382,557,406,394,362,276,389,276,400,300,500,401,404,383,406,363,344,391,420,192,265,414,344,538,427,400,386,400,403,372,364,402,382,557,406,394,362,276,500,276,400,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,160,210,400,400,400,400,500,400,500,738,280,336,400,270,738,500,400,400,282,282,500,405,449,188,500,282,282,335,653,653,653,363,401,401,401,401,401,401,580,383,363,363,363,363,192,192,192,192,423,427,400,400,400,400,400,400,400,402,402,402,402,394,386,407,401,401,401,401,401,401,580,383,363,363,363,363,192,192,192,192,423,427,400,400,400,400,400,400,400,402,402,402,402,394,386,394,401,401,401,401,401,401,383,383,383,383,383,383,383,383,406,406,423,423,363,363,363,363,363,363,363,363,363,363,391,391,391,391,391,391,391,391,420,420,438,438,192,192,192,192,192,192,192,192,192,192,457,457,265,265,414,414,414,344,344,344,344,344,344,343,343,364,364,427,427,427,427,427,427,542,427,427,400,400,400,400,400,400,577,577,403,403,403,403,403,403,372,372,372,372,372,372,372,372,364,364,364,364,364,364,402,402,402,402,402,402,402,402,402,402,402,402,557,557,394,394,394,362,362,362,362,362,362,0', x: { 8211: 300, 8212: 500, 8216: 188, 8217: 188, 8220: 336, 8221: 336, 8230: 500, 8364: 400, 8226: 300 } },
  'Inter Display|1': { upm: 2048, avg: 1236, w: '439,505,967,1280,1336,1920,1325,556,679,679,1097,1341,501,911,501,745,1332,798,1226,1269,1345,1229,1264,1126,1258,1264,501,505,1341,1341,1341,1162,2062,1461,1320,1487,1436,1245,1191,1507,1471,530,1151,1404,1140,1831,1485,1531,1293,1531,1332,1336,1301,1442,1445,2041,1428,1413,1299,679,745,679,948,973,604,1132,1224,1137,1224,1150,759,1224,1199,503,504,1127,503,1810,1199,1189,1224,1224,764,1065,755,1199,1134,1676,1100,1134,1071,900,710,900,1341,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,439,511,1137,1250,1511,1120,643,1102,1199,1825,909,1264,1341,0,1306,797,893,1341,812,835,604,1224,1170,501,698,549,953,1264,1617,1680,1797,1162,1461,1461,1461,1461,1461,1461,2081,1487,1245,1245,1245,1245,530,530,530,530,1534,1485,1531,1531,1531,1531,1531,1341,1531,1442,1442,1442,1442,1413,1319,1293,1132,1132,1132,1132,1132,1132,1811,1137,1150,1150,1150,1150,503,503,503,503,1177,1199,1189,1189,1189,1189,1189,1341,1189,1199,1199,1199,1199,1134,1225,1134,1461,1132,1461,1132,1461,1132,1487,1137,1487,1137,1487,1137,1487,1137,1436,1478,1534,1224,1245,1150,1245,1150,1245,1150,1245,1150,1245,1150,1507,1224,1507,1224,1507,1224,1507,1224,1471,1199,1591,1199,530,503,530,503,530,503,530,503,530,503,1681,1007,1151,504,1404,1127,1140,1140,503,1140,503,1140,757,1137,856,1222,503,1485,1199,1485,1199,1485,1199,0,1485,1199,1531,1189,1531,1189,1531,1189,2105,1933,1332,764,1332,764,1332,764,1336,1065,1336,1065,1336,1065,1336,1065,1301,755,1301,909,1301,755,1442,1199,1442,1199,1442,1199,1442,1199,1442,1199,1442,1199,2041,1676,1413,1134,1413,1299,1071,1299,1071,1299,1071,615', x: { 8211: 1024, 8212: 2048, 8216: 464, 8217: 464, 8220: 887, 8221: 871, 8230: 1502, 8364: 1354, 8226: 877 } },
  'Inter|0': { upm: 2048, avg: 1247, w: '576,589,954,1297,1314,2011,1319,614,747,747,1026,1355,590,942,590,738,1292,833,1249,1265,1323,1215,1270,1159,1267,1270,590,618,1355,1355,1355,1047,1978,1413,1340,1496,1478,1231,1209,1528,1522,550,1169,1376,1158,1850,1543,1566,1308,1566,1318,1314,1322,1524,1413,2018,1397,1390,1288,747,738,747,965,934,661,1150,1254,1170,1254,1194,758,1256,1211,496,496,1124,496,1794,1210,1228,1254,1254,771,1081,670,1211,1151,1676,1118,1151,1131,873,681,873,1355,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,576,589,1170,1251,1484,1126,553,1164,1210,1872,929,1193,1355,0,1364,978,933,1355,905,913,661,1200,1234,590,549,623,988,1193,1643,1735,1806,1047,1413,1413,1413,1413,1413,1413,2035,1496,1231,1231,1231,1231,550,550,550,550,1505,1543,1566,1566,1566,1566,1566,1355,1566,1524,1524,1524,1524,1390,1302,1262,1150,1150,1150,1150,1150,1150,1879,1170,1194,1194,1194,1194,496,496,496,496,1193,1210,1228,1228,1228,1228,1228,1355,1228,1211,1211,1211,1211,1151,1254,1151,1413,1150,1413,1150,1413,1150,1496,1170,1496,1170,1496,1170,1496,1170,1478,1454,1505,1254,1231,1194,1231,1194,1231,1194,1231,1194,1231,1194,1528,1256,1528,1256,1528,1256,1528,1256,1522,1211,1590,1211,550,496,550,496,550,496,550,496,550,496,1719,992,1169,496,1376,1124,1076,1158,496,1158,496,1158,696,1152,736,1218,496,1543,1210,1543,1210,1543,1210,0,1543,1210,1566,1228,1566,1228,1566,1228,2058,2047,1318,771,1318,771,1318,771,1314,1081,1314,1081,1314,1081,1314,1081,1322,670,1322,770,1322,670,1524,1211,1524,1211,1524,1211,1524,1211,1524,1211,1524,1211,2018,1676,1390,1151,1390,1288,1131,1288,1131,1288,1131,644', x: { 8211: 1024, 8212: 2048, 8216: 534, 8217: 534, 8220: 902, 8221: 902, 8230: 1770, 8364: 1365, 8226: 1152 } },
  'Inter|1': { upm: 2048, avg: 1295, w: '485,692,1129,1329,1341,2080,1376,694,772,772,1145,1390,684,958,684,795,1381,883,1289,1322,1385,1274,1330,1191,1333,1330,684,702,1390,1390,1390,1146,2081,1529,1355,1515,1479,1244,1202,1537,1530,575,1197,1473,1158,1908,1561,1578,1327,1591,1345,1341,1367,1499,1529,2125,1512,1497,1360,772,795,772,997,975,748,1189,1291,1205,1291,1220,815,1294,1275,555,555,1188,555,1869,1275,1256,1291,1291,834,1147,750,1275,1228,1741,1188,1233,1173,960,761,960,1390,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,485,692,1205,1308,1560,1168,694,1164,1275,1872,950,1352,1390,0,1356,899,941,1390,942,966,748,1286,1226,684,746,682,1003,1352,1732,1805,1884,1146,1529,1529,1529,1529,1529,1529,2094,1515,1244,1244,1244,1244,575,575,575,575,1556,1561,1578,1578,1578,1578,1578,1390,1578,1499,1499,1499,1499,1497,1370,1346,1189,1189,1189,1189,1189,1189,1864,1205,1220,1220,1220,1220,555,555,555,555,1227,1275,1256,1256,1256,1256,1256,1390,1256,1275,1275,1275,1275,1233,1291,1233,1529,1189,1529,1189,1529,1189,1515,1205,1515,1205,1515,1205,1515,1205,1479,1545,1556,1291,1244,1220,1244,1220,1244,1220,1244,1220,1244,1220,1537,1294,1537,1294,1537,1294,1537,1294,1530,1275,1653,1275,575,555,575,555,575,555,575,555,575,555,1771,1111,1197,555,1473,1188,1201,1158,555,1158,555,1158,809,1183,920,1240,555,1561,1275,1561,1275,1561,1275,0,1561,1275,1578,1256,1578,1256,1578,1256,2084,2023,1345,834,1345,834,1345,834,1341,1147,1341,1147,1341,1147,1341,1147,1367,750,1367,904,1367,750,1499,1275,1499,1275,1499,1275,1499,1275,1499,1275,1499,1275,2125,1741,1497,1233,1497,1360,1173,1360,1173,1360,1173,706', x: { 8211: 1024, 8212: 2048, 8216: 636, 8217: 636, 8220: 1106, 8221: 1089, 8230: 2052, 8364: 1402, 8226: 971 } },
};

const METRICS = Object.fromEntries(Object.entries(FONT_METRICS)
  .map(([k, v]) => [k, { ...v, w: v.w.split(',').map(Number) }]));

// Ancho aproximado (en puntos) de un texto con la fuente, cuerpo y espaciado del cuadro.
function glyphWidthPt(text, fontName, bold, sizePt) {
  const m = METRICS[`${fontName}|${bold ? 1 : 0}`] || METRICS[`${fontName}|0`];
  const chars = [...text];
  if (!m) return chars.length * sizePt * 0.6;
  let units = 0;
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    const w = (cp >= 32 && cp < 384) ? m.w[cp - 32] : m.x[cp];
    units += w || m.avg;
  }
  return units / m.upm * sizePt;
}

// Si el texto no cabe en el ancho de su cuadro (sin ajuste de línea), reduce el cuerpo de letra.
function fitTextboxToWidth(xml, text) {
  if (!text) return xml;
  const pos = xml.indexOf(`>${escapeXml(text)}</w:t>`);
  if (pos < 0) return xml;
  const anchorStart = xml.lastIndexOf('<wp:anchor', pos);
  const boxStart = xml.lastIndexOf('<w:txbxContent>', pos);
  const boxEnd = xml.indexOf('</w:txbxContent>', pos);
  if (anchorStart < 0 || boxStart < anchorStart || boxEnd < 0) return xml;
  const cx = Number((xml.slice(anchorStart, boxStart).match(/<wp:extent cx="(\d+)"/) || [])[1]);
  if (!cx) return xml;

  const box = xml.slice(boxStart, boxEnd);
  const font = (box.match(/w:ascii="([^"]+)"/) || [])[1] || 'Inter';
  const bold = /<w:b\/>/.test(box);
  const caps = /<w:caps\/>/.test(box);
  const sizePt = Number((box.match(/<w:sz w:val="(\d+)"\/>/) || [])[1] || 22) / 2;
  const trackingPt = Number((box.match(/<w:spacing w:val="(-?\d+)"\/>/) || [])[1] || 0) / 20;
  const shown = caps ? text.toUpperCase() : text;
  const n = [...shown].length;
  const glyphs = glyphWidthPt(shown, font, bold, sizePt);
  const available = (cx / 12700) * 0.96;               // EMU -> pt, con un pequeño margen
  if (glyphs + trackingPt * n <= available) return xml;

  const factor = Math.max(0.3, (available - trackingPt * n) / glyphs);
  const scaled = box.replace(/<w:(sz|szCs) w:val="(\d+)"\/>/g,
    (w, tag, v) => `<w:${tag} w:val="${Math.max(12, Math.floor(Number(v) * factor))}"/>`);
  return xml.slice(0, boxStart) + scaled + xml.slice(boxEnd);
}

function customizeCover(coverBody, values, warnings) {
  let xml = coverBody;
  const set = (key, newText, { required = true } = {}) => {
    const rawTarget = COVER_TEXTS[key];
    const targets = Array.isArray(rawTarget) ? rawTarget : [rawTarget];
    let totalCount = 0;
    for (const oldText of targets) {
      const res = replaceTextNodes(xml, oldText, newText);
      xml = res.xml;
      totalCount += res.count;
    }
    if (totalCount === 0 && required) {
      warnings.push(`Portada: no se encontró el texto «${targets[0]}» en la plantilla; ese dato no se ha sustituido.`);
    }
    if (totalCount > 0 && newText) xml = fitTextboxToWidth(xml, newText);
  };

  // Requisito 3: "PROGRAMA ELECTORAL" únicamente
  set('programa', 'PROGRAMA ELECTORAL');

  // Requisito 5: Eliminar "Podemos" de la parte inferior derecha
  set('partido', '', { required: false });

  // Requisito 4: Nombre del municipio inmediatamente debajo
  set('municipio', values.municipio);
  set('elecciones', values.elecciones);

  // Requisito 2: Lema de campaña dinámico o limpio sin alterar estructura
  if (values.lema1 || values.lema2) {
    set('lemaEtiqueta', values.lemaEtiqueta, { required: false });
    set('lema1', values.lema1);
    set('lema2', values.lema2);
    xml = xml.replace(/name="Texto POL[Í\u00cd]TICAS"/g, 'name="Texto Lema 1"');
    xml = xml.replace(/name="Texto HONESTAS"/g, 'name="Texto Lema 2"');
  } else {
    // Sin lema: se vacían los cuadros de texto del lema (no se toca la estructura XML)
    set('lemaEtiqueta', '', { required: false });
    set('lema1', '', { required: false });
    set('lema2', '', { required: false });
    xml = xml.replace(/name="Texto POL[Í\u00cd]TICAS"/g, 'name="Cuadro Lema 1"');
    xml = xml.replace(/name="Texto HONESTAS"/g, 'name="Cuadro Lema 2"');
  }
  return xml;
}

// Reparte el lema en dos líneas: corta preferentemente tras una coma o punto, si no, por la mitad.
function splitLema(lema) {
  const words = oneLine(lema).toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [words[0] || '', ''];
  const total = words.join(' ').length;
  let best = 1;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    let score = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (/[,;:.]$/.test(words[i - 1])) score -= total * 0.35;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

// Copia a la exportación las fuentes incrustadas que usa la portada y no están en la plantilla (p. ej. Bebas Neue).
async function mergeCoverFonts(zip, coverZip) {
  const coverTableFile = coverZip.file('word/fontTable.xml');
  const coverRelsFile = coverZip.file('word/_rels/fontTable.xml.rels');
  const mainTableFile = zip.file('word/fontTable.xml');
  if (!coverTableFile || !coverRelsFile || !mainTableFile) return;

  const coverTable = await coverTableFile.async('text');
  const coverRels = await coverRelsFile.async('text');
  let mainTable = await mainTableFile.async('text');
  const mainRelsFile = zip.file('word/_rels/fontTable.xml.rels');
  let mainRels = mainRelsFile
    ? await mainRelsFile.async('text')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  const existing = new Set([...mainTable.matchAll(/<w:font w:name="([^"]+)"/g)].map(x => x[1]));
  const targets = {};
  for (const rel of coverRels.match(/<Relationship\b[^>]*>/g) || []) {
    const id = (rel.match(/\bId="([^"]+)"/) || [])[1];
    const target = (rel.match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) targets[id] = target;
  }

  let n = 0;
  for (const fm of coverTable.matchAll(/<w:font w:name="([^"]+)">[\s\S]*?<\/w:font>/g)) {
    const [fontXml, name] = fm;
    if (existing.has(name)) continue;
    let newFontXml = fontXml;
    for (const em of fontXml.matchAll(/r:id="([^"]+)"/g)) {
      const target = targets[em[1]];
      const fontFile = target && coverZip.file('word/' + target);
      if (!fontFile) continue;
      n++;
      const newId = `rIdCoverFont${n}`;
      const newTarget = `fonts/portada_font${n}.odttf`;
      zip.file('word/' + newTarget, await fontFile.async('nodebuffer'), { createFolders: false });
      mainRels = mainRels.replace('</Relationships>',
        `<Relationship Id="${newId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${newTarget}"/></Relationships>`);
      newFontXml = newFontXml.replace(`r:id="${em[1]}"`, `r:id="${newId}"`);
    }
    mainTable = mainTable.replace('</w:fonts>', newFontXml + '</w:fonts>');
    existing.add(name);
  }
  zip.file('word/fontTable.xml', mainTable, { createFolders: false });
  zip.file('word/_rels/fontTable.xml.rels', mainRels, { createFolders: false });
}

/* -------------------------------------------------- detección binaria del logo */

function detectImageHeader(buf) {
  if (!buf || buf.length < 24) return null;

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) {
    if (buf.toString('ascii', 12, 16) === 'IHDR') {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) {
        return { format: 'png', width, height, mime: 'image/png', ext: 'png' };
      }
    }
  }

  // 2. JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    let offset = 2;
    while (offset + 4 < buf.length) {
      if (buf[offset] !== 0xFF) { offset++; continue; }
      while (offset < buf.length && buf[offset] === 0xFF) offset++;
      if (offset >= buf.length) break;
      const marker = buf[offset++];
      if (marker === 0xD9 || marker === 0xDA) break; // EOI o SOS
      if (offset + 2 > buf.length) break;
      const len = buf.readUInt16BE(offset);
      // Marcadores SOF (Start of Frame)
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        if (offset + 7 <= buf.length) {
          const height = buf.readUInt16BE(offset + 3);
          const width = buf.readUInt16BE(offset + 5);
          if (width > 0 && height > 0) {
            return { format: 'jpg', width, height, mime: 'image/jpeg', ext: 'jpg' };
          }
        }
      }
      offset += len;
    }
  }

  return null;
}

/* -------------------------------------------------- estimación de páginas */

const LINES_PER_PAGE = 44;
const linesFor = (text, charsPerLine) => Math.max(1, Math.ceil(String(text || '').length / charsPerLine));

function estimateAreaPages(area) {
  let lines = 5; // título + filete
  if (area.entradilla.length) lines += area.entradilla.reduce((s, t) => s + linesFor(t, 62) + 1, 0);
  lines += area.parrafos.reduce((s, t) => s + linesFor(t, 80) + 1, 0);
  if (area.frase) lines += linesFor(area.frase, 48) + 2;
  lines += 3; // etiqueta «Medidas»
  for (const m of area.medidas) {
    if (m.titulo) lines += linesFor(m.titulo, 60) + 1;
    lines += m.textos.reduce((s, t) => s + linesFor(t, 80), 0) + 0.8;
  }
  return Math.max(1, Math.ceil(lines / LINES_PER_PAGE));
}

function estimateTextPages(paragraphs) {
  const lines = 8 + paragraphs.reduce((s, t) => s + linesFor(t, 80) + 1, 0);
  return Math.max(1, Math.ceil(lines / LINES_PER_PAGE));
}

/* ------------------------------------------------------------- exportar */

async function exportProjectToDocx(project, options = {}) {
  if (options.exportBothLanguages) {
    const res1 = await exportProjectToDocx(project, { ...options, exportBothLanguages: false, idioma: 'es', suffix: '_ES' });
    const res2 = await exportProjectToDocx(project, { ...options, exportBothLanguages: false, idioma: 'ca', suffix: '_CA' });
    return {
      success: true,
      files: [res1, res2],
      filePath: res1.filePath,
      fileName: res1.fileName,
      warnings: [...(res1.warnings || []), ...(res2.warnings || [])]
    };
  }

  const warnings = [];
  const primaryLang = project.idioma_principal || 'es';
  const targetLang = options.idioma || primaryLang;
  const txt = FIXED_TEXTS[targetLang] || FIXED_TEXTS.es;
  const translating = targetLang !== primaryLang;

  // Plantillas
  const templatePath = resolveAssetPath('templates', 'modelo_programa_final.docx');
  const portadaPath = resolveAssetPath('templates', 'portada_programa_sant_andreu_editable.docx');
  if (!fs.existsSync(templatePath)) {
    throw new Error('No se encontró la plantilla Word en la ruta: ' + templatePath);
  }
  const zip = await JSZip.loadAsync(fs.readFileSync(templatePath));

  // 1. Portada
  const partido = oneLine(project.partido) || 'Podemos';
  const municipio = oneLine(project.municipio);
  const mandato = oneLine(project.mandato) || '2027–2031';
  const referenciaElectoral = project.fecha_electoral
    ? `${txt.elecciones} · ${formatElectionDate(project.fecha_electoral, targetLang)}`
    : `${txt.elecciones} ${getFirstYear(mandato)}`;
  const [lema1, lema2] = splitLema(project.lema);

  let coverXml = '';
  if (fs.existsSync(portadaPath)) {
    const coverZip = await JSZip.loadAsync(fs.readFileSync(portadaPath));
    const pXml = await coverZip.file('word/document.xml').async('text');
    const bodyOpen = pXml.indexOf('<w:body>');
    const bodySect = pXml.lastIndexOf('<w:sectPr');      // sectPr final del cuerpo
    if (bodyOpen !== -1 && bodySect > bodyOpen) {
      coverXml = customizeCover(pXml.substring(bodyOpen + '<w:body>'.length, bodySect), {
        programa: `${txt.programa_de} ${partido}`,
        partido,
        municipio,
        elecciones: referenciaElectoral,
        lemaEtiqueta: txt.lema,
        lema1,
        lema2
      }, warnings);
      await mergeCoverFonts(zip, coverZip);
    } else {
      warnings.push('Portada: la plantilla de portada no tiene la estructura esperada; se usa una portada básica.');
    }
  } else {
    warnings.push('Portada: no se encontró la plantilla de portada; se usa una portada básica.');
  }
  if (!coverXml) {
    coverXml =
      `<w:p><w:pPr><w:pStyle w:val="TituloSeccion"/><w:pageBreakBefore w:val="0"/><w:spacing w:before="4000"/><w:jc w:val="center"/></w:pPr>${run('PROGRAMA ELECTORAL')}</w:p>` +
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="48"/></w:rPr><w:t xml:space="preserve">${escapeXml(municipio)}</w:t></w:r></w:p>` +
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run(referenciaElectoral)}</w:p>`;
  }

  // 1.1 Procesar Logo de la agrupación si existe
  let logoParagraphXml = null;
  let hasLogoMedia = false;
  let expectedLogoMediaPath = null;
  let expectedLogoRelTarget = null;

  // Leer relaciones actuales de word/document.xml
  const docRelsFile = zip.file('word/_rels/document.xml.rels');
  let docRelsXml = docRelsFile
    ? await docRelsFile.async('text')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  // Leer Content_Types actual
  const contentTypesFile = zip.file('[Content_Types].xml');
  let contentTypesXml = contentTypesFile
    ? await contentTypesFile.async('text')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>';

  if (project.logo_path) {
    try {
      if (!fs.existsSync(project.logo_path)) {
        warnings.push('No se ha podido incorporar el logotipo de la agrupación al documento. El programa se ha exportado sin logotipo.');
      } else {
        const logoBuffer = fs.readFileSync(project.logo_path);
        const imageInfo = detectImageHeader(logoBuffer);
        if (!imageInfo) {
          warnings.push('No se ha podido incorporar el logotipo de la agrupación al documento (formato no admitido o cabecera binaria inválida). El programa se ha exportado sin logotipo.');
        } else {
          // Calcular dimensiones proporcionales (máx 4 cm de ancho x 3 cm de alto; 1 cm = 360000 EMU)
          const MAX_CX = 1440000; // 4 cm
          const MAX_CY = 1080000; // 3 cm
          const ratio = imageInfo.width / imageInfo.height;
          let cx, cy;
          if (ratio >= (MAX_CX / MAX_CY)) {
            cx = MAX_CX;
            cy = Math.max(1, Math.round(MAX_CX / ratio));
          } else {
            cy = MAX_CY;
            cx = Math.max(1, Math.round(MAX_CY * ratio));
          }

          // Posición: zona inferior derecha de la portada (alineado con margen derecho y borde inferior)
          const POS_H = Math.round(7300000 - cx);
          const POS_V = Math.round(10420000 - cy);

          // Guardar imagen en el ZIP
          const mediaFileName = `logo_municipio.${imageInfo.ext}`;
          expectedLogoMediaPath = `word/media/${mediaFileName}`;
          expectedLogoRelTarget = `media/${mediaFileName}`;
          zip.file(expectedLogoMediaPath, logoBuffer, { createFolders: false });
          hasLogoMedia = true;

          // Generar ID único para la relación
          const existingRelIds = new Set([...docRelsXml.matchAll(/Id="([^"]+)"/g)].map(m => m[1]));
          let relNum = 1;
          while (existingRelIds.has(`rIdLogo${relNum}`)) { relNum++; }
          const logoRelId = `rIdLogo${relNum}`;

          // Añadir relación a word/_rels/document.xml.rels
          const relXml = `<Relationship Id="${logoRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${expectedLogoRelTarget}"/>`;
          docRelsXml = docRelsXml.replace('</Relationships>', relXml + '</Relationships>');

          // Garantizar extensión en [Content_Types].xml sin duplicar
          if (imageInfo.ext === 'png' && !contentTypesXml.includes('Extension="png"')) {
            contentTypesXml = contentTypesXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
          } else if (imageInfo.ext === 'jpg' && !contentTypesXml.includes('Extension="jpg"')) {
            contentTypesXml = contentTypesXml.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>');
          }

          // Generar ID único para wp:docPr
          const existingDocIds = [...coverXml.matchAll(/\bid="(\d+)"/gi)].map(m => Number(m[1]));
          const maxDocId = existingDocIds.length > 0 ? Math.max(100, ...existingDocIds) : 100;
          const docPrId = maxDocId + 1;
          const cNvPrId = maxDocId + 2;

          // Párrafo flotante con DrawingML en la zona inferior derecha (sin recortar, proporción original preservada)
          logoParagraphXml =
            '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing>' +
            `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251675000" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
            '<wp:simplePos x="0" y="0"/>' +
            `<wp:positionH relativeFrom="page"><wp:posOffset>${POS_H}</wp:posOffset></wp:positionH>` +
            `<wp:positionV relativeFrom="page"><wp:posOffset>${POS_V}</wp:posOffset></wp:positionV>` +
            `<wp:extent cx="${cx}" cy="${cy}"/>` +
            '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
            '<wp:wrapNone/>' +
            `<wp:docPr id="${docPrId}" name="Logo de la Agrupación" descr="Logo municipal"/>` +
            '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
            '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            `<pic:nvPicPr><pic:cNvPr id="${cNvPrId}" name="Logo"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr>` +
            `<pic:blipFill><a:blip r:embed="${logoRelId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
            `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
            '</pic:pic>' +
            '</a:graphicData>' +
            '</a:graphic>' +
            '</wp:anchor>' +
            '</w:drawing></w:r></w:p>';
        }
      }
    } catch (err) {
      console.warn('Error al procesar logo para DOCX:', err);
      warnings.push('No se ha podido incorporar el logotipo de la agrupación al documento. El programa se ha exportado sin logotipo.');
      logoParagraphXml = null;
      hasLogoMedia = false;
    }
  }

  // 2. Textos generales (Fase 1: Si está vacío, está vacío. Prohibición de contenido inventado)
  const generalTexts = project.textos_generales || {};
  let customPresTitulo = oneLine(generalTexts.presentacion_titulo) || '';
  let presentacionEntradilla = toParagraphs(generalTexts.presentacion_entradilla || '');
  let presentacionParrafos = toParagraphs(generalTexts.presentacion_parrafos || []);

  // Resolución bilingüe precisa de Presentación según idioma de exportación
  if (generalTexts.presentacion && (generalTexts.presentacion.es || generalTexts.presentacion.ca)) {
    const presLang = generalTexts.presentacion[targetLang];
    if (presLang) {
      customPresTitulo = oneLine(presLang.titulo) || '';
      presentacionEntradilla = toParagraphs(presLang.entradilla || '');
      presentacionParrafos = toParagraphs(presLang.parrafos || []);
    } else {
      customPresTitulo = '';
      presentacionEntradilla = [];
      presentacionParrafos = [];
    }
  } else if (targetLang !== primaryLang) {
    if (generalTexts.presentacion_traduccion && generalTexts.presentacion_traduccion.length > 0) {
      presentacionParrafos = toParagraphs(generalTexts.presentacion_traduccion);
    }
  }

  const hasPresBody = Boolean(presentacionEntradilla.length > 0 || presentacionParrafos.length > 0);
  const hasPresTitle = Boolean(customPresTitulo.trim().length > 0);
  const hasPresentation = hasPresBody;
  const presentacionTitulo = hasPresTitle ? customPresTitulo : txt.presentacion;

  let customCierreTitulo = oneLine(generalTexts.cierre_titulo) || '';
  let cierreParrafos = toParagraphs(generalTexts.cierre_parrafos || []);

  // Resolución bilingüe precisa de Cierre según idioma de exportación
  if (generalTexts.cierre && (generalTexts.cierre.es || generalTexts.cierre.ca)) {
    const cierreLang = generalTexts.cierre[targetLang];
    if (cierreLang) {
      customCierreTitulo = oneLine(cierreLang.titulo) || '';
      cierreParrafos = toParagraphs(cierreLang.parrafos || []);
    } else {
      customCierreTitulo = '';
      cierreParrafos = [];
    }
  } else if (targetLang !== primaryLang) {
    if (generalTexts.cierre_traduccion && generalTexts.cierre_traduccion.length > 0) {
      cierreParrafos = toParagraphs(generalTexts.cierre_traduccion);
    }
  }
  const hasCierreBody = Boolean(cierreParrafos.length > 0);
  const hasCierreTitle = Boolean(customCierreTitulo.trim().length > 0);
  const hasCierre = hasCierreBody;
  const cierreTitulo = hasCierreTitle ? customCierreTitulo : txt.cierre;

  // 3. Áreas con al menos una medida exportable
  let missingTranslations = 0;
  const pick = (original, translated) => {
    if (!translating) return original;
    if (translated && String(translated).trim()) return translated;
    if (original && String(original).trim()) missingTranslations++;
    return original;
  };

  const areasToExport = [];
  for (const a of project.areas || []) {
    const includedMarco = (a.medidas || []).filter(m => m.decision && ['incluida', 'adaptada'].includes(m.decision.estado));
    const includedPropias = (a.medidas_propias || []).filter(p => ['incluida', 'adaptada'].includes(p.estado));
    if (includedMarco.length === 0 && includedPropias.length === 0) continue;

    const fromPropia = p => ({
      titulo: pick(p.titulo, p.traduccion_titulo),
      texto: pick(p.texto, p.traduccion_texto),
      explicacion: pick(p.explicacion, p.traduccion_explicacion)
    });

    const fromMarco = m => {
      let finalTitulo, finalTexto, finalExplicacion;
      if (targetLang === primaryLang) {
        finalTitulo = m.decision ? (m.decision.version_municipal_titulo || m.titulo) : m.titulo;
        finalTexto = m.decision ? (m.decision.version_municipal_texto || m.texto) : m.texto;
        finalExplicacion = m.decision ? (m.decision.version_municipal_explicacion || m.explicacion) : m.explicacion;
      } else {
        // Exportando en el segundo idioma
        if (m.decision && m.decision.traduccion_texto && m.decision.traduccion_texto.trim()) {
          finalTexto = m.decision.traduccion_texto;
          finalTitulo = m.decision.traduccion_titulo || (m.decision.version_municipal_titulo || m.titulo);
          finalExplicacion = m.decision.traduccion_explicacion || (m.decision.version_municipal_explicacion || m.explicacion);
        } else if (targetLang === 'ca' && m.texto_ca) {
          finalTexto = m.texto_ca;
          finalTitulo = m.titulo_ca || (m.decision ? m.decision.version_municipal_titulo : null) || m.titulo;
          finalExplicacion = m.explicacion_ca || (m.decision ? m.decision.version_municipal_explicacion : null) || m.explicacion;
        } else if (targetLang === 'es' && m.texto_es) {
          finalTexto = m.texto_es;
          finalTitulo = m.titulo_es || (m.decision ? m.decision.version_municipal_titulo : null) || m.titulo;
          finalExplicacion = m.explicacion_es || (m.decision ? m.decision.version_municipal_explicacion : null) || m.explicacion;
        } else {
          finalTitulo = m.decision ? (m.decision.version_municipal_titulo || m.titulo) : m.titulo;
          finalTexto = m.decision ? (m.decision.version_municipal_texto || m.texto) : m.texto;
          finalExplicacion = m.decision ? (m.decision.version_municipal_explicacion || m.explicacion) : m.explicacion;
        }
      }
      return {
        titulo: finalTitulo,
        texto: finalTexto,
        explicacion: finalExplicacion
      };
    };

    const combined = [
      ...includedPropias.filter(p => p.posicion === 'inicio').map(fromPropia),
      ...includedMarco.map(fromMarco),
      ...includedPropias.filter(p => p.posicion !== 'inicio').map(fromPropia)
    ].map(m => ({
      titulo: oneLine(m.titulo),
      textos: toParagraphs(m.texto),
      explicaciones: toParagraphs(m.explicacion)
    })).filter(m => m.titulo || m.textos.length);

    if (combined.length === 0) continue;

    const areaNumber = areasToExport.length + 1;
    const intro = resolveAreaIntroduction ? resolveAreaIntroduction(project, a.id, targetLang) : ((generalTexts.introducciones_areas && generalTexts.introducciones_areas[a.id]) || {});
    const entradilla = toParagraphs(intro.entradilla);
    const areaName = targetLang === 'ca' ? (a.nombre_ca || a.nombre) : (a.nombre_es || a.nombre);

    areasToExport.push({
      nombre: oneLine(areaName),
      codeStr: String(areaNumber).padStart(2, '0'),
      bookmarkName: `_Toc${180000000 + areaNumber}`,
      entradilla: entradilla.slice(0, 1),
      parrafos: [...entradilla.slice(1), ...toParagraphs(intro.texto !== undefined ? intro.texto : (intro.parrafos || []))],
      frase: oneLine(intro.frase_destacada !== undefined ? intro.frase_destacada : intro.frase) || null,
      medidas: combined
    });
  }
  if (missingTranslations > 0) {
    warnings.push(`Idioma ${targetLang.toUpperCase()}: ${missingTranslations} textos de medidas no tienen traducción y salen en el idioma original.`);
  }
  if (areasToExport.length === 0) {
    warnings.push('No hay ninguna medida incluida o adaptada: el documento sale sin áreas.');
  }

  // Páginas estimadas para el índice
  const presPages = hasPresentation ? estimateTextPages([...presentacionEntradilla, ...presentacionParrafos]) : 0;
  const tocPages = areasToExport.length > 16 ? 2 : 1;
  let page = RESTART_NUMBERING_AT_AREAS ? 1 : 1 + presPages + tocPages + 1;
  for (const a of areasToExport) {
    a.estimatedPage = page;
    page += estimateAreaPages(a);
  }

  // 4. document.xml
  const body = [];
  body.push(coverXml);
  if (logoParagraphXml) {
    body.push(logoParagraphXml);
  }
  body.push(sectionBreakParagraph());                                   // sección 1: portada, sin pie

  // SECCIÓN PRESENTACIÓN: Únicamente si el usuario ha redactado contenido real
  if (hasPresentation) {
    body.push(para('TituloSeccion', presentacionTitulo));                 // los títulos ya llevan «salto de página antes»
    body.push(para('Filete'));
    presentacionEntradilla.slice(0, 1).forEach(t => body.push(para('Entradilla', t)));
    [...presentacionEntradilla.slice(1), ...presentacionParrafos].forEach(t => body.push(para('Texto', t)));
  }

  body.push(para('TituloSeccion', txt.indice));
  body.push(para('Filete'));
  areasToExport.forEach(a => body.push(tocEntry(a)));
  body.push(sectionBreakParagraph({ footerId: PAGE_NUMBERS_IN_FRONT_MATTER ? 'rIdFooter1' : null })); // sección 2

  areasToExport.forEach((a, i) => {
    body.push(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>` +
      `<w:bookmarkStart w:id="${i}" w:name="${a.bookmarkName}"/>${run(a.nombre)}<w:bookmarkEnd w:id="${i}"/></w:p>`
    );
    body.push(para('Filete'));
    a.entradilla.forEach(t => body.push(para('Entradilla', t)));
    a.parrafos.forEach(t => body.push(para('Texto', t)));
    if (a.frase) body.push(para('Destacado', a.frase));
    body.push(para('Etiqueta', txt.medidas));
    for (const m of a.medidas) {
      if (m.titulo) {
        body.push(measurePara('Medida', m.titulo));
        m.textos.forEach(t => body.push(para('MedidaTexto', t)));
      } else {
        body.push(measurePara('MedidaSimple', m.textos[0]));
        m.textos.slice(1).forEach(t => body.push(para('MedidaTexto', t)));
      }
      m.explicaciones.forEach(t => body.push(para('MedidaTexto', t)));
    }
  });

  // SECCIÓN CIERRE: Únicamente si el usuario ha redactado contenido de cierre
  if (hasCierre) {
    body.push(sectionBreakParagraph({ footerId: 'rIdFooter2', restartAt: RESTART_NUMBERING_AT_AREAS ? 1 : null })); // sección 3
    body.push(para('TituloSeccion', cierreTitulo));
    body.push(para('Filete'));
    cierreParrafos.forEach(t => body.push(para('Texto', t)));
  }

  const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:v="urn:schemas-microsoft-com:vml" ' +
    'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
    'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" ' +
    'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ' +
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14 wp14 w15">' +
    '<w:body>' + body.join('') + sectionBreak({ footerId: 'rIdFooter1' }) + '</w:body></w:document>'; // sección 4: cierre

  const parts = {
    'word/document.xml': docXml,
    'word/_rels/document.xml.rels': docRelsXml,
    '[Content_Types].xml': contentTypesXml
  };

  // 5. styles.xml: estilo para medidas sin título e idioma de corrección
  let stylesXml = await zip.file('word/styles.xml').async('text');
  if (!stylesXml.includes('w:styleId="MedidaSimple"')) {
    stylesXml = stylesXml.replace('</w:styles>', STYLE_MEDIDA_SIMPLE + '</w:styles>');
  }
  if (targetLang === 'ca') stylesXml = stylesXml.replace(/w:lang w:val="es-ES"/g, 'w:lang w:val="ca-ES"');
  parts['word/styles.xml'] = stylesXml;

  // 6. numbering.xml: números de medida en negrita
  let numberingXml = await zip.file('word/numbering.xml').async('text');
  numberingXml = numberingXml.replace(/(<w:lvl w:ilvl="1">(?:(?!<\/w:lvl>)[\s\S])*?<w:rPr>)(?!<w:b\/>)/, '$1<w:b/><w:bCs/>');
  parts['word/numbering.xml'] = numberingXml;

  // 7. settings.xml: actualizar campos al abrir
  let settingsXml = await zip.file('word/settings.xml').async('text');
  if (!settingsXml.includes('w:updateFields')) {
    settingsXml = settingsXml.includes('<w:compat>')
      ? settingsXml.replace('<w:compat>', '<w:updateFields w:val="true"/><w:compat>')
      : settingsXml.replace('</w:settings>', '<w:updateFields w:val="true"/></w:settings>');
  }
  parts['word/settings.xml'] = settingsXml;

  // 8. Pies de página (robustos, sin STYLEREF que provoque errores de referencia)
  const footerTitle = `${txt.footer_doc} · ${municipio}`;
  const customFooterXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>' +
    `<w:r><w:t xml:space="preserve">${escapeXml(footerTitle)}</w:t></w:r>` +
    '<w:r><w:tab/></w:r>' +
    '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="9169F4" w:themeColor="accent1"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>' +
    '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="9169F4" w:themeColor="accent1"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
    '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="9169F4" w:themeColor="accent1"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>' +
    '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="9169F4" w:themeColor="accent1"/></w:rPr><w:t xml:space="preserve">1</w:t></w:r>' +
    '<w:r><w:rPr><w:b/><w:bCs/><w:color w:val="9169F4" w:themeColor="accent1"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>' +
    '</w:p></w:ftr>';

  parts['word/footer1.xml'] = customFooterXml;
  parts['word/footer2.xml'] = customFooterXml;

  // 9. Propiedades del documento
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  parts['docProps/core.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(`Programa Electoral Municipal — ${partido} ${municipio}`.trim())}</dc:title>` +
    `<dc:subject>${escapeXml(`${txt.footer_doc} ${mandato}`)}</dc:subject>` +
    `<dc:creator>${escapeXml(`${partido} ${municipio}`.trim())}</dc:creator>` +
    `<dc:language>${targetLang === 'ca' ? 'ca-ES' : 'es-ES'}</dc:language>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>';

  // 10. Comprobar todo el XML antes de escribir nada (Validación obligatoria)
  for (const name of ['word/fontTable.xml', 'word/_rels/fontTable.xml.rels']) {
    const f = zip.file(name);
    if (f) parts[name] = await f.async('text');
  }
  for (const [name, xml] of Object.entries(parts)) {
    assertWellFormed(xml, name);
    zip.file(name, xml, { createFolders: false });
  }

  const outBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  // 10.1 Validación estructural del paquete ZIP antes de persistir
  const verifyZip = await JSZip.loadAsync(outBuffer);
  const requiredParts = [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/_rels/document.xml.rels',
    'word/styles.xml'
  ];
  for (const req of requiredParts) {
    const file = verifyZip.file(req);
    if (!file) {
      throw new Error(`Paquete DOCX inválido: falta el archivo esencial ${req}`);
    }
    const xmlContent = await file.async('text');
    assertWellFormed(xmlContent, req);
  }
  if (hasLogoMedia && expectedLogoMediaPath) {
    if (!verifyZip.file(expectedLogoMediaPath)) {
      throw new Error(`Paquete DOCX incompleto: falta el archivo de imagen ${expectedLogoMediaPath}`);
    }
    const relsContent = await verifyZip.file('word/_rels/document.xml.rels').async('text');
    if (!relsContent.includes(expectedLogoRelTarget)) {
      throw new Error(`Paquete DOCX incompleto: la relación para ${expectedLogoRelTarget} no se encuentra en document.xml.rels`);
    }
  }

  // 11. Guardar (archivo temporal + renombrar; aviso claro si está abierto en Word/LibreOffice)
  const twoDigits = getMandateTwoDigits(mandato);
  const exportBase = path.resolve(options.outputDir || await configService.getExportDirectory());
  const munSlug = sanitizeFilename(municipio || 'Municipal');
  const rawSuffix = options.suffix !== undefined ? String(options.suffix) : `_${targetLang.toUpperCase()}`;
  const langSuffix = rawSuffix.replace(/[^a-zA-Z0-9_-]/g, '');
  const mandateClean = sanitizeFilename(mandato || '2027-2031').replace(/[–—]/g, '-');
  const safeCustomFileName = options.fileName ? sanitizeFilename(path.basename(String(options.fileName)).replace(/\.docx$/i, ''), 'Programa_Electoral') + '.docx' : null;
  const fileName = safeCustomFileName || `Programa_Electoral_${munSlug}_${mandateClean}${langSuffix}.docx`;

  let outDir;
  let outFilePath;
  if (options.outputPath) {
    const resolvedOut = path.resolve(options.outputPath);
    if (options.outputDir && !isPathInside(exportBase, resolvedOut, false)) {
      throw new Error('Operación bloqueada por seguridad: la ruta de salida escapa del directorio autorizado');
    }
    outDir = path.dirname(resolvedOut);
    outFilePath = resolvedOut;
  } else {
    outDir = resolveSafePath(exportBase, munSlug);
    outFilePath = resolveSafePath(outDir, fileName);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const tmpPath = `${outFilePath}.${process.pid}.tmp`;

  fs.writeFileSync(tmpPath, outBuffer);
  try {
    fs.renameSync(tmpPath, outFilePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (e) { /* nada */ }
    if (['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) {
      throw new Error(`No se puede guardar «${fileName}» porque está abierto en Word o LibreOffice. Ciérralo y vuelve a exportar.`);
    }
    throw err;
  }

  warnings.forEach(w => console.warn('[exportación]', w));

  return {
    success: true,
    filePath: outFilePath,
    fileName,
    areasCount: areasToExport.length,
    measuresCount: areasToExport.reduce((acc, a) => acc + a.medidas.length, 0),
    language: targetLang,
    warnings
  };
}

module.exports = {
  exportProjectToDocx,
  sanitizeFilename,
  getMandateTwoDigits,
  assertWellFormed,
  detectImageHeader
};
