function resultado(valido, mensagem = '') {
    return { valido, mensagem };
}

export function validarObrigatorio(valor, rotulo) {
    const vazio = valor === null || valor === undefined || String(valor).trim() === '';
    return vazio ? resultado(false, rotulo + ' é obrigatório.') : resultado(true);
}

export function validarOpcao(valor, opcoes, rotulo) {
    return opcoes.map(String).includes(String(valor))
        ? resultado(true)
        : resultado(false, 'Selecione ' + rotulo + ' válido.');
}

// Chaves de `erros` = nomes do payload enviado à API.
export function validarProducao(dados, { turnos = [] } = {}) {
    const erros = {};

    const lote = validarObrigatorio(dados.id_lote, 'Lote');
    if (!lote.valido) erros.id_lote = lote.mensagem;

    const esteira = validarObrigatorio(dados.id_esteira, 'Esteira');
    if (!esteira.valido) erros.id_esteira = esteira.mensagem;

    const turno = validarObrigatorio(dados.turno_producao, 'Turno');
    if (!turno.valido) erros.turno_producao = turno.mensagem;
    else {
        const opcao = validarOpcao(dados.turno_producao, turnos, 'um turno');
        if (!opcao.valido) erros.turno_producao = opcao.mensagem;
    }

    return { valido: Object.keys(erros).length === 0, erros };
}

export function validarTexto(valor, rotulo, minimo, maximo) {
    const texto = String(valor ?? '').trim();
    if (texto.length < minimo) {
        return resultado(false, rotulo + ' deve ter pelo menos ' + minimo + ' caracteres.');
    }
    if (texto.length > maximo) {
        return resultado(false, rotulo + ' deve ter no máximo ' + maximo + ' caracteres.');
    }
    return resultado(true);
}

// Aceita com ou sem máscara (12.345.678/0001-95 ou 12345678000195).
export function validarCnpj(cnpj) {
    const digitos = String(cnpj ?? '').replace(/\D/g, '');
    const invalido = resultado(false, 'Informe um CNPJ válido.');
    if (digitos.length !== 14 || /^(\d)\1+$/.test(digitos)) return invalido;

    const dv = (base) => {
        const pesos = base.length === 12
            ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
            : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const soma = [...base].reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };
    const d1 = dv(digitos.slice(0, 12));
    const d2 = dv(digitos.slice(0, 12) + d1);
    return d1 === Number(digitos[12]) && d2 === Number(digitos[13]) ? resultado(true) : invalido;
}

// Campo opcional: vazio é válido. Preenchido, precisa de DDD + 8 ou 9 dígitos.
export function validarTelefone(telefone) {
    const digitos = String(telefone ?? '').replace(/\D/g, '');
    if (digitos === '') return resultado(true);
    return digitos.length === 10 || digitos.length === 11
        ? resultado(true)
        : resultado(false, 'Informe o telefone com DDD (10 ou 11 dígitos).');
}

// Campo opcional: vazio é válido.
export function validarEmail(email) {
    const texto = String(email ?? '').trim();
    if (texto === '') return resultado(true);
    return texto.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)
        ? resultado(true)
        : resultado(false, 'Informe um e-mail válido.');
}

// Chaves de `erros` = nomes do payload enviado à API (POST /fornecedores).
export function validarFornecedor(dados) {
    const erros = {};

    const nomeObrigatorio = validarObrigatorio(dados.nome_fornecedor, 'Nome do fornecedor');
    if (!nomeObrigatorio.valido) erros.nome_fornecedor = nomeObrigatorio.mensagem;
    else {
        const nome = validarTexto(dados.nome_fornecedor, 'Nome do fornecedor', 2, 80);
        if (!nome.valido) erros.nome_fornecedor = nome.mensagem;
    }

    const cnpjObrigatorio = validarObrigatorio(dados.cnpj_fornecedor, 'CNPJ');
    if (!cnpjObrigatorio.valido) erros.cnpj_fornecedor = cnpjObrigatorio.mensagem;
    else {
        const cnpj = validarCnpj(dados.cnpj_fornecedor);
        if (!cnpj.valido) erros.cnpj_fornecedor = cnpj.mensagem;
    }

    const telefone = validarTelefone(dados.telefone_fornecedor);
    if (!telefone.valido) erros.telefone_fornecedor = telefone.mensagem;

    const email = validarEmail(dados.email_fornecedor);
    if (!email.valido) erros.email_fornecedor = email.mensagem;

    // Endereço é opcional; se preenchido, limite de tamanho.
    if (String(dados.endereco_fornecedor ?? '').trim() !== '') {
        const endereco = validarTexto(dados.endereco_fornecedor, 'Endereço', 5, 200);
        if (!endereco.valido) erros.endereco_fornecedor = endereco.mensagem;
    }

    return { valido: Object.keys(erros).length === 0, erros };
}