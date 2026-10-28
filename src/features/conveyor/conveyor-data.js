import { formatDate, formatDateTime, formatNumber } from '../../shared/formatters.js';

function normalizar(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function filtrarEsteiras(esteiras, busca) {
    const termo = normalizar(busca);
    return esteiras.filter((esteira) => [esteira.id, esteira.nome_esteira, esteira.tipo_esteira,
        esteira.local_esteira, esteira.status_esteira].some((valor) => normalizar(valor).includes(termo)));
}

export function numeroComUnidade(valor, unidade, casas = 1) {
    if (valor === null || valor === undefined || String(valor).trim() === '' || !Number.isFinite(Number(valor))) return 'Não informado';
    return formatNumber(valor, casas) + ' ' + unidade;
}

export function dataManutencao(valor) {
    return valor && !Number.isNaN(new Date(valor).getTime()) ? formatDate(valor) : 'Não informada';
}

export function dataHora(valor) {
    return valor && !Number.isNaN(new Date(valor).getTime()) ? formatDateTime(valor) : '–';
}

export function urlStatus(id) {
    return 'conveyor-status.html?' + new URLSearchParams({ esteira: String(id) });
}

// O vínculo alerta → leitura → esteira evita misturar registros de equipamentos.
// A API pode representar identificadores como strings ou números.
export function dadosDaEsteira(id, todasLeituras, todosAlertas) {
    const leituras = todasLeituras.filter((leitura) => String(leitura.id_esteira) === String(id))
        .sort((a, b) => String(b.datahora_leitura ?? '').localeCompare(String(a.datahora_leitura ?? '')));
    const ids = new Set(leituras.map((leitura) => String(leitura.id)));
    const alertas = todosAlertas.filter((alerta) => ids.has(String(alerta.id_leitura)) && alerta.resolvido !== true && alerta.resolvido !== 'true')
        .sort((a, b) => String(b.datahora_alerta ?? '').localeCompare(String(a.datahora_alerta ?? '')));
    return { leituras, alertas };
}
