import { can } from './session.js';

/**
 * Exibe ou esconde elementos com data-permissao usando a matriz de session.js.
 * Inclui a própria raiz, quando ela declara uma permissão.
 * Para conteúdo dinâmico, chame novamente após inserir os elementos.
 * Use apenas onde a visibilidade depende da permissão, não em formulários
 * ou modais que também precisam continuar fechados até uma ação do usuário.
 */
export function aplicarPermissoes(raiz = document) {
    const elementos = [...raiz.querySelectorAll('[data-permissao]')];
    if (raiz.matches?.('[data-permissao]')) elementos.unshift(raiz);

    elementos.forEach((elemento) => {
        elemento.classList.toggle('d-none', !can(elemento.dataset.permissao));
    });
}
