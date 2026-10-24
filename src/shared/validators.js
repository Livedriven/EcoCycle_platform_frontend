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