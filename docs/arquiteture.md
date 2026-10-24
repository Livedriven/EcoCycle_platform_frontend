# Arquitetura do Front-end — EcoCycle

Equipe 1 — Front-end Web · Portal web (requisitos RF01 a RF13)

---

## 1. Visão geral

O front-end é organizado **por funcionalidades**:

- `src/features/`: uma pasta por tela, com o HTML e o JS dela.
- `src/shared/`: o que várias telas usam (API, sessão, layout, tabelas, cálculos, formatação e estilo). Cada módulo está documentado em [`docs/shared/`](shared/README.md).

O portal é a interface de monitoramento da **E1** (dashboard, leituras e alertas). As outras equipes cuidam da API (E2), do banco (E3), do simulador do chão de fábrica (E4), do ERP e da tela de operação (E5) e do PWA de consulta (E6).

O front-end conversa **somente com a API** (E2). Enquanto a API não está pronta, as telas usam o **mock** (`mocks/`, servido pelo json-server). Na integração, só muda a URL no `.env`.

A API entrega os **registros**; o **front-end calcula os totais** (dashboard, produção e materiais), sempre pelo `shared/calculations.js`.

---

## 2. Estrutura de pastas

```
├── index.html                    # redireciona para login ou dashboard
├── vite.config.js                # uma entrada por página HTML (build)
├── eslint.config.mjs
├── .env.example                  # modelo do .env (o .env não vai para o Git)
├── docs/
│   ├── arquiteture.md            # este arquivo
│   └── shared/                   # documentação dos módulos de src/shared
├── mocks/
│   ├── db.json                   # dados de teste
│   ├── routes.json               # faz o mock responder também em /api/...
│   ├── auth.cjs                  # POST /login (emite JWT), POST /logout (revoga) e exige o token
│   └── rbac.cjs                  # matriz de permissões do MVP (403 para o que o perfil não pode)
├── public/img/logo.png
└── src/
    ├── shared/
    │   ├── setup.js              # carrega Bootstrap, ícones, tema do Grid.js e style.css
    │   ├── config.js             # lê e valida o .env
    │   ├── api.js                # chamadas à API (token, timeout, erros)
    │   ├── session.js            # sessão JWT, matriz de permissões, guarda de página e logout
    │   ├── layout.js             # topo, menu lateral e rodapé das telas protegidas
    │   ├── table.js              # tabelas com Grid.js em português
    │   ├── calculations.js       # totais e agrupamentos dos dados
    │   ├── formatters.js         # números e datas no padrão brasileiro
    │   ├── styles/style.css      # paleta e componentes visuais da EcoCycle
    │   ├── permissions.js        # visibilidade de elementos com data-permissao, usando can() do session.js
    │   ├── validators.js         # (vazio, a implementar)
    │   ├── ui.js                 # classes de cor compartilhadas para alertas, contadores e situações
    │   └── *.test.js             # testes do Vitest ao lado do código
    └── features/
        ├── login/                # login.html, login.js, login.css
        ├── dashboard/            # dashboard.html, dashboard.js, dashboard.css, charts.js
        ├── production/           # produção diária
        ├── materials/            # materiais produzidos
        ├── alerts/               # alertas
        ├── conveyor/             # status das esteiras
        ├── batches/              # lotes
        ├── users/                # usuários
        └── errors/               # 403 (acesso negado), 404 e indisponibilidade
```

---

## 3. Regras da arquitetura

1. Cada pessoa trabalha na pasta da sua funcionalidade.
2. O que duas telas usam vai para `src/shared/`.
3. Uma funcionalidade **nunca importa** outra; importa só de `shared/`.
4. Toda chamada à API usa `api.js`; tabela usa `table.js`; data e número usam `formatters.js`; **totais usam `calculations.js`**. Ninguém chama `fetch`, configura o Grid.js ou soma valores direto na tela.
5. Toda tela protegida começa com `montarLayout()` (veja [layout.md](shared/layout.md)). Login e páginas de erro importam só o `setup.js`.
6. Permissão por perfil sai **só** da matriz `PERMISSOES` do `session.js` (veja [session.md](shared/session.md)): a tela restrita usa `montarLayout({ acao })`, o botão usa `can(acao)` e o item do menu usa `acao`. Ninguém compara o perfil "na mão".
7. Toda função nova em `shared/` que não mexe na tela ganha um teste.
8. Mudou algo em `shared/`? Avisar o grupo e atualizar o documento correspondente em `docs/shared/`.
9. Criou uma página nova? Acrescentar uma linha no `vite.config.js` e, se ela aparecer no menu, um item em `MENU` (`layout.js`).

