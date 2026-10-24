# Cadastrar fornecedor: ajustes fora de `src/features/suppliers/`

Branch: `feature/cadastrar-fornecedor`, criada a partir da `main`.
Arquivos novos da tela: `src/features/suppliers/new-supplier.html` e `new-supplier.js`.

## Resumo: o que dependia do PR de Iniciar produção (já entrou na `main`)

| Arquivo | O que muda | Depende do PR? | Conflito esperado |
|---|---|---|---|
| `src/features/suppliers/*` | Tela nova | Não | Nenhum |
| `src/shared/validators.js` | `validarCnpj`, `validarTelefone`, `validarEmail`, `validarTexto`, `validarFornecedor` | **Sim**: usa `resultado` e `validarObrigatorio`, que só existem no PR | **Alto**: na `main` o arquivo está vazio, e os dois PRs escrevem nele |
| `src/shared/validators.test.js` | Testes das funções novas | **Sim**: mesma razão | **Alto**: a linha de `import` e o fim do arquivo |
| `vite.config.js` | 1 linha para a página | Não | **Certo**: a linha entra no mesmo ponto da `startProduction` |
| `src/shared/layout.js` (`MENU`) | `href` do item "Cadastrar fornecedor" | Não | Baixo: linha diferente da `Iniciar produção` |
| `src/shared/formatters.js` | `formatCnpj` e `formatTelefone` (opcional) | Não | Baixo |
| `docs/shared/validators.md`, `docs/arquiteture.md` | Atualizar documentação | Sim (`validators.md`) | Médio |
| `session.js`, `mocks/rbac.cjs` | **Nada**: `fornecedor.cadastrar` já existe (administrador e gerente) | Não | Nenhum |

## Ordem sugerida para não dar problema

1. Faça agora só o que está em `features/suppliers/`. Não depende de ninguém.
2. Enquanto o PR da produção não entra na `main`, **não commite** os ajustes de `validators.js` e `validators.test.js`.
3. Quando o PR entrar: `git fetch origin` e `git merge origin/main` na sua branch. Depois acrescente o bloco de validadores **no fim** do arquivo, depois do `validarProducao`, e os testes no fim do teste.
4. A linha do `vite.config.js` pode entrar a qualquer hora. Se der conflito, mantenha as duas linhas.
5. Se o PR da produção demorar muito, a alternativa é escrever as funções num bloco separado e resolver o conflito no merge. Os dois lados só acrescentam código.

## 1. `src/shared/validators.js` (depende do PR)

Acrescentar **depois** das funções que o PR já criou (`resultado`, `validarObrigatorio`, `validarOpcao`, `validarProducao`). Não duplique `resultado`.

```js
export function validarTexto(valor, rotulo, minimo, maximo) {
    const texto = String(valor ?? '').trim();
    if (texto.length < minimo) {
        return resultado(false, rotulo + ' deve ter pelo menos ' + minimo + ' caracteres.');
    }
    if (texto.length > maximo) {
        return resultado(false, rotulo + ' deve ter no máximo ' + maximo + ' caracteres.');
    }
    return resultado(true);
}

// Aceita com ou sem máscara (12.345.678/0001-95 ou 12345678000195).
export function validarCnpj(cnpj) {
    const digitos = String(cnpj ?? '').replace(/\D/g, '');
    const invalido = resultado(false, 'Informe um CNPJ válido.');
    if (digitos.length !== 14 || /^(\d)\1+$/.test(digitos)) return invalido;

    const dv = (base) => {
        const pesos = base.length === 12
            ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
            : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const soma = [...base].reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };
    const d1 = dv(digitos.slice(0, 12));
    const d2 = dv(digitos.slice(0, 12) + d1);
    return d1 === Number(digitos[12]) && d2 === Number(digitos[13]) ? resultado(true) : invalido;
}

// Campo opcional: vazio é válido. Preenchido, precisa de DDD + 8 ou 9 dígitos.
export function validarTelefone(telefone) {
    const digitos = String(telefone ?? '').replace(/\D/g, '');
    if (digitos === '') return resultado(true);
    return digitos.length === 10 || digitos.length === 11
        ? resultado(true)
        : resultado(false, 'Informe o telefone com DDD (10 ou 11 dígitos).');
}

// Campo opcional: vazio é válido.
export function validarEmail(email) {
    const texto = String(email ?? '').trim();
    if (texto === '') return resultado(true);
    return texto.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)
        ? resultado(true)
        : resultado(false, 'Informe um e-mail válido.');
}

// Chaves de `erros` = nomes do payload enviado à API (POST /fornecedores).
export function validarFornecedor(dados) {
    const erros = {};

    const nomeObrigatorio = validarObrigatorio(dados.nome_fornecedor, 'Nome do fornecedor');
    if (!nomeObrigatorio.valido) erros.nome_fornecedor = nomeObrigatorio.mensagem;
    else {
        const nome = validarTexto(dados.nome_fornecedor, 'Nome do fornecedor', 2, 80);
        if (!nome.valido) erros.nome_fornecedor = nome.mensagem;
    }

    const cnpjObrigatorio = validarObrigatorio(dados.cnpj_fornecedor, 'CNPJ');
    if (!cnpjObrigatorio.valido) erros.cnpj_fornecedor = cnpjObrigatorio.mensagem;
    else {
        const cnpj = validarCnpj(dados.cnpj_fornecedor);
        if (!cnpj.valido) erros.cnpj_fornecedor = cnpj.mensagem;
    }

    const telefone = validarTelefone(dados.telefone_fornecedor);
    if (!telefone.valido) erros.telefone_fornecedor = telefone.mensagem;

    const email = validarEmail(dados.email_fornecedor);
    if (!email.valido) erros.email_fornecedor = email.mensagem;

    // Endereço é opcional; se preenchido, limite de tamanho.
    if (String(dados.endereco_fornecedor ?? '').trim() !== '') {
        const endereco = validarTexto(dados.endereco_fornecedor, 'Endereço', 5, 200);
        if (!endereco.valido) erros.endereco_fornecedor = endereco.mensagem;
    }

    return { valido: Object.keys(erros).length === 0, erros };
}
```

