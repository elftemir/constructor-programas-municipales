const http = require('http');
function post(endpoint, route, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(new URL(route, endpoint), { method: 'POST', timeout: 15000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('No se ha podido medir el contexto del modelo local.'));
        try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Tiempo agotado al medir el contexto local.')));
    req.end(body);
  });
}
async function checkContextBudget(endpoint, messages, outputTokens, lang = 'es') {
  const template = await post(endpoint, '/apply-template', { messages });
  if (typeof template.prompt !== 'string') throw new Error('Plantilla del modelo no válida.');
  const result = await post(endpoint, '/tokenize', { content: template.prompt, add_special: true, parse_special: true });
  if (!Array.isArray(result.tokens)) throw new Error('Recuento de tokens no disponible.');
  // Reserve template/response framing as well as the whole requested response.
  if (result.tokens.length + outputTokens + 64 > 4096) {
    const err = new Error(lang === 'ca' ? 'El text i el context superen el límit de 4096 tokens. Redueix el text o les prioritats i torna-ho a provar.' : 'El texto y el contexto superan el límite de 4096 tokens. Reduce el texto o las prioridades y vuelve a intentarlo.');
    err.code = 'CONTEXT_TOO_LONG'; throw err;
  }
  return result.tokens.length;
}
module.exports = { checkContextBudget };
