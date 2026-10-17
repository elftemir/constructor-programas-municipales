// Una misma selección estricta de idioma para Electron, exportación e interfaz.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Lema = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getLema(project, lang) {
    if (!project || !['es', 'ca'].includes(lang)) return null;
    const value = project['lema_' + lang];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
  function normalizeLema(value) {
    return value == null ? null : String(value).trim().slice(0, 60) || null;
  }
  function missingLemaLanguages(project, languages) {
    return [...new Set(languages)].filter(lang => !getLema(project, lang) && getLema(project, lang === 'ca' ? 'es' : 'ca'));
  }
  return { getLema, normalizeLema, missingLemaLanguages };
});
