(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WritingContract=api;})(typeof window==='object'?window:globalThis,function(){
 const MIN_SELECTED=Object.freeze({redactar_presentacion:3,redactar_cierre:3,redactar_introduccion_area:1});
 const LONG_MIN_SELECTED=6;
 const NORMAL_GENERATION=Object.freeze({temperature:0.65,repeat_penalty:1.1,repeat_last_n:32,top_p:0.8,top_k:20});
 const SECTION_TASK=Object.freeze({presentacion:'redactar_presentacion',cierre:'redactar_cierre',introducciones:'redactar_introduccion_area'});
 const included=m=>['incluida','adaptada'].includes(m.decision?.estado||m.estado);
 function selectedMeasures(project={},lang='es',areaId=null){
  return (project.areas||[]).filter(a=>!areaId||a.id===areaId).flatMap(a=>[...(a.medidas||[]),...(a.medidas_propias||[])].filter(included).map(m=>{
   const d=m.decision||{},ca=lang==='ca';
   return {id:m.id,areaId:a.id,area:ca?(a.nombre_ca||a.nombre):a.nombre,
    titulo:ca?(d.titulo_ca||(project.idioma_principal==='ca'?d.version_municipal_titulo:d.traduccion_titulo)||d.version_municipal_titulo_ca||m.titulo_ca||m.titulo||''):(d.titulo_es||(project.idioma_principal==='ca'?d.traduccion_titulo:d.version_municipal_titulo)||m.titulo_es||m.titulo||''),
    texto:ca?(d.texto_ca||(project.idioma_principal==='ca'?d.version_municipal_texto:d.traduccion_texto)||d.version_municipal_texto_ca||m.texto_ca||m.texto||m.explicacion||''):(d.texto_es||(project.idioma_principal==='ca'?d.traduccion_texto:d.version_municipal_texto)||m.texto_es||m.texto||m.explicacion||'')};
  }));
 }
 function minimumState(task,measures=[],lang='es',params={}){
  const long=task==='redactar_presentacion'&&params.longitud&&params.longitud!=='corta';
  const required=long?LONG_MIN_SELECTED:(MIN_SELECTED[task]||0),count=measures.length,ca=lang==='ca';
  const subject=task==='redactar_cierre'?(ca?'el tancament':'el cierre'):task==='redactar_introduccion_area'?(ca?'la introducció d’aquesta àrea':'la introducción de esta área'):(ca?'la presentació':'la presentación');
  return {allowed:count>=required,required,count,message:count>=required?'':ca?`Per redactar ${subject} necessites almenys ${required} ${required===1?'mesura seleccionada':'mesures seleccionades'}. Ara en tens ${count}.`:`Para redactar ${subject} necesitas al menos ${required} ${required===1?'medida seleccionada':'medidas seleccionadas'}. Ahora tienes ${count}.`};
 }
 function stripThinking(raw){return String(raw||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();}
 function parseJson(raw){let text=stripThinking(raw);const fenced=text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);if(fenced)text=fenced[1];try{return JSON.parse(text);}catch(_){return null;}}
 const clean=s=>typeof s==='string'?stripThinking(s).replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').trim().replace(/([.!?])\s*[,;]+$/,'$1'):'';
 function presentationFields(value){const titulo=clean(value.titulo),parrafos=(value.parrafos||[]).map(clean).filter(Boolean);let entradilla=clean(value.entradilla);const same=(a,b)=>a.trim().toLocaleLowerCase()===b.trim().toLocaleLowerCase();if(!entradilla||same(entradilla,titulo)){entradilla=parrafos.shift()||'';if(same(entradilla,titulo))entradilla='';}return {...value,titulo,entradilla,parrafos};}
 function structured(task,value){
  const obj=typeof value==='string'?parseJson(value):value;
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('INVALID_JSON');
  let data;
  if(task==='redactar_introduccion_area'){
   if(typeof obj.entradilla!=='string'||typeof obj.texto!=='string')throw Error('INVALID_STRUCTURE');
   data={entradilla:clean(obj.entradilla),texto:clean(obj.texto),frase_destacada:clean(obj.frase_destacada)};
   data.introduccion=[data.entradilla,data.texto].filter(Boolean).join('\n\n');
  }else{
   if(typeof obj.titulo!=='string'||!Array.isArray(obj.parrafos)||!obj.parrafos.length||obj.parrafos.some(p=>typeof p!=='string'))throw Error('INVALID_STRUCTURE');
   if(task==='redactar_presentacion'&&typeof obj.entradilla!=='string')throw Error('INVALID_STRUCTURE');
   data={titulo:clean(obj.titulo),parrafos:obj.parrafos.map(clean).filter(Boolean)};
   if(task==='redactar_presentacion')data=presentationFields({...data,entradilla:clean(obj.entradilla)});
   data.cuerpo=data.parrafos.join('\n\n');data.texto=[data.titulo,data.entradilla,...data.parrafos].filter(Boolean).join('\n\n');
  }
  const text=task==='redactar_introduccion_area'?data.introduccion:data.texto;
  if(!text||/[{}]|```|<\/?think>|"(?:titulo|entradilla|parrafos)"\s*:/i.test(text))throw Error('TECHNICAL_ARTIFACT');
  return {...data,formattedText:text};
 }
 return {MIN_SELECTED,LONG_MIN_SELECTED,NORMAL_GENERATION,SECTION_TASK,selectedMeasures,minimumState,stripThinking,parseJson,structured,presentationFields};
});
