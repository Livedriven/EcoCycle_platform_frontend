// Mesmas rotas, envelopes e campos de entrada do backend; persistência só em memória.
const COLECOES = {
    '/fornecedores': ['fornecedores', 'fornecedores', 'fornecedor', 'id_fornecedor'],
    '/lotes': ['lotes', 'lotes', 'lote', 'id_lote'],
    '/producao': ['producao', 'registros_producao', 'producao', 'id_producao'],
    '/equipamentos': ['esteiras', 'equipamentos', null, 'id_esteira'],
    '/telemetria/historico': ['leituras_sensor', 'historico', null, 'id_leitura_sensor'],
    '/alertas': ['alertas', 'alertas', null, 'id_alerta'],
    '/materiais': ['materiais', 'materiais', 'material', 'id_material'],
};
const OBRIGATORIOS = {
    '/fornecedores': ['id_fornecedor', 'nome_fornecedor', 'cnpj', 'telefone_fornecedor', 'email_fornecedor', 'endereco_fornecedor'],
    '/lotes': ['id_fornecedor', 'codigo_lote', 'status_lote', 'peso_recebido_kg'],
    '/producao': ['id_lote', 'id_usuario', 'id_esteira', 'turno', 'status_producao', 'quantidade_entrada_kg', 'quantidade_saida_kg', 'rejeito_kg'],
    '/materiais': ['tipo_material'],
};
const OPCIONAIS = { '/lotes': ['data_entrada'], '/producao': ['data_inicio', 'data_fim', 'itens'] };

function registroApi(caminho, registro) {
    const chave = COLECOES[caminho][3];
    const r = { ...registro, [chave]: registro[chave] ?? registro.id };
    delete r.id;
    const mover = (origem, destino) => {
        r[destino] ??= r[origem];
        delete r[origem];
    };
    if (caminho === '/fornecedores') mover('cnpj_fornecedor', 'cnpj');
    if (caminho === '/lotes') { mover('pesoentrada_kg', 'peso_recebido_kg'); mover('status', 'status_lote'); }
    if (caminho === '/producao') {
        mover('data_hora', 'data_inicio'); mover('turno_producao', 'turno'); mover('peso_kg', 'quantidade_saida_kg');
        r.quantidade_entrada_kg ??= r.quantidade_saida_kg;
        r.rejeito_kg ??= 0;
        r.status_producao ??= 'Finalizado';
        // Os fixtures mantêm composição para demonstrar o relatório de materiais.
    }
    if (caminho === '/telemetria/historico') {
        mover('datahora_leitura', 'timestamp'); mover('temperatura_leitura_c', 'temperatura');
        mover('peso_leitura_kg', 'peso'); mover('status_leitura', 'status_registrado');
    }
    if (caminho === '/alertas') {
        mover('id_leitura', 'id_leitura_sensor'); mover('datahora_alerta', 'data_hora_alerta');
        r.resolvido = ['true', 'sim'].includes(String(r.resolvido).trim().toLowerCase()) ? 'SIM' : 'NAO';
    }
    return r;
}

function camposValidos(dados, obrigatorios, opcionais = []) {
    return dados && typeof dados === 'object' && !Array.isArray(dados)
        && obrigatorios.every((c) => dados[c] !== undefined && dados[c] !== null && dados[c] !== '')
        && Object.keys(dados).every((c) => [...obrigatorios, ...opcionais].includes(c));
}

function consolidar(registros, query, periodo) {
    const filtrados = registros.filter((r) => {
        const dia = String(r.data_inicio ?? '').slice(0, 10);
        const [ano, mes] = dia.split('-').map(Number);
        return (!query.data || dia === query.data.split('/').reverse().join('-'))
            && (!query.mes || mes === Number(query.mes)) && (!query.ano || ano === Number(query.ano))
            && (!query.trimestre || Math.ceil(mes / 3) === Number(query.trimestre));
    });
    const soma = (campo) => Math.round(filtrados.reduce((total, r) => total + Number(r[campo] ?? 0), 0) * 100) / 100;
    const entrada = soma('quantidade_entrada_kg'), saida = soma('quantidade_saida_kg');
    return {
        indicador: 'Dashboard ' + periodo + ' — demonstração',
        ...(periodo === 'diario' ? { total_turnos_registrados: filtrados.length, detalhado: filtrados } : { total_registros: filtrados.length }),
        balanco_massas_kg: { total_material_entrada: entrada, total_produzido_saida: saida, total_rejeitos_perdas: soma('rejeito_kg') },
        indicadores_desempenho: { [periodo === 'diario' ? 'aproveitamento_percentual' : 'detalhamento_' + periodo]: entrada ? Math.round(saida / entrada * 10000) / 100 : 0 },
    };
}

