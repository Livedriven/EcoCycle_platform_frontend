import { API_URL,API_TIMEOUT } from "./config";

// PADRONIZADORA: recebe método, url e corpo (opcional) e devolve a url completa + as opções do fetch.
// Só métodos com corpo (POST, PUT, PATCH, DELETE) enviam body; GET e HEAD nunca enviam.
function padronizarRequisicao(metodo, url, corpo) {
  const m = String(metodo || 'GET').toUpperCase();
  const opcoes = { method: m, headers: { 'Accept': 'application/json' } };
  const semCorpo = m === 'GET' || m === 'HEAD';
  if (!semCorpo && corpo !== undefined && corpo !== null) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  return { url: API_URL + url, opcoes };
}


// REQUISIÇÃO: chama a padronizadora, faz o fetch e devolve o JSON. Lança erro se falhar.
async function requisitar(metodo, url, corpo) {
  const req = padronizarRequisicao(metodo, url, corpo);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
  try {

    const resp = await fetch(req.url, { ...req.opcoes, signal: ctrl.signal });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.status === 204 ? null : await resp.json();

  } catch (erro) {

    let msg = erro.message; // caso comum: 'HTTP 404', 'HTTP 500'...
    if (erro.name === 'AbortError') msg = 'A API demorou para responder (limite de 8 segundos).';
    else if (erro.name === 'TypeError') msg = 'Não foi possível conectar à API. Confira se o servidor está rodando.';
    console.error('Falha na requisição ' + req.opcoes.method + ' ' + req.url + ': ' + msg);
    throw new Error(msg);

  } finally { clearTimeout(timer); }
}


const API = {
  GET:    url          => requisitar('GET', url),
  POST:   (url, corpo) => requisitar('POST', url, corpo),
  PUT:    (url, corpo) => requisitar('PUT', url, corpo),
  PATCH:  (url, corpo) => requisitar('PATCH', url, corpo),
  DELETE: url          => requisitar('DELETE', url)
};

