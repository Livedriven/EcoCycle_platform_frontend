# Materiais separados

Relatório de **Plástico, Metal, Alumínio e Rejeito** por lote e dia. Consulta `GET /producao` e `GET /materiais` a cada 5 segundos, preservando filtros e dados durante as atualizações.

## Origem e cálculo dos pesos

- Cada ciclo de produção contém `itens`, com `id_material`, `peso_kg` e `data_hora`. O catálogo relaciona o ID ao tipo `plastico`, `metal` ou `aluminio`, apresentado com o nome em português e acentuação.
- Os pesos recicláveis são exclusivamente os pesos dos itens. Entrada do lote e saída total do ciclo não indicam sua composição e nunca são distribuídas entre materiais.
- `rejeito_kg` é somado uma vez por ciclo. Rejeito não é um material do catálogo nem um peso a replicar em cada item.
- O dia do material é o dia de `item.data_hora`, com fallback para `data_inicio` do ciclo quando a data do item é nula. O rejeito usa o dia de `data_inicio`.
- Os filtros por lote e período são inclusivos e alimentam os mesmos registros usados pelos cartões, gráfico e tabela. Todos os turnos e esteiras de um lote/dia são somados; paginação e ordenação da tabela não afetam os totais.
- Ciclos sem itens, com itens inválidos/desconhecidos ou cuja soma difere da saída por mais de 0,005 kg geram um aviso de composição incompleta, filtrado pela data de início e lote. Os demais pesos informados, inclusive rejeito, permanecem disponíveis. Zero indica ausência de peso registrado, não uma composição estimada.

`prepararProducaoMateriais` adapta os ciclos e catálogo antes de chamar `prepararMateriais`. A validação exige peso numérico finito não negativo, ID de lote inteiro positivo seguro e dia existente no calendário. Textos externos usam `textContent` e `Option`. Registros planos antigos permanecem compatíveis; ciclos com `itens` sempre usam os itens como fonte.

O adaptador HTTP compartilhado preserva os ciclos: expandir itens globalmente duplicaria pesos totais nas demais telas. Nenhuma leitura de telemetria é tratada como peso de produção.

## Estados e acesso

Todos os perfis autenticados podem consultar; autorização real pertence à API. Sem sessão a tela não busca dados e revalida a sessão antes de exibir respostas. Há estados de carregamento, erro, histórico vazio e filtros sem resultados. Falhas de atualização preservam os últimos dados e são sinalizadas. As duas consultas precisam concluir antes de substituir o relatório.

O endpoint deve devolver todo o histórico acessível ao usuário. Se houver paginação no servidor, será necessário carregar todas as páginas ou usar uma agregação. Não há gravação, alteração do fluxo de início de produção ou geração automática de itens: os pesos precisam estar registrados no backend.

## Verificação

`materials-report.test.js` cobre o contrato real normalizado, catálogo, agrupamento, datas, pesos parciais, rejeito sem duplicação, validação e filtros. `materials.test.js` cobre o controlador, consultas, sessão, falhas, atualização e aviso filtrado. As funções de cálculo compartilhadas permanecem testadas em `calculations.test.js`.
