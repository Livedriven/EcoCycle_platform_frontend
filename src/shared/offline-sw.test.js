import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const worker = readFileSync(new URL('./offline-sw.js', import.meta.url), 'utf8');
const pagina = '/src/features/batches/batches.html';
const origem = 'https://ecocycle.example.test';

function montar() {
    const eventos = {};
    const rede = vi.fn();
    const salvo = new Response('<h1>Lotes</h1>');
    const cache = { addAll: vi.fn().mockResolvedValue(), match: vi.fn().mockResolvedValue(salvo) };
    runInNewContext(`const ARQUIVOS = ${JSON.stringify([pagina, '/assets/batches.js'])};\nconst NOME_CACHE = 'ecocycle-shell-teste';\n${worker}`, {
        self: { location: { origin: origem }, addEventListener: (nome, acao) => { eventos[nome] = acao; } },
        caches: { open: vi.fn().mockResolvedValue(cache) }, fetch: rede, Request, URL,
    });
    function consultar(caminho, opcoes) {
        const respondWith = vi.fn();
        eventos.fetch({ request: { method: 'GET', mode: 'navigate', url: new URL(caminho, origem).href, ...opcoes }, respondWith });
        return respondWith.mock.calls[0]?.[0];
    }
    return { eventos, cache, rede, salvo, consultar };
}

describe('estrutura do portal offline', () => {
    it('instala os arquivos estáticos da versão atual', async () => {
        const { eventos, cache } = montar();
        const waitUntil = vi.fn();
        eventos.install({ waitUntil });
        await waitUntil.mock.calls[0][0];
        expect(cache.addAll.mock.calls[0][0].map((req) => req.url)).toEqual([origem + pagina, origem + '/assets/batches.js']);
    });

    it('busca o HTML online e usa a cópia estática ao navegar sem rede', async () => {
        const { consultar, rede, salvo, cache } = montar();
        const atual = new Response('<h1>Lotes atualizados</h1>');
        rede.mockResolvedValueOnce(atual).mockRejectedValueOnce(new TypeError('Sem rede'));
        await expect(consultar(pagina)).resolves.toBe(atual);
        await expect(consultar(pagina + '?status=recebido')).resolves.toBe(salvo);
        expect(cache.match).toHaveBeenCalledExactlyOnceWith(pagina);
    });

    it('não intercepta a API, POSTs ou endereços de outra origem', () => {
        const { consultar } = montar();
        expect(consultar('/api/lotes')).toBeUndefined();
        expect(consultar(pagina, { method: 'POST' })).toBeUndefined();
        expect(consultar('https://outra.example.test' + pagina)).toBeUndefined();
    });
});
