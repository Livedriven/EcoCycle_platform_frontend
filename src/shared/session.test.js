// shared/session.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  decodeToken, saveSession, getSession, getUser, isLoggedIn,
  logout, requireLogin, can, LOGIN_URL, FORBIDDEN_URL,
} from "./session.js";

// Monta um JWT de teste (a assinatura não importa: o front não a valida).
function fazerToken(payload) {
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj), "utf8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.assinatura`;
}
const agora = () => Math.floor(Date.now() / 1000);
const tokenValido = (extra = {}) =>
  fazerToken({ sub: "1", nome: "Patrícia Lima", perfil: "gerente", exp: agora() + 3600, ...extra });

// Dublês simples de sessionStorage e location (o Vitest roda em Node, sem navegador).
let memoria, destinos;
beforeEach(() => {
  memoria = new Map();
  destinos = [];
  globalThis.sessionStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  };
  globalThis.location = { replace: (url) => destinos.push(url) };
});

describe("decodeToken", () => {
  it("lê o payload e preserva acentos", () => {
    expect(decodeToken(tokenValido()).nome).toBe("Patrícia Lima");
  });
  it("devolve null para token malformado, vazio ou não-JWT", () => {
    expect(decodeToken("isto.nao-e-um-jwt")).toBeNull();
    expect(decodeToken("")).toBeNull();
    expect(decodeToken(undefined)).toBeNull();
    expect(decodeToken("a.%%%.c")).toBeNull();
  });
});

describe("saveSession / getSession / getUser", () => {
  it("guarda na chave 'token' (a que o api.js lê) e devolve nome e perfil", () => {
    const t = tokenValido();
    saveSession(t);
    expect(sessionStorage.getItem("token")).toBe(t);
    expect(getUser()).toEqual({ nome: "Patrícia Lima", perfil: "gerente" });
    expect(isLoggedIn()).toBe(true);
  });
  it("normaliza o perfil para minúsculas", () => {
    saveSession(tokenValido({ perfil: "Administrador" }));
    expect(getUser().perfil).toBe("administrador");
  });
  it("recusa token inválido e não deixa lixo guardado", () => {
    expect(() => saveSession("isto.nao-e-um-jwt")).toThrow();
    expect(sessionStorage.getItem("token")).toBeNull();
  });
  it("recusa perfil desconhecido", () => {
    expect(() => saveSession(tokenValido({ perfil: "visitante" }))).toThrow();
  });
  it("trata token vencido como sem sessão", () => {
    saveSession(tokenValido()); // válido ao salvar
    sessionStorage.setItem("token", tokenValido({ exp: agora() - 10 }));
    expect(getSession()).toBeNull();
    expect(isLoggedIn()).toBe(false);
  });
  it("não quebra com token malformado injetado à mão", () => {
    sessionStorage.setItem("token", "isto.nao-e-um-jwt");
    expect(getSession()).toBeNull();
  });
});

describe("logout", () => {
  it("apaga a sessão e vai ao login sem motivo", () => {
    saveSession(tokenValido());
    logout();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(destinos).toEqual([LOGIN_URL]);
  });
});

describe("resposta de autenticação do backend", () => {
  const respostaLogin = (extra = {}) => ({
    mensagem: "Autenticação realizada com sucesso!",
    access_token: fazerToken({ sub: "operador1", exp: agora() + 3600 }),
    token_type: "bearer",
    perfil: "OPERADOR",
    acesso_liberado: true,
    ...extra,
  });

  it("aceita perfil fora do JWT e usa sub quando o token não tem nome", () => {
    const resposta = respostaLogin();
    saveSession(resposta);
    expect(sessionStorage.getItem("token")).toBe(resposta.access_token);
    expect(getUser()).toEqual({ nome: "operador1", perfil: "operador" });
    expect(can("producao.operar")).toBe(true);
    expect(can("fornecedor.cadastrar")).toBe(false);
  });
  it.each(["ADMINISTRADOR", "GERENTE", "OPERADOR", "TECNICO", "CONSULTA"])(
    "aceita o nível %s devolvido pelo login do backend",
    (perfil) => {
      const token = fazerToken({ sub: "7", usuario: "u1", perfil, exp: agora() + 3600 });
      saveSession(respostaLogin({ access_token: token, perfil }));
      expect(getUser()).toEqual({ nome: "u1", perfil: perfil.toLowerCase() });
    },
  );
  it("mostra o login do claim usuario quando sub é o identificador numérico", () => {
    saveSession(respostaLogin({ access_token: fazerToken({ sub: '7', usuario: 'operador1', perfil: 'OPERADOR', exp: agora() + 3600 }) }));
    expect(getUser()).toEqual({ nome: 'operador1', perfil: 'operador' });
  });
  it("preserva o perfil ao carregar outra página", async () => {
    saveSession(respostaLogin());
    vi.resetModules();
    const sessaoNovaPagina = await import("./session.js");
    expect(sessaoNovaPagina.getUser()).toEqual({ nome: "operador1", perfil: "operador" });
  });
  it("prioriza o perfil da resposta e preserva o nome do JWT", () => {
    saveSession(respostaLogin({ access_token: tokenValido({ perfil: "administrador" }) }));
    expect(getUser()).toEqual({ nome: "Patrícia Lima", perfil: "operador" });
  });
  it("aceita JWT sem nome ou sub e mantém a sessão sem exp até a API recusá-la", () => {
    saveSession(respostaLogin({ access_token: fazerToken({}) }));
    expect(getUser()).toEqual({ nome: "Usuário", perfil: "operador" });
    expect(getSession().exp).toBeNull();
  });
  it("não libera sessão quando acesso_liberado é false e apaga a sessão anterior", () => {
    saveSession(respostaLogin());
    expect(() => saveSession(respostaLogin({ acesso_liberado: false }))).toThrow("Acesso não liberado");
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("autenticacao")).toBeNull();
    expect(isLoggedIn()).toBe(false);
  });
  it.each([
    { access_token: undefined }, { access_token: "token inválido" },
    { token_type: "basic" }, { token_type: undefined },
    { perfil: "VISITANTE" }, { perfil: undefined },
    { acesso_liberado: undefined }, { acesso_liberado: "true" },
  ])("recusa resposta inválida: %j", (extra) => {
    expect(() => saveSession(respostaLogin(extra))).toThrow("Token de sessão inválido");
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("autenticacao")).toBeNull();
  });
  it("preserva a expiração do JWT com o novo contrato", () => {
    saveSession(respostaLogin({ access_token: fazerToken({ exp: agora() - 1 }) }));
    expect(requireLogin()).toBeNull();
    expect(destinos).toEqual([`${LOGIN_URL}?motivo=expirada`]);
    expect(sessionStorage.getItem("autenticacao")).toBeNull();
  });
  it("não associa os dados de autenticação a outro token", () => {
    saveSession(respostaLogin());
    sessionStorage.setItem("token", tokenValido());
    expect(getSession()).toBeNull();
  });
  it("recusa metadados corrompidos", () => {
    saveSession(respostaLogin());
    sessionStorage.setItem("autenticacao", "{inválido");
    expect(getSession()).toBeNull();
  });
  it("limpa os dados do login ao sair e permite voltar aos tokens antigos", () => {
    saveSession(respostaLogin());
    logout();
    expect(sessionStorage.getItem("autenticacao")).toBeNull();
    saveSession(respostaLogin());
    saveSession(tokenValido());
    expect(sessionStorage.getItem("autenticacao")).toBeNull();
    expect(getUser().perfil).toBe("gerente");
  });
});

