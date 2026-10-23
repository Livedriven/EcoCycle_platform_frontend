import { describe, expect, it } from 'vitest';
import { distanciaEdicao, filtrarProducoes, normalizarTexto } from './production-filters.js';

const producoes = [
    {
        id: 1,
        id_lote: 8,
        id_esteira: 1,
        nome_esteira: 'Esteira de triagem',
        status: 'Finalizado',
        turno: 'Manhã',
        tipo_material: 'Plástico',
        data_hora: '2026-10-20T07:15:00'
    },
    {
        id: 2,
        id_lote: 9,
        id_esteira: 2,
        nome_esteira: 'Esteira de prensagem',
        status: 'Em processamento',
        turno: 'Noite',
        tipo_material: 'Metal',
        data_hora: '2026-10-20T20:45:00'
    }
];

describe('filtros da produção', () => {
    it('normaliza acentos e espaços', () => {
        expect(normalizarTexto('  PLÁSTICO  ')).toBe('plastico');
    });

    it('mede a distância entre palavras', () => {
        expect(distanciaEdicao('finalizado', 'finlizado')).toBe(1);
    });

    it('encontra palavras com pequenos erros de digitação', () => {
        expect(filtrarProducoes(producoes, { busca: 'plastcio' })).toEqual([producoes[0]]);
        expect(filtrarProducoes(producoes, { busca: 'finlizado' })).toEqual([producoes[0]]);
    });

    it('combina busca, data, status e turno', () => {
        expect(filtrarProducoes(producoes, {
            busca: 'esteira',
            data: '2026-10-20',
            status: 'Em processamento',
            turno: 'Noite'
        })).toEqual([producoes[1]]);
    });
});
