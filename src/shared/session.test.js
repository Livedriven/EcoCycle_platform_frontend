// shared/session.test.js
import { describe, it, expect, beforeEach } from "vitest";
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
  // [ação, administrador, gerente, operador, consulta]
  const matriz = [
    ["fornecedor.cadastrar", true, true, false, false],
    ["lote.registrar", true, true, true, false],
    ["producao.operar", false, false, true, false],
    ["usuarios.gerenciar", false, false, false, false],
  ];
  const perfis = ["administrador", "gerente", "operador", "consulta"];

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
