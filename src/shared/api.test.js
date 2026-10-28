import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config', () => ({ API_URL: 'https://api.example.test', API_TIMEOUT: 1500 }));

let API;
beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('sessionStorage', {
        getItem: vi.fn(() => null),
        removeItem: vi.fn(),
    });
    vi.stubGlobal('location', {
        pathname: '/src/features/batches/batches.html',
        search: '?status=aberto', hash: '#lista', replace: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn());
    API = (await import('./api.js')).default;
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('tratamento de erros da API', () => {
    it('mantém a falha da API real sem tentar outro servidor automaticamente', async () => {
        fetch.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(API.GET('/lotes')).rejects.toThrow('Não foi possível conectar');
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/lotes');
    });
    it.each([['POST', '/login'], ['GET', '/health/database']])('não envia JWT em %s %s, mesmo com sessão', async (metodo, rota) => {
        sessionStorage.getItem.mockReturnValue('jwt-salvo');
        fetch.mockResolvedValue({ status: 200, ok: true, json: async () => ({ status: 'ok' }) });
        await API[metodo](rota);
        expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });
    it('bloqueia rotas antigas e métodos inexistentes antes de chamar o backend', async () => {
        await expect(API.GET('/equipamentos')).rejects.toThrow('Operação não disponível');
        await expect(API.GET('/leituras_sensor')).rejects.toThrow('Operação não disponível');
        await expect(API.POST('/alertas', {})).rejects.toThrow('Operação não disponível');
        await expect(API.PATCH('/fornecedores/1', {})).rejects.toThrow('Operação não disponível');
        await expect(API.PATCH('/producao/abc', {})).rejects.toThrow('Operação não disponível');
        expect(fetch).not.toHaveBeenCalled();
    });
    it('envia PATCH com corpo JSON e JWT e devolve a entidade atualizada', async () => {
        sessionStorage.getItem.mockReturnValue('jwt');
        fetch.mockResolvedValue({ status: 200, ok: true, json: async () => ({ producao: { id_producao: 7, status_producao: 'Finalizado' } }) });
        const corpo = { status_producao: 'Finalizado' };
        await expect(API.PATCH('/producao/7', corpo)).resolves.toMatchObject({ id: 7, status: 'Finalizado' });
        expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/producao/7');
        expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify(corpo), headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' } });
    });
    it('aceita HTTP 201 com envelope do cadastro de lote e envia JSON com JWT', async () => {
        sessionStorage.getItem.mockReturnValue('jwt');
        fetch.mockResolvedValue({ status: 201, ok: true, json: async () => ({ lote: { id_lote: 2 } }) });
        const corpo = { id_fornecedor: 1, codigo_lote: 'L2', status_lote: 'Recebido', peso_recebido_kg: 10 };
        await expect(API.POST('/lotes', corpo)).resolves.toMatchObject({ id: 2 });
        expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify(corpo), headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' } });
    });
    it('envia o access_token salvo como Bearer nas chamadas autenticadas', async () => {
        sessionStorage.getItem.mockReturnValue('jwt-do-backend');
        fetch.mockResolvedValue({ status: 200, ok: true, json: async () => [] });
        await API.GET('/lotes');
        expect(sessionStorage.getItem).toHaveBeenCalledWith('token');
        expect(fetch).toHaveBeenCalledWith('https://api.example.test/lotes', expect.objectContaining({
            headers: { Accept: 'application/json', Authorization: 'Bearer jwt-do-backend' },
        }));
    });
    it.each([
        [403, '403.html'], [404, '404.html'],
        [500, 'unavailable.html'], [502, 'unavailable.html'],
        [503, 'unavailable.html'], [504, 'unavailable.html'],
    ])('encaminha HTTP %s para %s e mantém a rejeição', async (status, pagina) => {
        fetch.mockResolvedValue({ status, ok: false });
        await expect(API.GET('/lotes')).rejects.toThrow();
        const destino = new URL(location.replace.mock.calls[0][0], 'https://ecocycle.test');
        expect(destino.pathname).toBe('/src/features/errors/' + pagina);
        if (status >= 500) {
            expect(destino.searchParams.get('retorno')).toBe(location.pathname + location.search + location.hash);
        }
    });
    it('trata falta de conexão preservando a causa', async () => {
        const causa = new TypeError('Failed to fetch');
        fetch.mockRejectedValue(causa);
        await expect(API.GET('/lotes')).rejects.toMatchObject({ cause: causa });
        expect(location.replace).toHaveBeenCalledWith(expect.stringContaining('/unavailable.html?'));
    });
    it('cancela a requisição no timeout e usa o limite configurado na mensagem', async () => {
        vi.useFakeTimers();
        fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
        }));
        const resultado = expect(API.GET('/lotes')).rejects.toThrow('limite de 1.5 segundos');
        await vi.advanceTimersByTimeAsync(1500);
        await resultado;
        expect(location.replace).toHaveBeenCalledWith(expect.stringContaining('/unavailable.html?'));
    });
    it('encerra a sessão quando recebe 401 com token', async () => {
        sessionStorage.getItem.mockReturnValue('token');
        fetch.mockResolvedValue({ status: 401, ok: false });
        await expect(API.GET('/lotes')).rejects.toThrow('HTTP 401');
        expect(sessionStorage.removeItem).toHaveBeenCalledWith('token');
        expect(location.replace).toHaveBeenCalledWith('/src/features/login/login.html?motivo=expirada');
    });
    it.each([400, 401, 409, 422, 429])('mantém HTTP %s no formulário, sem redirecionar', async (status) => {
        fetch.mockResolvedValue({ status, ok: false });
        await expect(API.POST('/login', {})).rejects.toThrow('HTTP ' + status);
        expect(location.replace).not.toHaveBeenCalled();
    });
    it('redireciona apenas uma vez em falhas simultâneas', async () => {
        fetch.mockResolvedValue({ status: 503, ok: false });
        await Promise.allSettled([API.GET('/lotes'), API.GET('/fornecedores')]);
        expect(location.replace).toHaveBeenCalledTimes(1);
    });
    it('não classifica erro ao ler JSON como falha de conexão', async () => {
        fetch.mockResolvedValue({ status: 200, ok: true, json: () => { throw new TypeError('JSON inválido'); } });
        await expect(API.GET('/lotes')).rejects.toThrow('JSON inválido');
        expect(location.replace).not.toHaveBeenCalled();
    });
    it('retorna JSON e respostas sem conteúdo sem redirecionar', async () => {
        fetch.mockResolvedValueOnce({ status: 200, ok: true, json: async () => [{ id: 1 }] });
        await expect(API.GET('/lotes')).resolves.toEqual([{ id: 1 }]);
        fetch.mockResolvedValueOnce({ status: 204, ok: true });
        await expect(API.POST('/logout')).resolves.toBeNull();
        expect(location.replace).not.toHaveBeenCalled();
    });
});


