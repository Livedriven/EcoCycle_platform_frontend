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
        set innerHTML(v) { texto = v; this.children = []; seletores.clear(); },
        append(...filhos) { this.children.push(...filhos); },
        replaceChildren(...filhos) { texto = ''; this.children = filhos; },
        querySelector(s) { if (!seletores.has(s)) seletores.set(s, elemento()); return seletores.get(s); },
        addEventListener: (e, fn) => eventos.set(e, fn),
        click: () => eventos.get('click')?.(),
        style: {}
    };
}
const ids = ['indicadores', 'diaria', 'mensal', 'co2', 'fornecedores', 'status-lotes', 'esteira', 'alertas'];
let elementos, intervalo;
const obter = (id) => {
    if (!elementos.has(id)) elementos.set(id, elemento());
    return elementos.get(id);
};
const estado = (id) => obter('bloco-' + id).querySelector('.estado');
const conteudo = (id) => obter('bloco-' + id).querySelector('.conteudo');
const dados = {
    '/lotes': [{ id_fornecedor: 1, pesoentrada_kg: 100, status: 'Recebido' }],
    '/producao': [{ tipo_material: 'Metal', peso_kg: 10, data_hora: '2026-10-24' }],
    '/fornecedores': [{ id: 1, nome_fornecedor: 'Fornecedor' }],
    '/alertas': [{ resolvido: false, tipo_alerta: 'Teste', datahora_alerta: '2026-10-24' }],
    '/esteiras': [{ nome_esteira: 'Esteira 1', status_esteira: 'Ativa' }]
};
beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    elementos = new Map();
    ids.forEach((id) => conteudo(id).classList.add('d-none'));
    mocks.layout.mockReturnValue({ perfil: 'consulta' });
    mocks.get.mockImplementation(async (rota) => dados[rota]);
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
        expect(mocks.get).toHaveBeenCalledTimes(5);
        expect(mocks.get).toHaveBeenCalledWith('/producao', { erroLocal: true });
        resolver([]);
        await concluir();
    });
    it('mantém outros blocos disponíveis mesmo com erro e outra fonte pendente', async () => {
        let resolver;
        mocks.get.mockImplementation((rota) => {
            if (rota === '/esteiras') return Promise.reject(new Error('HTTP 503'));
            if (rota === '/fornecedores') return new Promise((resolve) => { resolver = resolve; });
            return Promise.resolve(dados[rota]);
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
            return dados[rota];
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
    it('inclui categorias sem dados nos gráficos e soma novos registros de alumínio e rejeito', async () => {
        await iniciar();
        let series = mocks.bar.mock.calls.find(([canvas]) => canvas === obter('grafico-diaria'))[2];
        expect(series.map((s) => s.label)).toEqual(['Plástico', 'Metal', 'Alumínio', 'Rejeito']);
        expect(series[2].data).toEqual(Array(7).fill(0));
        mocks.get.mockImplementation(async (rota) => rota === '/producao' ? [
            { tipo_material: 'Alumínio', peso_kg: 8, data_hora: '2026-10-24' },
            { tipo_material: 'Rejeito', peso_kg: 3, data_hora: '2026-10-24' }
        ] : dados[rota]);
        intervalo();
        await concluir();
        series = mocks.bar.mock.calls.filter(([canvas]) => canvas === obter('grafico-diaria')).at(-1)[2];
        expect(series[2].data.at(-1)).toBe(8);
        expect(series[3].data.at(-1)).toBe(3);
    });
    it.each(['erro', 'vazio'])('simula %s apenas no bloco escolhido', async (modo) => {
        window.location.search = '?simular=' + modo + '&bloco=bloco-diaria';
        await iniciar();
        expect(estado('diaria').textContent).toContain(modo === 'erro' ? 'Tentar novamente' : 'Sem dados no período');
        expect(conteudo('mensal').classList.contains('d-none')).toBe(false);
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
});
