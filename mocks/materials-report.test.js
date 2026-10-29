import { createRequire } from 'node:module';
import { once } from 'node:events';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { criarServidorMock } = require('./server.cjs');
const seed = require('./db.json');
let servidor, base, token;

beforeAll(async () => {
    const dados = {
        ...seed,
        usuarios: [...seed.usuarios, { ...seed.usuarios.find((u) => u.login_usuario === 'admin'), id: 9999, login_usuario: 'consulta-dashboard', nivel_acesso: 'CONSULTA' }],
        materiais: [{ id_material: 1, tipo_material: 'plastico' }, { id_material: 2, tipo_material: 'metal' }, { id_material: 3, tipo_material: 'aluminio' }],
        producao: [
            { id_producao: 1, id_lote: 10, id_esteira: 2, data_inicio: '2026-10-27T23:00:00', quantidade_saida_kg: 80, rejeito_kg: 20,
                itens: [
                    { id_item_producao: 1, id_material: 1, peso_kg: 50, data_hora: '2026-10-27T23:30:00' },
                    { id_item_producao: 2, id_material: 2, peso_kg: 30, data_hora: '2026-10-28T00:30:00' },
                ] },
            { id_producao: 2, id_lote: 11, id_esteira: 2, data_inicio: '2026-09-30T23:00:00', quantidade_saida_kg: 7, rejeito_kg: 3,
                itens: [{ id_item_producao: 3, id_material: 3, peso_kg: 7, data_hora: '2026-10-01T00:30:00' }] },
        ],
    };
    servidor = criarServidorMock({ dados, hoje: '2026-10-27' }).listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    base = `http://127.0.0.1:${servidor.address().port}/api`;
    const login = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'admin', senha: 'ecocycle123' }) });
    token = (await login.json()).access_token;
});
afterAll(async () => { if (servidor) await new Promise((resolve) => servidor.close(resolve)); });
const consultar = (query = '', jwt = token) => fetch(base + '/producao/materiais' + query, { headers: jwt ? { Authorization: 'Bearer ' + jwt } : {} });

describe('relatório de materiais no mock', () => {
    it('exige autenticação', async () => { expect((await consultar('', '')).status).toBe(401); });
    it('faz o relacionamento com lote, esteira e tipo e soma o rejeito uma vez por ciclo', async () => {
        const resposta = await consultar();
        expect(resposta.status).toBe(200);
        const d = await resposta.json();
        expect(d.total_registros).toBe(3);
        expect(d.totais_por_material_kg).toEqual({ plastico: 50, metal: 30, aluminio: 7, rejeito: 23 });
        expect(d.materiais_produzidos.find((i) => i.id_item_producao === 1)).toMatchObject({ id_producao: 1, id_lote: 10, id_esteira: 2, id_material: 1, tipo_material: 'plastico', peso_kg: 50 });
    });
    it('filtra itens pela própria data e rejeitos pela data inicial da produção', async () => {
        const dia = await (await consultar('?data=28%2F10%2F2026')).json();
        expect(dia.totais_por_material_kg).toEqual({ plastico: 0, metal: 30, aluminio: 0, rejeito: 0 });
        const mes = await (await consultar('?mes=10&ano=2026')).json();
        expect(mes.totais_por_material_kg).toEqual({ plastico: 50, metal: 30, aluminio: 7, rejeito: 20 });
    });
    it('combina filtros e retorna categorias zeradas em período vazio', async () => {
        const combinado = await (await consultar('?mes=10&ano=2026&trimestre=4&data=27%2F10%2F2026')).json();
        expect(combinado.totais_por_material_kg).toEqual({ plastico: 50, metal: 0, aluminio: 0, rejeito: 20 });
        const vazio = await (await consultar('?mes=10&ano=2026&trimestre=3')).json();
        expect(vazio.total_registros).toBe(0);
        expect(vazio.materiais_produzidos).toEqual([]);
        expect(vazio.totais_por_material_kg).toEqual({ plastico: 0, metal: 0, aluminio: 0, rejeito: 0 });
    });
    it.each(['?data=2026-10-27', '?data=31/02/2026', '?mes=13', '?mes=0', '?ano=0', '?ano=10000', '?trimestre=5', '?trimestre=1.5'])('rejeita filtro inválido %s', async (query) => {
        expect((await consultar(query)).status).toBe(422);
    });
    it('permite leitura para um perfil de consulta', async () => {
        const resposta = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'consulta-dashboard', senha: 'ecocycle123' }) });
        expect(resposta.status).toBe(200);
        expect((await consultar('', (await resposta.json()).access_token)).status).toBe(200);
    });
});
