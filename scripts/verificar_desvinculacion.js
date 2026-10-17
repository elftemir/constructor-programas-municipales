const AI_INSTALLER_FILE = 'src/main/services/ai/aiService.js';
const AI_INSTALLER_COMMENTS = new Set([
  '// FASE 1: Preparando instalación',
  '// FASE 2: Comprobando conexión a Internet',
  '// FASE 3: Conectando con Hugging Face',
  '// FASE 4: Localizando modelo',
  '// FASE 5: Verificando disponibilidad',
  '// FASE 6: Comprobando espacio disponible',
  '// FASE 7: Descargando modelo',
  '// FASE 8: Verificando archivo e integridad SHA-256 (SEC-005)',
  '// FASE 9: Preparando motor local',
  '// FASE 10: Cargando modelo',
  '// FASE 11: Comprobando funcionamiento',
  '// FASE 12: IA lista para usar'
]);
const FIXED_PROGRAM = /catalogo_marco|fuente_marco_oficial|Programa Marco 2027|(?:Catálogo|Catàleg|Catalogo|Cataleg)\s+biling(?:üe|ue)\s*v?1\.4\.1|\b123\s+(?:medidas|mesures)\b|\b12\s+(?:áreas|àrees)\b/i;
function findFixedReferences(file, text) {
  const relativeFile = file.replace(/\\/g, '/');
  return text.split(/\r?\n/).flatMap((line,index) => {
    if (FIXED_PROGRAM.test(line)) return [{ file: relativeFile, line: index+1, text: line.trim() }];
    if (!/\bFase 1\b/i.test(line)) return [];
    const aiComment = relativeFile === AI_INSTALLER_FILE && AI_INSTALLER_COMMENTS.has(line.trim());
    return aiComment ? [] : [{ file: relativeFile, line: index+1, text: line.trim() }];
  });
}
function assertNoFixedReferences(file, text) {
  const references = findFixedReferences(file,text);
  if (references.length) throw Error(`Referencia fija al Programa Marco: ${references[0].file}:${references[0].line}`);
}
module.exports = { findFixedReferences, assertNoFixedReferences, AI_INSTALLER_FILE, AI_INSTALLER_COMMENTS };
