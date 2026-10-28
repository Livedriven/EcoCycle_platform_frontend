import { describe, it, expect } from 'vitest';
import {
    validarObrigatorio, validarOpcao, validarProducao,
    validarTexto, validarCnpj, validarTelefone, validarEmail, validarFornecedor,
    limitesDataEntrada, validarPeso, validarDataEntrada, validarLote,
    TAMANHO_MAXIMO_CODIGO_LOTE
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

describe('validarPeso', () => {
    it.each([1, '1250.50', 0.01, '0.5'])('aceita %s', (peso) => {
        expect(validarPeso(peso)).toEqual({ valido: true, mensagem: '' });
    });
    it.each([['zero', 0], ['negativo', -3], ['texto', 'abc'], ['vazio', ''], ['null', null], ['espaços', '  '], ['infinito', Infinity]])('rejeita %s', (_, peso) => {
        expect(validarPeso(peso)).toEqual({ valido: false, mensagem: 'Informe um peso maior que zero.' });
    });
});

describe('limitesDataEntrada e validarDataEntrada', () => {
    const AGORA = new Date(2026, 9, 24, 10, 30); // 24/10/2026 10:30, calendário local

    it('os limites são ontem e hoje', () => {
        expect(limitesDataEntrada(AGORA)).toEqual({ min: '2026-10-23', max: '2026-10-24' });
    });
    it('aceita hoje e ontem', () => {
        expect(validarDataEntrada('2026-10-24', AGORA).valido).toBe(true);
        expect(validarDataEntrada('2026-10-23', AGORA).valido).toBe(true);
    });
    it('rejeita anteontem e antes', () => {
        expect(validarDataEntrada('2026-10-22', AGORA)).toEqual({ valido: false, mensagem: 'A data de entrada não pode ser anterior a ontem.' });
    });
    it('rejeita data futura', () => {
        expect(validarDataEntrada('2026-10-25', AGORA)).toEqual({ valido: false, mensagem: 'A data de entrada não pode ser futura.' });
    });
    it.each([['vazio', ''], ['null', null], ['formato brasileiro', '24/10/2026'], ['dia inexistente', '2026-02-30'], ['mês inexistente', '2026-13-01']])('rejeita %s', (_, data) => {
        expect(validarDataEntrada(data, AGORA)).toEqual({ valido: false, mensagem: 'Informe uma data de entrada válida.' });
    });
    it('"ontem" atravessa a virada de mês e de ano', () => {
        const primeiroDoMes = new Date(2026, 2, 1, 0, 5);
        expect(validarDataEntrada('2026-02-28', primeiroDoMes).valido).toBe(true);
        expect(validarDataEntrada('2026-02-27', primeiroDoMes).valido).toBe(false);
        expect(limitesDataEntrada(new Date(2027, 0, 1, 9, 0)).min).toBe('2026-12-31');
    });
    it('usa a data local, não a UTC (23h no Brasil já é o dia seguinte em UTC)', () => {
        expect(limitesDataEntrada(new Date(2026, 9, 24, 23, 30)).max).toBe('2026-10-24');
    });
});

describe('validarLote', () => {
    const AGORA = new Date(2026, 9, 24, 10, 30);
    const ok = { codigo_lote: 'LT-0001', id_fornecedor: '3', pesoentrada_kg: '640.35', data_entrada: '2026-10-24' };
    it('aceita dados completos', () => {
        expect(validarLote(ok, { agora: AGORA })).toEqual({ valido: true, erros: {} });
    });
    it('respeita os limites de código e decimal do schema PostgreSQL', () => {
        expect(validarLote({ ...ok, codigo_lote: 'A'.repeat(16) }, { agora: AGORA }).erros.codigo_lote).toBeDefined();
        for (const pesoentrada_kg of ['100000000', '1.234']) {
            expect(validarLote({ ...ok, pesoentrada_kg }, { agora: AGORA }).erros.pesoentrada_kg).toBeDefined();
        }
        expect(validarLote({ ...ok, codigo_lote: 'A'.repeat(15), pesoentrada_kg: '99999999.99' }, { agora: AGORA }).valido).toBe(true);
    });
    it('devolve todos os erros de uma vez', () => {
        const r = validarLote({ codigo_lote: '', id_fornecedor: '', pesoentrada_kg: '0', data_entrada: '' }, { agora: AGORA });
        expect(Object.keys(r.erros)).toEqual(['codigo_lote', 'id_fornecedor', 'pesoentrada_kg', 'data_entrada']);
    });
    it('rejeita data antiga e peso negativo', () => {
        const r = validarLote({ ...ok, pesoentrada_kg: '-1', data_entrada: '2026-10-01' }, { agora: AGORA });
        expect(r.erros.pesoentrada_kg).toBeDefined();
        expect(r.erros.data_entrada).toBe('A data de entrada não pode ser anterior a ontem.');
    });
    it('exige o código, mas não confere o formato', () => {
        expect(validarLote({ ...ok, codigo_lote: '   ' }, { agora: AGORA }).erros.codigo_lote).toBe('Código do lote é obrigatório.');
        expect(validarLote({ ...ok, codigo_lote: null }, { agora: AGORA }).erros.codigo_lote).toBeDefined();
    });
    it.each(['LT-2026-0001', 'abc123', '12/34 - Ü*', 'A'])('aceita o código "%s"', (codigo) => {
        expect(validarLote({ ...ok, codigo_lote: codigo }, { agora: AGORA }).valido).toBe(true);
    });
    it('limita o código a 15 caracteres, contados depois de tirar os espaços das pontas', () => {
        expect(validarLote({ ...ok, codigo_lote: 'A'.repeat(15) }, { agora: AGORA }).valido).toBe(true);
        expect(validarLote({ ...ok, codigo_lote: '  ' + 'A'.repeat(15) + '  ' }, { agora: AGORA }).valido).toBe(true);
        expect(validarLote({ ...ok, codigo_lote: 'A'.repeat(16) }, { agora: AGORA }).erros.codigo_lote)
            .toBe('Código do lote deve ter no máximo 15 caracteres.');
    });
    it('exporta o limite do código', () => {
        expect(TAMANHO_MAXIMO_CODIGO_LOTE).toBe(15);
    });
});
