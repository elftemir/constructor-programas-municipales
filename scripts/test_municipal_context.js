const assert = require('assert'); const fs = require('fs'); const path = require('path'); const http = require('http');
const { buildMunicipalContext, enrichWritingParams, WRITING_TASKS } = require('../src/main/services/ai/municipalContext');
const { checkContextBudget } = require('../src/main/services/ai/contextBudget');
const { LlamaCppProvider } = require('../src/main/services/ai/aiProvider');
async function main() {
  const { getDb, closeDb } = require('../src/main/db/database');
  const projects = require('../src/main/services/projectService');
  const dir = fs.mkdtempSync(path.join(__dirname, '../scratch/context-'));
  await getDb(path.join(dir, 'test.sqlite'), { catalogPath: path.join(__dirname, 'fixtures/catalog-minimal.json') });
  const id = await projects.createProject({ municipio: 'Municipio de prueba', provincia: 'Barcelona', habitantes: 1000, poblacion_ano: '2024', organizacion: 'Coalición de prueba', codigo_ine: '99999' });
  await require('../src/main/services/fichaMunicipioService').saveFichaMunicipio({ codigo_ine: '99999', municipio: 'Municipio de prueba', presupuesto_municipal: 1234000 });
  const params = await enrichWritingParams('adaptar_medida', { projectId: id, municipio: 'Otro municipio', idioma: 'es' });
  assert.equal(params.municipio, 'Municipio de prueba');
  assert(params.contexto_municipal.includes('1234000'));
  assert(params.contexto_municipal.includes('1000'));
  assert(params.contexto_municipal.includes('Coalición de prueba'));
  const empty = buildMunicipalContext({ municipio: 'Prueba' });
  assert(!empty.includes('Habitantes:')); assert(!empty.includes('undefined')); assert(!empty.includes('null'));
  assert(buildMunicipalContext({ habitantes: 0, poblacion_ano: '2023' }, {}, 'ca').includes('Habitants: 0'));
  const provider = new LlamaCppProvider('fixture', 'fixture');
  provider.manager.ensureServerRunning = async () => 'http://127.0.0.1:1';
  let captured;
  provider.callChat = async (_, messages) => { captured = messages; return '{"titulo":"Propuesta","entradilla":"Texto","parrafos":["Texto"],"texto":"Texto","frase_destacada":"Texto"}'; };
  for (const lang of ['es', 'ca']) for (const task of WRITING_TASKS) {
    await provider.generate(task, { ...params, contexto_municipal: buildMunicipalContext({ municipio: 'Prueba', habitantes: 2500, poblacion_ano: '2022' }, {}, lang), idioma: lang, texto: 'Mejorar los servicios públicos' });
    assert(captured[1].content.includes(lang === 'ca' ? 'CONTEXT DEL MUNICIPI' : 'CONTEXTO DEL MUNICIPIO'), task);
    assert(captured[1].content.includes('2022'), task);
    assert(!captured[1].content.includes('qué problema vecinal concreto'));
  }
  let count = 100;
  const server = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(req.url === '/apply-template' ? { prompt: 'formatted with template' } : { tokens: Array(count).fill(1) })); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await checkContextBudget(endpoint, [{ role: 'user', content: 'Text' }], 900), 100);
    count = 3200;
    await assert.rejects(checkContextBudget(endpoint, [], 900), /4096/);
    await assert.rejects(checkContextBudget(endpoint, [], 900, 'ca'), /Redueix/);
  } finally { server.close(); closeDb(); }
  console.log('PASS municipal context: saved project + ficha, populated fields only, all writing tasks ES/CA, no invented local diagnosis, exact model token budget.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
