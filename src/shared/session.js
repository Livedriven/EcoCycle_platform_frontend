import { jwtDecode } from "jwt-decode";

const CHAVE_TOKEN = "token"; // não renomear: o api.js lê exatamente esta chave
const CHAVE_AUTENTICACAO = "autenticacao";

export const LOGIN_URL = "/src/features/login/login.html";
export const HOME_URL = "/src/features/dashboard/dashboard.html";
export const FORBIDDEN_URL = "/src/features/errors/403.html";
// Mesmos níveis aceitos pelo backend (models/usuario.py NIVEIS_ACESSO), em minúsculas.
export const PERFIS = ["administrador", "gerente", "operador", "tecnico", "consulta"];

/**
 * Matriz de permissões do MVP (Especificação MVP2, seção 3): quem pode executar
 * cada ação. Consultar dashboard, lotes, fornecedores, alertas e estoque vale
 * para todos os perfis e não precisa de ação aqui. Lista vazia = ninguém.
 * A interface só esconde e barra; quem garante a regra é a API (401 e 403).
 */
export const PERMISSOES = {
    "fornecedor.cadastrar": ["administrador", "gerente"],
    "lote.registrar": ["administrador", "gerente", "operador"],
    "producao.operar": ["administrador", "gerente", "operador"],
    // Gerenciar usuários pela interface está fora do MVP.
    "usuarios.gerenciar": [],
};

const INTERVALO_VIGIA = 30_000; // confere a validade a cada 30 s
let vigia = null;
let ouvintes = null;

// Cache da última leitura: getUser/getSession são chamados várias vezes por
// página (layout, permissions, api), então o token só é decodificado de novo
// quando muda. A validade (exp) continua sendo conferida a cada chamada.
let cacheToken = null;
let cacheAutenticacao = null;
let cacheSessao = null;

// ---------------------------------------------------------------------------
// Leitura do token (funções puras, com teste)
// ---------------------------------------------------------------------------

/**
 * Lê o payload de um JWT com o jwt-decode (que já trata base64url e UTF-8).
 * Devolve null para qualquer coisa que não seja um JWT legível: nunca lança
 * erro, para não derrubar a página.
 * Atenção: isto só DECODIFICA. A assinatura é validada pela API, nunca aqui.
 */
export function decodeToken(token) {
    try {
        const payload = jwtDecode(token);
        return payload && typeof payload === "object" ? payload : null;
    } catch {
        return null;
    }
}

/**
 * Combina o JWT com o perfil e a liberação devolvidos pelo login.
 * JWTs legados continuam aceitos com nome/perfil no payload.
 * Devolve { token, nome, perfil, exp } ou null se o token não serve.
 */
function lerToken(token, autenticacao) {
    const p = decodeToken(token);
    if (!p) return null;
    if (autenticacao && (
        autenticacao.access_token !== token ||
        autenticacao.acesso_liberado !== true ||
        String(autenticacao.token_type).toLowerCase() !== "bearer"
    )) return null;
    const perfil = String(autenticacao ? autenticacao.perfil : p.perfil ?? "").toLowerCase();
    if (!PERFIS.includes(perfil) || (!autenticacao && !p.nome)) return null;
    const nome = p.nome || p.usuario || p.sub || "Usuário";
    const exp = Number(p.exp);
    return { token, nome: String(nome), perfil, exp: Number.isFinite(exp) ? exp : null };
}

/** Reaproveita a leitura enquanto o token e os dados do login forem os mesmos. */
function lerTokenComCache(token, autenticacao) {
    if (token !== cacheToken || autenticacao !== cacheAutenticacao) {
        cacheToken = token;
        cacheAutenticacao = autenticacao;
        try {
            const dados = autenticacao === null ? null : JSON.parse(autenticacao);
            cacheSessao = autenticacao !== null && (!dados || typeof dados !== "object")
                ? null : lerToken(token, dados);
        } catch {
            cacheSessao = null;
        }
    }
    return cacheSessao;
}

/** Diz se a sessão serve e, se não, por quê: "ausente", "invalida" ou "expirada". */
function verificar() {
    const token = sessionStorage.getItem(CHAVE_TOKEN);
    if (!token) return { sessao: null, motivo: "ausente" };
    const sessao = lerTokenComCache(token, sessionStorage.getItem(CHAVE_AUTENTICACAO));
    if (!sessao) return { sessao: null, motivo: "invalida" };
    // exp do JWT é em segundos; sem exp, só a API (401) derruba a sessão.
    if (sessao.exp !== null && sessao.exp * 1000 <= Date.now()) {
        return { sessao: null, motivo: "expirada" };
    }
    return { sessao, motivo: null };
}

/** Encerra a sessão e preserva o motivo para exibir o aviso no login. */
function derrubar(motivo) {
    endSession(motivo);
}

// ---------------------------------------------------------------------------
// API pública da sessão
// ---------------------------------------------------------------------------

