import { describe, it, expect } from 'vitest';
import {
    lerIdDaUrl, lerData, duracaoEmSegundos, formatarDuracao, calcularProgresso,
    ultimaLeitura, contarAlertasAtivos, montarMonitoramento
} from './production-progress-data.js';

describe('lerIdDaUrl', () => {
    it.each([['?producao=12', 12], ['?x=1&producao=7', 7]])('aceita %s', (busca, esperado) => {
        expect(lerIdDaUrl(busca)).toBe(esperado);
    });
    it.each(['', '?producao=', '?producao=0', '?producao=-3', '?producao=1.5', '?producao=abc', '?producao=1e3',
        '?producao=12abc', '?producao=007', '?producao=99999999999999999999', '?producao=%3Cscript%3E', '?outro=5'])('recusa "%s"', (busca) => {
        expect(lerIdDaUrl(busca)).toBeNull();
    });
});

describe('lerData', () => {
    it('data sem hora e data com hora, no horário local', () => {
        const so = lerData('2026-10-26');
        expect(so.temHora).toBe(false);
        expect([so.data.getFullYear(), so.data.getMonth(), so.data.getDate()]).toEqual([2026, 9, 26]);
        const com = lerData('2026-10-26T09:20:05');
        expect(com.temHora).toBe(true);
        expect([com.data.getHours(), com.data.getMinutes(), com.data.getSeconds()]).toEqual([9, 20, 5]);
    });
    it('aceita fuso explícito', () => {
        expect(lerData('2026-10-26T12:00:00Z')).toMatchObject({ temHora: true });
    });
    it.each(['', null, 'ontem', '2026-02-30', '2026-10-26T25:00:00', '26/10/2026'])('recusa %s', (texto) => {
        expect(lerData(texto)).toBeNull();
    });
});

describe('tempo em operação', () => {
    const AGORA = new Date(2026, 9, 26, 9, 54, 0);
    it('conta desde o início, com hora', () => {
        expect(duracaoEmSegundos('2026-10-26T09:20:00', AGORA)).toBe(2040);
    });
    it('início no futuro vira zero; sem hora ou inválido vira null', () => {
        expect(duracaoEmSegundos('2026-10-26T10:30:00', AGORA)).toBe(0);
        expect(duracaoEmSegundos('2026-10-26', AGORA)).toBeNull();
        expect(duracaoEmSegundos(null, AGORA)).toBeNull();
    });
    it('formata em HH:MM:SS', () => {
        expect(formatarDuracao(2040)).toBe('00:34:00');
        expect(formatarDuracao(3661)).toBe('01:01:01');
        expect(formatarDuracao(360000)).toBe('100:00:00');
        expect(formatarDuracao(null)).toBe('');
    });
});

describe('calcularProgresso', () => {
    it('calcula processado, restante e percentual', () => {
        expect(calcularProgresso(1000, 680)).toEqual({ total: 1000, processado: 680, restante: 320, percentual: 68, excedeu: false });
    });
    it('arredonda o percentual para baixo e só marca 100% ao atingir o peso', () => {
        expect(calcularProgresso(1200.5, 822.8).percentual).toBe(68);
        expect(calcularProgresso(1000, 999.9).percentual).toBe(99);
        expect(calcularProgresso(100, 100).percentual).toBe(100);
    });
    it('acima do peso do lote: restante zero e percentual 100', () => {
        expect(calcularProgresso(100, 150)).toMatchObject({ restante: 0, percentual: 100, excedeu: true });
    });
    it('sem peso do lote válido não há progresso', () => {
        expect(calcularProgresso(0, 10)).toBeNull();
        expect(calcularProgresso(null, 10)).toBeNull();
        expect(calcularProgresso(undefined, 10)).toBeNull();
        expect(calcularProgresso('abc', 10)).toBeNull();
    });
    it('peso processado ausente ou negativo vira zero', () => {
        expect(calcularProgresso(100, null)).toMatchObject({ processado: 0, percentual: 0 });
        expect(calcularProgresso(100, -5)).toMatchObject({ processado: 0, restante: 100 });
    });
});

const LEITURAS = [
    { id: 1, id_esteira: 1, status_leitura: 'Normal', datahora_leitura: '2026-10-20T08:00:00' },
    { id: 2, id_esteira: 1, status_leitura: 'Atenção', datahora_leitura: '2026-10-21T10:00:00' },
    { id: 3, id_esteira: 2, status_leitura: 'Crítico', datahora_leitura: '2026-10-22T10:00:00' }
];
const ALERTAS = [
    { id: 1, id_leitura: 2, resolvido: 'false' },
    { id: 2, id_leitura: 1, resolvido: 'true' },
    { id: 3, id_leitura: 3, resolvido: 'false' }
];

