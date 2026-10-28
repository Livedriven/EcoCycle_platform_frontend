import { createRequire } from 'node:module';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizarResposta } from '../src/shared/api-contract.js';
import { prepararProducaoMateriais } from '../src/features/materials/materials-report.js';
import { MATERIAIS_RELATORIO, totalPorMaterial } from '../src/shared/calculations.js';

const require = createRequire(import.meta.url);
const { criarServidorMock } = require('./server.cjs');
const { prepararDadosDemo } = require('./demo-data.cjs');
const seed = require('./db.json');
let servidor, base, token;
const fixtureOriginal = readFileSync(new URL('./db.json', import.meta.url), 'utf8');

async function chamar(rota, { method = 'GET', body, jwt = token } = {}) {
    return fetch(base + rota, {
        method,
        headers: { ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

beforeAll(async () => {
    servidor = criarServidorMock({ hoje: '2026-10-27' }).listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    base = `http://127.0.0.1:${servidor.address().port}/api`;
});
afterAll(async () => { if (servidor) await new Promise((resolve) => servidor.close(resolve)); });

describe('demonstração isolada da API EcoCycle', () => {
    it('login usa usuario/senha e responde com o mesmo contrato da API real', async () => {
        const res = await chamar('/login', { method: 'POST', body: { usuario: 'admin', senha: 'ecocycle123' }, jwt: '' });
        expect(res.status).toBe(200);
        const dados = await res.json();
        expect(dados).toMatchObject({ token_type: 'bearer', perfil: 'ADMINISTRADOR', acesso_liberado: true });
        expect(dados.access_token).toBeTypeOf('string');
        token = dados.access_token;
    });
    it('somente login e diagnóstico são públicos', async () => {
        expect((await chamar('/health/database', { jwt: '' })).status).toBe(200);
        expect((await chamar('/esteiras', { jwt: '' })).status).toBe(401);
    });
    it.each([
        ['/lotes', 'lotes'], ['/fornecedores', 'fornecedores'], ['/producao', 'registros_producao'],
        ['/esteiras', 'esteiras'], ['/telemetria/historico', 'historico'], ['/alertas', 'alertas'], ['/materiais', 'materiais'],
    ])('consulta a rota atual %s e seu envelope', async (rota, chave) => {
        const res = await chamar(rota);
        expect(res.status).toBe(200);
        expect((await res.json())[chave].length).toBeGreaterThan(0);
    });
    it.each([
        '/producao/dashboard-diario?data=27%2F10%2F2026',
        '/producao/dashboard-mensal?mes=10&ano=2026',
        '/producao/dashboard-trimestral?trimestre=4&ano=2026',
    ])('dashboards têm dados atuais: %s', async (rota) => {
        const res = await chamar(rota);
        expect(res.status).toBe(200);
        expect((await res.json()).balanco_massas_kg.total_produzido_saida).toBeGreaterThan(0);
    });
    it('normaliza as datas somente na cópia usada em memória', () => {
        const original = structuredClone(seed);
        const dados = prepararDadosDemo(seed, '2026-10-27');
        expect(seed).toEqual(original);
        expect(dados.producao.some((r) => String(r.data_hora ?? r.data_inicio).startsWith('2026-10-27'))).toBe(true);
        expect(dados.producao.some((r) => r.itens.some((item) => item.id_material && item.peso_kg > 0))).toBe(true);
        expect(dados.producao.every((r) => !Object.hasOwn(r, 'tipo_material'))).toBe(true);
        expect(dados.materiais.map((m) => m.tipo_material)).toEqual(['plastico', 'metal', 'aluminio']);
    });
    it('alimenta o relatório com itens aninhados e catálogo, sem campos legados de material no ciclo', async () => {
        const [resProducao, resMateriais] = await Promise.all([chamar('/producao'), chamar('/materiais')]);
        const ciclos = normalizarResposta('GET', '/producao', await resProducao.json());
        const materiais = normalizarResposta('GET', '/materiais', await resMateriais.json());
        expect(ciclos.every((c) => Array.isArray(c.itens) && !c.tipo_material)).toBe(true);
        const dados = prepararProducaoMateriais(ciclos, materiais);
        expect(dados.pendencias).toEqual([]);
        const totais = totalPorMaterial(dados.registros, MATERIAIS_RELATORIO);
        expect(totais['Plástico']).toBeGreaterThan(0);
        expect(totais.Metal).toBeGreaterThan(0);
        expect(totais.Rejeito).toBe(0);
    });
    it('cadastra fornecedor, lote e produção com os payloads atuais sem modificar o db.json', async () => {
        const fornecedor = await chamar('/fornecedores', { method: 'POST', body: { id_fornecedor: 900, nome_fornecedor: 'Demonstração', cnpj: '11111111000191', telefone_fornecedor: '31999998888', email_fornecedor: 'demo@example.com', endereco_fornecedor: 'Rua A, 1' } });
        expect(fornecedor.status).toBe(200);
        const lote = await chamar('/lotes', { method: 'POST', body: { id_fornecedor: 900, codigo_lote: 'DEMO-900', peso_recebido_kg: 12.5, status_lote: 'Recebido' } });
        expect(lote.status).toBe(201);
        const idLote = (await lote.json()).lote.id_lote;
        const producao = await chamar('/producao', { method: 'POST', body: { id_lote: idLote, id_usuario: 1, id_esteira: 1, turno: 'Manhã', status_producao: 'Em processamento', quantidade_entrada_kg: 12.5, quantidade_saida_kg: 0, rejeito_kg: 0, itens: [] } });
        expect(producao.status).toBe(201);
        const idProducao = (await producao.json()).producao.id_producao;
        const cadastrada = (await (await chamar('/producao')).json()).registros_producao.find((r) => r.id_producao === idProducao);
        expect(cadastrada.status_producao).toBe('Disponível');
        expect((await chamar('/lotes', { method: 'POST', body: { pesoentrada_kg: 10 } })).status).toBe(422);
        expect(readFileSync(new URL('./db.json', import.meta.url), 'utf8')).toBe(fixtureOriginal);
    });
    it('comandos IoT simulados usam as rotas atuais e geram alertas vinculados à leitura', async () => {
        const ciclos = (await (await chamar('/producao')).json()).registros_producao;
        const ciclo = ciclos.find((r) => r.id_esteira === 1);
        const dados = { id_esteira: 1, temperatura_esteira_c: 60, velocidade_esteira_kmh: 4, peso_atual_kg: 100, travada: false };
        expect((await chamar('/esteiras/status', { method: 'POST', body: dados })).status).toBe(200);
        const resultado = await chamar('/telemetria', { method: 'POST', body: { ...dados, id_producao: ciclo.id_producao, material_leitura: 'Metal' } });
        expect(resultado.status).toBe(200);
        expect((await resultado.json()).alertas_seguranca).toHaveLength(1);
        const alertas = (await (await chamar('/alertas')).json()).alertas;
        const leituras = (await (await chamar('/telemetria/historico')).json()).historico;
        expect(leituras.some((r) => r.id_leitura_sensor === alertas.at(-1).id_leitura_sensor)).toBe(true);
    });
    it('cadastra e atualiza esteira, finaliza produção e lote e resolve alerta', async () => {
        const esteira = await chamar('/esteiras', { method: 'POST', body: { nome_esteira: 'Esteira demo' } });
        expect(esteira.status).toBe(201);
        const { id_esteira, status_esteira } = (await esteira.json()).esteira;
        expect(status_esteira).toBe('DESLIGADA');
        const editada = await chamar(`/esteiras/${id_esteira}`, { method: 'PATCH', body: { status_esteira: 'LIGADA' } });
        expect((await editada.json()).esteira).toMatchObject({ id_esteira, nome_esteira: 'Esteira demo', status_esteira: 'LIGADA' });
        expect((await (await chamar(`/esteiras/${id_esteira}`)).json()).esteira.status_esteira).toBe('LIGADA');
        expect((await chamar(`/esteiras/${id_esteira}`, { method: 'PATCH', body: {} })).status).toBe(422);
        expect((await chamar('/esteiras/99999', { method: 'PATCH', body: { nome_esteira: 'X' } })).status).toBe(404);

        const ciclo = (await (await chamar('/producao')).json()).registros_producao.at(-1);
        const excedente = { quantidade_saida_kg: Number(ciclo.quantidade_entrada_kg) + 1, rejeito_kg: 0 };
        expect((await chamar(`/producao/${ciclo.id_producao}`, { method: 'PATCH', body: excedente })).status).toBe(422);
        const finalizada = await chamar(`/producao/${ciclo.id_producao}`, { method: 'PATCH', body: {
            status_producao: 'Finalizado', data_fim: '2026-10-27T12:00:00', quantidade_saida_kg: 0, rejeito_kg: 0,
            itens: [{ id_material: 1, peso_kg: 0 }],
        } });
        expect(finalizada.status).toBe(200);
        const producao = normalizarResposta('PATCH', `/producao/${ciclo.id_producao}`, await finalizada.json());
        expect(producao).toMatchObject({ id: ciclo.id_producao, status: 'Finalizado' });
        expect(producao.itens.at(-1)).toMatchObject({ id_producao: ciclo.id_producao, id_material: 1 });
        const lote = await chamar(`/lotes/${ciclo.id_lote}`, { method: 'PATCH', body: { status_lote: 'Finalizado' } });
        expect((await lote.json()).lote.status_lote).toBe('Finalizado');

        const alerta = (await (await chamar('/alertas')).json()).alertas[0];
        const resolvido = await chamar(`/alertas/${alerta.id_alerta}`, { method: 'PATCH', body: { resolvido: true } });
        expect((await resolvido.json()).alerta.resolvido).toBe('SIM');
        expect((await chamar(`/alertas/${alerta.id_alerta}`, { method: 'PATCH', body: { resolvido: 'sim' } })).status).toBe(422);
        expect(readFileSync(new URL('./db.json', import.meta.url), 'utf8')).toBe(fixtureOriginal);
    });
    it('aplica os perfis do backend às atualizações', async () => {
        const login = await chamar('/login', { method: 'POST', body: { usuario: 'operador1', senha: 'ecocycle123' }, jwt: '' });
        const operador = (await login.json()).access_token;
        expect(operador).toBeTypeOf('string');
        expect((await chamar('/esteiras/1', { method: 'PATCH', body: { nome_esteira: 'X' }, jwt: operador })).status).toBe(403);
        expect((await chamar('/alertas/1', { method: 'PATCH', body: { resolvido: true }, jwt: operador })).status).toBe(403);
        expect((await chamar('/lotes/1', { method: 'PATCH', body: { status_lote: 'Recebido' }, jwt: operador })).status).toBe(200);
    });
    it.each(['/equipamentos', '/leituras_sensor', '/usuarios'])('não mascara a rota obsoleta %s', async (rota) => {
        expect((await chamar(rota)).status).toBe(403);
    });
    it('logout pode ser repetido e revoga a sessão somente no mock', async () => {
        expect((await chamar('/logout', { method: 'POST' })).status).toBe(200);
        expect((await chamar('/logout', { method: 'POST' })).status).toBe(200);
        expect((await chamar('/lotes')).status).toBe(401);
    });
});
