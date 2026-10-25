import { escaparHtml } from '../../shared/table.js';
import { classeStatus } from '../../shared/ui.js';
import { numeroComUnidade, dataManutencao } from './conveyor-data.js';

export function criarCartaoEsteira(esteira, aoClicar, { status = false, selecionada = false } = {}) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'card esteira-card shadow-sm' + (selecionada ? ' selecionada' : '');
    botao.dataset.esteiraId = String(esteira.id);
    botao.setAttribute('aria-label', (status ? 'Acompanhar ' : 'Ver detalhes de ') + (esteira.nome_esteira || 'Esteira ' + esteira.id));
    if (status) botao.setAttribute('aria-pressed', String(selecionada));
    botao.innerHTML = '<span class="d-flex justify-content-between align-items-start gap-2 mb-3">' +
        '<span class="esteira-icone"><i class="bi bi-hdd-rack" aria-hidden="true"></i></span>' +
        '<span class="badge ' + classeStatus(esteira.status_esteira) + '">' + escaparHtml(esteira.status_esteira || 'Não informado') + '</span></span>' +
        '<span class="fs-5 fw-semibold text-break esteira-nome">' + escaparHtml(esteira.nome_esteira || 'Esteira ' + esteira.id) + '</span>' +
        '<span class="small text-body-secondary mt-1 text-break">' + escaparHtml(esteira.tipo_esteira || 'Tipo não informado') + ' · ' +
        escaparHtml(esteira.local_esteira || 'Local não informado') + '</span>' +
        '<span class="esteira-medidas mt-3 small"><span>Velocidade<strong>' + escaparHtml(numeroComUnidade(esteira.velocidade_esteira_kmh, 'km/h')) +
        '</strong></span><span>Temperatura<strong>' + escaparHtml(numeroComUnidade(esteira.temperatura_esteira_c, '°C')) + '</strong></span></span>' +
        (status ? '' : '<span class="small text-body-secondary mt-3">Última manutenção: ' + escaparHtml(dataManutencao(esteira.ultima_manutencao)) + '</span>') +
        '<span class="esteira-acao small fw-semibold mt-3">' + (status ? (selecionada ? 'Esteira selecionada' : 'Acompanhar esteira') : 'Ver detalhes') +
        '<i class="bi bi-arrow-right ms-2" aria-hidden="true"></i></span>';
    botao.addEventListener('click', () => aoClicar(esteira, botao));
    return botao;
}
