# Consultar fornecedores: ajustes fora de `src/features/suppliers/`

Branch sugerida: `feature/consultar-fornecedores`, criada a partir da `main` atualizada.
Arquivos novos da tela, em `src/features/suppliers/` (a pasta já existe):
`suppliers.html`, `suppliers.js`, `suppliers-filter.js` e `suppliers-filter.test.js`.

Os PRs do cadastro de fornecedor já estão na `main`, então **nada aqui depende de PR pendente**.
O conflito só aparece se alguém tiver outro PR aberto nos mesmos arquivos.

## Resumo

| Arquivo | O que muda | Conflito esperado |
|---|---|---|
| `vite.config.js` | 1 linha para `suppliers.html` | Certo se houver outro PR acrescentando página: mantenha as duas linhas |
| `src/shared/layout.js` (`MENU`) | `href` do item "Consultar fornecedores" | Baixo |
| `src/shared/formatters.js` | `formatCnpj` e `formatTelefone` | Médio: o arquivo mudou na `main` recentemente |
| `src/shared/formatters.test.js` | Testes dessas duas funções | Médio, pelo mesmo motivo |
| `docs/shared/formatters.md` | Documentar as duas funções | Médio |
| `docs/arquiteture.md` | Linha da tela na tabela de telas | Baixo |
| `session.js`, `api.js`, `table.js` | **Nada**: consultar vale para todos os perfis | Nenhum |

## 0. Confira antes: as funções de formatação já existem?

```
findstr /n "export" src\shared\formatters.js
```

- Se **`formatCnpj` e `formatTelefone` já existirem**, pule as seções 3 e 4 e só confira se a saída é igual à do exemplo (`12.345.678/0001-95` e `(31) 98881-0001`). Duplicar o `export` quebra o build.
- Se existirem com **outro nome**, troque o nome no `import` do `suppliers.js`.
- Se não existirem, siga as seções abaixo.

## 1. `vite.config.js`

Acrescente antes do comentário `// uma linha por página`:

```javascript
        suppliers: resolve(__dirname, './src/features/suppliers/suppliers.html'),
```

## 2. `MENU` em `src/shared/layout.js`

O item provavelmente já existe com `href: null`. Troque só o `href`. **Não** coloque `acao`, porque consultar vale para todos os perfis:

```js
{ rotulo: 'Consultar fornecedores', href: '/src/features/suppliers/suppliers.html' }
```

## 3. `src/shared/formatters.js` (acrescentar no fim)

```js
export function formatCnpj(valor) {
    const d = String(valor ?? '').replace(/\D/g, '');
    return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : String(valor ?? '');
}

export function formatTelefone(valor) {
    const d = String(valor ?? '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    return String(valor ?? '');
}
```

Valores que não têm o tamanho esperado voltam como vieram, e `null` vira texto vazio.

## 4. `src/shared/formatters.test.js` (acrescentar no fim)

Inclua `formatCnpj` e `formatTelefone` na linha de `import` que já existe no topo do arquivo, **sem apagar** a linha do Vitest:

```js
describe('formatCnpj', () => {
    it('aplica a máscara em 14 dígitos', () => {
        expect(formatCnpj('12345678000195')).toBe('12.345.678/0001-95');
    });
    it('mantém o que não é um CNPJ de 14 dígitos e trata vazio', () => {
        expect(formatCnpj('123')).toBe('123');
        expect(formatCnpj(null)).toBe('');
        expect(formatCnpj(undefined)).toBe('');
    });
});

describe('formatTelefone', () => {
    it('formata celular (11) e fixo (10)', () => {
        expect(formatTelefone('31988810001')).toBe('(31) 98881-0001');
        expect(formatTelefone('3133883344')).toBe('(31) 3388-3344');
    });
    it('mantém tamanhos inesperados e trata vazio', () => {
        expect(formatTelefone('123')).toBe('123');
        expect(formatTelefone(null)).toBe('');
    });
});
```

## 5. Documentação (regra 8 da arquitetura)

- `docs/shared/formatters.md`: uma linha por função na tabela, com exemplo (`formatCnpj('12345678000195')` → `"12.345.678/0001-95"`).
- `docs/arquiteture.md`: na tabela de telas, deixe `suppliers` cobrindo as duas telas: `suppliers | Consulta e cadastro de fornecedores | GET e POST /fornecedores`.

## 6. Opcional: botão Cancelar do cadastro

Hoje o **Cancelar** de `new-supplier.js` volta ao dashboard. Para voltar à lista, troque `HOME_URL` por `'/src/features/suppliers/suppliers.html'`. É uma linha em arquivo que já está na `main`, então faça em commit separado e cite no PR.

## 7. Decisões de design (citar no PR)

- **Coluna Ações:** só o desenho do wireframe (ícones de editar e excluir, sem função). Editar e excluir fornecedor estão fora do MVP, e a API não oferece `PUT` e `DELETE` com 403.
- **Filtro de cidade:** não há campo de cidade, então ela é lida do **fim do endereço** em `Cidade/UF` ou `Cidade - UF`. Endereços fora desse padrão aparecem em "Todas", mas não nas cidades. Se isso incomodar, a saída é pedir um campo próprio à E2.
- **"Ordenado por: Mais recentes":** não há data de cadastro, então ordena por `id` decrescente. Por isso a ordenação por clique nas colunas ficou desligada.
- **Busca:** por nome, e-mail, CNPJ e telefone, sem diferenciar acento e maiúsculas. CNPJ e telefone comparam só os dígitos, a partir de 3 digitados.
- **Busca e paginação:** a busca do Grid.js fica desligada (`busca: false`) em favor da busca da tela, e a paginação continua a do `table.js`.
