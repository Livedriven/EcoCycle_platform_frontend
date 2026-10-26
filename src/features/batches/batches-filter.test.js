import { describe, it, expect } from 'vitest';
import {
    normalizarTexto, montarLinhas, opcoesDeStatus, filtrarLotes,
    ordenarMaisRecentes, formatarPeso, classeDoStatus, textoContagem
} from './batches-filter.js';

const FORNECEDORES = [
    { id: 1, cnpj_fornecedor: '12345678000195', nome_fornecedor: 'Recicla Norte Ltda' },
    { id: 2, cnpj_fornecedor: '23456789000195', nome_fornecedor: 'Metalúrgica Vale Verde' }
];
const LOTES = [
    { id: 1, codigo_lote: 'LT-0001', id_fornecedor: 1, pesoentrada_kg: 2300, data_entrada: '2026-10-22T15:20:00', status: 'Recebido' },
    { id: 2, codigo_lote: 'ab/77', id_fornecedor: 2, pesoentrada_kg: 950, data_entrada: '2026-10-23T09:10:00', status: 'Em processamento' },
    { id: 10, codigo_lote: '1500', id_fornecedor: 2, pesoentrada_kg: 820.5, data_entrada: '2026-10-23T09:10:00', status: 'Recebido' },
    { id: 15, id_fornecedor: 9, pesoentrada_kg: 10, data_entrada: '2026-10-24T14:30:00', status: 'Finalizado' }
];
const LINHAS = montarLinhas(LOTES, FORNECEDORES);
const ids = (lista) => lista.map((l) => l.id);

describe('montarLinhas', () => {
    it('acrescenta o nome do fornecedor e só os campos da tabela', () => {
        expect(LINHAS[0]).toEqual({ id: 1, codigo_lote: 'LT-0001', fornecedor: 'Recicla Norte Ltda', pesoentrada_kg: 2300, data_entrada: '2026-10-22T15:20:00', status: 'Recebido' });
    });
    it('marca fornecedor que não existe', () => {
        expect(LINHAS[3].fornecedor).toBe('Fornecedor não identificado');
    });
    it('aceita o esquema antigo, com cnpj_fornecedor no lote', () => {
        const antigo = montarLinhas([{ id: 7, cnpj_fornecedor: '23456789000195', status: 'Recebido' }], FORNECEDORES);
        expect(antigo[0].fornecedor).toBe('Metalúrgica Vale Verde');
    });
        it('lote sem código fica com texto vazio', () => {
        expect(LINHAS[3].codigo_lote).toBe('');
    });
});

describe('opcoesDeStatus', () => {
    it('lista os status dos dados, sem repetir e em ordem alfabética', () => {
        expect(opcoesDeStatus(LINHAS)).toEqual(['Em processamento', 'Finalizado', 'Recebido']);
    });
});

describe('filtrarLotes', () => {
    it('sem critérios devolve tudo', () => {
        expect(filtrarLotes(LINHAS)).toHaveLength(4);
    });
    it('ID é exato: "1" acha o lote 1, não o 10 nem o 15', () => {
        expect(ids(filtrarLotes(LINHAS, { busca: '1' }))).toEqual([1]);
        expect(ids(filtrarLotes(LINHAS, { busca: '15' }))).toEqual([15]);
    });
    it('busca o fornecedor sem diferenciar acento e maiúsculas', () => {
        expect(ids(filtrarLotes(LINHAS, { busca: 'METALURGICA' }))).toEqual([2, 10]);
    });
    it('filtra por status e combina com a busca', () => {
        expect(ids(filtrarLotes(LINHAS, { status: 'Recebido' }))).toEqual([1, 10]);
        expect(ids(filtrarLotes(LINHAS, { status: 'Recebido', busca: 'vale' }))).toEqual([10]);
    });
    it('devolve lista vazia quando nada casa', () => {
        expect(filtrarLotes(LINHAS, { busca: 'inexistente' })).toEqual([]);
    });
        it('busca o código por parte do texto, sem diferenciar maiúsculas e símbolos', () => {
        expect(ids(filtrarLotes(LINHAS, { busca: 'lt-00' }))).toEqual([1]);
        expect(ids(filtrarLotes(LINHAS, { busca: 'AB/77' }))).toEqual([2]);
    });
    it('termo só com dígitos compara o código inteiro, não parte dele', () => {
        expect(ids(filtrarLotes(LINHAS, { busca: '1500' }))).toEqual([10]);
        expect(filtrarLotes(LINHAS, { busca: '150' })).toEqual([]);
    });
    it('lote sem código não quebra a busca', () => {
        expect(() => filtrarLotes(LINHAS, { busca: 'LT-00' })).not.toThrow();
    });
});

// Teste com a logica antiga da funcao ordernarMaisRecentes
// describe('ordenarMaisRecentes', () => {
//     it('ordena pela data de entrada e desempata pelo maior id, sem alterar a original', () => {
//         expect(ids(ordenarMaisRecentes(LINHAS))).toEqual([15, 10, 2, 1]);
//         expect(ids(LINHAS)).toEqual([1, 2, 10, 15]);
//     });
// });

describe('ordenarMaisRecentes', () => {
    it('ordena pelo maior id primeiro, sem alterar a original', () => {
        expect(ids(ordenarMaisRecentes(LINHAS))).toEqual([15, 10, 2, 1]);
        expect(ids(LINHAS)).toEqual([1, 2, 10, 15]);
    });

    it('ignora a data de entrada: lote cadastrado depois com data anterior continua no topo', () => {
        const linhas = [
            { id: 1, data_entrada: '2026-10-26T09:00:00' },
            { id: 2, data_entrada: '2026-10-25T15:00:00' }
        ];
        expect(ids(ordenarMaisRecentes(linhas))).toEqual([2, 1]);
    });
});

describe('formatarPeso', () => {
    it('usa sempre duas casas, no padrão brasileiro', () => {
        expect(formatarPeso(1450)).toBe('1.450,00 kg');
        expect(formatarPeso(820.5)).toBe('820,50 kg');
        expect(formatarPeso('3120')).toBe('3.120,00 kg');
    });
    it('devolve vazio para valor ausente ou inválido', () => {
        expect(formatarPeso(null)).toBe('');
        expect(formatarPeso('abc')).toBe('');
        expect(formatarPeso(undefined)).toBe('');
    });
});

describe('classeDoStatus', () => {
    it.each([['Recebido', 'b-sucesso'], ['Disponível', 'b-sucesso'], ['Em processamento', 'b-info'], ['Em triagem', 'b-info'], ['Finalizado', 'b-suave'], ['Outro', 'b-suave'], [null, 'b-suave']])('%s -> %s', (status, classe) => {
        expect(classeDoStatus(status)).toBe(classe);
    });
});

describe('textoContagem', () => {
    it('trata singular, plural e filtro', () => {
        expect(textoContagem(1, 1)).toBe('Exibindo 1 lote cadastrado');
        expect(textoContagem(5, 5)).toBe('Exibindo 5 lotes cadastrados');
        expect(textoContagem(2, 5)).toBe('Exibindo 2 de 5 lotes');
    });
});

describe('normalizarTexto', () => {
    it('ignora acento, maiúsculas e espaços nas pontas', () => {
        expect(normalizarTexto('  Metalúrgica ')).toBe('metalurgica');
        expect(normalizarTexto(null)).toBe('');
    });
});