/** Guarda a resposta do login; também aceita JWTs legados. */
export function saveSession(resposta) {
    if (resposta?.acesso_liberado === false) {
        clearSession();
        throw new Error("Acesso não liberado para este usuário.");
    }
    const legado = typeof resposta === "string";
    const token = legado ? resposta : resposta?.access_token;
    const autenticacao = legado ? null : JSON.stringify({
        access_token: token,
        token_type: resposta?.token_type,
        perfil: resposta?.perfil,
        acesso_liberado: resposta?.acesso_liberado,
    });
    // Valida antes de gravar: um token ruim nunca chega ao sessionStorage.
    if (!lerTokenComCache(token, autenticacao)) throw new Error("Token de sessão inválido");
    sessionStorage.setItem(CHAVE_TOKEN, token);
    if (autenticacao === null) sessionStorage.removeItem(CHAVE_AUTENTICACAO);
    else sessionStorage.setItem(CHAVE_AUTENTICACAO, autenticacao);
}

/** { token, nome, perfil, exp } ou null (ausente, inválida ou expirada). */
export function getSession() {
    return verificar().sessao;
}

/** { nome, perfil } ou null. É o que layout.js e permissions.js consultam. */
export function getUser() {
    const s = getSession();
    return s ? { nome: s.nome, perfil: s.perfil } : null;
}

/** true se existe sessão válida agora. Não redireciona. */
export function isLoggedIn() {
    return getSession() !== null;
}

/**
 * true se o perfil pode executar a ação de PERMISSOES. Sem perfil informado,
 * usa o do usuário logado. Sem sessão ou ação desconhecida: false.
 */
export function can(acao, perfil = getUser()?.perfil) {
    return Boolean(perfil) && (PERMISSOES[acao]?.includes(perfil) ?? false);
}

/** Apaga a sessão, sem redirecionar. */
export function clearSession() {
    sessionStorage.removeItem(CHAVE_TOKEN);
    sessionStorage.removeItem(CHAVE_AUTENTICACAO);
    cacheToken = null;
    cacheAutenticacao = null;
    cacheSessao = null;
}

/**
 * Encerra a sessão e volta ao login. Quando fornecido, "motivo" aparece como
 * aviso na tela de login. location.replace não deixa a página protegida no
 * histórico, então o botão "voltar" não a reabre.
 */
export function endSession(motivo) {
    pararVigia();
    clearSession();
    const destino = motivo ? `${LOGIN_URL}?motivo=${encodeURIComponent(motivo)}` : LOGIN_URL;
    location.replace(destino);
}

/** Logout (RF02): chamado pelo botão "Sair" do layout.js. */
export function logout() {
    endSession();
}

/**
 * Protege a página (chamar no começo de todo arquivo de tela protegida).
 * Sem sessão válida, redireciona ao login e devolve null.
 * Com "acao" (chave de PERMISSOES), a tela é só de quem pode executá-la:
 * os outros perfis vão para a página 403 e recebem null.
 * Com acesso, devolve { token, nome, perfil, exp } e passa a vigiar a validade.
 */
export function requireLogin(acao) {
    const { sessao, motivo } = verificar();
    if (!sessao) {
        derrubar(motivo);
        return null;
    }
    if (acao !== undefined && !can(acao, sessao.perfil)) {
        location.replace(FORBIDDEN_URL);
        return null;
    }
    iniciarVigia();
    return sessao;
}

/**
 * Para index.html (e para o login, se já estiver logado): vai ao dashboard
 * com sessão ou ao login sem sessão.
 */
export function entrar() {
    location.replace(isLoggedIn() ? HOME_URL : LOGIN_URL);
}

// ---------------------------------------------------------------------------
// Vigia: derruba a sessão que vence com a página aberta e quando o navegador
// restaura uma página do cache ao clicar em "voltar" (bfcache).
// Só é ligado por requireLogin(), ou seja, só em páginas protegidas.
// ---------------------------------------------------------------------------

function conferir() {
    const { sessao, motivo } = verificar();
    if (!sessao) derrubar(motivo);
}

function iniciarVigia() {
    if (vigia !== null) return;
    // setInterval em vez de setTimeout(exp - agora): tokens que vencem daqui a
    // meses estouram o limite do setTimeout (~24,8 dias) e disparariam na hora.
    vigia = setInterval(conferir, INTERVALO_VIGIA);

    // AbortController permite remover os dois ouvintes de uma vez em pararVigia.
    ouvintes = new AbortController();
    const { signal } = ouvintes;
    globalThis.addEventListener?.("pageshow", (e) => {
        if (e.persisted) conferir();
    }, { signal });
    globalThis.addEventListener?.("visibilitychange", () => {
        if (document.visibilityState === "visible") conferir();
    }, { signal });
}

function pararVigia() {
    if (vigia === null) return;
    clearInterval(vigia);
    vigia = null;
    ouvintes?.abort();
    ouvintes = null;
}
