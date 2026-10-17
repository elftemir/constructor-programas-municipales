const { getLema, normalizeLema } = require('../utils/lema');
const fs = require('fs');
const path = require('path');
const { getDb, save } = require('../db/database');
const { getLogosDir, resolveSafePath } = require('../utils/paths');

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let res = null;
  if (stmt.step()) {
    res = stmt.getAsObject();
  }
  stmt.free();
  return res;
}

async function getFichaMunicipio(codigoIne) {
  if (!codigoIne) return null;
  const db = await getDb();
  const row = queryOne(db, `SELECT * FROM fichas_municipios WHERE codigo_ine = ?`, [codigoIne]);
  if (!row) return null;

  return {
    ...row,
    empresas_municipales: JSON.parse(row.empresas_municipales_json || '[]'),
    servicios: JSON.parse(row.servicios_json || '{}')
  };
}

async function checkFichaExists(codigoIne) {
  if (!codigoIne) return false;
  const db = await getDb();
  const row = queryOne(db, `SELECT codigo_ine FROM fichas_municipios WHERE codigo_ine = ?`, [codigoIne]);
  return Boolean(row);
}

async function saveFichaMunicipio(data) {
  if (!data || !data.codigo_ine) return null;
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = queryOne(db, `SELECT * FROM fichas_municipios WHERE codigo_ine = ?`, [data.codigo_ine]);
  const createdAt = existing ? existing.created_at : now;

  const municipio = data.municipio !== undefined
    ? (data.municipio !== null ? String(data.municipio).trim() : '')
    : (existing ? existing.municipio : '');

  const provincia = data.provincia !== undefined
    ? (data.provincia !== null ? String(data.provincia).trim() : '')
    : (existing ? existing.provincia : '');

  const comunidad_autonoma = data.comunidad_autonoma !== undefined
    ? (data.comunidad_autonoma !== null ? String(data.comunidad_autonoma).trim() : 'Cataluña')
    : (existing ? existing.comunidad_autonoma : 'Cataluña');

  const poblacion_oficial = data.poblacion_oficial !== undefined
    ? (data.poblacion_oficial !== null && data.poblacion_oficial !== '' ? parseInt(data.poblacion_oficial, 10) : null)
    : (existing ? existing.poblacion_oficial : null);

  const poblacion_usuario = data.poblacion_usuario !== undefined
    ? (data.poblacion_usuario !== null && data.poblacion_usuario !== '' ? parseInt(data.poblacion_usuario, 10) : null)
    : (existing ? existing.poblacion_usuario : null);

  const fuente_poblacion = data.fuente_poblacion !== undefined
    ? (data.fuente_poblacion !== null ? data.fuente_poblacion : 'Idescat / INE')
    : (existing ? existing.fuente_poblacion : 'Idescat / INE');

  const ano_poblacion = data.ano_poblacion !== undefined
    ? (data.ano_poblacion !== null ? data.ano_poblacion : '2025')
    : (existing ? existing.ano_poblacion : '2025');

  const partido = data.partido !== undefined
    ? (data.partido !== null ? data.partido : 'Podemos')
    : (existing ? existing.partido : 'Podemos');

  const organizacion = data.organizacion !== undefined
    ? (data.organizacion !== null ? data.organizacion : '')
    : (existing ? existing.organizacion : '');

  const mandato = data.mandato !== undefined
    ? (data.mandato !== null ? data.mandato : '2027–2031')
    : (existing ? existing.mandato : '2027–2031');

  const lema_es = normalizeLema(data.lema_es !== undefined ? data.lema_es : getLema(existing, 'es'));
  const lema_ca = normalizeLema(data.lema_ca !== undefined ? data.lema_ca : getLema(existing, 'ca'));

  const fecha_electoral = data.fecha_electoral !== undefined
    ? (data.fecha_electoral !== null && data.fecha_electoral !== '' ? data.fecha_electoral : null)
    : (existing ? existing.fecha_electoral : null);

  const presupuesto_municipal = data.presupuesto_municipal !== undefined
    ? (data.presupuesto_municipal !== null && data.presupuesto_municipal !== '' ? parseFloat(data.presupuesto_municipal) : null)
    : (existing ? existing.presupuesto_municipal : null);

  const presupuesto_inversiones = data.presupuesto_inversiones !== undefined
    ? (data.presupuesto_inversiones !== null && data.presupuesto_inversiones !== '' ? parseFloat(data.presupuesto_inversiones) : null)
    : (existing ? existing.presupuesto_inversiones : null);

  const empresas_municipales_json = data.empresas_municipales !== undefined
    ? (data.empresas_municipales !== null ? JSON.stringify(data.empresas_municipales) : '[]')
    : (existing ? existing.empresas_municipales_json : '[]');

  const servicios_json = data.servicios !== undefined
    ? (data.servicios !== null ? JSON.stringify(data.servicios) : '{}')
    : (existing ? existing.servicios_json : '{}');

  const logo_path = data.logo_path !== undefined
    ? (data.logo_path !== null ? data.logo_path : null)
    : (existing ? existing.logo_path : null);

  const logo_filename = data.logo_filename !== undefined
    ? (data.logo_filename !== null ? data.logo_filename : null)
    : (existing ? existing.logo_filename : null);

  db.run(`
    INSERT OR REPLACE INTO fichas_municipios (
      codigo_ine, municipio, provincia, comunidad_autonoma,
      poblacion_oficial, poblacion_usuario, fuente_poblacion, ano_poblacion,
      partido, organizacion, mandato, lema_es, lema_ca, fecha_electoral,
      presupuesto_municipal, presupuesto_inversiones,
      empresas_municipales_json, servicios_json,
      logo_path, logo_filename, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.codigo_ine,
    municipio,
    provincia,
    comunidad_autonoma,
    poblacion_oficial,
    poblacion_usuario,
    fuente_poblacion,
    ano_poblacion,
    partido,
    organizacion,
    mandato,
    lema_es,
    lema_ca,
    fecha_electoral,
    presupuesto_municipal,
    presupuesto_inversiones,
    empresas_municipales_json,
    servicios_json,
    logo_path,
    logo_filename,
    createdAt,
    now
  ]);

  save();
  return await getFichaMunicipio(data.codigo_ine);
}

async function savePersistentLogo(sourceFilePath, codigoIne = 'local') {
  if (!sourceFilePath || typeof sourceFilePath !== 'string' || !fs.existsSync(sourceFilePath)) {
    throw new Error('El archivo de imagen especificado no existe');
  }

  const logosDir = getLogosDir();
  const rawExt = (path.extname(sourceFilePath) || '.png').toLowerCase();
  const ext = ['.png', '.jpg', '.jpeg'].includes(rawExt) ? rawExt : '.png';
  const cleanIne = String(codigoIne || 'logo').replace(/[^a-zA-Z0-9_-]/g, '') || 'logo';
  const filename = `logo_${cleanIne}_${Date.now()}${ext}`;
  const targetPath = resolveSafePath(logosDir, filename);

  fs.copyFileSync(sourceFilePath, targetPath);
  return {
    persistentPath: targetPath,
    filename: filename
  };
}

module.exports = {
  getFichaMunicipio,
  checkFichaExists,
  saveFichaMunicipio,
  savePersistentLogo
};
