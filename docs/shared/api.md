# api.js

Camada única de comunicação com a API. Em vez de chamar `fetch` direto em cada tela, o resto do projeto usa o objeto `API`, que cuida de montar a URL, enviar o corpo em JSON, limitar o tempo de espera e traduzir os erros em mensagens legíveis.

---

## Dependências

O arquivo importa duas constantes de `config.js`:

| Constante | Para que serve |
|---|---|
| `API_URL` | Endereço base da API. É concatenado ao início de toda URL informada. |
| `API_TIMEOUT` | Tempo máximo (em milissegundos) que a requisição pode levar antes de ser cancelada. |

> A mensagem de timeout cita "limite de 8 segundos", então `API_TIMEOUT` deve valer `8000` para o texto ficar correto.

---

## Como funciona

Toda chamada passa por duas funções internas, nesta ordem:

```
API.POST('/lotes', dados)
        │
        ▼
requisitar('POST', '/lotes', dados)
        │
        ├─► padronizarRequisicao(...)   monta a URL completa e as opções do fetch
        │
        ├─► cria o cronômetro de timeout
        │
        ├─► fetch(...)                  faz a requisição
        │
        └─► devolve o JSON (ou lança um Error com mensagem amigável)
```

### `padronizarRequisicao(metodo, url, corpo)`

Recebe o método, o caminho e o corpo (opcional) e devolve `{ url, opcoes }`, prontos para o `fetch`.

- O método é convertido para maiúsculas. Se não for informado, vale `GET`.
- A URL final é `API_URL + url`. Por isso, informe só o caminho (ex.: `/lotes`), sem repetir o endereço base.
- Todas as requisições enviam o cabeçalho `Accept: application/json`.
- **GET e HEAD nunca enviam corpo.** Os demais métodos enviam o corpo apenas se ele for informado (diferente de `undefined` e `null`). Nesse caso:
  - o corpo é convertido com `JSON.stringify`;
  - o cabeçalho `Content-Type: application/json` é adicionado.

### `requisitar(metodo, url, corpo)`

Função assíncrona que executa a requisição de fato.

1. Chama `padronizarRequisicao` para obter a URL e as opções.
2. Cria um `AbortController` e agenda `ctrl.abort()` para daqui a `API_TIMEOUT` ms. Se a API não responder a tempo, a requisição é cancelada.
3. Executa o `fetch` com o `signal` do controlador.
4. Se a resposta não for bem-sucedida (`resp.ok` falso, ou seja, status fora de 200–299), lança `Error('HTTP ' + status)`.
5. Se o status for `204` (sem conteúdo), devolve `null`. Caso contrário, devolve `resp.json()`.
6. Em caso de erro, converte a mensagem (veja a tabela abaixo), registra no `console.error` e lança um novo `Error` com a mensagem final.
7. No `finally`, limpa o cronômetro, aconteça o que acontecer.

---

## Tratamento de erros

Quem chama `API.*` recebe sempre um `Error` cuja propriedade `message` já pode ser exibida ao usuário.

| Situação | Origem | `message` recebida |
|---|---|---|
| A API respondeu com erro HTTP | `resp.ok` falso | `HTTP 404`, `HTTP 500`, etc. |
| A API não respondeu dentro do limite | `AbortError` | `A API demorou para responder (limite de 8 segundos).` |
| Servidor fora do ar, URL errada ou sem rede | `TypeError` | `Não foi possível conectar à API. Confira se o servidor está rodando.` |

Além de lançar o erro, a função escreve no console uma linha no formato:

```
Falha na requisição GET http://.../lotes: HTTP 404
```

---

## O objeto `API`

É a interface que o restante do projeto usa. Cada método chama `requisitar` com o verbo correspondente e retorna uma `Promise`.

| Método | Assinatura | Envia corpo? |
|---|---|---|
| `API.GET` | `API.GET(url)` | Não |
| `API.POST` | `API.POST(url, corpo)` | Sim |
| `API.PUT` | `API.PUT(url, corpo)` | Sim |
| `API.PATCH` | `API.PATCH(url, corpo)` | Sim |
| `API.DELETE` | `API.DELETE(url)` | Não |

- `url` é o caminho a partir de `API_URL` (ex.: `/lotes`, `/lotes/3`).
- `corpo` é um objeto JavaScript comum. Ele é convertido para JSON automaticamente.
- O retorno é o JSON já convertido em objeto/array, ou `null` quando a API responde `204`.

> Para usar o `API` em outros arquivos, ele precisa ser exportado no `api.js` (`export { API };`) e importado onde for usado: `import { API } from './api';`.

---

## Exemplos de uso

Todas as chamadas devem usar `await` (dentro de uma função `async`) ou `.then()`, e ser envolvidas em `try/catch` para tratar os erros.

### Buscar dados (GET)

```javascript
try {
  const lotes = await API.GET('/lotes');
  console.log(lotes); // array/objeto vindo da API
} catch (erro) {
  console.log(erro.message); // ex.: "HTTP 500"
}
```

### Criar um registro (POST)

```javascript
const novo = await API.POST('/lotes', {
  data: '2026-10-22',
  toneladas: 12.5
});
```

### Substituir um registro inteiro (PUT)

```javascript
await API.PUT('/lotes/3', {
  data: '2026-10-22',
  toneladas: 14
});
```

### Alterar apenas alguns campos (PATCH)

```javascript
await API.PATCH('/lotes/3', { toneladas: 15 });
```

### Remover um registro (DELETE)

```javascript
await API.DELETE('/lotes/3'); // normalmente retorna null (204)
```

### Exibindo o erro para o usuário

Como a `message` do erro já é uma frase pronta, ela pode ser mostrada diretamente:

```javascript
try {
  const lotes = await API.GET('/lotes');
  renderizarTabela(lotes);
} catch (erro) {
  mostrarAlerta(erro.message);
}
```

---

## Resumo rápido

- Informe apenas o caminho da rota; o endereço base vem de `API_URL`.
- Passe o corpo como objeto; a conversão para JSON é automática.
- GET e HEAD nunca enviam corpo.
- Respostas `204` retornam `null`.
- Toda falha vira um `Error` com mensagem legível, então sempre use `try/catch`.
- Requisições que passam de `API_TIMEOUT` são canceladas.