describe('erros locais dos blocos do dashboard', () => {
    it.each([404, 500, 502, 503, 504])('rejeita HTTP %s sem sair do dashboard', async (status) => {
        fetch.mockResolvedValue({ status, ok: false });
        await expect(API.GET('/producao', { erroLocal: true })).rejects.toThrow(
            status >= 500
                ? 'O serviço está temporariamente indisponível. Tente novamente em alguns instantes.'
                : 'HTTP ' + status,
        );
        expect(location.replace).not.toHaveBeenCalled();
    });
    it('mantém falhas de rede locais', async () => {
        fetch.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(API.GET('/esteiras', { erroLocal: true })).rejects.toThrow('Não foi possível conectar');
        expect(location.replace).not.toHaveBeenCalled();
    });
    it('mantém timeout local', async () => {
        vi.useFakeTimers();
        fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
        }));
        const resultado = expect(API.GET('/esteiras', { erroLocal: true })).rejects.toThrow('limite de 1.5 segundos');
        await vi.advanceTimersByTimeAsync(1500);
        await resultado;
        expect(location.replace).not.toHaveBeenCalled();
    });
    it('preserva o redirecionamento por falta de permissão', async () => {
        fetch.mockResolvedValue({ status: 403, ok: false });
        await expect(API.GET('/lotes', { erroLocal: true })).rejects.toThrow();
        expect(location.replace).toHaveBeenCalledWith('/src/features/errors/403.html');
    });
    it('preserva a expiração de sessão', async () => {
        sessionStorage.getItem.mockReturnValue('token');
        fetch.mockResolvedValue({ status: 401, ok: false });
        await expect(API.GET('/lotes', { erroLocal: true })).rejects.toThrow('HTTP 401');
        expect(sessionStorage.removeItem).toHaveBeenCalledWith('token');
        expect(location.replace).toHaveBeenCalledWith('/src/features/login/login.html?motivo=expirada');
    });
});
