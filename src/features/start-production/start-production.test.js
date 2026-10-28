import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, saveSession, requireLogin, LOGIN_URL, FORBIDDEN_URL } from '../../shared/session.js';
import API from '../../shared/api.js';

vi.mock('../../shared/api.js', () => ({ default: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() } }));
vi.mock('../../shared/layout.js', () => ({
    montarLayout: ({ acao }) => requireLogin(acao)
}));

let elementos;
function entrar(perfil, exp = Math.floor(Date.now() / 1000) + 3600, sub = '7') {
    const payload = Buffer.from(JSON.stringify({ sub, nome: 'Teste', perfil, exp })).toString('base64url');
    saveSession('eyJhbGciOiJIUzI1NiJ9.' + payload + '.assinatura');
}

async function abrir() {
    await import('./start-production.js');
    await vi.waitFor(() => {
        if (API.GET.mock.calls.length) {
            expect(elementos.get('bloco-iniciar-producao').querySelector('.estado').textContent).toBe('');
        }
    });
}

function elemento() {
    const filhos = new Map();
    return {
        hidden: false, value: '', options: [{ value: '' }],
        classList: { add: vi.fn(), remove: vi.fn() },
        addEventListener: vi.fn(function (tipo, handler) { this[tipo] = handler; }),
        querySelector: vi.fn((seletor) => {
            if (!filhos.has(seletor)) filhos.set(seletor, elemento());
            return filhos.get(seletor);
        }),
        add(opcao) { this.options.push(opcao); },
        remove: vi.fn(), reset: vi.fn(), focus: vi.fn()
    };
}

beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const memoria = new Map();
    vi.stubGlobal('sessionStorage', {
        getItem: (chave) => memoria.get(chave) ?? null,
        setItem: (chave, valor) => memoria.set(chave, valor),
        removeItem: (chave) => memoria.delete(chave)
    });
    vi.stubGlobal('location', { replace: vi.fn() });
    elementos = new Map();
    vi.stubGlobal('document', {
        getElementById: (id) => {
            if (!elementos.has(id)) elementos.set(id, elemento());
            return elementos.get(id);
        }
    });
    vi.stubGlobal('Option', function (texto, valor) { this.textContent = texto; this.value = valor; });
    document.getElementById('bloco-iniciar-producao').hidden = true;
    API.GET.mockReset().mockImplementation(async (rota) => ({
        '/lotes': [{ id: 1, status: 'Recebido', pesoentrada_kg: 10 }],
        '/fornecedores': [],
        '/esteiras': [{ id: 2, nome_esteira: 'Esteira 2', status_esteira: 'LIGADA' }]
    })[rota]);
    API.POST.mockReset().mockResolvedValue({ id: 3 });
    API.PATCH.mockReset().mockResolvedValue({ id: 1, status: 'Em processamento' });
    clearSession();
});

afterEach(() => {
    clearSession();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function enviar() {
    elementos.get('lote').value = '1';
    elementos.get('esteira').value = '2';
    elementos.get('turno').value = 'Manhã';
    return elementos.get('form-iniciar-producao').submit({ preventDefault: vi.fn() });
}

describe('acesso a iniciar produção', () => {
    it.each(['administrador', 'gerente', 'operador'])('%s consegue carregar e iniciar produção', async (perfil) => {
        entrar(perfil);
        await abrir();
        expect(API.GET).toHaveBeenCalledWith('/esteiras');
        expect(elementos.get('esteira').options).toHaveLength(2);
        await enviar();
        expect(location.replace).not.toHaveBeenCalled();
        expect(API.POST).toHaveBeenCalledExactlyOnceWith('/producao', expect.objectContaining({
            id_lote: 1, id_esteira: 2, id_usuario: 7, turno: 'Manhã',
            status_producao: 'Em processamento', quantidade_entrada_kg: 10, quantidade_saida_kg: 0, rejeito_kg: 0, itens: []
        }));
        expect(API.POST.mock.calls[0][1].data_inicio).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        expect(API.PATCH).toHaveBeenCalledExactlyOnceWith('/lotes/1', { status_lote: 'Em processamento' });
        expect(elementos.get('aviso-envio').className).toBe('alert alert-success');
    });

    it('mantém a produção criada e avisa quando o status do lote não é atualizado', async () => {
        entrar('operador');
        await abrir();
        API.PATCH.mockRejectedValue(new Error('HTTP 403'));
        await enviar();
        expect(API.POST).toHaveBeenCalledTimes(1);
        expect(elementos.get('aviso-envio').className).toBe('alert alert-warning');
        expect(elementos.get('aviso-envio').textContent).toContain('HTTP 403');
    });

    it('não envia produção com sub não numérico, pois o schema exige id_usuario inteiro', async () => {
        entrar('operador', undefined, 'login-antigo');
        await abrir();
        await enviar();
        expect(API.POST).not.toHaveBeenCalled();
        expect(elementos.get('aviso-envio').textContent).toContain('Entre novamente');
    });

    it.each(['ausente', 'invalida', 'expirada', 'consulta'])('barra entrada com sessão %s antes de buscar dados', async (estado) => {
        if (estado === 'invalida') sessionStorage.setItem('token', 'invalido');
        if (estado === 'expirada') entrar('gerente', 1);
        if (estado === 'consulta') entrar('consulta');
        await abrir();
        expect(API.GET).not.toHaveBeenCalled();
        expect(API.POST).not.toHaveBeenCalled();
        expect(elementos.get('bloco-iniciar-producao').hidden).toBe(true);
        expect(location.replace).toHaveBeenCalledWith(estado === 'consulta'
            ? FORBIDDEN_URL : `${LOGIN_URL}?motivo=${estado}`);
    });

    it.each(['ausente', 'expirada', 'consulta'])('revalida sessão %s antes de enviar', async (estado) => {
        entrar('gerente');
        await abrir();
        if (estado === 'ausente') clearSession();
        if (estado === 'expirada') entrar('gerente', 1);
        if (estado === 'consulta') entrar('consulta');
        await enviar();
        expect(API.POST).not.toHaveBeenCalled();
        expect(location.replace).toHaveBeenCalled();
        expect(elementos.get('bloco-iniciar-producao').hidden).toBe(true);
    });

    it('impede envios duplicados enquanto a API responde', async () => {
        entrar('administrador');
        await abrir();
        let concluir;
        API.POST.mockImplementation(() => new Promise((resolve) => { concluir = resolve; }));
        const primeiro = enviar();
        await enviar();
        expect(API.POST).toHaveBeenCalledTimes(1);
        concluir({ id: 3 });
        await primeiro;
    });

    it('não exibe os dados se a sessão terminar durante o carregamento', async () => {
        entrar('gerente');
        let concluir;
        const resposta = new Promise((resolve) => { concluir = resolve; });
        API.GET.mockReturnValue(resposta);
        await import('./start-production.js');
        clearSession();
        concluir([]);
        await vi.waitFor(() => expect(location.replace).toHaveBeenCalledWith(`${LOGIN_URL}?motivo=ausente`));
        expect(elementos.get('bloco-iniciar-producao').hidden).toBe(true);
        expect(elementos.get('lote').options).toHaveLength(1);
        expect(API.POST).not.toHaveBeenCalled();
    });
});
