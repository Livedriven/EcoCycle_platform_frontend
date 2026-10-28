# Consultar lotes: decisões e ajustes fora de `src/features/batches/`

Branch sugerida: `feature/consultar-lotes`, criada a partir da `main` atualizada.
Arquivos da tela, em `src/features/batches/`: `batches.html`, `batches.js`, `batches-filter.js` e `batches-filter.test.js`.

**Atenção:** `batches.html` e `batches.js` **já existem** como esboço (o `vite.config.js` já tem a entrada `batches`). Antes de substituir, veja o que há neles (`type src\features\batches\batches.js`) e confirme que ninguém mais está trabalhando neles. Os outros dois arquivos são novos.

## 1. Registro de decisões

Legenda: **Decidida** = vem do escopo, do wireframe ou da arquitetura. **Assumida** = escolha minha, em uso até alguém confirmar. **Pendente** = depende de resposta externa.

| # | Decisão | Motivo | Status | Onde |
|---|---|---|---|---|
| D1 | Tela em `batches.html` e `batches.js` (substituem o esboço) | Entrada `batches` já existe no Vite; o cadastro fica em `new-batch.*` | Decidida | `features/batches/` |
| D2 | `montarLayout()` **sem** `acao` | Consultar lotes vale para todos os perfis, e a API libera `GET /lotes` | Decidida | `batches.js` |
| D3 | Colunas só as do wireframe: ID do lote, Fornecedor, Peso (kg), Data de entrada, Status e Ações | Escopo: "sem adicionar campos não especificados" | Decidida | `batches.js` |
| D4 | Nome do fornecedor vem de `GET /fornecedores`, ligado por `id_fornecedor`; se o lote vier com `cnpj_fornecedor`, liga por ele | O lote só guarda a referência. A tolerância cobre a dúvida sobre o nome do campo (D14 do cadastro de lote) | Assumida | `montarLinhas` |
| D5 | Fornecedor não encontrado mostra "Fornecedor não identificado" | Evita linha com campo vazio | Assumida | `montarLinhas` |
| D6 | **Os status vêm dos dados**, e não de uma lista fixa | O wireframe usa "Disponível" e "Em triagem", mas os registros podem ter `Recebido`, `Em processamento` e `Finalizado`. Uma lista fixa não bateria com nenhum dos dois | Assumida | `opcoesDeStatus` |
| D7 | Cor do selo por nome do status: Recebido e Disponível = verde, Em processamento e Em triagem = azul, Finalizado e desconhecidos = cinza | Segue as cores do wireframe; nomes desconhecidos não quebram | Pendente (E2/E5: lista oficial de status) | `classeDoStatus` |
| D8 | Busca por **ID exato** ("5" acha o lote 5, e não o 15) ou por parte do nome do fornecedor, sem diferenciar acento e maiúsculas | Escopo: "pesquisa por ID do lote ou fornecedor". ID parcial traria lotes que não são o procurado | Assumida | `filtrarLotes` |
| D9 | Busca e filtro rodam pelo botão **Buscar** (ou Enter); **Limpar filtros** zera tudo | Escopo e wireframe pedem os dois botões | Decidida | `batches.js` |
| D10 | "Mais recentes" = data de entrada decrescente, com desempate pelo maior id. Ordenação por clique nas colunas desligada | Há data de entrada, ao contrário dos fornecedores. Desligar mantém o rótulo "Ordenado por" verdadeiro | Assumida | `ordenarMaisRecentes` |
| D11 | Peso sempre com 2 casas (`1.450,00 kg`), por função local | O wireframe mostra 2 casas; o `formatKg` do projeto tira os zeros (`1.450 kg`). Se o grupo preferir o `formatKg`, é uma linha | Assumida | `formatarPeso` |
| D12 | Data de entrada com `formatDateTime` (`24/10/2026 14:30`) | Já existe em `shared/formatters.js` e bate com o wireframe | Decidida | `batches.js` |
| D13 | **Ações são só desenho** (ícones de ver e editar, apagados e sem função) | Escopo pede só "apresentar" o campo. Detalhes e edição de lote não estão especificados, e a API não oferece `PUT`. Mesmo critério da consulta de fornecedores | Decidida | `batches.js` |
| D14 | Estados: carregando (spinner), erro (mensagem da API e "Tentar novamente"), sem lotes (com link "Cadastrar lote" só para quem tem `lote.registrar`) e sem resultado (com "Limpar filtros") | Escopo: "estados adequados" | Decidida | `batches.js` |
| D15 | Paginação do `table.js`, com a busca e a ordenação do Grid.js desligadas | A tela tem busca e ordem próprias | Decidida | `batches.js` |
| D16 | O link "Cadastrar lote" aponta para `new-batch.html` | A tela é entregue em outro PR. Se ainda não estiver na `main`, o link leva a um 404 até lá | Depende de PR | `batches.js` |

