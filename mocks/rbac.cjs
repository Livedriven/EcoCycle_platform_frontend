// mocks/rbac.cjs
// Permissões do mock por perfil, seguindo a matriz do MVP (Especificação MVP2, seção 3).
// Roda depois do auth.cjs, que preenche req.claims com o perfil do token.
// Sem permissão: 403. Mantenha igual ao PERMISSOES de src/shared/session.js.

const PERMISSOES = {
    "fornecedor.cadastrar": ["administrador", "gerente"],
    "lote.registrar": ["administrador", "gerente", "operador"],
    "producao.operar": ["administrador", "gerente", "operador"],
    // Gerenciar usuários pela interface está fora do MVP.
    "usuarios.gerenciar": [],
};

// Consulta (GET) liberada para os 4 perfis: dashboard, lotes, fornecedores,
// alertas e estoque (produção), mais as esteiras e leituras que o dashboard mostra.
const CONSULTA_LIVRE = ["lotes", "fornecedores", "alertas", "producao", "esteiras", "leituras_sensor"];

// Operações protegidas: "MÉTODO recurso" -> ação de PERMISSOES.
// O que não está aqui (PUT, DELETE, logs_sistema...) é recusado para todos.
const OPERACOES = {
    "POST fornecedores": "fornecedor.cadastrar",
    "POST lotes": "lote.registrar",
    // iniciar produção cria o registro; finalizar altera o registro
    "POST producao": "producao.operar",
    "PATCH producao": "producao.operar",
    "GET usuarios": "usuarios.gerenciar",
    "POST usuarios": "usuarios.gerenciar",
    "PUT usuarios": "usuarios.gerenciar",
    "PATCH usuarios": "usuarios.gerenciar",
    "DELETE usuarios": "usuarios.gerenciar",
};

function pode(perfil, metodo, recurso) {
    if (metodo === "GET" && CONSULTA_LIVRE.includes(recurso)) {
        return true;
    }
    const acao = OPERACOES[`${metodo} ${recurso}`];
    return Boolean(acao) && PERMISSOES[acao].includes(perfil);
}

module.exports = (req, res, next) => {
    if (req.method === "OPTIONS") return next();

    // "/lotes/3" -> "lotes" (o routes.json já tirou o /api daqui)
    const recurso = req.path.split("/")[1];
    const perfil = String(req.claims?.perfil ?? "").toLowerCase();

    if (pode(perfil, req.method, recurso)) {
        return next();
    }
    return res.status(403).json({ erro: "sem permissão" });
};
