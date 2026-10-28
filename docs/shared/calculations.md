# calculations.js

**Único lugar onde os totais são calculados.** Dashboard, produção e materiais usam as mesmas funções, então mostram sempre o mesmo número.

As funções recebem listas já carregadas (pelo `api.js`) e devolvem números ou estruturas simples. Não buscam dados e não mexem na tela. Todas aceitam lista vazia, `null` ou `undefined` sem quebrar, e tratam valores inválidos como zero.

```js
import { totalPorMaterial, producaoPorDia } from '../../shared/calculations.js';
```

Testes: `src/shared/calculations.test.js`.

---

## Constantes

| Constante | Valor | Para que serve |
|---|---|---|
| `CAMPOS` | `{ pesoProducao: 'peso_kg', materialProducao: 'tipo_material', ... }` | Nomes dos campos da API. **Se a API real usar outros nomes, só aqui muda.** |
| `MATERIAIS` | `['Plástico', 'Metal']` | Padrão dos cálculos e gráficos existentes do dashboard. |
| `MATERIAIS_RELATORIO` | `['Plástico', 'Metal', 'Alumínio', 'Rejeito']` | Categorias do relatório de materiais separados. Categorias sem registros recebem zero. |
| `FATORES_CO2` | `{ Plástico: 1.5, Metal: 4.0 }` | kg de CO₂e evitados por kg reciclado. **Provisórios**, a confirmar com o professor. |

---

## Funções básicas

| Função | Exemplo |
|---|---|
| `somar(registros, campo)` | `somar([{ peso_kg: 2 }, { peso_kg: 'abc' }], 'peso_kg')` → `2` |
| `arredondar(valor, casas = 2)` | `arredondar(0.1 + 0.2)` → `0.3` |

As somas internas não são arredondadas; o arredondamento é feito só no resultado final.

---

## Totais

| Função | Recebe | Devolve |
|---|---|---|
| `totalRecebido(lotes)` | lotes | Soma de `pesoentrada_kg` (kg). |
| `totalProduzido(producao)` | produção | Soma de `peso_kg` de todos os materiais (kg). |
| `totalPorMaterial(producao, materiais = MATERIAIS)` | produção e lista opcional de categorias | Totais em kg, com `0` nas categorias sem registros. O relatório passa `MATERIAIS_RELATORIO` para incluir os quatro materiais. |
| `materiaisPorLoteDia(producao)` | produção validada | `[{ id_lote, data, plastico, metal, aluminio, rejeito }]`, em kg, agrupado por lote e dia. |
| `co2Evitado(producao)` | produção | `{ total, porMaterial: { 'Plástico', 'Metal' } }` em **toneladas** de CO₂e. |

---

## Agrupamentos (para gráficos)

### `materiaisPorLoteDia(producao)`

Soma todos os turnos e esteiras do mesmo lote e dia usando `totalPorMaterial(registros, MATERIAIS_RELATORIO)`. Sempre inclui plástico, metal, alumínio e rejeito, com zero nas categorias ausentes. Os grupos são ordenados pelo dia mais recente e, no mesmo dia, pelo lote em ordem numérica. Cada grupo é arredondado somente depois da soma. O dia usa a parte `AAAA-MM-DD` de `CAMPOS.dataProducao`, sem conversão de fuso. `CAMPOS.idLoteProducao` centraliza o nome `id_lote`.

Alumínio e rejeito não têm fatores de CO₂ definidos. Os cálculos de CO₂ existentes permanecem limitados a plástico e metal; não são inferidos fatores para as novas categorias.

A tela de materiais valida os registros antes de chamar os cálculos; a função não altera a lista recebida. Como cartões e linhas arredondam em níveis diferentes, somar valores já arredondados de várias linhas pode diferir por centésimos do total calculado sobre os registros originais.

### `producaoPorDia(producao, dias = 7, hoje = new Date())`
### `producaoPorMes(producao, meses = 6, hoje = new Date())`

Agrupam a produção dos últimos dias ou meses, incluindo o atual, por material. Períodos sem produção entram com `0`, então o gráfico não pula dias ou meses.

```js
const { chaves, series } = producaoPorDia(producao, 7);
// chaves: ['2026-10-16', ..., '2026-10-22']             (AAAA-MM-DD)
// series: { 'Plástico': [0, 0, 0, 0, 30.3, 0, 0], 'Metal': [...] }

const mensal = producaoPorMes(producao, 6);
// mensal.chaves: ['2026-05', ..., '2026-10']           (AAAA-MM)
```

`hoje` só precisa ser informado em testes. Para mostrar as chaves no gráfico, use `formatDayMonth` e `formatMonth` (de `formatters.js`).

### `recebidoPorFornecedor(lotes, fornecedores)`

`[{ nome, total }]` em kg, do maior para o menor. Lote cujo fornecedor não está cadastrado aparece com o ID do fornecedor no lugar do nome.

### `lotesPorStatus(lotes)`

`[{ status, quantidade }]`, na ordem em que os status aparecem. Lote sem status conta como `"Sem status"`.

---

## Filtros

### `alertasAtivos(alertas)`

Devolve só os alertas não resolvidos. Aceita `resolvido` como booleano ou texto (`"true"`/`"false"`).

---

## Exemplo

```js
const [lotes, producao] = await Promise.all([API.GET('/lotes'), API.GET('/producao')]);

const recebido = totalRecebido(lotes);                 // 10053.1
const { 'Plástico': plastico, 'Metal': metal } = totalPorMaterial(producao);
const co2 = co2Evitado(producao).total;                // toneladas

document.getElementById('total-recebido').textContent = formatKg(recebido);
```