## 2. O que muda fora de `features/`

| Arquivo | Mudança | Depende de PR? | Conflito esperado |
|---|---|---|---|
| `src/shared/layout.js` (`MENU`) | `href` do item "Consultar lotes" | Não | Baixo (o PR do cadastro mexe em outra linha) |
| `vite.config.js` | **Nada**: a entrada `batches` já existe. Confirme com `findstr /n "batches" vite.config.js` | — | Nenhum |
| `src/shared/formatters.js` | **Nada**: `formatDateTime` já existe | — | Nenhum |
| `validators.js`, `session.js`, `api.js` | **Nada** | — | Nenhum |
| `docs/arquiteture.md` | Na linha de `batches`, indicar que a consulta está pronta | Não | Baixo |

### `MENU` em `src/shared/layout.js`

O item "Consultar lotes" provavelmente está com `href: null`. Troque só o `href` e **não** coloque `acao`:

```js
{ rotulo: 'Consultar lotes', href: '/src/features/batches/batches.html' }
```

### Opcional, só depois que os dois PRs (cadastro e consulta de lotes) estiverem na `main`

O **Cancelar** de `new-batch.js` hoje volta ao dashboard. Para voltar a esta lista, troque `HOME_URL` por `'/src/features/batches/batches.html'`. É uma linha, e vale fazer em commit separado.

## 3. Perguntas para a E2 e a E5 (consolidadas das decisões pendentes)

1. **D7:** quais são os status oficiais de um lote? A tela de iniciar produção usa `Recebido` como "disponível" (provisório). O wireframe mostra "Disponível" e "Em triagem".
2. **D4:** no lote, a referência ao fornecedor é `id_fornecedor` ou `cnpj_fornecedor`?
3. A API devolve **todos** os lotes ou pagina? (O `arquiteture.md` já tem essa dúvida para produção e lotes.) A tela mostra só o que recebe, e o contador "Exibindo N lotes" ficaria errado com paginação.
4. **D13:** vão existir "ver detalhes" e "editar" lote? Se sim, quais perfis podem editar?

## 4. Como testar

Com a API real configurada em `VITE_API_URL` e `npm run dev`, entre com um usuário de teste e abra Lotes → Consultar lotes:
- os lotes aparecem do mais recente ao mais antigo, com o nome do fornecedor, o peso com 2 casas e a data com hora;
- buscar um número acha só aquele ID (`1` não traz o `10`), e buscar parte do nome do fornecedor funciona sem acento;
- o filtro de status lista os que existem nos dados retornados e combina com a busca;
- **Limpar filtros** volta à lista completa, e uma busca sem resultado mostra a mensagem com o botão;
- cadastre um lote na outra tela, se já estiver pronta, e confira que ele aparece no topo;
- interrompa a API de desenvolvimento e recarregue, para ver o erro com "Tentar novamente";
- reduza a janela até o tamanho de celular, e a tabela deve rolar na horizontal.
