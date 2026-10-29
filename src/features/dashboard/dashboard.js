import { montarLayout } from '../../shared/layout.js';
import { criarElemento, criarSpinner } from '../../shared/dom.js';
import './dashboard.css';
import API from '../../shared/api.js';
import { classeStatus, classeAlerta, classeContadorAlertas } from '../../shared/ui.js';
import { lotesPorStatus, alertasAtivos } from '../../shared/calculations.js';
import { formatNumber, formatKg, formatDate, formatDateTime } from '../../shared/formatters.js';
import { createBarChart, createDoughnutChart, CORES } from '../../shared/charts.js';
import { criarContexto, lerConsolidado, lerMateriais, estimarCo2, filtrarRecebimentos, agruparFornecedores } from './dashboard-data.js';

const SESSAO = montarLayout();
const INTERVALO_ATUALIZACAO_MS = 5000;
const COR_STATUS_LOTE = { Recebido: CORES.info, 'Em processamento': CORES.aviso, Finalizado: CORES.Metal };
const exibidos = new Map();
const pendentes = new Map();
const requisicoes = new Map();
let atualizacao, chaveCarga;
let periodo = 'mensal';

function partes(id) {
    const bloco = document.getElementById(id);
    return { bloco, estado: bloco.querySelector('.estado'), conteudo: bloco.querySelector('.conteudo'), aviso: bloco.querySelector('.aviso-atualizacao') };
}

function mostrarMensagem(id, mensagem, erro = false) {
    const { estado, conteudo } = partes(id);
    conteudo.classList.add('d-none');
    estado.replaceChildren(criarElemento('span', erro ? 'text-danger' : '', mensagem));
    estado.setAttribute('role', erro ? 'alert' : 'status');
}

function mostrarConteudo(id) {
    const { estado, conteudo } = partes(id);
    estado.replaceChildren();
    conteudo.classList.remove('d-none');
}

function buscar(url) {
    if (!requisicoes.has(url)) {
        const carga = Promise.resolve().then(() => API.GET(url, { erroLocal: true })).then((dados) => {
            if (!url.startsWith('/producao/') && !Array.isArray(dados)) throw new Error('Lista inválida da API.');
            return dados;
        }).finally(() => requisicoes.delete(url));
        requisicoes.set(url, carga);
    }
    return requisicoes.get(url);
}

/** Cada bloco tem identidade de período e de carga: respostas antigas não alteram a tela. */
function carregarBloco(id, contexto, cache = new Map()) {
    const config = BLOCOS[id];
    const chave = config.chave(contexto);
    if (pendentes.get(id)?.chave === chave) return pendentes.get(id).carga;
    const token = { chave };
    pendentes.set(id, token);
    const anterior = exibidos.get(id);
    const { bloco, estado, aviso } = partes(id);
    if (anterior?.chave !== chave) {
        mostrarMensagem(id, 'Carregando...');
        estado.prepend(criarSpinner(undefined, 'spinner-border spinner-border-sm'));
        aviso.textContent = '';
    }
    bloco.setAttribute('aria-busy', 'true');
    const fontes = config.fontes(contexto).map((url) => {
        if (!cache.has(url)) cache.set(url, buscar(url));
        return cache.get(url);
    });
    token.carga = (async () => {
        try {
            const resultados = await Promise.allSettled(fontes);
            if (pendentes.get(id) !== token) return;
            const falha = resultados.find((r) => r.status === 'rejected');
            if (falha) throw falha.reason;
            const dados = resultados.map((r) => r.value);
            const assinatura = JSON.stringify(dados);
            const ultimo = exibidos.get(id);
            let vazio = ultimo?.vazio;
            if (ultimo?.chave !== chave || ultimo.assinatura !== assinatura) {
                const desenhar = config.preparar(...dados, contexto);
                vazio = !desenhar;
                if (!vazio) { mostrarConteudo(id); desenhar(); }
            }
            if (vazio) mostrarMensagem(id, config.mensagemVazio ?? 'Sem dados no período');
            else mostrarConteudo(id);
            const horario = new Date().toLocaleTimeString('pt-BR');
            exibidos.set(id, { chave, assinatura, vazio, horario });
            aviso.className = 'aviso-atualizacao small text-body-secondary mt-2';
            aviso.setAttribute('role', 'status');
            aviso.textContent = 'Atualizado às ' + horario;
        } catch {
            if (pendentes.get(id) !== token) return;
            const ultimo = exibidos.get(id);
            if (ultimo?.chave === chave) {
                aviso.className = 'aviso-atualizacao small text-warning-emphasis mt-2';
                aviso.setAttribute('role', 'alert');
                aviso.textContent = 'Não foi possível atualizar. Dados da última atualização às ' + ultimo.horario + '.';
            } else {
                mostrarMensagem(id, 'Não foi possível carregar este bloco.', true);
                if (id === 'bloco-alertas') document.getElementById('contador-alertas').textContent = '–';
            }
            const botao = criarElemento('button', 'btn btn-outline-primary btn-sm ms-2', 'Tentar novamente');
            botao.type = 'button';
            botao.addEventListener('click', () => carregarBloco(id, criarContexto(periodo)));
            (ultimo?.chave === chave ? aviso : estado).append(botao);
        } finally {
            if (pendentes.get(id) === token) {
                pendentes.delete(id);
                bloco.setAttribute('aria-busy', 'false');
            }
        }
    })();
    return token.carga;
}

