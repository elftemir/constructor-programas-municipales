(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WritingWarnings=api;})(typeof window==='object'?window:globalThis,function(){
 function messages(warnings=[],lang='es'){
  const ca=lang==='ca',groups=new Map();
  for(const warning of warnings){const message=ca?warning.message_ca:warning.message_es,key=warning.corrected?'correction:y:i':message||warning.code;const group=groups.get(key)||{warning,count:0};group.count++;groups.set(key,group);}
  return [...groups.values()].map(({warning,count})=>warning.corrected?(ca?`S’han corregit ${count} «y» per «i». Revisa els fragments marcats.`:`Se han corregido ${count} «y» por «i». Revisa los fragmentos marcados.`):(ca?warning.message_ca:warning.message_es)+(count>1?(ca?` (${count} aparicions)`:` (${count} apariciones)`):''));
 }
 function clearMessage(lang='es'){return lang==='ca'?'No s’han detectat problemes automàticament. Revisa el text abans d’acceptar-lo.':'No se han detectado problemas automáticamente. Revisa el texto antes de aceptarlo.';}
 return {messages,clearMessage};
});
