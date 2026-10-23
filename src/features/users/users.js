import { montarLayout } from '../../shared/layout.js';

// Gerenciar usuários está fora do MVP: com a lista vazia em PERMISSOES
// (session.js), todo perfil vai para a página 403 até a regra mudar.
const SESSAO = montarLayout({ acao: 'usuarios.gerenciar' });

if (SESSAO) {
    // código da tela
}
