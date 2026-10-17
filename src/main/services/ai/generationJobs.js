const jobs=new Map();
function key(senderId,id){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw TypeError('Invalid generation request ID');return senderId+':'+id;}
async function run(senderId,params,callback){
 if(!params?.generationRequestId)return callback(params);
 const id=key(senderId,params.generationRequestId);if(jobs.has(id))throw Error('Generation request already running');
 const controller=new AbortController();jobs.set(id,controller);
 try{return await callback({...params,_generationSignal:controller.signal});}finally{jobs.delete(id);}
}
function cancel(senderId,request){const id=key(senderId,request?.generationRequestId),controller=jobs.get(id);controller?.abort();return {cancelled:Boolean(controller)};}
module.exports={run,cancel};
