(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./writingContract'));else root.TextFormat=factory(root.WritingContract);})(typeof window==='object'?window:globalThis,function(contract){

 function recoverCut(plain){
  if(!/^\s*\{/.test(plain)||!/["'](?:titulo|titol)["']\s*:/.test(plain)||!/["'](?:parrafos|paragrafs)["']\s*:\s*\[/.test(plain))return null;
  const stack=[];let quoted=false,escaped=false;
  for(const c of plain){if(escaped){escaped=false;continue;}if(quoted&&c==='\\'){escaped=true;continue;}if(c==='"'){quoted=!quoted;continue;}if(quoted)continue;if(c==='{'||c==='[')stack.push(c);else if(c==='}'||c===']'){const opening=stack.pop();if(opening!==(c==='}'?'{':'['))return null;}}
  if(!stack.length&&!quoted)return null;
  let fixed=plain;if(escaped)fixed=fixed.slice(0,-1);if(quoted)fixed+='"';fixed=fixed.replace(/,\s*$/,'');fixed+=stack.reverse().map(c=>c==='{'?'}':']').join('');
  try{const object=JSON.parse(fixed);if(!Array.isArray(object.parrafos||object.paragrafs))return null;object.__truncated=true;return object;}catch{return null;}
 }
 function parseStored(value){let object=value;for(let pass=0;pass<3&&typeof object==='string';pass++){const plain=contract.stripThinking(object).replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i,'$1');try{object=JSON.parse(plain);continue;}catch{let quoted=false,escaped=false,out='';for(let i=0;i<plain.length;i++){const char=plain[i];if(escaped){out+=char;escaped=false;continue;}if(char==='\\'){out+=char;escaped=true;continue;}if(char==='"'){if(quoted&&!/^[\s]*[:,}\]]|^\s*$/.test(plain.slice(i+1))){out+='\\"';continue;}quoted=!quoted;out+=char;continue;}out+=quoted&&char==='\n'?'\\n':quoted&&char==='\r'?'\\r':quoted&&char==='\t'?'\\t':char;}try{object=JSON.parse(out);}catch{return recoverCut(plain);}}}return object;}
 function internalObject(value){let obj=typeof value==='string'?parseStored(value):value;if(!obj||typeof obj!=='object'||Array.isArray(obj))return null;
  if('titol' in obj||'paragrafs' in obj||'entradeta' in obj)obj={...obj,titulo:obj.titol??obj.titulo,entradilla:obj.entradeta??obj.entradilla,parrafos:obj.paragrafs??obj.parrafos,texto:obj.text??obj.texto};
  if(typeof obj.titulo==='string'&&Array.isArray(obj.parrafos)&&obj.parrafos.every(p=>typeof p==='string'))return obj;
  if(typeof obj.entradilla==='string'&&typeof obj.texto==='string'&&(obj.frase_destacada===undefined||typeof obj.frase_destacada==='string'))return obj;
  return null;
 }
 function format(section,obj){
  if(section==='introducciones')return {entradilla:obj.entradilla||'',texto:obj.texto||obj.parrafos?.join('\n\n')||'',frase_destacada:obj.frase_destacada||''};
  const out={titulo:obj.titulo||'',parrafos:(obj.parrafos||[]).slice()};if(section==='presentacion')return contract.presentationFields({...out,entradilla:obj.entradilla||''});return out;
 }
 function display(section,node){return [node.titulo,node.entradilla,...(node.parrafos||[]),section==='introducciones'?node.texto:'',section==='introducciones'?node.frase_destacada:''].filter(Boolean).join('\n\n');}
 function repairNode(section,node){
  const candidates=typeof node==='string'?[node]:[node?.titulo,node?.titol,node?.entradilla,node?.entradeta,node?.texto,node?.text,...(Array.isArray(node?.parrafos)?node.parrafos:[node?.parrafos]),...(Array.isArray(node?.paragrafs)?node.paragrafs:[node?.paragrafs])];
  const pieces=candidates.filter(value=>typeof value==='string'),combined=pieces.flatMap((value,index)=>/^\s*(?:\{|"\{|```)/.test(value)?[pieces.slice(index).join('\n')]:[]);
  for(const candidate of [...candidates,...combined]){const obj=internalObject(candidate);if(obj){const base={...(typeof node==='object'?node:{})};for(const key of ['titulo','titol','entradilla','entradeta','parrafos','paragrafs','texto','text','frase_destacada'])delete base[key];return {changed:true,incomplete:!!obj.__truncated,node:{...base,...format(section,obj)}};}}
  return {changed:false,node};
 }
 function repairDocument(input={}){
  const texts=JSON.parse(JSON.stringify(input)),changes=[];
  for(const section of ['presentacion','cierre']){
   const container=texts[section];if(container)for(const lang of ['es','ca'])if(container[lang]){const result=repairNode(section,container[lang]);if(result.changed){container[lang]=result.node;changes.push({section,lang,incomplete:!!result.incomplete});}}
   const old={titulo:texts[section+'_titulo'],entradilla:texts[section+'_entradilla'],parrafos:texts[section+'_parrafos']||[]},fixed=repairNode(section,old);
   if(fixed.changed){texts[section+'_titulo']=fixed.node.titulo;texts[section+'_parrafos']=fixed.node.parrafos;if(section==='presentacion')texts.presentacion_entradilla=fixed.node.entradilla;changes.push({section,lang:'legacy',incomplete:!!fixed.incomplete});}
  }
  for(const [areaId,container]of Object.entries(texts.introducciones_areas||{})){
   if(container?.es||container?.ca){for(const lang of ['es','ca'])if(container[lang]){const result=repairNode('introducciones',container[lang]);if(result.changed){container[lang]=result.node;changes.push({section:'introducciones',lang,areaId});}}}
   else{const result=repairNode('introducciones',container);if(result.changed){texts.introducciones_areas[areaId]=result.node;changes.push({section:'introducciones',lang:'legacy',areaId});}}
  }
  return {texts,changes,changed:changes.length>0};
 }
 function normalizeProposal(result,task,editedText=null){
  const section=task==='redactar_presentacion'?'presentacion':task==='redactar_cierre'?'cierre':task==='redactar_introduccion_area'?'introducciones':null;
  let obj=internalObject(editedText)||internalObject(result?.texto)||internalObject(result?.data?.texto);
  if(!section){if(obj){const kind=obj.entradilla!==undefined?'presentacion':'cierre';return {...result,texto:display(kind,format(kind,obj)),data:{...(result.data||{}),texto:display(kind,format(kind,obj))}};}return {...result,texto:editedText===null?result.texto:editedText,data:{...(result.data||{}),texto:editedText===null?(result.data?.texto||result.texto):editedText}};}
  let node;
  if(obj)node=format(section,obj);
  else if(editedText!==null){const chunks=String(editedText).trim().split(/\n\s*\n/).filter(Boolean);node=section==='introducciones'?{entradilla:chunks.shift()||'',texto:chunks.join('\n\n'),frase_destacada:result.frase_destacada||result.data?.frase_destacada||''}:{titulo:chunks.shift()||'',...(section==='presentacion'?{entradilla:chunks.shift()||''}:{}),parrafos:chunks};}
  else node={...(result.data||result)};
  if(section==='presentacion')node=contract.presentationFields(node);
  const text=display(section,node);if(!text.trim()||/[{}]|```|"(?:titulo|entradilla|parrafos)"\s*:/i.test(text))throw Error('La propuesta contiene un formato interno incorrecto.');
  return {...result,...node,data:{...node},texto:text};
 }
 function strings(value){if(typeof value==='string')return [value];if(Array.isArray(value))return value.flatMap(strings);if(value&&typeof value==='object')return Object.values(value).flatMap(strings);return [];}
 function unresolved(value){return strings(value).some(text=>/\{\s*"(?:titulo|titol|entradilla|entradeta|parrafos|paragrafs|texto|text)"\s*:/.test(text.replace(/\\"/g,'"')));}
 return {internalObject,format,display,repairNode,repairDocument,normalizeProposal,strings,unresolved};
});
