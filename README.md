 3# Arquitetura do Front-end — EcoCycle

Equipe 1 — Front-end Web · Portal web (requisitos RF01 a RF13) · Equipe de 5 pessoas

---

## 1. Visão geral

O front-end é organizado **por funcionalidades**. Existem duas áreas:

- `features/`: uma pasta por tela, cada uma com um dono.
- `shared/`: o que várias telas usam (API, sessão, validação, cálculos, tabelas, avisos etc.).

O front-end conversa **somente com a API** (Equipe 2). Enquanto a API não está pronta, as telas usam **mocks** (dados de teste servidos pelo json-server). Na integração, só muda a URL no arquivo `.env`.

A API entrega os **registros**; o **front-end calcula os valores totais** (dashboard, produção e materiais), sempre pelo `shared/calculations.js`.

```
Usuário → Portal web (Equipe 1) → API (Equipe 2) → Banco de dados (Equipe 3)
                                      ↑
                          Middleware (Equipe 4) ← sensores
```

---

## 2. Tecnologias

| Tecnologia | Para que serve | Onde aparece | Regra de uso |
|---|---|---|---|
| **Vite** | Servidor de desenvolvimento, leitura do `.env` e geração da versão final | `vite.config.js`, `package.json` | `npm run dev` |
| **HTML + JavaScript** | Estrutura e comportamento das telas | `features/` | Módulos ES (`import` / `export`) |
| **Bootstrap** | Layout e componentes prontos (formulário, modal, navbar) | `shared/setup.js`, `shared/style.css` | Usar as classes dele antes de criar CSS |
| **Bootstrap Icons** | Ícones | `shared/setup.js` | Em botões, menus e badges |
| **Chart.js** | Gráficos do dashboard (RF13) | `features/dashboard/charts.js` | Só o dashboard configura |
| **Day.js** | Manipulação e formatação de datas | `shared/formatters.js` | Sempre pelo `formatters.js` |
| **Grid.js** | Tabelas com busca, ordenação e paginação | `shared/table.js` | Sempre pelo `table.js` |
| **SweetAlert2** | Avisos, confirmações e carregamento | `shared/ui.js` | Sempre pelo `ui.js` |
| **json-server** | API de teste (mocks) | `mocks/` | `npm run mock` |
| **Vitest** | Testes automáticos das funções puras | `*.test.js` ao lado do código | `npm test` |
| **ESLint** | Aponta erros e padroniza o código | `eslint.config.js` | `npm run lint` antes de cada pull request |

---

## 3. Estrutura de pastas

```
ecocycle-frontend/
├── index.html                    # redireciona para login ou dashboard
├── package.json
├── vite.config.js                # páginas do projeto e configuração do Vitest
├── eslint.config.js
├── .env                          # não vai para o Git
├── .env.example                  # modelo, vai para o Git
├── .gitignore
├── README.md
├── docs/
│   ├── api-contract.md           # endpoints e campos dos JSON
│   ├── permissoes.md             # matriz perfil × tela (RF03)
│   └── regras-de-calculo.md      # fórmulas dos totais, unidades e arredondamento
├── mocks/
│   ├── db.json                   # dados de teste
│   └── routes.json               # faz o mock responder em /api/...
├── public/
│   └── img/
│
├── shared/
│   ├── setup.js                  # importa Bootstrap, Bootstrap Icons, Grid.js e estilos uma única vez
│   ├── style.css                 # tema da EcoCycle
│   ├── config.js                 # lê o .env
│   ├── api.js                    # funções de Fetch com tratamento de erro
│   ├── session.js                # sessão (token, nome, perfil) e proteção de página
│   ├── permissions.js            # matriz de permissões e can()
│   ├── permissions.test.js
│   ├── layout.js                 # navbar, sidebar e rodapé
│   ├── validators.js             # regras de validação de formulário
│   ├── validators.test.js
│   ├── formatters.js             # datas (Day.js) e números no padrão brasileiro
│   ├── formatters.test.js
│   ├── calculations.js           # totais por período, por material e por mês
│   ├── calculations.test.js
│   ├── table.js                  # cria tabelas com Grid.js já em português
│   └── ui.js                     # avisos, confirmações e carregamento (SweetAlert2) e badges
│
└── features/
    ├── login/
    │   ├── login.html
    │   ├── login.js
    │   └── mock-users.js         # 4 usuários de teste, removido na integração
    |
    ├── dashboard/
    │   ├── dashboard.html
    │   ├── dashboard.js
    │   ├── dashboard.css
    │   └── charts.js             # createLineChart e createBarChart (Chart.js)
    |
    ├── production/
    │   ├── production.html
    │   └── production.js
    |
    ├── batches/
    │   ├── batches.html          # listagem e detalhes
    │   └── batches.js
    |
    ├── materials/
    │   ├── materials.html
    │   └── materials.js
    |
    ├── alerts/
    │   ├── alerts.html
    │   └── alerts.js
    |
    ├── equipment/
    │   ├── equipment.html
    │   └── equipment.js
    |
    ├── conveyor/
    │   ├── conveyor.html
    │   └── conveyor.js
    |
    └── errors/
        ├── 403.html
        ├── 404.html
        └── unavailable.html
```

