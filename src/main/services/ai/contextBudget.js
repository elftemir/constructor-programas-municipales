function post(endpoint,route,payload){return require('./localHttp').localJson(endpoint,route,payload,{timeout:15000}).catch(error=>{error.route=route;throw error;});}
async function checkContextBudget(endpoint, messages, outputTokens, lang = 'es', contextSize = 4096) {
  const template = await post(endpoint, '/apply-template', { messages });
  if (typeof template?.prompt !== 'string') throw Object.assign(new Error('Plantilla del modelo no válida.'),{code:'INVALID_TEMPLATE'});
  const result = await post(endpoint, '/tokenize', { content: template.prompt, add_special: true, parse_special: true });
  if (!Array.isArray(result?.tokens)) throw Object.assign(new Error('Recuento de tokens no disponible.'),{code:'INVALID_TOKEN_COUNT'});
  // Reserve template/response framing as well as the whole requested response.
  if (result.tokens.length + outputTokens + 128 > contextSize) {
    const err = new Error(lang === 'ca' ? `El text i el context superen el límit de ${contextSize} tokens. Redueix el text o les prioritats i torna-ho a provar.` : `El texto y el contexto superan el límite de ${contextSize} tokens. Reduce el texto o las prioridades y vuelve a intentarlo.`);
    err.code = 'CONTEXT_TOO_LONG'; err.promptTokens=result.tokens.length;err.requiredContext=result.tokens.length+outputTokens+128;throw err;
  }
  return result.tokens.length;
}
module.exports = { checkContextBudget };
