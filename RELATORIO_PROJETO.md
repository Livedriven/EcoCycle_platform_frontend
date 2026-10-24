# Relatório do Projeto — EcoCycle

**Data da análise:** 23 de outubro de 2026  
**Repositório analisado:** `EcoCycle_platform_frontend`  
**Escopo:** portal web da Equipe 1 (E1), responsável por monitorar uma usina de reciclagem de plástico e metal.

## Resumo executivo

O EcoCycle possui uma base técnica bem estruturada para um portal web multipágina: autenticação por JWT, controle de acesso por perfil, layout responsivo reutilizável, camada única de comunicação com API, mock local com RBAC e um dashboard funcional. O código está organizado por funcionalidade e os módulos compartilhados estão documentados.

No estado atual, o projeto é uma **fundação de MVP com login, segurança de sessão e dashboard entregues**, mas ainda não um portal completo conforme o escopo descrito no README. Produção, materiais, lotes, alertas e esteiras possuem HTML preparado ou telas de placeholder, porém ainda não têm a lógica de negócio no JavaScript. A suíte de testes também precisa de correção antes de poder ser usada como critério de aprovação.

## Objetivo e fronteiras da solução

O portal permite acompanhar dados de reciclagem pelo navegador. Ele deve consumir somente a API da Equipe 2 (E2); não acessa diretamente o banco, o ERP, o simulador do chão de fábrica ou o PWA.

O escopo documentado abrange login, dashboard, produção, materiais, lotes, alertas, status das esteiras e controle de acesso. No desenvolvimento local, uma API mock baseada em `json-server` simula autenticação, dados e autorização.

## Arquitetura e tecnologias

| Camada | Implementação |
|---|---|
| Aplicação | Vite 8 em arquitetura multipágina (MPA), HTML e módulos ES, sem framework de UI |
| Organização | `src/features/` por tela e `src/shared/` para serviços e utilitários reutilizáveis |
| Interface | Bootstrap 5, Bootstrap Icons, CSS próprio da EcoCycle |
| Dados e visualização | Chart.js, Grid.js e Day.js com localidade pt-BR |
| Integração | Wrapper `API` com Bearer token, JSON, timeout e tratamento centralizado de erros |
| Autenticação | JWT lido no cliente e validado/autorizado pelo mock/API |
| Desenvolvimento | `json-server`, middlewares próprios de autenticação e RBAC |
| Qualidade | ESLint e Vitest |

Os módulos compartilhados centralizam responsabilidades importantes: configuração, sessão, permissões, layout, tabelas, formatação e cálculos. Isso reduz duplicação e facilita a futura integração com a API real.

## Funcionalidades: escopo versus estado observado

| Área | Estado atual | Observação |
|---|---|---|
| Entrada e login | Implementado | Faz `POST /login`, valida/grava o JWT e apresenta erros de credenciais ou conexão. |
| Sessão e logout | Implementado | Monitora expiração, trata `401`, protege rotas e encerra sessão no logout. |
| Perfis e permissões | Implementado no front e no mock | Há quatro perfis e uma matriz centralizada; o mock replica as regras. |
| Layout e navegação | Implementado | Topo, menu responsivo, rodapé e itens condicionados por permissão. |
| Dashboard | Implementado | Carrega lotes, produção, fornecedores, alertas e esteiras; exibe indicadores, gráficos, alertas e status. |
| Produção diária | Estrutura pronta | HTML tem filtro e área de tabela, mas o JavaScript apenas monta o layout. |
| Materiais produzidos | Estrutura pronta | HTML tem cards, gráfico e tabela, mas ainda não carrega nem exibe dados. |
| Lotes | Estrutura pronta | Formulário, tabela e detalhe existem no HTML, sem lógica de listagem, cadastro ou detalhe. |
| Alertas | Não implementado | A tela informa que está em construção. |
| Status das esteiras | Não implementado | A tela informa que está em construção. |
| Usuários | Deliberadamente fora do MVP | A guarda de permissões envia todos os perfis para a página 403. |
| Páginas de erro | Parcial | A página 403 está integrada; 404 e indisponibilidade estão vazias e não entram explicitamente no build. |

O menu também confirma pendências: consultar/cadastrar fornecedores, cadastrar lote e iniciar produção ainda têm `href: null`.

## Regras de acesso atuais

