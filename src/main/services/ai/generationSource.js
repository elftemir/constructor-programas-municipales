// One main-process source of truth; provenance is response metadata, never project data.
const {AsyncLocalStorage}=require('async_hooks');
const context=new AsyncLocalStorage();
let current={engine:'sin-ia',modelName:null,fallbackReason:null};
const valid=new Set(['ia-gpu','ia-cpu','sin-ia']);
function recordFallback(reason){const active=context.getStore();if(active)active.fallbackReason=reason;}
function recordNative(backend,modelId){const active=context.getStore();if(!active)return;active.source={engine:backend==='gpu'?'ia-gpu':'ia-cpu',modelName:active.models?.[modelId]||modelId,fallbackReason:active.fallbackReason||null};}
function recordBuiltin({labelOnly=false,fallbackReason=null}={}){const active=context.getStore();if(active)active.source={engine:'sin-ia',modelName:null,labelOnly,fallbackReason:fallbackReason||active.fallbackReason||null};}
async function run(models,callback){return context.run({models,source:null},async()=>{
 const result=await callback();const source=context.getStore().source||{engine:'sin-ia',modelName:null};
 // Built-in translation is a deliberate route, not loss of the writing engine.
 if(result?.ok!==false&&!source.labelOnly)current={...source};
 return {...result,generation:{...source}};
});}
function getState(){return {...current};}
function transitionToCpu(){if(current.engine==='ia-gpu')current={...current,engine:'ia-cpu',fallbackReason:'gpu-failed'};return getState();}
module.exports={run,recordNative,recordBuiltin,recordFallback,getState,transitionToCpu,valid};