describe('sensores', () => {
    it('última leitura da esteira, por data e depois por id', () => {
        expect(ultimaLeitura(LEITURAS, 1).id).toBe(2);
        const empate = [{ id: 5, id_esteira: 1, datahora_leitura: 'x' }, { id: 6, id_esteira: 1, datahora_leitura: 'x' }];
        expect(ultimaLeitura(empate, 1).id).toBe(6);
        expect(ultimaLeitura(LEITURAS, 99)).toBeNull();
        expect(ultimaLeitura(undefined, 1)).toBeNull();
    });
    it('conta só alertas não resolvidos desta esteira (aceita "false" em texto)', () => {
        expect(contarAlertasAtivos(ALERTAS, LEITURAS, 1)).toBe(1);
        expect(contarAlertasAtivos(ALERTAS, LEITURAS, 2)).toBe(1);
        expect(contarAlertasAtivos(ALERTAS, LEITURAS, 99)).toBe(0);
    });
});

describe('montarMonitoramento', () => {
    const DADOS = {
        producoes: [
            { id: 11, id_lote: 8, id_esteira: 1, turno_producao: 'Manhã', data_hora: '2026-10-26T09:20:00' },
            { id: 12, id_lote: 8, id_esteira: 1, tipo_material: 'Metal', peso_kg: 100.5, data_hora: '2026-10-26', turno_producao: 'Manhã' },
            { id: 13, id_lote: 8, id_esteira: 1, tipo_material: 'Plástico', peso_kg: 50, data_hora: '2026-10-26', turno_producao: 'Manhã' },
            { id: 14, id_lote: 8, id_esteira: 1, tipo_material: 'Rejeito', peso_kg: 10, data_hora: '2026-10-26', turno_producao: 'Manhã' },
            { id: 20, id_lote: 9, id_esteira: 1, tipo_material: 'Metal', peso_kg: 999, data_hora: '2026-10-26', turno_producao: 'Manhã' }
        ],
        lotes: [
            { id: 8, codigo_lote: 'LT-0008', pesoentrada_kg: 640.35, status: 'Recebido' },
            { id: 9, codigo_lote: 'LT-0009', pesoentrada_kg: 500, status: 'Recebido' }
        ],
        esteiras: [{ id: 1, nome_esteira: 'Esteira 01 - Triagem', status_esteira: 'Ativa', velocidade_esteira_kmh: 2.4, temperatura_esteira_c: 38.5 }],
        leituras: LEITURAS,
        alertas: ALERTAS
    };

    it('monta produção, lote, progresso, esteira, sensores e materiais', () => {
        expect(montarMonitoramento(DADOS, 11)).toEqual({
            producao: { id: 11, id_lote: 8, turno: 'Manhã', inicio: '2026-10-26T09:20:00' },
            lote: { id: 8, codigo: 'LT-0008', pesoTotal: 640.35, status: 'Recebido' },
            progresso: { total: 640.35, processado: 160.5, restante: 479.85, percentual: 25, excedeu: false },
            esteira: { nome: 'Esteira 01 - Triagem', status: 'Ativa', velocidade_kmh: 2.4, temperatura_c: 38.5 },
            sensores: { ultima: { status: 'Atenção', data: '2026-10-21T10:00:00' }, alertasAtivos: 1 },
            materiais: [
                { material: 'Plástico', peso: 50 }, { material: 'Metal', peso: 100.5 },
                { material: 'Alumínio', peso: 0 }, { material: 'Rejeito', peso: 10 }
            ]
        });
    });
    it('não mistura registros de outro lote', () => {
        expect(montarMonitoramento(DADOS, 20).progresso.processado).toBe(999);
        expect(montarMonitoramento(DADOS, 11).materiais.find((m) => m.material === 'Metal').peso).toBe(100.5);
    });
    it('produção inexistente devolve null', () => {
        expect(montarMonitoramento(DADOS, 999)).toBeNull();
        expect(montarMonitoramento({}, 1)).toBeNull();
    });
    it('lote ou esteira ausentes não quebram', () => {
        const semLote = montarMonitoramento({ ...DADOS, lotes: [] }, 11);
        expect(semLote.lote).toBeNull();
        expect(semLote.progresso).toBeNull();
        const semEsteira = montarMonitoramento({ ...DADOS, esteiras: [] }, 11);
        expect(semEsteira.esteira).toBeNull();
        expect(semEsteira.sensores).toBeNull();
    });
    it('sem registros de material o processado é zero, e todos os materiais aparecem', () => {
        const so = montarMonitoramento({ ...DADOS, producoes: [DADOS.producoes[0]] }, 11);
        expect(so.progresso.processado).toBe(0);
        expect(so.materiais.map((m) => m.peso)).toEqual([0, 0, 0, 0]);
    });
    it('não altera os dados recebidos', () => {
        const copia = JSON.stringify(DADOS);
        montarMonitoramento(DADOS, 11);
        expect(JSON.stringify(DADOS)).toBe(copia);
    });
});
