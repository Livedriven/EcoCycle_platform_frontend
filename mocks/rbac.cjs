// Somente rotas públicas do contrato, com as permissões de operação do portal.
const LEITURAS = new Set([
    '/lotes', '/fornecedores', '/materiais', '/producao', '/equipamentos', '/alertas',
    '/telemetria/historico', '/producao/dashboard-diario', '/producao/dashboard-mensal', '/producao/dashboard-trimestral',
]);
const CADASTROS = {
    '/fornecedores': ['administrador', 'gerente'],
    '/lotes': ['administrador', 'gerente', 'operador'],
    '/producao': ['administrador', 'gerente', 'operador'],
};

module.exports = (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const perfil = String(req.claims?.perfil ?? '').toLowerCase();
    const leitura = req.method === 'GET' && LEITURAS.has(req.path);
    const cadastro = req.method === 'POST' && (CADASTROS[req.path]?.includes(perfil)
        || ['/materiais', '/equipamentos/status', '/telemetria'].includes(req.path));
    if (leitura || cadastro) return next();
    return res.status(403).json({ erro: 'sem permissão' });
};
