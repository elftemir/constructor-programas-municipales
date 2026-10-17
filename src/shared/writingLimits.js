(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WritingLimits=api;})(typeof window==='object'?window:globalThis,function(){
 function limits(task,params={}){const long=task==='redactar_presentacion'&&params.longitud&&params.longitud!=='corta';return {long:Boolean(long),minWords:long?350:0,maxWords:task==='redactar_presentacion'?(long?500:300):task==='redactar_introduccion_area'?160:300,maxTokens:task==='redactar_presentacion'?(long?2400:900):task==='redactar_introduccion_area'?600:1200,context:long?8192:4096};}
 function timeout(tokens,backend='cpu'){return Math.max(60000,Math.min(600000,30000+Math.ceil(tokens/(backend==='gpu'?12:6)*1000)));}
 function repetitionThreshold(words,long){return long?Math.max(8,Math.ceil(words/45)):3;}
 return {limits,timeout,repetitionThreshold};
});
