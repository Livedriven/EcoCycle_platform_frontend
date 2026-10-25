import { API_URL, API_TIMEOUT } from "./config";
import { endSession, FORBIDDEN_URL } from "./session";

let redirecionando = false;

function abrirPaginaErro(destino) {
    if (redirecionando) return;
    redirecionando = true;
    if (destino.endsWith('/unavailable.html')) {
        const retorno = location.pathname + location.search + location.hash;
        destino += '?' + new URLSearchParams({ retorno });
    }
    location.replace(destino);
}

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
async function requisitar(metodo, url, corpo, { erroLocal = false } = {}) {
    const req = padronizarRequisicao(metodo, url, corpo);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
    let respostaRecebida = false;

    try {
        const resp = await fetch(req.url, { ...req.opcoes, signal: ctrl.signal });
        respostaRecebida = true;

        if (resp.status === 401 && req.opcoes.headers.Authorization) {
            endSession("expirada");
            throw new Error('HTTP 401');
        }

        if (resp.status === 403) {
            abrirPaginaErro(FORBIDDEN_URL);
            throw new Error('Você não tem permissão para acessar estes dados.');
        }

        if (!erroLocal && resp.status === 404) {
            abrirPaginaErro('/src/features/errors/404.html');
        } else if (!erroLocal && resp.status >= 500 && resp.status <= 599) {
            abrirPaginaErro('/src/features/errors/unavailable.html');
        }

        if (!resp.ok) {
            throw new Error('HTTP ' + resp.status);
        }

        // Status 204 significa "No Content", não tentamos ler o JSON.
        return resp.status === 204 ? null : await resp.json();

    } catch (erro) {
        let msg = erro.message; // Ex: 'HTTP 404', 'HTTP 500'...

        if (erro.name === 'AbortError') {
            msg = `A API demorou para responder (limite de ${API_TIMEOUT / 1000} segundos).`;
            if (!erroLocal) abrirPaginaErro('/src/features/errors/unavailable.html');
        } else if (erro.name === 'TypeError' && !respostaRecebida) {
            msg = 'Não foi possível conectar à API. Confira se o servidor está rodando.';
            if (!erroLocal) abrirPaginaErro('/src/features/errors/unavailable.html');
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
    GET: (url, opcoes) => requisitar('GET', url, undefined, opcoes),
    POST: (url, corpo) => requisitar('POST', url, corpo),
    PUT: (url, corpo) => requisitar('PUT', url, corpo),
    PATCH: (url, corpo) => requisitar('PATCH', url, corpo),
    DELETE: (url) => requisitar('DELETE', url)
};

export default API;