**Regras que adotei (confirme com o grupo):**
- Obrigatórios: nome e CNPJ (só esses têm `*` no wireframe).
- Opcionais: telefone, e-mail e endereço.
- O CEP **não entra** no validador nem no payload nesta versão.
- Os validadores aceitam o valor com máscara. A tela remove a máscara **antes de montar o payload**, porque o banco guarda só dígitos (`"cnpj_fornecedor": "12345678000195"`, `"telefone_fornecedor": "31988810001"`).

## 2. `src/shared/validators.test.js` (depende do PR)

Depois do PR, a linha de `import` que o PR criou precisa receber os nomes novos:

```js
import {
    validarObrigatorio, validarOpcao, validarProducao,
    validarTexto, validarCnpj, validarTelefone, validarEmail, validarFornecedor
} from './validators.js';
```

Acrescentar no fim do arquivo:

```js
describe('validarTexto', () => {
    it('aceita texto dentro dos limites', () => {
        expect(validarTexto('Ab', 'Nome', 2, 5).valido).toBe(true);
    });
    it('ignora espaços nas extremidades', () => {
        expect(validarTexto('  A  ', 'Nome', 2, 5).valido).toBe(false);
    });
    it('rejeita texto curto e longo demais', () => {
        expect(validarTexto('A', 'Nome', 2, 5).mensagem).toBe('Nome deve ter pelo menos 2 caracteres.');
        expect(validarTexto('abcdef', 'Nome', 2, 5).mensagem).toBe('Nome deve ter no máximo 5 caracteres.');
    });
});

describe('validarCnpj', () => {
    it.each(['12345678000195', '12.345.678/0001-95', '11.222.333/0001-81'])('aceita %s', (cnpj) => {
        expect(validarCnpj(cnpj).valido).toBe(true);
    });
    it.each([['dígito errado', '12345678000196'], ['curto', '123'], ['repetido', '00000000000000'], ['vazio', ''], ['null', null], ['letras', 'abcdefghijklmn']])('rejeita %s', (_, cnpj) => {
        expect(validarCnpj(cnpj)).toEqual({ valido: false, mensagem: 'Informe um CNPJ válido.' });
    });
});

describe('validarTelefone', () => {
    it.each(['', null, '31988810001', '(31) 8881-0001', '3188810001'])('aceita %s', (tel) => {
        expect(validarTelefone(tel).valido).toBe(true);
    });
    it.each(['123', '31988810', '319888100011'])('rejeita %s', (tel) => {
        expect(validarTelefone(tel).valido).toBe(false);
    });
});

describe('validarEmail', () => {
    it.each(['', null, 'contato@empresa.com.br'])('aceita %s', (email) => {
        expect(validarEmail(email).valido).toBe(true);
    });
    it.each(['semarroba', 'a@b', 'a b@c.com'])('rejeita %s', (email) => {
        expect(validarEmail(email)).toEqual({ valido: false, mensagem: 'Informe um e-mail válido.' });
    });
});

describe('validarFornecedor', () => {
    const ok = { nome_fornecedor: 'Recicla Norte Ltda', cnpj_fornecedor: '12345678000195' };
    it('aceita só nome e CNPJ', () => {
        expect(validarFornecedor(ok)).toEqual({ valido: true, erros: {} });
    });
    it('aceita todos os campos preenchidos', () => {
        const dados = { ...ok, telefone_fornecedor: '31988810001', email_fornecedor: 'a@b.com', endereco_fornecedor: 'Rua das Acácias, 120' };
        expect(validarFornecedor(dados).valido).toBe(true);
    });
    it('devolve todos os erros de uma vez', () => {
        const r = validarFornecedor({ nome_fornecedor: '', cnpj_fornecedor: '', telefone_fornecedor: '1', email_fornecedor: 'x' });
        expect(Object.keys(r.erros)).toEqual(['nome_fornecedor', 'cnpj_fornecedor', 'telefone_fornecedor', 'email_fornecedor']);
    });
    it('rejeita CNPJ com dígito verificador errado', () => {
        expect(validarFornecedor({ ...ok, cnpj_fornecedor: '12345678000196' }).erros.cnpj_fornecedor).toBeDefined();
    });
});
```

