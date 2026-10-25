import API from '../../shared/api.js';
import { montarLayout } from '../../shared/layout.js';
import { can } from '../../shared/session.js';
import { createTable, updateTable, escaparHtml } from '../../shared/table.js';
import { formatDateTime } from '../../shared/formatters.js';
import {
    montarLinhas, opcoesDeStatus, filtrarLotes, ordenarMaisRecentes,
    formatarPeso, classeDoStatus, textoContagem
} from './batches-filter.js';

// Consultar vale para todos os perfis (não há ação em PERMISSOES).
const SESSAO = montarLayout();

const CADASTRO_LOTE_URL = '/src/features/batches/new-batch.html';

if (SESSAO) {
    iniciarTela();
}

function iniciarTela() {
    const blocoFiltros = document.getElementById('bloco-filtros');
    const form = document.getElementById('form-filtros');
    const inputBusca = document.getElementById('busca');
    const selectStatus = document.getElementById('filtro-status');
    const resumo = document.getElementById('resumo-resultado');
    const estado = document.querySelector('#bloco-lotes .estado');
    const conteudo = document.querySelector('#bloco-lotes .conteudo');

    // Só os campos do wireframe. A coluna Ações é só desenho: ver detalhes e editar ainda não existem.
    const colunas = [
        { id: 'id', label: 'ID do lote' },
        { id: 'fornecedor', label: 'Fornecedor' },
        { id: 'pesoentrada_kg', label: 'Peso (kg)', formatar: formatarPeso },
        { id: 'data_entrada', label: 'Data de entrada', formatar: formatDateTime },
        {
            id: 'status',
            label: 'Status',
            html: (status) => '<span class="badge ' + classeDoStatus(status) + '">' + escaparHtml(status) + '</span>'
        },
        {
            id: 'id',
            label: 'Ações',
            html: () => '<span class="text-body-tertiary text-nowrap" aria-hidden="true"><i class="bi bi-eye me-2"></i><i class="bi bi-pencil-square"></i></span>'
        }
    ];

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
        conteudo.classList.add('d-none');
        mostrarCarregando();
        try {
            const [lotes, fornecedores] = await Promise.all([API.GET('/lotes'), API.GET('/fornecedores')]);
            linhas = montarLinhas(
                Array.isArray(lotes) ? lotes : [],
                Array.isArray(fornecedores) ? fornecedores : []
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
        opcoesDeStatus(linhas).forEach((status) => selectStatus.add(new Option(status, status)));
    }

    function limparFiltros() {
        form.reset();
        aplicarFiltros();
    }

    function aplicarFiltros() {
        const filtradas = ordenarMaisRecentes(
            filtrarLotes(linhas, { busca: inputBusca.value, status: selectStatus.value })
        );
        resumo.textContent = textoContagem(filtradas.length, linhas.length);

        if (linhas.length === 0) {
            conteudo.classList.add('d-none');
            mostrarMensagem('Nenhum lote cadastrado ainda.', can('lote.registrar')
                ? { texto: 'Cadastrar lote', href: CADASTRO_LOTE_URL }
                : null);
        } else if (filtradas.length === 0) {
            conteudo.classList.add('d-none');
            mostrarMensagem('Nenhum lote encontrado para esta busca.', { texto: 'Limpar filtros', aoClicar: limparFiltros });
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
            // Busca e ordenação próprias da tela: as do Grid.js ficam desligadas.
            grid = createTable('#tabela-lotes', colunas, dados, { busca: false, ordenar: false });
        }
    }

    function mostrarCarregando() {
        estado.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando lotes...</span></div></div>';
    }

    // acao: { texto, aoClicar } (botão) ou { texto, href } (link).
    function mostrarMensagem(texto, acao = null) {
        const caixa = document.createElement('div');
        caixa.className = 'text-center py-4';

        const paragrafo = document.createElement('p');
        paragrafo.className = (acao && acao.erro ? 'text-danger' : 'text-body-secondary') + ' mb-3';
        paragrafo.textContent = texto;
        caixa.appendChild(paragrafo);

        if (acao) {
            const controle = document.createElement(acao.href ? 'a' : 'button');
            controle.className = 'btn btn-outline-primary';
            controle.textContent = acao.texto;
            if (acao.href) controle.href = acao.href;
            else {
                controle.type = 'button';
                controle.addEventListener('click', acao.aoClicar);
            }
            caixa.appendChild(controle);
        }
        estado.replaceChildren(caixa);
    }
}
