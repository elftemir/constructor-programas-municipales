const http=require('http');
function localJson(endpoint,route,payload=null,options={}){
 const url=new URL(route,endpoint);if(url.hostname!=='127.0.0.1')throw Error('Inference must remain on loopback');
 const timeout=options.timeout||15000,maxBytes=options.maxBytes||1024*1024;
 return new Promise((resolve,reject)=>{
  let done=false,received=0,response;const body=payload===null?null:JSON.stringify(payload);
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
  const req=http.request(url,{method:body===null?'GET':'POST',headers:body===null?{}:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
   response=res;res.setEncoding('utf8');let text='';res.on('data',chunk=>{received+=Buffer.byteLength(chunk,'utf8');if(received>maxBytes)return abortWith('RESPONSE_TOO_LARGE');text+=chunk;});
   res.on('end',()=>{try{if(res.statusCode!==200)throw Object.assign(Error('Local HTTP '+res.statusCode),{code:'HTTP_ERROR',status:res.statusCode});finish(null,JSON.parse(text));}catch(error){if(error instanceof SyntaxError)error.code='INVALID_JSON';finish(error);}});
   res.on('aborted',()=>finish(Object.assign(Error('Local response aborted'),{code:'ECONNRESET'})));res.on('error',error=>finish(error));
  });
  const abortWith=code=>{const error=Object.assign(Error(code),{code});req.destroy(error);response?.destroy(error);finish(error);};
  const abort=()=>abortWith('ABORTED'),timer=setTimeout(()=>abortWith('TIMEOUT'),timeout);
  req.on('error',error=>finish(error));if(options.signal?.aborted)return abort();options.signal?.addEventListener('abort',abort,{once:true});req.end(body);
 });
}
module.exports={localJson};
