import { montarLayout } from '../../shared/layout.js';
import API from '../../shared/api.js';
import { requireLogin } from '../../shared/session.js';
import { CAMPOS, MATERIAIS_RELATORIO, totalPorMaterial, materiaisPorLoteDia } from '../../shared/calculations.js';
import { formatDate, formatKg, formatNumber, formatToneladas } from '../../shared/formatters.js';
import { createTable, updateTable } from '../../shared/table.js';
import { createDoughnutChart, CORES } from '../../shared/charts.js';
import { prepararMateriais, filtrarMateriais, validarPeriodo } from './materials-report.js';
import './materials.css';

// Página protegida: sem sessão válida, montarLayout() já redireciona ao login.
const SESSAO = montarLayout();

if (SESSAO) {
    const bloco = document.getElementById('bloco-materiais');
    const estado = bloco.querySelector('.estado');
    const conteudo = bloco.querySelector('.conteudo');
    const formulario = document.getElementById('filtros-materiais');
    const inicio = document.getElementById('data-inicial');
    const fim = document.getElementById('data-final');
    const lote = document.getElementById('filtro-lote');
    const erroPeriodo = document.getElementById('erro-periodo');
    const textoAtualizacao = document.getElementById('ultima-atualizacao');
    const canvas = document.getElementById('grafico-materiais');
    let registros = [];
    let tabela;
    let grafico;
    let carregando = false;
    let dadosCarregados = false;
    let assinaturaDados;

    function mostrarEstado(texto, tipo = 'mensagem') {
        conteudo.classList.add('d-none');
        estado.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
        const simbolo = document.createElement('span');
        simbolo.className = tipo === 'carregando' ? 'spinner-border spinner-border-sm'
            : tipo === 'erro' ? 'bi bi-exclamation-triangle fs-3 text-danger' : 'bi bi-info-circle fs-3';
        simbolo.setAttribute('aria-hidden', 'true');
        const mensagem = document.createElement('span');
        mensagem.textContent = texto;
        estado.replaceChildren(simbolo, mensagem);
    }

    function aplicarFiltros() {
        if (!dadosCarregados) return;
        if (!requireLogin()) return;
        const filtros = { inicio: inicio.value, fim: fim.value, lote: lote.value };
        const mensagem = validarPeriodo(filtros);
        erroPeriodo.textContent = mensagem ? mensagem + ' Os filtros não foram aplicados.' : '';
        inicio.setAttribute('aria-invalid', String(Boolean(mensagem)));
        fim.setAttribute('aria-invalid', String(Boolean(mensagem)));
        if (mensagem) {
            mostrarEstado('Corrija o período ou limpe os filtros para exibir o relatório.');
            return;
        }

        const filtrados = filtrarMateriais(registros, filtros);
        const totais = totalPorMaterial(filtrados, MATERIAIS_RELATORIO);
        const linhas = materiaisPorLoteDia(filtrados);
        document.getElementById('total-plastico').textContent = formatKg(totais['Plástico']);
        document.getElementById('total-metal').textContent = formatKg(totais.Metal);
        document.getElementById('toneladas-plastico').textContent = formatToneladas(totais['Plástico']);
        document.getElementById('toneladas-metal').textContent = formatToneladas(totais.Metal);
        document.getElementById('total-aluminio').textContent = formatKg(totais['Alumínio']);
        document.getElementById('toneladas-aluminio').textContent = formatToneladas(totais['Alumínio']);
        document.getElementById('total-rejeito').textContent = formatKg(totais.Rejeito);
        document.getElementById('toneladas-rejeito').textContent = formatToneladas(totais.Rejeito);
        const periodo = filtros.inicio || filtros.fim
            ? `Período: ${filtros.inicio ? formatDate(filtros.inicio) : 'início do histórico'} a ${filtros.fim ? formatDate(filtros.fim) : 'fim do histórico'}.`
            : 'Todo o histórico.';
        document.getElementById('resumo-materiais').textContent = filtrados.length
            ? `${periodo} Registros: ${formatNumber(filtrados.length, 0)}. Grupos de lote e dia: ${formatNumber(linhas.length, 0)}.`
            : (registros.length ? 'Nenhum material encontrado para os filtros selecionados.' : 'Nenhum material separado foi registrado.');

        // O canvas precisa estar visível para o Chart.js medir seu tamanho.
        estado.replaceChildren();
        conteudo.classList.remove('d-none');
        const temPeso = MATERIAIS_RELATORIO.some((material) => totais[material] > 0);
        document.getElementById('area-grafico-materiais').classList.toggle('d-none', !temPeso);
        document.getElementById('grafico-vazio').classList.toggle('d-none', temPeso);
        const descricao = MATERIAIS_RELATORIO.map((material) => `${material}: ${formatKg(totais[material])}.`).join(' ');
        canvas.setAttribute('aria-label', descricao);
        document.getElementById('descricao-grafico').textContent = descricao;
        if (temPeso) {
            grafico = createDoughnutChart(canvas, MATERIAIS_RELATORIO.map((material) => ({
                rotulo: material, valor: totais[material], cor: CORES[material],
            })));
        } else {
            grafico?.destroy();
            grafico = null;
        }

        const temLinhas = linhas.length > 0;
        document.getElementById('tabela-materiais').classList.toggle('d-none', !temLinhas);
        document.getElementById('tabela-vazia').classList.toggle('d-none', temLinhas);
        document.getElementById('mensagem-tabela-vazia').textContent = registros.length
            ? 'Nenhum material encontrado para os filtros selecionados.'
            : 'Nenhum material separado foi registrado. Os dados são consultados automaticamente a cada 5 segundos.';
        document.getElementById('limpar-filtros-vazio').classList.toggle('d-none', temLinhas || !(filtros.inicio || filtros.fim || filtros.lote));

        if (tabela) updateTable(tabela, linhas);
        else if (temLinhas) tabela = createTable('#tabela-materiais', [
            { id: 'id_lote', label: 'Lote', formatar: (valor) => 'Lote ' + valor },
            { id: 'data', label: 'Dia', formatar: formatDate },
            { id: 'plastico', label: 'Plástico (kg)', formatar: formatKg },
            { id: 'metal', label: 'Metal (kg)', formatar: formatKg },
            { id: 'aluminio', label: 'Alumínio (kg)', formatar: formatKg },
            { id: 'rejeito', label: 'Rejeito (kg)', formatar: formatKg },
        ], linhas, { busca: false, porPagina: 10 });
    }

    async function carregarMateriais() {
        if (carregando || !requireLogin()) return;
        carregando = true;
        if (!dadosCarregados) {
            for (const controle of formulario.elements) controle.disabled = true;
            mostrarEstado('Carregando materiais separados...', 'carregando');
        }
        bloco.setAttribute('aria-busy', 'true');
        try {
            const resposta = await API.GET('/producao', { erroLocal: true });
            if (!requireLogin()) return;
            if (resposta.length && resposta.every((r) => !r.tipo_material)) {
                registros = [];
                dadosCarregados = false;
                assinaturaDados = undefined;
                grafico?.destroy();
                grafico = null;
                mostrarEstado('A API de produção ainda não disponibiliza os pesos separados por material. O catálogo /materiais não contém esses pesos.');
                textoAtualizacao.textContent = '';
                return;
            }
            const dados = prepararMateriais(resposta);
            textoAtualizacao.textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR');
            const assinatura = JSON.stringify(dados.registros);
            if (assinatura === assinaturaDados) return;
            registros = dados.registros;
            const selecionado = lote.value;
            lote.replaceChildren(new Option('Todos os lotes', ''));
            const lotes = [...new Set(registros.map((registro) => registro[CAMPOS.idLoteProducao]))]
                .sort((a, b) => Number(a) - Number(b));
            for (const id of lotes) lote.add(new Option('Lote ' + id, id));
            lote.value = lotes.includes(selecionado) ? selecionado : '';
            dadosCarregados = true;
            aplicarFiltros();
            assinaturaDados = assinatura;
        } catch (erro) {
            textoAtualizacao.textContent = 'Falha ao atualizar. Nova tentativa automática em 5 segundos.';
            if (!dadosCarregados) mostrarEstado(erro.message + ' Uma nova tentativa será feita automaticamente.', 'erro');
        } finally {
            carregando = false;
            for (const controle of formulario.elements) controle.disabled = !dadosCarregados;
            bloco.setAttribute('aria-busy', 'false');
        }
    }

    formulario.addEventListener('submit', (evento) => { evento.preventDefault(); aplicarFiltros(); });
    [inicio, fim, lote].forEach((controle) => controle.addEventListener('change', aplicarFiltros));
    formulario.addEventListener('reset', () => {
        // Aguarda o reset nativo antes de reler os valores dos filtros.
        queueMicrotask(aplicarFiltros);
    });
    carregarMateriais();
    setInterval(() => {
        if (!document.hidden) carregarMateriais();
    }, 5000);
}