describe("requireLogin", () => {
  it("sem sessão: redireciona ao login e devolve null", () => {
    expect(requireLogin()).toBeNull();
    expect(destinos).toEqual([`${LOGIN_URL}?motivo=ausente`]);
  });
  it("sessão expirada: redireciona com ?motivo=expirada e limpa o token", () => {
    sessionStorage.setItem("token", tokenValido({ exp: agora() - 10 }));
    expect(requireLogin()).toBeNull();
    expect(destinos).toEqual([`${LOGIN_URL}?motivo=expirada`]);
    expect(sessionStorage.getItem("token")).toBeNull();
  });
});

describe("can (matriz de permissões do MVP)", () => {
  // [ação, administrador, gerente, operador, tecnico, consulta]
  const matriz = [
    ["fornecedor.cadastrar", true, true, false, false, false],
    ["lote.registrar", true, true, true, false, false],
    ["producao.operar", true, true, true, false, false],
    ["usuarios.gerenciar", false, false, false, false, false],
  ];
  const perfis = ["administrador", "gerente", "operador", "tecnico", "consulta"];

  it.each(matriz)("%s segue a especificação", (acao, ...esperado) => {
    expect(perfis.map((perfil) => can(acao, perfil))).toEqual(esperado);
  });
  it("sem perfil informado, usa o do usuário logado", () => {
    saveSession(tokenValido({ perfil: "operador" }));
    expect(can("producao.operar")).toBe(true);
    expect(can("fornecedor.cadastrar")).toBe(false);
  });
  it("sem sessão ou com ação desconhecida, nega", () => {
    expect(can("lote.registrar")).toBe(false);
    expect(can("acao.que.nao.existe", "administrador")).toBe(false);
  });
});

describe("requireLogin com ação", () => {
  it.each(["administrador", "gerente", "operador"])("%s pode acessar a operação de produção", (perfil) => {
    saveSession(tokenValido({ perfil }));
    expect(requireLogin("producao.operar")?.perfil).toBe(perfil);
    expect(destinos).toEqual([]);
  });
  it("consulta continua sem acesso à operação de produção", () => {
    saveSession(tokenValido({ perfil: "consulta" }));
    expect(requireLogin("producao.operar")).toBeNull();
    expect(destinos).toEqual([FORBIDDEN_URL]);
  });
  it("perfil sem permissão: vai para a página 403 e devolve null", () => {
    saveSession(tokenValido({ perfil: "consulta" }));
    expect(requireLogin("lote.registrar")).toBeNull();
    expect(destinos).toEqual([FORBIDDEN_URL]);
    expect(sessionStorage.getItem("token")).not.toBeNull(); // a sessão continua
  });
  it("perfil com permissão: devolve a sessão sem redirecionar", () => {
    saveSession(tokenValido({ perfil: "gerente" }));
    expect(requireLogin("fornecedor.cadastrar")?.perfil).toBe("gerente");
    expect(destinos).toEqual([]);
  });
  it("sem sessão, o login vem antes da permissão", () => {
    expect(requireLogin("lote.registrar")).toBeNull();
    expect(destinos).toEqual([`${LOGIN_URL}?motivo=ausente`]);
  });
});
