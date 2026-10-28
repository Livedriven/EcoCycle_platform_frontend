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
| `403` (usuário autenticado sem permissão para a operação) | `Você não tem permissão para acessar estes dados.` e redireciona para a página de acesso negado. |
| `404` | `HTTP 404` e redireciona para a página não encontrada. |
| `500` a `599` | `HTTP <status>` e redireciona para serviço indisponível. |
| Outros status de erro (como `400`, `409` e `422`) | `HTTP <status>`, sem redirecionamento. |
| A API não respondeu a tempo | Mensagem com o limite configurado em segundos e redireciona para serviço indisponível. |
| Servidor fora do ar, URL errada ou sem rede | `Não foi possível conectar à API. Confira se o servidor está rodando.` e redireciona para serviço indisponível. |

O erro original fica em `erro.cause`, para depuração.

> **Não envie `id_usuario` no corpo.** A API obtém o responsável pela ação a partir do token (Especificação MVP2) e não aceita esse campo enviado pelo front-end.

Na página de serviço indisponível, **Tentar novamente** retorna à página em que a falha ocorreu (com filtros e âncora), sem reenviar automaticamente operações de escrita. Apenas destinos da mesma origem são aceitos. Falhas simultâneas provocam um único redirecionamento. As páginas de erro não fazem chamadas à API.

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
