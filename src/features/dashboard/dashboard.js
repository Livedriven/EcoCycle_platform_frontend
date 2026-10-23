import '../../shared/setup.js';
import './dashboard.css';
import { API } from '../../shared/api.js';
import {
    MATERIAIS,
    totalRecebido,
    totalProduzido,
    totalPorMaterial,
    producaoPorDia,
    producaoPorMes,
    recebidoPorFornecedor,
    lotesPorStatus,
    alertasAtivos,
    co2Evitado
} from '../../shared/calculations.js';
import {
    formatNumber,
    formatKg,
    formatDateTime,
    formatDayMonth,
    formatMonth
} from '../../shared/formatters.js';
import { createBarChart, createDoughnutChart, CORES } from './charts.js';

const COR_STATUS_LOTE = {
    'Recebido': CORES.info,
    'Em processamento': CORES.aviso,
    'Finalizado': CORES.Metal
};

// Links "Testar estados" do dashboard.html: ?simular=vazio ou ?simular=erro
const SIMULAR = new URLSearchParams(window.location.search).get('simular');

/* ---------- Busca de dados ---------- */

function buscar(caminho) {
    if (SIMULAR === 'erro') {
        return Promise.reject(new Error('Erro simulado para teste.'));
    }
    if (SIMULAR === 'vazio') {
        return Promise.resolve([]);
    }
    return API.GET(caminho);
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
    estado.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div><span>Carregando...</span>';
}

function mostrarMensagem(id, texto, icone) {
    const { estado, conteudo } = partesDoBloco(id);
    conteudo.classList.add('d-none');
    estado.innerHTML = '';
    const i = document.createElement('i');
    i.className = 'bi bi-' + icone + ' fs-3';
    const p = document.createElement('span');
    p.textContent = texto;
    estado.append(i, p);
}

function mostrarConteudo(id) {
    const { estado, conteudo } = partesDoBloco(id);
    estado.innerHTML = '';
    conteudo.classList.remove('d-none');
}

/**
 * Carrega um bloco: espera os dados, pede a "preparar" para validar/calcular
 * e, só se houver o que mostrar, exibe o bloco e executa o que ela devolveu (desenhar).
 * preparar(...dados) devolve uma função de desenho, ou null quando não há dados.
 */
async function montarBloco(id, fontes, preparar, textoVazio = 'Sem dados para mostrar.') {
    mostrarCarregando(id);
    try {
        const dados = await Promise.all(fontes);
        const desenhar = preparar(...dados);
        if (!desenhar) {
            mostrarMensagem(id, textoVazio, 'inbox');
            return;
        }
        // Mostra o bloco antes de desenhar: o Chart.js mede o canvas, que não pode estar escondido.
        mostrarConteudo(id);
        desenhar();
    } catch (erro) {
        mostrarMensagem(id, erro.message, 'exclamation-triangle');
    }
}

/* ---------- Blocos ---------- */

function cardIndicador(classe, titulo, valor) {
    const col = document.createElement('div');
    col.className = 'col-6 col-lg';
    col.innerHTML =
        '<div class="card card-ind shadow-sm h-100 ' + classe + '"><div class="card-body">' +
        '<div class="small" style="color:var(--eco-texto-suave)"></div><div class="valor"></div></div></div>';
    col.querySelector('.small').textContent = titulo;
    col.querySelector('.valor').textContent = valor;
    return col;
}

function prepararIndicadores(lotes, producao, alertas) {
    if (lotes.length === 0 && producao.length === 0 && alertas.length === 0) {
        return null;
    }
    return () => {
        const porMaterial = totalPorMaterial(producao);
        const ativos = alertasAtivos(alertas).length;
        const cards = [
            cardIndicador('ind-azul', 'Total recebido', formatKg(totalRecebido(lotes))),
            cardIndicador('ind-info', 'Total processado', formatKg(totalProduzido(producao))),
            cardIndicador('ind-azul', 'Plástico', formatKg(porMaterial['Plástico'])),
            cardIndicador('ind-verde', 'Metal', formatKg(porMaterial['Metal'])),
            cardIndicador(ativos > 0 ? 'ind-perigo' : 'ind-verde', 'Alertas ativos', String(ativos))
        ];
        document.querySelector('#bloco-indicadores .conteudo').replaceChildren(...cards);
    };
}

