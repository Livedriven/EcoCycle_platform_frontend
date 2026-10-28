# Esteiras

O grupo Equipamentos possui duas páginas:

- `conveyor.html`: consulta em cartões, busca por nome, ID, tipo, local ou status e detalhes em modal.
- `conveyor-status.html`: situação, velocidade e temperatura de todas as esteiras; seleção para consultar a última leitura, alertas ativos e histórico. O parâmetro `?esteira=ID` abre o equipamento indicado pelo modal.

Ambas consultam `GET /esteiras` e atualizam a cada cinco segundos enquanto a aba está visível.
O monitoramento consulta também `GET /leituras_sensor?id_esteira=ID` e `GET /alertas`.
Os alertas são associados pelo vínculo `id_leitura → id_esteira`, com compatibilidade entre IDs textuais e numéricos.

O contrato atual de `/esteiras` contém `id`, `nome_esteira`, `status_esteira`,
`velocidade_esteira_kmh` e `temperatura_esteira_c`. A consulta está preparada para os campos
opcionais `tipo_esteira`, `local_esteira` e `ultima_manutencao` (data ISO).
Dados opcionais ausentes são exibidos como não informados; não são deduzidos do nome.

Falhas de atualização preservam os dados anteriores com aviso. A carga inicial oferece nova tentativa.
O mock padrão contém uma esteira; a interface suporta qualquer quantidade retornada pela API.
