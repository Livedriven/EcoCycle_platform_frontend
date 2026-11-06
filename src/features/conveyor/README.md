# Esteiras

O grupo Esteiras possui duas páginas:

- `conveyor.html`: consulta em cartões, busca por nome, ID, tipo, local ou status e detalhes em modal.
- `conveyor-status.html`: situação, velocidade e temperatura de todas as esteiras; seleção para consultar a última leitura, alertas ativos e histórico. O parâmetro `?esteira=ID` abre o equipamento indicado pelo modal.

Ambas consultam `GET /esteiras` sem cache e atualizam a cada cinco segundos enquanto a aba está visível.
O dashboard e o acompanhamento da produção usam essa mesma fonte. Em operação integrada,
o middleware informa o estado ao backend, que o persiste e entrega ao portal.
O monitoramento consulta também `GET /telemetria/historico` e `GET /alertas`.
O histórico completo é filtrado localmente por `id_esteira`, pois a rota não declara esse filtro.
Os alertas são associados pelo vínculo `id_leitura → id_esteira`, com compatibilidade entre IDs textuais e numéricos.

O contrato atual de `/esteiras` retorna `{ esteiras: [...] }` com `id_esteira` (adaptado para `id`), `nome_esteira`, `status_esteira`,
`velocidade_esteira_kmh` e `temperatura_esteira_c`. A consulta está preparada para os campos
opcionais `tipo_esteira`, `local_esteira` e `ultima_manutencao` (data ISO), que ainda não existem na tabela `esteira` do banco.
Dados opcionais ausentes são exibidos como não informados; não são deduzidos do nome.

Falhas de atualização preservam os dados anteriores com aviso. A carga inicial oferece nova tentativa.
A interface suporta qualquer quantidade de esteiras retornada pela API.

O botão **Registrar desligamento** aparece para quem tem `esteira.operar`
(administrador, gerente e técnico) quando a esteira está disponível. Ele registra
`DESLIGADA` via `PATCH /esteiras/:id`. O comando físico fica no painel do
middleware, e uma nova leitura pode atualizar o registro manual.
