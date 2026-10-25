import { describe, expect, it } from 'vitest';
import { filtrarEsteiras, dadosDaEsteira, numeroComUnidade, dataManutencao, urlStatus } from './conveyor-data.js';

const esteiras = [
    { id: 1, nome_esteira: 'Triagem', tipo_esteira: 'Separação', local_esteira: 'Galpão A', status_esteira: 'Ativa' },
    { id: 'linha-b', nome_esteira: 'Esteira B', status_esteira: 'Manutenção' }
];

describe('consulta de esteiras', () => {
    it('busca sem diferenciar acentos, espaços externos ou maiúsculas', () => {
        expect(filtrarEsteiras(esteiras, ' GALPAO ')).toEqual([esteiras[0]]);
        expect(filtrarEsteiras(esteiras, 'separacao')).toEqual([esteiras[0]]);
        expect(filtrarEsteiras(esteiras, 'manutencao')).toEqual([esteiras[1]]);
        expect(filtrarEsteiras(esteiras, 'linha-b')).toEqual([esteiras[1]]);
    });
    it('aceita campos opcionais ausentes, busca vazia e nenhum resultado', () => {
        expect(filtrarEsteiras(esteiras, '')).toEqual(esteiras);
        expect(filtrarEsteiras(esteiras, 'inexistente')).toEqual([]);
        expect(filtrarEsteiras([], '')).toEqual([]);
    });
    it('mantém o ID textual ao encaminhar para o status', () => {
        const url = new URL(urlStatus('linha/b & 2'), 'http://localhost/');
        expect(url.searchParams.get('esteira')).toBe('linha/b & 2');
        expect(url.pathname).toBe('/conveyor-status.html');
    });
    it('diferencia dados ausentes de equipamentos parados com velocidade zero', () => {
        expect(numeroComUnidade(0, 'km/h')).toBe('0 km/h');
        expect(numeroComUnidade(2.4, 'km/h')).toBe('2,4 km/h');
        for (const valor of [null, undefined, '', ' ', 'inválido']) {
            expect(numeroComUnidade(valor, '°C')).toBe('Não informado');
        }
        expect(dataManutencao(null)).toBe('Não informada');
        expect(dataManutencao('inválida')).toBe('Não informada');
        expect(dataManutencao('2026-10-20')).toBe('20/10/2026');
    });
});

describe('status de múltiplas esteiras', () => {
    const leituras = [
        { id: 10, id_esteira: 1, datahora_leitura: '2026-10-20T09:00:00' },
        { id: '11', id_esteira: '1', datahora_leitura: '2026-10-21T09:00:00' },
        { id: 12, id_esteira: 'linha-b', datahora_leitura: '2026-10-22T09:00:00' }
    ];
    const alertas = [
        { id: 1, id_leitura: '10', resolvido: false },
        { id: 2, id_leitura: 11, resolvido: 'false' },
        { id: 3, id_leitura: 11, resolvido: true },
        { id: 4, id_leitura: 11, resolvido: 'true' },
        { id: 5, id_leitura: '12', resolvido: false },
        { id: 6, id_leitura: 999, resolvido: false }
    ];
    it('isola leituras e alertas, normaliza IDs e ordena leituras sem alterar a fonte', () => {
        const primeira = dadosDaEsteira('1', leituras, alertas);
        expect(primeira.leituras.map((leitura) => leitura.id)).toEqual(['11', 10]);
        expect(primeira.alertas.map((alerta) => alerta.id)).toEqual([1, 2]);
        const segunda = dadosDaEsteira('linha-b', leituras, alertas);
        expect(segunda.leituras).toEqual([leituras[2]]);
        expect(segunda.alertas).toEqual([alertas[4]]);
        expect(leituras[0].id).toBe(10);
    });
    it('não herda registros ao selecionar uma esteira sem leituras', () => {
        expect(dadosDaEsteira('sem-sensor', leituras, alertas)).toEqual({ leituras: [], alertas: [] });
    });
});
