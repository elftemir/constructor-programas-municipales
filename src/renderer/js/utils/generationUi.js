(() => {
  const ENGINES=new Set(['ia-gpu','ia-cpu','sin-ia']);
  const methods=new Set(['aiSuggestTitles','aiAdaptMeasure','aiDevelopMeasure','aiImproveWriting','aiCorrectText','aiSummarizeText','aiTranslateText','aiTranslateStructuredText','aiDraftPresentation','aiDraftAreaIntro','aiSuggestHighlight','aiDraftClosing','aiReviewText']);
  const ui={state:{engine:'sin-ia',modelName:null},availability:null,lastShownEngine:null,lastFailure:null,labels:new WeakMap(),bannerOpen:false,banner:null,
    valid(source){return source&&ENGINES.has(source.engine);},
    label(source){return window.i18n.t(source.labelOnly&&source.engine==='sin-ia'?'generation.translation_label':source.engine==='ia-gpu'?'generation.gpu_label':source.engine==='ia-cpu'?'generation.cpu_label':'generation.no_ai_label');},
    acceptAvailability(value){
      if(!value||typeof value.available!=='boolean'||!this.valid(value))return;
      this.availability={...value};this.refresh();
    },
    refresh(){
      const button=document.querySelector('#generation-engine-indicator');
      if(button){const available=this.availability;button.textContent=window.i18n.t('generation.indicator')+' '+window.i18n.t(!available?'generation.checking':!available.available?'generation.no_ai_short':available.engine==='ia-gpu'?'generation.available_gpu':'generation.available_cpu',{model:available?.modelName||''});}
      if(this.bannerOpen)this.renderBanner();
      const retired=document.querySelector('#retired-model-banner');
      if(this.retirementShown&&retired?.children.length===4)['generation.retired_model','generation.download_quality','generation.delete_retired','generation.understood'].forEach((key,index)=>{retired.children[index].textContent=window.i18n.t(key);});
    },
    renderBanner(){
      const box=document.querySelector('#generation-banner');if(!box)return;
      box.replaceChildren();const text=document.createElement('span');
      text.textContent=window.i18n.t(this.banner.key,{model:this.banner.modelName||''});
      const button=document.createElement('button');button.className='btn small';button.textContent=window.i18n.t('generation.understood');button.addEventListener('click',()=>{this.bannerOpen=false;box.hidden=true;});
      box.append(text,button);box.hidden=false;
    },
    showBanner(key,modelName){this.banner={key,modelName};this.bannerOpen=true;this.refresh();},
    consume(response){
      this.acceptAvailability(response?.availability);
      if(response?.ok===false){
        if(['INVALID_GENERATION','GENERATION_FAILED','INFERENCE_ERROR','TIMEOUT'].includes(response.error?.code))this.showBanner('generation.failed_retry',this.availability?.modelName);
        return;
      }
      if(this.valid(response?.generation))this.acceptSource(response.generation,true);
    },
    acceptSource(source,generated=false){
      if(!this.valid(source)||source.labelOnly)return;
      this.state={engine:source.engine,modelName:source.modelName||null};
      const failed=source.fallbackReason==='gpu-failed'||source.fallbackReason==='ai-failed';
      if(failed){
        const failure=[source.fallbackReason,source.engine,source.modelName||''].join(':');
        if(failure!==this.lastFailure){this.lastFailure=failure;this.lastShownEngine=source.engine;
          this.showBanner(source.engine==='sin-ia'&&this.availability?.available?'generation.failed_fallback':source.engine==='ia-cpu'?'generation.cpu_banner':'generation.no_ai_banner',source.modelName||this.availability?.modelName);}
      }else{
        this.lastFailure=null;
        if(generated&&this.lastShownEngine===null){this.lastShownEngine=source.engine;
          this.showBanner(source.engine==='sin-ia'&&this.availability?.available?'generation.failed_fallback':source.engine==='ia-gpu'?'generation.gpu_banner':source.engine==='ia-cpu'?'generation.cpu_banner':'generation.no_ai_banner',source.modelName||this.availability?.modelName);}
      }this.refresh();
    },
    consumeBackendState(value){this.acceptAvailability(value?.availability);if(value?.retirementNotice)this.showRetirement(value.retirementNotice);if(value?.status==='gpu-failed'&&this.availability?.available)this.acceptSource({engine:'ia-cpu',modelName:this.availability.modelName,fallbackReason:'gpu-failed'});},
    showRetirement(notice){
      const box=document.querySelector('#retired-model-banner');if(!box||this.retirementShown)return;
      this.retirementShown=true;box.replaceChildren();const text=document.createElement('span');text.textContent=window.i18n.t('generation.retired_model');
      const download=document.createElement('button');download.className='btn small';download.textContent=window.i18n.t('generation.download_quality');
      download.addEventListener('click',async()=>{window.App.navigateTo('ia');download.disabled=true;try{await window.api.aiInstallModel(notice.replacementModelId);this.consumeBackendState(await window.api.aiBackendState());}catch(error){window.alert(error.message);}finally{download.disabled=false;}});
      const remove=document.createElement('button');remove.className='btn small';remove.textContent=window.i18n.t('generation.delete_retired');remove.addEventListener('click',async()=>{if(window.confirm(window.i18n.t('generation.confirm_delete_retired'))){await window.api.aiDeleteModel(notice.retiredModelId);remove.disabled=true;}});
      const close=document.createElement('button');close.className='btn small';close.textContent=window.i18n.t('generation.understood');close.addEventListener('click',()=>{box.hidden=true;});box.append(text,download,remove,close);box.hidden=false;
      window.api.aiBackendState({ackRetirement:true}).catch(error=>console.warn('[AI retirement]',error.message));
    },
    markResult(response,element){
      if(!element||!this.valid(response?.generation)||response?.ok===false)return;
      this.labels.get(element)?.remove();const badge=document.createElement('span');badge.className='generation-engine-label';
      badge.textContent='✦ '+this.label(response.generation);badge.title=response.generation.modelName||window.i18n.t('generation.no_ai_label');
      element.insertAdjacentElement('beforebegin',badge);this.labels.set(element,badge);
    },
    async recommendCatalan(params={}){
      if(this.catalanRecommendationShown||(params.idioma_salida||params.idioma||params.language)!=='ca')return;
      const diagnostic=await window.api.aiGetDiagnostic();if(diagnostic.activeModelId!=='qwen2.5-1.5b-instruct-q4')return;
      const models=await window.api.aiGetModels();if(!models.some(model=>model.id===diagnostic.activeModelId&&model.instalado))return;
      this.catalanRecommendationShown=true;const box=document.createElement('div');box.className='notice warning';box.id='catalan-model-banner';
      const label=document.createElement('span');label.textContent=window.i18n.t('generation.catalan_quality');const action=document.createElement('button');action.className='btn small';
      const model=models.find(m=>m.id==='qwen3-4b-instruct-2507-q4');action.textContent=window.i18n.t(model?.instalado?'generation.activate_quality':'generation.download_quality');
      action.onclick=async()=>{action.disabled=true;try{const app=typeof App!=='undefined'?App:window.App;await app.navigateTo('ia');if(!model?.instalado)await window.api.aiInstallModel('qwen3-4b-instruct-2507-q4');await window.api.aiSetActiveModel('qwen3-4b-instruct-2507-q4');box.remove();}catch(error){window.alert(error.message);action.disabled=false;}};
      const close=document.createElement('button');close.className='btn small';close.textContent=window.i18n.t('generation.understood');close.onclick=()=>box.remove();box.append(label,action,close);document.querySelector('#generation-banner')?.insertAdjacentElement('afterend',box);
    },
    async init(){
      document.querySelector('#generation-engine-indicator')?.addEventListener('click',()=>window.App.navigateTo('configuracion',{focusSection:'ia'}));
      this.refresh();
      if(window.api.aiBackendState)this.consumeBackendState(await window.api.aiBackendState());
      window.api.onAiBackendState?.(state=>this.consumeBackendState(state));
    }
  };
  window.GenerationUi=ui;
  window.GenerationApi=new Proxy({},{get(target,key){const value=window.api[key];if(!methods.has(key)||typeof value!=='function')return value;
    return async(...args)=>{if(!key.startsWith('aiTranslate')&&key!=='aiReviewText'){try{await ui.recommendCatalan(args[0]);}catch(error){console.warn('[AI recommendation]',error.message);}}const response=await value(...args);if(response?.error?.code!=='CANCELLED')ui.consume(response);return response;};}});
})();