function card(titulo, valor, cor = 'ind-info') {
    const caixa = criarElemento('div', 'indicador');
    const corpo = criarElemento('div', 'card-body');
    corpo.append(criarElemento('div', 'small text-body-secondary', titulo), criarElemento('div', 'valor', valor));
    const painel = criarElemento('div', 'card card-ind shadow-sm h-100 ' + cor);
    painel.append(corpo);
    caixa.append(painel);
    return caixa;
}

function prepararResumo(resposta, contexto) {
    const d = lerConsolidado(resposta, contexto.tipo);
    return () => partes('bloco-producao').conteudo.replaceChildren(
        card('Entrada na produção', formatKg(d.entrada)), card('Saída produzida', formatKg(d.saida), 'ind-verde'),
        card('Rejeito registrado', formatKg(d.rejeito)), card('Aproveitamento', formatNumber(d.aproveitamento) + '%', 'ind-verde')
    );
}

function avisoRecebimentos(dados) {
    return dados.descartados ? `${dados.descartados} registro(s) com data ou peso inválido desconsiderado(s).` : '';
}

function prepararRecebido(lotes, contexto) {
    const dados = filtrarRecebimentos(lotes, contexto);
    return () => partes('bloco-recebimento').conteudo.replaceChildren(
        card('Recebido', formatKg(dados.total), 'ind-azul'),
        criarElemento('p', 'small text-warning-emphasis mt-2 mb-0', avisoRecebimentos(dados))
    );
}

function prepararMateriais(resposta) {
    const totais = lerMateriais(resposta);
    return () => {
        document.getElementById('cards-materiais').replaceChildren(...Object.entries(totais).map(([nome, peso]) => card(nome, formatKg(peso))));
        const temPeso = Object.values(totais).some((n) => n > 0);
        document.getElementById('area-grafico-materiais').classList.toggle('d-none', !temPeso);
        document.getElementById('materiais-vazio').classList.toggle('d-none', temPeso);
        if (temPeso) createDoughnutChart(document.getElementById('grafico-materiais'), Object.entries(totais).map(([nome, peso]) => ({ rotulo: nome, valor: peso, cor: CORES[nome] })));
    };
}

function prepararConsolidado(resposta, tipo, canvas) {
    const d = lerConsolidado(resposta, tipo);
    const valores = [d.entrada, d.saida, d.rejeito];
    if (valores.every((n) => n === 0)) return null;
    return () => createBarChart(document.getElementById(canvas), ['Entrada', 'Saída produzida', 'Rejeitos e perdas'],
        [{ label: 'Peso (kg)', data: valores, cor: CORES.info }], { rotuloY: 'kg', formatarValor: formatNumber });
}

function prepararCo2(resposta) {
    const totais = lerMateriais(resposta);
    const { total, porMaterial } = estimarCo2(totais);
    return () => {
        document.getElementById('co2-total').textContent = formatNumber(total);
        const temPeso = totais['Plástico'] > 0 || totais.Metal > 0;
        document.getElementById('area-grafico-co2').classList.toggle('d-none', !temPeso);
        document.getElementById('co2-vazio').classList.toggle('d-none', temPeso);
        if (temPeso) createBarChart(document.getElementById('grafico-co2'), Object.keys(porMaterial),
            [{ label: 'CO₂e evitado (t)', data: Object.values(porMaterial), cor: Object.keys(porMaterial).map((nome) => CORES[nome]) }],
            { rotuloY: 't CO₂e', formatarValor: formatNumber });
    };
}

function prepararFornecedores(lotes, fornecedores, contexto) {
    const recebimentos = filtrarRecebimentos(lotes, contexto);
    const grupos = agruparFornecedores(recebimentos.registros, fornecedores);
    return () => {
        document.getElementById('aviso-fornecedores').textContent = avisoRecebimentos(recebimentos);
        document.getElementById('area-grafico-fornecedores').classList.toggle('d-none', !grupos.length);
        document.getElementById('fornecedores-vazio').classList.toggle('d-none', Boolean(grupos.length));
        if (grupos.length) createBarChart(document.getElementById('grafico-fornecedores'), grupos.map((d) => d.nome),
            [{ label: 'Recebido (kg)', data: grupos.map((d) => d.total), cor: CORES['Plástico'] }], { horizontal: true, formatarValor: formatNumber });
    };
}

