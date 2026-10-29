import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), layout: vi.fn(), bar: vi.fn(), doughnut: vi.fn() }));
vi.mock('../../shared/layout.js', () => ({ montarLayout: mocks.layout }));
vi.mock('../../shared/api.js', () => ({ default: { GET: mocks.get } }));
vi.mock('../../shared/charts.js', () => ({ createBarChart: mocks.bar, createDoughnutChart: mocks.doughnut, CORES: {} }));

function elemento() {
    const classes = new Set(), atributos = new Map(), eventos = new Map(), seletores = new Map();
    let texto = '';
    return {
        children: [], value: '', style: {},
        classList: {
            add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
            toggle(c, ativo) { if (ativo ?? !classes.has(c)) classes.add(c); else classes.delete(c); },
        },
        setAttribute: (c, v) => atributos.set(c, v), getAttribute: (c) => atributos.get(c),
        get textContent() { return texto + this.children.map((c) => c.textContent).join(''); },
        set textContent(v) { texto = String(v); this.children = []; },
        append(...filhos) { this.children.push(...filhos); },
        prepend(...filhos) { this.children.unshift(...filhos); },
        replaceChildren(...filhos) { texto = ''; this.children = filhos; },
        querySelector(s) { if (!seletores.has(s)) seletores.set(s, elemento()); return seletores.get(s); },
        addEventListener: (e, fn) => eventos.set(e, fn),
        click: () => eventos.get('click')?.(),
        change(valor) { this.value = valor; eventos.get('change')?.(); },
    };
}
const ids = ['recebimento', 'producao', 'materiais', 'diaria', 'mensal', 'trimestral', 'co2', 'fornecedores', 'status-lotes', 'esteira', 'alertas'];
let elementos, intervalo;
const obter = (id) => {
    if (!elementos.has(id)) elementos.set(id, elemento());
    return elementos.get(id);
};
const parte = (id, classe) => obter('bloco-' + id).querySelector('.' + classe);
const conteudo = (id) => parte(id, 'conteudo');
const estado = (id) => parte(id, 'estado');
const aviso = (id) => parte(id, 'aviso-atualizacao');
const materiais = { totais_por_material_kg: { plastico: '1000', metal: '10', aluminio: 20, rejeito: '2' }, materiais_produzidos: [], total_registros: 3 };
function dadosDaRota(rota) {
    if (rota.startsWith('/producao/dashboard-')) {
        const tipo = rota.split('dashboard-')[1].split('?')[0];
        const campo = { diario: 'aproveitamento_percentual', mensal: 'detalhamento_mensal', trimestral: 'detalhamento_trimestral' }[tipo];
        return { balanco_massas_kg: { total_material_entrada: '100', total_produzido_saida: 80, total_rejeitos_perdas: 20 }, indicadores_desempenho: { [campo]: 80 } };
    }
    if (rota.startsWith('/producao/materiais?')) return materiais;
    return {
        '/lotes': [{ id_lote: 1, id_fornecedor: 1, peso_recebido_kg: 100, data_entrada: '2026-10-24T08:00:00', status: 'Recebido' },
            { id_lote: 2, id_fornecedor: 1, peso_recebido_kg: 50, data_entrada: '2026-10-01', status: 'Finalizado' }],
        '/fornecedores': [{ id: 1, nome_fornecedor: 'Fornecedor' }],
        '/alertas': [{ resolvido: false, tipo_alerta: 'Teste', datahora_alerta: '2026-10-24' }],
        '/esteiras': [{ nome_esteira: 'Esteira 1', status_esteira: 'LIGADA' }],
    }[rota];
}
beforeEach(() => {
    vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 12));
    elementos = new Map();
    ids.forEach((id) => conteudo(id).classList.add('d-none'));
    mocks.layout.mockReturnValue({ perfil: 'consulta' });
    mocks.get.mockImplementation(async (rota) => dadosDaRota(rota));
    vi.stubGlobal('document', { getElementById: obter, createElement: elemento, querySelectorAll: () => [obter('rotulo-periodo')], hidden: false });
    vi.stubGlobal('setInterval', vi.fn((fn) => { intervalo = fn; }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
async function iniciar() { await import('./dashboard.js'); await vi.dynamicImportSettled(); }
async function concluir() { for (let i = 0; i < 35; i++) await Promise.resolve(); }
function selecionar(tipo) { obter('periodo-dashboard').change(tipo); }
const grafico = (id) => mocks.bar.mock.calls.filter(([canvas]) => canvas === obter('grafico-' + id));

describe('dashboard conectado aos relatórios do backend', () => {
    it('abre no mês atual com oito consultas compartilhadas, sem ciclos ou catálogo', async () => {
        await iniciar();
        expect(obter('periodo-dashboard').value).toBe('mensal');
        expect(obter('periodo-descricao').textContent).toBe('01/10/2026 a 31/10/2026');
        expect(mocks.get).toHaveBeenCalledTimes(8);
        const rotas = mocks.get.mock.calls.map(([url]) => url);
        expect(new Set(rotas).size).toBe(8);
        expect(rotas).not.toContain('/producao'); expect(rotas).not.toContain('/materiais');
        expect(rotas).toContain('/producao/materiais?mes=10&ano=2026');
        expect(rotas).toContain('/producao/dashboard-diario?data=24%2F10%2F2026');
        expect(rotas).toContain('/producao/dashboard-trimestral?trimestre=4&ano=2026');
        expect(conteudo('producao').textContent).toContain('Entrada na produção100 kg');
        expect(conteudo('producao').textContent).toContain('Saída produzida80 kg');
        expect(conteudo('producao').textContent).toContain('Aproveitamento80%');
        expect(conteudo('recebimento').textContent).toContain('150 kg');
    });
    it('usa totais da API para composição e mantém o CO₂ calculado no navegador', async () => {
        await iniciar();
        expect(obter('cards-materiais').textContent).toContain('Plástico1.000 kg');
        expect(obter('cards-materiais').textContent).toContain('Alumínio20 kg');
        expect(obter('cards-materiais').textContent).toContain('Rejeito2 kg');
        expect(obter('co2-total').textContent).toBe('1,54');
        expect(grafico('co2')[0][1]).toEqual(['Plástico', 'Metal']);
        expect(grafico('co2')[0][2][0].data).toEqual([1.5, 0.04]);
        for (const id of ['diaria', 'mensal', 'trimestral']) expect(grafico(id)[0][2][0].data).toEqual([100, 80, 20]);
    });
    it('troca o período dos recebimentos e materiais sem filtrar a situação atual', async () => {
        await iniciar(); selecionar('diario'); await concluir();
        expect(conteudo('recebimento').textContent).toContain('100 kg');
        expect(mocks.get).toHaveBeenCalledWith('/producao/materiais?data=24%2F10%2F2026', { erroLocal: true });
        expect(obter('contador-alertas').textContent).toBe('1');
        const status = mocks.doughnut.mock.calls.filter(([canvas]) => canvas === obter('grafico-status-lotes')).at(-1);
        expect(status[1]).toHaveLength(2);
        selecionar('trimestral'); await concluir();
        expect(mocks.get).toHaveBeenCalledWith('/producao/materiais?trimestre=4&ano=2026', { erroLocal: true });
    });
    it('ignora a resposta de materiais do período anterior recebida depois da troca', async () => {
        let resolver;
        mocks.get.mockImplementation((url) => url === '/producao/materiais?mes=10&ano=2026'
            ? new Promise((resolve) => { resolver = resolve; }) : Promise.resolve(dadosDaRota(url)));
        await iniciar(); selecionar('diario'); await concluir();
        const chamadas = grafico('co2').length;
        resolver({ totais_por_material_kg: { plastico: 99999, metal: 99999, aluminio: 0, rejeito: 0 } });
        await concluir();
        expect(obter('co2-total').textContent).toBe('1,54');
        expect(grafico('co2')).toHaveLength(chamadas);
        expect(obter('periodo-descricao').textContent).toBe('24/10/2026 a 24/10/2026');
    });
    it('esconde dados do período anterior enquanto carrega o novo', async () => {
        await iniciar();
        mocks.get.mockImplementation((url) => url.startsWith('/producao/materiais?') ? new Promise(() => {}) : Promise.resolve(dadosDaRota(url)));
        selecionar('diario'); await concluir();
        expect(conteudo('materiais').classList.contains('d-none')).toBe(true);
        expect(conteudo('co2').classList.contains('d-none')).toBe(true);
        expect(estado('materiais').textContent).toContain('Carregando...');
        expect(conteudo('esteira').classList.contains('d-none')).toBe(false);
    });
    it('isola falha de materiais no CO₂ e na composição, com nova tentativa sem duplicação', async () => {
        mocks.get.mockImplementation(async (url) => { if (url.startsWith('/producao/materiais?')) throw new Error('HTTP 503'); return dadosDaRota(url); });
        await iniciar();
        expect(estado('materiais').textContent).toContain('Tentar novamente');
        expect(estado('co2').textContent).toContain('Tentar novamente');
        expect(conteudo('producao').classList.contains('d-none')).toBe(false);
        expect(conteudo('recebimento').classList.contains('d-none')).toBe(false);
        expect(grafico('co2')).toHaveLength(0);
        const botao = estado('co2').children.at(-1);
        mocks.get.mockImplementation(async (url) => dadosDaRota(url)); mocks.get.mockClear();
        botao.click(); botao.click(); await concluir();
        expect(mocks.get).toHaveBeenCalledTimes(1);
        expect(obter('co2-total').textContent).toBe('1,54');
    });
    it('mantém dados com aviso de desatualização e limpa o aviso após recuperação sem redesenhar', async () => {
        await iniciar();
        const desenhos = mocks.bar.mock.calls.length;
        mocks.get.mockRejectedValue(new Error('HTTP 503')); intervalo(); await concluir();
        expect(conteudo('co2').classList.contains('d-none')).toBe(false);
        expect(aviso('co2').textContent).toContain('Não foi possível atualizar');
        mocks.get.mockImplementation(async (url) => dadosDaRota(url)); intervalo(); await concluir();
        expect(aviso('co2').textContent).not.toContain('Não foi possível atualizar');
        expect(mocks.bar).toHaveBeenCalledTimes(desenhos);
    });
    it('mostra zeros válidos e gráficos vazios sem inventar dados em falhas', async () => {
        mocks.get.mockImplementation(async (url) => {
            const d = dadosDaRota(url);
            if (url.startsWith('/producao/dashboard-')) {
                Object.keys(d.balanco_massas_kg).forEach((k) => { d.balanco_massas_kg[k] = 0; });
                Object.keys(d.indicadores_desempenho).forEach((k) => { d.indicadores_desempenho[k] = 0; });
                return d;
            }
            return url.startsWith('/producao/materiais?') ? { totais_por_material_kg: { plastico: 0, metal: 0, aluminio: 0, rejeito: 0 } } : [];
        });
        await iniciar();
        expect(conteudo('producao').textContent).toContain('Aproveitamento0%');
        expect(obter('cards-materiais').textContent).toContain('Plástico0 kg');
        expect(obter('co2-total').textContent).toBe('0');
        expect(obter('area-grafico-co2').classList.contains('d-none')).toBe(true);
        expect(estado('diaria').textContent).toContain('Sem dados');
        expect(obter('contador-alertas').textContent).toBe('0');
        expect(mocks.bar).not.toHaveBeenCalled();
    });
    it('trata resposta inválida como erro restrito aos dependentes', async () => {
        mocks.get.mockImplementation(async (url) => url.startsWith('/producao/materiais?') ? {} : dadosDaRota(url));
        await iniciar();
        expect(estado('co2').textContent).toContain('Não foi possível');
        expect(estado('materiais').textContent).toContain('Não foi possível');
        expect(conteudo('producao').classList.contains('d-none')).toBe(false);
    });
    it('avisa sobre recebimentos inválidos e não presume um fornecedor', async () => {
        mocks.get.mockImplementation(async (url) => url === '/lotes' ? [
            { data_entrada: '2026-10-24', peso_recebido_kg: 15, id_fornecedor: 99, status: 'Recebido' },
            { data_entrada: null, peso_recebido_kg: 999 },
        ] : dadosDaRota(url));
        await iniciar();
        expect(conteudo('recebimento').textContent).toContain('15 kg');
        expect(conteudo('recebimento').textContent).toContain('1 registro(s)');
        expect(grafico('fornecedores')[0][1]).toEqual(['Fornecedor não identificado']);
    });
    it('recalcula períodos ao virar o ano e não redesenha dados inalterados', async () => {
        await iniciar(); const chamadas = mocks.bar.mock.calls.length;
        intervalo(); await concluir();
        expect(mocks.get).toHaveBeenCalledTimes(16);
        expect(mocks.bar).toHaveBeenCalledTimes(chamadas);
        vi.setSystemTime(new Date(2027, 0, 1, 0, 1)); intervalo(); await concluir();
        expect(mocks.get).toHaveBeenCalledWith('/producao/materiais?mes=1&ano=2027', { erroLocal: true });
        expect(mocks.get).toHaveBeenCalledWith('/producao/dashboard-trimestral?trimestre=1&ano=2027', { erroLocal: true });
        expect(obter('periodo-descricao').textContent).toBe('01/01/2027 a 31/01/2027');
    });
    it('não busca sem sessão', async () => {
        mocks.layout.mockReturnValue(null); await iniciar(); expect(mocks.get).not.toHaveBeenCalled();
    });
    it('pausa consultas com a página oculta e retoma quando está visível', async () => {
        await iniciar(); document.hidden = true; intervalo(); await concluir();
        expect(mocks.get).toHaveBeenCalledTimes(8);
        document.hidden = false; intervalo(); await concluir();
        expect(mocks.get).toHaveBeenCalledTimes(16);
    });
    it('mantém o intervalo de cinco segundos e não sobrepõe a mesma carga', async () => {
        mocks.get.mockImplementation(() => new Promise(() => {})); await iniciar();
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
        intervalo(); await concluir(); expect(mocks.get).toHaveBeenCalledTimes(8);
        document.hidden = true; intervalo(); await concluir(); expect(mocks.get).toHaveBeenCalledTimes(8);
    });
    it('isola erros ao desenhar um gráfico', async () => {
        mocks.bar.mockImplementation((canvas) => { if (canvas === obter('grafico-diaria')) throw new Error('Canvas'); });
        await iniciar();
        expect(estado('diaria').textContent).toContain('Tentar novamente');
        expect(conteudo('mensal').classList.contains('d-none')).toBe(false);
    });
});
