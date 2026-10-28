# layout.js

Monta o layout comum de todas as telas protegidas: **topo** (nome do sistema, usuário logado e botão **Sair**), **menu lateral** e **rodapé**. Também é a porta de entrada da tela: confere a sessão antes de desenhar qualquer coisa.

Login e páginas de erro **não** usam este arquivo.

O grupo **Equipamentos** reúne **Esteiras** (`conveyor/conveyor.html`, busca e detalhes em modal)
e **Status das esteiras** (`conveyor/conveyor-status.html`, visão geral e monitoramento individual).
As duas consultas estão disponíveis para todos os perfis autenticados.

---

## `montarLayout()`

```js
import { montarLayout } from '../../shared/layout.js';

const SESSAO = montarLayout();

if (SESSAO) {
    // código da tela
}
```

Tela que só alguns perfis podem abrir: informe a ação de `PERMISSOES` (veja [session.md](session.md#permissões)).

```js
const SESSAO = montarLayout({ acao: 'lote.registrar' });   // consulta vai para a página 403
```

O que faz, nesta ordem:

1. Chama `requireLogin(acao)` (de `session.js`). Sem sessão válida, redireciona ao login; sem permissão para a `acao`, vai para a página 403. Nos dois casos devolve `null`.
2. Escreve o topo em `#app-topo`.
3. Escreve o menu em `#app-menu`, só com os itens que o perfil do usuário pode ver.
4. Acrescenta o rodapé no fim de `.conteudo-pagina`.
5. Liga o botão que abre e fecha o menu.
6. Aplica a visibilidade dos elementos com `data-permissao` usando [permissions.js](permissions.md).

**Devolve** a sessão `{ token, nome, perfil, exp }`, ou `null` se redirecionou.

Como o `layout.js` já importa o `setup.js`, a tela não precisa importá-lo de novo.

### HTML que a tela precisa ter

```html
<body>
  <!-- topo, menu lateral e rodapé são preenchidos pelo layout.js -->
  <div id="app-topo"></div>
  <div class="app-corpo">
    <nav id="app-menu" class="menu" aria-label="Menu principal"></nav>
    <main class="conteudo-pagina">
      <h1 class="h4 mb-3">Título da tela</h1>
      <!-- conteúdo da tela -->
    </main>
  </div>
  <script type="module" src="nome-da-tela.js"></script>
</body>
```

O rodapé não precisa de nada no HTML.

---

## `MENU`

Lista que define o menu lateral. Para uma tela nova aparecer no menu, basta acrescentar um item.

| Campo | Para que serve |
|---|---|
| `rotulo` | Texto do item. |
| `icone` | Só no primeiro nível: nome do [Bootstrap Icons](https://icons.getbootstrap.com/) sem o `bi-` (ex.: `'bell-fill'`). |
| `href` | Caminho da tela. `null` = tela ainda não pronta: o item aparece apagado, sem clique, com a dica "Em breve". |
| `filhos` | Lista de subitens. O item vira um grupo que abre e fecha. Aceita até dois níveis de grupo. |
| `acao` | Opcional. Chave de `PERMISSOES` (em `session.js`): só quem pode executar a ação vê o item. Um grupo some se o perfil não puder ver nenhum filho. |

```js
{ rotulo: 'Alertas', icone: 'bell-fill', href: '/src/features/alerts/alerts.html' },
{
    rotulo: 'Equipamentos', icone: 'wrench-adjustable', filhos: [
        { rotulo: 'Esteiras', href: '/src/features/conveyor/conveyor.html' },
        { rotulo: 'Status das esteiras', href: '/src/features/conveyor/conveyor-status.html' }
    ]
},
{ rotulo: 'Cadastrar lote', href: '/src/features/batches/novo-lote.html', acao: 'lote.registrar' }
```

- O item da página atual fica destacado em verde, e o grupo que o contém já carrega aberto.
- `acao` só **esconde** o item do menu. Para barrar quem digita o endereço direto, a tela também precisa chamar `montarLayout({ acao })` com a mesma ação. A proteção dos dados continua sendo da API, que responde `403`.
- "Usuários" usa `usuarios.gerenciar`, que está fora do MVP: o item não aparece para ninguém e a tela manda todos para a página 403.

---

## Botão de abrir e fechar o menu

O botão de janelinha, à esquerda do nome no topo, funciona em qualquer tamanho de tela:

| Tela | Comportamento |
|---|---|
| **Grande** (768px ou mais) | O menu fica ao lado do conteúdo e começa aberto. O botão recolhe o menu para a esquerda e o conteúdo ocupa o espaço. A escolha fica salva no `localStorage` (chave `menu-recolhido`). |
| **Celular** (abaixo de 768px) | O menu começa fechado e desliza por cima do conteúdo, com fundo escuro. Fecha pelo botão, clicando no fundo ou com **Esc**. |

O ícone, o `aria-expanded` e o `aria-label` ("Abrir menu" / "Fechar menu") acompanham o estado. Ao fechar, o foco volta para o botão se estava dentro do menu.

---

## Botão Sair

1. Chama `API.POST('/logout')`, para a API recusar o token daqui em diante.
2. Chama `logout()` (de `session.js`), que apaga o token e volta ao login.

Se a API não responder, a sessão é encerrada no navegador do mesmo jeito.

---

## Estilos

As classes do layout ficam em `styles/style.css`: `.topo`, `.menu`, `.menu-link`, `.menu-sub`, `.conteudo-pagina`, `.rodape` e as variáveis `--altura-topo` (64px) e `--largura-menu` (250px). Se mudar a altura do topo, ajuste `--altura-topo` junto, porque o menu do celular começa logo abaixo dele.
