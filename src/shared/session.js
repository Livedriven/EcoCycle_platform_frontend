import { jwtDecode } from "jwt-decode";

const CHAVE_TOKEN = "token"; // não renomear: o api.js lê exatamente esta chave

export const LOGIN_URL = "/src/features/login/login.html";
export const HOME_URL = "/src/features/dashboard/dashboard.html";
export const PERFIS = ["administrador", "gerente", "operador", "consulta"];

const INTERVALO_VIGIA = 30_000; // confere a validade a cada 30 s
let vigia = null;
let ouvintes = null;

// Cache da última leitura: getUser/getSession são chamados várias vezes por
// página (layout, permissions, api), então o token só é decodificado de novo
// quando muda. A validade (exp) continua sendo conferida a cada chamada.
let cacheToken = null;
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
 * ÚNICO ponto que conhece o formato do token. Quando a Equipe 2 definir o
 * login real (alinhamento pendente nº 5), só esta função muda.
 * Devolve { token, nome, perfil, exp } ou null se o token não serve.
 */
function lerToken(token) {
    const p = decodeToken(token);
    if (!p) return null;
    const perfil = String(p.perfil ?? "").toLowerCase();
    if (!p.nome || !PERFIS.includes(perfil)) return null;
    const exp = Number(p.exp);
    return { token, nome: p.nome, perfil, exp: Number.isFinite(exp) ? exp : null };
}

/** Igual a lerToken, mas reaproveita o resultado enquanto o token for o mesmo. */
function lerTokenComCache(token) {
    if (token !== cacheToken) {
        cacheToken = token;
        cacheSessao = lerToken(token);
    }
    return cacheSessao;
}

/** Diz se a sessão serve e, se não, por quê: "ausente", "invalida" ou "expirada". */
function verificar() {
    const token = sessionStorage.getItem(CHAVE_TOKEN);
    if (!token) return { sessao: null, motivo: "ausente" };
    const sessao = lerTokenComCache(token);
    if (!sessao) return { sessao: null, motivo: "invalida" };
    // exp do JWT é em segundos; sem exp, só a API (401) derruba a sessão.
    if (sessao.exp !== null && sessao.exp * 1000 <= Date.now()) {
        return { sessao: null, motivo: "expirada" };
    }
    return { sessao, motivo: null };
}

/** Encerra a sessão; só "expirada" vira aviso na tela de login. */
function derrubar(motivo) {
    endSession(motivo === "expirada" ? "expirada" : undefined);
}

// ---------------------------------------------------------------------------
// API pública da sessão
// ---------------------------------------------------------------------------

/** Guarda a sessão após o login. Lança erro se o token não for utilizável. */
export function saveSession(token) {
    // Valida antes de gravar: um token ruim nunca chega ao sessionStorage.
    if (!lerTokenComCache(token)) throw new Error("Token de sessão inválido");
    sessionStorage.setItem(CHAVE_TOKEN, token);
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

/** Apaga a sessão, sem redirecionar. */
export function clearSession() {
    sessionStorage.removeItem(CHAVE_TOKEN);
    cacheToken = null;
    cacheSessao = null;
}

/**
 * Encerra a sessão e volta ao login. "motivo" (ex.: "expirada") aparece como
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
 * Com sessão, devolve { token, nome, perfil, exp } e passa a vigiar a validade.
 */
export function requireLogin() {
    const { sessao, motivo } = verificar();
    if (!sessao) {
        derrubar(motivo);
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