// Explicit local inputs only. Never publishes, reads a user profile, or bundles a catalogue into the app.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),JSZip=require('jszip'),{DOMParser}=require('@xmldom/xmldom');
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const attr=(node,key)=>node?.getAttributeNS(W,key)||node?.getAttribute('w:'+key)||'',first=(node,name)=>node?.getElementsByTagNameNS(W,name)[0];
async function readDocx(file){
 const zip=await JSZip.loadAsync(fs.readFileSync(file));const xml=async name=>{const entry=zip.file(name);if(!entry)return null;return new DOMParser().parseFromString(await entry.async('string'),'application/xml');};
 const doc=await xml('word/document.xml'),styles=await xml('word/styles.xml'),numbering=await xml('word/numbering.xml');if(!doc)throw Error('El DOCX no contiene word/document.xml.');
 const styleMap=new Map([...styles?.getElementsByTagNameNS(W,'style')||[]].map(s=>[attr(s,'styleId'),s]));
 const inherited=(id,seen=new Set())=>{if(seen.has(id))throw Error('Ciclo en estilos del DOCX.');seen.add(id);const style=styleMap.get(id);return style?[style,...inherited(attr(first(style,'basedOn'),'val'),seen)]:[];};
 const nums=new Map([...numbering?.getElementsByTagNameNS(W,'num')||[]].map(n=>[attr(n,'numId'),attr(first(n,'abstractNumId'),'val')])),abstracts=new Map([...numbering?.getElementsByTagNameNS(W,'abstractNum')||[]].map(n=>[attr(n,'abstractNumId'),n]));
 const areas=[];let area;let line=0;
 for(const paragraph of [...doc.getElementsByTagNameNS(W,'p')]){
  line++;if(paragraph.parentNode.localName!=='body')throw Error('Estructura no soportada: hay párrafos en tablas o contenedores. Usa áreas y viñetas en el cuerpo.');
  const text=[...paragraph.getElementsByTagNameNS(W,'t')].map(n=>n.textContent).join('').trim();if(!text)continue;
  const props=first(paragraph,'pPr'),styleId=attr(first(props,'pStyle'),'val'),hierarchy=inherited(styleId),heading=attr(first(props,'outlineLvl'),'val')==='0'||hierarchy.some(s=>attr(first(s,'outlineLvl'),'val')==='0')||/^(?:Heading1|T[ií]tulo1|T[ií]tol1)$/i.test(styleId);
  if(heading){area={nombre:text,medidas:[]};areas.push(area);continue;}
  const numberingProps=first(props,'numPr')||hierarchy.map(s=>first(s,'numPr')).find(Boolean);let bullet=/^[•●▪]\s+/.test(text);
  if(numberingProps){const id=attr(first(numberingProps,'numId'),'val'),level=attr(first(numberingProps,'ilvl'),'val')||'0',definition=abstracts.get(nums.get(id));const lvl=[...definition?.getElementsByTagNameNS(W,'lvl')||[]].find(n=>attr(n,'ilvl')===level);bullet=attr(first(lvl,'numFmt'),'val')==='bullet';if(!bullet)throw Error('Párrafo '+line+': la medida debe usar una viñeta, no una lista numerada.');if(level!=='0')throw Error('Párrafo '+line+': viñeta anidada no admitida; usa una medida por viñeta.');}
  if(bullet){if(!area)throw Error('Párrafo '+line+': hay una medida antes del primer Título 1.');const value=text.replace(/^[•●▪]\s+/,'');area.medidas.push({titulo:value.split(/[.!?]/)[0].slice(0,140)||value.slice(0,140),texto:value});}
  else if(area)throw Error('Párrafo '+line+' del área '+areas.length+': texto sin viñeta. No se descarta contenido; corrige la estructura.');
 }
 if(!areas.length)throw Error('No se encontraron áreas con Título 1.');for(let i=0;i<areas.length;i++)if(!areas[i].medidas.length)throw Error('Área '+(i+1)+' sin medidas.');return areas;
}
function align(es,ca){if(es.length!==ca.length)throw Error('Áreas diferentes: ES='+es.length+', CA='+ca.length+'.');for(let i=0;i<es.length;i++)if(es[i].medidas.length!==ca[i].medidas.length)throw Error('Área '+(i+1)+' («'+es[i].nombre+'» / «'+ca[i].nombre+'»): medidas ES='+es[i].medidas.length+', CA='+ca[i].medidas.length+'.');}
async function readingPdf(title,areas){
 const {PDFDocument,StandardFonts,rgb}=require('pdf-lib'),pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);let page,y;
 const next=()=>{page=pdf.addPage([595.28,841.89]);y=790;};next();
 const draw=(text,size=11,heading=false)=>{const chosen=heading?bold:font;let line='';for(const word of text.split(/\s+/)){if(chosen.widthOfTextAtSize((line?line+' ':'')+word,size)>490&&line){if(y<55)next();page.drawText(line,{x:52,y,size,font:chosen,color:rgb(0,0,0)});y-=size+5;line=word;}else line+=(line?' ':'')+word;}if(line){if(y<55)next();page.drawText(line,{x:52,y,size,font:chosen});y-=size+9;}};
 draw(title,18,true);for(const area of areas){draw(area.nombre,14,true);for(const measure of area.medidas)draw('• '+measure.texto);}return Buffer.from(await pdf.save());
}
async function packageMarco(options){
 if(!options.es||!options.ca||!options.out||!options.id)throw Error('Uso: node scripts/empaquetar_programa_marco.js --es archivo.docx --ca archivo.docx --out carpeta-nueva --id identificador --version 1.0.0 [--catalog-base catalog.json]');
 const id=options.id,version=options.version||'1.0.0';if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,120}$/.test(id)||!/^\d+\.\d+\.\d+$/.test(version))throw Error('Identificador o versión inválidos.');
 const out=path.resolve(options.out);if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('La carpeta de salida debe estar vacía; no se sobrescribe una entrega.');
 const es=await readDocx(options.es),ca=await readDocx(options.ca);align(es,ca);
 const title={es:options['title-es']||'Programa Marco oficial',ca:options['title-ca']||'Programa Marc oficial'},cycle=options.cycle||'2027-2031',min=options['min-app-version']||'3.8.5',zip=new JSZip(),hashes={},languages={},total=es.reduce((sum,a)=>sum+a.medidas.length,0);
 for(const [lang,areas] of [['es',es],['ca',ca]]){
  const data={content_id:id,content_version:version,language:{code:lang,ai_translated:false},areas:areas.map((a,i)=>({area_id:'area-'+(i+1),orden:i+1,nombre:a.nombre,medidas:a.medidas.map((m,j)=>({...m,measure_id:'measure-'+(i+1)+'-'+(j+1),area_id:'area-'+(i+1),codigo:(i+1)+'.'+(j+1),orden:j+1}))}))};
  const json=Buffer.from(JSON.stringify(data,null,2)+'\n'),pdf=await readingPdf(title[lang],areas),pdfName=lang+'/programa.pdf',jsonName=lang+'/programa.json';zip.file(pdfName,pdf);zip.file(jsonName,json);languages[lang]={pdf:pdfName,data:jsonName,sha256_pdf:sha(pdf),sha256_data:sha(json)};hashes[pdfName]=sha(pdf);hashes[jsonName]=sha(json);
 }
 const manifest={schema_version:1,content_id:id,content_type:'programa_marco',content_version:version,title,cycle,official:true,min_app_version:min,languages};zip.file('manifest.json',JSON.stringify(manifest,null,2)+'\n');
 const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),filename=id+'_v'+version+'.zip',tag=id+'-v'+version,url='https://github.com/elftemir/constructor-programas-municipales-content/releases/download/'+tag+'/'+filename;
 const entry={content_id:id,content_type:'programa_marco',content_version:version,title,cycle,official:true,published_at:new Date().toISOString(),min_app_version:min,languages:['es','ca'],stats:{total_areas:es.length,total_measures:total},release_tag:tag,package:{filename,download_url:url,size_bytes:bytes.length,sha256:sha(bytes)}};
 const prior=options['catalog-base']?JSON.parse(fs.readFileSync(options['catalog-base'],'utf8')):{schema_version:1,programas_marco:[]};
 const {ContentUpdateService}=require('../src/main/services/contentUpdateService'),service=new ContentUpdateService();service.isPackagedApp=()=>true;service.validateCatalogSchema({...prior,programas_marco:prior.programas_marco||[]});
 const catalog={...prior,schema_version:1,catalog_version:options['catalog-version']||prior.catalog_version||'1.0.0',updated_at:entry.published_at,repository:'https://github.com/elftemir/constructor-programas-municipales-content',programas_marco:[...(prior.programas_marco||[]).filter(item=>item.content_id!==id),entry]};service.validateCatalogSchema(catalog);
 const verified=await service.verifyAndExtractPackage(bytes,entry);if(verified.aligned.totalMeasures!==total)throw Error('La validación final del cliente no conserva las medidas.');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,filename),bytes);fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');hashes[filename]=sha(bytes);fs.writeFileSync(path.join(out,'SHA256.txt'),Object.entries(hashes).map(([file,digest])=>digest+'  '+file).join('\n')+'\n');
 return {filename,sha256:sha(bytes),size:bytes.length,areas:es.length,measures:total,catalog,manifest,bytes};
}
if(require.main===module){const options={};for(let i=2;i<process.argv.length;i+=2)options[process.argv[i].replace(/^--/,'')]=process.argv[i+1];packageMarco(options).then(result=>console.log(JSON.stringify({...result,bytes:undefined,catalog:undefined,manifest:undefined}))).catch(error=>{console.error(error.message);process.exitCode=1;});}
module.exports={readDocx,align,packageMarco};
