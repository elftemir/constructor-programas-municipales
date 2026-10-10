const { getDb, save } = require('../db/database');
const { getDefaultExportDir } = require('../utils/paths');

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

const fs = require('fs');

async function getExportDirectory() {
  const db = await getDb();
  const row = queryOne(db, `SELECT valor FROM configuracion WHERE clave = 'carpeta_exportacion'`);
  const targetDir = (row && row.valor && row.valor.trim()) ? row.valor.trim() : getDefaultExportDir();
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (e) {
      console.warn('Could not create export directory:', e);
    }
  }
  return targetDir;
}

async function setExportDirectory(newPath) {
  if (!newPath || typeof newPath !== 'string') return getDefaultExportDir();
  const db = await getDb();
  db.run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('carpeta_exportacion', ?)`, [newPath.trim()]);
  save();
  return newPath.trim();
}

async function resetExportDirectory() {
  const db = await getDb();
  db.run(`DELETE FROM configuracion WHERE clave = 'carpeta_exportacion'`);
  save();
  return getDefaultExportDir();
}

async function getLastOpenedProjectId() {
  const db = await getDb();
  const row = queryOne(db, `SELECT valor FROM configuracion WHERE clave = 'ultimo_proyecto_id'`);
  return row ? row.valor : null;
}

async function setLastOpenedProjectId(projectId) {
  const db = await getDb();
  db.run(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('ultimo_proyecto_id', ?)`, [projectId || '']);
  save();
}

module.exports = {
  getExportDirectory,
  setExportDirectory,
  resetExportDirectory,
  getLastOpenedProjectId,
  setLastOpenedProjectId
};
