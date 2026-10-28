import { montarLayout } from '../../shared/layout.js';
import { criarElemento, criarSpinner } from '../../shared/dom.js';
import './dashboard.css';
import API from '../../shared/api.js';
import { classeStatus, classeAlerta, classeContadorAlertas } from '../../shared/ui.js';
import {
    MATERIAIS_RELATORIO as MATERIAIS,
    totalRecebido,
    totalProduzido,
    totalPorMaterial,
    recebidoPorFornecedor,
    lotesPorStatus,
    alertasAtivos,
    co2Evitado
} from '../../shared/calculations.js';
import {
    formatNumber,
    formatKg,
    formatDateTime
} from '../../shared/formatters.js';
import { createBarChart, createDoughnutChart, CORES } from '../../shared/charts.js';
import { prepararProducaoMateriais } from '../materials/materials-report.js';

const COR_STATUS_LOTE = {
    'Recebido': CORES.info,
    'Em processamento': CORES.aviso,
    'Finalizado': CORES.Metal
};

// Página protegida: sem sessão válida, montarLayout() já redireciona ao login.
const SESSAO = montarLayout();
const INTERVALO_ATUALIZACAO_MS = 5000;
let carregando = false;

/* ---------- Busca de dados ---------- */

function buscar(caminho) {
    return API.GET(caminho, { erroLocal: true }).then((dados) => {
        if (caminho.startsWith('/producao/dashboard-')) return dados;
        if (dados == null) return [];
        if (!Array.isArray(dados)) throw new Error('Resposta inválida da API.');
        return dados;
    });
}

/* ---------- Estados de cada bloco (carregando, erro, vazio, pronto) ---------- */

function partesDoBloco(id) {
    const bloco = document.getElementById(id);
    return {
        estado: bloco.querySelector('.estado'),
        conteudo: bloco.querySelector('.conteudo')
    };
}

function mostrarCarregando(id) {
    const { estado, conteudo } = partesDoBloco(id);
    conteudo.classList.add('d-none');
    estado.replaceChildren(criarSpinner(undefined, 'spinner-border spinner-border-sm'), criarElemento('span', '', 'Carregando...'));
    document.getElementById(id).setAttribute('aria-busy', 'true');
    estado.setAttribute('role', 'status');
}

function mostrarMensagem(id, texto, icone) {
    const { estado, conteudo } = partesDoBloco(id);
    conteudo.classList.add('d-none');
    estado.replaceChildren();
    const i = document.createElement('i');
    i.className = 'bi bi-' + icone + ' fs-3' + (icone === 'exclamation-triangle' ? ' text-danger' : '');
    const p = document.createElement('span');
    p.textContent = texto;
    estado.append(i, p);
    estado.setAttribute('role', icone === 'exclamation-triangle' ? 'alert' : 'status');
}

function mostrarConteudo(id) {
    const { estado, conteudo } = partesDoBloco(id);
    estado.replaceChildren();
    conteudo.classList.remove('d-none');
}

/**
 * Carrega um bloco: espera os dados, pede a "preparar" para validar/calcular
 * e, só se houver o que mostrar, exibe o bloco e executa o que ela devolveu (desenhar).
 * preparar(...dados) devolve uma função de desenho, ou null quando não há dados.
 */
const dadosExibidos = new Map();
async function montarBloco(id, fontes, preparar) {
    if (!dadosExibidos.has(id)) mostrarCarregando(id);
    try {
        const resultados = await Promise.allSettled(fontes);
        const falha = resultados.find((resultado) => resultado.status === 'rejected');
        if (falha) throw falha.reason;
        const dados = resultados.map((resultado) => resultado.value);
        const assinatura = JSON.stringify(dados);
        if (dadosExibidos.get(id) === assinatura) return;
        const desenhar = preparar(...dados);
        if (!desenhar) {
            mostrarMensagem(id, 'Sem dados no período', 'inbox');
            dadosExibidos.set(id, assinatura);
            return;
        }
        // Mostra o bloco antes de desenhar: o Chart.js mede o canvas, que não pode estar escondido.
        mostrarConteudo(id);
        desenhar();
        dadosExibidos.set(id, assinatura);
    } catch {
        if (dadosExibidos.has(id)) return;
        mostrarMensagem(id, 'Não foi possível carregar este bloco.', 'exclamation-triangle');
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn btn-outline-primary btn-sm';
        botao.textContent = 'Tentar novamente';
        botao.addEventListener('click', () => carregarBloco(id));
        partesDoBloco(id).estado.append(botao);
        if (id === 'bloco-alertas') document.getElementById('contador-alertas').textContent = '–';
    } finally {
        document.getElementById(id).setAttribute('aria-busy', 'false');
    }
}

/* ---------- Blocos ---------- */