---

## 4. Telas

| Pasta | Tela | Endpoint | Requisito |
|---|---|---|---|
| `login` | Login | `POST /login` | RF01 |
| `dashboard` | Indicadores, gráficos, esteiras e alertas | `/lotes`, `/producao`, `/fornecedores`, `/alertas`, `/esteiras` | RF04, RF13 |
| `production` | Produção diária com filtro por data | `/producao` | RF05 |
| `batches` | Listagem, detalhes e cadastro de lotes | `/lotes` | RF06, RF07 |
| `materials` | Relatório de plástico, metal, alumínio e rejeito por lote e dia, com totais, filtros e gráfico | `/producao` | RF08 |
| `alerts` | Alertas ativos e histórico | `/alertas` | RF09 |
| `users` | Reservada (gerenciar usuários está fora do MVP: todos os perfis veem "acesso negado") | `/usuarios` | RF10 |
| `conveyor` | Status das esteiras | `/esteiras` | RF12 |
| `errors` | Páginas 403, 404 e indisponibilidade | — | — |

Logout (RF02) e perfis de acesso (RF03) não têm pasta própria: vivem em `shared/session.js` (matriz `PERMISSOES`, `can` e a guarda `requireLogin`), no botão **Sair** do `layout.js` e no `mocks/rbac.cjs`.

### Matriz de permissões (Especificação MVP2, seção 3)

| Ação | Administrador | Gerente | Operador | Consulta |
|---|---|---|---|---|
| Login e consulta de dashboard, lotes, fornecedores, alertas e estoque | Sim | Sim | Sim | Sim |
| Cadastrar fornecedor | Sim | Sim | Não | Não |
| Registrar lote | Sim | Sim | Sim | Não |
| Iniciar e finalizar produção | Sim | Sim | Sim | Não |
| Gerenciar usuários pela interface | Fora do MVP | Fora do MVP | Fora do MVP | Fora do MVP |

- A matriz existe em dois lugares que precisam andar juntos: `PERMISSOES` em `src/shared/session.js` (interface) e `mocks/rbac.cjs` (mock da API).
- A interface pode esconder botões, mas a API verifica a permissão em cada operação protegida (RN12): `401` para token ausente, inválido ou expirado e `403` para usuário sem permissão.
- A API obtém o responsável pela ação a partir da identidade autenticada: o front-end **não envia** `id_usuario` no corpo das requisições.
- O simulador (E4) não é usuário humano: usa credencial de dispositivo (ex.: `X-API-KEY`) nas rotas próprias, fora do portal.

---

## 5. Regras de cálculo dos totais

- O `calculations.js` recebe listas já carregadas e devolve números: não busca dados nem mexe na tela.
- Os nomes dos campos da API ficam só em `CAMPOS`, no topo do arquivo. Se a API real usar outros nomes, só ali muda.
- Somas com decimais são arredondadas **na saída** (2 casas).
- A soma só está certa se a API devolver **todos** os registros do período. Respostas paginadas deixariam o total errado.
- Os fatores de CO₂ (`FATORES_CO2`) são **provisórios** e precisam ser confirmados com o professor.

---

## 6. Testes e qualidade

- **Vitest:** testes ficam ao lado do código (`nome.test.js`). Hoje cobrem `calculations` e `session`.
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

## 7. Alinhamentos pendentes

**Com a E2 (API)**
1. Endpoint de usuários (RF10).
2. Origem do status da esteira (RF12 e dashboard).
3. Filtro por período nos endpoints de produção, lotes e materiais, e se devolvem todos os registros do filtro ou fazem paginação.
4. Unidade dos pesos (kg ou t) e nomes dos campos.
5. Formato da resposta do login (token, nome, perfil, expiração) e do logout.
6. Campo que diferencia alerta ativo de histórico.

**Com a E5 e o professor**
7. Fórmulas dos totais e fatores de CO₂ evitado.
