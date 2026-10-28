// shared/calculations.js
// Único lugar onde os totais são calculados (dashboard, produção e materiais).
// Recebe listas já carregadas e devolve números: não busca dados (api.js) nem mexe na tela.
// Se a API real trouxer outros nomes de campo, é só ajustar CAMPOS aqui.

export const CAMPOS = {
    pesoProducao: "peso_kg",
    materialProducao: "tipo_material",
    dataProducao: "data_hora",
    idLoteProducao: "id_lote",
    pesoLote: "pesoentrada_kg",
    idFornecedorLote: "id_fornecedor",
    statusLote: "status",
    idFornecedor: "id",
    nomeFornecedor: "nome_fornecedor",
    resolvidoAlerta: "resolvido"
};

export const MATERIAIS = ["Plástico", "Metal"];
// Relatório completo; os cálculos existentes do dashboard mantêm seu padrão atual.
export const MATERIAIS_RELATORIO = [...MATERIAIS, "Alumínio", "Rejeito"];

// Fatores PROVISÓRIOS (kg de CO₂e evitados por kg reciclado), a confirmar com o professor.
export const FATORES_CO2 = { "Plástico": 1.5, "Metal": 4.0 };

const CASAS_DECIMAIS = 2;

/** Arredonda na saída; as somas internas ficam sem arredondar. */
export function arredondar(valor, casas = CASAS_DECIMAIS) {
    const fator = 10 ** casas;
    return Math.round((Number(valor) + Number.EPSILON) * fator) / fator;
}

/** Soma o campo numérico de uma lista. Valores inválidos contam como zero. */
export function somar(registros, campo) {
    return (registros ?? []).reduce((total, r) => {
        const n = Number(r?.[campo]);
        return total + (Number.isFinite(n) ? n : 0);
    }, 0);
}

/** "2026-10-14T10:00:00" ou "2026-10-14" -> "2026-10-14" */
function chaveDia(texto) {
    return String(texto ?? "").slice(0, 10);
}

function paraChaveDia(data) {
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Total recebido nos lotes (kg). */
export function totalRecebido(lotes) {
    return arredondar(somar(lotes, CAMPOS.pesoLote));
}

/** Total produzido, somando todos os materiais (kg). */
export function totalProduzido(producao) {
    return arredondar(somar(producao, CAMPOS.pesoProducao));
}

/** Totais em kg para os materiais solicitados; categorias sem registros vêm com zero. */
export function totalPorMaterial(producao, materiais = MATERIAIS) {
    const totais = {};
    materiais.forEach((material) => {
        const doMaterial = (producao ?? []).filter((r) => r[CAMPOS.materialProducao] === material);
        totais[material] = arredondar(somar(doMaterial, CAMPOS.pesoProducao));
    });
    return totais;
}

/** Uma linha por lote e dia, somando todos os turnos e esteiras. Recebe registros validados. */
export function materiaisPorLoteDia(producao) {
    const grupos = new Map();
    (producao ?? []).forEach((registro) => {
        const idLote = String(registro[CAMPOS.idLoteProducao]);
        const data = chaveDia(registro[CAMPOS.dataProducao]);
        const chave = JSON.stringify([idLote, data]);
        if (!grupos.has(chave)) grupos.set(chave, { id_lote: idLote, data, registros: [] });
        grupos.get(chave).registros.push(registro);
    });

    return [...grupos.values()].map(({ id_lote, data, registros }) => {
        const totais = totalPorMaterial(registros, MATERIAIS_RELATORIO);
        return { id_lote, data, plastico: totais['Plástico'], metal: totais.Metal, aluminio: totais['Alumínio'], rejeito: totais.Rejeito };
    }).sort((a, b) => b.data.localeCompare(a.data) || a.id_lote.localeCompare(b.id_lote, 'pt-BR', { numeric: true }));
}

/** Agrupa a produção por chave (dia ou mês) e material, mantendo as chaves na ordem recebida. */
function agruparProducao(producao, chaves, chaveDoRegistro, materiais) {
    const series = {};
    materiais.forEach((material) => {
        series[material] = chaves.map((chave) => {
            const doGrupo = (producao ?? []).filter(
                (r) => r[CAMPOS.materialProducao] === material && chaveDoRegistro(r) === chave
            );
            return arredondar(somar(doGrupo, CAMPOS.pesoProducao));
        });
    });
    return { chaves, series };
}

/** Últimos "dias" dias, incluindo hoje. Chaves no formato AAAA-MM-DD. */
export function producaoPorDia(producao, dias = 7, hoje = new Date(), materiais = MATERIAIS) {
    const chaves = [];
    for (let i = dias - 1; i >= 0; i--) {
        const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
        chaves.push(paraChaveDia(dia));
    }
    return agruparProducao(producao, chaves, (r) => chaveDia(r[CAMPOS.dataProducao]), materiais);
}

/** Últimos "meses" meses, incluindo o atual. Chaves no formato AAAA-MM. */
export function producaoPorMes(producao, meses = 6, hoje = new Date(), materiais = MATERIAIS) {
    const chaves = [];
    for (let i = meses - 1; i >= 0; i--) {
        const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        chaves.push(paraChaveDia(mes).slice(0, 7));
    }
    return agruparProducao(producao, chaves, (r) => chaveDia(r[CAMPOS.dataProducao]).slice(0, 7), materiais);
}

/** [{ nome, total }] ordenado do maior para o menor. Fornecedor sem cadastro vira o próprio ID. */
export function recebidoPorFornecedor(lotes, fornecedores) {
    const nomes = new Map(
        (fornecedores ?? []).map((f) => [String(f[CAMPOS.idFornecedor]), f[CAMPOS.nomeFornecedor]])
    );
    const totais = new Map();

    (lotes ?? []).forEach((lote) => {
        const idFornecedor = String(lote[CAMPOS.idFornecedorLote]);
        const peso = Number(lote[CAMPOS.pesoLote]);
        totais.set(idFornecedor, (totais.get(idFornecedor) ?? 0) + (Number.isFinite(peso) ? peso : 0));
    });

    return [...totais.entries()]
        .map(([idFornecedor, total]) => ({ nome: nomes.get(idFornecedor) ?? idFornecedor, total: arredondar(total) }))
        .sort((a, b) => b.total - a.total);
}

/** [{ status, quantidade }] na ordem em que aparecem. */
export function lotesPorStatus(lotes) {
    const contagem = new Map();
    (lotes ?? []).forEach((lote) => {
        const status = lote[CAMPOS.statusLote] ?? "Sem status";
        contagem.set(status, (contagem.get(status) ?? 0) + 1);
    });
    return [...contagem.entries()].map(([status, quantidade]) => ({ status, quantidade }));
}

/** Alertas não resolvidos. Aceita true/false ou "true"/"false" (o mock manda texto). */
export function alertasAtivos(alertas) {
    return (alertas ?? []).filter((a) => String(a[CAMPOS.resolvidoAlerta]) !== "true");
}

/** CO₂ evitado em toneladas, total e por material (estimativa com fatores provisórios). */
export function co2Evitado(producao) {
    const porMaterial = {};
    let totalKg = 0;
    const totais = totalPorMaterial(producao);

    MATERIAIS.forEach((material) => {
        const kg = totais[material] * FATORES_CO2[material];
        porMaterial[material] = arredondar(kg / 1000);
        totalKg += kg;
    });

    return { total: arredondar(totalKg / 1000), porMaterial };
}
