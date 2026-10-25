import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    layout: vi.fn(), sessao: vi.fn(), get: vi.fn(),
    criarTabela: vi.fn(), atualizarTabela: vi.fn(), grafico: vi.fn(),
}));
vi.mock('../../shared/layout.js', () => ({ montarLayout: mocks.layout }));
vi.mock('../../shared/session.js', () => ({ requireLogin: mocks.sessao }));
vi.mock('../../shared/api.js', () => ({ default: { GET: mocks.get } }));
vi.mock('../../shared/table.js', () => ({ createTable: mocks.criarTabela, updateTable: mocks.atualizarTabela }));
vi.mock('../../shared/charts.js', () => ({ createDoughnutChart: mocks.grafico, CORES: { 'Plástico': '#084B60', Metal: '#63A53C', 'Alumínio': '#6F5FA5', Rejeito: '#9A641D' } }));

// Apenas a superfície de DOM usada pelo controlador. Sem biblioteca ou navegador adicional.
function elemento() {
    const classes = new Set();
    const atributos = new Map();
    const eventos = new Map();
    let texto = '';
    return {
        value: '', disabled: false, children: [],
        get textContent() { return texto + this.children.map((filho) => filho.textContent ?? '').join(''); },
        set textContent(valor) { texto = valor; this.children = []; },
        classList: {
            add: (valor) => classes.add(valor), remove: (valor) => classes.delete(valor),
            contains: (valor) => classes.has(valor),
            toggle: (valor, ativo) => ativo ? classes.add(valor) : classes.delete(valor),
        },
        setAttribute: (chave, valor) => atributos.set(chave, valor),
        getAttribute: (chave) => atributos.get(chave),
        replaceChildren(...filhos) { this.textContent = ''; this.children = filhos; },
        add(opcao) { this.children.push(opcao); },
        addEventListener: (tipo, ouvir) => eventos.set(tipo, ouvir),
        disparar: (tipo) => eventos.get(tipo)?.({ preventDefault: vi.fn() }),
    };
}

let elementos, estado, conteudo, intervalo;
const producao = [
    { id_lote: 1, tipo_material: 'Plástico', peso_kg: 12.5, data_hora: '2026-10-20' },
    { id_lote: 1, tipo_material: 'Metal', peso_kg: 5, data_hora: '2026-10-20' },
    { id_lote: 2, tipo_material: 'Metal', peso_kg: 8, data_hora: '2026-10-21' },
];

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.layout.mockReturnValue({ perfil: 'consulta' });
    mocks.sessao.mockReturnValue({ perfil: 'consulta' });
    mocks.get.mockResolvedValue(producao);
    mocks.criarTabela.mockReturnValue({});
    mocks.grafico.mockReturnValue({ destroy: vi.fn() });
    elementos = new Map();
    estado = elemento();
    conteudo = elemento();
    const obter = (id) => {
        if (!elementos.has(id)) elementos.set(id, elemento());
        return elementos.get(id);
    };
    obter('bloco-materiais').querySelector = (seletor) => seletor === '.estado' ? estado : conteudo;
    obter('filtros-materiais').elements = ['data-inicial', 'data-final', 'filtro-lote'].map(obter);
    vi.stubGlobal('document', { getElementById: obter, createElement: elemento });
    vi.stubGlobal('setInterval', vi.fn((fn) => { intervalo = fn; }));
    vi.stubGlobal('Option', class {
        constructor(texto, valor) { this.text = texto; this.value = valor; }
    });
});
afterEach(() => vi.unstubAllGlobals());

async function iniciar() {
    await import('./materials.js');
    // A primeira carga é assíncrona, iniciada pelo próprio controlador.
    await vi.dynamicImportSettled();
}

