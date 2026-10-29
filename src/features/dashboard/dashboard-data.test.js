import { describe, expect, it } from 'vitest';
import { criarContexto, lerConsolidado, lerMateriais, estimarCo2, filtrarRecebimentos, agruparFornecedores } from './dashboard-data.js';

const massas = { total_material_entrada: '100', total_produzido_saida: 80, total_rejeitos_perdas: '20.5' };
describe('períodos do dashboard', () => {
    it('abre no mês atual e usa consultas explícitas e limites inclusivos', () => {
        const c = criarContexto(undefined, new Date(2026, 9, 28, 12));
        expect(c).toMatchObject({ tipo: 'mensal', inicio: '2026-10-01', fim: '2026-10-31', materiais: '/producao/materiais?mes=10&ano=2026' });
        expect(c.rotas.diario).toBe('/producao/dashboard-diario?data=28%2F10%2F2026');
        expect(c.rotas.trimestral).toBe('/producao/dashboard-trimestral?trimestre=4&ano=2026');
    });
    it.each([
        ['diario', new Date(2026, 11, 31, 23), '2026-12-31', '2026-12-31'],
        ['mensal', new Date(2028, 1, 29), '2028-02-01', '2028-02-29'],
        ['mensal', new Date(2027, 1, 28), '2027-02-01', '2027-02-28'],
        ['trimestral', new Date(2026, 11, 31), '2026-10-01', '2026-12-31'],
        ['trimestral', new Date(2027, 0, 1), '2027-01-01', '2027-03-31'],
        ['trimestral', new Date(2026, 3, 1), '2026-04-01', '2026-06-30'],
    ])('limites de %s em %s', (tipo, hoje, inicio, fim) => {
        expect(criarContexto(tipo, hoje)).toMatchObject({ inicio, fim });
    });
    it('não aceita um período desconhecido', () => { expect(() => criarContexto('anual')).toThrow(); });
});

describe('contratos de produção e materiais', () => {
    it.each([['diario', 'aproveitamento_percentual'], ['mensal', 'detalhamento_mensal'], ['trimestral', 'detalhamento_trimestral']])('adapta o percentual %s', (tipo, campo) => {
        expect(lerConsolidado({ balanco_massas_kg: massas, indicadores_desempenho: { [campo]: '80' } }, tipo))
            .toEqual({ entrada: 100, saida: 80, rejeito: 20.5, aproveitamento: 80 });
    });
    it('respeita zero retornado pelo backend', () => {
        expect(lerConsolidado({ balanco_massas_kg: massas, indicadores_desempenho: { aproveitamento_percentual: 0 } }, 'diario').aproveitamento).toBe(0);
    });
    it.each([null, undefined, '', ' ', false, -1, 'abc', Infinity])('rejeita valores inválidos: %s', (valor) => {
        expect(() => lerMateriais({ totais_por_material_kg: { plastico: valor, metal: 0, aluminio: 0, rejeito: 0 } })).toThrow();
    });
    it('usa os quatro totais sem reconstruir os itens ou ajustar a saída', () => {
        expect(lerMateriais({ totais_por_material_kg: { plastico: '12.5', metal: 2, aluminio: 3, rejeito: 7 }, materiais_produzidos: [] }))
            .toEqual({ 'Plástico': 12.5, Metal: 2, 'Alumínio': 3, Rejeito: 7 });
        expect(() => lerConsolidado({}, 'mensal')).toThrow();
        expect(() => lerMateriais({})).toThrow();
    });
    it('preserva os fatores atuais do CO₂ e soma antes de arredondar o total', () => {
        expect(estimarCo2({ 'Plástico': 1000, Metal: 1000, 'Alumínio': 9999, Rejeito: 9999 }))
            .toEqual({ total: 5.5, porMaterial: { 'Plástico': 1.5, Metal: 4 } });
        expect(estimarCo2({ 'Plástico': 10, Metal: 1, 'Alumínio': 0, Rejeito: 0 }))
            .toEqual({ total: 0.02, porMaterial: { 'Plástico': 0.02, Metal: 0 } });
    });
});

describe('recebimentos por período e fornecedor', () => {
    const c = criarContexto('mensal', new Date(2026, 9, 28));
    it('inclui os limites e usa o dia informado sem deslocar o fuso', () => {
        const dados = filtrarRecebimentos([
            { data_entrada: '2026-10-01T00:00:00+14:00', peso_recebido_kg: '10.25', id_fornecedor: 1 },
            { data_entrada: '2026-10-31T23:59:59-03:00', peso_recebido_kg: 2.5 },
            { data_entrada: '2026-09-30', peso_recebido_kg: 999 },
            { data_entrada: '2026-11-01', peso_recebido_kg: 999 },
            { data_entrada: null, peso_recebido_kg: 999 },
            { data_entrada: '2026-02-30', peso_recebido_kg: 999 },
            { data_entrada: '2026-10-20', peso_recebido_kg: '' },
        ], c);
        expect(dados).toMatchObject({ total: 12.75, descartados: 3 });
        expect(dados.registros).toHaveLength(2);
        expect(agruparFornecedores(dados.registros, [{ id_fornecedor: 1, nome_fornecedor: 'Fornecedor A' }]))
            .toEqual([{ nome: 'Fornecedor A', total: 10.25 }, { nome: 'Fornecedor não identificado', total: 2.5 }]);
    });
    it('não inventa nomes de fornecedores nem aceita listas inválidas', () => {
        expect(agruparFornecedores([{ id_fornecedor: 99, peso_recebido_kg: 2 }], []))
            .toEqual([{ nome: 'Fornecedor não identificado', total: 2 }]);
        expect(() => filtrarRecebimentos(null, c)).toThrow();
        expect(() => agruparFornecedores([], null)).toThrow();
    });
});
