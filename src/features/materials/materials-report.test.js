import { describe, expect, it } from 'vitest';
import { prepararMateriais, prepararProducaoMateriais, filtrarMateriais, validarPeriodo } from './materials-report.js';
import { MATERIAIS_RELATORIO, materiaisPorLoteDia, totalPorMaterial } from '../../shared/calculations.js';
import { normalizarResposta } from '../../shared/api-contract.js';

const registro = { id_lote: 1, tipo_material: 'Plástico', peso_kg: 12.5, data_hora: '2026-10-20T08:00:00' };

const catalogo = [
    { id_material: 7, tipo_material: 'plastico' },
    { id_material: 4, tipo_material: 'metal' },
    { id_material: 12, tipo_material: 'aluminio' },
];
const ciclo = {
    id_producao: 10, id_lote: 2, data_inicio: '2026-10-20T08:00:00',
    quantidade_entrada_kg: 100.25, quantidade_saida_kg: 90, rejeito_kg: 10.25,
    itens: [
        { id_item_producao: 1, id_producao: 10, id_material: 7, peso_kg: 50, data_hora: '2026-10-20T08:01:00' },
        { id_item_producao: 2, id_producao: 10, id_material: 4, peso_kg: 30, data_hora: '2026-10-20T08:02:00' },
        { id_item_producao: 3, id_producao: 10, id_material: 12, peso_kg: 10, data_hora: null },
    ],
};

