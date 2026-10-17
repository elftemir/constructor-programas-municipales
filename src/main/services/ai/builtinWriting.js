const {getLema}=require('../../utils/lema');
function generate(task,p){
 const ca=(p.idioma_salida||p.idioma)==='ca',municipio=p.municipio||'',measures=p.selectedMeasures||[];
 const selected=measures.map(m=>(m.texto||m.titulo||'').trim()).filter(Boolean);
 const commitments=selected.slice(0,6).map(s=>s.replace(/[.!?]+$/,'')+'.').join(' ');
 let data;
 if(task==='redactar_introduccion_area'){
  const entradilla=ca?`Aquest apartat recull les mesures seleccionades per a ${municipio}.`:`Este apartado recoge las medidas seleccionadas para ${municipio}.`;
  const texto=(ca?'Les propostes concretes són les següents. ':'Las propuestas concretas son las siguientes. ')+commitments;
  const frase_destacada=ca?'Compromisos concrets que es poden revisar i avaluar.':'Compromisos concretos que se pueden revisar y evaluar.';
  data={entradilla,texto,frase_destacada,introduccion:entradilla+'\n\n'+texto};
 }else{
  const cierre=task==='redactar_cierre',titulo=ca?(cierre?'Compromisos per al nostre municipi':'Un programa construït a partir de propostes concretes'):(cierre?'Compromisos para nuestro municipio':'Un programa construido a partir de propuestas concretas');
  const parrafos=cierre?[(ca?`El nostre compromís amb ${municipio} es concreta en aquestes mesures. `:`Nuestro compromiso con ${municipio} se concreta en estas medidas. `)+commitments,ca?'El seguiment públic d’aquests compromisos ha de permetre revisar-ne el desenvolupament i valorar-ne els resultats.':'El seguimiento público de estos compromisos debe permitir revisar su desarrollo y valorar sus resultados.']:[(ca?'El programa incorpora les actuacions següents. ':'El programa incorpora las siguientes actuaciones. ')+commitments,ca?'Aquestes propostes s’han seleccionat per formar part del programa municipal. Cal concretar-ne l’aplicació, respectar les competències municipals i revisar els resultats.':'Estas propuestas se han seleccionado para formar parte del programa municipal. Es necesario concretar su aplicación, respetar las competencias municipales y revisar los resultados.'];
  const lema=getLema(p,ca?'ca':'es');if(lema)parrafos.push(lema);
  data={titulo,parrafos,cuerpo:parrafos.join('\n\n')};
  if(!cierre)data.entradilla=ca?`Presentem les mesures seleccionades per a ${municipio} durant el mandat ${p.mandato||'2027–2031'}.`:`Presentamos las medidas seleccionadas para ${municipio} durante el mandato ${p.mandato||'2027–2031'}.`;
  data.texto=[titulo,data.entradilla,...parrafos].filter(Boolean).join('\n\n');
 }
 return {ok:true,data,...data,texto:data.introduccion||data.texto,titulos:[],avisos:[],error:null,meta:{provider:'BuiltinLocalAiEngine',operation:task}};
}
module.exports={generate};
