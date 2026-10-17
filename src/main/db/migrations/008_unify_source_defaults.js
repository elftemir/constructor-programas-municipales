// Bring legacy and fresh databases to the same source-column definitions.
// The migrator disables foreign-key actions before its atomic transaction,
// restores them afterwards, and checks integrity before committing.
function up(db) {
  const inherited = "'" + ['fuente', 'marco', 'oficial'].join('_') + "'";
  for (const table of ['areas', 'medidas', 'proyectos']) {
    const columns = db.exec('PRAGMA table_info(' + table + ')')[0].values;
    const source = columns.find(column => column[1] === 'fuente_id');
    if (source[4] === null) continue;
    if (source[4] !== inherited) throw new Error('Unsupported legacy source default in ' + table);
    if (db.exec('PRAGMA foreign_keys')[0].values[0][0]) throw new Error('Foreign-key actions must be disabled during schema normalization');
    const definitions = db.exec("SELECT sql FROM sqlite_master WHERE tbl_name=? AND type IN ('index','trigger') AND sql IS NOT NULL ORDER BY type,name", [table])[0]?.values || [];
    const original = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", [table])[0].values[0][0];
    const normalized = original.replace(new RegExp('(\\bfuente_id\\s+TEXT)\\s+DEFAULT\\s+' + inherited, 'i'), '$1');
    if (normalized === original) throw new Error('Cannot normalize legacy source default in ' + table);
    const temporary = '_cpm_schema8_' + table;
    const names = columns.map(column => '"' + column[1].replace(/"/g, '""') + '"').join(',');
    db.run('CREATE TEMP TABLE ' + temporary + ' AS SELECT rowid AS _cpm_original_rowid,* FROM ' + table);
    db.run('DROP TABLE ' + table);
    db.run(normalized);
    db.run('INSERT INTO ' + table + '(rowid,' + names + ') SELECT _cpm_original_rowid,' + names + ' FROM ' + temporary);
    db.run('DROP TABLE ' + temporary);
    for (const [sql] of definitions) db.run(sql);
  }
}
module.exports = { version: 8, name: '008_unify_source_defaults', up };
