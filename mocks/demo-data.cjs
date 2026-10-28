function prepararDadosDemo(seed, hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })) {
    const dados = structuredClone(seed);
    // Descarta antigos envios incompletos; os registros de exemplo com pesos permanecem.
    dados.producao = (dados.producao ?? []).filter((r) => Number.isFinite(Number(r.quantidade_saida_kg ?? r.peso_kg)));
    const dias = dados.producao.map((r) => String(r.data_inicio ?? r.data_hora ?? '').slice(0, 10)).filter(Boolean);
    const referencia = dias.sort().at(-1) ?? hoje;
    const diferenca = Date.parse(hoje + 'T00:00:00Z') - Date.parse(referencia + 'T00:00:00Z');
    for (const colecao of Object.values(dados)) {
        if (!Array.isArray(colecao)) continue;
        for (const registro of colecao) {
            for (const [campo, valor] of Object.entries(registro)) {
                if (!/data|manutencao/i.test(campo) || typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(valor)) continue;
                const dia = new Date(Date.parse(valor.slice(0, 10) + 'T00:00:00Z') + diferenca).toISOString().slice(0, 10);
                registro[campo] = (dia > hoje ? hoje : dia) + valor.slice(10);
            }
        }
    }
    dados.materiais ??= ['Plástico', 'Metal', 'Alumínio', 'Rejeito'].map((tipo_material, i) => ({ id_material: i + 1, tipo_material }));
    return dados;
}

module.exports = { prepararDadosDemo };
