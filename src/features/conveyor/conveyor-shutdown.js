// Desligamento manual de uma esteira pelo portal: PATCH /esteiras/:id com o status DESLIGADA.
// Usado pelo modal de detalhes (conveyor.js) e pela tela de status (conveyor-status.js).
import API from '../../shared/api.js';
import { can } from '../../shared/session.js';

export const STATUS_DESLIGADA = 'DESLIGADA';

function normalizar(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** "DESLIGADA" (manual) e "ESTEIRA DESLIGADA" (regra de segurança) contam como desligada. */
export function estaDesligada(status) {
    return ['desligada', 'esteira desligada', 'parada'].includes(normalizar(status));
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
    if (!confirmar('Desligar "' + nome + '"? A esteira fica parada até ser ligada novamente.')) return null;
    return API.PATCH(`/esteiras/${esteira.id}`, { status_esteira: STATUS_DESLIGADA }, { erroLocal: true });
}
