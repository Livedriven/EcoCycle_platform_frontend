import '../../shared/setup.js';
import './errors.css';
import { endSession, HOME_URL } from '../../shared/session.js';

document.querySelector('[data-switch-account]')?.addEventListener('click', (event) => {
    event.preventDefault();
    endSession();
});

const retry = document.querySelector('[data-retry]');
if (retry) {
    // Retoma a página de origem sem reenviar automaticamente uma operação de escrita.
    const retorno = new URLSearchParams(location.search).get('retorno');
    let destino = HOME_URL;
    if (retorno) {
        try {
            const url = new URL(retorno, location.origin);
            if (url.origin === location.origin && !url.pathname.startsWith('/src/features/errors/')) {
                destino = url.pathname + url.search + url.hash;
            }
        } catch {
            // Endereço inválido: mantém o dashboard como destino seguro.
        }
    }
    retry.href = destino;
}
