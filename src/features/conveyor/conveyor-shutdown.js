// Desligamento manual de uma esteira pelo portal: PATCH /esteiras/:id com o status DESLIGADA.
// Usado pelo modal de detalhes (conveyor.js) e pela tela de status (conveyor-status.js).
import API from '../../shared/api.js';
import { can } from '../../shared/session.js';

export const STATUS_DESLIGADA = 'DESLIGADA';

function normalizar(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Estados em que a esteira já está parada ou indisponível. */
export function estaDesligada(status) {
    return ['desligada', 'esteira desligada', 'esteira desligada/travada', 'parada',
        'bloqueio termico', 'sem comunicacao'].includes(normalizar(status));
}

/** O botão só aparece para quem pode operar esteiras e quando a esteira não está desligada. */
export function podeDesligar(esteira, perfil) {
    return Boolean(esteira) && can('esteira.operar', perfil) && !estaDesligada(esteira.status_esteira);
}

/**
 * Pede confirmação e envia o desligamento. Devolve a esteira atualizada,
 * ou null se a pessoa cancelar. Falhas da API chegam como exceção.
 */
export async function desligarEsteira(esteira, confirmar = (texto) => globalThis.confirm(texto)) {
    const nome = esteira.nome_esteira || 'Esteira ' + esteira.id;
    if (!confirmar('Registrar "' + nome + '" como desligada? Para parar o motor, use o painel do middleware.')) return null;
    return API.PATCH(`/esteiras/${esteira.id}`, { status_esteira: STATUS_DESLIGADA }, { erroLocal: true });
}
