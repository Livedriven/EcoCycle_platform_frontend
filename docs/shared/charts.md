# charts.js

Configuração única do Chart.js, antes localizada no dashboard. As telas importam de `src/shared/charts.js`, respeitando a separação entre funcionalidades.

| Exportação | Uso |
|---|---|
| `CORES` | Cores de Plástico, Metal, Alumínio e Rejeito, além das cores de status. |
| `createBarChart(canvas, rotulos, datasets, opcoes)` | Barras simples, horizontais ou empilhadas. |
| `createLineChart(canvas, rotulos, datasets, opcoes)` | Séries em linhas. |
| `createDoughnutChart(canvas, fatias)` | Distribuição em rosca. Cada fatia tem `{ rotulo, valor, cor }`. |

Todas retornam a instância do gráfico, adaptam-se ao contêiner e destroem a instância anterior do mesmo canvas antes de desenhar novamente. O canvas deve estar visível ao criar o gráfico. Para um conjunto sem peso, destrua a instância e exiba uma mensagem vazia, evitando um gráfico sem informação.

Os cálculos são feitos pelo `calculations.js`. A tela deve fornecer também uma descrição textual acessível dos valores; o gráfico não substitui o relatório em tabela.
