import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    Grid: vi.fn(function (config) {
        this.config = config;
        this.render = vi.fn();
    })
}));

vi.mock('gridjs', async (importOriginal) => ({
    ...await importOriginal(),
    Grid: mocks.Grid
}));

import { createTable, h } from './table.js';

beforeEach(() => vi.clearAllMocks());

describe('renderização segura das tabelas', () => {
    it('mantém o span externo dos badges e trata o conteúdo como texto', () => {
        const payload = '<img src=x onerror=alert(1)>';
        const alvo = { replaceChildren: vi.fn() };
        const grid = createTable(alvo, [{
            id: 'status', label: 'Status',
            formatar: (valor) => h('span', { className: 'badge b-info' }, valor)
        }], [{ status: payload }]);

        const celula = grid.config.columns[0].formatter(payload);
        expect(celula.type).toBe('span');
        const badge = celula.props.children;
        expect(badge.type).toBe('span');
        expect(badge.props).toEqual({ className: 'badge b-info', children: payload });
        expect(alvo.replaceChildren).toHaveBeenCalledOnce();
        expect(grid.render).toHaveBeenCalledWith(alvo);
    });

    it('preserva o texto de colunas comuns e com formatação', () => {
        const payload = '<svg onload=alert(1)>';
        const grid = createTable({ replaceChildren: vi.fn() }, [
            { id: 'nome', label: 'Nome' },
            { id: 'telefone', label: 'Telefone', formatar: (valor) => valor }
        ], [{ nome: payload, telefone: payload }]);

        expect(grid.config.columns[0].formatter).toBeUndefined();
        expect(grid.config.columns[1].formatter(payload)).toBe(payload);
        expect(grid.config.data[0].nome).toBe(payload);
    });

    it('preserva o botão de ação e o registro recebido ao clicar', () => {
        const aoClicar = vi.fn();
        const linha = { id: 7 };
        const grid = createTable({ replaceChildren: vi.fn() }, [{
            label: 'Ações', acoes: [{ texto: 'Ver dados', aoClicar }]
        }], [linha]);

        const celula = grid.config.columns[0].formatter(linha);
        expect(celula.type).toBe('div');
        const botao = celula.props.children[0];
        expect(botao.type).toBe('button');
        expect(botao.props.children).toBe('Ver dados');
        botao.props.onClick();
        expect(aoClicar).toHaveBeenCalledWith(linha);
    });
});
