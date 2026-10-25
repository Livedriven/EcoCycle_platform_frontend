// Visão geral e monitoramento individual das esteiras (RF12).

import { montarLayout } from "../../shared/layout.js";
import API from "../../shared/api.js";
import { createTable, updateTable, escaparHtml } from "../../shared/table.js";
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

// ---------- Pedaços de HTML (todo texto da API passa por escaparHtml) ----------
function badge(texto, classeCor) {
    return '<span class="badge ' + (classeCor || "b-suave") + '">' + escaparHtml(texto) + "</span>";
}

function cartaoIndicador(icone, rotulo, valorHtml, extraHtml = "") {
    return (
        '<div class="col-6 col-lg-3"><div class="card h-100 shadow-sm"><div class="card-body">' +
        '<div class="small" style="color:var(--eco-texto-suave)"><i class="bi bi-' + icone + '" aria-hidden="true"></i> ' +
        escaparHtml(rotulo) + "</div>" +
        '<div class="fs-3 fw-bold" style="color:var(--eco-azul)">' + valorHtml + "</div>" +
        extraHtml +
        "</div></div></div>"
    );
}

function campoLeitura(rotulo, valorHtml) {
    return (
        '<div class="col-6"><div class="small" style="color:var(--eco-texto-suave)">' + escaparHtml(rotulo) +
        '</div><div class="fw-semibold">' + valorHtml + "</div></div>"
    );
}

// ---------- Estados dos blocos: carregando, erro, vazio e conteúdo ----------
function mostrarEstado(bloco, tipo, mensagem = "") {
    const estado = bloco.querySelector(".estado");
    bloco.querySelector(".conteudo").classList.add("d-none");
    estado.replaceChildren();

    if (tipo === "carregando") {
        estado.insertAdjacentHTML(
            "beforeend",
            '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando...</span></div>' +
            "<span>Carregando...</span>"
        );
    } else if (tipo === "erro") {
        estado.insertAdjacentHTML(
            "beforeend",
            '<i class="bi bi-exclamation-triangle fs-3 text-danger" aria-hidden="true"></i>' +
            '<span role="alert">' + escaparHtml(mensagem) + "</span>"
        );
    } else {
        estado.insertAdjacentHTML(
            "beforeend",
            '<i class="bi bi-inbox fs-3" aria-hidden="true"></i><span>' + escaparHtml(mensagem) + "</span>"
        );
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

    blocos.indicadores.querySelector(".conteudo").innerHTML =
        cartaoIndicador("activity", "Situação", badge(esteira.status_esteira, corStatus),
            '<div class="small text-truncate" style="color:var(--eco-texto-suave)">' + escaparHtml(esteira.nome_esteira) + "</div>") +
        cartaoIndicador("speedometer2", "Velocidade", formatarNumero(esteira.velocidade_esteira_kmh) + " km/h") +
        cartaoIndicador("thermometer-half", "Temperatura da esteira", formatarNumero(esteira.temperatura_esteira_c) + " °C") +
        cartaoIndicador("bell", "Alertas ativos",
            '<span class="' + (temAlerta ? "text-danger" : "text-success") + '">' + alertasAtivos.length + "</span>");

    mostrarConteudo(blocos.indicadores);
}

function desenharUltimaLeitura(leituras) {
    if (leituras.length === 0) {
        mostrarEstado(blocos.leitura, "vazio", "Nenhuma leitura registrada para esta esteira.");
        return;
    }

    const ultima = leituras[0]; // a lista já vem ordenada da mais nova para a mais antiga

    blocos.leitura.querySelector(".conteudo").innerHTML =
        '<div class="mb-3">' + badge(ultima.status_leitura, classeStatus(ultima.status_leitura)) +
        ' <span class="small" style="color:var(--eco-texto-suave)">' + escaparHtml(formatarDataHora(ultima.datahora_leitura)) + "</span></div>" +
        '<div class="row g-3">' +
        campoLeitura("Temperatura", formatarNumero(ultima.temperatura_leitura_c) + " °C") +
        campoLeitura("Peso", formatarNumero(ultima.peso_leitura_kg, 2) + " kg") +
        campoLeitura("Material", escaparHtml(ultima.material_leitura || "–")) +
        "</div>";

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

        return (
            '<li class="list-group-item d-flex justify-content-between align-items-start gap-2">' +
            "<div>" + badge(alerta.tipo_alerta, classeAlerta(alerta.tipo_alerta) + " badge-alerta") +
            '<div class="small mt-1" style="color:var(--eco-texto-suave)">' + escaparHtml(detalhe) + "</div></div>" +
            '<span class="small text-nowrap" style="color:var(--eco-texto-suave)">' +
            escaparHtml(formatarDataHora(alerta.datahora_alerta)) + "</span></li>"
        );
    });

    blocos.alertas.querySelector(".conteudo").innerHTML =
        '<ul class="list-group list-group-flush">' + itens.join("") + "</ul>";
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
                html: (valor) => badge(valor, classeStatus(valor))
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
        const esteiras = await API.GET("/esteiras", { erroLocal: true });

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
            API.GET("/leituras_sensor?id_esteira=" + encodeURIComponent(esteiraId), { erroLocal: true }),
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
