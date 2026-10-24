import { describe, it, expect } from "vitest";
import {
    arredondar,
    somar,
    totalRecebido,
    totalProduzido,
    totalPorMaterial,
    producaoPorDia,
    producaoPorMes,
    recebidoPorFornecedor,
    lotesPorStatus,
    alertasAtivos,
    co2Evitado
} from "./calculations.js";

const producao = [
    { tipo_material: "Plástico", peso_kg: 10.1, data_hora: "2026-10-20" },
    { tipo_material: "Plástico", peso_kg: 20.2, data_hora: "2026-10-20" },
    { tipo_material: "Metal", peso_kg: 5.5, data_hora: "2026-10-19" },
    { tipo_material: "Metal", peso_kg: 4, data_hora: "2026-09-30" }
];

describe("somas básicas", () => {
    it("lista vazia ou ausente soma zero", () => {
        expect(somar([], "peso_kg")).toBe(0);
        expect(somar(undefined, "peso_kg")).toBe(0);
    });

    it("soma decimais sem erro de ponto flutuante na saída", () => {
        expect(totalProduzido(producao)).toBe(39.8);
        expect(arredondar(0.1 + 0.2)).toBe(0.3);
    });

    it("ignora valores inválidos", () => {
        expect(somar([{ peso_kg: "abc" }, { peso_kg: 2 }], "peso_kg")).toBe(2);
    });

    it("soma o peso de entrada dos lotes", () => {
        expect(totalRecebido([{ pesoentrada_kg: 1200.5 }, { pesoentrada_kg: 850.75 }])).toBe(2051.25);
    });
});

describe("totais por material", () => {
    it("separa plástico e metal", () => {
        expect(totalPorMaterial(producao)).toEqual({ "Plástico": 30.3, "Metal": 9.5 });
    });

    it("lista vazia dá zero nos dois", () => {
        expect(totalPorMaterial([])).toEqual({ "Plástico": 0, "Metal": 0 });
    });
});

describe("agrupamento por período", () => {
    const hoje = new Date(2026, 9, 22); // 22/10/2026

    it("produção diária cobre 7 dias, com zero nos dias sem produção", () => {
        const { chaves, series } = producaoPorDia(producao, 7, hoje);
        expect(chaves[0]).toBe("2026-10-16");
        expect(chaves[6]).toBe("2026-10-22");
        expect(series["Plástico"]).toEqual([0, 0, 0, 0, 30.3, 0, 0]);
        expect(series["Metal"]).toEqual([0, 0, 0, 5.5, 0, 0, 0]);
    });

    it("produção mensal cobre 6 meses atravessando o ano", () => {
        const { chaves } = producaoPorMes([], 6, new Date(2026, 1, 10));
        expect(chaves).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
    });

    it("produção mensal soma por mês", () => {
        const { chaves, series } = producaoPorMes(producao, 2, hoje);
        expect(chaves).toEqual(["2026-09", "2026-10"]);
        expect(series["Metal"]).toEqual([4, 5.5]);
        expect(series["Plástico"]).toEqual([0, 30.3]);
    });
});

describe("fornecedores, lotes e alertas", () => {
    it("agrupa por fornecedor e ordena do maior para o menor", () => {
        const lotes = [
            { id_fornecedor: 1, pesoentrada_kg: 100 },
            { id_fornecedor: 2, pesoentrada_kg: 300 },
            { id_fornecedor: 1, pesoentrada_kg: 50 },
            { id_fornecedor: 9, pesoentrada_kg: 10 }
        ];
        const fornecedores = [
            { id: 1, nome_fornecedor: "A" },
            { id: 2, nome_fornecedor: "B" }
        ];
        expect(recebidoPorFornecedor(lotes, fornecedores)).toEqual([
            { nome: "B", total: 300 },
            { nome: "A", total: 150 },
            { nome: "9", total: 10 }
        ]);
    });

    it("conta lotes por status", () => {
        const lotes = [{ status: "Recebido" }, { status: "Finalizado" }, { status: "Finalizado" }];
        expect(lotesPorStatus(lotes)).toEqual([
            { status: "Recebido", quantidade: 1 },
            { status: "Finalizado", quantidade: 2 }
        ]);
    });

    it("alertas ativos aceitam texto e booleano", () => {
        const alertas = [{ resolvido: "true" }, { resolvido: "false" }, { resolvido: false }, { resolvido: true }];
        expect(alertasAtivos(alertas)).toHaveLength(2);
    });
});

describe("CO₂ evitado", () => {
    it("converte kg em toneladas com os fatores provisórios", () => {
        const { total, porMaterial } = co2Evitado([
            { tipo_material: "Plástico", peso_kg: 1000 },
            { tipo_material: "Metal", peso_kg: 500 }
        ]);
        expect(porMaterial).toEqual({ "Plástico": 1.5, "Metal": 2 });
        expect(total).toBe(3.5);
    });
});
