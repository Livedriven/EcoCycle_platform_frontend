// shared/config.js
// Lê o .env e entrega as configurações já validadas para o resto do projeto.
// Só variáveis com prefixo VITE_ chegam ao navegador, e tudo o que vem do .env
// fica visível para quem abrir o site: nunca colocar senha ou chave secreta.

const TIMEOUT_PADRAO = 8000; // milissegundos

const urlDoEnv = import.meta.env.VITE_API_URL?.trim() || "http://localhost:8000/api";

// Tira a "/" do final para que API_URL + "/lotes" nunca vire "//lotes".
export const API_URL = urlDoEnv.replace(/\/+$/, "");

// Só aceita número positivo; vazio, texto, zero ou negativo voltam ao padrão.
const timeoutDoEnv = Number(import.meta.env.VITE_API_TIMEOUT);
export const API_TIMEOUT =
  Number.isFinite(timeoutDoEnv) && timeoutDoEnv > 0 ? timeoutDoEnv : TIMEOUT_PADRAO;
