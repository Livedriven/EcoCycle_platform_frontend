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

// "2026-10-24" a partir do calendário LOCAL (toISOString usaria UTC e viraria o dia à noite).
function dataLocalIso(data) {
    const dois = (n) => String(n).padStart(2, '0');
    return data.getFullYear() + '-' + dois(data.getMonth() + 1) + '-' + dois(data.getDate());
}

// Menor e maior data de entrada aceitas: de ontem até hoje (regra das 24 horas).
export function limitesDataEntrada(agora = new Date()) {
    const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
    return { min: dataLocalIso(ontem), max: dataLocalIso(agora) };
}

export function validarPeso(peso) {
    const numero = Number(peso);
    return peso !== null && String(peso).trim() !== '' && Number.isFinite(numero) && numero > 0
        ? resultado(true)
        : resultado(false, 'Informe um peso maior que zero.');
}

// Data só com o dia (AAAA-MM-DD, como o <input type="date">). A hora é a do cadastro, então
// "não anterior a 24h" equivale a "não anterior a ontem". `agora` existe para os testes.
export function validarDataEntrada(data, agora = new Date()) {
    const texto = String(data ?? '').trim();
    const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const real = partes && new Date(+partes[1], +partes[2] - 1, +partes[3]);
    const existe = real && real.getFullYear() === +partes[1] && real.getMonth() === +partes[2] - 1 && real.getDate() === +partes[3];
    if (!existe) return resultado(false, 'Informe uma data de entrada válida.');

    const { min, max } = limitesDataEntrada(agora);
    if (texto < min) return resultado(false, 'A data de entrada não pode ser anterior a ontem.');
    if (texto > max) return resultado(false, 'A data de entrada não pode ser futura.');
    return resultado(true);
}

// Código do lote: coluna CHAR(15) UNIQUE no banco. Aqui só obrigatório e com no máximo 15 caracteres;
// não há regra de formato (varia por empresa). A unicidade só o backend garante.
export const TAMANHO_MAXIMO_CODIGO_LOTE = 15;

// Chaves de `erros` = nomes do payload enviado à API (POST /lotes).
export function validarLote(dados, { agora = new Date() } = {}) {
    const erros = {};

    // O código varia de empresa para empresa: sem regra de formato, só obrigatório e com limite de tamanho.
    const codigoObrigatorio = validarObrigatorio(dados.codigo_lote, 'Código do lote');
    if (!codigoObrigatorio.valido) erros.codigo_lote = codigoObrigatorio.mensagem;
    else {
        const codigo = validarTexto(dados.codigo_lote, 'Código do lote', 1, TAMANHO_MAXIMO_CODIGO_LOTE);
        if (!codigo.valido) erros.codigo_lote = codigo.mensagem;
    }

    const fornecedor = validarObrigatorio(dados.id_fornecedor, 'Fornecedor');
    if (!fornecedor.valido) erros.id_fornecedor = fornecedor.mensagem;

    const peso = validarPeso(dados.pesoentrada_kg);
    if (!peso.valido) erros.pesoentrada_kg = peso.mensagem;
    else {
        const numero = Number(dados.pesoentrada_kg);
        if (numero > 99999999.99 || Math.abs(numero * 100 - Math.round(numero * 100)) > 0.000001) {
            erros.pesoentrada_kg = 'Informe um peso de até 99999999,99 kg, com no máximo duas casas decimais.';
        }
    }

    const obrigatoria = validarObrigatorio(dados.data_entrada, 'Data de entrada');
    if (!obrigatoria.valido) erros.data_entrada = obrigatoria.mensagem;
    else {
        const data = validarDataEntrada(dados.data_entrada, agora);
        if (!data.valido) erros.data_entrada = data.mensagem;
    }

    return { valido: Object.keys(erros).length === 0, erros };
}
