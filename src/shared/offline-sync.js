import * as store from './offline-store.js';
import { API_URL, API_TIMEOUT } from './config.js';
import { getSession, decodeToken, endSession } from './session.js';
import { rotaApi } from './api-contract.js';

export function contextoAtual() {
    const sessao = getSession();
    const sub = sessao && decodeToken(sessao.token)?.sub;
    return sub == null ? null : { escopo: JSON.stringify([API_URL, String(sub)]), perfil: sessao.perfil };
}

export function envioProtegido(metodo, url) {
    const rota = rotaApi(url);
    return metodo === 'POST'
        ? ['/materiais', '/fornecedores', '/lotes', '/esteiras', '/producao'].includes(rota)
        : metodo === 'PATCH' && ['/lotes/:id', '/producao/:id', '/alertas/:id'].includes(rota);
}

function descricao(metodo, url, corpo) {
    const entidade = { fornecedores: 'Fornecedor', lotes: 'Lote', producao: 'Produção', materiais: 'Material', esteiras: 'Esteira', alertas: 'Alerta' }[url.split('/')[1]];
    const referencia = corpo?.codigo_lote || corpo?.nome_fornecedor || corpo?.id_lote || url.split('/')[2];
    return `${entidade || 'Registro'}${referencia ? ' ' + referencia : ''} (${metodo === 'POST' ? 'cadastro' : 'atualização'})`;
}

const semInternet = () => globalThis.navigator?.onLine === false;
const SEM_CONFIRMACAO = 'O resultado ficou sem confirmação. Consulte o registro no portal antes de tentar novamente.';
const envioIniciado = (envio) => envio.passos[0]?.iniciado || envio.tentativas > 0;

