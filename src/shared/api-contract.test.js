import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizarResposta, ROTAS_API, rotaApi, rotaPublica } from './api-contract.js';

describe('contrato da API EcoCycle', () => {
    it.each([
        ['/materiais', { materiais: [{ id_material: 2, tipo_material: 'metal' }] }, { id: 2 }],
        ['/fornecedores', { fornecedores: [{ id_fornecedor: 3, cnpj: '12345678000195' }] }, { id: 3, cnpj_fornecedor: '12345678000195' }],
        ['/lotes', { lotes: [{ id_lote: 4, peso_recebido_kg: '12.50', status_lote: 'Recebido' }] }, { id: 4, pesoentrada_kg: '12.50', status: 'Recebido' }],
        ['/esteiras', { esteiras: [{ id_esteira: 5 }] }, { id: 5 }],
        ['/producao', { registros_producao: [{ id_producao: 6, data_inicio: '2026-10-27T10:00:00', turno: 'Manhã', quantidade_saida_kg: '7.25', status_producao: 'Finalizado' }] }, { id: 6, data_hora: '2026-10-27T10:00:00', turno_producao: 'Manhã', peso_kg: '7.25', status: 'Finalizado' }],
        ['/telemetria/historico', { historico: [{ id_leitura_sensor: 8, id_esteira: 5, timestamp: '2026-10-27T10:00:00', temperatura: 35, peso: 10, status_registrado: 'NORMAL' }] }, { id: 8, datahora_leitura: '2026-10-27T10:00:00', temperatura_leitura_c: 35, peso_leitura_kg: 10, status_leitura: 'NORMAL' }],
        ['/alertas', { alertas: [{ id_alerta: 9, id_leitura_sensor: 8, data_hora_alerta: '2026-10-27T10:00:00', resolvido: 'SIM ' }] }, { id: 9, id_leitura: 8, datahora_alerta: '2026-10-27T10:00:00', resolvido: true }],
    ])('adapta o envelope e os campos de GET %s sem alterar a resposta original', (rota, resposta, esperado) => {
        const original = structuredClone(resposta);
        expect(normalizarResposta('GET', rota + '?teste=1', resposta)).toEqual([expect.objectContaining(esperado)]);
        expect(resposta).toEqual(original);
    });
    it.each(['SIM', 'sim', true, 'true', 'SIM '])('reconhece alerta resolvido: %s', (resolvido) => {
        expect(normalizarResposta('GET', '/alertas', { alertas: [{ resolvido }] })[0].resolvido).toBe(true);
    });
    it.each(['NAO', 'NÃO', false, 'false'])('reconhece alerta ativo: %s', (resolvido) => {
        expect(normalizarResposta('GET', '/alertas', { alertas: [{ resolvido }] })[0].resolvido).toBe(false);
    });
    it.each(Object.keys(ROTAS_API).filter((r) => ['/materiais', '/fornecedores', '/lotes', '/esteiras', '/producao', '/telemetria/historico', '/alertas'].includes(r)))('recusa envelope inválido em %s', (rota) => {
        for (const resposta of [null, {}, { dados: [] }]) expect(() => normalizarResposta('GET', rota, resposta)).toThrow('Resposta inválida');
    });
    it('desembrulha o lote criado com 201 para mostrar seu identificador', () => {
        expect(normalizarResposta('POST', '/lotes', { mensagem: 'ok', lote: { id_lote: 12 } })).toMatchObject({ id: 12 });
    });
    it('mantém os consolidados e o catálogo separados dos registros de produção', () => {
        const resposta = { balanco_massas_kg: { total_produzido_saida: 10 } };
        expect(normalizarResposta('GET', '/producao/dashboard-diario', resposta)).toBe(resposta);
        expect(normalizarResposta('GET', '/materiais', { materiais: [] })).toEqual([]);
    });
    it.each([
        ['/esteiras/status', '/esteiras/status'], ['/esteiras/7', '/esteiras/:id'], ['/producao/12?x=1', '/producao/:id'],
        ['/producao/materiais', '/producao/materiais'], ['/lotes/3', '/lotes/:id'], ['/alertas/9', '/alertas/:id'],
        ['/esteiras/0', null], ['/esteiras/abc', null], ['/lotes/3/extra', null], ['/fornecedores/1', null], ['/equipamentos', null],
    ])('resolve %s para a rota %s do contrato', (url, rota) => {
        expect(rotaApi(url)).toBe(rota);
    });
    it('desembrulha a entidade atualizada pelas rotas com identificador', () => {
        expect(normalizarResposta('PATCH', '/producao/6', { producao: { id_producao: 6, status_producao: 'Finalizado' } }))
            .toMatchObject({ id: 6, status: 'Finalizado' });
        expect(normalizarResposta('PATCH', '/lotes/4', { lote: { id_lote: 4, status_lote: 'Finalizado' } }))
            .toMatchObject({ id: 4, status: 'Finalizado' });
        expect(normalizarResposta('PATCH', '/alertas/9', { alerta: { id_alerta: 9, resolvido: 'SIM' } }))
            .toMatchObject({ id: 9, resolvido: true });
        expect(normalizarResposta('GET', '/esteiras/5', { esteira: { id_esteira: 5 } })).toMatchObject({ id: 5 });
    });
    it('somente login e diagnóstico são públicos', () => {
        for (const rota of Object.keys(ROTAS_API)) expect(rotaPublica(rota)).toBe(['/login', '/health/database'].includes(rota));
    });
    it('todas as chamadas literais das telas usam métodos e caminhos existentes', () => {
        const raiz = new URL('../', import.meta.url);
        function conferir(diretorio) {
            for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
                const arquivo = new URL(entrada.name + (entrada.isDirectory() ? '/' : ''), diretorio);
                if (entrada.isDirectory()) conferir(arquivo);
                else if (entrada.name.endsWith('.js') && !entrada.name.endsWith('.test.js')) {
                    const codigo = readFileSync(arquivo, 'utf8');
                    for (const chamada of codigo.matchAll(/API\.(GET|POST|PUT|PATCH|DELETE)\(['"`]([^'"`]+)/g)) {
                        // Em template literals, cada ${...} vira um identificador de exemplo.
                        const caminho = chamada[2].replace(/\$\{[^}]*\}/g, '1');
                        expect(ROTAS_API[rotaApi(caminho)], fileURLToPath(arquivo) + ' ' + caminho).toContain(chamada[1]);
                    }
                }
            }
        }
        conferir(raiz);
    });
});
