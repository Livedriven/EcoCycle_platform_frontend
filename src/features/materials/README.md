# Materiais separados

Relatório de consulta de **Plástico, Metal, Alumínio e Rejeito** separados na produção, baseado em `GET /producao`. O peso de entrada de um lote não informa a composição dos materiais e não entra neste relatório.

- Exibe todo o histórico por padrão, com filtros por data inicial, data final e lote. As datas são inclusivas e o dia informado pela API é preservado.
- Os filtros alimentam a mesma lista usada por cartões (kg e toneladas), gráfico de rosca e tabela. Cada linha soma todos os turnos e esteiras de um lote no mesmo dia.
- Os totais consideram todos os registros filtrados, incluindo as demais páginas da tabela. A ordenação e a paginação do Grid.js não alteram os totais.
- Os dados são consultados automaticamente a cada 5 segundos, preservando os filtros e o conteúdo durante as requisições. Não há operações de escrita.
- Os quatro materiais têm cartões em kg e toneladas, colunas próprias na tabela e categorias no gráfico. Materiais sem registros aparecem com zero, sem gerar dados fictícios. Alumínio e rejeito já estão preparados para receber registros quando a API passar a fornecê-los.
- Durante a consulta, exibe spinner e texto de carregamento, oculta o relatório e bloqueia os controles. Sem registros, mantém os cartões zerados e mostra mensagens próprias no lugar do gráfico e da tabela. Se os filtros não encontrarem resultados, oferece **Limpar filtros**. Registros válidos com peso zero continuam na tabela, mesmo sem gráfico para desenhar.

## Reutilização

`layout.js` e `session.js` protegem a tela; `api.js` envia o token e trata os erros; `calculations.js` calcula e agrupa os valores; `formatters.js` formata pesos e datas; `table.js` cria a tabela paginada; `shared/charts.js` compartilha a implementação de gráficos com o dashboard.

## Validação e segurança

Todos os perfis autenticados do MVP podem consultar. Sem sessão, a tela não busca dados; a validade da sessão é conferida novamente antes de exibir uma resposta e ao aplicar filtros. A autorização real continua sendo responsabilidade da API.

`materials-report.js` exige uma lista, aceita os quatro materiais de `MATERIAIS_RELATORIO` (Plástico, Metal, Alumínio e Rejeito), lote com ID inteiro positivo seguro, peso numérico finito e não negativo e dia existente no calendário. Somente os campos do relatório são copiados. Registros incompletos (incluindo produções iniciadas sem material/peso) são desconsiderados sem aviso na tela, sem estimar valores. Formato de resposta inválido mostra erro e permite tentar novamente.

Textos externos usam `textContent`/`Option` e as colunas de texto do Grid.js, sem interpolação em HTML. Períodos inválidos suspendem a exibição até serem corrigidos ou limpos. Falhas HTTP, de rede e timeout seguem o tratamento central do `api.js`.

## Contrato de integração

O endpoint deve devolver a lista completa. Se a API real introduzir paginação no servidor, será necessário buscar todas as páginas ou usar um endpoint de agregação antes de apresentar totais globais.

Campos utilizados: `id_lote`, `tipo_material`, `peso_kg` e `data_hora`, centralizados em `CAMPOS`. Não são necessários outros endpoints nem acesso a dados de usuários.

O campo `tipo_material` deve usar um dos nomes canônicos: `Plástico`, `Metal`, `Alumínio` ou `Rejeito`. Metal e alumínio são categorias separadas: um peso não é inferido nem duplicado na outra categoria. Zeros indicam ausência de registros no filtro aplicado, quando há detalhamento por material disponível.

Testes: `materials-report.test.js` cobre validação e filtros; `materials.test.js` cobre o controlador, proteção de sessão, filtros sincronizados, estados vazios, erros e nova tentativa; as novas funções compartilhadas são testadas em `calculations.test.js` e `formatters.test.js`.
