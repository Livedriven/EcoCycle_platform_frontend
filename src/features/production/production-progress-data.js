// Regras da tela de monitoramento de uma produção: leitura do ID, junção dos dados, progresso,
// tempo em operação e estado dos sensores. Funções puras: não mexem na tela nem chamam a API.
import {
    CAMPOS, MATERIAIS_RELATORIO, arredondar, totalPorMaterial, totalProduzido, alertasAtivos
} from '../../shared/calculations.js';

// ?producao=12 -> 12. Só inteiro positivo, sem zeros à esquerda; qualquer outra coisa vira null
// e a tela nem consulta a API.
export function lerIdDaUrl(search) {
    const valor = new URLSearchParams(search).get('producao');
    return valor !== null && /^[1-9]\d{0,14}$/.test(valor) ? Number(valor) : null;
}

// "2026-10-26" ou "2026-10-26T09:20:00" (sem fuso = horário local, como a tela de iniciar produção grava).
// Devolve { data, temHora } ou null. Atenção: new Date("2026-10-26") seria UTC, por isso o parse manual.
export function lerData(texto) {
    const t = String(texto ?? '').trim();
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/);
    if (m) {
        const [a, mes, dia, hora = 0, min = 0, seg = 0] = m.slice(1).map((parte) => (parte === undefined ? undefined : Number(parte)));
        const data = new Date(a, mes - 1, dia, hora, min, seg);
        const confere = data.getFullYear() === a && data.getMonth() === mes - 1 && data.getDate() === dia
            && data.getHours() === hora && data.getMinutes() === min && data.getSeconds() === seg;
        return confere ? { data, temHora: m[4] !== undefined } : null;
    }
    // Com fuso explícito (Z ou +03:00): o próprio Date entende.
    if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(t)) {
        const data = new Date(t);
        return Number.isNaN(data.getTime()) ? null : { data, temHora: true };
    }
    return null;
}

// Segundos desde o início. null se o início não tem hora (os registros antigos têm só a data).
export function duracaoEmSegundos(inicio, agora = new Date()) {
    const lida = lerData(inicio);
    if (!lida || !lida.temHora) return null;
    return Math.max(0, Math.floor((agora.getTime() - lida.data.getTime()) / 1000));
}

// 2040 -> "00:34:00" (horas podem passar de 99).
export function formatarDuracao(segundos) {
    if (!Number.isFinite(segundos)) return '';
    const dois = (n) => String(n).padStart(2, '0');
    return dois(Math.floor(segundos / 3600)) + ':' + dois(Math.floor((segundos % 3600) / 60)) + ':' + dois(segundos % 60);
}

// Progresso = peso processado / peso do lote. Sem peso do lote válido não há progresso (null).
// O percentual arredonda para baixo: nunca mostra 100% antes de o peso do lote ser atingido.
export function calcularProgresso(pesoTotal, pesoProcessado) {
    const total = Number(pesoTotal);
    if (!Number.isFinite(total) || total <= 0) return null;
    const feito = Math.max(0, Number(pesoProcessado) || 0);
    return {
        total: arredondar(total),
        processado: arredondar(feito),
        restante: arredondar(Math.max(0, total - feito)),
        percentual: feito >= total ? 100 : Math.floor((feito / total) * 100),
        excedeu: feito > total
    };
}

// Leitura mais recente da esteira (maior data; em empate, maior id).
export function ultimaLeitura(leituras, idEsteira) {
    const daEsteira = (leituras ?? []).filter((l) => String(l.id_esteira) === String(idEsteira));
    return daEsteira.reduce((melhor, atual) => {
        if (!melhor) return atual;
        const porData = String(atual.datahora_leitura ?? '').localeCompare(String(melhor.datahora_leitura ?? ''));
        return porData > 0 || (porData === 0 && Number(atual.id) > Number(melhor.id)) ? atual : melhor;
    }, null);
}

// Alertas não resolvidos ligados a leituras desta esteira (alerta -> leitura -> esteira).
export function contarAlertasAtivos(alertas, leituras, idEsteira) {
    const leiturasDaEsteira = new Set(
        (leituras ?? []).filter((l) => String(l.id_esteira) === String(idEsteira)).map((l) => String(l.id))
    );
    return alertasAtivos(alertas).filter((a) => leiturasDaEsteira.has(String(a.id_leitura))).length;
}

// Junta tudo o que a tela mostra. Devolve null se a produção não existir.
// Materiais e peso processado = registros de producao do mesmo lote (não há id_producao nos registros).
export function montarMonitoramento({ producoes, lotes, esteiras, leituras, alertas }, id) {
    const producao = (producoes ?? []).find((p) => String(p.id) === String(id));
    if (!producao) return null;

    const idLote = producao[CAMPOS.idLoteProducao];
    const lote = (lotes ?? []).find((l) => String(l.id) === String(idLote)) ?? null;
    const esteira = (esteiras ?? []).find((e) => String(e.id) === String(producao.id_esteira)) ?? null;
    const doLote = (producoes ?? []).filter((p) => String(p[CAMPOS.idLoteProducao]) === String(idLote));
    const totais = totalPorMaterial(doLote, MATERIAIS_RELATORIO);

    return {
        producao: {
            id: producao.id,
            id_lote: idLote,
            turno: producao.turno_producao ?? '',
            inicio: producao[CAMPOS.dataProducao] ?? ''
        },
        lote: lote && {
            id: lote.id,
            codigo: lote.codigo_lote ?? '',
            pesoTotal: lote[CAMPOS.pesoLote],
            status: lote[CAMPOS.statusLote] ?? ''
        },
        progresso: lote ? calcularProgresso(lote[CAMPOS.pesoLote], totalProduzido(doLote)) : null,
        esteira: esteira && {
            nome: esteira.nome_esteira ?? '',
            status: esteira.status_esteira ?? '',
            velocidade_kmh: esteira.velocidade_esteira_kmh,
            temperatura_c: esteira.temperatura_esteira_c
        },
        sensores: esteira && {
            ultima: (() => {
                const leitura = ultimaLeitura(leituras, esteira.id);
                return leitura ? { status: leitura.status_leitura ?? '', data: leitura.datahora_leitura ?? '' } : null;
            })(),
            alertasAtivos: contarAlertasAtivos(alertas, leituras, esteira.id)
        },
        materiais: MATERIAIS_RELATORIO.map((material) => ({ material, peso: totais[material] }))
    };
}
