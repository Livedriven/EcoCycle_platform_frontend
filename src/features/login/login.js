// features/login/login.js (RF01)
// Login simulado com os usuários de teste. Na integração com a API real,
// só a função autenticar() muda (POST em API.POST) e o mock-users.js é removido.
import "../../shared/setup.js";
import './login.css';
import { saveSession, isLoggedIn, HOME_URL } from "../../shared/session.js";
import API from "../../shared/api.js";

// Já logado? Vai direto ao dashboard.
if (isLoggedIn()) location.replace(HOME_URL);

const form = document.getElementById("form-login");
const campoUsuario = document.getElementById("usuario");
const campoSenha = document.getElementById("senha");
const caixaErro = document.getElementById("erro-login");
const botao = form.querySelector("button[type=submit]");

// Aviso vindo do guard ao exigir autenticação para acessar uma página protegida.
const mensagensPorMotivo = {
  ausente: "Faça login para acessar esta página.",
  invalida: "Sua sessão não é válida. Entre novamente.",
  expirada: "Sua sessão expirou. Entre novamente.",
};
const motivo = new URLSearchParams(location.search).get("motivo");
if (mensagensPorMotivo[motivo]) {
  mostrarErro(mensagensPorMotivo[motivo]);
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
    const { token } = await API.POST("/login", { login, senha });
    saveSession(token); // lança erro se o token for ilegível ou sem nome/perfil válidos
    // Token vencido (operador1) é aceito aqui, mas o guard do dashboard o barra e
    // devolve ao login com ?motivo=expirada: é o jeito de testar a queda de sessão.
    location.replace(HOME_URL);
  } catch (erro) {
    if (erro.message === "HTTP 401") {
      mostrarErro("Usuário ou senha inválidos.");
    } else if (erro.message.startsWith("Token")) {
      mostrarErro("Não foi possível iniciar a sessão.");
    } else {
      mostrarErro(erro.message); // sem conexão, timeout etc. já vêm amigáveis do api.js
    }
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});
