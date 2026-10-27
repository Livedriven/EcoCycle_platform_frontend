import { describe, it, expect } from 'vitest';
import {
    normalizarTexto, chaveDoStatus, rotuloDoStatus, montarLinhas,
    opcoesDeStatus, filtrarProducoes, ordenarPorId
} from './production-monitoring-filter.js';

const LOTES = [
    { id: 1, codigo_lote: 'NCK7891', pesoentrada_kg: 1200.5, status: 'Finalizado' },
    { id: 8, codigo_lote: 'LT-0008', pesoentrada_kg: 640.35, status: 'Recebido' },
    { id: 9, codigo_lote: 'ab/9', pesoentrada_kg: 100, status: 'DISPONIVEL' },
    { id: 10, pesoentrada_kg: 50, status: 'Disponível' }
];
const ESTEIRAS = [{ id: 1, nome_esteira: 'Esteira 01 - Triagem' }];
const PRODUCOES = [
    { id: 1, id_lote: 1, id_esteira: 1, turno_producao: 'Manhã' },
    { id: 11, id_lote: 8, id_esteira: 1, turno_producao: 'Manhã' },
    { id: 12, id_lote: 9, id_esteira: 7, turno_producao: 'Tarde' },
    { id: 2, id_lote: 10, id_esteira: 1 },
    { id: 3, id_lote: 99, id_esteira: 1, turno_producao: 'Noite' },
    { id: 4, id_lote: 8, id_esteira: 1, turno_producao: 'Noite', status: 'Cancelado' }
];
const LINHAS = montarLinhas(PRODUCOES, LOTES, ESTEIRAS);
const ids = (lista) => lista.map((l) => l.id);

describe('status', () => {
    it('compara sem acento nem caixa', () => {
        expect(chaveDoStatus('DISPONIVEL')).toBe('disponivel');
        expect(chaveDoStatus(' Disponível ')).toBe('disponivel');
        expect(normalizarTexto(null)).toBe('');
    });
    it('mostra o rótulo legível e mantém o texto de status desconhecido', () => {
        expect(rotuloDoStatus('RECEBIDO')).toBe('Recebido');
        expect(rotuloDoStatus('DISPONIVEL')).toBe('Disponível');
        expect(rotuloDoStatus('Cancelado')).toBe('Cancelado');
        expect(rotuloDoStatus(null)).toBe('');
    });
});

describe('montarLinhas', () => {
    it('mantém só produções com status Recebido ou Disponível (do lote), em qualquer caixa', () => {
        expect(ids(LINHAS)).toEqual([11, 12, 2]);
    });
    it('o status da produção, se existir, prevalece sobre o do lote', () => {
        expect(ids(montarLinhas(PRODUCOES, LOTES, ESTEIRAS))).not.toContain(4);
    });
    it('monta os campos da tabela', () => {
        expect(LINHAS[0]).toEqual({
            id: 11, id_lote: 8, codigo_lote: 'LT-0008', lote: '8 (LT-0008)', esteira: 'Esteira 01 - Triagem',
            turno: 'Manhã', peso_lote: 640.35, status: 'Recebido', chave_status: 'recebido'
        });
    });
    it('trata esteira, turno e código ausentes', () => {
        expect(LINHAS[1].esteira).toBe('Não informada');
        expect(LINHAS[2].turno).toBe('Não informado');
        expect(LINHAS[2].lote).toBe('10');
    });
    it('aceita listas vazias', () => {
        expect(montarLinhas([], [], [])).toEqual([]);
    });
});

describe('opcoesDeStatus', () => {
    it('lista só os status presentes, em ordem fixa', () => {
        expect(opcoesDeStatus(LINHAS)).toEqual([{ valor: 'recebido', rotulo: 'Recebido' }, { valor: 'disponivel', rotulo: 'Disponível' }]);
        expect(opcoesDeStatus(LINHAS.filter((l) => l.chave_status === 'disponivel'))).toEqual([{ valor: 'disponivel', rotulo: 'Disponível' }]);
    });
});

describe('filtrarProducoes', () => {
    it('sem critérios devolve tudo', () => {
        expect(filtrarProducoes(LINHAS)).toHaveLength(3);
    });
    it('número compara o ID da produção ou do lote por inteiro', () => {
        expect(ids(filtrarProducoes(LINHAS, { busca: '11' }))).toEqual([11]);
        expect(ids(filtrarProducoes(LINHAS, { busca: '8' }))).toEqual([11]);
        expect(filtrarProducoes(LINHAS, { busca: '1' })).toEqual([]);
    });
    it('texto acha parte do código do lote, sem diferenciar maiúsculas', () => {
        expect(ids(filtrarProducoes(LINHAS, { busca: 'lt-00' }))).toEqual([11]);
        expect(ids(filtrarProducoes(LINHAS, { busca: 'AB/' }))).toEqual([12]);
    });
    it('filtra por status e combina com a busca', () => {
        expect(ids(filtrarProducoes(LINHAS, { status: 'disponivel' }))).toEqual([12, 2]);
        expect(filtrarProducoes(LINHAS, { status: 'disponivel', busca: '11' })).toEqual([]);
    });
    it('lote sem código não quebra a busca por texto', () => {
        expect(() => filtrarProducoes(LINHAS, { busca: 'xyz' })).not.toThrow();
    });
});

describe('ordenarPorId', () => {
    it('ordena do menor para o maior ID sem alterar a lista original', () => {
        expect(ids(ordenarPorId(LINHAS))).toEqual([2, 11, 12]);
        expect(ids(LINHAS)).toEqual([11, 12, 2]);
    });
});
