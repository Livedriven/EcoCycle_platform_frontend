// Regras da tela de controle de produções: junção com lotes e esteiras, status exibidos,
// busca e ordem. Funções puras: não mexem na tela nem chamam a API.

// "Disponível" -> "disponivel" (sem acento, minúsculas, sem espaços nas pontas).
export function normalizarTexto(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Status exibidos, comparados sem acento nem caixa: "RECEBIDO", "Recebido", "DISPONIVEL" e
// "Disponível" valem igual. TODO(E2): confirmar os valores exatos devolvidos pelo backend.
export const STATUS_EXIBIDOS = ['recebido', 'disponivel'];
const ROTULOS = { recebido: 'Recebido', disponivel: 'Disponível' };

export function chaveDoStatus(status) {
    return normalizarTexto(status);
}

export function rotuloDoStatus(status) {
    return ROTULOS[chaveDoStatus(status)] ?? String(status ?? '');
}

// Uma linha por produção cujo status esteja em STATUS_EXIBIDOS. A produção não tem status
// próprio no mock: usa o do lote, como a tela de produção diária (producao.status || lote.status).
export function montarLinhas(producoes, lotes, esteiras) {
    const lotesPorId = new Map(lotes.map((lote) => [String(lote.id), lote]));
    const esteirasPorId = new Map(esteiras.map((esteira) => [String(esteira.id), esteira]));

    return producoes
        .map((producao) => {
            const lote = lotesPorId.get(String(producao.id_lote));
            const status = producao.status ?? lote?.status ?? '';
            const codigo = lote?.codigo_lote ?? '';
            return {
                id: producao.id,
                id_lote: producao.id_lote,
                codigo_lote: codigo,
                lote: codigo ? producao.id_lote + ' (' + codigo + ')' : String(producao.id_lote ?? ''),
                esteira: esteirasPorId.get(String(producao.id_esteira))?.nome_esteira || 'Não informada',
                turno: producao.turno_producao || 'Não informado',
                peso_lote: lote?.pesoentrada_kg,
                status: rotuloDoStatus(status),
                chave_status: chaveDoStatus(status)
            };
        })
        .filter((linha) => STATUS_EXIBIDOS.includes(linha.chave_status));
}

// Opções do filtro: só os status que existem entre as linhas, na ordem de STATUS_EXIBIDOS.
export function opcoesDeStatus(linhas) {
    return STATUS_EXIBIDOS
        .filter((chave) => linhas.some((linha) => linha.chave_status === chave))
        .map((chave) => ({ valor: chave, rotulo: ROTULOS[chave] }));
}

// Termo só com dígitos compara o ID da produção ou do lote por inteiro ("1" acha o 1, não o 10).
// Termo com letras ou símbolos acha parte do código do lote (sem acento e maiúsculas).
export function filtrarProducoes(linhas, { busca = '', status = '' } = {}) {
    const termo = normalizarTexto(busca);
    return linhas.filter((linha) => {
        if (status && linha.chave_status !== status) return false;
        if (!termo) return true;
        if (/^\d+$/.test(termo)) {
            return String(linha.id) === termo || String(linha.id_lote) === termo
                || normalizarTexto(linha.codigo_lote) === termo;
        }
        return normalizarTexto(linha.codigo_lote).includes(termo);
    });
}

// Mais antigas primeiro (menor ID), como no design de referência.
export function ordenarPorId(linhas) {
    return [...linhas].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
}
