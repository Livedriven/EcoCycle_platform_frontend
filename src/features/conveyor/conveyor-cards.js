import { criarElemento, criarIcone } from '../../shared/dom.js';
import { classeStatus } from '../../shared/ui.js';
import { numeroComUnidade, dataManutencao } from './conveyor-data.js';

export function criarCartaoEsteira(esteira, aoClicar, { status = false, selecionada = false } = {}) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'card esteira-card shadow-sm' + (selecionada ? ' selecionada' : '');
    botao.dataset.esteiraId = String(esteira.id);
    botao.setAttribute('aria-label', (status ? 'Acompanhar ' : 'Ver detalhes de ') + (esteira.nome_esteira || 'Esteira ' + esteira.id));
    if (status) botao.setAttribute('aria-pressed', String(selecionada));
    const topo = criarElemento('span', 'd-flex justify-content-between align-items-start gap-2 mb-3');
    const icone = criarElemento('span', 'esteira-icone');
    icone.append(criarIcone('bi bi-hdd-rack'));
    topo.append(icone, criarElemento('span', 'badge ' + classeStatus(esteira.status_esteira), esteira.status_esteira || 'Não informado'));
    const medidas = criarElemento('span', 'esteira-medidas mt-3 small');
    const velocidade = criarElemento('span', '', 'Velocidade');
    velocidade.append(criarElemento('strong', '', numeroComUnidade(esteira.velocidade_esteira_kmh, 'km/h')));
    const temperatura = criarElemento('span', '', 'Temperatura');
    temperatura.append(criarElemento('strong', '', numeroComUnidade(esteira.temperatura_esteira_c, '°C')));
    medidas.append(velocidade, temperatura);
    botao.append(
        topo,
        criarElemento('span', 'fs-5 fw-semibold text-break esteira-nome', esteira.nome_esteira || 'Esteira ' + esteira.id),
        criarElemento('span', 'small text-body-secondary mt-1 text-break',
            (esteira.tipo_esteira || 'Tipo não informado') + ' · ' + (esteira.local_esteira || 'Local não informado')),
        medidas
    );
    if (!status) botao.append(criarElemento('span', 'small text-body-secondary mt-3', 'Última manutenção: ' + dataManutencao(esteira.ultima_manutencao)));
    const acao = criarElemento('span', 'esteira-acao small fw-semibold mt-3',
        status ? (selecionada ? 'Esteira selecionada' : 'Acompanhar esteira') : 'Ver detalhes');
    acao.append(criarIcone('bi bi-arrow-right ms-2'));
    botao.append(acao);
    botao.addEventListener('click', () => aoClicar(esteira, botao));
    return botao;
}
