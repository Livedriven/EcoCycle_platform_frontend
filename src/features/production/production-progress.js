import API from '../../shared/api.js';
import { montarLayout } from '../../shared/layout.js';
import { can } from '../../shared/session.js';
import { formatDate, formatDateTime, formatKg, formatNumber } from '../../shared/formatters.js';
import { classeStatus, classeContadorAlertas } from '../../shared/ui.js';
import {
    lerIdDaUrl, lerData, duracaoEmSegundos, formatarDuracao, montarMonitoramento
} from './production-progress-data.js';

// Consultar vale para todos os perfis; só os botões exigem `producao.operar`.
const SESSAO = montarLayout();

const LISTA_URL = '/src/features/production/production-monitoring.html';
const INTERVALO_MS = 5000; // mesma estratégia da produção diária (production.js)
const NAO_INFORMADO = 'Não informado';
// Ícones por material (Bootstrap Icons). Material sem ícone cai em "box".
const ICONES = { 'Plástico': 'cup-straw', Metal: 'magnet', 'Alumínio': 'database', Rejeito: 'trash' };

if (SESSAO) {
    iniciarTela();
}

function iniciarTela() {
    const el = (id) => document.getElementById(id);
    const estado = document.querySelector('main .estado');
    const monitoramento = el('monitoramento');
    const idProducao = lerIdDaUrl(location.search);

    if (idProducao === null) {
        mostrarMensagem('Produção não identificada. Volte ao controle de produções e selecione uma.', { texto: 'Voltar', href: LISTA_URL });
        return;
    }

    // Os botões só aparecem para quem pode operar produção. Ambos ficam desabilitados (veja o HTML):
    // iniciar já aconteceu no cadastro, e a operação de finalizar não está no contrato.
    // TODO(E2/E5): contrato de finalizar (PATCH /producao/:id; o corpo ainda não está definido).
    el('acoes-producao').classList.toggle('d-none', !can('producao.operar'));

    let assinatura; // undefined até a primeira carga com sucesso
    let carregando = false;
    let inicio = '';
    let encerrada = false;
    let ultimaAtualizacao = '';

    carregar();
    setInterval(() => {
        if (!document.hidden) carregar();
    }, INTERVALO_MS);
    setInterval(atualizarRelogio, 1000);

    async function carregar() {
        if (carregando) return;
        carregando = true;
        const primeira = assinatura === undefined;
        if (primeira) mostrarCarregando();

        try {
            // erroLocal: o erro aparece aqui, sem redirecionar para as páginas de erro (como production.js).
            const [producoes, lotes, esteiras, leituras, alertas] = await Promise.all([
                API.GET('/producao', { erroLocal: true }),
                API.GET('/lotes', { erroLocal: true }),
                API.GET('/equipamentos', { erroLocal: true }),
                API.GET('/telemetria/historico', { erroLocal: true }),
                API.GET('/alertas', { erroLocal: true })
            ]);
            const lista = (valor) => (Array.isArray(valor) ? valor : []);
            const dados = montarMonitoramento({
                producoes: lista(producoes), lotes: lista(lotes), esteiras: lista(esteiras),
                leituras: lista(leituras), alertas: lista(alertas)
            }, idProducao);

            if (!dados) {
                monitoramento.classList.add('d-none');
                mostrarMensagem('Produção não encontrada.', { texto: 'Voltar', href: LISTA_URL });
                assinatura = 'null';
                return;
            }

            const nova = JSON.stringify(dados);
            if (nova !== assinatura) {
                assinatura = nova;
                desenhar(dados);
            }
            estado.replaceChildren();
            monitoramento.classList.remove('d-none');
            ultimaAtualizacao = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            el('atualizado').textContent = 'Atualizado às ' + ultimaAtualizacao;
        } catch (erro) {
            if (primeira) {
                mostrarMensagem(erro.message, { texto: 'Tentar novamente', aoClicar: carregar, erro: true });
            } else {
                // Falha numa atualização: mantém os dados e avisa que podem estar desatualizados.
                el('atualizado').textContent = 'Não foi possível atualizar agora. Última atualização às ' + ultimaAtualizacao + '.';
            }
        } finally {
            carregando = false;
        }
    }

    function desenhar(dados) {
        const { producao, lote, progresso, esteira, sensores, materiais } = dados;

        // Lote
        el('lote-titulo').textContent = lote ? 'Lote #' + (lote.codigo || lote.id) : 'Lote não encontrado';
        const partes = ['Produção ' + producao.id];
        if (producao.turno) partes.push(producao.turno);
        if (progresso) partes.push(formatKg(progresso.total));
        el('lote-subtitulo').textContent = partes.join(' · ');
        definirSelo(el('lote-status'), lote && lote.status, classeStatus);

        // Progresso (sem previsão de conclusão: a API não fornece taxa nem estimativa)
        el('bloco-progresso').classList.toggle('d-none', !progresso);
        el('sem-progresso').classList.toggle('d-none', Boolean(progresso));
        if (progresso) {
            el('progresso-percentual').textContent = progresso.percentual + '%';
            el('progresso-faltam').textContent = progresso.percentual >= 100 ? 'Peso do lote atingido' : 'Faltam ' + (100 - progresso.percentual) + '%';
            const barra = el('barra-progresso');
            barra.style.width = progresso.percentual + '%';
            barra.setAttribute('aria-valuenow', String(progresso.percentual));
            el('peso-processado').textContent = formatKg(progresso.processado) + ' processados';
            el('peso-restante').textContent = progresso.excedeu
                ? 'Processado acima do peso do lote'
                : formatKg(progresso.restante) + ' restantes';
        }

        // Início e tempo em operação
        const lida = lerData(producao.inicio);
        el('inicio-producao').textContent = lida ? (lida.temHora ? formatDateTime(producao.inicio) : formatDate(producao.inicio)) : NAO_INFORMADO;
        inicio = producao.inicio;
        // TODO(E2): confirmar o valor de status que indica produção encerrada (aqui, "Finalizado").
        encerrada = String(lote?.status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'finalizado';
        atualizarRelogio();

        // Esteira e sensores
        el('bloco-esteira').classList.toggle('d-none', !esteira);
        el('sem-esteira').classList.toggle('d-none', Boolean(esteira));
        if (esteira) {
            el('esteira-nome').textContent = esteira.nome || NAO_INFORMADO;
            definirSelo(el('esteira-status'), esteira.status, classeStatus);
            el('esteira-velocidade').textContent = numeroOuNaoInformado(esteira.velocidade_kmh, ' km/h');
            el('esteira-temperatura').textContent = numeroOuNaoInformado(esteira.temperatura_c, ' °C');

            const leitura = sensores.ultima;
            definirSelo(el('sensor-leitura'), leitura ? 'Última leitura: ' + leitura.status : 'Sem leituras', () => leitura ? classeStatus(leitura.status) : 'b-suave');
            el('sensor-alertas').textContent = sensores.alertasAtivos > 0 ? sensores.alertasAtivos + ' alerta(s) ativo(s)' : 'Sem alertas ativos';
            el('sensor-alertas').className = 'badge ' + classeContadorAlertas(sensores.alertasAtivos);
            el('sensor-data').textContent = leitura && lerData(leitura.data) ? formatDateTime(leitura.data) : '';
        }

        // Materiais separados
        el('lista-materiais').replaceChildren(...materiais.map(({ material, peso }) => {
            const item = document.createElement('li');
            item.className = 'd-flex justify-content-between align-items-center border-bottom py-3';
            const nome = document.createElement('span');
            nome.className = 'fw-semibold';
            const icone = document.createElement('i');
            icone.className = 'bi bi-' + (ICONES[material] || 'box') + ' me-3 text-body-secondary';
            icone.setAttribute('aria-hidden', 'true');
            nome.append(icone, material);
            const valor = document.createElement('span');
            valor.textContent = formatKg(peso);
            item.append(nome, valor);
            return item;
        }));
    }

    function definirSelo(elemento, texto, classeDe) {
        elemento.classList.toggle('d-none', !texto);
        elemento.textContent = texto || '';
        elemento.className = 'badge ' + classeDe(texto) + (texto ? '' : ' d-none');
    }

    function numeroOuNaoInformado(valor, unidade) {
        return valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor))
            ? NAO_INFORMADO
            : formatNumber(valor, 1) + unidade;
    }

    // O relógio roda a cada segundo, sem nova consulta à API.
    function atualizarRelogio() {
        if (assinatura === undefined || assinatura === 'null') return;
        const segundos = duracaoEmSegundos(inicio);
        el('tempo-operacao').textContent = encerrada ? '—' : (segundos === null ? NAO_INFORMADO : formatarDuracao(segundos));
    }

    function mostrarCarregando() {
        const caixa = document.createElement('div');
        caixa.className = 'text-center py-4';
        const spinner = document.createElement('div');
        spinner.className = 'spinner-border text-primary';
        spinner.setAttribute('role', 'status');
        const texto = document.createElement('span');
        texto.className = 'visually-hidden';
        texto.textContent = 'Carregando monitoramento...';
        spinner.appendChild(texto);
        caixa.appendChild(spinner);
        estado.replaceChildren(caixa);
    }

    // acao: { texto, aoClicar, erro? } (botão) ou { texto, href } (link).
    function mostrarMensagem(texto, acao = null) {
        const caixa = document.createElement('div');
        caixa.className = 'card shadow-sm card-body text-center py-4';
        const paragrafo = document.createElement('p');
        paragrafo.className = (acao && acao.erro ? 'text-danger' : 'text-body-secondary') + ' mb-3';
        paragrafo.textContent = texto;
        caixa.appendChild(paragrafo);
        if (acao) {
            const controle = document.createElement(acao.href ? 'a' : 'button');
            controle.className = 'btn btn-outline-primary mx-auto';
            controle.textContent = acao.texto;
            if (acao.href) controle.href = acao.href;
            else {
                controle.type = 'button';
                controle.addEventListener('click', acao.aoClicar);
            }
            caixa.appendChild(controle);
        }
        estado.replaceChildren(caixa);
    }
}
