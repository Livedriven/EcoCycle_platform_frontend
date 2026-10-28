// features/alerts/alerts.js
// Tela "Alertas" (RF09): alertas ativos e histórico, com filtros por situação, tipo, período e busca.
// Os alertas apontam para uma leitura, que aponta para a esteira; por isso a tela busca as três listas.
// Segue as regras da arquitetura: só importa de shared/ e usa API, createTable e formatters.

import { montarLayout } from '../../shared/layout.js';
import API from '../../shared/api.js';
import { createTable, updateTable, h } from '../../shared/table.js';
import { alertasAtivos } from '../../shared/calculations.js';
import { formatDateTime, formatNumber } from '../../shared/formatters.js';
import { classeAlerta } from '../../shared/ui.js';
import {
    ESTADO,
    enriquecerAlertas,
    ordenarMaisRecentes,
    tiposDeAlerta,
    filtrarAlertas
} from './alerts-filters.js';

// Página protegida: sem sessão válida, montarLayout() já redireciona ao login.
const SESSAO = montarLayout();

if (SESSAO) {
    const INTERVALO_ATUALIZACAO_MS = 5000;

    const bloco = document.getElementById('bloco-alertas');
    const estado = bloco.querySelector('.estado');
    const conteudo = bloco.querySelector('.conteudo');
    const busca = document.getElementById('busca-alertas');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroDe = document.getElementById('filtro-de');
    const filtroAte = document.getElementById('filtro-ate');
    const limparFiltro = document.getElementById('limpar-filtro');
    const opcoesEstado = document.querySelectorAll('input[name="filtro-estado"]');
    const resultadoFiltros = document.getElementById('resultado-filtros');
    const textoAtualizacao = document.getElementById('ultima-atualizacao');
    const totalAtivos = document.getElementById('total-ativos');
    const totalHistorico = document.getElementById('total-historico');
    const totalGeral = document.getElementById('total-geral');
    const controles = [busca, filtroTipo, filtroDe, filtroAte, limparFiltro, ...opcoesEstado];

    let tabela = null;      // instância do Grid.js, criada na primeira vez
    let alertas = [];       // todos os alertas já enriquecidos e ordenados
    let carregando = false;
    let dadosCarregados = false;
    let assinaturaDados;
    let numeroRequisicao = 0; // evita que uma resposta antiga sobrescreva a mais nova

    /* ---------- Estados do bloco: carregando, erro, vazio e conteúdo ---------- */

    function mostrarCarregando() {
        conteudo.classList.add('d-none');
        estado.replaceChildren();

        const spinner = document.createElement('div');
        spinner.className = 'spinner-border spinner-border-sm';
        spinner.setAttribute('role', 'status');
        const texto = document.createElement('span');
        texto.textContent = 'Carregando alertas...';
        estado.append(spinner, texto);
    }

    function mostrarMensagem(texto, icone) {
        conteudo.classList.add('d-none');
        estado.replaceChildren();

        const simbolo = document.createElement('i');
        simbolo.className = 'bi bi-' + icone + ' fs-3' + (icone === 'exclamation-triangle' ? ' text-danger' : '');
        simbolo.setAttribute('aria-hidden', 'true');
        const mensagem = document.createElement('span');
        mensagem.textContent = texto;
        estado.append(simbolo, mensagem);
    }

    function mostrarConteudo() {
        estado.replaceChildren();
        conteudo.classList.remove('d-none');
    }

    /* ---------- Filtros ---------- */

    function estadoSelecionado() {
        return document.querySelector('input[name="filtro-estado"]:checked')?.value ?? ESTADO.TODOS;
    }

    function filtrosAtuais() {
        return {
            estado: estadoSelecionado(),
            tipo: filtroTipo.value,
            de: filtroDe.value,
            ate: filtroAte.value,
            busca: busca.value
        };
    }

    function preencherTipos() {
        const selecionado = filtroTipo.value;
        const tipos = tiposDeAlerta(alertas);

        filtroTipo.replaceChildren(new Option('Todos os tipos', ''));
        tipos.forEach((tipo) => filtroTipo.add(new Option(tipo, tipo)));
        filtroTipo.value = tipos.includes(selecionado) ? selecionado : '';
    }

    function mostrarResultado(quantidade) {
        const f = filtrosAtuais();
        const temFiltroAlemDoEstado = f.tipo || f.de || f.ate || f.busca.trim();
        const filtrando = temFiltroAlemDoEstado || f.estado !== ESTADO.TODOS;

        resultadoFiltros.classList.toggle('d-none', !filtrando);
        resultadoFiltros.textContent = filtrando
            ? quantidade + ' de ' + alertas.length + (quantidade === 1 ? ' alerta encontrado.' : ' alertas encontrados.')
            : '';
    }

    function aplicarFiltros() {
        if (!tabela) {
            return;
        }

        const resultado = filtrarAlertas(alertas, filtrosAtuais());
        updateTable(tabela, resultado);
        mostrarResultado(resultado.length);
    }

    /* ---------- Desenho ---------- */

    function desenharTotais() {
        const ativos = alertasAtivos(alertas).length;

        totalAtivos.textContent = String(ativos);
        totalAtivos.className = 'fs-3 fw-bold ' + (ativos > 0 ? 'text-danger' : 'text-success');
        totalHistorico.textContent = String(alertas.length - ativos);
        totalGeral.textContent = String(alertas.length);
    }

    function badge(texto, classe) {
        return h('span', { className: 'badge ' + classe }, String(texto ?? ''));
    }

    function colunas() {
        return [
            { id: 'id', label: 'ID' },
            {
                id: 'tipo_alerta',
                label: 'Tipo',
                formatar: (tipo) => badge(tipo, classeAlerta(tipo))
            },
            { id: 'datahora_alerta', label: 'Data e hora', formatar: formatDateTime },
            { id: 'nome_esteira', label: 'Esteira', formatar: (nome) => nome || '–' },
            {
                id: 'temperatura_leitura_c',
                label: 'Temperatura (°C)',
                formatar: (valor) => (valor === null ? '–' : formatNumber(valor, 1))
            },
            {
                id: 'peso_leitura_kg',
                label: 'Peso (kg)',
                formatar: (valor) => (valor === null ? '–' : formatNumber(valor, 2))
            },
            {
                id: 'situacao',
                label: 'Situação',
                formatar: (situacao) => badge(situacao, situacao === 'Ativo' ? 'b-perigo' : 'b-sucesso')
            }
        ];
    }

    function desenharTabela() {
        const resultado = filtrarAlertas(alertas, filtrosAtuais());

        // A área precisa estar visível antes de a tabela ser desenhada.
        mostrarConteudo();

        if (tabela) {
            updateTable(tabela, resultado);
        } else {
            tabela = createTable(conteudo, colunas(), resultado, { busca: false, porPagina: 10 });
        }
        mostrarResultado(resultado.length);
    }

    /* ---------- Carregamento ---------- */

    async function carregar({ silencioso = false } = {}) {
        if (carregando) return;
        carregando = true;
        const requisicao = ++numeroRequisicao;

        // Na atualização automática não piscamos "Carregando": só trocamos os dados.
        // Também não desligamos os filtros, para não tirar o foco de quem está digitando na busca.
        if (!silencioso) {
            mostrarCarregando();
            controles.forEach((controle) => { controle.disabled = true; });
        }

        try {
            const [listaAlertas, leituras, esteiras] = await Promise.all([
                API.GET('/alertas', { erroLocal: true }),
                API.GET('/telemetria/historico', { erroLocal: true }),
                API.GET('/esteiras', { erroLocal: true })
            ]);

            // Ignora respostas de uma consulta que já foi substituída.
            if (requisicao !== numeroRequisicao) {
                return;
            }

            const novosAlertas = ordenarMaisRecentes(enriquecerAlertas(listaAlertas, leituras, esteiras));
            const assinatura = JSON.stringify(novosAlertas);
            textoAtualizacao.textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR');

            if (assinatura === assinaturaDados) return;
            alertas = novosAlertas;
            desenharTotais();
            dadosCarregados = true;
            assinaturaDados = assinatura;

            if (alertas.length === 0) {
                tabela = null;
                mostrarMensagem('Nenhum alerta registrado.', 'inbox');
                return;
            }

            preencherTipos();
            desenharTabela();
        } catch (erro) {
            if (requisicao !== numeroRequisicao) {
                return;
            }

            if (silencioso && dadosCarregados) {
                // Mantém os dados que já estão na tela e só avisa que a atualização falhou.
                textoAtualizacao.textContent = 'Falha ao atualizar: ' + erro.message;
            } else {
                tabela = null;
                mostrarMensagem(erro.message, 'exclamation-triangle');
            }
        } finally {
            if (requisicao === numeroRequisicao) {
                carregando = false;
                controles.forEach((controle) => { controle.disabled = !tabela; });
            }
        }
    }

    /* ---------- Eventos ---------- */

    busca.addEventListener('input', aplicarFiltros);
    [filtroTipo, filtroDe, filtroAte, ...opcoesEstado].forEach((controle) => {
        controle.addEventListener('change', aplicarFiltros);
    });

    limparFiltro.addEventListener('click', () => {
        busca.value = '';
        filtroTipo.value = '';
        filtroDe.value = '';
        filtroAte.value = '';
        document.getElementById('estado-ativos').checked = true;
        aplicarFiltros();
        busca.focus();
    });

    // Atualização automática (pausa quando a aba está escondida).
    setInterval(() => {
        if (!document.hidden) {
            carregar({ silencioso: true });
        }
    }, INTERVALO_ATUALIZACAO_MS);

    carregar();
}