describe('integração entre ciclos, catálogo e relatório', () => {
    it('usa itens e catálogo reais após o adaptador HTTP, contando rejeito uma vez', () => {
        const original = structuredClone(ciclo);
        const producoes = normalizarResposta('GET', '/producao', { registros_producao: [ciclo] });
        const materiais = normalizarResposta('GET', '/materiais', { materiais: catalogo });
        const dados = prepararProducaoMateriais(producoes, materiais);
        expect(dados.pendencias).toEqual([]);
        expect(dados.descartados).toBe(0);
        expect(totalPorMaterial(dados.registros, MATERIAIS_RELATORIO)).toEqual({
            'Plástico': 50, Metal: 30, 'Alumínio': 10, Rejeito: 10.25,
        });
        expect(materiaisPorLoteDia(dados.registros)).toEqual([
            { id_lote: '2', data: '2026-10-20', plastico: 50, metal: 30, aluminio: 10, rejeito: 10.25 },
        ]);
        expect(ciclo).toEqual(original);
    });
    it('preserva a data dos itens e atribui rejeito ao início do ciclo', () => {
        const dados = prepararProducaoMateriais([{ ...ciclo, itens: [
            { id_material: 7, peso_kg: 90, data_hora: '2026-10-21T01:00:00' },
        ] }], catalogo);
        expect(totalPorMaterial(filtrarMateriais(dados.registros, { inicio: '2026-10-21' }), MATERIAIS_RELATORIO))
            .toEqual({ 'Plástico': 90, Metal: 0, 'Alumínio': 0, Rejeito: 0 });
        expect(totalPorMaterial(filtrarMateriais(dados.registros, { fim: '2026-10-20' }), MATERIAIS_RELATORIO).Rejeito).toBe(10.25);
    });
    it.each([[], undefined, null])('mantém rejeito e sinaliza ciclo sem itens: %j', (itens) => {
        const dados = prepararProducaoMateriais([{ ...ciclo, itens }], catalogo);
        expect(totalPorMaterial(dados.registros, MATERIAIS_RELATORIO)).toEqual({
            'Plástico': 0, Metal: 0, 'Alumínio': 0, Rejeito: 10.25,
        });
        expect(filtrarMateriais(dados.pendencias, { lote: '2', fim: '2026-10-20' })).toHaveLength(1);
    });
    it('sinaliza composição parcial e não distribui a saída que falta', () => {
        const dados = prepararProducaoMateriais([{ ...ciclo, itens: [ciclo.itens[0]] }], catalogo);
        expect(dados.pendencias).toHaveLength(1);
        expect(totalPorMaterial(dados.registros, MATERIAIS_RELATORIO)['Plástico']).toBe(50);
    });
    it('descarta material desconhecido e peso inválido, preservando os demais pesos', () => {
        const dados = prepararProducaoMateriais([{ ...ciclo, itens: [
            ciclo.itens[0], { id_material: 999, peso_kg: 20 }, { id_material: 4, peso_kg: -1 }, null,
        ] }], catalogo);
        expect(dados.descartados).toBe(3);
        expect(dados.pendencias).toHaveLength(1);
        expect(totalPorMaterial(dados.registros, MATERIAIS_RELATORIO)).toEqual({
            'Plástico': 50, Metal: 0, 'Alumínio': 0, Rejeito: 10.25,
        });
    });
    it('não soma rejeito dos itens mesmo se um catálogo incompatível tentar defini-lo', () => {
        const dados = prepararProducaoMateriais([{ ...ciclo, itens: [...ciclo.itens, { id_material: 99, peso_kg: 10.25 }] }],
            [...catalogo, { id_material: 99, tipo_material: 'Rejeito' }]);
        expect(totalPorMaterial(dados.registros, MATERIAIS_RELATORIO).Rejeito).toBe(10.25);
        expect(dados.pendencias).toHaveLength(1);
    });
    it('aceita IDs numéricos em texto e nomes acentuados sem fixar os IDs dos materiais', () => {
        const dados = prepararProducaoMateriais([{ ...ciclo, itens: [{ id_material: '42', peso_kg: '90' }] }],
            [{ id: '42', tipo_material: ' PLÁSTICO ' }]);
        expect(totalPorMaterial(dados.registros, MATERIAIS_RELATORIO)['Plástico']).toBe(90);
        expect(dados.pendencias).toEqual([]);
    });
    it('mantém pesos zero explícitos e não substitui rejeito ausente por zero', () => {
        const dados = prepararProducaoMateriais([{ ...ciclo, quantidade_saida_kg: 0, rejeito_kg: null,
            itens: [{ id_material: 7, peso_kg: 0 }] }], catalogo);
        expect(dados.registros).toEqual([{ id_lote: '2', data_hora: '2026-10-20', tipo_material: 'Plástico', peso_kg: 0 }]);
        expect(dados.pendencias).toEqual([]);
    });
    it('não trata o peso total normalizado de ciclos antigos como material separado', () => {
        const dados = prepararProducaoMateriais([{ id_lote: 2, data_hora: '2026-10-20', peso_kg: 100 }], catalogo);
        expect(dados.registros).toEqual([]);
        expect(dados.pendencias).toHaveLength(1);
    });
    it.each([[{}, []], [[], null]])('recusa formato inválido de ciclos ou catálogo', (producoes, materiais) => {
        expect(() => prepararProducaoMateriais(producoes, materiais)).toThrow('formato inválido');
    });
});

