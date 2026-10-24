# api.js

Camada única de comunicação com a API. Em vez de chamar `fetch` em cada tela, o projeto usa o objeto `API`, que monta a URL, envia o token e o corpo em JSON, limita o tempo de espera e traduz os erros em mensagens prontas para mostrar ao usuário.

```js
import API from '../../shared/api.js';   // export default
```

---

## O objeto `API`

| Método | Assinatura | Envia corpo? |
|---|---|---|
| `API.GET` | `API.GET(url)` | Não |
| `API.POST` | `API.POST(url, corpo)` | Sim |
| `API.PUT` | `API.PUT(url, corpo)` | Sim |
| `API.PATCH` | `API.PATCH(url, corpo)` | Sim |
| `API.DELETE` | `API.DELETE(url)` | Não |

- `url` é só o caminho (ex.: `/lotes`, `/lotes/3`). O endereço base vem de `API_URL` (do `.env`).
- `corpo` é um objeto JavaScript comum; a conversão para JSON é automática.
- Todos devolvem uma `Promise` com o JSON já convertido, ou `null` quando a API responde `204`.

---

## O que acontece em toda chamada

1. A URL final é `API_URL + url`.
2. Todas as requisições enviam `Accept: application/json`.
3. Se houver sessão, envia `Authorization: Bearer <token>` (o token salvo pelo `session.js`).
4. GET e HEAD nunca enviam corpo. Os demais enviam o corpo só se ele for informado, com `Content-Type: application/json`.
5. Se a API não responder em `API_TIMEOUT` milissegundos (8000 por padrão), a requisição é cancelada.

---

## Erros

Quem chama `API.*` recebe sempre um `Error` cuja `message` já pode ser mostrada ao usuário.

| Situação | `message` |
|---|---|
| `401` com token enviado (token inválido, expirado ou revogado) | Além do erro, **encerra a sessão e volta ao login** com o aviso "Sua sessão expirou". |
| `403` (usuário autenticado sem permissão para a operação) | `Você não tem permissão para acessar estes dados.` |
| Outro status de erro | `HTTP 404`, `HTTP 500` etc. |
| A API não respondeu a tempo | `A API demorou para responder (limite de 8 segundos).` |
| Servidor fora do ar, URL errada ou sem rede | `Não foi possível conectar à API. Confira se o servidor está rodando.` |

O erro original fica em `erro.cause`, para depuração.

> **Não envie `id_usuario` no corpo.** A API obtém o responsável pela ação a partir do token (Especificação MVP2) e não aceita esse campo enviado pelo front-end.

> A mensagem de tempo esgotado cita "8 segundos" fixo. Se `VITE_API_TIMEOUT` for alterado no `.env`, o texto não acompanha.

---

## Exemplos

### Buscar dados

```js
try {
    const lotes = await API.GET('/lotes');
    // ...
} catch (erro) {
    mostrarMensagem(erro.message);   // já é uma frase pronta
}
```

### Criar, alterar e remover

```js
const novo = await API.POST('/lotes', { id_fornecedor: 1, pesoentrada_kg: 640.35 });
await API.PUT('/lotes/3', { ...loteCompleto });          // substitui o registro inteiro
await API.PATCH('/lotes/3', { status: 'Finalizado' });   // altera só alguns campos
await API.DELETE('/lotes/3');                            // normalmente devolve null (204)
```

### Várias chamadas em paralelo

```js
const [lotes, fornecedores] = await Promise.all([API.GET('/lotes'), API.GET('/fornecedores')]);
```

---

## Endpoints do mock

O mock (`npm run mock`) responde tanto em `/lotes` quanto em `/api/lotes` (`mocks/routes.json`).

| Endpoint | Dados |
|---|---|
| `POST /login` | Recebe `{ login, senha }` e devolve `{ token }`. |
| `POST /logout` | Revoga o token enviado (responde `204`). |
| `/lotes`, `/producao`, `/fornecedores`, `/alertas`, `/esteiras`, `/leituras_sensor`, `/usuarios`, `/logs_sistema` | Coleções do `mocks/db.json` (GET, POST, PUT, PATCH e DELETE do json-server). |

Todas as rotas, exceto `/login`, exigem o token. As permissões por perfil ficam em `mocks/rbac.cjs`, com a mesma matriz do MVP descrita em [session.md](session.md#permissões):

| Requisição | Quem pode |
|---|---|
| `GET` em `/lotes`, `/fornecedores`, `/alertas`, `/producao`, `/esteiras`, `/leituras_sensor` | Todos os perfis |
| `POST /fornecedores` | administrador, gerente |
| `POST /lotes` | administrador, gerente, operador |
| `POST /producao` (iniciar) e `PATCH /producao/:id` (finalizar) | operador |
| `/usuarios` (qualquer método) | ninguém (fora do MVP) |
| Qualquer outra (`PUT`, `DELETE`, `/logs_sistema`...) | ninguém |

O resto recebe `403 { "erro": "sem permissão" }`. O administrador não tem passe livre: segue a matriz como os outros perfis.
