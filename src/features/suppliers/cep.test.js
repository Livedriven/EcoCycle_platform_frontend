import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizarCep, formatarCep, validarCep, montarEndereco, buscarCep } from './cep.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

function respostaJson(corpo, ok = true) {
    return { ok, json: async () => corpo };
}

describe('normalizarCep e formatarCep', () => {
    it('remove tudo que não é dígito', () => {
        expect(normalizarCep('30140-071')).toBe('30140071');
        expect(normalizarCep(null)).toBe('');
    });
    it('formata com hífen e aceita digitação parcial', () => {
        expect(formatarCep('30140071')).toBe('30140-071');
        expect(formatarCep('301400')).toBe('30140-0');
        expect(formatarCep('3014')).toBe('3014');
    });
    it('descarta o que passar de 8 dígitos', () => {
        expect(formatarCep('301400719999')).toBe('30140-071');
    });
});

describe('validarCep', () => {
    it.each(['30140071', '30140-071'])('aceita %s', (cep) => {
        expect(validarCep(cep)).toEqual({ valido: true, mensagem: '' });
    });
    it.each([['vazio', ''], ['null', null], ['curto', '3014'], ['longo', '301400719'], ['letras', 'abcdefgh']])('rejeita %s', (_, cep) => {
        expect(validarCep(cep)).toEqual({ valido: false, mensagem: 'Informe um CEP com 8 dígitos.' });
    });
});

describe('montarEndereco', () => {
    it('monta rua, bairro e cidade/UF', () => {
        expect(montarEndereco({ logradouro: 'Rua das Acácias', bairro: 'Distrito Industrial', localidade: 'Contagem', uf: 'MG' }))
            .toBe('Rua das Acácias - Distrito Industrial, Contagem/MG');
    });
    it('funciona sem logradouro (CEP geral de cidade)', () => {
        expect(montarEndereco({ logradouro: '', bairro: '', localidade: 'Ibirité', uf: 'MG' })).toBe('Ibirité/MG');
    });
    it('funciona sem bairro', () => {
        expect(montarEndereco({ logradouro: 'Praça Central', bairro: '', localidade: 'Ibirité', uf: 'MG' }))
            .toBe('Praça Central, Ibirité/MG');
    });
});

describe('buscarCep', () => {
    it('devolve o endereço e não envia cabeçalhos (sem token)', async () => {
        const fetchFalso = vi.fn().mockResolvedValue(respostaJson({ logradouro: 'Rua A', bairro: 'Centro', localidade: 'Contagem', uf: 'MG' }));
        vi.stubGlobal('fetch', fetchFalso);

        const r = await buscarCep('30140-071');

        expect(r).toEqual({ ok: true, endereco: 'Rua A - Centro, Contagem/MG' });
        expect(fetchFalso.mock.calls[0][0]).toBe('https://viacep.com.br/ws/30140071/json/');
        expect(fetchFalso.mock.calls[0][1].headers).toBeUndefined();
    });
    it('não consulta com CEP inválido', async () => {
        const fetchFalso = vi.fn();
        vi.stubGlobal('fetch', fetchFalso);
        expect(await buscarCep('123')).toEqual({ ok: false, motivo: 'invalido' });
        expect(fetchFalso).not.toHaveBeenCalled();
    });
    it('trata CEP inexistente', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({ erro: true })));
        expect(await buscarCep('99999999')).toEqual({ ok: false, motivo: 'nao-encontrado' });
    });
    it('trata erro HTTP como indisponível', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({}, false)));
        expect(await buscarCep('30140071')).toEqual({ ok: false, motivo: 'indisponivel' });
    });
    it('trata falha de rede como indisponível', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
        expect(await buscarCep('30140071')).toEqual({ ok: false, motivo: 'indisponivel' });
    });
    it('cancela quando o tempo esgota', async () => {
        vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((_, rejeitar) => {
            signal.addEventListener('abort', () => rejeitar(new DOMException('abortado', 'AbortError')));
        })));
        expect(await buscarCep('30140071', { timeoutMs: 20 })).toEqual({ ok: false, motivo: 'indisponivel' });
    });
});