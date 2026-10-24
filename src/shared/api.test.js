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
        await expect(API.DELETE('/lotes/1')).resolves.toBeNull();
        expect(location.replace).not.toHaveBeenCalled();
    });
});
