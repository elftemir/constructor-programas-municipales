const fs = require('fs'); const path = require('path'); const assert = require('assert');
const initSql = require('sql.js'); const database = require('../src/main/db/database');
const persistence = require('../src/main/db/persistence'); const migrator = require('../src/main/db/migrator');
async function main() {
  const root = fs.mkdtempSync(path.join(__dirname, '../scratch/db-safety-'));
  const filename = path.join(root, 'test.sqlite');
  let db = await database.getDb(filename);
  db.run('CREATE TABLE proof (value TEXT)'); db.run("INSERT INTO proof VALUES ('original')"); database.save();
  const original = fs.readFileSync(filename);
  let notices = 0; database.setDatabaseHandlers({ onSaveError: () => notices++ });
  for (const method of ['writeFileSync', 'fsyncSync', 'renameSync']) {
    const actual = fs[method]; fs[method] = () => { throw new Error('Injected ' + method); };
    try { assert.throws(() => database.save(), /Injected/); } finally { fs[method] = actual; }
    assert(fs.readFileSync(filename).equals(original));
    assert(!fs.readdirSync(root).some(name => name.endsWith('.tmp')));
  }
  assert.equal(notices, 3);
  db.run("UPDATE proof SET value='latest'"); database.save();
  const SQL = await initSql(); let disk = persistence.openChecked(SQL, fs.readFileSync(filename));
  assert.equal(disk.exec('SELECT value FROM proof')[0].values[0][0], 'latest'); disk.close();
  database.closeDb();
  for (let i = 0; i < 7; i++) { await database.getDb(filename); database.closeDb(); }
  assert.equal(persistence.backupFiles(filename).length, 5);
  db = await database.getDb(filename);
  const count = persistence.backupFiles(filename).length;
  database.save(); database.save(); assert.equal(persistence.backupFiles(filename).length, count);
  database.closeDb();
  fs.writeFileSync(filename, 'corrupt data');
  await assert.rejects(database.getDb(filename, { confirmRestore: () => false }), /cancelada/);
  assert.equal(fs.readFileSync(filename, 'utf8'), 'corrupt data');
  db = await database.getDb(filename, { confirmRestore: () => true });
  assert.equal(db.exec('SELECT value FROM proof')[0].values[0][0], 'latest');
  assert(fs.readdirSync(path.join(root, 'backups/recovery')).length === 1);
  database.closeDb();
  const migrations = path.join(root, 'backups/migrations');
  assert(fs.readdirSync(migrations).some(name => name.includes('schema0-to-' + migrator.TARGET_SCHEMA_VERSION)));
  const legacy = new SQL.Database(original); legacy.run('PRAGMA user_version=4');
  await migrator.migrate(legacy, { dbFilePath: filename });
  const prior = fs.readdirSync(migrations).find(name => name.includes('schema4-to-' + migrator.TARGET_SCHEMA_VERSION));
  assert(prior); disk = persistence.openChecked(SQL, fs.readFileSync(path.join(migrations, prior)));
  assert.equal(migrator.getSchemaVersion(disk), 4); disk.close(); legacy.close();
  const absent = new SQL.Database(original); absent.run('PRAGMA user_version=0');
  await migrator.migrate(absent, { dbFilePath: filename }); absent.close();
  assert(fs.readdirSync(migrations).some(name => name.includes('schema' + migrator.TARGET_SCHEMA_VERSION + '-to-' + migrator.TARGET_SCHEMA_VERSION)));
  const failing = new SQL.Database(original); failing.run('PRAGMA user_version=4');
  const rename = fs.renameSync; fs.renameSync = () => { throw new Error('Backup failed'); };
  try { await assert.rejects(migrator.migrate(failing, { dbFilePath: filename }), /Backup failed/); } finally { fs.renameSync = rename; }
  assert.equal(migrator.getSchemaVersion(failing), 4); failing.close();
  console.log('PASS database: atomic write/flush/rename failures retain original and notify; five startup backups; no backups per save; restore consent and corrupt original retained; mandatory migration snapshots and abort on backup failure.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
