import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

vi.mock('./config.js', () => ({ API_URL: 'https://api.example.test', API_TIMEOUT: 100 }));

let store, criarSincronizador, contextoAtual, saveSession, syncs;
function entrar(sub = '7', perfil = 'gerente', exp = Date.now() / 1000 + 3600) {
    const payload = Buffer.from(JSON.stringify({ sub, perfil, nome: 'Teste', exp })).toString('base64url');
    saveSession('eyJhbGciOiJIUzI1NiJ9.' + payload + '.assinatura');
}
const redeCaiu = () => Object.assign(new TypeError('Falha de rede'), { transporte: true });
function criar(enviar = vi.fn().mockResolvedValue({ id: 42 }), sondar = vi.fn().mockResolvedValue({ status: 'ok' })) {
    const sync = criarSincronizador({ enviar, sondar });
    syncs.push(sync);
    return { sync, enviar, sondar };
}
async function envios() { return store.listar('envios', contextoAtual().escopo); }
async function resultados() { return store.listar('resultados', contextoAtual().escopo); }
async function criarPendente() {
    const cliente = criar(undefined, vi.fn(async () => { navigator.onLine = false; }));
    const promessa = cliente.sync.executar('POST', '/lotes', { codigo_lote: 'L2' });
    await vi.waitFor(async () => expect(await envios()).toHaveLength(1));
    await cliente.sync.sincronizar();
    return { ...cliente, promessa };
}

beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('location', { replace: vi.fn() });
    const memoria = new Map();
    vi.stubGlobal('sessionStorage', {
        getItem: (k) => memoria.get(k) ?? null,
        setItem: (k, v) => memoria.set(k, v), removeItem: (k) => memoria.delete(k),
    });
    const eventos = new EventTarget();
    vi.stubGlobal('addEventListener', eventos.addEventListener.bind(eventos));
    vi.stubGlobal('dispatchEvent', eventos.dispatchEvent.bind(eventos));
    store = await import('./offline-store.js');
    ({ criarSincronizador, contextoAtual } = await import('./offline-sync.js'));
    ({ saveSession } = await import('./session.js'));
    entrar();
    syncs = [];
});

