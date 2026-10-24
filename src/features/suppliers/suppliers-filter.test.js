import { describe, it, expect } from 'vitest';
import {
    normalizarTexto, somenteDigitos, extrairCidade, opcoesDeCidade,
    filtrarFornecedores, ordenarMaisRecentes, textoContagem
} from './suppliers-filter.js';

const LISTA = [
    { id: 1, nome_fornecedor: 'Recicla Norte Ltda', cnpj_fornecedor: '12345678000195', telefone_fornecedor: '31988810001', email_fornecedor: 'contato@reciclanorte.example.com', endereco_fornecedor: 'Rua das Acácias, 120 - Distrito Industrial, Contagem/MG' },
    { id: 2, nome_fornecedor: 'Metalúrgica Vale Verde', cnpj_fornecedor: '23456789000195', telefone_fornecedor: '31988820002', email_fornecedor: 'comercial@valeverde.example.com', endereco_fornecedor: 'Av. Industrial, 850 - Jardim Primavera, Betim/MG' },
    { id: 3, nome_fornecedor: 'Cooperativa Cata-Forte', cnpj_fornecedor: '34567801000155', telefone_fornecedor: null, email_fornecedor: null, endereco_fornecedor: 'Av. Brasil, 10, São Paulo - SP' },
    { id: 4, nome_fornecedor: 'Sem Endereço Ltda', cnpj_fornecedor: '45678912000155', telefone_fornecedor: '', email_fornecedor: '', endereco_fornecedor: '' }
];
const ids = (lista) => lista.map((f) => f.id);

describe('normalizarTexto e somenteDigitos', () => {
    it('ignora acento, maiúsculas e espaços nas pontas', () => {
        expect(normalizarTexto('  Metalúrgica ')).toBe('metalurgica');
        expect(normalizarTexto(null)).toBe('');
    });
    it('mantém só os dígitos', () => {
        expect(somenteDigitos('(31) 98881-0001')).toBe('31988810001');
        expect(somenteDigitos(undefined)).toBe('');
    });
});

describe('extrairCidade', () => {
    it.each([
        ['Rua das Acácias, 120 - Distrito Industrial, Contagem/MG', 'Contagem/MG'],
        ['Av. Brasil, 10, São Paulo - SP', 'São Paulo/SP'],
        ['Praça da Matriz, 7 - Centro, Ribeirão das Neves/MG', 'Ribeirão das Neves/MG'],
        ['Contagem/MG', 'Contagem/MG']
    ])('lê a cidade de "%s"', (endereco, esperado) => {
        expect(extrairCidade(endereco)).toBe(esperado);
    });
    it.each([['sem UF', 'Rua A, 12 - Centro'], ['vazio', ''], ['null', null]])('devolve vazio para %s', (_, endereco) => {
        expect(extrairCidade(endereco)).toBe('');
    });
});

describe('opcoesDeCidade', () => {
    it('lista cidades distintas em ordem alfabética, ignorando endereços fora do padrão', () => {
        expect(opcoesDeCidade(LISTA)).toEqual(['Betim/MG', 'Contagem/MG', 'São Paulo/SP']);
    });
});

describe('filtrarFornecedores', () => {
    it('sem critérios devolve tudo', () => {
        expect(filtrarFornecedores(LISTA)).toHaveLength(4);
    });
    it('busca no nome sem diferenciar acento e maiúsculas', () => {
        expect(ids(filtrarFornecedores(LISTA, { busca: 'METALURGICA' }))).toEqual([2]);
    });
    it('busca no e-mail', () => {
        expect(ids(filtrarFornecedores(LISTA, { busca: 'reciclanorte' }))).toEqual([1]);
    });
    it('busca CNPJ com ou sem máscara', () => {
        expect(ids(filtrarFornecedores(LISTA, { busca: '12.345.678' }))).toEqual([1]);
        expect(ids(filtrarFornecedores(LISTA, { busca: '12345678000195' }))).toEqual([1]);
    });
    it('busca telefone com ou sem máscara', () => {
        expect(ids(filtrarFornecedores(LISTA, { busca: '(31) 98881' }))).toEqual([1]);
    });
    it('poucos dígitos não casam com CNPJ ou telefone', () => {
        expect(filtrarFornecedores(LISTA, { busca: '31' })).toEqual([]);
    });
    it('filtra por cidade e combina com a busca', () => {
        expect(ids(filtrarFornecedores(LISTA, { cidade: 'Betim/MG' }))).toEqual([2]);
        expect(filtrarFornecedores(LISTA, { cidade: 'Betim/MG', busca: 'norte' })).toEqual([]);
    });
    it('aceita registros com campos nulos', () => {
        expect(() => filtrarFornecedores(LISTA, { busca: 'x' })).not.toThrow();
    });
});

describe('ordenarMaisRecentes', () => {
    it('ordena por id decrescente sem alterar a lista original', () => {
        expect(ids(ordenarMaisRecentes(LISTA))).toEqual([4, 3, 2, 1]);
        expect(ids(LISTA)).toEqual([1, 2, 3, 4]);
    });
});

describe('textoContagem', () => {
    it('trata singular, plural e filtro', () => {
        expect(textoContagem(1, 1)).toBe('Exibindo 1 fornecedor cadastrado');
        expect(textoContagem(4, 4)).toBe('Exibindo 4 fornecedores cadastrados');
        expect(textoContagem(2, 5)).toBe('Exibindo 2 de 5 fornecedores');
    });
});
