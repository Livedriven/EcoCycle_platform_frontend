# `validators.js`

Este documento define como implementar e usar `src/shared/validators.js` nas telas que tiverem formulários. Ele existe para que os formulários sejam consistentes mesmo quando pessoas diferentes implementarem cada funcionalidade.

## Objetivo

`validators.js` deve reunir **funções puras de validação de dados**. Uma função pura recebe valores, decide se eles atendem às regras e devolve o resultado; ela não altera a página, não faz requisições e não depende de qual tela a chamou.

O arquivo deve validar a experiência no navegador, mas nunca substituir a validação da API. Dados enviados pelo cliente podem ser alterados antes de chegar ao servidor, portanto o backend precisa repetir as regras críticas.

## O que pertence ao arquivo

- Campos obrigatórios.
- Textos com tamanho mínimo e máximo.
- Números positivos, como peso em quilogramas.
- Datas e horários em formato esperado.
- Valores que precisam pertencer a uma lista permitida, como status e materiais.
- Formatos estruturados, como e-mail, telefone e CNPJ, quando esses campos forem usados.
- Validações compostas de um formulário inteiro, como lote, fornecedor ou produção.

## O que não pertence ao arquivo

Não colocar no `validators.js`:

- `document.querySelector`, `classList`, HTML ou manipulação de inputs.
- Alertas, Toasts, SweetAlert2 ou mensagens desenhadas na tela. Isso pertence a `ui.js` ou à própria feature.
- Chamadas a `API.GET`, `API.POST` ou qualquer `fetch`.
- Controle de carregamento, envio de formulário ou redirecionamento.
- Regras que só a API consegue comprovar, como "este CNPJ já existe". A tela pode consultar um endpoint específico para isso, mas a confirmação final continua sendo do servidor.

## Contrato recomendado

Todas as funções devem devolver o mesmo formato:

```js
{ valido: true, mensagem: '' }
// ou
{ valido: false, mensagem: 'Informe um peso maior que zero.' }
```

Use `valido` para a decisão do código e `mensagem` para a pessoa que implementa a tela exibir o erro. Manter frases prontas no validador evita que cada formulário invente uma redação diferente para a mesma regra.

Uma função básica pode seguir este modelo:

```js
function resultado(valido, mensagem = '') {
    return { valido, mensagem };
}

export function validarPeso(peso) {
    const numero = Number(peso);
    return Number.isFinite(numero) && numero > 0
        ? resultado(true)
        : resultado(false, 'Informe um peso maior que zero.');
}
```

## Validações reutilizáveis esperadas

Quando o arquivo for implementado, prefira começar por funções pequenas que possam ser reaproveitadas.

| Função sugerida | Regra | Uso provável |
|---|---|---|
| `validarObrigatorio(valor, rotulo)` | Não aceita vazio, `null` ou somente espaços. | Nome, origem e material. |
| `validarTexto(valor, rotulo, minimo, maximo)` | Remove espaços das extremidades e confere comprimento. | Nome de fornecedor, observação e usuário. |
| `validarPeso(peso)` | Deve ser número finito e maior que zero. | Lotes e produção. |
| `validarDataHora(dataHora)` | Deve representar data/hora válida no formato ISO aceito pela API. | Produção e leituras. |
| `validarOpcao(valor, opcoes, rotulo)` | O valor precisa estar na lista permitida. | Material e status. |
| `validarEmail(email)` | Aceita vazio quando o campo for opcional; valida o formato quando preenchido. | Fornecedores e usuários. |
| `validarCnpj(cnpj)` | Normaliza caracteres e confere formato/dígitos verificadores, se o campo for exigido. | Fornecedores. |

Evite criar uma função quase idêntica para cada campo quando uma regra genérica já resolver o caso. Por exemplo, `validarTexto(nome, 'Nome', 2, 60)` é preferível a `validarNomeFornecedor()` se a única diferença for o tamanho permitido.

## Validadores por formulário

Além das funções pequenas, cada formulário pode ter uma função que concentra suas regras e devolve todos os erros de uma vez. Isso permite mostrar mais de um campo inválido sem obrigar a pessoa a corrigir um erro por envio.

O formato recomendado é:

```js
export function validarLote(dados) {
    const erros = {};

    const fornecedor = validarObrigatorio(dados.id_fornecedor, 'Fornecedor');
    if (!fornecedor.valido) erros.id_fornecedor = fornecedor.mensagem;

    const peso = validarPeso(dados.pesoentrada_kg);
    if (!peso.valido) erros.pesoentrada_kg = peso.mensagem;

    return {
        valido: Object.keys(erros).length === 0,
        erros
    };
}
```

O nome das chaves em `erros` deve ser o mesmo nome usado no objeto enviado à API. Isso simplifica a ligação entre input, mensagem e payload.

Formulários previstos ou prováveis no projeto:

| Validador composto | Dados principais |
|---|---|
| `validarLote(dados)` | `id_fornecedor`, peso de entrada, data e status. |
| `validarFornecedor(dados)` | CNPJ, nome, telefone, e-mail e endereço. |
| `validarProducao(dados)` | lote, esteira, material, peso e `data_hora`. |
| `validarUsuario(dados)` | nome, login, perfil e senha, respeitando a regra de edição de senha opcional. |

## Como a feature deve usar o validador

A feature coleta os valores, chama o validador e apenas depois decide o que fazer visualmente ou chamar a API.

```js
import { validarLote } from '../../shared/validators.js';

form.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const dados = {
        id_fornecedor: inputFornecedor.value,
        pesoentrada_kg: inputPeso.value
    };
    const validacao = validarLote(dados);

    if (!validacao.valido) {
        mostrarErrosDoFormulario(validacao.erros);
        return;
    }

    await API.POST('/lotes', dados);
});
```

`mostrarErrosDoFormulario` não deve ir para `validators.js`. Cada tela pode optar por texto abaixo do campo, alerta no topo ou outro padrão visual sem mudar a regra de negócio.

## Normalização e payload

Definam em cada função se ela apenas valida ou também devolve um valor normalizado. Para o início do projeto, a opção mais simples é manter a validação sem efeitos e normalizar na feature antes de montar o payload:

```js
const dados = {
    id_fornecedor: Number(inputFornecedor.value),
    pesoentrada_kg: Number(inputPeso.value)
};
```

Não transforme silenciosamente entradas ambíguas. Por exemplo, uma data em formato brasileiro (`20/10/2026`) não deve ser adivinhada se a API espera ISO (`2026-10-20`); informe o formato aceito ou use um `<input type="date">`.

## Testes obrigatórios

Cada nova regra em `validators.js` deve ter teste correspondente em `src/shared/validators.test.js`. Teste, no mínimo:

- um valor válido;
- valor vazio, `null` e somente espaços, quando aplicável;
- limites mínimo e máximo;
- número negativo, zero e texto em campos numéricos;
- opções fora da lista permitida;
- formato inválido de data, e-mail ou CNPJ.

Exemplo:

```js
it('rejeita peso zero', () => {
    expect(validarPeso(0)).toEqual({
        valido: false,
        mensagem: 'Informe um peso maior que zero.'
    });
});
```

## Checklist para uma nova tela com formulário

1. Liste os campos enviados à API e as regras que já existem no backend.
2. Reaproveite uma função genérica antes de criar outra específica.
3. Inclua um validador composto se o formulário tiver mais de um campo.
4. Mostre os erros na feature, sem colocar lógica visual em `validators.js`.
5. Não envie a requisição se `valido` for `false`.
6. Adicione ou atualize os testes de cada regra nova.
7. Confirme que o backend continua validando o mesmo payload.
