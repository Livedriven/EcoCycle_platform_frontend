// features/login/login.js (RF01)
// Login pela API configurada em VITE_API_URL.
import "../../shared/setup.js";
import './login.css';
import { saveSession, isLoggedIn, HOME_URL } from "../../shared/session.js";
import API from "../../shared/api.js";

const usuariosDemo = document.getElementById('usuarios-demo');
if (usuariosDemo) usuariosDemo.hidden = import.meta.env.MODE !== 'demo';

// Já logado? Vai direto ao dashboard.
if (isLoggedIn()) location.replace(HOME_URL);

const form = document.getElementById("form-login");
const campoUsuario = document.getElementById("usuario");
const campoSenha = document.getElementById("senha");
const alternarSenha = document.getElementById("alternar-senha");
const caixaErro = document.getElementById("erro-login");
const botao = form.querySelector("button[type=submit]");

alternarSenha.addEventListener("click", () => {
  const mostrar = campoSenha.type === "password";
  campoSenha.type = mostrar ? "text" : "password";
  const rotulo = mostrar ? "Ocultar senha" : "Mostrar senha";
  alternarSenha.setAttribute("aria-label", rotulo);
  alternarSenha.setAttribute("aria-pressed", String(mostrar));
  alternarSenha.title = rotulo;
  alternarSenha.querySelector("i").className = mostrar ? "bi bi-eye" : "bi bi-eye-slash";
});

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

  const usuario = campoUsuario.value.trim();
  const senha = campoSenha.value;
  if (!usuario || !senha) {
    mostrarErro("Informe usuário e senha.");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Entrando...";
  try {
    const credenciais = { usuario, senha };
    const resposta = await API.POST("/login", credenciais, {
      erroLocal: true,
    });
    saveSession(resposta);
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
