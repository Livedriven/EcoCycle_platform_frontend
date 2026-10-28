# Demonstração local

O backend real é o padrão. Para demonstrar o frontend quando ele estiver indisponível, abra dois terminais:

```bash
# Terminal 1: API simulada, somente em localhost:3000
npm run mock

# Terminal 2: frontend de demonstração em localhost:5174
npm run dev:demo
```

Entre com `admin`, `gerente1` ou `operador1`, usando a senha `ecocycle123`.
O aviso “Modo demonstração — dados simulados” identifica todas as páginas.

- `npm run dev` e `npm run build` continuam usando a API configurada no `.env`, com padrão `http://localhost:8000/api`.
- `.env.demo` é carregado somente por `dev:demo` e `build:demo`; o `.env` da API real permanece intacto.
- A porta 5174 separa a sessão do frontend normal, que usa a porta 5173. Feche a demonstração e volte ao frontend normal para retomar o backend real.
- As falhas da API real seguem o tratamento de erro normal. A seleção do ambiente de demonstração é feita pelos comandos acima.
- Cada execução do mock cria um banco em memória. Cadastros, leituras e logout afetam somente esse processo. Reinicie `npm run mock` para restaurar os exemplos.
- Os fixtures de `db.json` são preservados. As datas são ajustadas em memória para haver produção no dia da demonstração.

O mock oferece as rotas atuais sob `/api`, com os mesmos envelopes e nomes de campos dos cadastros. Rotas antigas como `/equipamentos` e `/leituras_sensor` são recusadas. O histórico usa `/telemetria/historico`; as esteiras usam `/esteiras`. As atualizações parciais (`PATCH /esteiras/:id`, `/lotes/:id`, `/producao/:id` e `/alertas/:id`) e o cadastro de esteiras seguem os perfis do backend; o relatório `GET /producao/materiais` não é simulado, pois o portal calcula a composição a partir de `/producao` e `/materiais`.

Os exemplos de produção expõem `itens` aninhados e um catálogo com os tipos `plastico`, `metal` e `aluminio`, como a listagem do backend real. O relatório resolve os IDs pelo catálogo e conta `rejeito_kg` uma vez por ciclo. Os antigos campos `tipo_material` dos fixtures são convertidos apenas na cópia em memória, sem permanecer no ciclo devolvido pela API.
Os comandos IoT são simplificados: cada envio grava uma leitura em memória, sem reproduzir o intervalo de consolidação de 40 minutos do backend.

`npm run build:demo` gera uma versão local separada em `dist-demo/`, apontando para o mock em localhost. A versão normal fica em `dist/`.
