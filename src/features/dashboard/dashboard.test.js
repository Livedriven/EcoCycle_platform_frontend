import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), layout: vi.fn(), bar: vi.fn(), doughnut: vi.fn() }));
vi.mock('../../shared/layout.js', () => ({ montarLayout: mocks.layout }));
vi.mock('../../shared/api.js', () => ({ default: { GET: mocks.get } }));
vi.mock('../../shared/charts.js', () => ({ createBarChart: mocks.bar, createDoughnutChart: mocks.doughnut, CORES: {} }));

function elemento() {
    const classes = new Set();
    const atributos = new Map();
    const eventos = new Map();
    const seletores = new Map();
    let texto = '';
    return {
        children: [],
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
        setAttribute: (c, v) => atributos.set(c, v), getAttribute: (c) => atributos.get(c),
        get textContent() { return texto + this.children.map((c) => c.textContent).join('') + [...seletores.values()].map((c) => c.textContent).join(''); },
        set textContent(v) { texto = v; this.children = []; },
        append(...filhos) { this.children.push(...filhos); },
        replaceChildren(...filhos) { texto = ''; this.children = filhos; },
        querySelector(s) { if (!seletores.has(s)) seletores.set(s, elemento()); return seletores.get(s); },
        addEventListener: (e, fn) => eventos.set(e, fn),
        click: () => eventos.get('click')?.(),
        style: {}
    };
}
const ids = ['indicadores', 'diaria', 'mensal', 'trimestral', 'co2', 'fornecedores', 'status-lotes', 'esteira', 'alertas'];
let elementos, intervalo;
const obter = (id) => {
    if (!elementos.has(id)) elementos.set(id, elemento());
    return elementos.get(id);
};
const estado = (id) => obter('bloco-' + id).querySelector('.estado');
const conteudo = (id) => obter('bloco-' + id).querySelector('.conteudo');
const dados = {
    '/lotes': [{ id_fornecedor: 1, pesoentrada_kg: 100, status: 'Recebido' }],
    '/producao': [{ id: 1, id_lote: 1, data_hora: '2026-10-24T08:00:00', peso_kg: 10, quantidade_saida_kg: 10, rejeito_kg: 2,
        itens: [{ id_material: 2, peso_kg: 10, data_hora: '2026-10-24T09:00:00' }] }],
    '/materiais': [{ id: 1, id_material: 1, tipo_material: 'plastico' }, { id: 2, id_material: 2, tipo_material: 'metal' }],
    '/fornecedores': [{ id: 1, nome_fornecedor: 'Fornecedor' }],
    '/alertas': [{ resolvido: false, tipo_alerta: 'Teste', datahora_alerta: '2026-10-24' }],
    '/esteiras': [{ nome_esteira: 'Esteira 1', status_esteira: 'Ativa' }]
};
const consolidado = { balanco_massas_kg: { total_material_entrada: 100, total_produzido_saida: 80, total_rejeitos_perdas: 20 } };
const dadosDaRota = (rota) => rota.startsWith('/producao/dashboard-') ? consolidado : dados[rota];
beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    elementos = new Map();
    ids.forEach((id) => conteudo(id).classList.add('d-none'));
    mocks.layout.mockReturnValue({ perfil: 'consulta' });
    mocks.get.mockImplementation(async (rota) => dadosDaRota(rota));
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('document', {
        getElementById: obter, createElement: elemento,
        querySelector: (s) => obter(s.split(' ')[0].slice(1)).querySelector(s.split(' ')[1]),
        hidden: false
    });
    vi.stubGlobal('setInterval', vi.fn((fn) => { intervalo = fn; }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
async function iniciar() { await import('./dashboard.js'); await vi.dynamicImportSettled(); }
async function concluir() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

describe('disponibilidade do dashboard', () => {
    it('mostra carregamento em cada bloco e busca cada endpoint uma vez', async () => {
        let resolver;
        mocks.get.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
        await iniciar();
        ids.forEach((id) => {
            expect(estado(id).textContent).toContain('Carregando...');
            expect(obter('bloco-' + id).getAttribute('aria-busy')).toBe('true');
        });
        expect(mocks.get).toHaveBeenCalledTimes(9);
        expect(mocks.get).toHaveBeenCalledWith('/producao', { erroLocal: true });
        resolver([]);
        await concluir();
    });
    it('mantém outros blocos disponíveis mesmo com erro e outra fonte pendente', async () => {
        let resolver;
        mocks.get.mockImplementation((rota) => {
            if (rota === '/esteiras') return Promise.reject(new Error('HTTP 503'));
            if (rota === '/fornecedores') return new Promise((resolve) => { resolver = resolve; });
            return Promise.resolve(dadosDaRota(rota));
        });
        await iniciar();
        expect(estado('esteira').textContent).toContain('Tentar novamente');
        expect(conteudo('diaria').classList.contains('d-none')).toBe(false);
        expect(estado('fornecedores').textContent).toContain('Carregando...');
        resolver([]);
        await concluir();
    });
    it('tenta novamente somente o bloco com erro e evita requisições duplicadas', async () => {
        mocks.get.mockImplementation(async (rota) => {
            if (rota === '/esteiras') throw new Error('HTTP 500');
            return dadosDaRota(rota);
        });
        await iniciar();
        const botao = estado('esteira').children.at(-1);
        mocks.get.mockResolvedValue(dados['/esteiras']);
        mocks.get.mockClear();
        botao.click();
        botao.click();
        await concluir();
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/esteiras', { erroLocal: true });
        expect(conteudo('esteira').classList.contains('d-none')).toBe(false);
        expect(estado('esteira').textContent).toBe('');
    });
    it('mostra vazio por bloco e mantém os quatro materiais com zero nos indicadores', async () => {
        mocks.get.mockResolvedValue([]);
        await iniciar();
        ids.forEach((id) => expect(estado(id).textContent).toContain('Sem dados no período'));
        const cards = conteudo('indicadores').children;
        expect(cards.find((c) => c.textContent.includes('Alumínio')).textContent).toContain('0');
        expect(cards.find((c) => c.textContent.includes('Rejeito')).textContent).toContain('0');
        expect(mocks.bar).not.toHaveBeenCalled();
    });
    it('consulta os três períodos com os parâmetros do backend e desenha o balanço de massas', async () => {
        await iniciar();
        expect(mocks.get).toHaveBeenCalledWith('/producao/dashboard-diario?data=24%2F10%2F2026', { erroLocal: true });
        expect(mocks.get).toHaveBeenCalledWith('/producao/dashboard-mensal?mes=10&ano=2026', { erroLocal: true });
        expect(mocks.get).toHaveBeenCalledWith('/producao/dashboard-trimestral?trimestre=4&ano=2026', { erroLocal: true });
        for (const periodo of ['diaria', 'mensal', 'trimestral']) {
            const chamada = mocks.bar.mock.calls.find(([canvas]) => canvas === obter('grafico-' + periodo));
            expect(chamada[1]).toEqual(['Entrada', 'Saída produzida', 'Rejeitos e perdas']);
            expect(chamada[2][0].data).toEqual([100, 80, 20]);
        }
        mocks.get.mockImplementation(async (rota) => rota.includes('dashboard-diario')
            ? { balanco_massas_kg: { total_material_entrada: 120, total_produzido_saida: 90, total_rejeitos_perdas: 30 } }
            : dadosDaRota(rota));
        intervalo();
        await concluir();
        const ultima = mocks.bar.mock.calls.filter(([canvas]) => canvas === obter('grafico-diaria')).at(-1);
        expect(ultima[2][0].data).toEqual([120, 90, 30]);
    });
    it('isola resposta inválida de um consolidado e não desenha totais inventados', async () => {
        mocks.get.mockImplementation(async (rota) => rota.includes('dashboard-diario') ? {} : dadosDaRota(rota));
        await iniciar();
        expect(estado('diaria').textContent).toContain('Tentar novamente');
        expect(conteudo('mensal').classList.contains('d-none')).toBe(false);
    });
    it('soma os materiais pelos itens dos ciclos e o tipo do catálogo, inclusive no CO₂', async () => {
        await iniciar();
        const cards = conteudo('indicadores').children;
        expect(cards.find((c) => c.textContent.includes('Metal')).textContent).toContain('10 kg');
        expect(cards.find((c) => c.textContent.includes('Rejeito')).textContent).toContain('2 kg');
        expect(cards.find((c) => c.textContent.includes('Plástico')).textContent).toContain('0 kg');
        const co2 = mocks.bar.mock.calls.find(([canvas]) => canvas === obter('grafico-co2'));
        expect(co2[1]).toEqual(['Plástico', 'Metal']);
        expect(co2[2][0].data).toEqual([0, 0.04]);
    });
    it('informa a falta de composição quando a API devolve somente ciclos', async () => {
        mocks.get.mockImplementation(async (rota) => rota === '/producao'
            ? [{ id: 1, peso_kg: 80, data_hora: '2026-10-24' }] : dadosDaRota(rota));
        await iniciar();
        const cards = conteudo('indicadores').children;
        for (const material of ['Plástico', 'Metal', 'Alumínio', 'Rejeito']) {
            expect(cards.find((c) => c.textContent.includes(material)).textContent).toContain('Não informado');
        }
        expect(cards.find((c) => c.textContent.includes('Total processado')).textContent).toContain('80 kg');
    });
    it('isola também erros de renderização', async () => {
        mocks.bar.mockImplementation((canvas) => { if (canvas === obter('grafico-diaria')) throw new Error('Canvas'); });
        await iniciar();
        expect(estado('diaria').textContent).toContain('Tentar novamente');
        expect(conteudo('mensal').classList.contains('d-none')).toBe(false);
    });
    it('não carrega sem sessão', async () => {
        mocks.layout.mockReturnValue(null);
        await iniciar();
        expect(mocks.get).not.toHaveBeenCalled();
    });
    it('mantém os blocos visíveis durante a atualização e após falha temporária', async () => {
        await iniciar();
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
        let rejeitar;
        mocks.get.mockReturnValue(new Promise((_, reject) => { rejeitar = reject; }));
        intervalo();
        await concluir();
        expect(conteudo('diaria').classList.contains('d-none')).toBe(false);
        expect(estado('diaria').textContent).toBe('');
        rejeitar(new Error('HTTP 503'));
        await concluir();
        expect(conteudo('diaria').classList.contains('d-none')).toBe(false);
        expect(estado('diaria').textContent).toBe('');
    });
    it('consulta sem redesenhar gráficos quando os dados não mudam', async () => {
        await iniciar();
        const chamadas = mocks.bar.mock.calls.length;
        intervalo();
        await concluir();
        expect(mocks.get).toHaveBeenCalledTimes(18);
        expect(mocks.bar).toHaveBeenCalledTimes(chamadas);
    });

});
