const asar=require('@electron/asar'),fs=require('fs'),path=require('path');
const member=value=>path.normalize(value.replace(/[\\/]+/g,path.sep).replace(/^[\\/]+/,''));
function forbiddenContent(file,bytes){
  if(/programa-marco-prueba|catalog-test/i.test(file))return 'Programa Marco de prueba empaquetado';
  if(/\.(json|js|mjs|html|txt|md)$/i.test(file)&&/programa-marco-prueba/i.test(bytes.toString('utf8')))return 'Referencia al paquete de ejemplo empaquetada';
  if(/\.json$/i.test(file)){
    let data;try{data=JSON.parse(bytes);}catch(_){return null;}
    function visit(value){return value&&typeof value==='object'&&(Object.hasOwn(value,'is_test_fixture')||Object.values(value).some(visit));}
    if(visit(data))return 'Metadatos de paquete de prueba empaquetados';
  }return null;
}
function assertArchiveHasNoTestContent(archive){
  asar.uncache(archive);
  for(const file of asar.listPackage(archive)){
    if(asar.statFile(archive,member(file)).files)continue;
    const reason=forbiddenContent(file,asar.extractFile(archive,member(file)));
    if(reason)throw Error('NO PUBLICAR: '+file+' — '+reason);
  }
}
function assertResourcesHaveNoTestContent(directory,base=''){
  for(const entry of fs.readdirSync(path.join(directory,base),{withFileTypes:true})){
    const relative=path.join(base,entry.name);if(entry.isDirectory())assertResourcesHaveNoTestContent(directory,relative);
    else if(/\.(json|js|mjs|html|txt|md)$/i.test(entry.name)){
      const reason=forbiddenContent(relative,fs.readFileSync(path.join(directory,relative)));
      if(reason)throw Error('NO PUBLICAR: '+relative+' — '+reason);
    }
  }
}
module.exports={forbiddenContent,assertArchiveHasNoTestContent,assertResourcesHaveNoTestContent};
