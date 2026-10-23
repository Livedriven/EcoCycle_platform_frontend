import { describe, expect, it } from "vitest";
import {
    formatDate,
    formatDateTime,
    formatDayMonth,
    formatKg,
    formatMonth,
    formatNumber
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
