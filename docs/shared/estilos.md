# styles/style.css

Tema visual da EcoCycle. É carregado pelo `setup.js` em todas as telas, depois do Bootstrap. **Use primeiro as classes do Bootstrap**; as classes abaixo complementam com a identidade da EcoCycle.

---

## Paleta (variáveis CSS)

Retirada da logo. Use as variáveis em vez de escrever as cores direto: `color: var(--eco-texto-suave)`.

| Variável | Cor | Uso |
|---|---|---|
| `--eco-azul` | `#084B60` | Cor principal: topo, títulos, botão principal. |
| `--eco-azul-escuro` | `#05384A` | Menu lateral, hover do botão principal. |
| `--eco-verde` | `#63A53C` | Item ativo do menu. |
| `--eco-verde-escuro` | `#4A8A2A` | Destaques verdes em texto. |
| `--eco-fundo` | `#F4F7F6` | Fundo das páginas. |
| `--eco-superficie` | `#FFFFFF` | Fundo dos cards. |
| `--eco-borda` | `#D5DEDB` | Bordas e divisórias. |
| `--eco-texto` | `#1F2D33` | Texto padrão. |
| `--eco-texto-suave` | `#5A6B72` | Texto secundário, legendas. |
| `--eco-sucesso` / `--eco-aviso` / `--eco-perigo` / `--eco-info` | verde / laranja / vermelho / azul | Situações e badges. |

As cores `primary`, `success`, `danger` e `warning` do Bootstrap também usam essa paleta.

| Variável de layout | Valor | Uso |
|---|---|---|
| `--altura-topo` | `64px` | Altura do topo; o menu do celular começa abaixo dele. |
| `--largura-menu` | `250px` | Largura do menu lateral em tela grande. |

---

## Classes prontas

| Classe | Para que serve |
|---|---|
| `.btn-eco` | Botão principal azul. Use junto com `.btn`: `<button class="btn btn-eco btn-sm">Salvar</button>` |
| `.card`, `.card-header` | Cards com a borda e o título azul da EcoCycle (são as classes do Bootstrap, já tematizadas). |
| `.badge` + `.b-sucesso`, `.b-aviso`, `.b-perigo`, `.b-info`, `.b-verde`, `.b-suave` | Badges de situação com texto branco: `<span class="badge b-sucesso">Ativa</span>` |
| `.grafico` | Caixa de altura fixa (280px) para um `<canvas>` do Chart.js. |
| `.table` | Tabelas do Bootstrap com cabeçalho azul e fundo transparente. |
| `.estado` | Área de carregando/erro/vazio de um bloco (veja abaixo). |

---

## Padrão de bloco: `.estado` e `.conteudo`

Toda parte da tela que depende da API tem duas áreas: `.estado` (carregando, erro ou vazio) e `.conteudo` (os dados).

```html
<div class="card shadow-sm" id="bloco-lotes">
  <div class="card-body">
    <div class="estado"></div>
    <div class="conteudo d-none"></div>
  </div>
</div>
```

- `.estado` centraliza um spinner ou uma mensagem e **some sozinho quando está vazio**.
- Enquanto carrega: escreva o spinner no `.estado` e deixe o `.conteudo` com `d-none`.
- Com dados: esvazie o `.estado` e tire o `d-none` do `.conteudo`.
- Com gráfico: mostre o `.conteudo` **antes** de desenhar, porque o Chart.js precisa medir o canvas visível.

O `dashboard.js` (funções `mostrarCarregando`, `mostrarMensagem`, `mostrarConteudo` e `montarBloco`) é a referência desse padrão.

---

## Layout

As classes do topo, do menu e do rodapé (`.topo`, `.app-corpo`, `.menu`, `.menu-link`, `.conteudo-pagina`, `.rodape` etc.) são usadas pelo `layout.js`. A tela só precisa do esqueleto HTML descrito em [layout.md](layout.md).
