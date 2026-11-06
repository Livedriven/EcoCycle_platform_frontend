import { API_URL, API_TIMEOUT } from "./config";
import { endSession, FORBIDDEN_URL } from "./session";
import { rotaApi, ROTAS_API, rotaPublica, normalizarResposta } from './api-contract.js';
import { criarSincronizador, envioProtegido, contextoAtual } from './offline-sync.js';

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
 * POST e PATCH enviam corpo em JSON quando informado; GET nunca envia corpo.
 */
function padronizarRequisicao(metodo, url, corpo, autenticada) {
    const m = String(metodo || 'GET').toUpperCase();
    const token = autenticada ? sessionStorage.getItem('token') : null;

    const opcoes = {
        method: m,
        cache: 'no-store',
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
async function requisitarRede(metodo, url, corpo, { erroLocal = false, sincronizacao = false, chaveEnvio, consultandoCache = false } = {}) {
    if (!ROTAS_API[rotaApi(url)]?.includes(metodo)) {
        throw new Error(`Operação não disponível na API: ${metodo} ${url}`);
    }
    const autenticada = !rotaPublica(url);
    const req = padronizarRequisicao(metodo, url, corpo, autenticada);
    // Query param evita exigir um novo cabeçalho no CORS da API existente.
    // O backend deve deduplicar atomicamente por usuário + chave (ver docs/shared/api.md).
    if (chaveEnvio) req.url += (req.url.includes('?') ? '&' : '?') + new URLSearchParams({ idempotency_key: chaveEnvio });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
    let respostaRecebida = false;
    let status;

    try {
        const resp = await fetch(req.url, { ...req.opcoes, signal: ctrl.signal });
        respostaRecebida = true;
        status = resp.status;

        if (resp.status === 401 && req.opcoes.headers.Authorization) {
            if (!sincronizacao) endSession("expirada");
            throw new Error('HTTP 401');
        }

        if (resp.status === 403) {
            if (!sincronizacao) abrirPaginaErro(FORBIDDEN_URL);
            throw new Error('Você não tem permissão para acessar estes dados.');
        }

        if (!erroLocal && resp.status === 404) {
            abrirPaginaErro('/src/features/errors/404.html');
        } else if (!erroLocal && resp.status >= 500 && resp.status <= 599) {
            abrirPaginaErro('/src/features/errors/unavailable.html');
        }

        if (!resp.ok) {
            if (resp.status >= 500 && resp.status <= 599) {
                throw new Error('O serviço está temporariamente indisponível. Tente novamente em alguns instantes.');
            }
            if (resp.status === 422) {
                const corpoErro = await Promise.resolve().then(() => resp.json()).catch(() => null);
                if (typeof corpoErro?.detail === 'string') throw new Error(corpoErro.detail);
            }
            throw new Error('HTTP ' + resp.status);
        }

        if (resp.status === 204) return null;
        try {
            return normalizarResposta(metodo, url, await resp.json());
        } catch (erro) {
            // Se a conexão cair após os cabeçalhos 2xx, o backend já confirmou.
            // A perda dos detalhes da resposta não deve repetir o cadastro.
            if (sincronizacao) return null;
            throw erro;
        }

    } catch (erro) {
        let msg = erro.message; // Ex: 'HTTP 404', 'HTTP 500'...

        if (erro.name === 'AbortError') {
            msg = `A API demorou para responder (limite de ${API_TIMEOUT / 1000} segundos).`;
            if (!erroLocal && !consultandoCache) abrirPaginaErro('/src/features/errors/unavailable.html');
        } else if (erro.name === 'TypeError' && !respostaRecebida) {
            msg = 'Não foi possível conectar à API. Confira se o servidor está rodando.';
            if (!erroLocal && !consultandoCache) abrirPaginaErro('/src/features/errors/unavailable.html');
        }

        throw Object.assign(new Error(msg, { cause: erro }), {
            status, transporte: !respostaRecebida && (erro.name === 'AbortError' || erro.name === 'TypeError'),
        });

    } finally {
        clearTimeout(timer);
    }
}

export const sincronizacao = criarSincronizador({
    enviar: requisitarRede,
    sondar: () => requisitarRede('GET', '/health/database', undefined, { erroLocal: true, sincronizacao: true }),
});

async function requisitar(metodo, url, corpo, opcoes = {}) {
    if (!ROTAS_API[rotaApi(url)]?.includes(metodo)) {
        throw new Error(`Operação não disponível na API: ${metodo} ${url}`);
    }
    if (envioProtegido(metodo, url)) return sincronizacao.executar(metodo, url, corpo, opcoes);
    if (metodo !== 'GET' || rotaPublica(url) || opcoes.tempoReal) return requisitarRede(metodo, url, corpo, opcoes);
    const contexto = contextoAtual();

    if (globalThis.navigator?.onLine === false) {
        const cache = await sincronizacao.cache(url, contexto);
        if (cache) return cache.dados;
        throw new Error('Sem conexão e sem dados salvos para esta consulta.');
    }
    try {
        const dados = await requisitarRede(metodo, url, corpo, { ...opcoes, consultandoCache: true });
        if (contexto?.escopo !== contextoAtual()?.escopo) throw new Error('A sessão mudou durante a consulta.');
        await sincronizacao.guardarCache(url, dados, contexto);
        return dados;
    } catch (erro) {
        if (erro.transporte) {
            const cache = await sincronizacao.cache(url, contexto);
            if (cache) return cache.dados;
            if (!opcoes.erroLocal) abrirPaginaErro('/src/features/errors/unavailable.html');
        }
        throw erro;
    }
}

/**
 * Interface pública da API
 */
const API = {
    GET: (url, opcoes) => requisitar('GET', url, undefined, opcoes),
    POST: (url, corpo, opcoes) => requisitar('POST', url, corpo, opcoes),
    PATCH: (url, corpo, opcoes) => requisitar('PATCH', url, corpo, opcoes)
};

export default API;
