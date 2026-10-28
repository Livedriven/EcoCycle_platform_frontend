// Mesmas rotas, envelopes e campos de entrada do backend; persistência só em memória.
const COLECOES = {
    '/fornecedores': ['fornecedores', 'fornecedores', 'fornecedor', 'id_fornecedor'],
    '/lotes': ['lotes', 'lotes', 'lote', 'id_lote'],
    '/producao': ['producao', 'registros_producao', 'producao', 'id_producao'],
    '/esteiras': ['esteiras', 'esteiras', 'esteira', 'id_esteira'],
    '/telemetria/historico': ['leituras_sensor', 'historico', null, 'id_leitura_sensor'],
    '/alertas': ['alertas', 'alertas', 'alerta', 'id_alerta'],
    '/materiais': ['materiais', 'materiais', 'material', 'id_material'],
};
const OBRIGATORIOS = {
    '/fornecedores': ['id_fornecedor', 'nome_fornecedor', 'cnpj', 'telefone_fornecedor', 'email_fornecedor', 'endereco_fornecedor'],
    '/lotes': ['id_fornecedor', 'codigo_lote', 'status_lote', 'peso_recebido_kg'],
    '/producao': ['id_lote', 'id_usuario', 'id_esteira', 'turno', 'status_producao', 'quantidade_entrada_kg', 'quantidade_saida_kg', 'rejeito_kg'],
    '/materiais': ['tipo_material'],
    '/esteiras': ['nome_esteira'],
};
const OPCIONAIS = {
    '/lotes': ['data_entrada'], '/producao': ['data_inicio', 'data_fim', 'itens'],
    '/esteiras': ['status_esteira', 'velocidade_esteira_kmh', 'temperatura_esteira_c'],
};
// Status que o portal envia ao cadastrar uma produção; o mock a guarda como "Disponível".
const STATUS_PRODUCAO_INICIAL = ['em processamento', 'disponivel', 'disponível', 'recebido'];
// Campos aceitos pelo PATCH de cada rota com identificador (atualização parcial).
const EDITAVEIS = {
    '/esteiras': ['nome_esteira', 'status_esteira', 'velocidade_esteira_kmh', 'temperatura_esteira_c'],
    '/lotes': ['codigo_lote', 'status_lote', 'peso_recebido_kg'],
    '/producao': ['status_producao', 'turno', 'data_fim', 'quantidade_saida_kg', 'rejeito_kg', 'itens'],
    '/alertas': ['resolvido'],
};

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
        r.itens ??= [];
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
        if (caminho === '/producao') {
            novo.data_inicio ??= new Date().toISOString();
            // Produção recém-cadastrada aguarda o início na etapa de acompanhamento: fica disponível.
            if (STATUS_PRODUCAO_INICIAL.includes(String(dados.status_producao).trim().toLowerCase())) novo.status_producao = 'Disponível';
        }
        if (caminho === '/esteiras') Object.assign(novo, { status_esteira: 'DESLIGADA', velocidade_esteira_kmh: 0, temperatura_esteira_c: 0, ...dados });
        salvar(contrato[0], novo);
        return res.status(caminho === '/fornecedores' ? 200 : 201).json({ mensagem: 'Cadastro realizado com sucesso.', [contrato[2]]: novo });
    }
    const alvo = /^\/(esteiras|lotes|producao|alertas)\/([1-9]\d*)$/.exec(caminho);
    if (alvo && (req.method === 'PATCH' || (req.method === 'GET' && alvo[1] === 'esteiras'))) {
        const rota = '/' + alvo[1];
        const [colecao, , entidade, chave] = COLECOES[rota];
        const registro = db.get(colecao).find((r) => Number(r[chave] ?? r.id) === Number(alvo[2])).value();
        if (req.method === 'GET') {
            return registro ? res.json({ esteira: registroApi(rota, registro) }) : res.status(404).json({ detail: 'Esteira não encontrada.' });
        }
        const dados = req.body;
        const campos = dados && typeof dados === 'object' && !Array.isArray(dados) ? Object.keys(dados) : [];
        if (!campos.length || !campos.every((c) => EDITAVEIS[rota].includes(c))
            || (rota === '/alertas' && typeof dados.resolvido !== 'boolean')) {
            return res.status(422).json({ detail: 'Informe ao menos um campo válido para atualizar.' });
        }
        if (!registro) return res.status(404).json({ detail: 'Registro não encontrado.' });
        const atual = registroApi(rota, registro);
        const mudancas = rota === '/alertas' ? { resolvido: dados.resolvido ? 'SIM' : 'NAO' } : { ...dados };
        if (rota === '/producao') {
            const saida = Number(dados.quantidade_saida_kg ?? atual.quantidade_saida_kg ?? 0);
            const rejeito = Number(dados.rejeito_kg ?? atual.rejeito_kg ?? 0);
            if (saida + rejeito > Number(atual.quantidade_entrada_kg) + 0.005) {
                return res.status(422).json({ detail: 'Saída e rejeito somados não podem exceder a entrada do ciclo.' });
            }
            // Itens são acrescentados ao ciclo, como no backend.
            const todos = listar('/producao').flatMap((p) => p.itens ?? []);
            let proximo = Math.max(0, ...todos.map((i) => Number(i.id_item_producao) || 0));
            mudancas.itens = [...(atual.itens ?? []), ...(dados.itens ?? []).map((item) => ({
                id_item_producao: ++proximo, id_producao: atual.id_producao, id_material: item.id_material,
                peso_kg: item.peso_kg, data_hora: new Date().toISOString(),
            }))];
        }
        Object.assign(registro, mudancas);
        return res.json({ mensagem: 'Atualização realizada com sucesso.', [entidade]: registroApi(rota, registro) });
    }
    if (req.method === 'POST' && ['/esteiras/status', '/telemetria'].includes(caminho)) {
        const dados = req.body;
        const campos = ['id_esteira', 'temperatura_esteira_c', 'velocidade_esteira_kmh', 'peso_atual_kg', 'travada'];
        if (caminho === '/telemetria') campos.push('id_producao');
        if (!camposValidos(dados, campos, caminho === '/telemetria' ? ['material_leitura'] : [])) return res.status(422).json({ detail: 'Leitura inválida.' });
        const esteira = db.get('esteiras').find((r) => (r.id_esteira ?? r.id) === dados.id_esteira).value();
        if (!esteira) return res.status(404).json({ detail: 'Esteira não encontrada.' });
        const tipos = [dados.peso_atual_kg > 500 && 'SOBRECARGA', dados.temperatura_esteira_c > 50 && 'TEMPERATURA_ALTA', dados.velocidade_esteira_kmh > 10 && 'VELOCIDADE_ALTA', dados.travada && 'TRAVAMENTO'].filter(Boolean);
        const estado = tipos.length ? 'ESTEIRA DESLIGADA' : 'LIGADA';
        const alertas = tipos.map((tipo) => ({ mensagem: tipo, datahora_alerta: new Date().toISOString() }));
        if (caminho === '/esteiras/status') {
            Object.assign(esteira, { status_esteira: estado, temperatura_esteira_c: dados.temperatura_esteira_c, velocidade_esteira_kmh: dados.velocidade_esteira_kmh });
            return res.json({ mensagem: 'Leitura simulada atualizada.', estado_atual: registroApi('/esteiras', esteira), alertas_seguranca: alertas, acao_tomada: estado });
        }
        if (!listar('/producao').some((r) => r.id_producao === dados.id_producao && r.id_esteira === dados.id_esteira)) return res.status(404).json({ detail: 'Produção não encontrada para esta esteira.' });
        const leitura = salvar('leituras_sensor', { id_leitura_sensor: novoId('/telemetria/historico'), id_esteira: dados.id_esteira, id_producao: dados.id_producao, id_usuario: Number(req.claims.sub), temperatura: dados.temperatura_esteira_c, peso: dados.peso_atual_kg, status_registrado: estado, material_leitura: dados.material_leitura, timestamp: new Date().toISOString() });
        for (const tipo of tipos) salvar('alertas', { id_alerta: novoId('/alertas'), id_leitura_sensor: leitura.id_leitura_sensor, tipo_alerta: tipo, data_hora_alerta: leitura.timestamp, resolvido: 'NAO' });
        return res.json({ usuario_autorizado: req.claims.usuario, equipamento_id: dados.id_esteira, estado_equipamento: estado, alertas_seguranca: alertas, acao_tomada: estado, persistencia_banco: 'Demonstração: leitura salva apenas em memória.' });
    }
    return res.status(404).json({ detail: 'Rota não disponível.' });
};
