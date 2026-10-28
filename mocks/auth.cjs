// mocks/auth.cjs
// Autenticação do mock: POST /login emite o JWT, POST /logout encerra o token e todas
// as outras rotas (exceto o diagnóstico público) exigem "Authorization: Bearer <token>". Ao validar, preenche
// req.claims, que o rbac.cjs lê.
// Ordem no json-server: auth.cjs primeiro, rbac.cjs depois.
//
// Dependências: npm i -D jsonwebtoken bcryptjs

const { randomBytes, randomUUID } = require('node:crypto');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Só para o mock. A API real tem o segredo dela, fora do código.
const SEGREDO = process.env.MOCK_JWT_SECRET ?? randomBytes(32).toString('hex');
// Para testar a queda de sessão, configure MOCK_JWT_EXPIRA=15s.
const EXPIRA_EM = process.env.MOCK_JWT_EXPIRA ?? "8h";

// Tokens encerrados pelo POST /logout (token -> exp em segundos). Ficam só em
// memória, até vencerem: reiniciar o mock limpa a lista.
const revogados = new Map();

// Consulta somente os usuários fictícios da instância em memória.
function buscarUsuario(req, login) {
    return req.app.db.get('usuarios').find((u) => u.login_usuario === login).value();
}

function tratarLogin(req, res) {
    const { usuario: login, senha } = req.body ?? {};
    const usuario = typeof login === "string" ? buscarUsuario(req, login) : undefined;
    const senhaOk =
        usuario && typeof senha === "string" && bcrypt.compareSync(senha, usuario.senha_hash);

    // Mesma resposta para login inexistente e senha errada: não revela qual campo errou.
    if (!senhaOk) {
        return res.status(401).json({ erro: "usuário ou senha inválidos" });
    }

    // Payload no formato que o front (session.js) lê: { sub, nome, perfil, iat, exp }
    const token = jwt.sign(
        { nome: usuario.nome_usuario, usuario: usuario.login_usuario, perfil: usuario.nivel_acesso },
        SEGREDO,
        { subject: String(usuario.id), expiresIn: EXPIRA_EM, algorithm: "HS256", jwtid: randomUUID() }
    );
    return res.json({
        mensagem: 'Autenticação realizada com sucesso!',
        access_token: token,
        token_type: 'bearer',
        perfil: usuario.nivel_acesso.toUpperCase(),
        acesso_liberado: true,
    });
}

/** Tira da lista os tokens que já venceram: depois disso o jwt.verify os recusa sozinho. */
function limparRevogados() {
    const agora = Math.floor(Date.now() / 1000);
    for (const [token, exp] of revogados) {
        if (exp <= agora) revogados.delete(token);
    }
}

function ehRota(req, rota) {
    return req.method === "POST" && (req.path === rota || req.path === "/api" + rota);
}

module.exports = (req, res, next) => {
    if (req.method === "OPTIONS") return next();
    if (req.method === 'GET' && ['/health/database', '/api/health/database'].includes(req.path)) {
        return res.json({ status: 'ok', banco: 'mock em memória' });
    }

    // O rewriter do routes.json pode ou não ter tirado o /api antes daqui.
    if (ehRota(req, "/login")) {
        return tratarLogin(req, res);
    }

    const [tipo, token] = (req.headers.authorization ?? "").split(" ");
    if (tipo !== "Bearer" || !token) {
        return res.status(401).json({ erro: "token ausente" });
    }

    try {
        req.claims = jwt.verify(token, SEGREDO, { algorithms: ["HS256"] });
    } catch {
        return res.status(401).json({ erro: "token inválido ou expirado" });
    }

    if (revogados.has(token) && !ehRota(req, '/logout')) {
        return res.status(401).json({ erro: "sessão encerrada" });
    }

    // Logout: a partir daqui o token é recusado, mesmo antes do exp.
    if (ehRota(req, "/logout")) {
        limparRevogados();
        revogados.set(token, req.claims.exp);
        return res.json({ mensagem: 'Sessão encerrada com sucesso.' });
    }

    return next();
};
