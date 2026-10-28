> Documento histórico de implementação. Para métodos, rotas, payloads e envelopes vigentes, consulte [o contrato da API](../../../docs/shared/api.md).

# Ajustes fora da pasta `start-production/`

## 1. `src/shared/validators.js` (hoje vazio)

```js
function resultado(valido, mensagem = '') {
    return { valido, mensagem };
}

export function validarObrigatorio(valor, rotulo) {
    const vazio = valor === null || valor === undefined || String(valor).trim() === '';
    return vazio ? resultado(false, rotulo + ' é obrigatório.') : resultado(true);
}

export function validarOpcao(valor, opcoes, rotulo) {
    return opcoes.map(String).includes(String(valor))
        ? resultado(true)
        : resultado(false, 'Selecione ' + rotulo + ' válido.');
}

// Chaves de `erros` = nomes do payload enviado à API.
export function validarProducao(dados, { turnos = [] } = {}) {
    const erros = {};

    const lote = validarObrigatorio(dados.id_lote, 'Lote');
    if (!lote.valido) erros.id_lote = lote.mensagem;

    const esteira = validarObrigatorio(dados.id_esteira, 'Esteira');
    if (!esteira.valido) erros.id_esteira = esteira.mensagem;

    const turno = validarObrigatorio(dados.turno, 'Turno');
    if (!turno.valido) erros.turno = turno.mensagem;
    else {
        const opcao = validarOpcao(dados.turno, turnos, 'um turno');
        if (!opcao.valido) erros.turno = opcao.mensagem;
    }

    return { valido: Object.keys(erros).length === 0, erros };
}
```

## 2. `src/shared/validators.test.js`

```js
import { describe, it, expect } from 'vitest';
import { validarObrigatorio, validarOpcao, validarProducao } from './validators.js';

const TURNOS = ['Manhã', 'Tarde', 'Noite'];

describe('validarObrigatorio', () => {
    it('aceita valor preenchido', () => {
        expect(validarObrigatorio('3', 'Lote')).toEqual({ valido: true, mensagem: '' });
    });
    it.each([['vazio', ''], ['null', null], ['espaços', '   ']])('rejeita %s', (_, valor) => {
        expect(validarObrigatorio(valor, 'Lote')).toEqual({ valido: false, mensagem: 'Lote é obrigatório.' });
    });
});

describe('validarOpcao', () => {
    it('aceita opção da lista', () => expect(validarOpcao('Tarde', TURNOS, 'um turno').valido).toBe(true));
    it('rejeita opção fora da lista', () => expect(validarOpcao('Madrugada', TURNOS, 'um turno').valido).toBe(false));
});

describe('validarProducao', () => {
    const ok = { id_lote: '8', id_esteira: '1', turno: 'Manhã' };
    it('aceita dados completos', () => {
        expect(validarProducao(ok, { turnos: TURNOS })).toEqual({ valido: true, erros: {} });
    });
    it('devolve todos os erros de uma vez', () => {
        const r = validarProducao({ id_lote: '', id_esteira: '', turno: '' }, { turnos: TURNOS });
        expect(r.valido).toBe(false);
        expect(Object.keys(r.erros)).toEqual(['id_lote', 'id_esteira', 'turno']);
    });
    it('rejeita turno fora da lista', () => {
        expect(validarProducao({ ...ok, turno: 'Madrugada' }, { turnos: TURNOS }).erros.turno).toBeDefined();
    });
});
```

## 3. `vite.config.js`: uma linha nova na lista de entradas

Siga o padrão das entradas existentes, apontando para
`src/features/start-production/start-production.html`.

## 4. `MENU` em `src/shared/layout.js`: dentro do grupo "Lotes"

```js
{ rotulo: 'Iniciar produção', href: '/src/features/start-production/start-production.html', acao: 'producao.operar' }
```
