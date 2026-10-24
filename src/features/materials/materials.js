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
    const atualizar = document.getElementById('atualizar-materiais');
    const canvas = document.getElementById('grafico-materiais');
    let registros = [];
    let tabela;
    let grafico;
    let carregando = false;
    let dadosCarregados = false;

    function mostrarEstado(texto, erro = false) {
        conteudo.classList.add('d-none');
        estado.setAttribute('role', erro ? 'alert' : 'status');
        estado.textContent = texto;
    }

    function aplicarFiltros() {
        if (!dadosCarregados || carregando) return;
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

        if (tabela) updateTable(tabela, linhas);
        else tabela = createTable('#tabela-materiais', [
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
        dadosCarregados = false;
        atualizar.disabled = true;
        for (const controle of formulario.elements) controle.disabled = true;
        bloco.setAttribute('aria-busy', 'true');
        mostrarEstado('Carregando materiais separados...');
        try {
            const resposta = await API.GET('/producao');
            if (!requireLogin()) return;
            const dados = prepararMateriais(resposta);
            registros = dados.registros;
            const selecionado = lote.value;
            lote.replaceChildren(new Option('Todos os lotes', ''));
            const lotes = [...new Set(registros.map((registro) => registro[CAMPOS.idLoteProducao]))]
                .sort((a, b) => Number(a) - Number(b));
            for (const id of lotes) lote.add(new Option('Lote ' + id, id));
            lote.value = lotes.includes(selecionado) ? selecionado : '';
            dadosCarregados = true;
        } catch (erro) {
            grafico?.destroy();
            grafico = null;
            mostrarEstado(erro.message + ' Use Atualizar para tentar novamente.', true);
        } finally {
            carregando = false;
            atualizar.disabled = false;
            for (const controle of formulario.elements) controle.disabled = !dadosCarregados;
            bloco.setAttribute('aria-busy', 'false');
        }
        aplicarFiltros();
    }

    formulario.addEventListener('submit', (evento) => { evento.preventDefault(); aplicarFiltros(); });
    [inicio, fim, lote].forEach((controle) => controle.addEventListener('change', aplicarFiltros));
    formulario.addEventListener('reset', () => {
        // Aguarda o reset nativo antes de reler os valores dos filtros.
        queueMicrotask(aplicarFiltros);
    });
    atualizar.addEventListener('click', carregarMateriais);
    carregarMateriais();
}
