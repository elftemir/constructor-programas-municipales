const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function atomicWrite(filename, data) {
  const tmp = filename + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(tmp, filename);
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
    if (fs.existsSync(tmp)) { try { fs.unlinkSync(tmp); } catch (_) {} }
  }
}
function backupRoot(dbPath) {
  // Production databases live in userData/database; isolated tests stay beside their DB.
  const parent = path.dirname(dbPath);
  return path.join(path.basename(parent) === 'database' ? path.dirname(parent) : parent, 'backups');
}
function backupFiles(dbPath) {
  const dir = backupRoot(dbPath);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.startsWith(path.basename(dbPath) + '.startup-') && name.endsWith('.sqlite'))
    .sort().reverse().map(name => path.join(dir, name));
}
function createBackup(dbPath, buffer, type = 'startup') {
  const dir = type === 'startup' ? backupRoot(dbPath) : path.join(backupRoot(dbPath), type === 'corrupt' ? 'recovery' : 'migrations');
  fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, `${path.basename(dbPath)}.${type}-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}.sqlite`);
  atomicWrite(filename, buffer);
  if (type === 'startup') for (const old of backupFiles(dbPath).slice(5)) fs.unlinkSync(old);
  return filename;
}
function openChecked(SQL, bytes) {
  if (!bytes.length) throw new Error('El archivo de base de datos está vacío.');
  const opened = new SQL.Database(bytes);
  try {
    const result = opened.exec('PRAGMA quick_check');
    if (result[0]?.values?.length !== 1 || result[0].values[0][0] !== 'ok') throw new Error('SQLite integrity check failed');
    opened.exec('SELECT name FROM sqlite_master');
    return opened;
  } catch (err) { opened.close(); throw err; }
}
module.exports = { atomicWrite, backupRoot, backupFiles, createBackup, openChecked };