describe('validação dos materiais recebidos', () => {
    it('normaliza números, mantém o dia informado e copia somente os campos do relatório', () => {
        expect(prepararMateriais([{ ...registro, id_lote: '01', peso_kg: '12.50', html: '<script>alert(1)</script>' }])).toEqual({
            registros: [{ id_lote: '1', tipo_material: 'Plástico', peso_kg: 12.5, data_hora: '2026-10-20' }], descartados: 0,
        });
    });
    it.each([null, {}, { data: [] }, 'resposta inválida'])('recusa resposta que não seja uma lista: %j', (resposta) => {
        expect(() => prepararMateriais(resposta)).toThrow('formato inválido');
    });
    it.each([-1, NaN, Infinity, '', ' ', null, true, [], {}, '12 kg'])('descarta peso inválido %j', (peso_kg) => {
        expect(prepararMateriais([{ ...registro, peso_kg }]).descartados).toBe(1);
    });
    it.each([0, -1, 1.5, null, true, {}, '<img src=x onerror=alert(1)>'])('descarta lote inválido %j', (id_lote) => {
        expect(prepararMateriais([{ ...registro, id_lote }]).descartados).toBe(1);
    });
    it.each(['2026-02-29', '2026-13-01', '2026-10-32', '2026-10-20<script>', '2026-10-20T99:00:00', '2026-10-20T08:00<script>', '', null])('descarta data inválida %j', (data_hora) => {
        expect(prepararMateriais([{ ...registro, data_hora }]).descartados).toBe(1);
    });
    it('aceita ano bissexto e preserva o dia em timestamp com fuso', () => {
        expect(prepararMateriais([{ ...registro, data_hora: '2024-02-29T23:30:00-03:00' }]).registros[0].data_hora).toBe('2024-02-29');
    });
    it('ignora materiais fora do contrato, entradas nulas e tentativas de HTML ou poluição de protótipo', () => {
        const entrada = [null, [], { ...registro, tipo_material: '__proto__' }, { ...registro, tipo_material: '<script>alert(1)</script>' }, { ...registro, tipo_material: 'Vidro' }];
        expect(prepararMateriais(entrada)).toEqual({ registros: [], descartados: 5 });
        expect({}.polluted).toBeUndefined();
    });
    it('mantém peso zero e lista vazia como dados válidos', () => {
        expect(prepararMateriais([{ ...registro, peso_kg: 0 }]).registros).toHaveLength(1);
        expect(prepararMateriais([])).toEqual({ registros: [], descartados: 0 });
    });
    it.each(['Alumínio', 'Rejeito'])('aceita e filtra registros futuros de %s com a mesma validação', (tipo_material) => {
        const dados = prepararMateriais([{ ...registro, tipo_material }, { ...registro, tipo_material, peso_kg: -1 }]);
        expect(dados.descartados).toBe(1);
        expect(filtrarMateriais(dados.registros, { lote: '1', inicio: '2026-10-20', fim: '2026-10-20' })).toHaveLength(1);
    });
});

describe('filtros do relatório', () => {
    const registros = prepararMateriais([
        { ...registro, data_hora: '2026-10-19' },
        registro,
        { ...registro, id_lote: 2, tipo_material: 'Metal', peso_kg: 5, data_hora: '2026-10-21' },
    ]).registros;

    it('exibe todo o histórico por padrão e não altera os registros', () => {
        expect(filtrarMateriais(registros)).toEqual(registros);
        expect(registros).toHaveLength(3);
    });
    it('combina filtros com limites inclusivos e lote exato', () => {
        const filtrados = filtrarMateriais(registros, { inicio: '2026-10-20', fim: '2026-10-21', lote: '1' });
        expect(filtrados).toHaveLength(1);
        expect(totalPorMaterial(filtrados)).toEqual({ 'Plástico': 12.5, Metal: 0 });
        expect(materiaisPorLoteDia(filtrados)).toEqual([{ id_lote: '1', data: '2026-10-20', plastico: 12.5, metal: 0, aluminio: 0, rejeito: 0 }]);
    });
    it('permite início ou fim isolados e resultado vazio', () => {
        expect(filtrarMateriais(registros, { inicio: '2026-10-21' })).toHaveLength(1);
        expect(filtrarMateriais(registros, { fim: '2026-10-19' })).toHaveLength(1);
        expect(filtrarMateriais(registros, { lote: '9' })).toEqual([]);
    });
    it('recusa intervalo invertido e datas inexistentes', () => {
        expect(validarPeriodo({ inicio: '2026-10-22', fim: '2026-10-20' })).toContain('anterior ou igual');
        expect(() => filtrarMateriais(registros, { inicio: '2026-02-30' })).toThrow('datas válidas');
        expect(validarPeriodo({ inicio: '2026-10-20', fim: '2026-10-20' })).toBe('');
    });
});
