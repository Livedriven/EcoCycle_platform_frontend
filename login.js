// features/login/login.js (RF01)
// Login simulado com os usuários de teste. Na integração com a API real,
// só a função autenticar() muda (POST em API.POST) e o mock-users.js é removido.
import "../../shared/setup.js";
import { saveSession, isLoggedIn, HOME_URL } from "../../shared/session.js";
import { mockUsers } from "./mock-users.js";

// Já logado? Vai direto ao dashboard.
if (isLoggedIn()) location.replace(HOME_URL);

const form = document.getElementById("form-login");
const campoUsuario = document.getElementById("usuario");
const campoSenha = document.getElementById("senha");
const caixaErro = document.getElementById("erro-login");
const botao = form.querySelector("button[type=submit]");

// Aviso vindo do guard / logout (ex.: ?motivo=expirada).
if (new URLSearchParams(location.search).get("motivo") === "expirada") {
  mostrarErro("Sua sessão expirou. Entre novamente.");
}

/** Simula o servidor: devolve { token } ou lança erro genérico (não revela qual campo errou). */
async function autenticar(login, senha) {
  await new Promise((r) => setTimeout(r, 400)); // latência fake
  const u = mockUsers.find((m) => m.login === login && m.senha === senha);
  if (!u) throw new Error("Usuário ou senha inválidos.");
  return { token: u.token };
}

function mostrarErro(msg) {
  caixaErro.textContent = msg;
  caixaErro.classList.remove("d-none");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  caixaErro.classList.add("d-none");

  const login = campoUsuario.value.trim();
  const senha = campoSenha.value;
  if (!login || !senha) {
    mostrarErro("Informe usuário e senha.");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Entrando...";
  try {
    const { token } = await autenticar(login, senha);
    saveSession(token); // lança erro se o token for ilegível ou sem nome/perfil válidos
    // Token vencido (operador1) é aceito aqui, mas o guard do dashboard o barra e
    // devolve ao login com ?motivo=expirada: é o jeito de testar a queda de sessão.
    location.replace(HOME_URL);
  } catch (erro) {
    mostrarErro(erro.message.startsWith("Token") ? "Não foi possível iniciar a sessão." : erro.message);
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});