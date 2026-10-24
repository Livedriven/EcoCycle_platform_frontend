# permissions.js

`aplicarPermissoes(raiz = document)` controla a visibilidade dos elementos que
declaram `data-permissao`. Usa `can()` de `session.js`, sem duplicar a matriz.
O `montarLayout()` chama a função automaticamente após validar a sessão.

```html
<button class="btn btn-eco d-none" data-permissao="producao.operar">
  Iniciar produção
</button>
```

O elemento começa escondido para evitar aparecer antes da validação. A função
remove `d-none` quando há permissão e adiciona quando não há. Sem sessão válida,
com ação vazia ou desconhecida, o elemento fica escondido. As demais classes
são preservadas.

Para elementos criados depois do layout, aplique a função após inseri-los:

```js
import { aplicarPermissoes } from '../../shared/permissions.js';

container.append(botao);
aplicarPermissoes(container);
```

A raiz também é avaliada se tiver `data-permissao`. A função pode ser reaplicada
para atualizar a visibilidade conforme a sessão atual; não observa mudanças
automaticamente.

Use o atributo em botões e trechos cuja visibilidade depende somente da
permissão. Formulários e modais que começam fechados devem manter seu próprio
controle de abertura; aplicar a permissão ao contêiner removeria seu `d-none`
quando o perfil fosse autorizado.

As guardas de páginas continuam em `requireLogin()`/`montarLayout({ acao })`.
A API continua responsável por autorizar cada operação.
