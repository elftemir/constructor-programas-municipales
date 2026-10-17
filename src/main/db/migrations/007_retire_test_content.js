// Hide historical test packages; keep every municipal project and its source material.
function up(db, { addColumnIfNotExists }) {
  addColumnIfNotExists(db, 'programas_fuente', 'retirado_por_prueba INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists(db, 'contenidos_instalados', 'retirado_por_prueba INTEGER NOT NULL DEFAULT 0');
  const historicalId = ['programa', 'marco', 'prueba', '2027', '2031'].join('-');
  const packages = db.exec('SELECT content_id, fuente_id, is_test_fixture, manifest_json FROM contenidos_instalados')[0]?.values || [];
  const sourceIds = new Set();
  for (const [id, sourceId, marked, json] of packages) {
    let manifest = {}; try { manifest = JSON.parse(json || '{}'); } catch (_) {}
    if (id === historicalId || marked === 1 || manifest.is_test_fixture === true) {
      sourceIds.add(sourceId);
      db.run('UPDATE contenidos_instalados SET retirado_por_prueba = 1, is_current_official = 0 WHERE content_id = ? AND retirado_por_prueba = 0', [id]);
    }
  }
  const sources = db.exec('SELECT id, content_id, es_fixture_prueba, retirado_por_prueba FROM programas_fuente')[0]?.values || [];
  let retired = 0;
  for (const [id, contentId, marked, alreadyRetired] of sources) {
    if (!alreadyRetired && (id === historicalId || contentId === historicalId || marked === 1 || sourceIds.has(id))) {
      db.run('UPDATE programas_fuente SET retirado_por_prueba = 1, activo = 0, archivado = 1, oficial_actual_protegido = 0 WHERE id = ?', [id]);
      retired++;
    }
  }
  console.log('[Migrador] Paquetes de prueba retirados: ' + retired + '; proyectos y contenido municipal conservados.');
  return { retired };
}
module.exports = { version: 7, name: '007_retire_test_content', up };
