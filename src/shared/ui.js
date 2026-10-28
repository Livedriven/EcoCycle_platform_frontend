// Regras visuais comuns. As cores ficam nas variáveis --eco-* de style.css.
function normalizar(texto) {
    return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

const CLASSES_STATUS = new Map([
    ['normal', 'b-sucesso'], ['ativa', 'b-sucesso'], ['ligada', 'b-sucesso'], ['operando', 'b-sucesso'], ['finalizado', 'b-sucesso'],
    ['atencao', 'b-aviso'], ['manutencao', 'b-aviso'], ['em processamento', 'b-aviso'],
    ['critico', 'b-perigo'], ['parada', 'b-perigo'], ['desligada', 'b-perigo'], ['esteira desligada', 'b-perigo'],
    ['recebido', 'b-info']
]);

export function classeStatus(status) {
    return CLASSES_STATUS.get(normalizar(status)) ?? 'b-suave';
}

/** Mesmo padrão do conveyor: alertas críticos em vermelho, demais em laranja. */
export function classeAlerta(tipo) {
    return /\bcritic[oa]s?\b/.test(normalizar(tipo)) ? 'b-perigo' : 'b-aviso';
}

export function classeContadorAlertas(quantidade) {
    return quantidade > 0 ? 'b-perigo' : 'b-sucesso';
}
