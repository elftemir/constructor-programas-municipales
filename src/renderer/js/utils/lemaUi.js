window.LemaUi = {
  async translate(project, targetLang, options = {}) {
    const t = key => window.i18n.t(key);
    const sourceLang = targetLang === 'ca' ? 'es' : 'ca';
    const read = options.read || (lang => window.Lema.getLema(project, lang) || '');
    const source = read(sourceLang).trim();
    const before = read(targetLang);
    if (!source) { alert(t('lema.no_source')); return false; }
    if (before.trim() && !confirm(t('lema.confirm_overwrite'))) return false;
    const result = await (window.GenerationApi || window.api).aiTranslateText({ texto: source, de: sourceLang, a: targetLang, idioma_salida: targetLang });
    if (!result || result.ok === false || result.success === false || result.error) throw Error(result?.error?.message || result?.error || t('lema.translation_error'));
    let translated = (result.texto || result.data?.texto || '').trim();
    if (!translated) throw Error(t('lema.translation_error'));
    if (translated.length > 60) {
      translated = prompt(t('lema.too_long'), translated);
      if (translated === null) return false;
      translated = translated.trim();
      if (!translated || translated.length > 60) throw Error(t('lema.too_long'));
    }
    if (read(sourceLang).trim() !== source) { alert(t('lema.source_changed')); return false; }
    if (read(targetLang) !== before && !confirm(t('lema.confirm_overwrite'))) return false;
    if (options.write) await options.write(targetLang, translated);
    else {
      const data = { ['lema_' + targetLang]: translated };
      await window.api.updateProjectData(project.id, data);
      Object.assign(project, data);
      if (project.codigo_ine) await window.api.saveFichaMunicipio({ codigo_ine: project.codigo_ine, ...data });
    }
    window.GenerationUi?.markResult(result,document.querySelector('#input-lema-'+targetLang)||document.querySelector('[name="lema_'+targetLang+'"]'));
    return true;
  }
};
