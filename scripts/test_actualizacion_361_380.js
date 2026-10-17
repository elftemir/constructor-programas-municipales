// Replays the original 3.6.1 schema; never opens an existing user database.
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const root = path.resolve(__dirname, '..'), base = process.env.TEST_RUN_DIR || path.join(root, 'scratch');
fs.mkdirSync(base, { recursive: true });
const directory = fs.mkdtempSync(path.join(base, 'upgrade-361-370-'));
for (const [key, leaf] of Object.entries({ APPDATA: 'roaming', LOCALAPPDATA: 'local', USERPROFILE: 'user', TEMP: 'temp', TMP: 'temp' })) {
  process.env[key] = path.join(directory, leaf); fs.mkdirSync(process.env[key], { recursive: true });
}
const database = require('../src/main/db/database'), migrator = require('../src/main/db/migrator');
const sources = require('../src/main/services/sourceProgramService'), projects = require('../src/main/services/projectService');
const retirement = require('../src/main/db/migrations/007_retire_test_content');
const resultFile = path.join(directory, 'RESULTADO_ACTUALIZACION_361_370.json');
const start = process.argv.includes('--from-370') ? 7 : 5;
const target = migrator.TARGET_SCHEMA_VERSION;
const result = { result: 'NO PUBLICAR', syntheticOnly: true, startingVersion: start, targetVersion: target };
function rows(db, sql, params = []) {
  const stmt = db.prepare(sql); stmt.bind(params); const values = [];
  while (stmt.step()) values.push(stmt.getAsObject()); stmt.free(); return values;
}
function schema(db) {
  const tables = rows(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(row => row.name);
  return Object.fromEntries(tables.map(table => [table, {
    columns: rows(db, 'PRAGMA table_info(' + table + ')'),
    foreignKeys: rows(db, 'PRAGMA foreign_key_list(' + table + ')'),
    indexes: rows(db, 'PRAGMA index_list(' + table + ')').map(index => ({ ...index, columns: rows(db, 'PRAGMA index_info(' + index.name + ')') }))
  }]));
}
async function main() {
  const SQL = await require('sql.js')();
  const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/schema-3.6.1.sql'));
  const provenance = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/schema-3.6.1.provenance.json')));
  assert.equal(crypto.createHash('sha256').update(fixture).digest('hex'), provenance.schemaSha256);
  assert.equal(provenance.userVersion, 5); result.schemaProvenance = provenance;
  const old = new SQL.Database(); old.run(fixture.toString());
  assert.equal(migrator.getSchemaVersion(old), 5);
  assert(!migrator.columnExists(old, 'proyectos', 'lema_es'));
  assert(!migrator.columnExists(old, 'programas_fuente', 'retirado_por_prueba'));
  const officialId = ['fuente', 'marco', 'oficial'].join('_');
  const exampleId = ['programa', 'marco', 'prueba', '2027', '2031'].join('-');
  const definitions = [[officialId, 'official', 0], ['synthetic-import', 'importado', 0], [exampleId, 'test', 1]];
  for (const [i, [sourceId, type, marked]] of definitions.entries()) {
    old.run('INSERT INTO programas_fuente (id,nombre,tipo,activo,archivado,idiomas_json,total_areas,total_medidas,content_id,es_fixture_prueba,created_at,updated_at) VALUES (?,?,?, ?,0,?,1,2,?,?,?,?)',
      [sourceId, 'Synthetic source ' + i, type, marked, '{"es":{"disponible":true},"ca":{"disponible":true}}', sourceId, marked, 'synthetic', 'synthetic']);
    const areaId = 'area-' + i, projectId = 'project-' + i;
    old.run('INSERT INTO areas (id,orden,nombre,nombre_es,nombre_ca,fuente_id) VALUES (?,1,?,?,?,?)', [areaId, 'Area ' + i, 'Area ES ' + i, 'Area CA ' + i, sourceId]);
    old.run('INSERT INTO proyectos (id,municipio,lema,idioma_principal,fuente_id,mapeo_fuentes_json,empresas_municipales_json,servicios_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [projectId, 'Synthetic municipality ' + i, 'Synthetic slogan ' + i, i === 1 ? 'ca' : 'es', sourceId, '{}', '[{"nombre":"Synthetic company"}]', '{"test":true}', 'synthetic', 'synthetic']);
    old.run('INSERT INTO proyecto_fuentes (id,proyecto_id,fuente_id,rol,fecha_anadida) VALUES (?,?,?, ?,?)', ['link-' + i, projectId, sourceId, 'principal', 'synthetic']);
    for (let j = 0; j < 2; j++) {
      const measureId = 'measure-' + i + '-' + j;
      old.run('INSERT INTO medidas (id,codigo,orden,area_id,titulo_es,titulo_ca,texto_es,texto_ca,fuente_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [measureId, (i + 1) + '.' + (j + 1), j + 1, areaId, 'Synthetic title ES', 'Synthetic title CA', 'Synthetic measure ES ' + measureId, 'Synthetic measure CA ' + measureId, sourceId]);
      old.run('INSERT INTO decisiones_medidas (id,proyecto_id,medida_id,estado,version_municipal_texto,traduccion_texto,nota_interna) VALUES (?,?,?,?,?,?,?)',
        ['decision-' + i + '-' + j, projectId, measureId, j ? 'adaptada' : 'incluida', 'Synthetic adaptation ' + measureId, 'Synthetic translation ' + measureId, 'Synthetic private note ' + measureId]);
    }
    old.run('INSERT INTO medidas_propias (id,proyecto_id,area_id,texto,traduccion_texto,nota_interna) VALUES (?,?,?,?,?,?)', ['own-' + i, projectId, areaId, 'Synthetic own ES ' + i, 'Synthetic own CA ' + i, 'Synthetic note ' + i]);
    old.run('INSERT INTO textos_generales (proyecto_id,presentacion_parrafos_json,cierre_parrafos_json,bilingue_json) VALUES (?,?,?,?)', [projectId, '["Synthetic presentation"]', '["Synthetic ending"]', '{"es":"synthetic","ca":"synthetic"}']);
    old.run('INSERT INTO fichas_municipios (codigo_ine,municipio,lema,poblacion_usuario,servicios_json) VALUES (?,?,?,?,?)', ['test-' + i, 'Synthetic municipality ' + i, 'Synthetic ficha slogan ' + i, 1000 + i, '{"test":true}']);
  }
  old.run('INSERT INTO contenidos_instalados (content_id,fuente_id,content_version,is_test_fixture,official,is_current_official,manifest_json,installed_at,updated_at) VALUES (?,?,?,1,0,0,?,?,?)', [exampleId, exampleId, '1.0.0', '{"is_test_fixture":true}', 'synthetic', 'synthetic']);
  old.run('INSERT INTO configuracion VALUES (?,?)', ['synthetic-option', 'unchanged']);
  old.run('INSERT INTO ai_historial (id,proyecto_id,prompt,respuesta_ia) VALUES (?,?,?,?)', ['synthetic-history', 'project-2', 'Synthetic prompt', 'Synthetic response']);
  // Preserve the complete values of every existing column in every municipal table.
  const protectedTables = Object.keys(schema(old)).filter(table => !['programas_fuente', 'contenidos_instalados', '_schema_migrations'].includes(table));
  if (start === 7) { require('../src/main/db/migrations/006_lema_bilingue').up(old,migrator); retirement.up(old,migrator); old.run('PRAGMA user_version=7'); }
  const before = Object.fromEntries(protectedTables.map(table => [table, {
    columns: rows(old, 'PRAGMA table_info(' + table + ')').map(column => column.name),
    rows: rows(old, 'SELECT * FROM ' + table + ' ORDER BY rowid')
  }]));
  const filename = path.join(directory, 'synthetic-3.6.1.sqlite');
  const originalBytes = Buffer.from(old.export()); fs.writeFileSync(filename, originalBytes); old.close();
  let upgraded = await database.getDb(filename);
  assert.equal(migrator.getSchemaVersion(upgraded), target);
  assert.deepEqual(rows(upgraded, 'SELECT migration_name FROM _schema_migrations ORDER BY id').map(row => row.migration_name), start === 5 ? ['006_lema_bilingue', '007_retire_test_content', '008_unify_source_defaults'] : ['008_unify_source_defaults']);
  result.executedMigrations = start === 5 ? ['006_lema_bilingue', '007_retire_test_content', '008_unify_source_defaults'] : ['008_unify_source_defaults'];
  for (const [table, snapshot] of Object.entries(before)) {
    assert.deepEqual(rows(upgraded, 'SELECT ' + snapshot.columns.join(',') + ' FROM ' + table + ' ORDER BY rowid'), snapshot.rows, 'Lost or modified data in ' + table);
  }
  assert.equal(rows(upgraded, 'SELECT lema_es,lema_ca FROM proyectos WHERE id=?', ['project-0'])[0].lema_es, 'Synthetic slogan 0');
  assert.equal(rows(upgraded, 'SELECT lema_es,lema_ca FROM proyectos WHERE id=?', ['project-1'])[0].lema_ca, 'Synthetic slogan 1');
  const visibleSources = (await sources.getAll(true)).map(source => source.id).sort();
  assert.deepEqual(visibleSources, [officialId, 'synthetic-import'].sort());
  assert.equal(rows(upgraded, 'SELECT retirado_por_prueba,archivado,activo FROM programas_fuente WHERE id=?', [exampleId])[0].retirado_por_prueba, 1);
  for (let i = 0; i < 3; i++) {
    const project = await projects.getProject('project-' + i);
    assert.equal(project.municipio, 'Synthetic municipality ' + i);
    assert.equal(project.areas.length, 1); assert.equal(project.areas[0].medidas.length, 2);
  }
  const backup = fs.readdirSync(path.join(directory, 'backups/migrations')).find(file => file.includes('schema'+start+'-to-'+target));
  assert(backup); assert(fs.readFileSync(path.join(directory, 'backups/migrations', backup)).equals(originalBytes), 'Migration backup must preserve the original database byte for byte');
  const backupDb = new SQL.Database(fs.readFileSync(path.join(directory, 'backups/migrations', backup)));
  assert.equal(migrator.getSchemaVersion(backupDb), start); backupDb.close();
  result.preserved = { projects: 3, sourcesStored: 3, sourcesVisible: visibleSources.length, areas: 3, measures: 6, decisions: 6, ownMeasures: 3, generalTexts: 3, municipalRecords: 3, aiHistory: 1 };
  result.projectFromExampleComplete = true; result.exampleRetired = true; result.backupByteIdentical = true;
  assert.equal(rows(upgraded, 'PRAGMA quick_check')[0].quick_check, 'ok');
  assert.deepEqual(rows(upgraded, 'PRAGMA foreign_key_check'), []);
  const stable = Buffer.from(upgraded.export()); assert.equal(retirement.up(upgraded, migrator).retired, 0);
  assert(Buffer.from(upgraded.export()).equals(stable));
  assert.equal((await migrator.migrate(upgraded, { dbFilePath: filename })).migrated, false);
  result.idempotent = true; result.integrity = 'ok';
  const upgradedSchema = schema(upgraded); database.save(); database.closeDb();
  const fresh = await database.getDb(path.join(directory, 'synthetic-fresh.sqlite'));
  assert.equal(migrator.getSchemaVersion(fresh), target);
  for (const table of ['programas_fuente', 'contenidos_instalados', 'proyectos', 'areas', 'medidas', 'fichas_municipios']) assert.equal(rows(fresh, 'SELECT COUNT(*) AS n FROM ' + table)[0].n, 0);
  const freshSchema = schema(fresh); database.closeDb();
  const explicitFk = new SQL.Database(Buffer.from(originalBytes)); explicitFk.run('PRAGMA foreign_keys=ON');
  await migrator.migrate(explicitFk,{dbFilePath:path.join(directory,'fk-enabled.sqlite')});
  assert.equal(rows(explicitFk,'PRAGMA foreign_keys')[0].foreign_keys,1);
  assert.deepEqual(rows(explicitFk,'PRAGMA foreign_key_check'),[]); assert.deepEqual(schema(explicitFk),freshSchema); explicitFk.close();
  result.foreignKeysRestored = true;
  const failing = new SQL.Database(fs.readFileSync(path.join(directory,'backups/migrations',backup))); failing.run('PRAGMA foreign_keys=ON');
  assert.equal(migrator.getSchemaVersion(failing),start,'Rollback fixture starts at the original schema');
  const priorSchema = schema(failing);
  const priorRows = Object.fromEntries(Object.keys(priorSchema).map(table => [table,rows(failing,'SELECT * FROM '+table+' ORDER BY rowid')]));
  const run = failing.run.bind(failing);
  failing.run = function(sql, ...args) { if (String(sql).startsWith('INSERT INTO areas(rowid,')) throw Error('Synthetic normalization failure'); return run(sql,...args); };
  await assert.rejects(migrator.migrate(failing,{dbFilePath:path.join(directory,'rollback.sqlite')}),/Synthetic normalization failure/);
  failing.run = run; assert.equal(migrator.getSchemaVersion(failing),start);
  assert.equal(rows(failing,'PRAGMA foreign_keys')[0].foreign_keys,1); assert.deepEqual(schema(failing),priorSchema);
  for(const [table,values]of Object.entries(priorRows))assert.deepEqual(rows(failing,'SELECT * FROM '+table+' ORDER BY rowid'),values);
  failing.close(); result.rollbackPreservesEverything = true;
  result.freshVersion = target; result.upgradedVersion = target; result.freshEmpty = true;
  const differences = [];
  assert.deepEqual(Object.keys(upgradedSchema), Object.keys(freshSchema));
  for (const [table, definition] of Object.entries(freshSchema)) {
    assert.deepEqual(upgradedSchema[table].foreignKeys, definition.foreignKeys);
    assert.deepEqual(upgradedSchema[table].indexes, definition.indexes);
    assert.equal(upgradedSchema[table].columns.length, definition.columns.length);
    for (const [index, column] of definition.columns.entries()) {
      const upgradedColumn = upgradedSchema[table].columns[index];
      for (const key of Object.keys(column)) if (column[key] !== upgradedColumn[key]) differences.push({ table, column: column.name, attribute: key, fresh: column[key], upgraded: upgradedColumn[key] });
    }
  }
  result.schemaTables = Object.keys(freshSchema).length; result.schemaDifferences = differences;
  result.identicalSchema = differences.length === 0;
  console.log('PASS synthetic schema '+start+' -> '+target+': projects complete, example retired, exact backup, repeated migration unchanged.');
  console.log('PASS fresh installation: version '+target+', zero user data; same tables, indexes and foreign keys.');
  console.log('Schema differences: ' + JSON.stringify(differences));
  result.result = result.identicalSchema ? 'LISTO PARA REVISIÓN' : 'NO PUBLICAR';
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
  console.log('Evidence: ' + resultFile);
  assert.deepEqual(differences, [], 'A fresh and an upgraded installation must have the identical schema, including column defaults');
}
main().then(() => { if(start===5){ const child=require('child_process').spawnSync(process.execPath,[__filename,'--from-370'],{env:process.env,stdio:'inherit',windowsHide:true});assert.equal(child.status,0,'Schema 7 upgrade must also pass'); }}).catch(error => {
  result.error = error.message; fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
  database.closeDb(); console.error(error); process.exitCode = 1;
});