function datasetsPorMaterial(series) {
    return MATERIAIS.map((material) => ({ label: material, data: series[material], cor: CORES[material] }));
}

function temProducao(series) {
    return MATERIAIS.some((m) => series[m].some((v) => v > 0));
}

function prepararDiaria(producao) {
    const { chaves, series } = producaoPorDia(producao, 7);
    if (!temProducao(series)) {
        return null;
    }
    return () => createBarChart(
        document.getElementById('grafico-diaria'),
        chaves.map(formatDayMonth),
        datasetsPorMaterial(series),
        { empilhado: true, rotuloY: 'kg', formatarValor: formatNumber }
    );
}

function prepararMensal(producao) {
    const { chaves, series } = producaoPorMes(producao, 6);
    if (!temProducao(series)) {
        return null;
    }
    return () => createBarChart(
        document.getElementById('grafico-mensal'),
        chaves.map(formatMonth),
        datasetsPorMaterial(series),
        { empilhado: true, rotuloY: 'kg', formatarValor: formatNumber }
    );
}

function prepararCo2(producao) {
    const { total, porMaterial } = co2Evitado(producao);
    if (total === 0) {
        return null;
    }
    return () => {
        document.getElementById('co2-total').textContent = formatNumber(total);
        createBarChart(
            document.getElementById('grafico-co2'),
            MATERIAIS,
            [{ label: 'CO₂e evitado (t)', data: MATERIAIS.map((m) => porMaterial[m]), cor: MATERIAIS.map((m) => CORES[m]) }],
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
    badge.className = 'badge ' + (esteira.status_esteira === 'Ativa' ? 'b-sucesso' : 'b-aviso');
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
    linha.className = 'list-group-item d-flex justify-content-between align-items-center';
    const tipo = document.createElement('span');
    tipo.textContent = alerta.tipo_alerta;
    const data = document.createElement('small');
    data.style.color = 'var(--eco-texto-suave)';
    data.textContent = formatDateTime(alerta.datahora_alerta);
    linha.append(tipo, data);
    return linha;
}

function prepararAlertas(alertas) {
    const ativos = alertasAtivos(alertas)
        .sort((a, b) => String(b.datahora_alerta).localeCompare(String(a.datahora_alerta)));
    document.getElementById('contador-alertas').textContent = String(ativos.length);
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

async function carregarDashboard() {
    const botao = document.getElementById('btn-atualizar');
    botao.disabled = true;

    // Cada endpoint é buscado uma vez e compartilhado entre os blocos que precisam dele.
    const lotes = buscar('/lotes');
    const producao = buscar('/producao');
    const fornecedores = buscar('/fornecedores');
    const alertas = buscar('/alertas');
    const esteiras = buscar('/esteiras');

    await Promise.all([
        montarBloco('bloco-indicadores', [lotes, producao, alertas], prepararIndicadores),
        montarBloco('bloco-diaria', [producao], prepararDiaria, 'Sem produção nos últimos 7 dias.'),
        montarBloco('bloco-mensal', [producao], prepararMensal, 'Sem produção nos últimos 6 meses.'),
        montarBloco('bloco-co2', [producao], prepararCo2),
        montarBloco('bloco-fornecedores', [lotes, fornecedores], prepararFornecedores),
        montarBloco('bloco-status-lotes', [lotes], prepararStatusLotes),
        montarBloco('bloco-esteira', [esteiras], prepararEsteira, 'Nenhuma esteira cadastrada.'),
        montarBloco('bloco-alertas', [alertas], prepararAlertas, 'Nenhum alerta ativo.')
    ]);

    botao.disabled = false;
}

document.getElementById('btn-atualizar').addEventListener('click', carregarDashboard);
carregarDashboard();
