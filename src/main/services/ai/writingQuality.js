const fs=require('fs'),path=require('path');
const contract=require('../../../shared/writingContract'),{francAll}=require('franc');
const normalize=s=>String(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const BLOCKING=new Set(['EMPTY','INVALID_JSON','PROMPT_LEAK','REPETITION','ELECTORAL_CLAIM','UNSUPPORTED_PERSON']);
const escape=s=>String(s).replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
let municipalities;function municipalityNames(){return municipalities||(municipalities=JSON.parse(fs.readFileSync(path.join(__dirname,'../../assets/data/municipios_catalunya.json'),'utf8')).map(m=>m.nombre).filter(Boolean));}
function warningText(issue,lang='es'){
 const ca=lang==='ca',quote='«'+issue.fragment+'»';
 const labels={LANGUAGE_MIX:ca?'Possible barreja d’idiomes':'Posible mezcla de idiomas',UNSUPPORTED_NUMBER:ca?'Xifra no aportada':'Cifra no aportada',OTHER_MUNICIPALITY:ca?'Un altre municipi':'Otro municipio',DUPLICATE_SENTENCE:ca?'Frase repetida':'Frase repetida',DUPLICATE_PARAGRAPH:ca?'Paràgraf repetit':'Párrafo repetido',LIST_FORMAT:ca?'Format de llista':'Formato de lista',UNSUPPORTED_PROBLEM:ca?'Problema no aportat':'Problema no aportado',UNSUPPORTED_DEADLINE:ca?'Termini no aportat':'Plazo no aportado',INVENTED_SLOGAN:ca?'Lema no aportat':'Lema no aportado',TOO_SHORT:ca?'Text més curt que l’orientació':'Texto más corto que la orientación',TOO_LONG:ca?'Text més llarg que l’orientació':'Texto más largo que la orientación',FRAGMENT_LENGTH:ca?'Longitud del fragment fora de l’orientació':'Longitud del fragmento fuera de la orientación',TECHNICAL_ARTIFACT:ca?'Símbol que cal revisar':'Símbolo que revisar',ORGANIZATION_GRAMMAR:ca?'Revisa el nom de la candidatura':'Revisa el nombre de la candidatura',INCOMPLETE_JSON:ca?'Resposta incompleta recuperada; revisa el final':'Respuesta incompleta recuperada; revisa el final',MISSING_FRAGMENTS:ca?'Falten idees d’algunes mesures; revisa o regenera':'Faltan ideas de algunas medidas; revisa o regenera'};
 if(issue.corrected)return (ca?'S’ha corregit':'Se ha corregido')+' «y» '+(ca?'per':'por')+' «i». '+(ca?'Revisa el fragment':'Revisa el fragmento')+': '+quote;
 if(issue.code==='UNKNOWN_WORD')return (ca?'Paraula no reconeguda':'Palabra no reconocida')+': '+quote+(issue.suggestion?' '+(ca?'Suggeriment, sense aplicar':'Sugerencia, sin aplicar')+': «'+issue.suggestion+'».':'');
 if(issue.code==='LANGUAGE_MIX'&&issue.targetLanguage)return (issue.targetLanguage==='ca'?(ca?'Possible castellanisme':'Posible castellanismo'):(ca?'Possible catalanisme':'Posible catalanismo'))+': '+quote+(issue.suggestion?' '+(ca?'Suggeriment, sense aplicar':'Sugerencia, sin aplicar')+': «'+issue.suggestion+'».':'');
 if(issue.code==='TOO_SHORT'&&issue.fewMeasures)return (ca?'Hi ha poques mesures per a un text llarg. Revisa la proposta.':'Hay pocas medidas para un texto largo. Revisa la propuesta.')+' '+(ca?'Paraules':'Palabras')+': '+issue.count+'.';
 let text=(labels[issue.code]||issue.code)+(issue.fragment?': '+quote:'.');
 if(issue.suggestion)text+=' '+(ca?'Suggeriment, sense aplicar':'Sugerencia, sin aplicar')+': «'+issue.suggestion+'».';
 if(issue.count!==undefined)text+=' '+(ca?'Paraules':'Palabras')+': '+issue.count+'.';return text;
}
function inspect(task,data,params={}){
 const text=String(data.formattedText||data.texto||data.introduccion||''),words=text.trim().split(/\s+/).filter(Boolean),issues=[];
 const add=(code,fragment='',start=-1,details={})=>{if(start<0&&fragment)start=text.indexOf(fragment);issues.push({code,fragment,start,end:start<0?-1:start+fragment.length,...details});};
 const matches=(code,regex,filter=()=>true)=>{for(const m of text.matchAll(regex))if(filter(m))add(code,m[0],m.index);};
 if(!words.length)add('EMPTY');
 const bounds=require('../../../shared/writingLimits').limits(task,params),maximum=task==='redactar_fragmento'?(params.fragmentMaxWords||220):bounds.maxWords;
 if(words.length>maximum)add('TOO_LONG',text,0,{count:words.length});if(bounds.minWords&&words.length<bounds.minWords)add('TOO_SHORT',text,0,{count:words.length,fewMeasures:bounds.long});
 matches('TECHNICAL_ARTIFACT',/[¬�\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu);
 matches('LIST_FORMAT',/^\s*(?:[-*•–—]\s+|\d+[.)]\s+)[^\n]+/gm);
 matches('ELECTORAL_CLAIM',/\b(?:ha[n]?\s+(?:(?:sido|estat)\s+)?(?:elegid[oa]s?|ganado|votado\s+a|escollit[sa]?|guanyat|votat)|hemos\s+(?:ganado|gobernado|sido\s+elegid[oa]s?)|(?:fue|fueron|fuimos)\s+elegid[oa]s?|hem\s+(?:guanyat|governat|estat\s+escollits)|vam\s+(?:guanyar|governar)|som\s+govern|gobierna|gobernamos|governa|governem)\b/giu);
 matches('PROMPT_LEAK',/\b(?:retorna|devuelve|respon|responde)\s+(?:només|solo|únicamente)\b[^.!?\n]*|\bt[ií]t[ou]l[o]? pol[ií]tic[o]? editorial\b|\b(?:paràgraf|párrafo)\s*\d|(?:^|\n)(?:Municipi|Municipio|Candidatura|Mandat|Mandato)\s*:[^\n]*/gimu);
 const own=params.municipio||'';let languageText=text;
 for(const name of [own,params.organizacion,params.partido,params.lema_ca].filter(Boolean))languageText=languageText.replace(new RegExp(escape(name),'giu'),m=>' '.repeat(m.length));
 const tokens=[...languageText.matchAll(/[\p{L}\p{N}’']+/gu)],grams=new Map();
 const width=5,threshold=Math.max(4,Math.ceil(words.length/80));
 for(let i=0;i<=tokens.length-width;i++){const key=tokens.slice(i,i+width).map(m=>normalize(m[0])).join(' '),found=grams.get(key)||[];found.push(i);grams.set(key,found);if(found.length>=threshold&&found.length*width/Math.max(words.length,1)>=0.25){const first=tokens[found[0]].index,last=tokens[found[0]+width-1];add('REPETITION',text.slice(first,last.index+last[0].length),first);break;}}
 const paragraphs=(data.parrafos||[data.entradilla,data.texto]).filter(Boolean),sentences=p=>[...p.matchAll(/[^.!?\n]+[.!?]?/g)].map(m=>m[0].trim()).filter(Boolean);
 for(const p of paragraphs){const seen=new Set();for(const sentence of sentences(p)){const n=normalize(sentence);if(seen.has(n))add('DUPLICATE_SENTENCE',sentence);seen.add(n);}}
 for(let i=0;i<paragraphs.length;i++)for(let j=i+1;j<paragraphs.length;j++){const a=sentences(paragraphs[i]).map(normalize).filter(s=>s.split(' ').length>=6),b=sentences(paragraphs[j]).map(normalize).filter(s=>s.split(' ').length>=6);if(a.length&&b.length&&a.filter(s=>b.includes(s)).length/Math.min(a.length,b.length)>0.5)add('DUPLICATE_PARAGRAPH',paragraphs[j]);}
 const source=JSON.stringify({municipio:own,mandato:params.mandato,contexto:params.contexto_municipal,translationSource:params.translationSource,medidas:params.selectedMeasures||[]}),sourceNormal=normalize(source);
 let withoutOwn=languageText;
 for(const m of String(params.contexto_municipal||'').matchAll(/^(Provincia|Província|Comarca):\s*(.+)$/gmi)){const prefix=m[1].toLowerCase().startsWith('pro')?'prov[ií]ncia':'comarca';withoutOwn=withoutOwn.replace(new RegExp('(?:'+prefix+')\\s+(?:de\\s+|del\\s+)?'+escape(m[2].trim()),'giu'),value=>' '.repeat(value.length));}
 for(const name of municipalityNames())if(name.length>3&&normalize(name)!==normalize(own)){const pattern=new RegExp('(?<![\\p{L}])'+escape(name)+'(?![\\p{L}])','giu');for(const m of withoutOwn.matchAll(pattern))add('OTHER_MUNICIPALITY',m[0],m.index);}
 const numbers=new Set(source.match(/\d+(?:[.,]\d+)*/g)||[]);matches('UNSUPPORTED_NUMBER',/\d+(?:[.,]\d+)*/g,m=>!numbers.has(m[0]));
 const targetLanguage=(params.idioma_salida||params.idioma)==='ca'?'ca':'es';
 issues.push(...require('./orthography').inspect(text,targetLanguage,params));
 const expected=targetLanguage==='ca'?'cat':'spa';
 // The formatted title, opening and every paragraph are separate blocks, regardless of line length.
 for(const m of languageText.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)){
  if(m[0].trim().length<20)continue;
  const ranks=francAll(m[0],{only:['cat','spa','eng'],minLength:20}),score=ranks.find(([code])=>code===expected)?.[1]||0;
  if(ranks[0]?.[0]!=='und'&&ranks[0]?.[0]!==expected&&ranks[0][1]-score>=0.2)add('LANGUAGE_MIX',text.slice(m.index,m.index+m[0].length),m.index,{paragraphLanguage:ranks[0][0]});
 }
 const lemma=require('../../utils/lema').getLema(params,params.idioma_salida||params.idioma||'es');
 matches('INVENTED_SLOGAN',/\blema\s+(?:oficial\s+)?(?:és|es|serà|será|:)\s*[^.!?\n]+/gi,m=>!lemma||!m[0].includes(lemma));
 matches('UNSUPPORTED_PERSON',/\b(?:alcalde|alcaldessa|presidente|presidenta|regidor|regidora|concejal|concejala)\s+[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,3}/gu,m=>!sourceNormal.includes(normalize(m[0])));
 matches('UNSUPPORTED_PROBLEM',/\b(?:falta|manca|carencia|déficit)\b[^.!?\n]*/giu,m=>!sourceNormal.includes(normalize(m[0]).split(' ')[0]));
 matches('UNSUPPORTED_DEADLINE',/\b(?:primers|primeros) (?:dos|dues|tres|quatre|cuatro) (?:anys|años)\b/giu,m=>!sourceNormal.includes(normalize(m[0])));
 if((params.organizacion||params.partido)==='Podemos')matches('ORGANIZATION_GRAMMAR',/\bdel Podemos\b/gi);
 const unique=[...new Map(issues.map(i=>[i.code+':'+i.start+':'+i.fragment,i])).values()];return{blocking:unique.filter(i=>BLOCKING.has(i.code)),warnings:unique.filter(i=>!BLOCKING.has(i.code))};
}
function quotedRanges(text){return [...text.matchAll(/"[^"]*"|«[^»]*»|“[^”]*”|‘[^’]*’|'[^']*'/g)].map(m=>[m.index,m.index+m[0].length]);}
function safeCatalanCorrections(data,params={}){
 const text=data.formattedText||data.texto||data.introduccion||'',changes=[];if((params.idioma_salida||params.idioma)!=='ca'||francAll(text,{only:['cat','spa','eng'],minLength:80})[0]?.[0]!=='cat')return{data,changes};
 const convert=(value,field)=>{const quotes=quotedRanges(value);for(const name of [params.municipio,params.organizacion,params.partido,params.lema_ca].filter(Boolean))for(const match of value.matchAll(new RegExp(escape(name),'giu')))quotes.push([match.index,match.index+match[0].length]);const pattern=/(?<![\p{L}\p{N}])([\p{Ll}][\p{Ll}'’]*)(\s+)y(\s+)(?=[\p{Ll}][\p{Ll}'’]*(?![\p{L}]))/gu;return value.replace(pattern,(match,left,before,after,start)=>{const at=start+left.length+before.length;if(quotes.some(([a,b])=>at>=a&&at<b))return match;changes.push({field,original:'y',replacement:'i',localStart:at});return left+before+'i'+after;});};
 const changed={...data};for(const key of (data.parrafos?['titulo','entradilla']:['titulo','entradilla','texto','frase_destacada']))if(typeof data[key]==='string')changed[key]=convert(data[key],key);if(data.parrafos)changed.parrafos=data.parrafos.map((p,i)=>convert(p,'parrafos.'+i));return{data:changed,changes};
}
function validatePrepared(task,data,params={},options={}){
 const corrected=safeCatalanCorrections(data,params);let normalized=corrected.data;
 if(task!=='redactar_fragmento')normalized=contract.structured(task,normalized);else normalized={...normalized,formattedText:[normalized.titulo,normalized.entradilla||normalized.texto].filter(Boolean).join('\n\n')};
 const assessment=inspect(task,normalized,params);
 if(options.blocking===false)assessment.blocking=[];
 if(assessment.blocking.length)throw Object.assign(Error(assessment.blocking.map(i=>i.code).join(',')),{qualityErrors:assessment.blocking.map(i=>i.code),validation:assessment});
 const warnings=assessment.warnings;
 for(const change of corrected.changes){const fields=change.field.split('.'),value=fields[0]==='parrafos'?normalized.parrafos[Number(fields[1])]:normalized[fields[0]],fieldStart=normalized.formattedText.indexOf(value),at=fieldStart+change.localStart;warnings.push({code:'LANGUAGE_MIX',fragment:'y',start:at,end:at+1,displayFragment:'i',corrected:true,suggestion:'i'});}
 const validation={warnings,corrections:corrected.changes.length,blocking:[]};return{...normalized,validation};
}
function qualityErrors(task,data,params={}){return inspect(task,data,params).blocking.map(i=>i.code);}
const CA_FIELDS={titulo:'titol',entradilla:'entradeta',parrafos:'paragrafs',texto:'text',frase_destacada:'frase_destacada'};
function responseSchema(task,lang='es'){
 const fields=task==='redactar_introduccion_area'?{entradilla:{type:'string'},texto:{type:'string'},frase_destacada:{type:'string'}}:task==='redactar_cierre'?{titulo:{type:'string'},parrafos:{type:'array',items:{type:'string'},minItems:2,maxItems:4}}:{titulo:{type:'string'},entradilla:{type:'string'},parrafos:{type:'array',items:{type:'string'},minItems:2,maxItems:4}};
 const properties=lang==='ca'?Object.fromEntries(Object.entries(fields).map(([key,value])=>[CA_FIELDS[key]||key,value])):fields;
 return {type:'object',properties,required:Object.keys(properties),additionalProperties:false};
}
function prompt(task,params={},lang='es',strict=false,issues=[]){
 const ca=lang==='ca',measures=params.selectedMeasures||[],shape=task==='redactar_introduccion_area'?{entradilla:'',texto:'',frase_destacada:''}:task==='redactar_cierre'?{titulo:'',parrafos:['']}:{titulo:'',entradilla:'',parrafos:['']};
 const languageShape=ca?Object.fromEntries(Object.entries(shape).map(([key,value])=>[CA_FIELDS[key]||key,value])):shape;
 const length=task==='redactar_presentacion'?(params.longitud==='corta'?'140–220':'350–500'):task==='redactar_introduccion_area'?'80–120':'150–250';
 const system=ca?'Redacta en català normatiu, sense barrejar-hi castellà: nosaltres, proposem, habitatge, veïnat, serveis. Utilitza únicament les mesures seleccionades i les dades aportades; no canviïs la finalitat d’una mesura. Escriu el nom del municipi EXACTAMENT com figura a les dades; no inventis noms, sobrenoms, lemes, problemes ni promeses. No indiquis xifres ni població que no constin a les dades. Escriu els compromisos en futur; no afirmis que ja s’han executat. No repeteixis frases ni paràgrafs. Retorna un únic objecte JSON vàlid, sense valles Markdown ni explicacions.':'Redacta en castellano correcto. Usa únicamente las medidas seleccionadas y los datos aportados; no cambies la finalidad de una medida. Escribe el nombre del municipio EXACTAMENTE como figura en los datos; no inventes nombres, apodos, lemas, problemas ni promesas. No indiques cifras ni población que no consten en los datos. Escribe los compromisos en futuro; no afirmes que ya se han ejecutado. No repitas frases ni párrafos. Devuelve un único objeto JSON válido, sin vallas Markdown ni explicaciones.';
 const lema=require('../../utils/lema').getLema(params,lang)||params.lema||'';
 const user=JSON.stringify(ca?{municipi:params.municipio,candidatura:params.organizacion||params.partido,mandat:params.mandato,lema,mesures:measures.map(m=>({area:m.area,titol:m.titulo,text:m.texto}))}:{municipio:params.municipio,organizacion:params.organizacion||params.partido,mandato:params.mandato,lema,medidas:measures.map(m=>({area:m.area,titulo:m.titulo,texto:m.texto}))});
 const feedback=issues.includes('ELECTORAL_CLAIM')?(ca?' La candidatura encara no ha estat escollida: redacta compromisos, no resultats electorals.':'La candidatura todavía no ha sido elegida: redacta compromisos, no resultados electorales.'):'';
 const action=task==='redactar_presentacion'?(ca?'Escriu la presentació política del programa municipal.':'Escribe la presentación política del programa municipal.'):task==='redactar_cierre'?(ca?'Escriu el text de tancament del programa municipal.':'Escribe el texto de cierre del programa municipal.'):(ca?'Escriu la introducció de l’àrea de les mesures indicades.':'Escribe la introducción del área de las medidas indicadas.');
 const format=ca?`La resposta ha de tenir entre ${length} paraules en total. El títol ha de ser breu. Cada paràgraf desenvolupa una idea diferent. Menciona el municipi com a màxim dues vegades. Omple només aquests camps amb text original; no retornis les dades d’entrada ni una clau "formato": `:`La respuesta debe tener entre ${length} palabras en total. El título debe ser breve. Cada párrafo desarrolla una idea distinta. Menciona el municipio como máximo dos veces. Completa solo estos campos con texto original; no devuelvas los datos de entrada ni una clave "formato": `;
 const candidature=ca?` Escriu sempre una PROPOSTA de candidatura per al mandat ${params.mandato||'2027–2031'}, en primera persona del plural: proposem, volem, ens comprometem. No afirmis que hem guanyat, governem, hem estat escollits o que el veïnat ens ha votat. No atribueixis decisions electorals a la població. Escriu paràgrafs, sense llistes amb guions. El nom exacte de l’organització és ${params.organizacion||params.partido||'Podemos'}: no el tradueixis ni el canviïs. No inventis xifres, noms, assoliments ni fets.`:` Escribe siempre una PROPUESTA de candidatura para el mandato ${params.mandato||'2027–2031'}, en primera persona del plural: proponemos, queremos, nos comprometemos. No afirmes que hemos ganado, gobernamos, hemos sido elegidos o que el vecindario nos ha votado. No atribuyas decisiones electorales a la población. Escribe párrafos, sin listas con guiones. El nombre exacto de la organización es ${params.organizacion||params.partido||'Podemos'}: no lo traduzcas ni lo cambies. No inventes cifras, nombres, logros ni hechos.`;
 return [{role:'system',content:system+candidature+(strict?(ca?' La resposta anterior s’ha rebutjat. Reescriu-la sense copiar instruccions i sense repeticions. Completa el JSON i no afegeixis camps.':' La respuesta anterior se ha rechazado. Reescríbela sin copiar instrucciones y sin repeticiones. Completa el JSON y no añadas campos.')+feedback:'')},{role:'user',content:(params.contexto_municipal||'')+'\n'+action+'\n'+format+JSON.stringify(languageShape)+'\n'+(ca?'DADES PER REDACTAR (no les retornis):':'DATOS PARA REDACTAR (no los devuelvas):')+'\n'+user}];
}

function formatAndValidate(task,raw,params,options={}){
 let object=typeof raw==='string'?contract.parseJson(raw):raw,recovered=false;
 if(!object&&typeof raw==='string'){object=require('../../../shared/textFormat').internalObject(raw);recovered=!!object;}
 if(object&&typeof object==='object'&&('titol' in object||'entradeta' in object||'paragrafs' in object))object={...object,...Object.fromEntries(Object.entries(CA_FIELDS).filter(([,key])=>Object.hasOwn(object,key)).map(([key,caKey])=>[key,object[caKey]]))};
 let data;try{data=contract.structured(task,object);}catch(error){throw Object.assign(Error('INVALID_JSON'),{qualityErrors:['INVALID_JSON'],cause:error});}
 if(!data.formattedText.trim()||((task==='redactar_presentacion'||task==='redactar_cierre')&&!data.parrafos.length))throw Object.assign(Error('EMPTY'),{qualityErrors:['EMPTY']});
 data=validatePrepared(task,data,params,options);
 if(recovered)data.validation.warnings.push({code:'INCOMPLETE_JSON',fragment:data.parrafos?.at(-1)||data.texto,start:0,end:0});return data;
}
module.exports={qualityErrors,inspect,validatePrepared,safeCatalanCorrections,warningText,prompt,formatAndValidate,responseSchema,BLOCKING};
