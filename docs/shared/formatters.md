# formatters.js

Formata números, pesos e datas no **padrão brasileiro**. É o único arquivo que usa o **Day.js** (já configurado em português): as telas não importam o Day.js direto.

```js
import { formatKg, formatDate } from '../../shared/formatters.js';
```

As funções só formatam para exibir. Para somar, use os números originais (e o `calculations.js`).

---

## Números

| Função | Exemplo |
|---|---|
| `formatNumber(valor, casas = 2)` | `formatNumber(1234.5)` → `"1.234,5"` · `formatNumber(2.456, 1)` → `"2,5"` · `formatNumber(null)` → `"0"` |
| `formatKg(valor)` | `formatKg(1234.5)` → `"1.234,5 kg"` |

`casas` é o **máximo** de casas decimais: zeros à direita não aparecem (`formatNumber(10)` → `"10"`).

---

## Datas

Aceitam texto no formato da API (`"2026-10-20"` ou `"2026-10-20T09:51:00"`), `Date` ou qualquer valor que o Day.js entenda.

| Função | Exemplo |
|---|---|
| `formatDate(data)` | `"2026-10-20"` → `"20/10/2026"` |
| `formatDateTime(data)` | `"2026-10-20T09:51:00"` → `"20/10/2026 09:51"` |
| `formatDayMonth(data)` | `"2026-10-20"` → `"20/10"` (eixo de gráficos diários) |
| `formatMonth(anoMes)` | `"2026-10"` → `"out/2026"` (eixo de gráficos mensais) |

---

## Uso com tabelas e gráficos

```js
// coluna de tabela (table.js)
{ id: 'data_entrada', label: 'Entrada', formatar: formatDate }

// eixo de gráfico com as chaves do calculations.js
const { chaves } = producaoPorDia(producao, 7);
const rotulos = chaves.map(formatDayMonth);

// eixo Y do Chart.js
{ formatarValor: formatNumber }
```
