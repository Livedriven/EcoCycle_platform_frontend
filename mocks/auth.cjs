// mocks/auth.cjs
// Autenticação do mock: POST /login emite o JWT, POST /logout encerra o token e todas
// as outras rotas exigem "Authorization: Bearer <token>". Ao validar, preenche
// req.claims, que o rbac.cjs lê.
// Ordem no json-server: auth.cjs primeiro, rbac.cjs depois.
//
// Dependências: npm i -D jsonwebtoken bcryptjs

const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Só para o mock. A API real tem o segredo dela, fora do código.
const SEGREDO = process.env.JWT_SEGREDO ?? "ecocycle-segredo-de-desenvolvimento";
// Para testar a queda de sessão: JWT_EXPIRA=15s npm run mock
const EXPIRA_EM = process.env.JWT_EXPIRA ?? "8h";
const ARQUIVO_DB = path.join(__dirname, "db.json"); // ajuste se o db.json estiver em outra pasta

// Tokens encerrados pelo POST /logout (token -> exp em segundos). Ficam só em
// memória, até vencerem: reiniciar o mock limpa a lista.
const revogados = new Map();

// Lê o arquivo a cada login: simples, e enxerga usuários alterados com o servidor ligado.
function buscarUsuario(login) {
    const db = JSON.parse(fs.readFileSync(ARQUIVO_DB, "utf8"));
    return db.usuarios.find((u) => u.login_usuario === login);
}

function tratarLogin(req, res) {
    const { login, senha } = req.body ?? {};
    const usuario = typeof login === "string" ? buscarUsuario(login) : undefined;
    const senhaOk =
        usuario && typeof senha === "string" && bcrypt.compareSync(senha, usuario.senha_hash);

    // Mesma resposta para login inexistente e senha errada: não revela qual campo errou.
    if (!senhaOk) {
        return res.status(401).json({ erro: "usuário ou senha inválidos" });
    }

    // Payload no formato que o front (session.js) lê: { sub, nome, perfil, iat, exp }
    const token = jwt.sign(
        { nome: usuario.nome_usuario, perfil: usuario.nivel_acesso },
        SEGREDO,
        { subject: String(usuario.id), expiresIn: EXPIRA_EM, algorithm: "HS256" }
    );
    return res.json({ token });
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

    if (revogados.has(token)) {
        return res.status(401).json({ erro: "sessão encerrada" });
    }

    // Logout: a partir daqui o token é recusado, mesmo antes do exp.
    if (ehRota(req, "/logout")) {
        limparRevogados();
        revogados.set(token, req.claims.exp);
        return res.status(204).end();
    }

    return next();
};
