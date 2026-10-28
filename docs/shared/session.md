# session.js

Guarda quem está logado, define **o que cada perfil pode fazer** e protege as páginas. O `access_token` devolvido pelo login é salvo no `sessionStorage` (chave `token`). Os dados de autenticação ficam na chave `autenticacao`, vinculados ao mesmo token para preservar o perfil entre páginas. O `session.js` só **lê** o JWT; quem confere a assinatura é a API.

```js
import { getUser, can, logout } from '../../shared/session.js';
```

Nas telas protegidas, normalmente basta o `montarLayout()` (de `layout.js`), que já chama `requireLogin()`. As funções abaixo servem para casos específicos.

---

## Funções

| Função | Devolve | O que faz |
|---|---|---|
| `requireLogin(acao?)` | sessão ou `null` | Protege a página. Sem sessão válida, redireciona ao login. Com `acao`, quem não pode executá-la vai para a página 403. Com acesso, passa a vigiar a validade (veja abaixo). |
| `can(acao, perfil?)` | `true` / `false` | Se o perfil pode executar a ação de `PERMISSOES`. Sem `perfil`, usa o do usuário logado. Sem sessão ou com ação desconhecida, `false`. |
| `getUser()` | `{ nome, perfil }` ou `null` | Usuário logado. Útil para mostrar o nome ou decidir o que exibir pelo perfil. |
| `getSession()` | `{ token, nome, perfil, exp }` ou `null` | Sessão completa. `null` se ausente, inválida ou vencida. |
| `isLoggedIn()` | `true` / `false` | Se há sessão válida agora. Não redireciona. |
| `saveSession(resposta)` | — | Grava a resposta do login com `access_token`, `token_type: "bearer"`, `perfil` válido e `acesso_liberado: true`. Também aceita JWTs legados com `nome` e `perfil` no payload. |
| `logout()` | — | Encerra a sessão e volta ao login. |
| `endSession(motivo)` | — | Igual ao `logout`, mas com aviso no login. Com `"expirada"`, o login mostra "Sua sessão expirou". |
| `clearSession()` | — | Apaga a sessão sem redirecionar. |
| `entrar()` | — | Vai ao dashboard com sessão ou ao login sem sessão. |
| `decodeToken(token)` | payload ou `null` | Lê o conteúdo de um JWT. Nunca lança erro. |

| Constante | Valor |
|---|---|
| `LOGIN_URL` | `/src/features/login/login.html` |
| `FORBIDDEN_URL` | `/src/features/errors/403.html` (acesso negado) |
| `HOME_URL` | `/src/features/dashboard/dashboard.html` |
| `PERFIS` | `['administrador', 'gerente', 'operador', 'tecnico', 'consulta']` (os níveis do backend, em minúsculas) |
| `PERMISSOES` | Matriz de permissões (veja abaixo). |

---

## Permissões

`PERMISSOES` traduz a matriz da Especificação MVP2 (seção 3). Consultar dashboard, lotes, fornecedores, alertas e estoque vale para todos os perfis e não tem ação; as ações abaixo são as que dependem do perfil.

| Ação (`acao`) | Quem pode |
|---|---|
| `fornecedor.cadastrar` | administrador, gerente |
| `lote.registrar` | administrador, gerente, operador |
| `producao.operar` (iniciar e finalizar produção) | administrador, gerente, operador |
| `esteira.operar` (desligar esteira manualmente) | administrador, gerente, tecnico |
| `usuarios.gerenciar` | ninguém (fora do MVP) |

Os três usos da matriz:

```js
// 1. Tela inteira restrita (via layout.js, que chama requireLogin(acao)):
const SESSAO = montarLayout({ acao: 'lote.registrar' });

// 2. Botão ou trecho da tela:
if (can('fornecedor.cadastrar')) {
    document.getElementById('btn-novo-fornecedor').classList.remove('d-none');
}

// 3. Item do menu (MENU, em layout.js):
{ rotulo: 'Cadastrar lote', href: '...', acao: 'lote.registrar' }
```

Para uma ação nova, acrescente uma chave em `PERMISSOES`, cubra a regra em `session.test.js` e alinhe a autorização correspondente no backend.

> Esconder ou barrar na interface é só conforto: a API verifica a permissão em cada operação protegida e responde `403`. Ação com nome errado em `can` devolve `false`, então o recurso some em vez de aparecer para todos.

---

## Resposta do login e JWT

O login devolve:

```json
{
  "mensagem": "Autenticação realizada com sucesso!",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "perfil": "OPERADOR",
  "acesso_liberado": true
}
```

- `access_token` deve ser um JWT legível. O exemplo acima abrevia seu conteúdo.
- `perfil` vem da resposta, precisa ser um dos `PERFIS` e é normalizado para minúsculas.
- `acesso_liberado` precisa ser `true`; `false` apaga a sessão anterior e impede a entrada.
- `token_type` deve ser `bearer`. As chamadas usam `Authorization: Bearer <access_token>`.
- O nome exibido vem de `nome` no JWT; na ausência dele, usa `sub` ou `Usuário`.
- A validade vem de `exp` no JWT (segundos). Sem `exp`, só a API (com `401`) derruba a sessão.
- JWTs legados com `nome` e `perfil` no payload continuam aceitos por `saveSession(token)`.

---

## Quando a sessão cai

| Situação | O que acontece |
|---|---|
| O token vence com a página aberta | A cada 30 segundos o `requireLogin` confere a validade; vencido, volta ao login com "Sua sessão expirou". |
| A pessoa volta para a aba ou usa o botão "voltar" | A validade é conferida na hora. |
| A API responde `401` | O `api.js` chama `endSession("expirada")`. |
| Botão **Sair** | O `layout.js` avisa a API (`POST /logout`) e chama `logout()`. |

O redirecionamento usa `location.replace`, então o botão "voltar" do navegador não reabre a página protegida.

---

## Testes

`src/shared/session.test.js` cobre a leitura do token, a sessão vencida, o logout, a guarda (`requireLogin` com e sem ação) e cada linha da matriz de permissões.
