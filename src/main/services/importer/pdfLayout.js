// Geometry retained from native text or OCR; no model or document-specific titles.
const bullet=/^\s*(?:[oO•*\-–—▪◦●○\uF0A3\uF0FC]|\d+[.)])(?:\s+|$)/u;
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
function fontIsBold(font){
 if(font?.bold||font?.black)return true;
 const data=font?.data;if(!data?.byteLength||data.byteLength<12)return false;
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength),count=view.getUint16(4);
 if(12+count*16>data.byteLength)return false;
 for(let i=0;i<count;i++){const at=12+i*16;if(String.fromCharCode(...data.slice(at,at+4))!=='OS/2')continue;const offset=view.getUint32(at+8);return offset+6<=data.byteLength&&view.getUint16(offset+4)>=600;}
 return false;
}
function overlapping(items){
 const valid=items.filter(i=>i.str?.trim().length>2&&i.width>0&&i.height>0);let pairs=0;
 for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++){
  const a=valid[i],b=valid[j],ax=a.transform[4],ay=a.transform[5],bx=b.transform[4],by=b.transform[5];
  const w=Math.max(0,Math.min(ax+a.width,bx+b.width)-Math.max(ax,bx)),h=Math.max(0,Math.min(ay+a.height,by+b.height)-Math.max(ay,by));
  if(w*h>Math.min(a.width*a.height,b.width*b.height)*.65&&norm(a.str)!==norm(b.str))pairs++;
 }return {mixed:pairs>=3,pairs};
}
function nativeLines(items,page,height){
 const lines=[];
 for(const i of items.filter(i=>i.str?.trim())){
  const y=height-i.transform[5];let line=lines.find(l=>Math.abs(l.y-y)<Math.max(1,Math.min(i.height,12)*.15));
  if(!line)lines.push(line={page,y,x:i.transform[4],height:i.height,items:[]});
  line.items.push(i);line.x=Math.min(line.x,i.transform[4]);line.height=Math.max(line.height,i.height);
 }
  return lines.sort((a,b)=>a.y-b.y).map(l=>({...l,text:l.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim(),bold:l.items.filter(i=>i.str.trim()).every(i=>i.bold),font:l.items.reduce((best,i)=>i.str.length>(best?.str.length||0)?i:best,null)?.fontName,items:undefined}));
}
function median(values){const a=values.filter(v=>v>0).sort((a,b)=>a-b);return a[Math.floor(a.length/2)]||12;}
function structure(pages){
 const annotated=pages.map(p=>({...p,lines:(p.lines||[]).filter(l=>!(p.layoutHints?.excluded||[]).some(b=>l.y>=b.from&&l.y<=b.to)).map(l=>{
  if(!p.layoutHints?.bullets?.length)return l;
  const candidates=[...(p.layoutHints.headings||[]).map(h=>({...h,kind:'heading'})),...p.layoutHints.bullets.map(h=>({...h,kind:'bullet'}))].filter(h=>Math.abs(h.y-l.y)<=Math.max(25,l.height*.8,h.height*.8)&&Math.abs(h.x-l.x)<Math.max(100,l.height*2.5));
  candidates.sort((a,b)=>Math.abs(a.y-l.y)-Math.abs(b.y-l.y));return {...l,layoutKind:candidates[0]?.kind||'body',hasLayoutHints:true};
 })}));
 pages=annotated;
 const isBullet=l=>l.hasLayoutHints?l.layoutKind==='bullet':bullet.test(l.text);
 const edgeKey=text=>norm(text).replace(/\d+/g,'#');
 const repeated=new Map();for(const p of pages){const seen=new Set();for(const l of p.lines||[])if(l.y<p.height*.13||l.y>p.height*.87)seen.add(edgeKey(l.text));for(const text of seen)repeated.set(text,(repeated.get(text)||0)+1);}
 const lines=pages.flatMap(p=>(p.lines||[]).filter(l=>l.text?.trim()).filter(l=>{
  const edge=l.y<p.height*.13||l.y>p.height*.87;
  return !(edge&&((pages.length>1&&(repeated.get(edgeKey(l.text))||0)>=Math.max(2,Math.ceil(pages.length*.5)))||/^\d{1,4}$/.test(l.text.trim())));
 }));
 const bodyHeight=median(lines.filter(l=>l.text.length>60&&!isBullet(l)).map(l=>l.height));
 const fonts=new Map();for(const l of lines)if(l.font)fonts.set(l.font,(fonts.get(l.font)||0)+l.text.length);const bodyFont=[...fonts].sort((a,b)=>b[1]-a[1])[0]?.[0];
 const measureLeft=median(lines.filter(isBullet).map(l=>l.x));
 const headings=new Set();
 for(let i=0;i<lines.length;i++){
  const l=lines[i];if(l.hasLayoutHints){if(l.layoutKind==='heading')headings.add(i);continue;}if(isBullet(l)||l.text.length>160||l.text.split(/\s+/).length>22||/[.;:]$/.test(l.text)||l.text.length<4)continue;
  const style=l.height>bodyHeight*1.035||(l.bold&&l.height>=bodyHeight*.98)||(l.origin==='ocr'&&l.x<measureLeft-8);
  if(!style)continue;
  for(let j=i+1;j<Math.min(lines.length,i+7);j++){const next=lines[j];if(isBullet(next)){headings.add(i);break;}if(next.height>bodyHeight*1.035&&next.text.length<160&&!/[.;:]$/.test(next.text))break;}
 }
 const areas=[],front=[];let area=null,measure=null;
 for(let i=0;i<lines.length;i++){
  const l=lines[i];if(headings.has(i)){area={title:l.text,sourceNumber:String(areas.length+1),introduction:'',subareas:[],measures:[],sourcePage:l.page,position:{x:l.x,y:l.y,height:l.height}};areas.push(area);measure=null;continue;}
  if(!area){front.push(l.text);continue;}
  if(isBullet(l)){const text=l.text.replace(l.hasLayoutHints?/^\s*(?:[oO0•*\-–—▪◦●○\uF0A3\uF0FC][\s:]*)/u:bullet,'').trim();measure={sourceNumber:area.sourceNumber+'.'+(area.measures.length+1),title:'',text,explanation:'',sourcePage:l.page,position:{x:l.x,y:l.y,height:l.height},confidence:l.origin==='ocr'?'media':'alta',requiresReview:l.origin==='ocr'&&l.confidence<80,dudoso:l.origin==='ocr'&&l.confidence<80};area.measures.push(measure);}
  else if(measure)measure.text+=(measure.text?' ':'')+l.text;
  else area.introduction+=(area.introduction?'\n\n':'')+l.text;
 }
 const metadata={presentation:front.join('\n\n'),cover:'',backMatter:'',tocEntries:[]};const totalMeasures=areas.reduce((n,a)=>n+a.measures.length,0);
 return {areas,metadata,stats:{totalAreas:areas.length,totalMeasures,totalSubareas:0,requiresReviewCount:areas.flatMap(a=>a.measures).filter(m=>m.requiresReview).length},lines};
}
module.exports={bullet,overlapping,nativeLines,structure,fontIsBold};