---

## 4. Regras da arquitetura

1. Cada pessoa trabalha na pasta da sua funcionalidade.
2. O que duas telas usam vai para `shared/`.
3. Uma funcionalidade **nunca importa** outra; importa só de `shared/`.
4. Tabela usa `table.js`, aviso e confirmação usam `ui.js`, data e número usam `formatters.js`, **totais usam `calculations.js`**. Ninguém configura essas bibliotecas nem soma valores direto na tela.
5. Toda função nova em `shared/` que não mexe na tela ganha um teste.
6. Mudou algo em `shared/`? Avisar o grupo.
7. Criou uma página nova? Acrescentar uma linha no `vite.config.js`.

---

## 5. A pasta `shared/`

### Famílias e responsabilidades

| Família | Arquivos | O que faz | Dono |
|---|---|---|---|
| Configuração | `setup.js`, `config.js`, `style.css` | Carrega visual e bibliotecas uma única vez; lê a URL da API do `.env`; guarda o tema da EcoCycle | P1 |
| Comunicação com a API | `api.js` | Toda chamada à API passa por aqui: adiciona o token, controla o tempo de espera e entrega o erro padronizado | P1 |
| Acesso e permissões | `session.js`, `permissions.js` | Guarda quem está logado, bloqueia páginas sem login e define o que cada perfil pode ver e fazer | P2 |
| Interface | `layout.js`, `table.js`, `ui.js` | Navbar, sidebar e rodapé; tabela padrão; avisos, confirmações, carregamento e badges de status | P1 |
| Dados | `validators.js`, `formatters.js` | Validação de formulários; datas e números no padrão brasileiro | P1 |
| Cálculos | `calculations.js` | Único lugar onde os totais são calculados, para dashboard, produção e materiais mostrarem sempre o mesmo número | P3 |

### Exemplos de uso (ilustrativos)

| Arquivo | Exemplo |
|---|---|
| `setup.js` | `import "../../shared/setup.js";` |
| `api.js` | `const lotes = await get("/lotes");` |
| `layout.js` | `renderLayout();` |
| `session.js` | `requireLogin();` |
| `permissions.js` | `if (can("users.edit")) { ... }` |
| `table.js` | `createTable(elemento, colunas, dados);` |
| `ui.js` | `showError("Falha ao carregar");` |
| `validators.js` | `validateForm(form, regras);` |
| `formatters.js` | `formatDate(data);` |
| `calculations.js` | `totalByPeriod(registros, inicio, fim);` |

### O que o `setup.js` importa

```js
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "gridjs/dist/theme/mermaid.min.css";
import "./style.css";      // por último, para o tema da EcoCycle sobrepor o Bootstrap
import "bootstrap";        // JavaScript: modais e menu responsivo
```

Chart.js, Day.js e SweetAlert2 **não** entram no `setup.js`: ficam em `charts.js`, `formatters.js` e `ui.js`, porque só algumas telas os usam.

---

## 6. A pasta `features/`

| Pasta | Telas | Endpoint | Requisito | Dono |
|---|---|---|---|---|
| `login` | Login | autenticação (a definir) | RF01 | P2 |
| `users` | Listar, cadastrar e editar usuários (só administrador) | a definir com a Equipe 2 | RF10 | P2 |
| `dashboard` | Indicadores, gráficos, widgets de esteira e alertas | `/api/producao`, `/api/alertas` e esteira | RF04, RF13 | P3 |
| `production` | Produção diária com filtro por data e total do período | `/api/producao` | RF05 | P4 |
| `batches` | Listagem, detalhes e cadastro de lotes | `/api/lotes` | RF06, RF07 | P4 |
| `materials` | Materiais separados (totais de plástico e de metal) | `/api/materiais` | RF08 | P5 |
| `alerts` | Alertas ativos e histórico | `/api/alertas` | RF09 | P5 |
| `equipment` | Consulta de equipamentos | `/api/equipamentos` | RF11 | P5 |
| `conveyor` | Status da esteira | a definir com a Equipe 2 | RF12 | P1 |
| `errors` | Páginas 403, 404 e indisponibilidade | não usa API | disponibilidade | P1 |

Logout (RF02) e perfis de acesso (RF03) não têm pasta própria: vivem em `shared/session.js`, `shared/permissions.js` e no botão de sair do `layout.js`.

---

## 7. Como toda tela começa

Exemplo ilustrativo (o código real será criado pela equipe):

