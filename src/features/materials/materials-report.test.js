import { describe, expect, it } from 'vitest';
import { prepararMateriais, filtrarMateriais, validarPeriodo } from './materials-report.js';
import { materiaisPorLoteDia, totalPorMaterial } from '../../shared/calculations.js';

const registro = { id_lote: 1, tipo_material: 'Plástico', peso_kg: 12.5, data_hora: '2026-10-20T08:00:00' };

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
