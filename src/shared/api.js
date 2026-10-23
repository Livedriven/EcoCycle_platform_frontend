import { API_URL, API_TIMEOUT } from "./config";
import { endSession } from "./session";


/**
 * PADRONIZADORA
 * Recebe método, URL e corpo (opcional) e devolve a URL completa + as opções do fetch.
 * Só métodos com corpo (POST, PUT, PATCH, DELETE) enviam body; GET e HEAD nunca enviam.
 */
function padronizarRequisicao(metodo, url, corpo) {
    const m = String(metodo || 'GET').toUpperCase();
    const token = sessionStorage.getItem('token');

    const opcoes = {
        method: m,
        headers: {
            'Accept': 'application/json'
        }
    };

    const semCorpo = m === 'GET' || m === 'HEAD';

    if (token) {
        opcoes.headers['Authorization'] = 'Bearer ' + token;
    }

    if (!semCorpo && corpo !== undefined && corpo !== null) {
        opcoes.headers['Content-Type'] = 'application/json';
        opcoes.body = JSON.stringify(corpo);
    }

    return {
        url: API_URL + url,
        opcoes
    };
}

/**
 * REQUISIÇÃO
 * Chama a padronizadora, faz o fetch e devolve o JSON. Lança erro se falhar.
 */
async function requisitar(metodo, url, corpo) {
    const req = padronizarRequisicao(metodo, url, corpo);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);

    try {
        const resp = await fetch(req.url, { ...req.opcoes, signal: ctrl.signal });

        if (resp.status === 401 && req.opcoes.headers.Authorization) {
            endSession("expirada");
        }

        if (!resp.ok) {
            throw new Error('HTTP ' + resp.status);
        }

        // Status 204 significa "No Content", não tentamos ler o JSON.
        return resp.status === 204 ? null : await resp.json();

    } catch (erro) {
        let msg = erro.message; // Ex: 'HTTP 404', 'HTTP 500'...

        if (erro.name === 'AbortError') {
            msg = 'A API demorou para responder (limite de 8 segundos).';
        } else if (erro.name === 'TypeError') {
            msg = 'Não foi possível conectar à API. Confira se o servidor está rodando.';
        }

        throw new Error(msg, { cause: erro });

    } finally {
        clearTimeout(timer);
    }
}

/**
 * Interface pública da API
 */
const API = {
    GET: (url) => requisitar('GET', url),
    POST: (url, corpo) => requisitar('POST', url, corpo),
    PUT: (url, corpo) => requisitar('PUT', url, corpo),
    PATCH: (url, corpo) => requisitar('PATCH', url, corpo),
    DELETE: (url) => requisitar('DELETE', url)
};

export default API;