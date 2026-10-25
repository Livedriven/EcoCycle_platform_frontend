// features/alerts/alerts-filters.js
// Lógica pura da tela de alertas: junta alertas, leituras e esteiras e aplica os filtros.
// Não busca dados nem mexe na tela, por isso tem testes (alerts-filters.test.js).

export const ESTADO = { TODOS: 'todos', ATIVOS: 'ativos', HISTORICO: 'historico' };

/** Remove acentos, diferença entre maiúsculas/minúsculas e espaços excedentes. */
export function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLocaleLowerCase('pt-BR')
        .trim()
        .replace(/\s+/g, ' ');
}

/** O mock devolve "true"/"false" como texto; a API real pode devolver boolean. */
export function estaResolvido(valor) {
    return valor === true || valor === 'true';
}

function diaDe(dataHora) {
    return String(dataHora ?? '').slice(0, 10);
}

/**
 * Acrescenta a cada alerta os dados da leitura que o gerou e o nome da esteira.
 * O alerta não guarda a esteira: ele aponta para uma leitura, que aponta para a esteira.
 */
export function enriquecerAlertas(alertas, leituras, esteiras) {
    const leituraPorId = new Map((leituras ?? []).map((leitura) => [String(leitura.id), leitura]));
    const esteiraPorId = new Map((esteiras ?? []).map((esteira) => [String(esteira.id), esteira]));

    return (alertas ?? []).map((alerta) => {
        const leitura = leituraPorId.get(String(alerta.id_leitura));
        const esteira = leitura ? esteiraPorId.get(String(leitura.id_esteira)) : undefined;
        const ativo = !estaResolvido(alerta.resolvido);

        return {
            ...alerta,
            ativo,
            situacao: ativo ? 'Ativo' : 'Resolvido',
            nome_esteira: esteira?.nome_esteira ?? '',
            temperatura_leitura_c: leitura?.temperatura_leitura_c ?? null,
            peso_leitura_kg: leitura?.peso_leitura_kg ?? null,
            material_leitura: leitura?.material_leitura ?? ''
        };
    });
}

/** Mais recentes primeiro. */
export function ordenarMaisRecentes(alertas) {
    return [...alertas].sort((a, b) => String(b.datahora_alerta).localeCompare(String(a.datahora_alerta)));
}

/** Tipos de alerta que existem nos dados, em ordem alfabética, para montar o filtro. */
export function tiposDeAlerta(alertas) {
    return [...new Set((alertas ?? []).map((alerta) => alerta.tipo_alerta).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function camposDaBusca(alerta) {
    const dia = diaDe(alerta.datahora_alerta);
    const diaFormatado = dia ? dia.split('-').reverse().join('/') : '';

    return [
        alerta.id,
        'alerta ' + alerta.id,
        alerta.tipo_alerta,
        alerta.situacao,
        alerta.nome_esteira,
        alerta.id_leitura,
        'leitura ' + alerta.id_leitura,
        alerta.material_leitura,
        dia,
        diaFormatado
    ].map(normalizarTexto);
}

function correspondeBusca(alerta, busca) {
    const termos = normalizarTexto(busca).split(' ').filter(Boolean);
    if (termos.length === 0) {
        return true;
    }

    const campos = camposDaBusca(alerta);
    return termos.every((termo) => {
        // Número solto é identificador e precisa ser exato: "1" não pode achar o alerta 12.
        if (/^\d+$/.test(termo)) {
            return campos.some((campo) => campo === termo || campo.split(/[^a-z0-9]+/).includes(termo));
        }
        return campos.some((campo) => campo.includes(termo));
    });
}

/**
 * Aplica todos os filtros da tela sobre a lista já carregada.
 * filtros: { estado, tipo, de, ate, busca }, com datas no formato AAAA-MM-DD.
 */
export function filtrarAlertas(alertas, filtros = {}) {
    const { estado = ESTADO.TODOS, tipo = '', de = '', ate = '', busca = '' } = filtros;

    return alertas.filter((alerta) => {
        const dia = diaDe(alerta.datahora_alerta);

        return (
            (estado !== ESTADO.ATIVOS || alerta.ativo) &&
            (estado !== ESTADO.HISTORICO || !alerta.ativo) &&
            (!tipo || alerta.tipo_alerta === tipo) &&
            (!de || dia >= de) &&
            (!ate || dia <= ate) &&
            correspondeBusca(alerta, busca)
        );
    });
}
