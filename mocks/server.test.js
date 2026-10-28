import { createRequire } from 'node:module';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
        expect((await chamar('/equipamentos', { jwt: '' })).status).toBe(401);
    });
    it.each([
        ['/lotes', 'lotes'], ['/fornecedores', 'fornecedores'], ['/producao', 'registros_producao'],
        ['/equipamentos', 'equipamentos'], ['/telemetria/historico', 'historico'], ['/alertas', 'alertas'], ['/materiais', 'materiais'],
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
        expect(dados.producao.some((r) => r.tipo_material && r.peso_kg > 0)).toBe(true);
    });
    it('cadastra fornecedor, lote e produção com os payloads atuais sem modificar o db.json', async () => {
        const fornecedor = await chamar('/fornecedores', { method: 'POST', body: { id_fornecedor: 900, nome_fornecedor: 'Demonstração', cnpj: '11111111000191', telefone_fornecedor: '31999998888', email_fornecedor: 'demo@example.com', endereco_fornecedor: 'Rua A, 1' } });
        expect(fornecedor.status).toBe(200);
        const lote = await chamar('/lotes', { method: 'POST', body: { id_fornecedor: 900, codigo_lote: 'DEMO-900', peso_recebido_kg: 12.5, status_lote: 'Recebido' } });
        expect(lote.status).toBe(201);
        const idLote = (await lote.json()).lote.id_lote;
        const producao = await chamar('/producao', { method: 'POST', body: { id_lote: idLote, id_usuario: 1, id_esteira: 1, turno: 'Manhã', status_producao: 'Em processamento', quantidade_entrada_kg: 12.5, quantidade_saida_kg: 0, rejeito_kg: 0, itens: [] } });
        expect(producao.status).toBe(201);
        expect((await chamar('/lotes', { method: 'POST', body: { pesoentrada_kg: 10 } })).status).toBe(422);
        expect(readFileSync(new URL('./db.json', import.meta.url), 'utf8')).toBe(fixtureOriginal);
    });
    it('comandos IoT simulados usam as rotas atuais e geram alertas vinculados à leitura', async () => {
        const ciclos = (await (await chamar('/producao')).json()).registros_producao;
        const ciclo = ciclos.find((r) => r.id_esteira === 1);
        const dados = { id_esteira: 1, temperatura_esteira_c: 60, velocidade_esteira_kmh: 4, peso_atual_kg: 100, travada: false };
        expect((await chamar('/equipamentos/status', { method: 'POST', body: dados })).status).toBe(200);
        const resultado = await chamar('/telemetria', { method: 'POST', body: { ...dados, id_producao: ciclo.id_producao, material_leitura: 'Metal' } });
        expect(resultado.status).toBe(200);
        expect((await resultado.json()).alertas_seguranca).toHaveLength(1);
        const alertas = (await (await chamar('/alertas')).json()).alertas;
        const leituras = (await (await chamar('/telemetria/historico')).json()).historico;
        expect(leituras.some((r) => r.id_leitura_sensor === alertas.at(-1).id_leitura_sensor)).toBe(true);
    });
    it.each(['/esteiras', '/leituras_sensor', '/usuarios'])('não mascara a rota obsoleta %s', async (rota) => {
        expect((await chamar(rota)).status).toBe(403);
    });
    it('logout pode ser repetido e revoga a sessão somente no mock', async () => {
        expect((await chamar('/logout', { method: 'POST' })).status).toBe(200);
        expect((await chamar('/logout', { method: 'POST' })).status).toBe(200);
        expect((await chamar('/lotes')).status).toBe(401);
    });
});
