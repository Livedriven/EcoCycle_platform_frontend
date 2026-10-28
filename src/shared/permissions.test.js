import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PERFIS, saveSession, clearSession } from './session.js';
import { aplicarPermissoes } from './permissions.js';

describe('aplicarPermissoes', () => {
    // Dublês do DOM: preservam classes e a seleção pelo atributo declarado.
    function elemento(acao, filhos = []) {
        const classes = new Set(['btn', 'd-none']);
        return {
            dataset: acao === undefined ? {} : { permissao: acao },
            classes,
            classList: {
                toggle: (classe, esconder) => esconder ? classes.add(classe) : classes.delete(classe)
            },
            matches: (seletor) => seletor === '[data-permissao]' && acao !== undefined,
            querySelectorAll: (seletor) => filhos.filter((filho) => filho.matches(seletor))
        };
    }

    function entrarComo(perfil, exp = Math.floor(Date.now() / 1000) + 3600) {
        const payload = Buffer.from(JSON.stringify({ nome: 'Teste', perfil, exp })).toString('base64url');
        saveSession('eyJhbGciOiJIUzI1NiJ9.' + payload + '.assinatura');
    }

    beforeEach(() => {
        const memoria = new Map();
        vi.stubGlobal('sessionStorage', {
            getItem: (chave) => memoria.get(chave) ?? null,
            setItem: (chave, valor) => memoria.set(chave, valor),
            removeItem: (chave) => memoria.delete(chave)
        });
        clearSession();
    });

    afterEach(() => {
        clearSession();
        vi.unstubAllGlobals();
    });

    it.each(PERFIS)('aplica as permissões do perfil %s e preserva outras classes', (perfil) => {
        entrarComo(perfil);
        const botao = elemento('producao.operar');
        aplicarPermissoes(elemento(undefined, [botao]));
        expect(botao.classes.has('d-none')).toBe(perfil === 'consulta');
        expect(botao.classes.has('btn')).toBe(true);
    });

    it('sem sessão, esconde um elemento que estava visível', () => {
        const botao = elemento('lote.registrar');
        botao.classes.delete('d-none');
        aplicarPermissoes(botao);
        expect(botao.classes.has('d-none')).toBe(true);
    });

    it('esconde ações desconhecidas, vazias e indisponíveis no MVP', () => {
        entrarComo('administrador');
        for (const acao of ['desconhecida', '', 'usuarios.gerenciar']) {
            const botao = elemento(acao);
            botao.classes.delete('d-none');
            aplicarPermissoes(botao);
            expect(botao.classes.has('d-none')).toBe(true);
        }
    });

    it('usa document por padrão e não altera elementos sem o atributo', () => {
        entrarComo('operador');
        const botao = elemento('lote.registrar');
        const formularioFechado = elemento();
        vi.stubGlobal('document', { querySelectorAll: elemento(undefined, [botao, formularioFechado]).querySelectorAll });
        aplicarPermissoes();
        expect(botao.classes.has('d-none')).toBe(false);
        expect(formularioFechado.classes.has('d-none')).toBe(true);
    });

    it('reavalia a raiz e os filhos após trocar a sessão', () => {
        const botao = elemento('lote.registrar');
        const raiz = elemento('fornecedor.cadastrar', [botao]);
        entrarComo('gerente');
        aplicarPermissoes(raiz);
        expect(raiz.classes.has('d-none')).toBe(false);
        expect(botao.classes.has('d-none')).toBe(false);
        entrarComo('consulta');
        aplicarPermissoes(raiz);
        expect(raiz.classes.has('d-none')).toBe(true);
        expect(botao.classes.has('d-none')).toBe(true);
    });

    it('esconde as ações quando a sessão está expirada', () => {
        entrarComo('administrador', Math.floor(Date.now() / 1000) - 1);
        const botao = elemento('producao.operar');
        botao.classes.delete('d-none');
        aplicarPermissoes(botao);
        expect(botao.classes.has('d-none')).toBe(true);
    });
});
