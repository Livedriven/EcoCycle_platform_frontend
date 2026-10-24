import { describe, it, expect } from 'vitest';
import { classeAlerta, classeStatus, classeContadorAlertas } from './ui.js';

describe('cores dos alertas', () => {
    it.each(['Temperatura crítica', 'Temperatura critico', ' CRÍTICO ', 'Críticas'])('%s é vermelho', (tipo) => {
        expect(classeAlerta(tipo)).toBe('b-perigo');
    });

    it.each(['Temperatura alta', 'Peso fora do limite', 'Material não identificado', '', undefined])('%s usa o aviso do conveyor', (tipo) => {
        expect(classeAlerta(tipo)).toBe('b-aviso');
    });

    it.each([[0, 'b-sucesso'], [1, 'b-perigo'], [12, 'b-perigo']])('contador %s usa %s', (quantidade, classe) => {
        expect(classeContadorAlertas(quantidade)).toBe(classe);
    });
});

describe('cores de situação', () => {
    it.each([
        ['Normal', 'b-sucesso'], ['Ativa', 'b-sucesso'], ['Finalizado', 'b-sucesso'],
        ['Atenção', 'b-aviso'], ['Manutenção', 'b-aviso'], ['Em processamento', 'b-aviso'],
        ['Crítico', 'b-perigo'], ['Parada', 'b-perigo'], ['Recebido', 'b-info'],
        [' ATENCAO ', 'b-aviso'], ['desconhecido', 'b-suave'], [undefined, 'b-suave']
    ])('%s usa %s em qualquer tela', (status, classe) => {
        expect(classeStatus(status)).toBe(classe);
    });
});
