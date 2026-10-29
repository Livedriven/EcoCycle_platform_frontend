import { arredondar, co2Evitado } from '../../shared/calculations.js';

export const MATERIAIS = { plastico: 'Plástico', metal: 'Metal', aluminio: 'Alumínio', rejeito: 'Rejeito' };
const INDICADORES = { diario: 'aproveitamento_percentual', mensal: 'detalhamento_mensal', trimestral: 'detalhamento_trimestral' };
const dois = (valor) => String(valor).padStart(2, '0');
const diaLocal = (data) => `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;

export function numeroValido(valor) {
    return (typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== ''))
        && Number.isFinite(Number(valor)) && Number(valor) >= 0;
}

export function diaValido(valor) {
    const dia = typeof valor === 'string' ? valor.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
    const data = new Date(dia + 'T00:00:00Z');
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === dia ? dia : null;
}

/** Um único calendário local alimenta todos os blocos de uma atualização. */
export function criarContexto(tipo = 'mensal', hoje = new Date()) {
    if (!Object.hasOwn(INDICADORES, tipo)) throw new Error('Período inválido.');
    const ano = hoje.getFullYear(), mes = hoje.getMonth() + 1;
    const trimestre = Math.ceil(mes / 3);
    const dia = diaLocal(hoje);
    const consultas = {
        diario: new URLSearchParams({ data: dia.split('-').reverse().join('/') }).toString(),
        mensal: new URLSearchParams({ mes, ano }).toString(),
        trimestral: new URLSearchParams({ trimestre, ano }).toString(),
    };
    const primeiroMes = tipo === 'trimestral' ? (trimestre - 1) * 3 : mes - 1;
    const inicio = tipo === 'diario' ? dia : diaLocal(new Date(ano, primeiroMes, 1));
    const fim = tipo === 'diario' ? dia : diaLocal(new Date(ano, primeiroMes + (tipo === 'trimestral' ? 3 : 1), 0));
    return {
        tipo, inicio, fim, chave: `${tipo}:${inicio}:${fim}`,
        rotas: Object.fromEntries(Object.entries(consultas).map(([periodo, query]) => [periodo, `/producao/dashboard-${periodo}?${query}`])),
        materiais: `/producao/materiais?${consultas[tipo]}`,
    };
}

function numero(valor) {
    if (!numeroValido(valor)) throw new Error('Resposta inválida da API.');
    return Number(valor);
}

export function lerConsolidado(resposta, tipo) {
    const massas = resposta?.balanco_massas_kg;
    return {
        entrada: numero(massas?.total_material_entrada),
        saida: numero(massas?.total_produzido_saida),
        rejeito: numero(massas?.total_rejeitos_perdas),
        aproveitamento: numero(resposta?.indicadores_desempenho?.[INDICADORES[tipo]]),
    };
}

export function lerMateriais(resposta) {
    const totais = resposta?.totais_por_material_kg;
    return Object.fromEntries(Object.entries(MATERIAIS).map(([chave, nome]) => [nome, numero(totais?.[chave])]));
}

/** Mantém a metodologia compartilhada atual; alumínio e rejeito não têm fatores. */
export function estimarCo2(totais) {
    return co2Evitado(Object.entries(totais).map(([tipo_material, peso_kg]) => ({ tipo_material, peso_kg })));
}

export function filtrarRecebimentos(lotes, contexto) {
    if (!Array.isArray(lotes)) throw new Error('Lista de lotes inválida.');
    const registros = [];
    let descartados = 0;
    for (const lote of lotes) {
        const dia = diaValido(lote?.data_entrada);
        if (!dia) { descartados++; continue; }
        if (dia < contexto.inicio || dia > contexto.fim) continue;
        if (!numeroValido(lote.peso_recebido_kg)) { descartados++; continue; }
        registros.push({ ...lote, peso_recebido_kg: Number(lote.peso_recebido_kg) });
    }
    return { registros, descartados, total: arredondar(registros.reduce((soma, lote) => soma + lote.peso_recebido_kg, 0)) };
}

export function agruparFornecedores(registros, fornecedores) {
    if (!Array.isArray(fornecedores)) throw new Error('Lista de fornecedores inválida.');
    const nomes = new Map(fornecedores.map((f) => [String(f.id_fornecedor ?? f.id), f.nome_fornecedor]));
    const grupos = new Map();
    for (const lote of registros) {
        const id = String(lote.id_fornecedor ?? '');
        const grupo = grupos.get(id) ?? { nome: nomes.get(id) || 'Fornecedor não identificado', total: 0 };
        grupo.total += lote.peso_recebido_kg;
        grupos.set(id, grupo);
    }
    return [...grupos.values()].map((g) => ({ ...g, total: arredondar(g.total) })).sort((a, b) => b.total - a.total);
}
