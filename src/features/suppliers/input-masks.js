import { formatCnpj, formatTelefone } from '../../shared/formatters.js';
import { formatarCep } from './cep.js';

export function mascararCnpj(valor) {
    const digitos = valor.replace(/\D/g, '').slice(0, 14);
    if (digitos.length === 14) return formatCnpj(digitos);
    return digitos
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2')
        .replace(/(\/\d{4})(\d)/, '$1-$2');
}

export function mascararTelefone(valor) {
    const digitos = valor.replace(/\D/g, '').slice(0, 11);
    if (digitos.length >= 10) return formatTelefone(digitos);
    if (!digitos) return '';
    if (digitos.length <= 2) return '(' + digitos;
    return '(' + digitos.slice(0, 2) + ') ' + digitos.slice(2)
        .replace(/^(\d{4})(\d)/, '$1-$2');
}

export function aplicarMascara(campo, formatar) {
    // Ao apagar um separador, inclui também o dígito vizinho na exclusão.
    campo.addEventListener('beforeinput', (evento) => {
        const { selectionStart: inicio, selectionEnd: fim, value: valor } = campo;
        if (inicio !== fim) return;
        if (evento.inputType === 'deleteContentBackward') {
            let posicao = inicio;
            while (posicao > 0 && /\D/.test(valor[posicao - 1])) posicao--;
            if (posicao < inicio) campo.setSelectionRange(Math.max(0, posicao - 1), inicio);
        } else if (evento.inputType === 'deleteContentForward') {
            let posicao = inicio;
            while (posicao < valor.length && /\D/.test(valor[posicao])) posicao++;
            if (posicao > inicio) campo.setSelectionRange(inicio, Math.min(valor.length, posicao + 1));
        }
    });

    campo.addEventListener('input', () => {
        const valor = campo.value;
        const cursor = campo.selectionStart;
        const digitosAntes = valor.slice(0, cursor).replace(/\D/g, '').length;
        const formatado = formatar(valor);
        if (valor === formatado) return;
        campo.value = formatado;

        // Mantém a edição no mesmo ponto, inclusive ao colar ou editar no meio.
        let posicao = 0;
        let encontrados = 0;
        while (posicao < formatado.length && encontrados < digitosAntes) {
            if (/\d/.test(formatado[posicao])) encontrados++;
            posicao++;
        }
        if (cursor === valor.length) posicao = formatado.length;
        campo.setSelectionRange(posicao, posicao);
    });
}

export function aplicarMascarasFornecedor({ cnpj, telefone, cep }) {
    aplicarMascara(cnpj, mascararCnpj);
    aplicarMascara(telefone, mascararTelefone);
    aplicarMascara(cep, formatarCep);
}
