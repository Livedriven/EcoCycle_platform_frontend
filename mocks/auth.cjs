// mocks/auth.cjs
// Autenticação do mock: POST /login emite o JWT e todas as outras rotas exigem
// "Authorization: Bearer <token>". Ao validar, preenche req.claims, que o rbac.cjs lê.
// Ordem no json-server: auth.cjs primeiro, rbac.cjs depois.
//
// Dependências: npm i -D jsonwebtoken bcryptjs

const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Só para o mock. A API real tem o segredo dela, fora do código.
const SEGREDO = process.env.JWT_SEGREDO ?? "ecocycle-segredo-de-desenvolvimento";
// Para testar a queda de sessão: JWT_EXPIRA=15s npm run api
const EXPIRA_EM = process.env.JWT_EXPIRA ?? "8h";
const ARQUIVO_DB = path.join(__dirname, "db.json"); // ajuste se o db.json estiver em outra pasta

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

module.exports = (req, res, next) => {
    if (req.method === "OPTIONS") return next();

    // O rewriter do routes.json pode ou não ter tirado o /api antes daqui.
    if (req.method === "POST" && (req.path === "/login" || req.path === "/api/login")) {
        return tratarLogin(req, res);
    }

    const [tipo, token] = (req.headers.authorization ?? "").split(" ");
    if (tipo !== "Bearer" || !token) {
        return res.status(401).json({ erro: "token ausente" });
    }

    try {
        req.claims = jwt.verify(token, SEGREDO, { algorithms: ["HS256"] });
        return next();
    } catch {
        return res.status(401).json({ erro: "token inválido ou expirado" });
    }
};
