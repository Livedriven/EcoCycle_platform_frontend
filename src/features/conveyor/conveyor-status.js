// Visão geral e monitoramento individual das esteiras (RF12).

import { montarLayout } from "../../shared/layout.js";
import API from "../../shared/api.js";
import { createTable, updateTable, h } from "../../shared/table.js";
import { criarElemento, criarIcone, criarSpinner } from '../../shared/dom.js';
import { classeStatus, classeAlerta, classeContadorAlertas } from "../../shared/ui.js";
import { formatNumber } from '../../shared/formatters.js';
import { dadosDaEsteira, dataHora } from './conveyor-data.js';
import { criarCartaoEsteira } from './conveyor-cards.js';
import './conveyor.css';

// Monta topo e menu e redireciona para o login se não houver sessão válida.
const SESSAO = montarLayout();

if (SESSAO) {

const INTERVALO_ATUALIZACAO_MS = 5000;

// ---------- Elementos da página ----------
const blocos = {
    indicadores: document.querySelector("#bloco-indicadores"),
    leitura: document.querySelector("#bloco-leitura"),
    alertas: document.querySelector("#bloco-alertas"),
    historico: document.querySelector("#bloco-historico")
};
const seletor = document.querySelector("#seletor-esteira");
const textoAtualizacao = document.querySelector("#ultima-atualizacao");
const contadorAlertas = document.querySelector("#contador-alertas");

// ---------- Estado da tela ----------
let esteiraId = new URLSearchParams(window.location.search).get('esteira');
let esteirasAtuais = [];
let assinaturaVisaoGeral;
let tabela = null;      // instância do Grid.js, criada na primeira vez
let carregando = false;
let assinaturaDados;
let numeroRequisicao = 0; // evita que uma resposta antiga sobrescreva a mais nova

// ---------- Formatação ----------
function formatarNumero(valor, casas = 1) {
    const numero = Number(valor);
    if (valor === null || valor === undefined || String(valor).trim() === '' || !Number.isFinite(numero)) return "–";
    return formatNumber(numero, casas);
}

function formatarDataHora(iso) {
    return dataHora(iso);
}

// ---------- Elementos visuais (os dados são inseridos como texto) ----------
function badge(texto, classeCor) {
    return criarElemento('span', 'badge ' + (classeCor || 'b-suave'), texto ?? '');
}

function textoSuave(tag, classe, texto) {
    const elemento = criarElemento(tag, classe, texto);
    elemento.style.color = 'var(--eco-texto-suave)';
    return elemento;
}

function cartaoIndicador(icone, rotulo, valor, extra) {
    const coluna = criarElemento('div', 'col-6 col-lg-3');
    const card = criarElemento('div', 'card h-100 shadow-sm');
    const corpo = criarElemento('div', 'card-body');
    const titulo = textoSuave('div', 'small');
    titulo.append(criarIcone('bi bi-' + icone), ' ' + rotulo);
    const conteudo = criarElemento('div', 'fs-3 fw-bold');
    conteudo.style.color = 'var(--eco-azul)';
    conteudo.append(valor);
    corpo.append(titulo, conteudo);
    if (extra) corpo.append(extra);
    card.append(corpo);
    coluna.append(card);
    return coluna;
}

function campoLeitura(rotulo, valor) {
    const campo = criarElemento('div', 'col-6');
    campo.append(textoSuave('div', 'small', rotulo), criarElemento('div', 'fw-semibold', valor));
    return campo;
}

// ---------- Estados dos blocos: carregando, erro, vazio e conteúdo ----------
function mostrarEstado(bloco, tipo, mensagem = "") {
    const estado = bloco.querySelector(".estado");
    bloco.querySelector(".conteudo").classList.add("d-none");
    estado.replaceChildren();

    if (tipo === "carregando") {
        estado.append(criarSpinner('Carregando...'), criarElemento('span', '', 'Carregando...'));
    } else {
        const erro = tipo === 'erro';
        const texto = criarElemento('span', '', mensagem);
        if (erro) texto.setAttribute('role', 'alert');
        estado.append(criarIcone(erro ? 'bi bi-exclamation-triangle fs-3 text-danger' : 'bi bi-inbox fs-3'), texto);
    }
}

function mostrarConteudo(bloco) {
    bloco.querySelector(".estado").replaceChildren();
    bloco.querySelector(".conteudo").classList.remove("d-none");
}

function mostrarEstadoEmTodos(tipo, mensagem) {
    Object.values(blocos).forEach((bloco) => mostrarEstado(bloco, tipo, mensagem));
}

// ---------- Desenho de cada bloco ----------
function montarSeletor(esteiras) {
    seletor.replaceChildren(
        ...esteiras.map((esteira) => {
            const opcao = document.createElement("option");
            opcao.value = String(esteira.id);
            opcao.textContent = esteira.nome_esteira || 'Esteira ' + esteira.id;
            return opcao;
        })
    );
    seletor.value = String(esteiraId);
    // Com uma única esteira, o seletor só atrapalha.
    seletor.classList.toggle("d-none", esteiras.length < 2);
}

function desenharVisaoGeral(esteiras) {
    const assinatura = JSON.stringify([esteiras, esteiraId]);
    const estado = document.getElementById('estado-visao-geral');
    estado.textContent = esteiras.length ? '' : 'Nenhuma esteira cadastrada.';
    if (assinatura === assinaturaVisaoGeral) return;
    const lista = document.getElementById('visao-geral-esteiras');
    const foco = lista.contains(document.activeElement) ? document.activeElement.dataset.esteiraId : null;
    lista.replaceChildren(...esteiras.map((esteira) => criarCartaoEsteira(esteira, () => selecionarEsteira(esteira.id), {
        status: true, selecionada: String(esteira.id) === esteiraId
    })));
    if (foco) [...lista.children].find((botao) => botao.dataset.esteiraId === foco)?.focus();
    assinaturaVisaoGeral = assinatura;
    montarSeletor(esteiras);
}

function selecionarEsteira(id) {
    esteiraId = String(id);
    const url = new URL(window.location.href);
    url.searchParams.set('esteira', esteiraId);
    window.history.replaceState(null, '', url);
    desenharVisaoGeral(esteirasAtuais);
    carregar();
}

function desenharIndicadores(esteira, alertasAtivos) {
    const corStatus = classeStatus(esteira.status_esteira);
    const temAlerta = alertasAtivos.length > 0;

    blocos.indicadores.querySelector(".conteudo").replaceChildren(
        cartaoIndicador("activity", "Situação", badge(esteira.status_esteira, corStatus),
            textoSuave('div', 'small text-truncate', esteira.nome_esteira ?? '')),
        cartaoIndicador("speedometer2", "Velocidade", formatarNumero(esteira.velocidade_esteira_kmh) + " km/h"),
        cartaoIndicador("thermometer-half", "Temperatura da esteira", formatarNumero(esteira.temperatura_esteira_c) + " °C"),
        cartaoIndicador("bell", "Alertas ativos",
            criarElemento('span', temAlerta ? 'text-danger' : 'text-success', alertasAtivos.length))
    );

    mostrarConteudo(blocos.indicadores);
}

function desenharUltimaLeitura(leituras) {
    if (leituras.length === 0) {
        mostrarEstado(blocos.leitura, "vazio", "Nenhuma leitura registrada para esta esteira.");
        return;
    }

    const ultima = leituras[0]; // a lista já vem ordenada da mais nova para a mais antiga

    const topo = criarElemento('div', 'mb-3');
    topo.append(badge(ultima.status_leitura, classeStatus(ultima.status_leitura)), ' ',
        textoSuave('span', 'small', formatarDataHora(ultima.datahora_leitura)));
    const campos = criarElemento('div', 'row g-3');
    campos.append(
        campoLeitura("Temperatura", formatarNumero(ultima.temperatura_leitura_c) + " °C"),
        campoLeitura("Peso", formatarNumero(ultima.peso_leitura_kg, 2) + " kg"),
        campoLeitura("Material", ultima.material_leitura || "–")
    );
    blocos.leitura.querySelector(".conteudo").replaceChildren(topo, campos);

    mostrarConteudo(blocos.leitura);
}

function desenharAlertas(alertasAtivos, leituras) {
    contadorAlertas.textContent = String(alertasAtivos.length);
    contadorAlertas.className = "badge " + classeContadorAlertas(alertasAtivos.length);

    if (alertasAtivos.length === 0) {
        mostrarEstado(blocos.alertas, "vazio", "Nenhum alerta ativo. A esteira está sem pendências.");
        return;
    }

    const leituraPorId = new Map(leituras.map((leitura) => [String(leitura.id), leitura]));

    const itens = alertasAtivos.map((alerta) => {
        const leitura = leituraPorId.get(String(alerta.id_leitura));
        const detalhe = leitura
            ? "Leitura " + leitura.id + " · " + formatarNumero(leitura.temperatura_leitura_c) + " °C · " +
              formatarNumero(leitura.peso_leitura_kg, 2) + " kg"
            : "Leitura " + alerta.id_leitura;

        const item = criarElemento('li', 'list-group-item d-flex justify-content-between align-items-start gap-2');
        const conteudo = criarElemento('div');
        conteudo.append(badge(alerta.tipo_alerta, classeAlerta(alerta.tipo_alerta) + ' badge-alerta'),
            textoSuave('div', 'small mt-1', detalhe));
        item.append(conteudo, textoSuave('span', 'small text-nowrap', formatarDataHora(alerta.datahora_alerta)));
        return item;
    });

    const lista = criarElemento('ul', 'list-group list-group-flush');
    lista.append(...itens);
    blocos.alertas.querySelector(".conteudo").replaceChildren(lista);
    mostrarConteudo(blocos.alertas);
}

function desenharHistorico(leituras) {
    if (leituras.length === 0) {
        tabela?.destroy();
        tabela = null;
        blocos.historico.querySelector('.conteudo').replaceChildren();
        mostrarEstado(blocos.historico, "vazio", "Nenhuma leitura registrada para esta esteira.");
        return;
    }

    // A área precisa estar visível antes de a tabela ser desenhada.
    mostrarConteudo(blocos.historico);

    if (tabela) {
        updateTable(tabela, leituras);
        return;
    }

    tabela = createTable(
        blocos.historico.querySelector(".conteudo"),
        [
            { id: "datahora_leitura", label: "Data e hora", formatar: formatarDataHora },
            {
                id: "status_leitura",
                label: "Status",
                formatar: (valor) => h('span', { className: 'badge ' + classeStatus(valor) }, String(valor ?? ''))
            },
            { id: "temperatura_leitura_c", label: "Temperatura (°C)", formatar: (valor) => formatarNumero(valor) },
            { id: "peso_leitura_kg", label: "Peso (kg)", formatar: (valor) => formatarNumero(valor, 2) },
            { id: "material_leitura", label: "Material" }
        ],
        leituras,
        { porPagina: 8 }
    );
}

// ---------- Carregamento dos dados ----------
async function carregar({ silencioso = false } = {}) {
    if (silencioso && carregando) return;
    carregando = true;
    const requisicao = ++numeroRequisicao;

    // Na atualização automática não piscamos "Carregando": só trocamos os dados.
    if (!silencioso) {
        assinaturaDados = undefined;
        mostrarEstadoEmTodos("carregando");
    }
    if (!esteirasAtuais.length) document.getElementById('estado-visao-geral').textContent = 'Carregando esteiras...';

    try {
        const esteiras = await API.GET("/equipamentos", { erroLocal: true });

        if (requisicao !== numeroRequisicao) return;

        if (!Array.isArray(esteiras)) throw new Error('Resposta inválida ao consultar esteiras.');
        esteirasAtuais = esteiras;
        if (esteiras.length === 0) {
            if (requisicao !== numeroRequisicao) return;
            contadorAlertas.textContent = "–";
            contadorAlertas.className = "badge b-suave";
            assinaturaDados = undefined;
            esteiraId = null;
            desenharVisaoGeral([]);
            textoAtualizacao.textContent = '';
            document.getElementById('nome-esteira').textContent = 'Detalhes da esteira';
            tabela?.destroy();
            tabela = null;
            blocos.historico.querySelector('.conteudo').replaceChildren();
            mostrarEstadoEmTodos("vazio", "Nenhuma esteira cadastrada.");
            return;
        }

        if (!esteiras.some((esteira) => String(esteira.id) === esteiraId)) {
            esteiraId = String(esteiras[0].id);
            // Se a selecionada foi removida, nunca exibir as leituras antigas sob o novo nome.
            silencioso = false;
            assinaturaDados = undefined;
            mostrarEstadoEmTodos('carregando');
        }
        const esteira = esteiras.find((item) => String(item.id) === esteiraId);
        desenharVisaoGeral(esteiras);
        document.getElementById('nome-esteira').textContent = esteira.nome_esteira || 'Esteira ' + esteira.id;

        // O alerta não guarda o id da esteira: ele aponta para uma leitura, que aponta para a esteira.
        const [leiturasDaApi, todosAlertas] = await Promise.all([
            API.GET("/telemetria/historico", { erroLocal: true }),
            API.GET("/alertas", { erroLocal: true })
        ]);

        // Se o usuário trocou de esteira, esta resposta já é velha.
        if (requisicao !== numeroRequisicao) return;

        if (!Array.isArray(leiturasDaApi) || !Array.isArray(todosAlertas)) throw new Error('Resposta inválida ao consultar leituras e alertas.');
        const { leituras, alertas: alertasAtivos } = dadosDaEsteira(esteiraId, leiturasDaApi, todosAlertas);

        textoAtualizacao.textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR");
        const assinatura = JSON.stringify([esteiras, esteiraId, leituras, alertasAtivos]);
        if (assinatura === assinaturaDados) return;
        desenharIndicadores(esteira, alertasAtivos);
        desenharUltimaLeitura(leituras);
        desenharAlertas(alertasAtivos, leituras);
        desenharHistorico(leituras);
        assinaturaDados = assinatura;
    } catch (erro) {
        if (requisicao !== numeroRequisicao) return;
        assinaturaDados = undefined;
        if (!esteirasAtuais.length) document.getElementById('estado-visao-geral').textContent = erro.message;

        if (silencioso) {
            // Mantém os dados que já estão na tela e só avisa que a atualização falhou.
            textoAtualizacao.textContent = "Falha ao atualizar: " + erro.message;
        } else {
            contadorAlertas.textContent = '–';
            contadorAlertas.className = 'badge b-suave';
            mostrarEstadoEmTodos("erro", erro.message);
            const tentar = document.createElement('button');
            tentar.type = 'button';
            tentar.className = 'btn btn-outline-secondary btn-sm';
            tentar.textContent = 'Tentar novamente';
            tentar.addEventListener('click', () => carregar());
            blocos.indicadores.querySelector('.estado').append(tentar);
        }
    } finally {
        if (requisicao === numeroRequisicao) carregando = false;
    }
}

// ---------- Eventos ----------
seletor.addEventListener("change", () => {
    selecionarEsteira(seletor.value);
});

// Atualização automática (pausa quando a aba está escondida).
setInterval(() => {
    if (!document.hidden) carregar({ silencioso: true });
}, INTERVALO_ATUALIZACAO_MS);

carregar();
}