```js
import "../../shared/setup.js";
import { requireLogin } from "../../shared/session.js";
import { renderLayout } from "../../shared/layout.js";

requireLogin();   // sem login, volta ao login
renderLayout();   // navbar, sidebar, rodapé

// depois: buscar dados (api.js), calcular totais (calculations.js),
// montar a tela (table.js, ui.js, formatters.js) e tratar eventos
```

Login e páginas de erro importam apenas o `setup.js`.

---

## 8. Regras de cálculo dos totais

O front-end calcula os totais a partir dos registros que a API devolve. O `calculations.js` recebe listas já carregadas e devolve números: não busca dados nem mexe na tela.

- **Funções:** totais por período, totais por material e produção agrupada por mês, usadas por dashboard (RF04, RF13), produção (RF05) e materiais (RF08).
- **Fórmulas:** definidas em `docs/regras-de-calculo.md` (qual campo soma, qual período, quais registros entram) e confirmadas com o professor e a Equipe 5, porque o ERP também gera relatórios de produção (RF44) e os números não podem divergir.
- **Unidades:** a conversão (por exemplo, quilos para toneladas) acontece só no `calculations.js`.
- **Arredondamento:** somas com decimais são arredondadas na saída, com o número de casas definido em `regras-de-calculo.md`.
- **Dados completos:** a soma só está certa se o front-end recebe **todos** os registros do período. Respostas paginadas pela API deixariam o total errado.
- **Datas:** o `calculations.js` usa as funções do `formatters.js`; o Day.js continua só ali.
- **Testes:** `calculations.test.js` cobre lista vazia, valores decimais, período sem dados e unidades diferentes.
- **Mocks:** o `db.json` inclui registros com decimais, período vazio e dias sem produção para testar as somas.

---

## 9. Configuração do projeto

### Instalação

```
npm install bootstrap bootstrap-icons chart.js dayjs gridjs sweetalert2
npm install -D vite vitest eslint json-server
```

### Scripts do `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "mock": "json-server --watch mocks/db.json --routes mocks/routes.json --port 3000",
    "test": "vitest",
    "lint": "eslint ."
  }
}
```

### `.env`

```
VITE_API_URL=http://localhost:3000/api
VITE_API_TIMEOUT=8000
```

- O nome da variável precisa começar com `VITE_`.
- Depois de mudar o `.env`, reiniciar o servidor.
- Cada pessoa cria o seu `.env` a partir do `.env.example`.
- Tudo o que está no `.env` do front-end fica visível no navegador: nunca colocar senha ou chave secreta.

### `shared/config.js` (ilustrativo)

```js
export const API_URL = import.meta.env.VITE_API_URL;
export const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 8000;

if (!API_URL) {
  throw new Error("VITE_API_URL não definida no arquivo .env");
}
```

### `mocks/routes.json`

Faz o mock responder em `/api/...`, igual à API real:

```json
{ "/api/*": "/$1" }
```

O json-server mudou bastante entre versões e esse formato vale para a linha 0.17. Fixar a versão no `package.json` e confirmar o comportamento antes de o time escrever as chamadas.

### `vite.config.js` (ilustrativo)

Uma entrada por página HTML para a versão final do projeto:

```js
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "features/login/login.html"),
        dashboard: resolve(__dirname, "features/dashboard/dashboard.html"),
        // uma linha por página
      },
    },
  },
});
```

---

## 10. Testes e qualidade

- **Vitest:** testes ficam ao lado do código (`nome.test.js`). A primeira leva cobre `validators`, `formatters`, `permissions` e `calculations`, que são funções puras.
- **ESLint:** rodar `npm run lint` antes de cada pull request.
- **Definição de pronto:**
  1. Cumpre o requisito do card.
  2. Tem validação onde há formulário.
  3. Trata erro da API e mostra mensagem clara.
  4. Respeita as permissões do perfil.
  5. Totais calculados pelo `calculations.js` e conferidos com os dados do mock.
  6. Funciona em celular, tablet e desktop.
  7. Passou no lint e nos testes.
  8. Foi revisada por outra pessoa.

---

## 11. Alinhamentos pendentes

**Com a Equipe 2 (API)**
1. Endpoint de usuários (RF10).
2. Origem do status da esteira (RF12 e dashboard).
3. Filtro por período nos endpoints `/api/producao`, `/api/lotes` e `/api/materiais`, e se devolvem todos os registros do filtro ou fazem paginação.
4. Unidade dos pesos (kg ou t) e nomes dos campos.
5. Formato da resposta do login (token, nome, perfil, expiração).
6. Campo que diferencia alerta ativo de histórico.

**Com a Equipe 5 e o professor**
7. Matriz de permissões dos 4 perfis (Administrador, Gerente, Operador, Consulta).
8. Fórmulas dos totais (toneladas processadas, plástico recuperado, metal recuperado).