module.exports = (req, res) => {
    const db = req.app.db, caminho = req.path;
    const listar = (rota) => (db.get(COLECOES[rota][0]).value() ?? []).map((r) => registroApi(rota, r));
    const salvar = (colecao, registro) => { db.get(colecao).push(registro).write(); return registro; };
    const novoId = (rota) => Math.max(0, ...listar(rota).map((r) => Number(r[COLECOES[rota][3]]) || 0)) + 1;
    if (req.method === 'GET' && /^\/producao\/dashboard-(diario|mensal|trimestral)$/.test(caminho)) {
        return res.json(consolidar(listar('/producao'), req.query, caminho.split('-').at(-1)));
    }
    const contrato = COLECOES[caminho];
    if (req.method === 'GET' && contrato) {
        const registros = listar(caminho);
        return res.json({ [contrato[1]]: registros, ...(caminho === '/telemetria/historico' ? { total_registros_salvos: registros.length } : {}) });
    }
    if (req.method === 'POST' && OBRIGATORIOS[caminho]) {
        const dados = req.body;
        if (!camposValidos(dados, OBRIGATORIOS[caminho], OPCIONAIS[caminho])) return res.status(422).json({ detail: 'Campos obrigatórios ausentes ou campos desconhecidos.' });
        if (caminho === '/fornecedores' && (!Number.isInteger(dados.id_fornecedor) || dados.id_fornecedor <= 0)) return res.status(422).json({ detail: 'Código de fornecedor inválido.' });
        const id = dados[contrato[3]] ?? novoId(caminho);
        if (listar(caminho).some((r) => r[contrato[3]] === id || (caminho === '/fornecedores' && r.cnpj === dados.cnpj))) return res.status(409).json({ detail: 'Código ou CNPJ já cadastrado.' });
        const novo = { ...dados, [contrato[3]]: id };
        if (caminho === '/lotes') novo.data_entrada ??= new Date().toISOString();
        if (caminho === '/producao') novo.data_inicio ??= new Date().toISOString();
        salvar(contrato[0], novo);
        return res.status(caminho === '/fornecedores' ? 200 : 201).json({ mensagem: 'Cadastro realizado com sucesso.', [contrato[2]]: novo });
    }
    if (req.method === 'POST' && ['/equipamentos/status', '/telemetria'].includes(caminho)) {
        const dados = req.body;
        const campos = ['id_esteira', 'temperatura_esteira_c', 'velocidade_esteira_kmh', 'peso_atual_kg', 'travada'];
        if (caminho === '/telemetria') campos.push('id_producao');
        if (!camposValidos(dados, campos, caminho === '/telemetria' ? ['material_leitura'] : [])) return res.status(422).json({ detail: 'Leitura inválida.' });
        const esteira = db.get('esteiras').find((r) => (r.id_esteira ?? r.id) === dados.id_esteira).value();
        if (!esteira) return res.status(404).json({ detail: 'Esteira não encontrada.' });
        const tipos = [dados.peso_atual_kg > 500 && 'SOBRECARGA', dados.temperatura_esteira_c > 50 && 'TEMPERATURA_ALTA', dados.velocidade_esteira_kmh > 10 && 'VELOCIDADE_ALTA', dados.travada && 'TRAVAMENTO'].filter(Boolean);
        const estado = tipos.length ? 'ESTEIRA DESLIGADA' : 'LIGADA';
        const alertas = tipos.map((tipo) => ({ mensagem: tipo, datahora_alerta: new Date().toISOString() }));
        if (caminho === '/equipamentos/status') {
            Object.assign(esteira, { status_esteira: estado, temperatura_esteira_c: dados.temperatura_esteira_c, velocidade_esteira_kmh: dados.velocidade_esteira_kmh });
            return res.json({ mensagem: 'Leitura simulada atualizada.', estado_atual: registroApi('/equipamentos', esteira), alertas_seguranca: alertas, acao_tomada: estado });
        }
        if (!listar('/producao').some((r) => r.id_producao === dados.id_producao && r.id_esteira === dados.id_esteira)) return res.status(404).json({ detail: 'Produção não encontrada para esta esteira.' });
        const leitura = salvar('leituras_sensor', { id_leitura_sensor: novoId('/telemetria/historico'), id_esteira: dados.id_esteira, id_producao: dados.id_producao, id_usuario: Number(req.claims.sub), temperatura: dados.temperatura_esteira_c, peso: dados.peso_atual_kg, status_registrado: estado, material_leitura: dados.material_leitura, timestamp: new Date().toISOString() });
        for (const tipo of tipos) salvar('alertas', { id_alerta: novoId('/alertas'), id_leitura_sensor: leitura.id_leitura_sensor, tipo_alerta: tipo, data_hora_alerta: leitura.timestamp, resolvido: 'NAO' });
        return res.json({ usuario_autorizado: req.claims.usuario, equipamento_id: dados.id_esteira, estado_equipamento: estado, alertas_seguranca: alertas, acao_tomada: estado, persistencia_banco: 'Demonstração: leitura salva apenas em memória.' });
    }
    return res.status(404).json({ detail: 'Rota não disponível.' });
};