## 3. `vite.config.js` (independente, conflito certo)

Acrescente **antes** do comentário `// uma linha por página`:

```js
        newSupplier: resolve(__dirname, './src/features/suppliers/new-supplier.html'),
```

A linha `startProduction` do outro PR entra no mesmo lugar. Se der conflito, mantenha as duas e apague os marcadores `<<<<<<<`, `=======` e `>>>>>>>`.

## 4. `MENU` em `src/shared/layout.js` (independente)

O item "Cadastrar fornecedor" provavelmente já existe com `href: null`. Só troque o `href` e **mantenha** o `acao`:

```js
{ rotulo: 'Cadastrar fornecedor', href: '/src/features/suppliers/new-supplier.html', acao: 'fornecedor.cadastrar' }
```

Se o item não existir, acrescente-o no grupo "Fornecedores".

## 5. `src/shared/formatters.js` (opcional, independente)

Só é necessário se a tela mostrar a máscara ao sair do campo, ou na tela "Consultar fornecedores". A primeira versão pode aceitar o que a pessoa digitar e remover a máscara no envio, **sem** esta mudança.

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

Se entrar, acrescente testes em `formatters.test.js` (se existir) e uma linha em `docs/shared/formatters.md`.

## 6. Documentação (regra 8 da arquitetura)

- `docs/shared/validators.md`: listar as funções novas e o composto `validarFornecedor`. Esse arquivo também é tocado pelo PR da produção, então o conflito é provável. Mantenha os dois lados.
- `docs/arquiteture.md`: acrescentar a pasta `suppliers/` na árvore e uma linha na tabela de telas: `suppliers | Cadastro de fornecedores | POST /fornecedores`.

## 7. O que **não** precisa mudar

- **Permissão:** `fornecedor.cadastrar` já existe em `session.js` e em `mocks/rbac.cjs`. Use `montarLayout({ acao: 'fornecedor.cadastrar' })`. Operador e consulta caem na página 403.
- **`api.js`:** `API.POST('/fornecedores', payload)`. O mock já libera para administrador e gerente.
- **Estilos:** só Bootstrap e as classes da EcoCycle (`.btn-eco`, `.estado`, `.conteudo`), sem CSS novo.

## 8. Pontos a combinar com a E2 e o dono do mock

- **CNPJ duplicado:** o mock grava CNPJ repetido sem reclamar. A API real deve recusar, provavelmente com `409`, e o `api.js` mostraria só "HTTP 409". Combine o formato da mensagem de erro.
- **Nomes dos campos (confirmado):** o banco grava `cnpj_fornecedor`, `nome_fornecedor`, `telefone_fornecedor`, `email_fornecedor` e `endereco_fornecedor`. O payload usa exatamente esses nomes.
- **CNPJ sem máscara:** confirme que a API espera só dígitos.
- **Responsável pela ação:** o `id_usuario` não vai no corpo; a API pega do token.

## 9. CEP (entra nesta entrega, dentro da feature)

A busca por CEP é usada só nesta tela, então **não** cria arquivo em `shared/` e não altera `validators.js`:

- `src/features/suppliers/cep.js`: `buscarCep`, `validarCep`, `formatarCep` e `montarEndereco`.
- `src/features/suppliers/cep.test.js`: testes dessas funções, com o `fetch` simulado.
- O CEP **não entra** no payload nem no `validarFornecedor`.

Pontos para citar no PR:
- O ViaCEP é um serviço externo, e não a API da plataforma (E2). Por isso o `fetch` fica isolado no `cep.js` e **não** usa o `api.js`, que enviaria o token JWT a um terceiro. É uma exceção à regra 4 da arquitetura, e vale a revisão concordar.
- Se o serviço falhar ou o CEP não existir, o campo de endereço continua editável à mão.
- Se mais de uma tela passar a precisar de CEP, o `cep.js` sobe para `src/shared/` com um `docs/shared/cep.md`.
