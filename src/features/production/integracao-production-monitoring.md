# Controle de produções: decisões, pendências e ajustes fora dos arquivos da tela

Branch sugerida: `feature/production-monitoring`, a partir da `main` atualizada.
Arquivos novos, em `src/features/production/` (mesma pasta da produção diária, nomes sem colisão):
`production-monitoring.html`, `production-monitoring.js`, `production-monitoring-filter.js` e `production-monitoring-filter.test.js`.
Nada de `production.html`, `production.js`, `production-filters.js` ou `production-details.js` é alterado.

## 1. O que foi verificado antes de decidir

| Fonte | O que mostrou |
|---|---|
| `production.js` enviado | Usa `API.GET(url, { erroLocal: true })`, `createTable` com `{ busca: false }`, `h`, `classeStatus` (de `ui.js`) e `formatKg`. O status da produção vem de `producao.status || lote.status` |
| JSON atual | `producao` não tem `status` nem código de produção; `lotes` tem `codigo_lote`, `pesoentrada_kg` e `status`; `esteiras` tem `nome_esteira` |
| `session.js` / `rbac.cjs` | `producao.operar` vale para administrador, gerente e operador |
| Regra 3 da arquitetura | Uma feature não importa outra: por isso a normalização de texto foi repetida no arquivo de filtro desta tela |

## 2. Registro de decisões

Legenda: **Decidida** = vem do escopo, do design ou do código existente. **Assumida** = escolha minha, em uso até confirmação. **Pendente** = depende de resposta externa.

| # | Decisão | Motivo | Status | Onde |
|---|---|---|---|---|
| D1 | Arquivos `production-monitoring.*` em `src/features/production/` | Pasta indicada no pedido; nomes diferentes dos da produção diária | Decidida (pasta: confirmar) | `features/production/` |
| D2 | Título "Controle de produções" e breadcrumb "Início / Operações / Controle de produções" | O design usa "Iniciar produção", nome que já pertence a outra tela. Texto de apoio do design mantido | Assumida | HTML |
| D3 | Sem "Modo claro" e sem o rodapé "Dados demonstrativos" | Pedido: só o conteúdo da página | Decidida | HTML |
| D4 | Só aparecem produções com status Recebido ou Disponível, comparados **sem acento nem caixa** (`RECEBIDO`, `Recebido`, `DISPONIVEL` e `Disponível` valem igual) | Escopo cita `RECEBIDO` e `DISPONIVEL` "conforme os valores reais do backend", que não conheço | Pendente (E2: valores exatos) | `STATUS_EXIBIDOS` |
| D5 | O status vem de `producao.status` e, se não houver, do **lote** | Mesma regra de `production.js`. O JSON da produção não tem status. Nada é alterado nem simulado | Assumida | `montarLinhas` |
| D6 | O texto do status é um rótulo legível ("Recebido", "Disponível"); status desconhecido nunca aparece, pois é filtrado | O backend pode devolver maiúsculas | Assumida | `rotuloDoStatus` |
| D7 | Colunas do escopo: ID da produção, ID do lote, Esteira, Turno, Peso do lote, Status e Ação. "ID do lote" mostra `id (código)`, por exemplo `8 (LT-0008)` | O design mostra o código do lote; um texto único evita coluna fora do escopo | Assumida | `montarLinhas` |
| D8 | ID da produção é o `id` numérico, **sem prefixo "PRD-"** | O JSON não tem código de produção | Pendente (E2: existe um código?) | HTML/JS |
| D9 | Peso do lote = `pesoentrada_kg` do lote, com `formatKg` | O design deixa a coluna vazia; é o único peso do lote nos dados | Assumida | `montarLinhas` |
| D10 | Esteira mostra `nome_esteira`; turno vem de `turno_producao` | Campos do JSON | Decidida | `montarLinhas` |
| D11 | Busca: número compara por inteiro o ID da produção, o ID do lote ou o código; texto acha parte do código do lote | Escopo pede ID da produção ou do lote. O texto sobre o código acrescentei porque ele aparece na tela | Assumida (a busca por código é opcional) | `filtrarProducoes` |
| D12 | Filtro de status oferece só os status presentes nos dados | Evita opções sem resultado | Decidida | `opcoesDeStatus` |
| D13 | Botões **Pesquisar** (ou Enter) e **Limpar**, sem busca ao digitar | Escopo | Decidida | HTML/JS |
| D14 | Ordem: menor ID primeiro (mais antigas na frente) | Escopo não define; o design lista em ordem crescente | Assumida | `ordenarPorId` |
| D15 | A tela abre para todos os perfis; o botão da ação só aparece com `can('producao.operar')` | Regra 6 da arquitetura. A alternativa é restringir a tela inteira com `montarLayout({ acao: 'producao.operar' })` | Assumida | `production-monitoring.js` |
| D16 | A ação só **navega**: `ETAPA_2_URL + '?producao=' + id` | Escopo. O caminho é provisório e a etapa 2 não existe (acessá-lo hoje dá 404) | **Pendente** | `ETAPA_2_URL` |
| D17 | Estados: carregando, erro (mensagem da API e "Tentar novamente"), nenhuma produção disponível e sem resultado (com "Limpar") | Escopo | Decidida | JS |
| D18 | `erroLocal: true` nas três chamadas | Copiado de `production.js`: o erro aparece na tela. Não li o `api.js` | Assumida (confirmar no `api.js`) | JS |
| D19 | Sem atualização automática | Não está no escopo (a produção diária atualiza a cada 5 s) | Decidida | JS |
| D20 | Nenhum `innerHTML`: spinner e mensagens por `createElement`/`textContent`; tabela com `formatar` e `acoes`, que escapam o texto | Prevenção de XSS | Decidida | JS |

