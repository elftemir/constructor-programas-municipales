// Synthetic test data only; never bundled as political content in the installer.
const fs = require('fs'); const path = require('path');
const catalog = { version: '2.0.0-test', fecha_revision: '2026-10-11', descripcion: 'Catálogo sintético de pruebas',
  idiomas_disponibles: ['es', 'ca'], estadisticas: { total_areas: 3, total_medidas: 6 }, areas: [] };
let index = 0;
for (let a = 1; a <= 3; a++) {
  const area = { id: 'test-area-' + a, orden: a, nombre: 'Área de prueba ' + a,
    nombre_es: 'Área de prueba ' + a, nombre_ca: 'Àrea de prova ' + a, medidas: [] };
  for (let n = 0; n < 2; n++) {
    index++; area.medidas.push({ id: 'test-measure-' + index, codigo: a + '.' + (n + 1), orden: n + 1,
      area_id: area.id, titulo: 'Título de prueba ' + index, titulo_ca: 'Títol de prova ' + index,
      texto: 'Contenido sintético para comprobar el guardado y la exportación.',
      texto_ca: 'Contingut sintètic per comprovar el desament i l’exportació.',
      explicacion: null, pagina_inicio: null, pagina_fin: null, motivo_duda: null });
  }
  catalog.areas.push(area);
}
fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'fixtures/catalog-test.json'), JSON.stringify(catalog, null, 2));
const minimal = {...catalog, descripcion:'Catálogo mínimo sintético bilingüe',
  estadisticas:{total_areas:2,total_medidas:4},areas:structuredClone(catalog.areas.slice(0,2))};
for(let n=0;n<minimal.areas[1].medidas.length;n++){
  const measure=minimal.areas[1].medidas[n],number=n+12;
  measure.id='test-measure-'+number;measure.titulo='Título de prueba '+number;measure.titulo_ca='Títol de prova '+number;
}
fs.writeFileSync(path.join(__dirname,'fixtures/catalog-minimal.json'),JSON.stringify(minimal,null,2));
