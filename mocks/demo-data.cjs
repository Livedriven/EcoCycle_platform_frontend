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
    dados.materiais ??= ['plastico', 'metal', 'aluminio'].map((tipo_material, i) => ({ id_material: i + 1, tipo_material }));
    // Produção sem status herda o do lote (como a API real); sem lote, conta como finalizada.
    // Sem isso o mock devolveria "Finalizado" e esconderia produções de lotes Recebido/Disponível.
    const statusDoLote = new Map((dados.lotes ?? []).map((l) => [Number(l.id_lote ?? l.id), l.status_lote ?? l.status]));
    for (const producao of dados.producao) {
        producao.status_producao ??= statusDoLote.get(Number(producao.id_lote)) ?? 'Finalizado';
    }
    // Expõe a mesma composição aninhada da API real, sem tipo_material no ciclo.
    for (const producao of dados.producao) {
        if (Array.isArray(producao.itens)) continue;
        const tipo = String(producao.tipo_material ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const material = dados.materiais.find((m) => String(m.tipo_material).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === tipo);
        producao.itens = material ? [{
            id_item_producao: producao.id_producao ?? producao.id,
            id_producao: producao.id_producao ?? producao.id,
            id_material: material.id_material ?? material.id,
            peso_kg: producao.quantidade_saida_kg ?? producao.peso_kg,
            data_hora: producao.data_inicio ?? producao.data_hora,
        }] : [];
        delete producao.tipo_material;
    }
    return dados;
}

module.exports = { prepararDadosDemo };
