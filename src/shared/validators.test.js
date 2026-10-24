import { describe, it, expect } from 'vitest';
import {
    validarObrigatorio, validarOpcao, validarProducao,
    validarTexto, validarCnpj, validarTelefone, validarEmail, validarFornecedor
} from './validators.js';

const TURNOS = ['Manhã', 'Tarde', 'Noite'];

describe('validarObrigatorio', () => {
    it('aceita valor preenchido', () => {
        expect(validarObrigatorio('3', 'Lote')).toEqual({ valido: true, mensagem: '' });
    });
    it.each([['vazio', ''], ['null', null], ['espaços', '   ']])('rejeita %s', (_, valor) => {
        expect(validarObrigatorio(valor, 'Lote')).toEqual({ valido: false, mensagem: 'Lote é obrigatório.' });
    });
});

describe('validarOpcao', () => {
    it('aceita opção da lista', () => expect(validarOpcao('Tarde', TURNOS, 'um turno').valido).toBe(true));
    it('rejeita opção fora da lista', () => expect(validarOpcao('Madrugada', TURNOS, 'um turno').valido).toBe(false));
});

describe('validarProducao', () => {
    const ok = { id_lote: '8', id_esteira: '1', turno_producao: 'Manhã' };
    it('aceita dados completos', () => {
        expect(validarProducao(ok, { turnos: TURNOS })).toEqual({ valido: true, erros: {} });
    });
    it('devolve todos os erros de uma vez', () => {
        const r = validarProducao({ id_lote: '', id_esteira: '', turno_producao: '' }, { turnos: TURNOS });
        expect(r.valido).toBe(false);
        expect(Object.keys(r.erros)).toEqual(['id_lote', 'id_esteira', 'turno_producao']);
    });
    it('rejeita turno fora da lista', () => {
        expect(validarProducao({ ...ok, turno_producao: 'Madrugada' }, { turnos: TURNOS }).erros.turno_producao).toBeDefined();
    });
});

describe('validarTexto', () => {
    it('aceita texto dentro dos limites', () => {
        expect(validarTexto('Ab', 'Nome', 2, 5).valido).toBe(true);
    });
    it('ignora espaços nas extremidades', () => {
        expect(validarTexto('  A  ', 'Nome', 2, 5).valido).toBe(false);
    });
    it('rejeita texto curto e longo demais', () => {
        expect(validarTexto('A', 'Nome', 2, 5).mensagem).toBe('Nome deve ter pelo menos 2 caracteres.');
        expect(validarTexto('abcdef', 'Nome', 2, 5).mensagem).toBe('Nome deve ter no máximo 5 caracteres.');
    });
});

describe('validarCnpj', () => {
    it.each(['12345678000195', '12.345.678/0001-95', '11.222.333/0001-81'])('aceita %s', (cnpj) => {
        expect(validarCnpj(cnpj).valido).toBe(true);
    });
    it.each([['dígito errado', '12345678000196'], ['curto', '123'], ['repetido', '00000000000000'], ['vazio', ''], ['null', null], ['letras', 'abcdefghijklmn']])('rejeita %s', (_, cnpj) => {
        expect(validarCnpj(cnpj)).toEqual({ valido: false, mensagem: 'Informe um CNPJ válido.' });
    });
});

describe('validarTelefone', () => {
    it.each(['', null, '31988810001', '(31) 8881-0001', '3188810001'])('aceita %s', (tel) => {
        expect(validarTelefone(tel).valido).toBe(true);
    });
    it.each(['123', '31988810', '319888100011'])('rejeita %s', (tel) => {
        expect(validarTelefone(tel).valido).toBe(false);
    });
});

describe('validarEmail', () => {
    it.each(['', null, 'contato@empresa.com.br'])('aceita %s', (email) => {
        expect(validarEmail(email).valido).toBe(true);
    });
    it.each(['semarroba', 'a@b', 'a b@c.com'])('rejeita %s', (email) => {
        expect(validarEmail(email)).toEqual({ valido: false, mensagem: 'Informe um e-mail válido.' });
    });
});

describe('validarFornecedor', () => {
    const ok = { nome_fornecedor: 'Recicla Norte Ltda', cnpj_fornecedor: '12345678000195' };
    it('aceita só nome e CNPJ', () => {
        expect(validarFornecedor(ok)).toEqual({ valido: true, erros: {} });
    });
    it('aceita todos os campos preenchidos', () => {
        const dados = { ...ok, telefone_fornecedor: '31988810001', email_fornecedor: 'a@b.com', endereco_fornecedor: 'Rua das Acácias, 120' };
        expect(validarFornecedor(dados).valido).toBe(true);
    });
    it('devolve todos os erros de uma vez', () => {
        const r = validarFornecedor({ nome_fornecedor: '', cnpj_fornecedor: '', telefone_fornecedor: '1', email_fornecedor: 'x' });
        expect(Object.keys(r.erros)).toEqual(['nome_fornecedor', 'cnpj_fornecedor', 'telefone_fornecedor', 'email_fornecedor']);
    });
    it('rejeita CNPJ com dígito verificador errado', () => {
        expect(validarFornecedor({ ...ok, cnpj_fornecedor: '12345678000196' }).erros.cnpj_fornecedor).toBeDefined();
    });
});