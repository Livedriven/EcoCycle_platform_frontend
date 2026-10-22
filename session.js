const CHAVE_TOKEN = "token"; // não renomear: o api.js lê exatamente esta chave

export const LOGIN_URL = "/src/features/login/login.html";
export const HOME_URL = "/src/features/dashboard/dashboard.html";
export const PERFIS = ["administrador", "gerente", "operador", "consulta"];

const INTERVALO_VIGIA = 30_000; // confere a validade a cada 30 s
let vigia = null;

// ---------------------------------------------------------------------------
// Leitura do token (funções puras, com teste)
// ---------------------------------------------------------------------------

/**
 * Lê o payload de um JWT. Devolve null para qualquer coisa que não seja um
 * JWT legível: nunca lança erro, para não derrubar a página.
 * Trata base64url e acentos (atob sozinho estraga "João", "Patrícia").
 */
export function decodeToken(token) {
  try {
    const partes = String(token).split(".");
    if (partes.length !== 3) return null;
    const b64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const completo = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(completo), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
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

/** Diz se a sessão serve e, se não, por quê: "ausente", "invalida" ou "expirada". */
function verificar() {
  const token = sessionStorage.getItem(CHAVE_TOKEN);
  if (!token) return { sessao: null, motivo: "ausente" };
  const sessao = lerToken(token);
  if (!sessao) return { sessao: null, motivo: "invalida" };
  // exp do JWT é em segundos; sem exp, só a API (401) derruba a sessão.
  if (sessao.exp !== null && sessao.exp * 1000 <= Date.now()) {
    return { sessao: null, motivo: "expirada" };
  }
  return { sessao, motivo: null };
}

// ---------------------------------------------------------------------------
// API pública da sessão
// ---------------------------------------------------------------------------

/** Guarda a sessão após o login. Lança erro se o token não for utilizável. */
export function saveSession(token) {
  sessionStorage.setItem(CHAVE_TOKEN, token);
  if (!lerToken(token)) {
    sessionStorage.removeItem(CHAVE_TOKEN);
    throw new Error("Token de sessão inválido");
  }
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
    endSession(motivo === "expirada" ? "expirada" : undefined);
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
  if (!sessao) endSession(motivo === "expirada" ? "expirada" : undefined);
}

function iniciarVigia() {
  if (vigia !== null) return;
  // setInterval em vez de setTimeout(exp - agora): tokens que vencem daqui a
  // meses estouram o limite do setTimeout (~24,8 dias) e disparariam na hora.
  vigia = setInterval(conferir, INTERVALO_VIGIA);

  globalThis.addEventListener?.("pageshow", (e) => {
    if (e.persisted) conferir();
  });
  globalThis.addEventListener?.("visibilitychange", () => {
    if (document.visibilityState === "visible") conferir();
  });
}

function pararVigia() {
  if (vigia !== null) {
    clearInterval(vigia);
    vigia = null;
  }
}