function cardIndicador(classe, titulo, valor, grupo = 'material') {
    const col = document.createElement('div');
    col.className = 'indicador indicador-' + grupo;
    const card = criarElemento('div', 'card card-ind shadow-sm h-100 ' + classe);
    const corpo = criarElemento('div', 'card-body');
    const rotulo = criarElemento('div', 'small', titulo);
    rotulo.style.color = 'var(--eco-texto-suave)';
    corpo.append(rotulo, criarElemento('div', 'valor', valor));
    card.append(corpo);
    col.append(card);
    return col;
}

function prepararIndicadores(lotes, producao, alertas, materiais) {
    // Os pesos por material vêm dos itens de cada ciclo, com o tipo do catálogo.
    const composicao = prepararProducaoMateriais(producao, materiais);
    return () => {
        const porMaterial = totalPorMaterial(composicao.registros, MATERIAIS);
        const ativos = alertasAtivos(alertas).length;
        const detalhado = composicao.pendencias.length === 0 && composicao.descartados === 0;
        const pesoMaterial = (material) => detalhado ? formatKg(porMaterial[material]) : 'Não informado';
        const cards = [
            cardIndicador('ind-azul', 'Total recebido', formatKg(totalRecebido(lotes)), 'resumo'),
            cardIndicador('ind-info', 'Total processado', formatKg(totalProduzido(producao)), 'resumo'),
            cardIndicador(ativos > 0 ? 'ind-perigo' : 'ind-sucesso', 'Alertas ativos', String(ativos), 'resumo'),
            cardIndicador('ind-azul', 'Plástico', pesoMaterial('Plástico')),
            cardIndicador('ind-verde', 'Metal', pesoMaterial('Metal')),
            cardIndicador('ind-info', 'Alumínio', pesoMaterial('Alumínio')),
            cardIndicador('ind-info', 'Rejeito', pesoMaterial('Rejeito'))
        ];
        document.querySelector('#bloco-indicadores .conteudo').replaceChildren(...cards);
        if (lotes.length === 0 && producao.length === 0 && alertas.length === 0) {
            mostrarMensagem('bloco-indicadores', 'Sem dados no período', 'inbox');
            partesDoBloco('bloco-indicadores').conteudo.classList.remove('d-none');
        }
    };
}

function prepararConsolidado(dados, periodo) {
    if (Array.isArray(dados) && dados.length === 0) return null;
    const massas = dados?.balanco_massas_kg;
    const valores = [massas?.total_material_entrada, massas?.total_produzido_saida, massas?.total_rejeitos_perdas];
    if (valores.some((v) => v == null || !Number.isFinite(Number(v)) || Number(v) < 0)) {
        throw new Error('Resposta inválida do dashboard de produção.');
    }
    if (valores.every((v) => Number(v) === 0)) return null;
    return () => createBarChart(
        document.getElementById('grafico-' + periodo),
        ['Entrada', 'Saída produzida', 'Rejeitos e perdas'],
        [{ label: 'Peso (kg)', data: valores.map(Number), cor: CORES.info }],
        { rotuloY: 'kg', formatarValor: formatNumber }
    );
}

function prepararCo2(producao, materiais) {
    const { total, porMaterial } = co2Evitado(prepararProducaoMateriais(producao, materiais).registros);
    if (total === 0) {
        return null;
    }
    return () => {
        document.getElementById('co2-total').textContent = formatNumber(total);
        createBarChart(
            document.getElementById('grafico-co2'),
            Object.keys(porMaterial),
            [{ label: 'CO₂e evitado (t)', data: Object.values(porMaterial), cor: Object.keys(porMaterial).map((m) => CORES[m]) }],
            { rotuloY: 't CO₂e', formatarValor: formatNumber }
        );
    };
}

function prepararFornecedores(lotes, fornecedores) {
    const dados = recebidoPorFornecedor(lotes, fornecedores);
    if (dados.length === 0) {
        return null;
    }
    return () => createBarChart(
        document.getElementById('grafico-fornecedores'),
        dados.map((d) => d.nome),
        [{ label: 'Recebido (kg)', data: dados.map((d) => d.total), cor: CORES['Plástico'] }],
        { horizontal: true, formatarValor: formatNumber }
    );
}

function prepararStatusLotes(lotes) {
    const dados = lotesPorStatus(lotes);
    if (dados.length === 0) {
        return null;
    }
    return () => createDoughnutChart(
        document.getElementById('grafico-status-lotes'),
        dados.map((d) => ({
            rotulo: d.status + ' (' + d.quantidade + ')',
            valor: d.quantidade,
            cor: COR_STATUS_LOTE[d.status] ?? CORES.cinza
        }))
    );
}

function linhaEsteira(esteira) {
    const linha = document.createElement('div');
    linha.className = 'esteira-item';

    const topo = document.createElement('div');
    topo.className = 'd-flex justify-content-between align-items-center';
    const nome = document.createElement('strong');
    nome.textContent = esteira.nome_esteira;
    const badge = document.createElement('span');
    badge.className = 'badge ' + classeStatus(esteira.status_esteira);
    badge.textContent = esteira.status_esteira;
    topo.append(nome, badge);

    const detalhes = document.createElement('div');
    detalhes.className = 'small';
    detalhes.style.color = 'var(--eco-texto-suave)';
    detalhes.textContent =
        'Velocidade: ' + formatNumber(esteira.velocidade_esteira_kmh, 1) + ' km/h · ' +
        'Temperatura: ' + formatNumber(esteira.temperatura_esteira_c, 1) + ' °C';

    linha.append(topo, detalhes);
    return linha;
}

