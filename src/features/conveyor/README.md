# Esteiras

O grupo Esteiras possui duas páginas:

- `conveyor.html`: consulta em cartões, busca por nome, ID, tipo, local ou status e detalhes em modal.
- `conveyor-status.html`: situação, velocidade e temperatura de todas as esteiras; seleção para consultar a última leitura, alertas ativos e histórico. O parâmetro `?esteira=ID` abre o equipamento indicado pelo modal.

Ambas consultam `GET /esteiras` e atualizam a cada cinco segundos enquanto a aba está visível.
O monitoramento consulta também `GET /telemetria/historico` e `GET /alertas`.
O histórico completo é filtrado localmente por `id_esteira`, pois a rota não declara esse filtro.
Os alertas são associados pelo vínculo `id_leitura → id_esteira`, com compatibilidade entre IDs textuais e numéricos.

O contrato atual de `/esteiras` retorna `{ esteiras: [...] }` com `id_esteira` (adaptado para `id`), `nome_esteira`, `status_esteira`,
`velocidade_esteira_kmh` e `temperatura_esteira_c`. A consulta está preparada para os campos
opcionais `tipo_esteira`, `local_esteira` e `ultima_manutencao` (data ISO), que ainda não existem na tabela `esteira` do banco.
Dados opcionais ausentes são exibidos como não informados; não são deduzidos do nome.

Falhas de atualização preservam os dados anteriores com aviso. A carga inicial oferece nova tentativa.
A interface suporta qualquer quantidade de esteiras retornada pela API.

O botão **Desligar esteira** (modal de detalhes e tela de status) aparece para quem tem `esteira.operar` (administrador, gerente e técnico) quando a esteira não está desligada. Após confirmação, envia `PATCH /esteiras/:id` com `{ status_esteira: 'DESLIGADA' }` (`conveyor-shutdown.js`); o status novo aparece na atualização seguinte. Religar a esteira não faz parte desta tela.
