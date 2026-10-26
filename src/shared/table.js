// shared/table.js
// Único lugar do projeto que configura o Grid.js. As telas só chamam createTable().
// Aqui não entra busca de dados (api.js), soma (calculations.js) nem estado de
// carregando/erro/vazio (cada tela cuida disso no bloco .estado).
// O CSS do tema do Grid.js já é carregado pelo setup.js.

import { Grid, h } from "gridjs";
import { ptBR } from "gridjs/l10n";

const POR_PAGINA_PADRAO = 10;

// Nas células compostas, h() cria elementos e trata strings filhas como texto.
export { h };

/**
 * BOTÕES DA COLUNA DE AÇÕES
 * Monta os botões com h() (sem string de HTML), então nada vindo da API é interpretado como HTML.
 * Cada ação: { texto, icone?, classe?, aoClicar(linha), visivel?(linha) }
 */
function criarBotoes(acoes, linha) {
    const visiveis = acoes.filter((acao) => !acao.visivel || acao.visivel(linha));

    return h(
        "div",
        { className: "d-flex flex-wrap gap-1" },
        visiveis.map((acao) =>
            h(
                "button",
                {
                    type: "button",
                    className: "btn btn-sm " + (acao.classe || "btn-outline-secondary"),
                    "aria-label": acao.texto,
                    onClick: () => acao.aoClicar(linha)
                },
                acao.icone
                    ? [h("i", { className: "bi bi-" + acao.icone, "aria-hidden": "true" }), " ", acao.texto]
                    : acao.texto
            )
        )
    );
}

/**
 * CONVERSORA DE COLUNAS
 * Transforma a coluna simples usada pelas telas no formato do Grid.js.
 *
 * Coluna comum:   { id: "origem", label: "Origem" }
 * Com formatação: { id: "data", label: "Data", formatar: (valor) => formatDate(valor) }
 *                 (a ordenação usa o valor original, não o texto formatado)
 * Com elementos:  { id: "status", label: "Status", formatar: (valor) => h("span", { className: "badge b-info" }, String(valor ?? "")) }
 * De ações:       { label: "Ações", acoes: [{ texto: "Detalhes", icone: "eye", aoClicar: (linha) => {} }] }
 * Sem ordenação:  { id: "obs", label: "Obs.", ordenavel: false }
 */
function converterColuna(coluna) {
    if (!coluna || !coluna.label) {
        throw new Error("createTable: toda coluna precisa de um label.");
    }

    // Coluna de ações: a célula recebe a linha inteira para o botão saber qual registro é.
    if (coluna.acoes) {
        return {
            id: coluna.id || "acoes",
            name: coluna.label,
            sort: false,
            data: (linha) => linha,
            formatter: (linha) => criarBotoes(coluna.acoes, linha)
        };
    }

    if (!coluna.id) {
        throw new Error('createTable: a coluna "' + coluna.label + '" precisa de um id.');
    }

    const convertida = { id: coluna.id, name: coluna.label };

    if (coluna.formatar) {
        convertida.formatter = (valor) => {
            const conteudo = coluna.formatar(valor);
            // Preserva o span externo que o Grid.js usava nas células com HTML.
            return conteudo !== null && typeof conteudo === 'object'
                ? h('span', {}, conteudo)
                : conteudo;
        };
    }

    if (coluna.ordenavel === false) {
        convertida.sort = false;
    }

    return convertida;
}

/**
 * CRIAR TABELA
 * Desenha a tabela dentro de "elemento" e devolve a instância do Grid.js.
 *
 * @param {Element|string} elemento  Onde a tabela entra (elemento ou seletor CSS).
 * @param {Array}          colunas   Veja converterColuna.
 * @param {Array}          dados     Lista de objetos já carregada pela tela.
 * @param {Object}         opcoes    { busca = true, ordenar = true, porPagina = 10 (0 desliga a paginação) }
 */
export function createTable(elemento, colunas, dados, opcoes = {}) {
    const alvo = typeof elemento === "string" ? document.querySelector(elemento) : elemento;

    if (!alvo) {
        throw new Error("createTable: elemento não encontrado na página.");
    }
    if (!Array.isArray(colunas) || colunas.length === 0) {
        throw new Error("createTable: informe ao menos uma coluna.");
    }
    if (!Array.isArray(dados)) {
        throw new Error("createTable: os dados precisam ser uma lista.");
    }

    const { busca = true, ordenar = true, porPagina = POR_PAGINA_PADRAO } = opcoes;

    // Limpa o que já estava ali, para não empilhar duas tabelas ao renderizar de novo.
    alvo.replaceChildren();

    const grid = new Grid({
        columns: colunas.map(converterColuna),
        data: dados,
        // A busca ignora a coluna de ações (a célula dela é um objeto, não um texto).
        search: busca
            ? { selector: (celula) => (celula !== null && typeof celula === "object" ? "" : celula) }
            : false,
        sort: ordenar,
        pagination: porPagina > 0 ? { limit: porPagina } : false,
        language: ptBR,
        autoWidth: true
    });

    grid.render(alvo);
    return grid;
}

/**
 * ATUALIZAR TABELA
 * Troca os dados de uma tabela que já está na tela (ex.: filtro por data, lote novo salvo).
 */
export function updateTable(grid, dados) {
    if (!Array.isArray(dados)) {
        throw new Error("updateTable: os dados precisam ser uma lista.");
    }
    grid.updateConfig({ data: dados }).forceRender();
}
