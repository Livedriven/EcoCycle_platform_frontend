import { describe, expect, it } from 'vitest';
import { distanciaEdicao, filtrarProducoes, normalizarTexto, validarPeriodo } from './production-filters.js';
import { totalProduzido } from '../../shared/calculations.js';

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

describe('período das produções diárias', () => {
    const registros = [
        { ...producoes[0], data_hora: '2026-10-19T23:59:59', peso_kg: 100 },
        { ...producoes[0], data_hora: '2026-10-20T00:00:00', peso_kg: '12.35' },
        { ...producoes[1], data_hora: '2026-10-21T23:59:59', peso_kg: 7.65 },
        { ...producoes[0], data_hora: '2026-10-22T00:00:00', peso_kg: 200 },
        { ...producoes[0], data_hora: null, peso_kg: 300 }
    ];

    it('inclui os dois extremos e soma somente o peso do período', () => {
        const filtrados = filtrarProducoes(registros, { dataInicial: '2026-10-20', dataFinal: '2026-10-21' });
        expect(filtrados).toEqual([registros[1], registros[2]]);
        expect(totalProduzido(filtrados)).toBe(20);
    });

    it('aceita o mesmo dia como início e fim', () => {
        expect(validarPeriodo('2026-10-20', '2026-10-20')).toBe('');
        expect(filtrarProducoes(registros, { dataInicial: '2026-10-20', dataFinal: '2026-10-20' })).toEqual([registros[1]]);
    });

    it('aceita limites opcionais e exclui registros sem data quando há período', () => {
        expect(filtrarProducoes(registros, { dataInicial: '2026-10-21' })).toEqual([registros[2], registros[3]]);
        expect(filtrarProducoes(registros, { dataFinal: '2026-10-20' })).toEqual([registros[0], registros[1]]);
        expect(filtrarProducoes(registros, {})).toEqual(registros);
        expect(validarPeriodo('', '2026-10-20')).toBe('');
        expect(validarPeriodo('2026-10-20', '')).toBe('');
    });

    it('rejeita início posterior ao fim', () => {
        expect(validarPeriodo('2026-10-22', '2026-10-20')).toBe('A data inicial não pode ser maior que a data final.');
        expect(filtrarProducoes(registros, { dataInicial: '2026-10-22', dataFinal: '2026-10-20' })).toEqual([]);
    });

    it('combina período, busca, status e turno no total', () => {
        const filtrados = filtrarProducoes(registros, {
            dataInicial: '2026-10-20', dataFinal: '2026-10-21',
            busca: 'metal', status: 'Em processamento', turno: 'Noite'
        });
        expect(filtrados).toEqual([registros[2]]);
        expect(totalProduzido(filtrados)).toBe(7.65);
    });

    it('retorna total zero quando não há registros no período', () => {
        const filtrados = filtrarProducoes(registros, { dataInicial: '2027-01-01' });
        expect(filtrados).toEqual([]);
        expect(totalProduzido(filtrados)).toBe(0);
    });

    it('soma todos os registros filtrados, mesmo excedendo uma página de dez itens', () => {
        const variasProducoes = Array.from({ length: 15 }, (_, id) => ({ ...registros[1], id, peso_kg: 2 }));
        const filtrados = filtrarProducoes(variasProducoes, { dataInicial: '2026-10-20', dataFinal: '2026-10-21' });
        expect(totalProduzido(filtrados)).toBe(30);
    });
});