function prepararEsteira(esteiras) {
    if (esteiras.length === 0) {
        return null;
    }
    return () => document.querySelector('#bloco-esteira .conteudo').replaceChildren(...esteiras.map(linhaEsteira));
}

function linhaAlerta(alerta) {
    const linha = document.createElement('li');
    linha.className = 'list-group-item d-flex justify-content-between align-items-start gap-2';
    const tipo = document.createElement('span');
    tipo.className = 'badge badge-alerta ' + classeAlerta(alerta.tipo_alerta);
    tipo.textContent = alerta.tipo_alerta;
    const data = document.createElement('small');
    data.className = 'text-nowrap';
    data.style.color = 'var(--eco-texto-suave)';
    data.textContent = formatDateTime(alerta.datahora_alerta);
    linha.append(tipo, data);
    return linha;
}

function prepararAlertas(alertas) {
    const ativos = alertasAtivos(alertas)
        .sort((a, b) => String(b.datahora_alerta).localeCompare(String(a.datahora_alerta)));
    const contador = document.getElementById('contador-alertas');
    contador.textContent = String(ativos.length);
    contador.className = 'badge ' + classeContadorAlertas(ativos.length);
    if (ativos.length === 0) {
        return null;
    }
    return () => {
        const lista = document.createElement('ul');
        lista.className = 'list-group list-group-flush';
        lista.append(...ativos.map(linhaAlerta));
        document.querySelector('#bloco-alertas .conteudo').replaceChildren(lista);
    };
}

/* ---------- Carga da página ---------- */

const BLOCOS = {
    'bloco-indicadores': { fontes: ['/lotes', '/producao', '/alertas', '/materiais'], preparar: prepararIndicadores },
    'bloco-diaria': { fontes: ['/producao/dashboard-diario'], preparar: (d) => prepararConsolidado(d, 'diaria') },
    'bloco-mensal': { fontes: ['/producao/dashboard-mensal'], preparar: (d) => prepararConsolidado(d, 'mensal') },
    'bloco-trimestral': { fontes: ['/producao/dashboard-trimestral'], preparar: (d) => prepararConsolidado(d, 'trimestral') },
    'bloco-co2': { fontes: ['/producao', '/materiais'], preparar: prepararCo2 },
    'bloco-fornecedores': { fontes: ['/lotes', '/fornecedores'], preparar: prepararFornecedores },
    'bloco-status-lotes': { fontes: ['/lotes'], preparar: prepararStatusLotes },
    'bloco-esteira': { fontes: ['/esteiras'], preparar: prepararEsteira },
    'bloco-alertas': { fontes: ['/alertas'], preparar: prepararAlertas }
};
const pendentes = new Map();

function rotaDoPeriodo(caminho) {
    const hoje = new Date();
    if (caminho.endsWith('/dashboard-diario')) {
        const data = [hoje.getDate(), hoje.getMonth() + 1, hoje.getFullYear()].map((v) => String(v).padStart(2, '0')).join('/');
        return caminho + '?' + new URLSearchParams({ data });
    }
    if (caminho.endsWith('/dashboard-mensal')) return caminho + '?' + new URLSearchParams({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear() });
    if (caminho.endsWith('/dashboard-trimestral')) return caminho + '?' + new URLSearchParams({ trimestre: Math.floor(hoje.getMonth() / 3) + 1, ano: hoje.getFullYear() });
    return caminho;
}

function carregarBloco(id, cache = new Map()) {
    if (pendentes.has(id)) return pendentes.get(id);
    const { fontes, preparar } = BLOCOS[id];
    const requisicoes = fontes.map((fonte) => {
        const caminho = rotaDoPeriodo(fonte);
        const chave = caminho;
        if (!cache.has(chave)) cache.set(chave, Promise.resolve().then(() => buscar(caminho)));
        return cache.get(chave);
    });
    const carga = montarBloco(id, requisicoes, preparar).finally(() => pendentes.delete(id));
    pendentes.set(id, carga);
    return carga;
}

async function carregarDashboard() {
    if (carregando) return;
    carregando = true;
    try {
        // Busca cada endpoint uma vez por atualização, sem bloquear blocos independentes.
        const cache = new Map();
        await Promise.allSettled(Object.keys(BLOCOS).map((id) => carregarBloco(id, cache)));
    } finally {
        carregando = false;
    }
}

if (SESSAO) {
    carregarDashboard();
    setInterval(() => {
        if (!document.hidden) carregarDashboard();
    }, INTERVALO_ATUALIZACAO_MS);
}
