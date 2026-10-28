import { describe, expect, it } from 'vitest';
import { montarPayloadFornecedor, validarCadastroFornecedor } from './supplier-payload.js';

const dados = { id_fornecedor: '7', nome_fornecedor: ' EcoCycle ', cnpj_fornecedor: '12.345.678/0001-95', telefone_fornecedor: '(31) 98888-7777', email_fornecedor: ' contato@example.com ', endereco_fornecedor: ' Rua A, 10 ' };
describe('cadastro de fornecedor no backend PostgreSQL', () => {
    it('envia somente os campos aceitos, com código manual e CNPJ sem máscara', () => {
        expect(validarCadastroFornecedor(dados).valido).toBe(true);
        expect(montarPayloadFornecedor(dados)).toEqual({ id_fornecedor: 7, nome_fornecedor: 'EcoCycle', cnpj: '12345678000195', telefone_fornecedor: '31988887777', email_fornecedor: 'contato@example.com', endereco_fornecedor: 'Rua A, 10' });
    });
    it.each(['', '0', '-1', '1.5', '2147483648'])('recusa código inválido %s', (id_fornecedor) => {
        expect(validarCadastroFornecedor({ ...dados, id_fornecedor }).erros.id_fornecedor).toBeDefined();
    });
    it.each(['telefone_fornecedor', 'email_fornecedor', 'endereco_fornecedor'])('exige %s', (campo) => {
        expect(validarCadastroFornecedor({ ...dados, [campo]: '' }).erros[campo]).toContain('obrigatório');
    });
    it.each(['email_fornecedor', 'endereco_fornecedor'])('respeita o limite de 100 caracteres em %s', (campo) => {
        expect(validarCadastroFornecedor({ ...dados, [campo]: 'a'.repeat(101) }).valido).toBe(false);
    });
});
