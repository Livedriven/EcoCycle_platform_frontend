import { montarLayout } from '../../shared/layout.js';
import API from '../../shared/api.js';
import { createTable, escaparHtml, updateTable } from '../../shared/table.js';
import { formatDate } from '../../shared/formatters.js';
import { classeStatus } from '../../shared/ui.js';
import { criarDetalhesProducao } from './production-details.js';
import { filtrarProducoes } from './production-filters.js';

// Página protegida: sem sessão válida, montarLayout() já redireciona ao login.
const SESSAO = montarLayout();

if (SESSAO) {
    const bloco = document.getElementById('bloco-producao');
    const estado = bloco.querySelector('.estado');
    const conteudo = bloco.querySelector('.conteudo');
    const busca = document.getElementById('busca-producao');
    const filtroData = document.getElementById('filtro-data');
    const filtroStatus = document.getElementById('filtro-status');
    const filtroTurno = document.getElementById('filtro-turno');
    const limparFiltro = document.getElementById('limpar-filtro');
    const resultadoFiltros = document.getElementById('resultado-filtros');
    const detalhes = criarDetalhesProducao();
    let tabela;
    let producoes = [];

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

    function mostrarResultado(quantidade) {
        const temFiltros = busca.value || filtroData.value || filtroStatus.value || filtroTurno.value;
        resultadoFiltros.classList.toggle('d-none', !temFiltros);
        resultadoFiltros.textContent = temFiltros
            ? quantidade + ' de ' + producoes.length + (quantidade === 1 ? ' registro encontrado.' : ' registros encontrados.')
            : '';
    }

    function aplicarFiltros() {
        if (!tabela) {
            return;
        }

        const registros = filtrarProducoes(producoes, {
            busca: busca.value,
            data: filtroData.value,
            status: filtroStatus.value,
            turno: filtroTurno.value
        });

        updateTable(tabela, registros);
        mostrarResultado(registros.length);
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
        mostrarCarregando();
        [busca, filtroData, filtroStatus, filtroTurno, limparFiltro].forEach((controle) => {
            controle.disabled = true;
        });

        try {
            const [registros, lotes, esteiras] = await Promise.all([
                API.GET('/producao'),
                API.GET('/lotes'),
                API.GET('/esteiras')
            ]);
            producoes = enriquecerProducoes(registros, lotes, esteiras);

            if (producoes.length === 0) {
                mostrarMensagem('Nenhuma produção foi registrada.', 'inbox');
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
            tabela = createTable(conteudo, [
                { id: 'id', label: 'ID da produção' },
                { id: 'id_lote', label: 'ID do lote' },
                { id: 'id_esteira', label: 'ID da esteira' },
                {
                    id: 'status',
                    label: 'Status',
                    html: (status) => '<span class="badge ' + classeStatus(status) + '">' + escaparHtml(status) + '</span>'
                },
                { id: 'data_hora', label: 'Data', formatar: formatDate },
                { id: 'turno', label: 'Turno' },
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
        } catch (erro) {
            mostrarMensagem(erro.message, 'exclamation-triangle');
        } finally {
            [busca, filtroData, filtroStatus, filtroTurno, limparFiltro].forEach((controle) => {
                controle.disabled = !tabela;
            });
        }
    }

    busca.addEventListener('input', aplicarFiltros);
    [filtroData, filtroStatus, filtroTurno].forEach((filtro) => {
        filtro.addEventListener('change', aplicarFiltros);
    });
    limparFiltro.addEventListener('click', () => {
        busca.value = '';
        filtroData.value = '';
        filtroStatus.value = '';
        filtroTurno.value = '';
        aplicarFiltros();
        busca.focus();
    });

    carregarProducoes();
}
