/** Remove acentos, diferenças entre maiúsculas/minúsculas e espaços excedentes. */
export function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim()
        .replace(/\s+/g, ' ');
}

/** Distância de Levenshtein: número mínimo de inserções, remoções ou trocas. */
export function distanciaEdicao(origem, destino) {
    const a = normalizarTexto(origem);
    const b = normalizarTexto(destino);
    const anterior = Array.from({ length: b.length + 1 }, (_, indice) => indice);

    for (let linha = 1; linha <= a.length; linha += 1) {
        const atual = [linha];
        for (let coluna = 1; coluna <= b.length; coluna += 1) {
            const custo = a[linha - 1] === b[coluna - 1] ? 0 : 1;
            atual[coluna] = Math.min(
                atual[coluna - 1] + 1,
                anterior[coluna] + 1,
                anterior[coluna - 1] + custo
            );
        }
        for (let coluna = 0; coluna < atual.length; coluna += 1) {
            anterior[coluna] = atual[coluna];
        }
    }
    return anterior[b.length];
}

function tolerancia(termo) {
    if (termo.length <= 4) return 1;
    if (termo.length <= 8) return 2;
    return 3;
}

function camposDaProducao(producao) {
    const data = String(producao.data_hora || '').slice(0, 10);
    const dataFormatada = data ? data.split('-').reverse().join('/') : '';

    return [
        producao.id,
        'produção ' + producao.id,
        producao.id_lote,
        'lote ' + producao.id_lote,
        producao.id_esteira,
        producao.nome_esteira,
        producao.status,
        producao.turno,
        producao.tipo_material,
        data,
        dataFormatada
    ].map(normalizarTexto);
}

function termoCorresponde(termo, campos) {
    if (campos.some((campo) => campo.includes(termo))) {
        return true;
    }
    // Identificadores numéricos devem ser exatos: "12" não pode encontrar "21".
    if (/^\d+$/.test(termo) || termo.length < 4) {
        return false;
    }

    return campos.some((campo) => campo
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .some((palavra) => distanciaEdicao(termo, palavra) <= tolerancia(termo)));
}

function correspondeBusca(producao, busca) {
    const termos = normalizarTexto(busca).split(' ').filter(Boolean);
    if (termos.length === 0) {
        return true;
    }

    const campos = camposDaProducao(producao);
    return termos.every((termo) => termoCorresponde(termo, campos));
}

/** Aplica todos os filtros da tela sobre a lista já carregada. */
export function filtrarProducoes(producoes, filtros) {
    return producoes.filter((producao) =>
        (!filtros.data || String(producao.data_hora || '').slice(0, 10) === filtros.data) &&
        (!filtros.status || producao.status === filtros.status) &&
        (!filtros.turno || producao.turno === filtros.turno) &&
        correspondeBusca(producao, filtros.busca)
    );
}
