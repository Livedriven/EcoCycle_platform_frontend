// features/conveyor/conveyor.js
// Tela "Status da esteira" (RF12).
// Busca a esteira, as leituras do sensor e os alertas na API, e mostra a situação
// atual, a última leitura, os alertas ativos e o histórico de leituras.
// Segue as regras da arquitetura: só importa de shared/ e usa API, createTable e escaparHtml.

import { montarLayout } from "../../shared/layout.js";
import API from "../../shared/api.js";
import { createTable, updateTable, escaparHtml } from "../../shared/table.js";
import { classeStatus, classeAlerta, classeContadorAlertas } from "../../shared/ui.js";

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
let esteiraId = null;
let tabela = null;      // instância do Grid.js, criada na primeira vez
let carregando = false;
let assinaturaDados;
let numeroRequisicao = 0; // evita que uma resposta antiga sobrescreva a mais nova

// ---------- Formatação ----------
// Enquanto o shared/formatters.js não exporta funções, a formatação fica aqui (Intl nativo).
// Quando ele tiver formatDate e formatNumber, trocar estas duas funções por elas.
function formatarNumero(valor, casas = 1) {
    const numero = Number(valor);
    if (valor === null || valor === undefined || !Number.isFinite(numero)) return "–";
    return numero.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarDataHora(iso) {
    const data = new Date(iso);
    if (!iso || Number.isNaN(data.getTime())) return "–";
    return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// O mock devolve "true"/"false" como texto; a API real pode devolver boolean.
function estaResolvido(valor) {
    return valor === true || valor === "true";
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
            opcao.textContent = esteira.nome_esteira;
            return opcao;
        })
    );
    seletor.value = String(esteiraId);
    // Com uma única esteira, o seletor só atrapalha.
    seletor.classList.toggle("d-none", esteiras.length < 2);
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

    const leituraPorId = new Map(leituras.map((leitura) => [leitura.id, leitura]));

    const itens = alertasAtivos.map((alerta) => {
        const leitura = leituraPorId.get(alerta.id_leitura);
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
        tabela = null;
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
    if (!silencioso) mostrarEstadoEmTodos("carregando");

    try {
        const esteiras = await API.GET("/esteiras", { erroLocal: true });

        if (requisicao !== numeroRequisicao) return;

        if (!Array.isArray(esteiras) || esteiras.length === 0) {
            if (requisicao !== numeroRequisicao) return;
            contadorAlertas.textContent = "–";
            contadorAlertas.className = "badge b-suave";
            assinaturaDados = undefined;
            mostrarEstadoEmTodos("vazio", "Nenhuma esteira cadastrada.");
            return;
        }

        if (!esteiras.some((esteira) => esteira.id === esteiraId)) esteiraId = esteiras[0].id;
        const esteira = esteiras.find((item) => item.id === esteiraId);

        // O alerta não guarda o id da esteira: ele aponta para uma leitura, que aponta para a esteira.
        const [leiturasDaApi, todosAlertas] = await Promise.all([
            API.GET("/leituras_sensor?id_esteira=" + encodeURIComponent(esteiraId), { erroLocal: true }),
            API.GET("/alertas", { erroLocal: true })
        ]);

        // Se o usuário trocou de esteira, esta resposta já é velha.
        if (requisicao !== numeroRequisicao) return;

        const leituras = [...leiturasDaApi].sort((a, b) => b.datahora_leitura.localeCompare(a.datahora_leitura));
        const idsDasLeituras = new Set(leituras.map((leitura) => leitura.id));
        const alertasAtivos = todosAlertas
            .filter((alerta) => idsDasLeituras.has(alerta.id_leitura) && !estaResolvido(alerta.resolvido))
            .sort((a, b) => b.datahora_alerta.localeCompare(a.datahora_alerta));

        textoAtualizacao.textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR");
        const assinatura = JSON.stringify([esteiras, esteiraId, leituras, alertasAtivos]);
        if (assinatura === assinaturaDados) return;
        montarSeletor(esteiras);
        desenharIndicadores(esteira, alertasAtivos);
        desenharUltimaLeitura(leituras);
        desenharAlertas(alertasAtivos, leituras);
        desenharHistorico(leituras);
        assinaturaDados = assinatura;
    } catch (erro) {
        if (requisicao !== numeroRequisicao) return;

        if (silencioso) {
            // Mantém os dados que já estão na tela e só avisa que a atualização falhou.
            textoAtualizacao.textContent = "Falha ao atualizar: " + erro.message;
        } else {
            mostrarEstadoEmTodos("erro", erro.message);
        }
    } finally {
        if (requisicao === numeroRequisicao) carregando = false;
    }
}

// ---------- Eventos ----------
seletor.addEventListener("change", () => {
    esteiraId = Number(seletor.value);
    assinaturaDados = undefined;
    carregar();
});

// Atualização automática (pausa quando a aba está escondida).
setInterval(() => {
    if (!document.hidden) carregar({ silencioso: true });
}, INTERVALO_ATUALIZACAO_MS);

carregar();
}