function prepararStatusLotes(lotes) {
    const dados = lotesPorStatus(lotes);
    if (!dados.length) return null;
    return () => createDoughnutChart(document.getElementById('grafico-status-lotes'), dados.map((d) => ({
        rotulo: `${d.status} (${d.quantidade})`, valor: d.quantidade, cor: COR_STATUS_LOTE[d.status] ?? CORES.cinza,
    })));
}

function prepararEsteiras(esteiras) {
    if (!esteiras.length) return null;
    return () => partes('bloco-esteira').conteudo.replaceChildren(...esteiras.map((e) => {
        const linha = criarElemento('div', 'esteira-item');
        const topo = criarElemento('div', 'd-flex justify-content-between align-items-center');
        topo.append(criarElemento('strong', '', e.nome_esteira), criarElemento('span', 'badge ' + classeStatus(e.status_esteira), e.status_esteira));
        linha.append(topo, criarElemento('div', 'small text-body-secondary', `Velocidade: ${formatNumber(e.velocidade_esteira_kmh, 1)} km/h · Temperatura: ${formatNumber(e.temperatura_esteira_c, 1)} °C`));
        return linha;
    }));
}

function prepararAlertas(alertas) {
    const ativos = alertasAtivos(alertas).sort((a, b) => String(b.datahora_alerta).localeCompare(String(a.datahora_alerta)));
    return () => {
        const contador = document.getElementById('contador-alertas');
        contador.textContent = String(ativos.length);
        contador.className = 'badge ' + classeContadorAlertas(ativos.length);
        const lista = criarElemento('ul', 'list-group list-group-flush');
        for (const alerta of ativos) {
            const linha = criarElemento('li', 'list-group-item d-flex justify-content-between align-items-start gap-2');
            linha.append(criarElemento('span', 'badge badge-alerta ' + classeAlerta(alerta.tipo_alerta), alerta.tipo_alerta),
                criarElemento('small', 'text-body-secondary text-nowrap', formatDateTime(alerta.datahora_alerta)));
            lista.append(linha);
        }
        partes('bloco-alertas').conteudo.replaceChildren(ativos.length ? lista : criarElemento('p', 'text-body-secondary mb-0', 'Nenhum alerta ativo.'));
    };
}

const filtrado = (c) => c.chave;
const atual = () => 'atual';
const BLOCOS = {
    'bloco-recebimento': { chave: filtrado, fontes: () => ['/lotes'], preparar: prepararRecebido },
    'bloco-producao': { chave: filtrado, fontes: (c) => [c.rotas[c.tipo]], preparar: prepararResumo },
    'bloco-materiais': { chave: filtrado, fontes: (c) => [c.materiais], preparar: prepararMateriais },
    'bloco-co2': { chave: filtrado, fontes: (c) => [c.materiais], preparar: prepararCo2 },
    'bloco-fornecedores': { chave: filtrado, fontes: () => ['/lotes', '/fornecedores'], preparar: prepararFornecedores },
    'bloco-status-lotes': { mensagemVazio: 'Nenhum lote disponível.', chave: atual, fontes: () => ['/lotes'], preparar: prepararStatusLotes },
    'bloco-esteira': { mensagemVazio: 'Nenhuma esteira disponível.', chave: atual, fontes: () => ['/esteiras'], preparar: prepararEsteiras },
    'bloco-alertas': { chave: atual, fontes: () => ['/alertas'], preparar: prepararAlertas },
};
for (const [tipo, nome] of Object.entries({ diario: 'diaria', mensal: 'mensal', trimestral: 'trimestral' })) {
    BLOCOS['bloco-' + nome] = { chave: (c) => c.rotas[tipo], fontes: (c) => [c.rotas[tipo]], preparar: (d) => prepararConsolidado(d, tipo, 'grafico-' + nome) };
}

function carregarDashboard() {
    const contexto = criarContexto(periodo);
    const identidade = contexto.chave + contexto.rotas.diario;
    if (atualizacao && chaveCarga === identidade) return atualizacao;
    chaveCarga = identidade;
    const descricao = `${formatDate(contexto.inicio)} a ${formatDate(contexto.fim)}`;
    document.getElementById('periodo-descricao').textContent = descricao;
    document.querySelectorAll('.periodo-selecionado').forEach((el) => { el.textContent = descricao; });
    const cache = new Map();
    const carga = Promise.allSettled(Object.keys(BLOCOS).map((id) => carregarBloco(id, contexto, cache)));
    atualizacao = carga;
    carga.finally(() => { if (atualizacao === carga) atualizacao = null; });
    return carga;
}

if (SESSAO) {
    const seletor = document.getElementById('periodo-dashboard');
    seletor.value = periodo;
    seletor.addEventListener('change', () => {
        if (!['diario', 'mensal', 'trimestral'].includes(seletor.value)) return;
        periodo = seletor.value;
        carregarDashboard();
    });
    carregarDashboard();
    setInterval(() => { if (!document.hidden) carregarDashboard(); }, INTERVALO_ATUALIZACAO_MS);
}
