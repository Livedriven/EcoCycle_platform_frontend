import API from '../../shared/api.js';
import { criarElemento, criarSpinner } from '../../shared/dom.js';
import { montarLayout } from '../../shared/layout.js';
import { can } from '../../shared/session.js';
import { createTable, updateTable, h } from '../../shared/table.js';
import { formatCnpj, formatTelefone } from '../../shared/formatters.js';
import { filtrarFornecedores, opcoesDeCidade, ordenarMaisRecentes, textoContagem } from './suppliers-filter.js';

// Consultar vale para todos os perfis (não há ação em PERMISSOES).
const SESSAO = montarLayout();

const CADASTRO_URL = '/src/features/suppliers/new-supplier.html';

if (SESSAO) {
    iniciarTela();
}

function iniciarTela() {
    const blocoFiltros = document.getElementById('bloco-filtros');
    const form = document.getElementById('form-filtros');
    const inputBusca = document.getElementById('busca');
    const selectCidade = document.getElementById('filtro-cidade');
    const resumo = document.getElementById('resumo-resultado');
    const estado = document.querySelector('#bloco-fornecedores .estado');
    const conteudo = document.querySelector('#bloco-fornecedores .conteudo');

    // Só os campos do wireframe. A coluna Ações é só desenho: editar e excluir ainda não existem.
    const colunas = [
        { id: 'nome_fornecedor', label: 'Nome do fornecedor' },
        { id: 'cnpj_fornecedor', label: 'CNPJ', formatar: formatCnpj },
        { id: 'telefone_fornecedor', label: 'Telefone', formatar: formatTelefone },
        { id: 'email_fornecedor', label: 'E-mail' },
        { id: 'endereco_fornecedor', label: 'Endereço' },
        {
            id: 'id',
            label: 'Ações',
            formatar: () => h('span', { className: 'text-body-tertiary text-nowrap', 'aria-hidden': 'true' },
                h('i', { className: 'bi bi-pencil me-2' }), h('i', { className: 'bi bi-trash' }))
        }
    ];

    let fornecedores = [];
    let grid = null;

    form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        aplicarFiltros();
    });
    document.getElementById('limpar-filtros').addEventListener('click', () => {
        form.reset();
        aplicarFiltros();
    });

    let carregando = false;
    let assinaturaDados;
    setInterval(() => {
        if (!document.hidden) carregar();
    }, 5000);
    carregar();

    async function carregar() {
        if (carregando) return;
        carregando = true;
        if (assinaturaDados === undefined) {
            blocoFiltros.classList.add('d-none');
            conteudo.classList.add('d-none');
            mostrarCarregando();
        }
        try {
            const resposta = await API.GET('/fornecedores', { erroLocal: true });
            const novosDados = Array.isArray(resposta) ? resposta : [];
            const assinatura = JSON.stringify(novosDados);
            if (assinatura === assinaturaDados) return;
            fornecedores = novosDados;
            preencherCidades();
            blocoFiltros.classList.remove('d-none');
            aplicarFiltros();
            assinaturaDados = assinatura;
        } catch (erro) {
            if (assinaturaDados === undefined) {
                mostrarMensagem(erro.message, { texto: 'Tentar novamente', aoClicar: carregar, erro: true });
            }
        } finally {
            carregando = false;
        }
    }

    function preencherCidades() {
        const selecionado = selectCidade.value;
        selectCidade.length = 1;
        opcoesDeCidade(fornecedores).forEach((cidade) => selectCidade.add(new Option(cidade, cidade)));
        selectCidade.value = selecionado;
    }

    function aplicarFiltros() {
        const filtrados = ordenarMaisRecentes(
            filtrarFornecedores(fornecedores, { busca: inputBusca.value, cidade: selectCidade.value })
        );
        resumo.textContent = textoContagem(filtrados.length, fornecedores.length);

        if (fornecedores.length === 0) {
            conteudo.classList.add('d-none');
            mostrarMensagem('Nenhum fornecedor cadastrado ainda.', can('fornecedor.cadastrar')
                ? { texto: 'Cadastrar fornecedor', href: CADASTRO_URL }
                : null);
        } else if (filtrados.length === 0) {
            conteudo.classList.add('d-none');
            mostrarMensagem('Nenhum fornecedor encontrado para esta busca.', {
                texto: 'Limpar filtros',
                aoClicar: () => {
                    form.reset();
                    aplicarFiltros();
                }
            });
        } else {
            mostrarTabela(filtrados);
        }
    }

    function mostrarTabela(dados) {
        estado.replaceChildren();
        conteudo.classList.remove('d-none'); // visível antes de desenhar
        if (grid) {
            updateTable(grid, dados);
        } else {
            // Busca e ordenação próprias da tela: a do Grid.js fica desligada.
            grid = createTable('#tabela-fornecedores', colunas, dados, { busca: false, ordenar: false });
        }
    }

    function mostrarCarregando() {
        const caixa = criarElemento('div', 'text-center py-4');
        caixa.append(criarSpinner('Carregando fornecedores...'));
        estado.replaceChildren(caixa);
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
