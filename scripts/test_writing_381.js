const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm');
const root=path.resolve(__dirname,'..'),base=process.env.CPM_TEST_ROOT||path.join(root,'scratch');fs.mkdirSync(base,{recursive:true});
const dir=fs.mkdtempSync(path.join(base,'writing381-'));for(const [key,leaf]of Object.entries({APPDATA:'roaming',LOCALAPPDATA:'local',USERPROFILE:'user',TEMP:'temp',TMP:'temp'})){process.env[key]=path.join(dir,leaf);fs.mkdirSync(process.env[key],{recursive:true});}
const contract=require('../src/shared/writingContract'),quality=require('../src/main/services/ai/writingQuality');
const {LlamaCppProvider}=require('../src/main/services/ai/aiProvider'),service=require('../src/main/services/ai/aiService');
const municipality='Sant Andreu de la Barca';
const good={titulo:'Serveis propers per a una vida digna',entradilla:'Presentem propostes concretes per millorar la vida quotidiana.',parrafos:['Ampliarem els horaris de la biblioteca i millorarem les zones de joc.','Posarem en marxa una oficina municipal d’habitatge amb atenció personalitzada.']};
async function main(){
 await require('../src/main/services/ai/orthography').ready();
 for(const wrapped of [JSON.stringify(good),'```json\n'+JSON.stringify(good)+'\n```','<think>Private chain</think>\n'+JSON.stringify(good)])assert(!quality.formatAndValidate('redactar_presentacion',wrapped,{municipio:municipality}).texto.includes('{'));
 const bad=[{...good,titulo:'Títol polític editorial de 4 a 10 paraules'},{...good,entradilla:'no és una ciutat de la Barca '.repeat(8)},{...good,parrafos:['Un projecte que es pot avaluar. Compromisos per al veïnat.','Un projecte que es pot avaluar. Compromisos per al veïnat.']},{...good,entradilla:'Martorell tindrà una oficina municipal.'}];
 for(const sample of bad.slice(0,2))assert.throws(()=>quality.formatAndValidate('redactar_presentacion',JSON.stringify(sample),{municipio:municipality}));
 for(const [sample,code]of [[bad[2],'DUPLICATE_PARAGRAPH'],[bad[3],'OTHER_MUNICIPALITY']])assert(quality.formatAndValidate('redactar_presentacion',sample,{municipio:municipality}).validation.warnings.some(w=>w.code===code));
 for(const [opening,code]of [['La candidatura té 99999 persones a la plaça.','UNSUPPORTED_NUMBER'],['Queremos servicios de calidad accesibles a todos los vecinos y a todas las familias, con una administración transparente y cercana para atender las necesidades cotidianas.','LANGUAGE_MIX'],['El lema oficial és Una nova candidatura oberta.','INVENTED_SLOGAN'],['La falta d’habitatge afecta el municipi.','UNSUPPORTED_PROBLEM'],['Obrirem l’oficina durant els primers dos anys.','UNSUPPORTED_DEADLINE'],['Millorarem les zones de joc.¬Adaptarem els passos de vianants.','TECHNICAL_ARTIFACT']])assert(quality.formatAndValidate('redactar_presentacion',{...good,entradilla:opening},{municipio:municipality,idioma:'ca'}).validation.warnings.some(w=>w.code===code));
 assert(quality.formatAndValidate('redactar_presentacion',{...good,entradilla:'El lema oficial és Serveis per a tothom.'},{municipio:municipality,idioma:'ca',lema_ca:'Serveis per a tothom'}));
 assert.equal(contract.structured('redactar_presentacion',{...good,parrafos:['Una proposta normal.,','Una altra idea, ben explicada.']}).parrafos[0],'Una proposta normal.');
 assert.equal(contract.structured('redactar_presentacion',{...good,parrafos:['Una proposta normal.  ,','Una altra idea.']}).parrafos[0],'Una proposta normal.');
 assert.throws(()=>quality.formatAndValidate('redactar_presentacion',{...good,entradilla:'Municipi: '+municipality},{municipio:municipality,idioma:'ca'}),/PROMPT_LEAK/);
 assert.throws(()=>quality.formatAndValidate('redactar_presentacion',{...good,entradilla:'El programa, liderado por el alcalde Juan Carlos López, presenta las propuestas.'},{municipio:municipality}),/UNSUPPORTED_PERSON/);
 assert(quality.formatAndValidate('redactar_presentacion',{...good,parrafos:['Obrirem una oficina municipal. Obrirem una oficina municipal.']},{municipio:municipality,idioma:'ca'}).validation.warnings.some(w=>w.code==='DUPLICATE_SENTENCE'));
 assert.throws(()=>quality.formatAndValidate('redactar_presentacion','{"titulo":',{municipio:municipality}));
 assert.throws(()=>quality.formatAndValidate('redactar_presentacion',{titulo:'Header only',entradilla:'Opening only',parrafos:['','']},{municipio:municipality}),/EMPTY/);
 const provider=new LlamaCppProvider('synthetic','synthetic');provider.manager={ensureServerRunning:async()=> 'http://127.0.0.1:1',activeBackend:'cpu'};
 let calls=0;provider.callChat=async(_,messages,options)=>{calls++;assert.equal(options.temperature,contract.NORMAL_GENERATION.temperature);assert.equal(options.repeat_penalty,contract.NORMAL_GENERATION.repeat_penalty);assert(!('seed' in options));assert(messages[1].content.includes(municipality));return calls===1?JSON.stringify(bad[0]):'```json\n'+JSON.stringify(good)+'\n```';};
 const recovered=await provider.generate('redactar_presentacion',{municipio:municipality,selectedMeasures:[{titulo:'Habitatge',texto:'Obrir una oficina municipal.'}]});assert(recovered.ok);assert.equal(calls,2);assert.equal(recovered.meta.retried,true);assert(!recovered.texto.includes('```'));
 provider.callChat=async()=>{calls++;return JSON.stringify(bad[1]);};calls=0;const rejected=await provider.generate('redactar_presentacion',{municipio:municipality,idioma:'ca'});assert(!rejected.ok);assert.equal(rejected.texto,null);assert.equal(calls,2);assert(!rejected.error.message.includes('{'));
 calls=0;provider.callChat=async()=>{calls++;return calls===1?JSON.stringify(bad[3]):'```json\n'+JSON.stringify(good)+'\n```';};const translated=await provider.generate('traducir_texto_estructurado',{generationTask:'redactar_presentacion',municipio:municipality,a:'ca',objeto:good});assert(translated.ok);assert.equal(calls,1);assert(!translated.texto.includes('{'));assert.equal(translated.meta.retried,false);assert(translated.qualityWarnings.some(w=>w.code==='OTHER_MUNICIPALITY'));
 const database=require('../src/main/db/database'),projects=require('../src/main/services/projectService');
 const db=await database.getDb(path.join(dir,'synthetic.sqlite'),{catalogPath:path.join(__dirname,'fixtures/catalog-test.json')});
 const id=await projects.createProject({municipio:municipality,idioma_principal:'ca'});const initial=await projects.getProject(id),measures=initial.areas.flatMap(a=>a.medidas);
 let providerCalls=0;service.getActiveProvider=async()=>{providerCalls++;return service.builtinEngine;};
 for(const count of [0,1,2,3]){
  db.run('DELETE FROM decisiones_medidas WHERE proyecto_id=?',[id]);for(const m of measures.slice(0,count))db.run('INSERT INTO decisiones_medidas (id,proyecto_id,medida_id,estado) VALUES (?,?,?,?)',['d-'+m.id,id,m.id,'incluida']);database.save();
  for(const task of ['redactar_presentacion','redactar_cierre']){providerCalls=0;const result=await service.runAiTask(task,{projectId:id,selectedMeasures:Array(50).fill({texto:'Spoofed'}),idioma:'ca'});assert.equal(result.ok,count>=3);if(count<3){assert.equal(providerCalls,0);assert.equal(result.selection.count,count);}}
 }
 db.run('DELETE FROM decisiones_medidas WHERE proyecto_id=?',[id]);database.save();const intro=await service.redactarIntroduccionArea({projectId:id,areaId:initial.areas[0].id,idioma:'es'});assert(!intro.ok);assert.equal(intro.selection.required,1);
 const ownProject={municipio:municipality,areas:[{id:'a',nombre:'Àrea',medidas:[],medidas_propias:[{id:'own',estado:'incluida',texto:'Improve a synthetic service'}]}]};assert.equal(contract.selectedMeasures(ownProject).length,1);
 for(const lang of ['es','ca']){
  const context=vm.createContext({window:{WritingContract:contract,i18n:{getLang:()=>lang}},Map,console,escapeHtml:s=>String(s||'')});vm.runInContext(fs.readFileSync(path.join(root,'src/renderer/js/views/generalTextsView.js'),'utf8'),context);const view=vm.runInContext('GeneralTextsView',context);
  for(const section of ['presentacion','cierre','introducciones']){const html=view.renderAiPreparationCard(section,'Synthetic',initial,section==='introducciones'?initial.areas[0]:null);assert(html.includes('disabled'));assert(html.includes(lang==='ca'?'Anar a Àrees i mesures':'Ir a Áreas y medidas'));}
 }
 database.closeDb();console.log('PASS 381 writing: database-authoritative 0/1/2/3 selection gates, own measures, ES/CA disabled buttons, fenced/think JSON parsed, prompt/repetition blocking; duplicate/municipality warnings, one retry, no silent fallback, normal parameters.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
