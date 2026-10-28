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

O mock oferece as rotas atuais sob `/api`, com os mesmos envelopes e nomes de campos dos cadastros. Rotas antigas como `/esteiras` e `/leituras_sensor` são recusadas. O histórico usa `/telemetria/historico`; os equipamentos usam `/equipamentos`.

Os exemplos de produção incluem `tipo_material` para demonstrar o relatório e a estimativa de CO₂. Esse detalhamento ainda não é fornecido pela listagem do backend real; o frontend mantém a indicação de indisponibilidade quando ele não existe.
Os comandos IoT são simplificados: cada envio grava uma leitura em memória, sem reproduzir o intervalo de consolidação de 40 minutos do backend.

`npm run build:demo` gera uma versão local separada em `dist-demo/`, apontando para o mock em localhost. A versão normal fica em `dist/`.