| Ação | Administrador | Gerente | Operador | Consulta |
|---|---:|---:|---:|---:|
| Consultar dados | Sim | Sim | Sim | Sim |
| Cadastrar fornecedor | Sim | Sim | Não | Não |
| Registrar lote | Sim | Sim | Sim | Não |
| Iniciar/finalizar produção | Pendente | Pendente | Sim | Não |
| Gerenciar usuários pela interface | Não está no MVP | Não está no MVP | Não está no MVP | Não está no MVP |

A definição de acesso de administrador e gerente à operação de produção continua pendente. A decisão deve ser refletida tanto em `src/shared/session.js` quanto no backend real.

## Dados e ambiente de desenvolvimento

O mock local disponibiliza 5 fornecedores, 8 lotes, 1 esteira, 3 usuários, 76 registros de produção, 18 leituras de sensor, 7 alertas e 14 logs de sistema. Há contas de teste para administrador, gerente e operador; não foi encontrada conta de teste para o perfil de consulta.

O projeto usa `VITE_API_URL` e `VITE_API_TIMEOUT`. O arquivo `.env.example` contém apenas os nomes das variáveis, sem valores. Portanto, copiar o arquivo sem preenchê-lo não basta para executar a aplicação, apesar de o README sugerir esse fluxo.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| Estado do Git antes deste relatório | `main` limpo e sincronizado com `origin/main` |
| Dependências diretas | 15 resolvidas; lockfile presente |
| `npm run lint` | Aprovado, sem avisos |
| `npm test -- --run` | Reprovado: 33 testes passaram, mas 3 arquivos vazios não têm suíte de testes |
| `npm run build -- --outDir <temporário>` | Aprovado: 100 módulos transformados em aproximadamente 1,25 s |
| CI versionada | Não encontrada |

Os arquivos que tornam a execução de testes vermelha são `src/shared/formatters.test.js`, `src/shared/permissions.test.js` e `src/shared/validators.test.js`, todos vazios. Os testes efetivos cobrem cálculos e sessão; não foram identificados testes de interface, integração com mock ou ponta a ponta.

## Pontos de atenção e riscos

1. **Escopo documentado maior que a entrega funcional.** O README descreve as telas de negócio como disponíveis, enquanto boa parte delas ainda é estrutura ou placeholder. Isso deve ser corrigido no código ou documentado claramente como trabalho pendente.
2. **Gate de testes indisponível.** Embora 33 testes passem, o comando oficial falha pelos três arquivos vazios. Assim, uma validação automatizada de entrega não passa hoje.
3. **Integração com API real ainda depende de definições.** Permanecem pendentes contratos de login/logout, usuários, esteiras, filtros, paginação, nomes/unidades dos campos e distinção entre alerta ativo e histórico.
4. **Regras de negócio em aberto.** Os fatores de CO₂ são provisórios e a permissão de produção para administrador e gerente ainda não foi decidida.
5. **Cobertura e automação limitadas.** Não há cobertura mínima configurada, testes de UI/integração identificados ou pipeline de CI versionado para executar lint, testes e build a cada alteração.
6. **Preparação de produção incompleta.** As páginas 404 e indisponibilidade precisam ser integradas ao build/roteamento. Também convém declarar a versão mínima de Node no `package.json`, e não somente no README.

## Próximos passos recomendados

1. Concluir produção, materiais, lotes, alertas e esteiras, reutilizando `API`, `calculations`, `table` e `formatters` já existentes.
2. Corrigir a suíte: remover os arquivos vazios ou implementar testes para formatadores, validadores e permissões; adicionar um script determinístico como `vitest run`.
3. Validar manualmente os fluxos de login, logout, expiração de sessão, permissões e dashboard contra o mock; depois repetir a validação com a API E2.
4. Formalizar os contratos pendentes com E2 e as regras de negócio pendentes com E5/professor antes de implementar os fluxos dependentes.
5. Atualizar README e documentação para separar claramente funcionalidades entregues das planejadas.
6. Criar CI para executar lint, testes e build em pull requests e incluir `engines` no `package.json`.

## Limites desta análise

O relatório foi produzido a partir da inspeção do repositório, da execução local de lint, testes e build e da leitura do mock. Não incluiu validação com a API real, testes de usabilidade em navegador ou auditoria de segurança de infraestrutura.
