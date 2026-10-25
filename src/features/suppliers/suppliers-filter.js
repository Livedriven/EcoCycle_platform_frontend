// Regras de busca, filtro e ordenação da tela de consultar fornecedores.
// Funções puras: não mexem na tela nem chamam a API (a tela carrega os dados e desenha).
const MIN_DIGITOS = 3;

// "São Paulo" -> "sao paulo" (sem acento, minúsculas, sem espaços nas pontas).
export function normalizarTexto(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function somenteDigitos(valor) {
    return String(valor ?? '').replace(/\D/g, '');
}

// Lê "Cidade/UF" ou "Cidade - UF" no fim do endereço. Devolve "Cidade/UF" ou "" se não achar.
// Ex.: "Rua A, 120 - Centro, Contagem/MG" -> "Contagem/MG" · "Av. B, 10, São Paulo - SP" -> "São Paulo/SP"
export function extrairCidade(endereco) {
    const achou = String(endereco ?? '').trim().match(/(?:^|,)\s*([^,]+?)\s*[-/]\s*([A-Z]{2})\s*$/);
    return achou ? achou[1].trim() + '/' + achou[2] : '';
}

// Cidades distintas dos endereços, em ordem alfabética.
export function opcoesDeCidade(fornecedores) {
    const cidades = new Set(fornecedores.map((f) => extrairCidade(f.endereco_fornecedor)).filter(Boolean));
    return [...cidades].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Busca por nome, CNPJ, telefone ou e-mail, sem diferenciar acento e maiúsculas.
// CNPJ e telefone comparam só os dígitos (com ou sem máscara), a partir de 3 dígitos digitados.
export function filtrarFornecedores(fornecedores, { busca = '', cidade = '' } = {}) {
    const termo = normalizarTexto(busca);
    const digitos = somenteDigitos(busca);

    return fornecedores.filter((f) => {
        if (cidade && extrairCidade(f.endereco_fornecedor) !== cidade) return false;
        if (!termo) return true;

        const porTexto = [f.nome_fornecedor, f.email_fornecedor].some((campo) => normalizarTexto(campo).includes(termo));
        const porNumero = digitos.length >= MIN_DIGITOS
            && [f.cnpj_fornecedor, f.telefone_fornecedor].some((campo) => somenteDigitos(campo).includes(digitos));
        return porTexto || porNumero;
    });
}

// Não há data de cadastro: "mais recentes" = maior id primeiro.
export function ordenarMaisRecentes(fornecedores) {
    return [...fornecedores].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

export function textoContagem(exibidos, total) {
    if (exibidos === total) {
        return total === 1 ? 'Exibindo 1 fornecedor cadastrado' : 'Exibindo ' + total + ' fornecedores cadastrados';
    }
    return 'Exibindo ' + exibidos + ' de ' + total + ' fornecedores';
}
