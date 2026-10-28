# Integração com a API EcoCycle

`src/shared/api.js` centraliza HTTP, JWT, timeout e erros. O contrato de métodos, rotas e respostas fica em `src/shared/api-contract.js`, conferido nos routers, repositories e schemas do backend local.

Configure `VITE_API_URL=http://localhost:8000/api`. Os caminhos abaixo são relativos a essa base; não acrescente `/api` nas chamadas das telas.

| Método | Caminho | Acesso |
|---|---|---|
| POST | `/login` | Público |
| POST | `/logout` | JWT |
| GET | `/health/database` | Público |
| GET, POST | `/materiais` | JWT |
| GET, POST | `/fornecedores` | JWT |
| GET, POST | `/lotes` | JWT |
| PATCH | `/lotes/:id` | JWT |
| GET, POST | `/esteiras` | JWT |
| GET, PATCH | `/esteiras/:id` | JWT |
| POST | `/esteiras/status` | JWT |
| GET, POST | `/producao` | JWT |
| PATCH | `/producao/:id` | JWT |
| GET | `/producao/materiais` | JWT |
| GET | `/producao/dashboard-diario` | JWT |
| GET | `/producao/dashboard-mensal` | JWT |
| GET | `/producao/dashboard-trimestral` | JWT |
| POST | `/telemetria` | JWT |
| GET | `/telemetria/historico` | JWT |
| GET | `/alertas` | JWT |
| PATCH | `/alertas/:id` | JWT |

`:id` é um identificador numérico positivo (`/producao/12`). As rotas `PATCH` alteram apenas os campos enviados. Não há PUT nem DELETE. O cliente recusa combinações de rota e método não previstas. O portal consulta esteiras e telemetria; os comandos IoT são emitidos por outros clientes. Não é necessário criar uma tela para cada rota da API.

## Uso e autenticação

```js
const lotes = await API.GET('/lotes', { erroLocal: true });
const lote = await API.POST('/lotes', {
    id_fornecedor: 1,
    codigo_lote: 'L-001',
    status_lote: 'Recebido',
    peso_recebido_kg: 640.35,
    data_entrada: '2026-10-27T10:00:00',
});
```

GET não envia corpo. POST e PATCH serializam o objeto em JSON com `Content-Type: application/json`. Todas as chamadas enviam `Accept` e, nas rotas protegidas, `Authorization: Bearer <token>` da sessão. Login e diagnóstico nunca enviam JWT, mesmo com uma sessão salva.

O login recebe `{ usuario, senha }` e retorna `{ mensagem, access_token, token_type, perfil, acesso_liberado }`. O logout real retorna HTTP 200 com mensagem; também se aceita resposta 204. A revogação é mantida apenas na memória do processo do backend, sem compartilhamento entre workers ou persistência após reinício. O portal limpa a sessão local mesmo quando o aviso de logout falha.

## Respostas e campos

O adaptador extrai as listas nomeadas e preserva o modelo interno das telas. Envelopes inválidos geram erro, em vez de serem exibidos como listas vazias.

| Rota | Envelope | Principais adaptações |
|---|---|---|
| `/materiais` | `materiais` | `id_material → id`; catálogo de tipos, sem pesos |
| `/fornecedores` | `fornecedores` | `id_fornecedor → id`, `cnpj → cnpj_fornecedor` |
| `/lotes` | `lotes` | `id_lote → id`, `peso_recebido_kg → pesoentrada_kg`, `status_lote → status` |
| `/esteiras` | `esteiras` | `id_esteira → id` |
| `/producao` | `registros_producao` | `id_producao → id`, `data_inicio → data_hora`, `turno → turno_producao`, `quantidade_saida_kg → peso_kg`, `status_producao → status` |
| `/telemetria/historico` | `historico` | `id_leitura_sensor → id`, `timestamp → datahora_leitura`, `temperatura → temperatura_leitura_c`, `peso → peso_leitura_kg`, `status_registrado → status_leitura` |
| `/alertas` | `alertas` | `id_alerta → id`, `id_leitura_sensor → id_leitura`, `data_hora_alerta → datahora_alerta`; `SIM/NAO → boolean` |

Os cadastros e as atualizações retornam uma entidade (`lote`, `fornecedor`, `material`, `esteira`, `producao`, `alerta`), também extraída e adaptada pelo cliente. Materiais, lotes, esteiras e produção usam HTTP 201 no cadastro; fornecedores usa HTTP 200. As atualizações usam HTTP 200; corpo vazio ou campo desconhecido gera 422.

