import { CAMPOS, MATERIAIS_RELATORIO } from '../../shared/calculations.js';

function numerico(valor) {
    return typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '');
}

function dataValida(dia) {
    if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
    const data = new Date(dia + 'T00:00:00Z');
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === dia;
}

/** Valida o contrato antes de usar dados externos nos totais, filtros e gráficos. */
export function prepararMateriais(dados) {
    if (!Array.isArray(dados)) throw new Error('A API retornou um formato inválido para os materiais.');
    const registros = [];
    for (const registro of dados) {
        if (!registro || typeof registro !== 'object' || Array.isArray(registro)) continue;
        const material = registro[CAMPOS.materialProducao];
        const peso = registro[CAMPOS.pesoProducao];
        const lote = registro[CAMPOS.idLoteProducao];
        const data = registro[CAMPOS.dataProducao];
        const dia = typeof data === 'string' ? data.slice(0, 10) : '';
        if (!MATERIAIS_RELATORIO.includes(material) || !numerico(peso) || !Number.isFinite(Number(peso)) || Number(peso) < 0
            || !numerico(lote) || !Number.isSafeInteger(Number(lote)) || Number(lote) <= 0
            || !dataValida(dia) || (data.length > 10 && (!/^T\d{2}:\d{2}/.test(data.slice(10)) || !Number.isFinite(Date.parse(data))))) continue;

        // Copia somente os campos necessários; nada da resposta vira HTML ou configuração.
        registros.push({
            [CAMPOS.idLoteProducao]: String(Number(lote)),
            [CAMPOS.materialProducao]: material,
            [CAMPOS.pesoProducao]: Number(peso),
            [CAMPOS.dataProducao]: dia,
        });
    }
    return { registros, descartados: dados.length - registros.length };
}

export function validarPeriodo({ inicio = '', fim = '' } = {}) {
    if ((inicio && !dataValida(inicio)) || (fim && !dataValida(fim))) return 'Informe datas válidas para o período.';
    if (inicio && fim && inicio > fim) return 'A data inicial deve ser anterior ou igual à data final.';
    return '';
}

/** Os mesmos registros alimentam cartões, gráfico e tabela; limites inclusivos. */
export function filtrarMateriais(registros, { inicio = '', fim = '', lote = '' } = {}) {
    const erro = validarPeriodo({ inicio, fim });
    if (erro) throw new Error(erro);
    return registros.filter((registro) => {
        const dia = registro[CAMPOS.dataProducao];
        return (!inicio || dia >= inicio) && (!fim || dia <= fim)
            && (!lote || String(registro[CAMPOS.idLoteProducao]) === String(lote));
    });
}
