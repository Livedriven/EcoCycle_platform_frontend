// shared/session.test.js
import { describe, it, expect, beforeEach } from "vitest";
import {
  decodeToken, saveSession, getSession, getUser, isLoggedIn,
  logout, requireLogin, LOGIN_URL,
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
    expect(destinos).toEqual([LOGIN_URL]);
  });
  it("sessão expirada: redireciona com ?motivo=expirada e limpa o token", () => {
    sessionStorage.setItem("token", tokenValido({ exp: agora() - 10 }));
    expect(requireLogin()).toBeNull();
    expect(destinos).toEqual([`${LOGIN_URL}?motivo=expirada`]);
    expect(sessionStorage.getItem("token")).toBeNull();
  });
});