## 3. Pendências

1. **D4/D5:** o backend devolve o status na produção ou só no lote? Quais os valores exatos?
2. **D8:** existe um código de produção (como `PRD-0251` no design)?
3. **D16:** qual o caminho da etapa 2, como o ID chega a ela, e ela valida o parâmetro?
4. **D15:** a consulta (perfil `consulta`) pode ver esta tela?
5. **D1/D2:** nome da pasta e o título da tela estão certos?
6. **Mock:** não há produção com status Recebido ou Disponível, e a produção não tem `status`. Para testar, é preciso uma produção ligada a um lote com status Recebido (por exemplo, criada pela tela "Iniciar produção").
7. **Relação com "Iniciar produção":** o design usa esse título. Esta lista substitui a tela de formulário, convive com ela ou é a etapa 1 do mesmo fluxo?
8. **`classeStatus` (`ui.js`):** não li o arquivo. Se não tiver cor para "Recebido" e "Disponível", o selo sai com a cor padrão.

## 4. O que muda fora de `features/`

| Arquivo | Mudança | Conflito esperado |
|---|---|---|
| `vite.config.js` | 1 linha, antes do comentário `// uma linha por página` | Certo se houver outro PR acrescentando página: mantenha as duas |
| `src/shared/layout.js` (`MENU`) | Novo item (pendência: em que grupo fica) | Baixo |
| `docs/arquiteture.md` | Linha na tabela de telas | Baixo |
| `session.js`, `api.js`, `table.js`, `formatters.js`, `ui.js`, `validators.js`, `mocks/*` | **Nada** | Nenhum |

`vite.config.js`:

```javascript
        productionMonitoring: resolve(__dirname, './src/features/production/production-monitoring.html'),
```

`MENU` (proposta, dentro do grupo "Operações", ao lado de "Iniciar produção"; sem `acao`, por D15):

```js
{ rotulo: 'Controle de produções', href: '/src/features/production/production-monitoring.html' }
```

A etapa 2 **não** entra no Vite nem no menu enquanto não existir.

## 5. Como testar

Com `npm run mock` e `npm run dev`:
- no mock limpo, a tela mostra "Nenhuma produção disponível no momento." (as produções 1 a 10 são do lote 1, Finalizado);
- crie uma produção pela tela "Iniciar produção" para um lote Recebido, e ela aparece aqui, com esteira, turno, peso do lote e selo;
- busque o ID da produção, o ID do lote e parte do código do lote; filtre por status; use **Limpar**;
- o botão **Iniciar produção** leva ao caminho provisório da etapa 2 (hoje, uma página 404);
- com o usuário `consulta`, a tabela aparece sem a coluna de ação;
- pare o mock e recarregue: aparece o erro com "Tentar novamente";
- janela estreita: a tabela rola na horizontal.

Depois, pare o mock e rode `git restore mocks/db.json`.
