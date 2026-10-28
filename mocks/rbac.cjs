// Somente rotas públicas do contrato, com as permissões de operação do portal.
const LEITURAS = new Set([
    '/lotes', '/fornecedores', '/materiais', '/producao', '/esteiras', '/alertas',
    '/telemetria/historico', '/producao/dashboard-diario', '/producao/dashboard-mensal', '/producao/dashboard-trimestral',
]);
const CADASTROS = {
    '/fornecedores': ['administrador', 'gerente'],
    '/lotes': ['administrador', 'gerente', 'operador'],
    '/producao': ['administrador', 'gerente', 'operador'],
    '/esteiras': ['administrador', 'gerente', 'tecnico'],
};
// PATCH em /rota/:id, com os mesmos perfis do backend.
const ATUALIZACOES = {
    '/esteiras': ['administrador', 'gerente', 'tecnico'],
    '/lotes': ['administrador', 'gerente', 'operador'],
    '/producao': ['administrador', 'gerente', 'operador'],
    '/alertas': ['administrador', 'gerente', 'tecnico'],
};

module.exports = (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const perfil = String(req.claims?.perfil ?? '').toLowerCase();
    const comId = /^(\/[a-z]+)\/[1-9]\d*$/.exec(req.path);
    const leitura = req.method === 'GET' && (LEITURAS.has(req.path) || comId?.[1] === '/esteiras');
    const cadastro = req.method === 'POST' && (CADASTROS[req.path]?.includes(perfil)
        || ['/materiais', '/esteiras/status', '/telemetria'].includes(req.path));
    const atualizacao = req.method === 'PATCH' && Boolean(comId && ATUALIZACOES[comId[1]]?.includes(perfil));
    if (leitura || cadastro || atualizacao) return next();
    return res.status(403).json({ erro: 'sem permissão' });
};
