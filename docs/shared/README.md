# Módulos compartilhados (`src/shared/`)

Código reaproveitado por todas as telas. Antes de escrever algo numa tela, confira se já existe aqui.

| Módulo | Para que serve | Documento |
|---|---|---|
| `layout.js` | Topo, menu lateral e rodapé das telas protegidas; também protege a página | [layout.md](layout.md) |
| `api.js` | Toda chamada à API (token, timeout e mensagens de erro) | [api.md](api.md) |
| `session.js` | Sessão do usuário (JWT), matriz de permissões, guarda de página e logout | [session.md](session.md) |
| `table.js` | Tabelas com busca, ordenação e paginação (Grid.js em português) | [table.md](table.md) |
| `calculations.js` | Totais e agrupamentos de produção, lotes, fornecedores, alertas e CO₂ | [calculations.md](calculations.md) |
| `formatters.js` | Números, pesos e datas no padrão brasileiro | [formatters.md](formatters.md) |
| `validators.js` | Contrato de validação para os formulários | [validators.md](validators.md) |
| `config.js` e `setup.js` | Leitura do `.env` e carga das bibliotecas visuais | [config-e-setup.md](config-e-setup.md) |
| `styles/style.css` | Paleta da EcoCycle e classes visuais prontas | [estilos.md](estilos.md) |

`validators.js` ainda aguarda implementação; [validators.md](validators.md) define o contrato que os formulários devem seguir. `ui.js` (avisos com SweetAlert2) e `permissions.js` também estão vazios; a matriz de permissões fica no `session.js`.

---

## Como uma tela começa

```js
import { montarLayout } from '../../shared/layout.js';   // já carrega o setup.js
import API from '../../shared/api.js';
import { totalPorMaterial } from '../../shared/calculations.js';
import { formatKg } from '../../shared/formatters.js';

// Sem sessão válida, montarLayout() redireciona ao login e devolve null.
const SESSAO = montarLayout();

if (SESSAO) {
    const producao = await API.GET('/producao');
    const totais = totalPorMaterial(producao);
    document.getElementById('total-plastico').textContent = formatKg(totais['Plástico']);
}
```

Login e páginas de erro não usam o layout: importam só `'../../shared/setup.js'`.

---

## Referência rápida

| Função | Módulo | O que faz |
|---|---|---|
| `montarLayout({ acao? })` | layout | Protege a tela (login e, com `acao`, permissão) e monta topo, menu e rodapé. Devolve a sessão ou `null`. |
| `MENU` | layout | Lista de itens do menu lateral. |
| `API.GET(url)` | api | Busca dados. |
| `API.POST(url, corpo)` | api | Cria um registro. |
| `API.PUT(url, corpo)` | api | Substitui um registro. |
| `API.PATCH(url, corpo)` | api | Altera alguns campos. |
| `API.DELETE(url)` | api | Remove um registro. |
| `requireLogin(acao?)` | session | Protege a página: sem sessão vai ao login, sem permissão vai à página 403 (o `montarLayout` já chama). |
| `can(acao, perfil?)` | session | Se o perfil (padrão: o logado) pode executar a ação. |
| `PERMISSOES` | session | Matriz de permissões do MVP: ação → perfis. |
| `getUser()` | session | `{ nome, perfil }` do usuário logado, ou `null`. |
| `getSession()` | session | `{ token, nome, perfil, exp }`, ou `null`. |
| `isLoggedIn()` | session | `true` se há sessão válida. |
| `saveSession(token)` | session | Grava a sessão após o login. |
| `logout()` | session | Encerra a sessão e volta ao login. |
| `endSession(motivo)` | session | Igual ao `logout`, com aviso na tela de login (ex.: `"expirada"`). |
| `createTable(elemento, colunas, dados, opcoes)` | table | Desenha uma tabela. |
| `updateTable(grid, dados)` | table | Troca os dados de uma tabela já desenhada. |
| `escaparHtml(texto)` | table | Protege texto da API antes de montar HTML. |
| `somar(registros, campo)` | calculations | Soma um campo numérico de uma lista. |
| `arredondar(valor, casas)` | calculations | Arredonda (2 casas por padrão). |
| `totalRecebido(lotes)` | calculations | Peso total recebido nos lotes (kg). |
| `totalProduzido(producao)` | calculations | Peso total produzido (kg). |
| `totalPorMaterial(producao)` | calculations | `{ Plástico, Metal }` em kg. |
| `producaoPorDia(producao, dias)` | calculations | Séries por dia e material, para gráficos. |
| `producaoPorMes(producao, meses)` | calculations | Séries por mês e material, para gráficos. |
| `recebidoPorFornecedor(lotes, fornecedores)` | calculations | Total recebido por fornecedor, do maior para o menor. |
| `lotesPorStatus(lotes)` | calculations | Quantidade de lotes em cada status. |
| `alertasAtivos(alertas)` | calculations | Só os alertas não resolvidos. |
| `co2Evitado(producao)` | calculations | CO₂ evitado em toneladas (total e por material). |
| `formatNumber(valor, casas)` | formatters | `1234.5` → `"1.234,5"` |
| `formatKg(valor)` | formatters | `1234.5` → `"1.234,5 kg"` |
| `formatDate(data)` | formatters | → `"20/10/2026"` |
| `formatDateTime(data)` | formatters | → `"20/10/2026 09:51"` |
| `formatDayMonth(data)` | formatters | → `"20/10"` |
| `formatMonth(anoMes)` | formatters | `"2026-10"` → `"out/2026"` |
| `API_URL`, `API_TIMEOUT` | config | Endereço da API e tempo limite, lidos do `.env`. |

---

## Fora de `shared/`, mas reaproveitável

`src/features/dashboard/charts.js` cria os gráficos do Chart.js com a paleta da EcoCycle: `createBarChart`, `createLineChart`, `createDoughnutChart` e as cores em `CORES`. Hoje só o dashboard usa. Se outra tela precisar de gráfico, o caminho é mover o arquivo para `shared/`, porque uma tela não deve importar de outra.