describe('controlador do relatório de materiais', () => {
    it('mostra spinner e bloqueia controles enquanto a API está pendente', async () => {
        let concluir;
        mocks.get.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
        await iniciar();
        expect(estado.children[0].className).toContain('spinner-border');
        expect(estado.textContent).toContain('Carregando materiais');
        expect(estado.getAttribute('role')).toBe('status');
        expect(conteudo.classList.contains('d-none')).toBe(true);
        expect(elementos.get('bloco-materiais').getAttribute('aria-busy')).toBe('true');
        expect(elementos.get('data-inicial').disabled).toBe(true);
        expect(mocks.criarTabela).not.toHaveBeenCalled();
        concluir(producao);
        await vi.waitFor(() => expect(elementos.get('bloco-materiais').getAttribute('aria-busy')).toBe('false'));
        expect(estado.children).toHaveLength(0);
        expect(elementos.get('data-inicial').disabled).toBe(false);
    });
    it('não consulta dados nem acessa o DOM do relatório sem sessão', async () => {
        mocks.layout.mockReturnValue(null);
        await iniciar();
        expect(mocks.get).not.toHaveBeenCalled();
        expect(mocks.criarTabela).not.toHaveBeenCalled();
    });
    it('permite consulta e alimenta os cartões, gráfico e tabela com os mesmos dados', async () => {
        await iniciar();
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/producao', { erroLocal: true });
        expect(elementos.get('total-plastico').textContent).toBe('12,5 kg');
        expect(elementos.get('total-metal').textContent).toBe('13 kg');
        expect(mocks.criarTabela.mock.calls[0][2]).toHaveLength(2);
        expect(mocks.grafico.mock.calls[0][1].map((fatia) => fatia.valor)).toEqual([12.5, 13, 0, 0]);
        expect(elementos.get('total-aluminio').textContent).toBe('0 kg');
        expect(elementos.get('total-rejeito').textContent).toBe('0 kg');
        expect(elementos.get('toneladas-aluminio').textContent).toBe('0 t');
        expect(elementos.get('toneladas-rejeito').textContent).toBe('0 t');
        elementos.get('filtro-lote').value = '1';
        elementos.get('filtro-lote').disparar('change');
        expect(elementos.get('total-metal').textContent).toBe('5 kg');
        expect(mocks.atualizarTabela.mock.calls[0][1]).toEqual([{ id_lote: '1', data: '2026-10-20', plastico: 12.5, metal: 5, aluminio: 0, rejeito: 0 }]);
    });
    it('preenche os quatro materiais sem nova implementação quando chegam os novos dados', async () => {
        mocks.get.mockResolvedValue([
            ...producao,
            { id_lote: 1, tipo_material: 'Alumínio', peso_kg: 10, data_hora: '2026-10-20' },
            { id_lote: 2, tipo_material: 'Rejeito', peso_kg: 3, data_hora: '2026-10-21' },
        ]);
        await iniciar();
        expect(elementos.get('total-aluminio').textContent).toBe('10 kg');
        expect(elementos.get('total-rejeito').textContent).toBe('3 kg');
        expect(mocks.grafico.mock.calls[0][1].map((fatia) => fatia.valor)).toEqual([12.5, 13, 10, 3]);
        expect(mocks.criarTabela.mock.calls[0][1].map((coluna) => coluna.id)).toEqual(['id_lote', 'data', 'plastico', 'metal', 'aluminio', 'rejeito']);
        expect(elementos.get('descricao-grafico').textContent).toContain('Alumínio: 10 kg. Rejeito: 3 kg.');
        elementos.get('filtro-lote').value = '2';
        elementos.get('filtro-lote').disparar('change');
        expect(elementos.get('total-aluminio').textContent).toBe('0 kg');
        expect(elementos.get('total-rejeito').textContent).toBe('3 kg');
    });
    it('não revela dados se a sessão expira enquanto aguarda a API', async () => {
        mocks.sessao.mockReturnValueOnce({ perfil: 'consulta' }).mockReturnValue(null);
        await iniciar();
        expect(mocks.get).toHaveBeenCalledOnce();
        expect(mocks.criarTabela).not.toHaveBeenCalled();
        expect(mocks.grafico).not.toHaveBeenCalled();
    });
    it('desconsidera dados inválidos sem exibir aviso no relatório', async () => {
        mocks.get.mockResolvedValue([...producao, { ...producao[0], peso_kg: -1 }]);
        await iniciar();
        expect(elementos.has('aviso-materiais')).toBe(false);
        expect(elementos.get('total-plastico').textContent).toBe('12,5 kg');
    });
    it('trata histórico vazio com totais zero e mensagens no lugar de tabela e gráfico', async () => {
        mocks.get.mockResolvedValue([]);
        await iniciar();
        expect(elementos.get('total-metal').textContent).toBe('0 kg');
        expect(mocks.criarTabela).not.toHaveBeenCalled();
        expect(mocks.grafico).not.toHaveBeenCalled();
        expect(elementos.get('resumo-materiais').textContent).toContain('Nenhum material');
        expect(elementos.get('tabela-vazia').classList.contains('d-none')).toBe(false);
        expect(elementos.get('tabela-materiais').classList.contains('d-none')).toBe(true);
        expect(elementos.get('grafico-vazio').classList.contains('d-none')).toBe(false);
        expect(elementos.get('mensagem-tabela-vazia').textContent).toContain('automaticamente');
        expect(elementos.get('limpar-filtros-vazio').classList.contains('d-none')).toBe(true);
    });
    it('remove o gráfico quando o filtro não encontra pesos e restaura ao limpar', async () => {
        await iniciar();
        const grafico = mocks.grafico.mock.results[0].value;
        elementos.get('data-inicial').value = '2026-11-01';
        elementos.get('data-inicial').disparar('change');
        expect(grafico.destroy).toHaveBeenCalledOnce();
        expect(elementos.get('total-metal').textContent).toBe('0 kg');
        expect(elementos.get('mensagem-tabela-vazia').textContent).toContain('filtros selecionados');
        expect(elementos.get('limpar-filtros-vazio').classList.contains('d-none')).toBe(false);
        expect(elementos.get('tabela-materiais').classList.contains('d-none')).toBe(true);
        elementos.get('filtros-materiais').disparar('reset');
        // Emula o reset nativo dos controles antes da microtask.
        elementos.get('data-inicial').value = '';
        await Promise.resolve();
        expect(elementos.get('total-metal').textContent).toBe('13 kg');
        expect(elementos.get('tabela-vazia').classList.contains('d-none')).toBe(true);
        expect(elementos.get('tabela-materiais').classList.contains('d-none')).toBe(false);
    });
    it('mantém registros com peso zero na tabela e mostra apenas o gráfico vazio', async () => {
        mocks.get.mockResolvedValue([{ ...producao[0], peso_kg: 0 }]);
        await iniciar();
        expect(mocks.criarTabela).toHaveBeenCalledOnce();
        expect(mocks.grafico).not.toHaveBeenCalled();
        expect(elementos.get('tabela-vazia').classList.contains('d-none')).toBe(true);
        expect(elementos.get('grafico-vazio').classList.contains('d-none')).toBe(false);
    });
    it('volta do histórico vazio para dados disponíveis ao atualizar', async () => {
        mocks.get.mockResolvedValueOnce([]);
        await iniciar();
        expect(mocks.criarTabela).not.toHaveBeenCalled();
        intervalo();
        await vi.dynamicImportSettled();
        expect(mocks.criarTabela).toHaveBeenCalledOnce();
        expect(elementos.get('tabela-vazia').classList.contains('d-none')).toBe(true);
        expect(elementos.get('tabela-materiais').classList.contains('d-none')).toBe(false);
    });
    it('sinaliza período invertido e permite corrigir mesmo depois de atualizar', async () => {
        await iniciar();
        elementos.get('data-inicial').value = '2026-10-22';
        elementos.get('data-final').value = '2026-10-20';
        elementos.get('data-final').disparar('change');
        intervalo();
        await vi.dynamicImportSettled();
        expect(elementos.get('erro-periodo').textContent).toContain('anterior ou igual');
        expect(estado.textContent).toContain('Corrija o período');
        elementos.get('data-inicial').value = '2026-10-20';
        elementos.get('data-inicial').disparar('change');
        expect(elementos.get('total-metal').textContent).toBe('5 kg');
        expect(conteudo.classList.contains('d-none')).toBe(false);
    });
    it('exibe erros como texto e permite tentar a carga novamente', async () => {
        const mensagem = '<img src=x onerror=alert(1)>';
        mocks.get.mockRejectedValueOnce(new Error(mensagem));
        await iniciar();
        expect(estado.textContent).toContain(mensagem);
        expect(estado.getAttribute('role')).toBe('alert');
        intervalo();
        await vi.dynamicImportSettled();
        expect(elementos.get('total-metal').textContent).toBe('13 kg');
    });
    it('consulta a cada 5s sem esconder dados, bloquear filtros ou sobrepor requisições', async () => {
        await iniciar();
        expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
        let resolver;
        mocks.get.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
        intervalo();
        intervalo();
        expect(mocks.get).toHaveBeenCalledTimes(2);
        expect(conteudo.classList.contains('d-none')).toBe(false);
        expect(elementos.get('data-inicial').disabled).toBe(false);
        elementos.get('filtro-lote').value = '1';
        elementos.get('filtro-lote').disparar('change');
        expect(elementos.get('total-metal').textContent).toBe('5 kg');
        resolver([...producao, { ...producao[1], peso_kg: 2 }]);
        await vi.dynamicImportSettled();
        expect(elementos.get('filtro-lote').value).toBe('1');
        expect(elementos.get('total-metal').textContent).toBe('7 kg');
    });
    it('preserva o conteúdo após falha e evita redesenhar dados iguais', async () => {
        await iniciar();
        intervalo();
        await vi.dynamicImportSettled();
        expect(mocks.grafico).toHaveBeenCalledOnce();
        expect(mocks.atualizarTabela).not.toHaveBeenCalled();
        mocks.get.mockRejectedValueOnce(new Error('HTTP 503'));
        intervalo();
        await vi.dynamicImportSettled();
        expect(conteudo.classList.contains('d-none')).toBe(false);
        expect(elementos.get('total-metal').textContent).toBe('13 kg');
        expect(elementos.get('ultima-atualizacao').textContent).toContain('Falha');
        document.hidden = true;
        intervalo();
        expect(mocks.get).toHaveBeenCalledTimes(3);
    });

});
