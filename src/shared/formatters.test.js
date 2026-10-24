import { describe, expect, it } from "vitest";
import {
    formatDate,
    formatDateTime,
    formatDayMonth,
    formatKg,
    formatToneladas,
    formatMonth,
    formatNumber,
    formatCnpj,
    formatTelefone
} from "./formatters.js";

describe("formatNumber", () => {
    it("formata números no padrão brasileiro e respeita o máximo de casas", () => {
        expect(formatNumber(1234.567)).toBe("1.234,57");
        expect(formatNumber(1234.567, 1)).toBe("1.234,6");
        expect(formatNumber(-12.5)).toBe("-12,5");
    });

    it("usa zero para valores nulos ou ausentes", () => {
        expect(formatNumber(null)).toBe("0");
        expect(formatNumber(undefined)).toBe("0");
    });

    it("expõe valores numéricos inválidos como NaN", () => {
        expect(formatNumber("peso inválido")).toBe("NaN");
    });

    it("lança RangeError para quantidade de casas negativa", () => {
        expect(() => formatNumber(10, -1)).toThrow(RangeError);
    });
});

describe("formatKg", () => {
    it("formata peso com a unidade em quilogramas", () => {
        expect(formatKg(1234.5)).toBe("1.234,5 kg");
        expect(formatKg("15.25")).toBe("15,25 kg");
    });

    it("mantém visível uma entrada numérica inválida", () => {
        expect(formatKg("sem peso")).toBe("NaN kg");
    });
});

describe('formatToneladas', () => {
    it('converte kg para toneladas sem perder centésimos de kg', () => {
        expect(formatToneladas(1234.5)).toBe('1,2345 t');
        expect(formatToneladas(0.01)).toBe('0,00001 t');
        expect(formatToneladas('1500')).toBe('1,5 t');
        expect(formatToneladas(null)).toBe('0 t');
    });
});

describe("formatadores de data", () => {
    it("formata a data completa sem alterar o dia informado", () => {
        expect(formatDate("2026-10-20")).toBe("20/10/2026");
        expect(formatDate("2026-10-20T09:51:00")).toBe("20/10/2026");
    });

    it("formata data e hora", () => {
        expect(formatDateTime("2026-10-20T09:51:00")).toBe("20/10/2026 09:51");
    });

    it("formata somente dia e mês", () => {
        expect(formatDayMonth("2026-01-05")).toBe("05/01");
    });

    it.each([
        ["formatDate", formatDate],
        ["formatDateTime", formatDateTime],
        ["formatDayMonth", formatDayMonth]
    ])("%s devolve 'Invalid Date' para uma data inválida", (_nome, formatar) => {
        expect(formatar("data inválida")).toBe("Invalid Date");
        expect(formatar(null)).toBe("Invalid Date");
    });
});

describe("formatMonth", () => {
    it("formata ano e mês com a abreviação em português", () => {
        expect(formatMonth("2026-10")).toBe("out/2026");
        expect(formatMonth("2026-01")).toBe("jan/2026");
    });

    it("lança TypeError quando o mês não pode ser convertido em texto", () => {
        expect(() => formatMonth(Symbol("mês"))).toThrow(TypeError);
    });
});

describe('formatCnpj', () => {
    it('aplica a máscara em 14 dígitos', () => {
        expect(formatCnpj('12345678000195')).toBe('12.345.678/0001-95');
    });
    it('mantém o que não é um CNPJ de 14 dígitos e trata vazio', () => {
        expect(formatCnpj('123')).toBe('123');
        expect(formatCnpj(null)).toBe('');
        expect(formatCnpj(undefined)).toBe('');
    });
});

describe('formatTelefone', () => {
    it('formata celular (11) e fixo (10)', () => {
        expect(formatTelefone('31988810001')).toBe('(31) 98881-0001');
        expect(formatTelefone('3133883344')).toBe('(31) 3388-3344');
    });
    it('mantém tamanhos inesperados e trata vazio', () => {
        expect(formatTelefone('123')).toBe('123');
        expect(formatTelefone(null)).toBe('');
    });
});