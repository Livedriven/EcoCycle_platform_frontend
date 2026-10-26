import { montarLayout } from '../../shared/layout.js';
import API from '../../shared/api.js';
import { createTable, h, updateTable } from '../../shared/table.js';
import { formatDate, formatKg } from '../../shared/formatters.js';
import { totalProduzido } from '../../shared/calculations.js';
import { classeStatus } from '../../shared/ui.js';
import { criarDetalhesProducao } from './production-details.js';
import { filtrarProducoes, validarPeriodo } from './production-filters.js';

// Página protegida: sem sessão válida, montarLayout() já redireciona ao login.
const SESSAO = montarLayout();

if (SESSAO) {
    const bloco = document.getElementById('bloco-producao');
    const estado = bloco.querySelector('.estado');
    const conteudo = bloco.querySelector('.conteudo');
    const busca = document.getElementById('busca-producao');
    const filtroDataInicial = document.getElementById('filtro-data-inicial');
    const filtroDataFinal = document.getElementById('filtro-data-final');
    const erroPeriodo = document.getElementById('erro-periodo');
    const filtroStatus = document.getElementById('filtro-status');
    const filtroTurno = document.getElementById('filtro-turno');
    const limparFiltro = document.getElementById('limpar-filtro');
    const resultadoFiltros = document.getElementById('resultado-filtros');
    const detalhes = criarDetalhesProducao();
    let tabela;
    let producoes = [];
    let carregando = false;
    let assinaturaDados;

    function mostrarCarregando() {
        conteudo.classList.add('d-none');
        estado.replaceChildren();

        const spinner = document.createElement('div');
        spinner.className = 'spinner-border spinner-border-sm';
        spinner.setAttribute('role', 'status');
        const texto = document.createElement('span');
        texto.textContent = 'Carregando produções...';
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

    function preencherOpcoes(select, valores, textoPadrao, ordem = []) {
        const valorSelecionado = select.value;
        const opcoes = [...new Set(valores)].sort((a, b) => {
            const posicaoA = ordem.indexOf(a);
            const posicaoB = ordem.indexOf(b);
            if (posicaoA !== -1 || posicaoB !== -1) {
                return (posicaoA === -1 ? Infinity : posicaoA) - (posicaoB === -1 ? Infinity : posicaoB);
            }
            return a.localeCompare(b, 'pt-BR');
        });

        select.replaceChildren(new Option(textoPadrao, ''));
        opcoes.forEach((opcao) => select.add(new Option(opcao, opcao)));
        select.value = opcoes.includes(valorSelecionado) ? valorSelecionado : '';
    }

    function mostrarResultado(registros) {
        const quantidade = registros.length;
        resultadoFiltros.classList.remove('d-none');
        resultadoFiltros.textContent = quantidade + ' de ' + producoes.length
            + (quantidade === 1 ? ' registro encontrado. ' : ' registros encontrados. ')
            + 'Total do período: ' + formatKg(totalProduzido(registros)) + '.';
    }

    function validarDatas() {
        const mensagem = filtroDataInicial.validity.badInput || filtroDataFinal.validity.badInput
            ? 'Informe uma data válida.'
            : validarPeriodo(filtroDataInicial.value, filtroDataFinal.value);
        filtroDataInicial.max = filtroDataFinal.value;
        filtroDataFinal.min = filtroDataInicial.value;
        [filtroDataInicial, filtroDataFinal].forEach((campo) => {
            campo.setCustomValidity(mensagem);
            campo.classList.toggle('is-invalid', Boolean(mensagem));
            campo.setAttribute('aria-invalid', String(Boolean(mensagem)));
        });
        erroPeriodo.textContent = mensagem;
        erroPeriodo.classList.toggle('d-none', !mensagem);
        return !mensagem;
    }

    function aplicarFiltros() {
        const datasValidas = validarDatas();
        if (!tabela) {
            return;
        }
        if (!datasValidas) {
            conteudo.classList.add('d-none');
            resultadoFiltros.classList.add('d-none');
            return;
        }
        mostrarConteudo();

        const registros = filtrarProducoes(producoes, {
            busca: busca.value,
            dataInicial: filtroDataInicial.value,
            dataFinal: filtroDataFinal.value,
            status: filtroStatus.value,
            turno: filtroTurno.value
        });

        updateTable(tabela, registros);
        mostrarResultado(registros);
    }

    function enriquecerProducoes(registros, lotes, esteiras) {
        const lotesPorId = new Map(lotes.map((lote) => [String(lote.id), lote]));
        const esteirasPorId = new Map(esteiras.map((esteira) => [String(esteira.id), esteira]));

        return registros.map((producao) => {
            const lote = lotesPorId.get(String(producao.id_lote));
            const esteira = esteirasPorId.get(String(producao.id_esteira));

            return {
                ...producao,
                status: producao.status || lote?.status || 'Não informado',
                turno: producao.turno_producao || 'Não informado',
                nome_esteira: esteira?.nome_esteira || ''
            };
        });
    }

    async function carregarProducoes() {
        if (carregando) return;
        carregando = true;
        if (assinaturaDados === undefined) mostrarCarregando();
        if (assinaturaDados === undefined) [busca, filtroDataInicial, filtroDataFinal, filtroStatus, filtroTurno, limparFiltro].forEach((controle) => {
            controle.disabled = true;
        });

        try {
            const [registros, lotes, esteiras] = await Promise.all([
                API.GET('/producao', { erroLocal: true }),
                API.GET('/lotes', { erroLocal: true }),
                API.GET('/esteiras', { erroLocal: true })
            ]);
            const novasProducoes = enriquecerProducoes(registros, lotes, esteiras);
            const assinatura = JSON.stringify(novasProducoes);
            if (assinatura === assinaturaDados) return;
            producoes = novasProducoes;

            if (producoes.length === 0) {
                mostrarMensagem('Nenhuma produção foi registrada.', 'inbox');
                mostrarResultado([]);
                assinaturaDados = assinatura;
                return;
            }

            preencherOpcoes(filtroStatus, producoes.map((producao) => producao.status), 'Todos os status');
            preencherOpcoes(
                filtroTurno,
                producoes.map((producao) => producao.turno),
                'Todos os turnos',
                ['Manhã', 'Tarde', 'Noite', 'Madrugada']
            );
            mostrarConteudo();
            if (!tabela) tabela = createTable(conteudo, [
                { id: 'id', label: 'ID da produção' },
                { id: 'id_lote', label: 'ID do lote' },
                { id: 'id_esteira', label: 'ID da esteira' },
                {
                    id: 'status',
                    label: 'Status',
                    formatar: (status) => h('span', { className: 'badge ' + classeStatus(status) }, String(status ?? ''))
                },
                { id: 'data_hora', label: 'Data', formatar: formatDate },
                { id: 'turno', label: 'Turno' },
                { id: 'peso_kg', label: 'Peso produzido', formatar: formatKg },
                {
                    label: 'Ações',
                    acoes: [{
                        texto: 'Ver dados',
                        icone: 'eye',
                        classe: 'btn-outline-primary',
                        aoClicar: (producao) => detalhes.abrir(producao)
                    }]
                }
            ], producoes, { busca: false, porPagina: 10 });
            aplicarFiltros();
            assinaturaDados = assinatura;
        } catch (erro) {
            if (assinaturaDados === undefined) mostrarMensagem(erro.message, 'exclamation-triangle');
        } finally {
            carregando = false;
            [busca, filtroDataInicial, filtroDataFinal, filtroStatus, filtroTurno, limparFiltro].forEach((controle) => {
                controle.disabled = !tabela;
            });
        }
    }

    busca.addEventListener('input', aplicarFiltros);
    [filtroDataInicial, filtroDataFinal].forEach((filtro) => {
        filtro.addEventListener('input', aplicarFiltros);
    });
    [filtroDataInicial, filtroDataFinal, filtroStatus, filtroTurno].forEach((filtro) => {
        filtro.addEventListener('change', aplicarFiltros);
    });
    limparFiltro.addEventListener('click', () => {
        busca.value = '';
        filtroDataInicial.value = '';
        filtroDataFinal.value = '';
        filtroStatus.value = '';
        filtroTurno.value = '';
        aplicarFiltros();
        busca.focus();
    });

    carregarProducoes();
    setInterval(() => {
        if (!document.hidden) carregarProducoes();
    }, 5000);
}