export function criarSincronizador({ enviar, sondar }) {
    const ouvintes = new Set();
    const aguardando = new Map();
    const usadosDoCache = new Map();
    let emAndamento = null;
    let retomar = false;
    let intervalo;
    let ouvintesGlobais;
    let canal;
    let erroArmazenamento = '';

    function avisarErro(erro) {
        erroArmazenamento = 'Não foi possível acessar o armazenamento local. Mantenha esta página aberta. ' + erro.message;
        void atualizarEstado().catch(() => {});
    }

    function resolver(id, resultado, resposta, erroOriginal) {
        const espera = aguardando.get(id);
        if (!espera) return;
        if (resultado.tipo === 'success') espera.resolve(resposta !== undefined ? resposta : resultado.identificador == null ? null : { id: resultado.identificador });
        else espera.reject(Object.assign(
            resultado.incerto ? new Error(resultado.mensagem, { cause: erroOriginal }) : erroOriginal || new Error(resultado.mensagem),
            { status: resultado.status, parcial: resultado.parcial, incerto: resultado.incerto },
        ));
        aguardando.delete(id);
    }

    async function atualizarEstado() {
        const contexto = contextoAtual();
        let pendentes = [], resultados = [];
        try {
            if (contexto) [pendentes, resultados] = await Promise.all([
                store.listar('envios', contexto.escopo), store.listar('resultados', contexto.escopo),
            ]);
        } catch (erro) {
            erroArmazenamento = 'O armazenamento local está indisponível. Novos envios estão bloqueados. ' + erro.message;
        }
        if (contextoAtual()?.escopo !== contexto?.escopo) return atualizarEstado();
        for (const r of resultados) resolver(r.id, r);
        const estado = {
            offline: semInternet(), pendentes: pendentes.map(({ id, descricao }) => ({ id, descricao })),
            resultados: resultados.sort((a, b) => b.data - a.data),
            cache: [...usadosDoCache.values()].filter((r) => r.escopo === contexto?.escopo && r.perfil === contexto.perfil), erroArmazenamento,
        };
        ouvintes.forEach((ouvinte) => ouvinte(estado));
        return estado;
    }

    async function finalizar(envio, { resposta, falha, incerto = false } = {}) {
        const parcial = Boolean((falha || incerto) && envio.confirmados);
        const primeiraEtapa = parcial ? 'A primeira etapa foi confirmada. ' : '';
        const mensagem = incerto ? primeiraEtapa + SEM_CONFIRMACAO
            : falha ? primeiraEtapa + falha.message : 'Confirmado pelo servidor.';
        const resultado = {
            id: envio.id, escopo: envio.escopo, data: Date.now(), status: falha?.status,
            tipo: incerto || parcial ? 'warning' : falha ? 'danger' : 'success',
            parcial, incerto, identificador: envio.identificador,
            mensagem: `${envio.descricao}. ${mensagem}`,
        };
        if (!await store.concluirEnvio(envio, resultado)) return false;
        resolver(envio.id, resultado, resposta, falha);
        canal?.postMessage(resultado);
        return true;
    }

    async function processar(temLock = false) {
        const contexto = contextoAtual();
        if (!contexto) return;
        const pendentes = (await store.listar('envios', contexto.escopo)).sort((a, b) => a.data - b.data);
        for (const pendente of pendentes) {
            if (contextoAtual()?.escopo !== contexto.escopo) break;
            if (semInternet() && !envioIniciado(pendente)) break;
            // Um Web Lock livre permite retomar imediatamente após recarregar a aba.
            const envio = await store.reservarEnvio(pendente.id, API_TIMEOUT + 60_000, crypto.randomUUID(), temLock);
            if (!envio) break;
            if (envioIniciado(envio)) {
                await finalizar(envio, { incerto: true });
                continue;
            }
            let respostaInicial;
            while (envio.passos.length) {
                const passo = envio.passos[0];
                if (!semInternet() && contextoAtual()?.escopo === contexto.escopo) {
                    // Persiste a tentativa antes do fetch para que recarregar a página não a repita.
                    passo.iniciado = true;
                    if (!await store.atualizarEnvio(envio)) return;
                }
                if (!passo.iniciado || semInternet() || contextoAtual()?.escopo !== contexto.escopo) {
                    // A requisição ainda não foi chamada, portanto a etapa continua na fila.
                    passo.iniciado = false;
                    envio.reservadoAte = 0;
                    await store.atualizarEnvio(envio);
                    return;
                }
                const token = getSession()?.token;
                let resposta;
                let falha;
                try {
                    resposta = await enviar(passo.metodo, passo.url, passo.corpo, {
                        erroLocal: true, sincronizacao: true, chaveEnvio: passo.id,
                    });
                } catch (erro) { falha = erro; }

                if (!falha) {
                    // Não volta a enviar uma etapa já confirmada (ex.: cadastro + status do lote).
                    if (!envio.confirmados) {
                        respostaInicial = resposta;
                        envio.identificador = resposta?.id;
                    }
                    envio.confirmados += 1;
                    envio.passos.shift();
                    if (envio.passos.length) {
                        envio.reservadoAte = Date.now() + API_TIMEOUT + 60_000;
                        if (!await store.atualizarEnvio(envio)) return;
                        continue;
                    }
                }
                if (!await finalizar(envio, { resposta: respostaInicial, falha, incerto: falha?.transporte })) return;
                if (falha?.status === 401 && getSession()?.token === token) endSession('expirada');
                break;
            }
        }
    }

    function sincronizar(forcar = false) {
        if (emAndamento) {
            retomar ||= forcar;
            return emAndamento;
        }
        emAndamento = (async () => {
            try {
                const contexto = contextoAtual();
                if (globalThis.navigator?.locks && contexto) {
                    await navigator.locks.request('ecocycle-sync:' + contexto.escopo, { ifAvailable: true },
                        (lock) => lock ? processar(true) : undefined);
                } else await processar();
            } catch (erro) { avisarErro(erro); }
            try { await atualizarEstado(); }
            finally { emAndamento = null; }
            if (retomar) {
                retomar = false;
                return sincronizar(true);
            }
        })();
        return emAndamento;
    }

    async function executar(metodo, url, corpo, { aposConfirmar = [] } = {}) {
        if (semInternet()) throw new Error('Sem conexão. Conecte-se à internet antes de iniciar um cadastro ou uma atualização.');
        const contexto = contextoAtual();
        if (!contexto) throw new Error('Entre novamente para enviar os dados com segurança.');
        // onLine sozinho não prova acesso à internet (por exemplo, Wi-Fi sem saída).
        try { await sondar(); }
        catch (erro) { throw new Error('Não foi possível confirmar a conexão com a API. O envio não foi iniciado. Seus campos foram mantidos; tente novamente quando a conexão voltar.', { cause: erro }); }
        if (contextoAtual()?.escopo !== contexto.escopo) throw new Error('A sessão mudou. Entre novamente antes de enviar.');
        const passos = [{ metodo, url, corpo }, ...aposConfirmar];
        if (passos.some((p) => !envioProtegido(p.metodo, p.url))) throw new Error('Etapa de envio não permitida.');
        let envio;
        try {
            const resumo = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(passos)));
            const assinatura = Array.from(new Uint8Array(resumo), (n) => n.toString(16).padStart(2, '0')).join('');
            envio = await store.guardarEnvio({
                id: crypto.randomUUID(), escopo: contexto.escopo, descricao: descricao(metodo, url, corpo),
                assinatura, data: Date.now(), confirmados: 0,
                passos: passos.map((p) => ({ ...p, id: crypto.randomUUID() })),
            });
            erroArmazenamento = '';
        } catch (erro) {
            avisarErro(erro);
            throw new Error('Não foi possível salvar uma cópia segura neste navegador. Nenhum dado foi enviado. Mantenha o formulário aberto e tente novamente.', { cause: erro });
        }
        let espera = aguardando.get(envio.id);
        if (!espera) {
            espera = {};
            espera.promise = new Promise((resolve, reject) => Object.assign(espera, { resolve, reject }));
            aguardando.set(envio.id, espera);
        }
        void sincronizar(true);
        return espera.promise;
    }

    return {
        executar, sincronizar, atualizarEstado,
        assinar(ouvinte) { ouvintes.add(ouvinte); return () => ouvintes.delete(ouvinte); },
        async dispensar(id) { await store.dispensarResultado(id); await atualizarEstado(); },
        async cache(url, contextoEsperado = contextoAtual()) {
            const contexto = contextoAtual();
            if (!contexto || contexto.escopo !== contextoEsperado?.escopo || contexto.perfil !== contextoEsperado?.perfil) return null;
            const registro = await store.lerCache(contexto.escopo, contexto.perfil, url).catch(() => null);
            const atual = contextoAtual();
            if (atual?.escopo !== contexto.escopo || atual.perfil !== contexto.perfil) return null;
            if (registro) {
                usadosDoCache.set(url, { url, data: registro.data, ...contexto });
                void atualizarEstado();
            }
            return registro;
        },
        async guardarCache(url, dados, contextoEsperado = contextoAtual()) {
            const contexto = contextoAtual();
            if (!contexto || contexto.escopo !== contextoEsperado?.escopo || contexto.perfil !== contextoEsperado?.perfil) return;
            await store.gravarCache(contexto.escopo, contexto.perfil, url, dados).catch(avisarErro);
            usadosDoCache.delete(url);
            void atualizarEstado();
        },
        iniciar() {
            if (intervalo) return;
            ouvintesGlobais = new AbortController();
            const { signal } = ouvintesGlobais;
            if (typeof BroadcastChannel === 'function') {
                canal = new BroadcastChannel('ecocycle-sync-resultados');
                canal.onmessage = ({ data }) => {
                    if (!data || data.escopo !== contextoAtual()?.escopo) return;
                    resolver(data.id, data);
                    void atualizarEstado();
                };
            }
            globalThis.addEventListener?.('online', () => { void sincronizar(true); }, { signal });
            globalThis.addEventListener?.('offline', () => { void atualizarEstado(); }, { signal });
            globalThis.addEventListener?.('pageshow', () => { void sincronizar(); }, { signal });
            globalThis.document?.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') void sincronizar();
            }, { signal });
            intervalo = setInterval(() => { void sincronizar(); }, 15_000);
            void sincronizar(true);
        },
        parar() { clearInterval(intervalo); intervalo = null; ouvintesGlobais?.abort(); canal?.close(); canal = null; },
    };
}
