## setup.js

Carrega, uma única vez, o visual e as bibliotecas que toda tela usa:

1. CSS e JavaScript do **Bootstrap** (o JS faz funcionar collapse, modal, dropdown etc.).
2. **Bootstrap Icons**.
3. Tema do **Grid.js** (tabelas).
4. `styles/style.css`, por último, para o tema da EcoCycle sobrepor o Bootstrap.

| Tela | Como carrega |
|---|---|
| Telas protegidas | Pelo `layout.js`, que já importa o `setup.js`. |
| Login e páginas de erro | `import '../../shared/setup.js';` direto no JS da tela. |

Chart.js, Day.js e Grid.js (JavaScript) **não** entram no `setup.js`: ficam em `charts.js`, `formatters.js` e `table.js`, porque nem toda tela usa.
