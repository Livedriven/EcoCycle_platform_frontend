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
| GET | `/equipamentos` | JWT |
| POST | `/equipamentos/status` | JWT |
| GET, POST | `/producao` | JWT |
| GET | `/producao/dashboard-diario` | JWT |
| GET | `/producao/dashboard-mensal` | JWT |
| GET | `/producao/dashboard-trimestral` | JWT |
| POST | `/telemetria` | JWT |
| GET | `/telemetria/historico` | JWT |
| GET | `/alertas` | JWT |

Não há PUT/PATCH, DELETE ou consulta por `/:id` nesse contrato. O cliente recusa combinações de rota e método não previstas. O portal consulta equipamentos e telemetria; os comandos IoT são emitidos por outros clientes. Não é necessário criar uma tela para cada rota da API.

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

GET não envia corpo. POST serializa o objeto em JSON com `Content-Type: application/json`. Todas as chamadas enviam `Accept` e, nas rotas protegidas, `Authorization: Bearer <token>` da sessão. Login e diagnóstico nunca enviam JWT, mesmo com uma sessão salva.

O login recebe `{ usuario, senha }` e retorna `{ mensagem, access_token, token_type, perfil, acesso_liberado }`. O logout real retorna HTTP 200 com mensagem; também se aceita resposta 204. A revogação é mantida apenas na memória do processo do backend, sem compartilhamento entre workers ou persistência após reinício. O portal limpa a sessão local mesmo quando o aviso de logout falha.

## Respostas e campos

O adaptador extrai as listas nomeadas e preserva o modelo interno das telas. Envelopes inválidos geram erro, em vez de serem exibidos como listas vazias.

| Rota | Envelope | Principais adaptações |
|---|---|---|
| `/materiais` | `materiais` | `id_material → id`; catálogo de tipos, sem pesos |
| `/fornecedores` | `fornecedores` | `id_fornecedor → id`, `cnpj → cnpj_fornecedor` |
| `/lotes` | `lotes` | `id_lote → id`, `peso_recebido_kg → pesoentrada_kg`, `status_lote → status` |
| `/equipamentos` | `equipamentos` | `id_esteira → id` |
| `/producao` | `registros_producao` | `id_producao → id`, `data_inicio → data_hora`, `turno → turno_producao`, `quantidade_saida_kg → peso_kg`, `status_producao → status` |
| `/telemetria/historico` | `historico` | `id_leitura_sensor → id`, `timestamp → datahora_leitura`, `temperatura → temperatura_leitura_c`, `peso → peso_leitura_kg`, `status_registrado → status_leitura` |
| `/alertas` | `alertas` | `id_alerta → id`, `id_leitura_sensor → id_leitura`, `data_hora_alerta → datahora_alerta`; `SIM/NAO → boolean` |

Os cadastros retornam uma entidade (`lote`, `fornecedor`, `material`, `producao`), também extraída pelo cliente. Materiais, lotes e produção usam HTTP 201; fornecedores usa HTTP 200.

O fornecedor exige `id_fornecedor` manual, `cnpj`, nome, telefone, e-mail e endereço. O lote envia `peso_recebido_kg` e `status_lote`, sem `id: null`.

O início de produção envia `id_lote`, `id_usuario` (identificador numérico do `sub` do JWT), `id_esteira`, `turno`, `status_producao`, `quantidade_entrada_kg`, `quantidade_saida_kg`, `rejeito_kg`, `data_inicio` e `itens`. A entrada corresponde ao peso do lote selecionado; saída e rejeito começam em zero.

## Dashboards e limitações de dados

Os três gráficos usam `balanco_massas_kg` do backend: `total_material_entrada`, `total_produzido_saida` e `total_rejeitos_perdas`. As consultas usam o dia, mês e trimestre atuais:

- Diário: `?data=DD/MM/AAAA`, codificada por `URLSearchParams`.
- Mensal: `?mes=1..12&ano=AAAA`.
- Trimestral: `?trimestre=1..4&ano=AAAA`.

`GET /producao` atualmente não inclui composição por material nem os itens do ciclo. `GET /materiais` é um catálogo e não substitui esse detalhamento. Por isso, o relatório de materiais informa a indisponibilidade desses pesos e os cartões do dashboard mostram “Não informado”. A estimativa de CO₂ depende desse detalhamento. Listas antigas com `tipo_material`, `peso_kg` e `data_hora` continuam compatíveis.

O histórico de telemetria não declara filtro por equipamento: o portal busca `/telemetria/historico` e filtra por `id_esteira` localmente.

## Falhas

401 com JWT encerra a sessão; 403 abre acesso negado. Falhas 404, de servidor, rede e timeout abrem as páginas de erro, exceto com `{ erroLocal: true }`, quando a tela mostra a falha localmente. Outros erros, como 409 e 422, ficam no formulário. O erro original é preservado em `cause`.

Use a API real configurada em `VITE_API_URL` também durante o desenvolvimento.

`api-contract.test.js` verifica os adaptadores e as rotas usadas pelo código.

## Modo de demonstração

Os mocks são opcionais: `npm run mock` inicia a API em memória, e `npm run dev:demo` abre o frontend na porta 5174 usando `.env.demo`. O frontend normal continua com a API real do `.env`. A troca é explícita, com sessões separadas por origem e identificação visual da demonstração. Veja [mocks/README.md](../../mocks/README.md).
