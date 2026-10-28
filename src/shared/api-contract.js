// Contrato conferido nos routers e schemas do backend EcoCycle.
// Caminhos relativos a VITE_API_URL (o backend local usa o prefixo /api).
// `:id` representa um identificador numérico positivo no caminho.
export const ROTAS_API = {
    '/login': ['POST'],
    '/logout': ['POST'],
    '/health/database': ['GET'],
    '/materiais': ['GET', 'POST'],
    '/fornecedores': ['GET', 'POST'],
    '/lotes': ['GET', 'POST'],
    '/lotes/:id': ['PATCH'],
    '/esteiras': ['GET', 'POST'],
    '/esteiras/status': ['POST'],
    '/esteiras/:id': ['GET', 'PATCH'],
    '/producao': ['GET', 'POST'],
    '/producao/:id': ['PATCH'],
    '/producao/dashboard-diario': ['GET'],
    '/producao/dashboard-mensal': ['GET'],
    '/producao/dashboard-trimestral': ['GET'],
    '/producao/materiais': ['GET'],
    '/telemetria': ['POST'],
    '/telemetria/historico': ['GET'],
    '/alertas': ['GET'],
    '/alertas/:id': ['PATCH'],
};

export function caminhoApi(url) {
    return url.split('?')[0];
}

/** Rota do contrato que atende o caminho: fixa primeiro, depois com `:id`. Sem correspondência, null. */
export function rotaApi(url) {
    const caminho = caminhoApi(url);
    if (Object.hasOwn(ROTAS_API, caminho)) return caminho;
    return Object.keys(ROTAS_API).find((rota) => rota.endsWith('/:id')
        && new RegExp('^' + rota.slice(0, -4) + '/[1-9]\\d{0,9}$').test(caminho)) ?? null;
}

export function rotaPublica(url) {
    return ['/login', '/health/database'].includes(caminhoApi(url));
}

const COLECOES = {
    '/materiais': ['materiais', 'material', 'id_material'],
    '/fornecedores': ['fornecedores', 'fornecedor', 'id_fornecedor'],
    '/lotes': ['lotes', 'lote', 'id_lote'],
    '/esteiras': ['esteiras', 'esteira', 'id_esteira'],
    '/producao': ['registros_producao', 'producao', 'id_producao'],
    '/telemetria/historico': ['historico', null, 'id_leitura_sensor'],
    '/alertas': ['alertas', 'alerta', 'id_alerta'],
};

function normalizarRegistro(caminho, registro, chaveId) {
    const r = { ...registro, id: registro[chaveId] ?? registro.id };
    if (caminho === '/fornecedores') r.cnpj_fornecedor = r.cnpj ?? r.cnpj_fornecedor;
    if (caminho === '/lotes') {
        r.pesoentrada_kg = r.peso_recebido_kg ?? r.pesoentrada_kg;
        r.status = r.status_lote ?? r.status;
    }
    if (caminho === '/producao') {
        r.data_hora = r.data_inicio ?? r.data_hora;
        r.turno_producao = r.turno ?? r.turno_producao;
        r.status = r.status_producao ?? r.status;
        r.peso_kg = r.quantidade_saida_kg ?? r.peso_kg;
    }
    if (caminho === '/telemetria/historico') {
        r.datahora_leitura = r.timestamp ?? r.data_hora_leitura ?? r.datahora_leitura;
        r.temperatura_leitura_c = r.temperatura ?? r.temperatura_leitura_c;
        r.peso_leitura_kg = r.peso ?? r.peso_leitura_kg;
        r.status_leitura = r.status_registrado ?? r.status_leitura;
    }
    if (caminho === '/alertas') {
        r.id_leitura = r.id_leitura_sensor ?? r.id_leitura;
        r.datahora_alerta = r.data_hora_alerta ?? r.datahora_alerta;
        r.resolvido = ['true', 'sim'].includes(String(r.resolvido).trim().toLowerCase());
    }
    return r;
}

// Preserva o modelo usado pelas telas e aceita listas diretas de contratos legados.
// Dashboards e comandos mantêm sua resposta específica, sem virar listas vazias.
// Rotas com `:id` (consulta ou atualização) devolvem a entidade adaptada da coleção.
export function normalizarResposta(metodo, url, resposta) {
    const rota = rotaApi(url) ?? caminhoApi(url);
    const caminho = rota.replace(/\/:id$/, '');
    const contrato = COLECOES[caminho];
    if (!contrato) return resposta;
    const [colecao, entidade, chaveId] = contrato;
    if (metodo === 'GET' && rota === caminho) {
        const registros = Array.isArray(resposta) ? resposta : resposta?.[colecao];
        if (!Array.isArray(registros)) throw new Error(`Resposta inválida da API em ${caminho}: esperado ${colecao}.`);
        return registros.map((r) => normalizarRegistro(caminho, r, chaveId));
    }
    if (entidade && resposta?.[entidade]) return normalizarRegistro(caminho, resposta[entidade], chaveId);
    return resposta;
}
