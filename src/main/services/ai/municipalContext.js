const WRITING_TASKS = new Set(['sugerir_titulos', 'adaptar_medida', 'desarrollar_medida', 'mejorar_redaccion', 'corregir_texto', 'resumir_texto', 'redactar_presentacion', 'redactar_introduccion_area', 'sugerir_frase_destacada', 'redactar_cierre']);
const hasValue = value => value !== null && value !== undefined && value !== '' && !(typeof value === 'number' && !Number.isFinite(value));
function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter(Boolean).join('; ');
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => hasValue(v) && compact(v) ? `${k}: ${compact(v)}` : '').filter(Boolean).join('; ');
  return hasValue(value) ? String(value).trim() : '';
}
function buildMunicipalContext(project = {}, ficha = {}, lang = 'es') {
  const ca = lang === 'ca';
  const pick = key => compact(project[key]) ? project[key] : ficha[key];
  const population = hasValue(project.habitantes) ? project.habitantes : (ficha.poblacion_usuario ?? ficha.poblacion_oficial);
  const year = hasValue(project.habitantes) ? project.poblacion_ano : ficha.ano_poblacion;
  const fields = [
    [ca ? 'Municipi' : 'Municipio', pick('municipio')], [ca ? 'Província' : 'Provincia', pick('provincia')], ['Comarca', pick('comarca')],
    [ca ? 'Habitants' : 'Habitantes', population], [ca ? 'Any de la població' : 'Año de la población', hasValue(population) ? year : null],
    [ca ? 'Font de població' : 'Fuente de población', hasValue(population) ? (hasValue(project.habitantes) ? project.poblacion_fuente : ficha.fuente_poblacion) : null],
    ['Candidatura', pick('organizacion') || pick('partido')], [ca ? 'Mandat' : 'Mandato', pick('mandato')], ['Lema', pick('lema')],
    [ca ? 'Pressupost municipal (€)' : 'Presupuesto municipal (€)', pick('presupuesto_municipal')],
    [ca ? 'Pressupost inversions (€)' : 'Presupuesto inversiones (€)', pick('presupuesto_inversiones')],
    [ca ? 'Empreses municipals' : 'Empresas municipales', pick('empresas_municipales')],
    [ca ? 'Serveis' : 'Servicios', pick('servicios')]
  ];
  const lines = fields.map(([label, value]) => [label, compact(value)]).filter(([, value]) => value);
  return [ca ? 'CONTEXT DEL MUNICIPI (dades aportades, no inferides):' : 'CONTEXTO DEL MUNICIPIO (datos aportados, no inferidos):',
    ...lines.map(([label, value]) => `${label}: ${value}`),
    ca ? 'No dedueixis mancances ni diagnòstics a partir del nom o la població. Utilitza només els fets aportats.' : 'No deduzcas carencias ni diagnósticos a partir del nombre o la población. Utiliza solo los hechos aportados.'
  ].join('\n');
}
async function enrichWritingParams(task, params = {}) {
  if (!WRITING_TASKS.has(task)) return params;
  let project = params;
  let ficha = {};
  const id = params.projectId || params.proyecto_id;
  if (id) {
    project = await require('../projectService').getProject(id);
    if (!project) throw new Error('Proyecto no encontrado para el contexto municipal.');
    if (project.codigo_ine) ficha = await require('../fichaMunicipioService').getFichaMunicipio(project.codigo_ine) || {};
  }
  return { ...params, municipio: project.municipio || params.municipio,
    contexto_municipal: buildMunicipalContext(project, ficha, params.idioma_salida || params.idioma || params.language || 'es'),
    // Preserve the saved project identity across every entry point.
    ...(id ? { organizacion: project.organizacion || project.partido || '', partido: project.partido || '', mandato: project.mandato || '', lema: project.lema || '' } : {})
  };
}
module.exports = { WRITING_TASKS, buildMunicipalContext, enrichWritingParams };
