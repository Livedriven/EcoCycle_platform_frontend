# EcoCycle — Portal Web

Portal web da **EcoCycle**, plataforma de monitoramento de uma usina de reciclagem de **plástico e metal**. Pelo navegador, a equipe da usina acompanha a produção, os lotes recebidos dos fornecedores, as esteiras de triagem e os alertas dos sensores.

Este repositório é o portal web da **Equipe 1 (E1)**, a interface de monitoramento (dashboard, leituras e alertas). Ele conversa somente com a API da plataforma (E2). Cada pessoa tem uma conta única, usada em todos os módulos.

```
Portal web (E1, este repositório) ──┐
ERP e tela de operação (E5) ────────┼──► API (E2) ──► Banco de dados (E3)
PWA de consulta móvel (E6) ─────────┤
Simulador do chão de fábrica (E4) ──┘
```

| Equipe | Responsabilidade |
|---|---|
| E1 | Interface de monitoramento (dashboard, leituras, alertas). |
| E2 | Backend/API (autenticação, autorização, regras de negócio, cálculo de estoque). |
| E3 | Banco de dados (diagrama, SQL, restrições, dados iniciais). |
| E4 | Simulador do chão de fábrica. |
| E5 | Gestão/ERP e tela de operação (fornecedores, lotes, início e finalização de produção). |
| E6 | PWA de consulta móvel. |

---

## O que o portal faz

| Tela | O que mostra |
|---|---|
| **Login** | Entrada com usuário e senha; a sessão usa um token JWT. |
| **Dashboard** | Indicadores (total recebido, processado, plástico, metal, alertas ativos), produção diária e mensal, CO₂ evitado, recebimento por fornecedor, lotes por status, status das esteiras e alertas ativos. |
| **Produção do dia** | Registros de produção com filtro por data. |
| **Materiais produzidos** | Totais de plástico e metal e a lista de materiais. |
| **Alertas** | Alertas gerados pelas leituras dos sensores. |
| **Status das esteiras** | Velocidade, temperatura e situação de cada esteira. |
| **Lotes** | Lotes recebidos dos fornecedores, com detalhes e cadastro. |
| **Usuários** | Reservada: gerenciar usuários pela interface está fora do MVP, então a tela mostra "acesso negado" para todos os perfis. |

Todas as telas, exceto login e páginas de erro, têm o mesmo layout: topo com o usuário logado e o botão **Sair**, menu lateral que abre e fecha e rodapé. O layout se adapta a celular, tablet e desktop.

### Perfis de acesso

Há quatro perfis. Todos veem os mesmos dados; a diferença está nas ações que cada um pode executar (Especificação MVP2, seção 3):

| Ação | Administrador | Gerente | Operador | Consulta |
|---|---|---|---|---|
| Login e consulta de dashboard, lotes, fornecedores, alertas e estoque | Sim | Sim | Sim | Sim |
| Cadastrar fornecedor | Sim | Sim | Não | Não |
| Registrar lote | Sim | Sim | Sim | Não |
| Iniciar e finalizar produção | Pendente* | Pendente* | Sim | Não |
| Gerenciar usuários pela interface | Fora do MVP | Fora do MVP | Fora do MVP | Fora do MVP |

\* A especificação ainda não decidiu se administrador e gerente também iniciam e finalizam produção. Até a confirmação, o portal libera só para o operador.

No portal, o menu esconde e as telas barram (página "acesso negado") o que o perfil não pode fazer. Quem garante a regra é a API: token ausente, inválido ou expirado recebe `401`, e usuário sem permissão recebe `403`.

---

## Tecnologias

- **Vite**: servidor de desenvolvimento e build, em páginas HTML separadas.
- **HTML + JavaScript** com módulos ES, sem framework.
- **Bootstrap 5** e **Bootstrap Icons**: layout, componentes e ícones.
- **Chart.js**: gráficos do dashboard.
- **Grid.js**: tabelas com busca, ordenação e paginação.
- **Day.js**: datas no padrão brasileiro.
- **jwt-decode**: leitura do token de sessão.
- **json-server** com middlewares próprios (`auth.cjs` e `rbac.cjs`): API de teste com login, logout e permissões por perfil.
- **Vitest** e **ESLint**: testes e padronização do código.

---

## Como rodar

Requer Node.js 22.12 ou mais recente (exigência do Vitest).

```bash
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:3000 e VITE_API_TIMEOUT=8000
npm run mock                  # API de teste em http://localhost:3000
npm run dev                   # abre o portal no navegador (http://localhost:5173)
```

Os usuários de teste ficam em `mocks/db.json` (`admin`, `gerente1`, `operador1`).

| Comando | O que faz |
|---|---|
| `npm run dev` | Abre o portal em modo de desenvolvimento. |
| `npm run mock` | Sobe a API de teste com os dados de `mocks/db.json`. |
| `npm test` | Roda os testes automáticos. |
| `npm run lint` | Confere o padrão do código. |
| `npm run build` | Gera a versão final em `dist/`. |

---

## Organização

```
├── index.html          # redireciona para o login ou para o dashboard
├── mocks/              # API de teste: dados, rotas, login/logout e permissões
├── public/img/         # logo
├── docs/               # documentação técnica
└── src/
    ├── features/       # uma pasta por tela (HTML + JS da tela)
    └── shared/         # código reaproveitado por todas as telas
```

---

## Documentação

- [Arquitetura do front-end](docs/arquiteture.md): regras da organização, telas e alinhamentos pendentes com as outras equipes.
- [Módulos compartilhados (`src/shared/`)](docs/shared/README.md): o que cada arquivo faz e as funções que podem ser reaproveitadas nas telas.
