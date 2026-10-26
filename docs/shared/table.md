# table.js

Único lugar do projeto que configura o **Grid.js**. As telas só chamam `createTable()` e recebem uma tabela em português, com busca, ordenação e paginação.

```js
import { createTable, updateTable, h } from '../../shared/table.js';
```

O `table.js` só desenha. Buscar os dados (`api.js`), somar (`calculations.js`) e mostrar carregando/erro/vazio (bloco `.estado`) ficam com a tela.

---

## `createTable(elemento, colunas, dados, opcoes)`

Desenha a tabela dentro de `elemento` e devolve a instância do Grid.js (guarde-a para usar no `updateTable`).

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `elemento` | Elemento ou seletor CSS | Onde a tabela entra. O conteúdo anterior é apagado. |
| `colunas` | lista | Veja os tipos de coluna abaixo. |
| `dados` | lista de objetos | Registros já carregados pela tela. |
| `opcoes` | objeto (opcional) | `busca` (padrão `true`), `ordenar` (padrão `true`), `porPagina` (padrão `10`; `0` desliga a paginação). |

Lança erro com mensagem clara se o elemento não existir, se não houver colunas ou se `dados` não for uma lista.

### Tipos de coluna

| Tipo | Exemplo |
|---|---|
| Comum | `{ id: 'nome_fornecedor', label: 'Fornecedor' }` |
| Com formatação | `{ id: 'data_entrada', label: 'Data', formatar: (valor) => formatDate(valor) }` — a ordenação usa o valor original. |
| Com elementos | `{ id: 'status', label: 'Status', formatar: (valor) => h('span', { className: 'badge b-info' }, String(valor ?? '')) }` |
| De ações | `{ label: 'Ações', acoes: [{ texto: 'Detalhes', icone: 'eye', aoClicar: (linha) => abrir(linha.id) }] }` |
| Sem ordenação | `{ id: 'obs', label: 'Obs.', ordenavel: false }` |

Toda coluna precisa de `label`; toda coluna que não seja de ações precisa de `id` (o nome do campo no objeto).

**Ações** (`acoes`): cada uma tem `texto`, e opcionalmente `icone` (Bootstrap Icons sem o `bi-`), `classe` (padrão `btn-outline-secondary`) e `visivel(linha)` para mostrar o botão só em algumas linhas. `aoClicar` recebe o registro inteiro da linha. A busca ignora a coluna de ações.

> Use strings para texto e `h()` para badges e ícones. Strings filhas de `h()` são tratadas como texto, sem interpretar HTML. A opção `html` foi removida; use `formatar` para retornar texto ou elementos.

---

## `updateTable(grid, dados)`

Troca os dados de uma tabela que já está na tela, sem recriá-la. Use depois de um filtro ou de salvar um registro novo.

```js
const grid = createTable('#tabela-lotes', colunas, lotes);
// ...
updateTable(grid, lotesFiltrados);
```

---

## `h(tag, atributos, ...filhos)`

Cria elementos virtuais do Grid.js, preservando as tags e classes da célula sem montar strings de HTML. Passe dados da API como filhos de texto, nunca como HTML ou atributos de eventos.

```js
h('span', { className: 'badge b-info' }, '<b>Lote</b>'); // exibe o texto literal
```

---

## Exemplo completo

```js
import API from '../../shared/api.js';
import { createTable } from '../../shared/table.js';
import { formatDate, formatKg } from '../../shared/formatters.js';

const lotes = await API.GET('/lotes');

createTable('#bloco-lotes .conteudo', [
    { id: 'id', label: 'Lote' },
    { id: 'data_entrada', label: 'Entrada', formatar: formatDate },
    { id: 'pesoentrada_kg', label: 'Peso', formatar: formatKg },
    { id: 'status', label: 'Status' },
    { label: 'Ações', acoes: [{ texto: 'Detalhes', icone: 'eye', aoClicar: (lote) => mostrarDetalhe(lote) }] }
], lotes, { porPagina: 15 });
```
