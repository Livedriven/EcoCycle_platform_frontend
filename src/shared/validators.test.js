import { describe, it, expect } from 'vitest';
import { validarObrigatorio, validarOpcao, validarProducao } from './validators.js';

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