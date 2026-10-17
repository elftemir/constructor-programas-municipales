// Local Hunspell data; no network requests or automatic dictionary replacements.
const path=require('path');
const dictionaries=new Map(),cache=new Map();let loading;
function ready(){return loading||(loading=(async()=>{const {createHunspellFromFiles}=await import('hunspell-wasm');for(const lang of ['ca','es']){const directory=path.dirname(require.resolve('dictionary-'+lang)),spell=await createHunspellFromFiles(path.join(directory,'index.aff'),path.join(directory,'index.dic'));dictionaries.set(lang,{correct:word=>spell.testSpelling(word),suggest:word=>spell.getSpellingSuggestions(word)});}})().catch(error=>{loading=null;throw error;}));}
function dictionary(lang){if(!dictionaries.has(lang))throw Error('Orthography must be initialized before validation');return dictionaries.get(lang);}
function spellingWord(word){return word.normalize('NFC').replaceAll('’',"'").toLocaleLowerCase();}
function recognized(spell,word,lang){if(spell.correct(word))return true;
 // Catalan apostrophized articles/prepositions are grammar, not independent spelling errors.
 if(lang==='ca'&&/^(?:[ldmtns]|qu)'/u.test(word))return spell.correct(word.slice(word.indexOf("'")+1));
 return false;
}
function classify(word,lang){const key=lang+':'+word;if(cache.has(key))return cache.get(key);const target=dictionary(lang),otherLang=lang==='ca'?'es':'ca',other=dictionary(otherLang);let result=null;
 if(!recognized(target,word,lang))result={code:recognized(other,word,otherLang)?'LANGUAGE_MIX':'UNKNOWN_WORD',suggestions:target.suggest(word).slice(0,3),targetLanguage:lang};
 if(cache.size>10000)cache.clear();cache.set(key,result);return result;
}
function inspect(text,lang,params={}){
 const escape=value=>value.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&'),excluded=[];
 for(const name of [params.municipio,params.organizacion,params.partido,params.lema_es,params.lema_ca,params.lema].filter(Boolean))for(const match of text.matchAll(new RegExp(escape(String(name)),'giu')))excluded.push([match.index,match.index+match[0].length]);
 const issues=[];
 for(const match of text.matchAll(/[\p{L}\p{M}]+(?:['’·-][\p{L}\p{M}]+)*/gu)){
  const fragment=match[0],start=match.index,end=start+fragment.length;
  if(excluded.some(([a,b])=>start>=a&&end<=b)||/^[\p{Lu}\p{M}]{2,}$/u.test(fragment))continue;
  const value=classify(spellingWord(fragment),lang);if(value)issues.push({...value,fragment,start,end,suggestion:value.suggestions.join(', ')});
 }
 return issues;
}
module.exports={ready,inspect,dictionary,recognized,classify};
