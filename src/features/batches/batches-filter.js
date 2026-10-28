// Regras da tela de consultar lotes: junção com fornecedores, busca, filtro de status,
// ordenação e textos. Funções puras: não mexem na tela nem chamam a API.

// "Metalúrgica" -> "metalurgica" (sem acento, minúsculas, sem espaços nas pontas).
export function normalizarTexto(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Acrescenta o nome do fornecedor a cada lote. Usa id_fornecedor; se o lote ainda vier com
// cnpj_fornecedor (contrato legado), tenta por ele.
export function montarLinhas(lotes, fornecedores) {
    const porId = new Map(fornecedores.map((f) => [String(f.id), f.nome_fornecedor]));
    const porCnpj = new Map(fornecedores.map((f) => [String(f.cnpj_fornecedor), f.nome_fornecedor]));
    return lotes.map((lote) => ({
        id: lote.id,
        codigo_lote: lote.codigo_lote ?? '',
        fornecedor: porId.get(String(lote.id_fornecedor)) ?? porCnpj.get(String(lote.cnpj_fornecedor)) ?? 'Fornecedor não identificado',
        pesoentrada_kg: lote.pesoentrada_kg,
        data_entrada: lote.data_entrada,
        status: lote.status
    }));
}

// Status que existem nos dados, em ordem alfabética (o wireframe mostra "Status: Todos").
export function opcoesDeStatus(linhas) {
    const status = new Set(linhas.map((l) => l.status).filter(Boolean));
    return [...status].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
}

// Busca por ID do lote, código do lote ou fornecedor, sem diferenciar acento e maiúsculas.
// Termo só com dígitos é tratado como identificador e compara o valor inteiro ("5" acha o lote 5
// ou o código "5", não o 15). Termo com letras ou símbolos acha parte do código ou do nome.
// O status filtra à parte.
export function filtrarLotes(linhas, { busca = '', status = '' } = {}) {
    const termo = normalizarTexto(busca);
    return linhas.filter((linha) => {
        if (status && linha.status !== status) return false;
        if (!termo) return true;
        const soDigitos = /^\d+$/.test(termo);
        const codigo = normalizarTexto(linha.codigo_lote);
        const porId = soDigitos && String(linha.id) === termo;
        const porCodigo = soDigitos ? codigo === termo : codigo.includes(termo);
        return porId || porCodigo || normalizarTexto(linha.fornecedor).includes(termo);
    });
}

// "Mais recentes": data de entrada decrescente; em empate, o maior id primeiro.
// export function ordenarMaisRecentes(linhas) {
//     return [...linhas].sort((a, b) => {
//         const porData = String(b.data_entrada ?? '').localeCompare(String(a.data_entrada ?? ''));
//         return porData !== 0 ? porData : (Number(b.id) || 0) - (Number(a.id) || 0);
//     });
// }

// "Mais recentes": último lote cadastrado primeiro (maior id).
// A data de entrada é informada pelo usuário (de ontem até hoje), então não serve de critério de ordem.
export function ordenarMaisRecentes(linhas) {
    return [...linhas].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

// 1450 -> "1.450,00 kg" (sempre 2 casas, como no wireframe; o formatKg tira os zeros).
export function formatarPeso(valor) {
    const numero = Number(valor);
    if (valor === null || valor === undefined || valor === '' || !Number.isFinite(numero)) return '';
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
}

// Cor do selo de situação (classes do style.css). Status desconhecido cai no cinza.
export function classeDoStatus(status) {
    const mapa = {
        recebido: 'b-sucesso',
        disponivel: 'b-sucesso',
        'em processamento': 'b-info',
        'em triagem': 'b-info',
        finalizado: 'b-suave'
    };
    return mapa[normalizarTexto(status)] ?? 'b-suave';
}

export function textoContagem(exibidos, total) {
    if (exibidos === total) {
        return total === 1 ? 'Exibindo 1 lote cadastrado' : 'Exibindo ' + total + ' lotes cadastrados';
    }
    return 'Exibindo ' + exibidos + ' de ' + total + ' lotes';
}
