import { validarFornecedor } from '../../shared/validators.js';

export function validarCadastroFornecedor(dados) {
    const { erros } = validarFornecedor(dados);
    const id = Number(dados.id_fornecedor);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
        erros.id_fornecedor = 'Informe um código inteiro entre 1 e 2147483647.';
    }
    for (const [nome, rotulo] of [['telefone_fornecedor', 'Telefone'], ['email_fornecedor', 'E-mail'], ['endereco_fornecedor', 'Endereço']]) {
        if (!String(dados[nome] ?? '').trim()) erros[nome] = rotulo + ' é obrigatório.';
    }
    for (const nome of ['email_fornecedor', 'endereco_fornecedor']) {
        if (String(dados[nome] ?? '').trim().length > 100) erros[nome] = 'Informe no máximo 100 caracteres.';
    }
    return { valido: Object.keys(erros).length === 0, erros };
}

export function montarPayloadFornecedor(dados) {
    return {
        id_fornecedor: Number(dados.id_fornecedor),
        nome_fornecedor: dados.nome_fornecedor.trim(),
        cnpj: dados.cnpj_fornecedor.replace(/\D/g, ''),
        telefone_fornecedor: dados.telefone_fornecedor.replace(/\D/g, ''),
        email_fornecedor: dados.email_fornecedor.trim(),
        endereco_fornecedor: dados.endereco_fornecedor.trim(),
    };
}