O fornecedor exige `id_fornecedor` manual, `cnpj`, nome, telefone, e-mail e endereço. O lote envia `peso_recebido_kg` e `status_lote`, sem `id: null`.

O início de produção envia `id_lote`, `id_usuario` (identificador numérico do `sub` do JWT), `id_esteira`, `turno`, `status_producao`, `quantidade_entrada_kg`, `quantidade_saida_kg`, `rejeito_kg`, `data_inicio` e `itens`. A entrada corresponde ao peso do lote selecionado; saída e rejeito começam em zero. Em seguida, `PATCH /lotes/:id` com `{ status_lote: 'Em processamento' }` tira o lote da lista de disponíveis; se essa etapa falhar, a produção continua cadastrada e a tela avisa.

Finalizar produção envia `PATCH /producao/:id` com `status_producao: 'Finalizado'`, `data_fim`, `quantidade_saida_kg` e `rejeito_kg` (saída + rejeito até a entrada do ciclo) e depois `PATCH /lotes/:id` com `{ status_lote: 'Finalizado' }`. A tela sugere como saída a soma dos itens do ciclo e como rejeito o restante da entrada. Considera-se encerrada a produção cujo status, ou o do lote, é “Finalizado”.

Atualizações disponíveis por perfil, conforme o backend: esteiras (`POST /esteiras`, `PATCH /esteiras/:id`) e resolução de alertas (`PATCH /alertas/:id` com `{ resolvido: true | false }`) para administrador, gerente e técnico; lotes e produção para administrador, gerente e operador (o operador só altera os próprios ciclos).

## Dashboards e limitações de dados

Os três gráficos usam `balanco_massas_kg` do backend: `total_material_entrada`, `total_produzido_saida` e `total_rejeitos_perdas`. As consultas usam o dia, mês e trimestre atuais:

- Diário: `?data=DD/MM/AAAA`, codificada por `URLSearchParams`.
- Mensal: `?mes=1..12&ano=AAAA`.
- Trimestral: `?trimestre=1..4&ano=AAAA`.

`GET /producao` inclui `itens` em cada ciclo: `id_item_producao`, `id_producao`, `id_material`, `peso_kg` e `data_hora`. Ciclos sem itens retornam `itens: []`. O relatório de materiais consulta também `GET /materiais` para relacionar cada `id_material` ao tipo (`plastico`, `metal`, `aluminio`) e soma apenas os pesos dos itens. O rejeito vem de `rejeito_kg`, uma vez por ciclo, e não do catálogo. A data do item define o dia do material; se ausente, usa `data_inicio`. O rejeito usa a data de início do ciclo.

Ciclos sem itens, com itens inválidos ou cuja soma diverge da saída por mais de meio centésimo de kg são sinalizados como composição incompleta. A saída total nunca é usada para inferir a composição. Listas antigas com `tipo_material`, `peso_kg` e `data_hora` continuam compatíveis. O dashboard usa a mesma composição (`/producao` + `/materiais`) nos cartões por material e na estimativa de CO₂; com composição incompleta, os cartões mostram “Não informado”. O adaptador HTTP preserva os ciclos sem expandi-los para evitar duplicar os totais de produção. `GET /producao/materiais` oferece a mesma composição já somada no backend (`totais_por_material_kg`), com filtros `data`, `mes`, `ano` e `trimestre`.

O histórico de telemetria não declara filtro por equipamento: o portal busca `/telemetria/historico` e filtra por `id_esteira` localmente.

## Falhas

401 com JWT encerra a sessão; 403 abre acesso negado. Falhas 404, de servidor, rede e timeout abrem as páginas de erro, exceto com `{ erroLocal: true }`, quando a tela mostra a falha localmente. Outros erros, como 409 e 422, ficam no formulário. O erro original é preservado em `cause`.

Use a API real configurada em `VITE_API_URL` também durante o desenvolvimento.

`api-contract.test.js` verifica os adaptadores e as rotas usadas pelo código.

## Modo de demonstração

Os mocks são opcionais: `npm run mock` inicia a API em memória, e `npm run dev:demo` abre o frontend na porta 5174 usando `.env.demo`. O frontend normal continua com a API real do `.env`. A troca é explícita, com sessões separadas por origem e identificação visual da demonstração. Veja [mocks/README.md](../../mocks/README.md).
