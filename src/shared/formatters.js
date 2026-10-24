// 4. Day.js em português
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');

/** 1234.5 -> "1.234,5" (padrão brasileiro) */
export function formatNumber(valor, casas = 2) {
    return Number(valor ?? 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: casas
    });
}

/** 1234.5 -> "1.234,5 kg" */
export function formatKg(valor) {
    return formatNumber(valor) + ' kg';
}

/** Peso em kg -> toneladas, com até 5 casas para preservar a precisão de 0,01 kg. */
export function formatToneladas(valorKg) {
    return formatNumber(Number(valorKg ?? 0) / 1000, 5) + ' t';
}

/** "2026-10-20" ou "2026-10-20T10:00:00" -> "20/10/2026" */
export function formatDate(data) {
    return dayjs(data).format('DD/MM/YYYY');
}

/** "2026-10-20T09:51:00" -> "20/10/2026 09:51" */
export function formatDateTime(data) {
    return dayjs(data).format('DD/MM/YYYY HH:mm');
}

/** "2026-10-20" -> "20/10" */
export function formatDayMonth(data) {
    return dayjs(data).format('DD/MM');
}

/** "2026-10" -> "out/2026" */
export function formatMonth(anoMes) {
    return dayjs(anoMes + '-01').format('MMM/YYYY').replace('.', '');
}
