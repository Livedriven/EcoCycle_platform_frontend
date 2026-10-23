import { montarLayout } from '../../shared/layout.js';

// Página protegida: sem sessão válida, montarLayout() já redireciona ao login.
const SESSAO = montarLayout();

if (SESSAO) {
    // código da tela
}