afterEach(() => {
    syncs.forEach((sync) => sync.parar());
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('envios duráveis em IndexedDB', () => {
    it('bloqueia cadastro iniciado offline, sem salvar nem chamar a API', async () => {
        navigator.onLine = false;
        const { sync, enviar, sondar } = criar();
        await expect(sync.executar('POST', '/lotes', { codigo_lote: 'L1' })).rejects.toThrow('antes de iniciar');
        expect(await envios()).toEqual([]);
        expect(enviar).not.toHaveBeenCalled();
        expect(sondar).not.toHaveBeenCalled();
    });

    it('bloqueia Wi-Fi sem acesso à API, mesmo com onLine=true', async () => {
        const { sync, enviar } = criar(undefined, vi.fn().mockRejectedValue(redeCaiu()));
        await expect(sync.executar('POST', '/lotes', {})).rejects.toThrow('envio não foi iniciado');
        expect(await envios()).toEqual([]);
        expect(enviar).not.toHaveBeenCalled();
    });

    it('confirma o COMMIT local antes de enviar e só então remove o payload e salva a confirmação', async () => {
        const { sync } = criar(vi.fn(async () => {
            expect((await envios())[0].passos[0]).toMatchObject({ iniciado: true, corpo: { codigo_lote: 'L1' } });
            return { id: 42 };
        }));
        await expect(sync.executar('POST', '/lotes', { codigo_lote: 'L1' })).resolves.toEqual({ id: 42 });
        expect(await envios()).toEqual([]);
        expect(await resultados()).toEqual([expect.objectContaining({ tipo: 'success', identificador: 42 })]);
        expect(JSON.stringify(await resultados())).not.toContain('codigo_lote');
    });

    it('encerra o envio com aviso de resultado incerto após perder a resposta', async () => {
        const { sync, enviar } = criar(vi.fn().mockRejectedValue(redeCaiu()));
        await expect(sync.executar('POST', '/lotes', { codigo_lote: 'L2' })).rejects.toMatchObject({ incerto: true });
        await sync.sincronizar(true);
        expect(enviar).toHaveBeenCalledTimes(1);
        expect(await envios()).toEqual([]);
        expect((await resultados())[0]).toMatchObject({ tipo: 'warning', incerto: true });
    });

    it('recupera uma fila persistida após recriar os módulos, sem manter a Promise da página anterior', async () => {
        await criarPendente();
        const chave = (await envios())[0].passos[0].id;
        navigator.onLine = true;
        vi.resetModules();
        const modulo = await import('./offline-sync.js');
        const enviar = vi.fn().mockResolvedValue({ id: 9 });
        const restaurado = modulo.criarSincronizador({ enviar, sondar: vi.fn() });
        syncs.push(restaurado);
        await restaurado.sincronizar(true);
        expect(enviar.mock.calls[0][3].chaveEnvio).toBe(chave);
        expect(await envios()).toEqual([]);
        expect((await restaurado.atualizarEstado()).resultados[0].tipo).toBe('success');
    });

    it.each([400, 403, 404, 409, 422, 500])('remove payload após HTTP %s e preserva o aviso de erro até ser dispensado', async (status) => {
        const { sync, enviar } = criar(vi.fn().mockRejectedValue(Object.assign(new Error('HTTP ' + status), { status })));
        await expect(sync.executar('POST', '/lotes', {})).rejects.toThrow('HTTP ' + status);
        expect(await envios()).toEqual([]);
        const [resultado] = await resultados();
        expect(resultado).toMatchObject({ tipo: 'danger', status });
        await sync.sincronizar(true);
        expect(enviar).toHaveBeenCalledTimes(1);
        await sync.dispensar(resultado.id);
        expect(await resultados()).toEqual([]);
    });

    it('não salva JWT ou credenciais e retoma somente com o mesmo usuário', async () => {
        const { sync, enviar, promessa } = await criarPendente();
        navigator.onLine = true;
        const escopo = contextoAtual().escopo;
        expect(JSON.stringify(await envios())).not.toContain(sessionStorage.getItem('token'));
        entrar('8');
        await sync.sincronizar(true);
        expect(enviar).not.toHaveBeenCalled();
        expect((await sync.atualizarEstado()).pendentes).toEqual([]);
        expect(await store.listar('envios', escopo)).toHaveLength(1);
        entrar('7');
        await sync.sincronizar(true);
        await expect(promessa).resolves.toEqual({ id: 42 });
    });

    it('registra o HTTP 401 antes de encerrar a sessão e não reenvia após o login', async () => {
        const { sync, enviar } = criar(vi.fn().mockRejectedValue(Object.assign(new Error('HTTP 401'), { status: 401 })));
        const escopo = contextoAtual().escopo;
        await expect(sync.executar('POST', '/lotes', {})).rejects.toMatchObject({ status: 401 });
        await vi.waitFor(() => expect(location.replace).toHaveBeenCalledWith(expect.stringContaining('expirada')));
        expect(await store.listar('envios', escopo)).toEqual([]);
        entrar();
        await sync.sincronizar(true);
        expect(enviar).toHaveBeenCalledTimes(1);
        expect((await resultados())[0]).toMatchObject({ tipo: 'danger', status: 401 });
    });

    it('preserva as etapas da produção e retoma só o status do lote após a queda', async () => {
        const { sync, enviar } = criar(vi.fn().mockImplementationOnce(async () => {
            navigator.onLine = false;
            return { id: 6 };
        }).mockResolvedValue({ id: 1 }));
        const promessa = sync.executar('POST', '/producao', { id_lote: 1 }, {
            aposConfirmar: [{ metodo: 'PATCH', url: '/lotes/1', corpo: { status_lote: 'Em processamento' } }],
        });
        await vi.waitFor(async () => expect((await envios())[0]?.confirmados).toBe(1));
        await sync.sincronizar();
        const [pendente] = await envios();
        expect(pendente.passos).toHaveLength(1);
        expect(pendente.passos[0].url).toBe('/lotes/1');
        navigator.onLine = true;
        await sync.sincronizar(true);
        await expect(promessa).resolves.toEqual({ id: 6 });
        expect(enviar.mock.calls.map((c) => c[1])).toEqual(['/producao', '/lotes/1']);
    });

    it('sinaliza erro parcial se o cadastro existe mas o backend rejeita a etapa seguinte', async () => {
        const { sync } = criar(vi.fn().mockResolvedValueOnce({ id: 6 }).mockRejectedValue(Object.assign(new Error('HTTP 422'), { status: 422 })));
        await expect(sync.executar('POST', '/producao', { id_lote: 1 }, {
            aposConfirmar: [{ metodo: 'PATCH', url: '/lotes/1', corpo: {} }],
        })).rejects.toMatchObject({ parcial: true, status: 422 });
        expect(await envios()).toEqual([]);
        expect((await resultados())[0]).toMatchObject({ parcial: true });
    });

    it('não envia simultaneamente a mesma operação em duas abas', async () => {
        let concluir;
        const enviar = vi.fn(() => new Promise((resolve) => { concluir = resolve; }));
        const { sync } = criar(enviar);
        const segundaAba = criar(enviar).sync;
        const promessa = sync.executar('POST', '/lotes', { codigo_lote: 'L4' });
        await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
        await segundaAba.sincronizar(true);
        expect(enviar).toHaveBeenCalledTimes(1);
        concluir({ id: 5 });
        await promessa;
    });

    it('retoma uma reserva abandonada quando seu prazo vence', async () => {
        await criarPendente();
        const [pendente] = await envios();
        await store.reservarEnvio(pendente.id, 1000, 'aba-fechada');
        navigator.onLine = true;
        const { sync: novaAba, enviar } = criar();
        await novaAba.sincronizar(true);
        expect(enviar).not.toHaveBeenCalled();
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
        await novaAba.sincronizar(true);
        expect(enviar).toHaveBeenCalledTimes(1);
    });

    it('recupera a tentativa interrompida ao reabrir a página e exibe o aviso sem repetir o envio', async () => {
        await criarPendente();
        const [pendente] = await envios();
        const tentativa = await store.reservarEnvio(pendente.id, 60_000, 'aba-fechada');
        tentativa.passos[0].iniciado = true;
        await store.atualizarEnvio(tentativa);
        navigator.locks = { request: vi.fn((_nome, _opcoes, callback) => callback({})) };
        const { sync: novaAba, enviar } = criar();
        await novaAba.sincronizar(true);
        expect(enviar).not.toHaveBeenCalled();
        expect(await envios()).toEqual([]);
        expect((await resultados())[0]).toMatchObject({ incerto: true });
    });

    it('não envia nada quando IndexedDB está indisponível', async () => {
        vi.stubGlobal('indexedDB', undefined);
        const { sync, enviar } = criar();
        await expect(sync.executar('POST', '/lotes', {})).rejects.toThrow('Nenhum dado foi enviado');
        expect(enviar).not.toHaveBeenCalled();
    });

    it('retoma automaticamente quando chega o evento online', async () => {
        const { sync, enviar, promessa } = await criarPendente();
        sync.iniciar();
        await sync.sincronizar();
        expect(enviar).not.toHaveBeenCalled();
        navigator.onLine = true;
        dispatchEvent(new Event('online'));
        await expect(promessa).resolves.toEqual({ id: 42 });
        expect(enviar).toHaveBeenCalledTimes(1);
    });
});

describe('cache de consultas', () => {
    it('persiste listas vazias e isola por usuário, perfil e URL completa', async () => {
        const { sync } = criar();
        await sync.guardarCache('/lotes?status=Recebido', []);
        expect((await sync.cache('/lotes?status=Recebido')).dados).toEqual([]);
        expect(await sync.cache('/lotes?status=Finalizado')).toBeNull();
        entrar('8');
        expect(await sync.cache('/lotes?status=Recebido')).toBeNull();
        entrar('7', 'consulta');
        expect(await sync.cache('/lotes?status=Recebido')).toBeNull();
    });

    it('não salva resposta do usuário anterior quando a sessão muda durante o GET', async () => {
        const { sync } = criar();
        const contexto = contextoAtual();
        entrar('8');
        await sync.guardarCache('/lotes', [{ id: 1 }], contexto);
        expect(await sync.cache('/lotes')).toBeNull();
    });

    it('expira os dados em 24 horas e informa a data da cópia usada', async () => {
        const { sync } = criar();
        await sync.guardarCache('/lotes', [{ id: 1 }]);
        await sync.cache('/lotes');
        expect((await sync.atualizarEstado()).cache[0].data).toBeTypeOf('number');
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + store.CACHE_TTL + 1);
        expect(await sync.cache('/lotes')).toBeNull();
    });

    it('limita a quantidade de consultas salvas por usuário', async () => {
        const { sync } = criar();
        for (let i = 0; i < 105; i++) await sync.guardarCache('/lotes?pagina=' + i, []);
        expect(await store.listar('cache', contextoAtual().escopo)).toHaveLength(100);
    });

    it('preserva as consultas salvas independentemente da remoção de um envio confirmado', async () => {
        const { sync } = criar();
        await sync.guardarCache('/lotes', [{ id: 1 }]);
        await sync.executar('POST', '/lotes', { codigo_lote: 'L5' });
        expect((await sync.cache('/lotes')).dados).toEqual([{ id: 1 }]);
        expect(await envios()).toEqual([]);
    });
});

describe('integração HTTP + IndexedDB', () => {
    async function api() {
        const modulo = await import('./api.js');
        syncs.push(modulo.sincronizacao);
        return modulo;
    }
    it('cacheia GET normalizado e recupera os dados na falha de rede, sem redirecionar', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ lotes: [{ id_lote: 1 }] }))));
        const { default: API } = await api();
        await expect(API.GET('/lotes')).resolves.toEqual([expect.objectContaining({ id: 1 })]);
        fetch.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(API.GET('/lotes')).resolves.toEqual([expect.objectContaining({ id: 1 })]);
        expect(location.replace).not.toHaveBeenCalled();
    });

    it('não usa o cache para mascarar erro de permissão', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ lotes: [] }))));
        const { default: API } = await api();
        await API.GET('/lotes');
        fetch.mockResolvedValue(new Response(null, { status: 403 }));
        await expect(API.GET('/lotes')).rejects.toMatchObject({ status: 403 });
        expect(location.replace).toHaveBeenCalledWith(expect.stringContaining('403.html'));
    });

    it('sonda a conexão, envia chave estável na URL e normaliza o resultado confirmado', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(new Response('{}'))
            .mockResolvedValueOnce(new Response(JSON.stringify({ lote: { id_lote: 12 } }), { status: 201 })));
        const { default: API, sincronizacao } = await api();
        await expect(API.POST('/lotes', { codigo_lote: 'L6' })).resolves.toMatchObject({ id: 12 });
        const primeira = fetch.mock.calls[1];
        expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/health/database');
        expect(new URL(primeira[0]).searchParams.get('idempotency_key')).toBeTruthy();
        await sincronizacao.sincronizar(true);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(await envios()).toEqual([]);
    });

    it('registra timeout como resultado incerto sem reenviar o cadastro', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}'))
            .mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
            })));
        const { default: API, sincronizacao } = await api();
        await expect(API.POST('/lotes', { codigo_lote: 'L7' })).rejects.toMatchObject({ incerto: true });
        expect(location.replace).not.toHaveBeenCalled();
        await sincronizacao.sincronizar(true);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(await envios()).toEqual([]);
    });

    it('não reenvia quando já recebeu HTTP 201 e a conexão cai durante a leitura da resposta', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce({
            status: 201, ok: true, json: async () => { throw new TypeError('Resposta interrompida'); },
        }));
        const { default: API, sincronizacao } = await api();
        await expect(API.POST('/lotes', { codigo_lote: 'L8' })).resolves.toBeNull();
        await sincronizacao.sincronizar(true);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(await envios()).toEqual([]);
        expect((await resultados())[0].tipo).toBe('success');
    });
});
