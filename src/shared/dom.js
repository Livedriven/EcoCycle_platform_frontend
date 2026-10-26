// Cria a estrutura visual sem interpretar textos como HTML.
export function criarElemento(tag, classe = '', texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = String(texto ?? '');
    return elemento;
}

export function criarIcone(classe) {
    const icone = criarElemento('i', classe);
    icone.setAttribute('aria-hidden', 'true');
    return icone;
}

export function criarSpinner(texto, classe = 'spinner-border text-primary') {
    const spinner = criarElemento('div', classe);
    spinner.setAttribute('role', 'status');
    if (texto !== undefined) spinner.append(criarElemento('span', 'visually-hidden', texto));
    return spinner;
}
