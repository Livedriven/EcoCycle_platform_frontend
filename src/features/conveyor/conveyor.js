import { Modal } from 'bootstrap';
import { montarLayout } from '../../shared/layout.js';
import API from '../../shared/api.js';
import { criarElemento } from '../../shared/dom.js';
import { classeStatus } from '../../shared/ui.js';
import { filtrarEsteiras, numeroComUnidade, dataManutencao, urlStatus } from './conveyor-data.js';
import { criarCartaoEsteira } from './conveyor-cards.js';
import './conveyor.css';

if (montarLayout()) {
    const lista = document.getElementById('lista-esteiras');
    const estado = document.getElementById('estado-esteiras');
    const busca = document.getElementById('busca-esteiras');
    const quantidade = document.getElementById('quantidade-esteiras');
    const atualizacao = document.getElementById('ultima-atualizacao');
    const modalElemento = document.getElementById('modal-esteira');
    const modal = Modal.getOrCreateInstance(modalElemento);
    let esteiras = [];
    let carregando = false;
    let carregou = false;
    let assinatura;
    let selecionada = null;
    let origemModal = null;

    function mensagem(texto, erro = false) {
        estado.replaceChildren();
        estado.setAttribute('role', erro ? 'alert' : 'status');
        const icone = document.createElement('i');
        icone.className = 'bi fs-3 bi-' + (erro ? 'exclamation-triangle text-danger' : 'inbox');
        const descricao = document.createElement('span');
        descricao.textContent = texto;
        estado.append(icone, descricao);
        if (erro) {
            const tentar = document.createElement('button');
            tentar.type = 'button';
            tentar.className = 'btn btn-outline-secondary btn-sm';
            tentar.textContent = 'Tentar novamente';
            tentar.addEventListener('click', () => carregar());
            estado.append(tentar);
        }
    }

    function preencherDetalhes(esteira) {
        const campo = (rotulo, valor) => {
            const grupo = criarElemento('div', 'col-sm-6');
            grupo.append(
                criarElemento('dt', 'small text-body-secondary fw-normal', rotulo),
                criarElemento('dd', 'fw-semibold mb-0 text-break', valor || 'Não informado')
            );
            return grupo;
        };
        document.getElementById('titulo-modal-esteira').textContent = esteira.nome_esteira || 'Detalhes da esteira';
        const status = criarElemento('div', 'mb-4');
        status.append(criarElemento('span', 'badge ' + classeStatus(esteira.status_esteira), esteira.status_esteira || 'Não informado'));
        const campos = criarElemento('dl', 'row g-4 mb-0');
        campos.append(
            campo('Código da esteira', String(esteira.id)), campo('Nome', esteira.nome_esteira),
            campo('Tipo', esteira.tipo_esteira), campo('Local', esteira.local_esteira),
            campo('Velocidade', numeroComUnidade(esteira.velocidade_esteira_kmh, 'km/h')),
            campo('Temperatura da esteira', numeroComUnidade(esteira.temperatura_esteira_c, '°C')),
            campo('Última manutenção', dataManutencao(esteira.ultima_manutencao))
        );
        document.getElementById('detalhes-esteira').replaceChildren(status, campos);
        document.getElementById('link-status-esteira').href = urlStatus(esteira.id);
        document.getElementById('link-status-esteira').hidden = false;
    }

    function abrirDetalhes(esteira, botao) {
        selecionada = String(esteira.id);
        origemModal = botao;
        preencherDetalhes(esteira);
        modal.show();
    }

    function desenhar() {
        const filtradas = filtrarEsteiras(esteiras, busca.value);
        const foco = lista.contains(document.activeElement) ? document.activeElement.dataset.esteiraId : null;
        lista.replaceChildren(...filtradas.map((esteira) => criarCartaoEsteira(esteira, abrirDetalhes)));
        quantidade.textContent = filtradas.length + (filtradas.length === 1 ? ' esteira encontrada' : ' esteiras encontradas');
        estado.replaceChildren();
        if (!esteiras.length) mensagem('Nenhuma esteira cadastrada.');
        else if (!filtradas.length) mensagem('Nenhuma esteira encontrada para esta busca.');
        if (foco) [...lista.children].find((botao) => botao.dataset.esteiraId === foco)?.focus();
    }

    async function carregar() {
        if (carregando) return;
        carregando = true;
        lista.setAttribute('aria-busy', 'true');
        if (!carregou) mensagem('Carregando esteiras...');
        try {
            const dados = await API.GET('/equipamentos', { erroLocal: true });
            if (!Array.isArray(dados)) throw new Error('Resposta inválida ao consultar esteiras.');
            const novaAssinatura = JSON.stringify(dados);
            const mudou = assinatura !== novaAssinatura;
            esteiras = dados;
            if (!carregou || mudou) desenhar();
            carregou = true;
            assinatura = novaAssinatura;
            atualizacao.textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR');
            if (selecionada !== null && mudou) {
                const atual = esteiras.find((item) => String(item.id) === selecionada);
                if (atual) preencherDetalhes(atual);
                else {
                    document.getElementById('detalhes-esteira').textContent = 'Esta esteira não está mais disponível.';
                    document.getElementById('link-status-esteira').hidden = true;
                }
            }
        } catch (erro) {
            if (carregou) atualizacao.textContent = 'Falha ao atualizar. Os dados exibidos podem estar desatualizados.';
            else mensagem('Não foi possível carregar as esteiras. ' + erro.message, true);
        } finally {
            lista.setAttribute('aria-busy', 'false');
            carregando = false;
        }
    }

    busca.addEventListener('input', () => { if (carregou) desenhar(); });
    modalElemento.addEventListener('hidden.bs.modal', () => {
        const id = selecionada;
        selecionada = null;
        const origem = origemModal?.isConnected ? origemModal : [...lista.children].find((botao) => botao.dataset.esteiraId === id);
        (origem || busca).focus();
    });
    setInterval(() => { if (!document.hidden) carregar(); }, 5000);
    carregar();
}
