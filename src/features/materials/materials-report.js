import { CAMPOS, MATERIAIS_RELATORIO } from '../../shared/calculations.js';

function numerico(valor) {
    return typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '');
}

function dataValida(dia) {
    if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
    const data = new Date(dia + 'T00:00:00Z');
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === dia;
}

const TIPOS_MATERIAL = new Map([
    ['plastico', 'Plástico'], ['metal', 'Metal'], ['aluminio', 'Alumínio'],
]);

function idValido(valor) {
    return numerico(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0;
}

/** Adapta ciclos e catálogo sem tratar a saída total como peso de um material. */
export function prepararProducaoMateriais(producoes, materiais) {
    if (!Array.isArray(producoes) || !Array.isArray(materiais)) {
        throw new Error('A API retornou um formato inválido para os materiais.');
    }
    const catalogo = new Map();
    for (const material of materiais) {
        const id = material?.id_material ?? material?.id;
        const tipo = typeof material?.tipo_material === 'string'
            ? material.tipo_material.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : '';
        if (idValido(id) && TIPOS_MATERIAL.has(tipo)) catalogo.set(Number(id), TIPOS_MATERIAL.get(tipo));
    }

    const registros = [];
    const pendencias = [];
    let descartados = 0;
    for (const producao of producoes) {
        if (!producao || typeof producao !== 'object' || Array.isArray(producao)) {
            descartados++;
            continue;
        }
        // Compatibilidade com registros planos antigos, sem misturar os dois contratos.
        if (!Object.hasOwn(producao, 'itens') && producao.tipo_material) {
            const dados = prepararMateriais([producao]);
            registros.push(...dados.registros);
            descartados += dados.descartados;
            continue;
        }
        const contexto = {
            id_lote: producao.id_lote,
            data_hora: producao.data_inicio ?? producao.data_hora,
        };
        const itens = Array.isArray(producao.itens) ? producao.itens : [];
        const candidatos = itens.map((item) => ({
            ...contexto,
            tipo_material: idValido(item?.id_material) ? catalogo.get(Number(item.id_material)) : undefined,
            peso_kg: item?.peso_kg,
            data_hora: item?.data_hora ?? contexto.data_hora,
        }));
        const dados = prepararMateriais(candidatos);
        registros.push(...dados.registros);
        descartados += dados.descartados;
        const pesoInformado = dados.registros.reduce((total, registro) => total + registro.peso_kg, 0);
        const saida = producao.quantidade_saida_kg;
        const saidaValida = numerico(saida) && Number.isFinite(Number(saida)) && Number(saida) >= 0;
        if (!itens.length || dados.descartados || (saidaValida && Math.abs(pesoInformado - Number(saida)) > 0.005)) {
            // Usa a data de início para filtrar os ciclos sem composição conhecida.
            const pendencia = prepararMateriais([{ ...contexto, tipo_material: 'Rejeito', peso_kg: 0 }]);
            pendencias.push(...pendencia.registros);
        }
        // Rejeito pertence ao ciclo: nunca o replica para cada item.
        const rejeito = prepararMateriais([{ ...contexto, tipo_material: 'Rejeito', peso_kg: producao.rejeito_kg }]);
        registros.push(...rejeito.registros);
        descartados += rejeito.descartados;
    }
    return { registros, descartados, pendencias };
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
