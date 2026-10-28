import API from '../../shared/api.js';
import { montarLayout } from '../../shared/layout.js';
import { can } from '../../shared/session.js';
import { createTable, h, updateTable } from '../../shared/table.js';
import { formatKg } from '../../shared/formatters.js';
import { classeStatus } from '../../shared/ui.js';
import {
    montarLinhas, opcoesDeStatus, filtrarProducoes, ordenarPorId
} from './production-monitoring-filter.js';

// Consultar vale para todos os perfis; só a ação de iniciar exige `producao.operar` (veja `colunas`).
const SESSAO = montarLayout();

// TODO(pendência): caminho definitivo da etapa 2 e forma de passar a produção (aqui, ?producao=ID).
// Esta tela só navega; a etapa 2 deve validar o parâmetro que receber.
const ETAPA_2_URL = './production-progress.html';

if (SESSAO) {
    iniciarTela();
}

function iniciarTela() {
    const blocoFiltros = document.getElementById('bloco-filtros');
    const form = document.getElementById('form-filtros');
    const inputBusca = document.getElementById('busca');
    const selectStatus = document.getElementById('filtro-status');
    const cabecalho = document.getElementById('cabecalho-producoes');
    const contador = document.getElementById('contador-producoes');
    const estado = document.querySelector('#bloco-producoes .estado');
    const conteudo = document.querySelector('#bloco-producoes .conteudo');

    // Campos do escopo. A ação só existe para quem pode iniciar produção.
    const colunas = [
        { id: 'id', label: 'ID da produção' },
        { id: 'lote', label: 'ID do lote' },
        { id: 'esteira', label: 'Esteira' },
        { id: 'turno', label: 'Turno' },
        { id: 'peso_lote', label: 'Peso do lote', formatar: formatKg },
        {
            id: 'status',
            label: 'Status',
            formatar: (status) => h('span', { className: 'badge ' + classeStatus(status) }, String(status ?? ''))
        }
    ];
    if (can('producao.operar')) {
        colunas.push({
            label: 'Ação',
            acoes: [{
                texto: 'Iniciar produção',
                icone: 'play',
                classe: 'btn-primary',
                aoClicar: (linha) => irParaEtapa2(linha.id)
            }]
        });
    }

    let linhas = [];
    let grid = null;

    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        aplicarFiltros();
    });
    document.getElementById('limpar-filtros').addEventListener('click', limparFiltros);

    carregar();

    async function carregar() {
        blocoFiltros.classList.add('d-none');
        cabecalho.classList.add('d-none');
        conteudo.classList.add('d-none');
        mostrarCarregando();
        try {
            // erroLocal: o erro aparece aqui, sem redirecionar para as páginas de erro (como production.js).
            const [producoes, lotes, esteiras] = await Promise.all([
                API.GET('/producao', { erroLocal: true }),
                API.GET('/lotes', { erroLocal: true }),
                API.GET('/esteiras', { erroLocal: true })
            ]);
            linhas = montarLinhas(
                Array.isArray(producoes) ? producoes : [],
                Array.isArray(lotes) ? lotes : [],
                Array.isArray(esteiras) ? esteiras : []
            );
        } catch (erro) {
            mostrarMensagem(erro.message, { texto: 'Tentar novamente', aoClicar: carregar, erro: true });
            return;
        }
        preencherStatus();
        blocoFiltros.classList.remove('d-none');
        aplicarFiltros();
    }

    function preencherStatus() {
        selectStatus.length = 1;
        opcoesDeStatus(linhas).forEach(({ valor, rotulo }) => selectStatus.add(new Option(rotulo, valor)));
    }

    function limparFiltros() {
        form.reset();
        aplicarFiltros();
    }

    function aplicarFiltros() {
        const filtradas = ordenarPorId(filtrarProducoes(linhas, { busca: inputBusca.value, status: selectStatus.value }));
        cabecalho.classList.remove('d-none');
        contador.textContent = '(' + filtradas.length + ')';

        if (linhas.length === 0) {
            conteudo.classList.add('d-none');
            mostrarMensagem('Nenhuma produção disponível no momento.');
        } else if (filtradas.length === 0) {
            conteudo.classList.add('d-none');
            mostrarMensagem('Nenhuma produção encontrada para esta pesquisa.', { texto: 'Limpar', aoClicar: limparFiltros });
        } else {
            mostrarTabela(filtradas);
        }
    }

    function mostrarTabela(dados) {
        estado.replaceChildren();
        conteudo.classList.remove('d-none'); // visível antes de desenhar
        if (grid) {
            updateTable(grid, dados);
        } else {
            // Busca própria da tela: a do Grid.js fica desligada. A ordem é a de ordenarPorId.
            grid = createTable('#tabela-producoes', colunas, dados, { busca: false, ordenar: false });
        }
    }

    // Só navega: a etapa 2 ainda não existe.
    function irParaEtapa2(id) {
        location.assign(ETAPA_2_URL + '?producao=' + encodeURIComponent(id));
    }

    function mostrarCarregando() {
        const caixa = document.createElement('div');
        caixa.className = 'text-center py-4';
        const spinner = document.createElement('div');
        spinner.className = 'spinner-border text-primary';
        spinner.setAttribute('role', 'status');
        const texto = document.createElement('span');
        texto.className = 'visually-hidden';
        texto.textContent = 'Carregando produções...';
        spinner.appendChild(texto);
        caixa.appendChild(spinner);
        estado.replaceChildren(caixa);
    }

    // acao: { texto, aoClicar, erro? }
    function mostrarMensagem(texto, acao = null) {
        const caixa = document.createElement('div');
        caixa.className = 'text-center py-4';

        const paragrafo = document.createElement('p');
        paragrafo.className = (acao && acao.erro ? 'text-danger' : 'text-body-secondary') + ' mb-3';
        paragrafo.textContent = texto;
        caixa.appendChild(paragrafo);

        if (acao) {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'btn btn-outline-primary';
            botao.textContent = acao.texto;
            botao.addEventListener('click', acao.aoClicar);
            caixa.appendChild(botao);
        }
        estado.replaceChildren(caixa);
    }
}
