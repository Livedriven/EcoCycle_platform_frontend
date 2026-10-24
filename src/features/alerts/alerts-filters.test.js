import { describe, it, expect } from 'vitest';
import {
    ESTADO,
    normalizarTexto,
    estaResolvido,
    enriquecerAlertas,
    ordenarMaisRecentes,
    tiposDeAlerta,
    filtrarAlertas
} from './alerts-filters.js';

const esteiras = [{ id: 1, nome_esteira: 'Esteira 01 - Triagem' }];
const leituras = [
    { id: 4, id_esteira: 1, temperatura_leitura_c: 58.3, peso_leitura_kg: 14.6, material_leitura: 'Plástico' },
    { id: 14, id_esteira: 1, temperatura_leitura_c: 76.4, peso_leitura_kg: 16.3, material_leitura: 'Plástico' },
    { id: 15, id_esteira: 1, temperatura_leitura_c: 41.5, peso_leitura_kg: 6.2, material_leitura: 'Não identificado' }
];
const alertas = [
    { id: 1, id_leitura: 4, tipo_alerta: 'Temperatura alta', datahora_alerta: '2026-10-06T10:41:00', resolvido: 'true' },
    { id: 5, id_leitura: 14, tipo_alerta: 'Temperatura crítica', datahora_alerta: '2026-10-19T10:06:00', resolvido: 'false' },
    { id: 6, id_leitura: 15, tipo_alerta: 'Material não identificado', datahora_alerta: '2026-10-19T15:22:00', resolvido: false },
    { id: 12, id_leitura: 999, tipo_alerta: 'Peso fora do limite', datahora_alerta: '2026-10-20T09:00:00', resolvido: true }
];
const todos = enriquecerAlertas(alertas, leituras, esteiras);
const ids = (lista) => lista.map((alerta) => alerta.id);

describe('texto e situação', () => {
    it('normaliza acento, caixa e espaços', () => {
        expect(normalizarTexto('  Temperatura   CRÍTICA ')).toBe('temperatura critica');
        expect(normalizarTexto(null)).toBe('');
    });

    it('resolvido aceita texto e booleano', () => {
        expect(estaResolvido('true')).toBe(true);
        expect(estaResolvido(true)).toBe(true);
        expect(estaResolvido('false')).toBe(false);
        expect(estaResolvido(false)).toBe(false);
        expect(estaResolvido(undefined)).toBe(false);
    });
});

describe('enriquecerAlertas', () => {
    it('acrescenta esteira e dados da leitura', () => {
        expect(todos[1]).toMatchObject({
            ativo: true,
            situacao: 'Ativo',
            nome_esteira: 'Esteira 01 - Triagem',
            temperatura_leitura_c: 76.4,
            peso_leitura_kg: 16.3
        });
        expect(todos[0].situacao).toBe('Resolvido');
    });

    it('alerta sem leitura correspondente continua na lista, com campos vazios', () => {
        expect(todos[3]).toMatchObject({ nome_esteira: '', temperatura_leitura_c: null, ativo: false });
    });

    it('listas vazias ou ausentes não quebram', () => {
        expect(enriquecerAlertas(undefined, undefined, undefined)).toEqual([]);
    });
});

describe('ordenação e tipos', () => {
    it('ordena do mais recente para o mais antigo sem alterar a lista original', () => {
        expect(ids(ordenarMaisRecentes(todos))).toEqual([12, 6, 5, 1]);
        expect(ids(todos)).toEqual([1, 5, 6, 12]);
    });

    it('lista os tipos sem repetir, em ordem alfabética', () => {
        expect(tiposDeAlerta([...alertas, ...alertas])).toEqual([
            'Material não identificado',
            'Peso fora do limite',
            'Temperatura alta',
            'Temperatura crítica'
        ]);
    });
});

describe('filtrarAlertas', () => {
    it('sem filtros devolve tudo', () => {
        expect(filtrarAlertas(todos)).toHaveLength(4);
    });

    it('separa ativos do histórico', () => {
        expect(ids(filtrarAlertas(todos, { estado: ESTADO.ATIVOS }))).toEqual([5, 6]);
        expect(ids(filtrarAlertas(todos, { estado: ESTADO.HISTORICO }))).toEqual([1, 12]);
    });

    it('filtra por tipo exato', () => {
        expect(ids(filtrarAlertas(todos, { tipo: 'Temperatura alta' }))).toEqual([1]);
    });

    it('filtra por período, incluindo os dois extremos', () => {
        expect(ids(filtrarAlertas(todos, { de: '2026-10-19', ate: '2026-10-19' }))).toEqual([5, 6]);
        expect(ids(filtrarAlertas(todos, { de: '2026-10-20' }))).toEqual([12]);
        expect(ids(filtrarAlertas(todos, { ate: '2026-10-06' }))).toEqual([1]);
    });

    it('busca ignora acento e caixa', () => {
        expect(ids(filtrarAlertas(todos, { busca: 'CRITICA' }))).toEqual([5]);
        expect(ids(filtrarAlertas(todos, { busca: 'triagem' }))).toEqual([1, 5, 6]);
    });

    it('busca por data no formato brasileiro', () => {
        expect(ids(filtrarAlertas(todos, { busca: '06/10/2026' }))).toEqual([1]);
    });

    it('número na busca é exato: "1" não encontra o alerta 12', () => {
        expect(ids(filtrarAlertas(todos, { busca: '1' }))).toEqual([1]);
        expect(ids(filtrarAlertas(todos, { busca: '12' }))).toEqual([12]);
    });

    it('combina todos os filtros', () => {
        const filtros = { estado: ESTADO.ATIVOS, tipo: 'Temperatura crítica', de: '2026-10-01', busca: 'esteira' };
        expect(ids(filtrarAlertas(todos, filtros))).toEqual([5]);
    });

    it('nenhum resultado devolve lista vazia', () => {
        expect(filtrarAlertas(todos, { busca: 'inexistente' })).toEqual([]);
    });
});
