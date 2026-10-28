import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_URL, saveSession } from '../../shared/session.js';

vi.mock('../../shared/setup.js', () => ({}));
vi.mock('../../shared/session.js', () => ({
  isLoggedIn: () => false,
  saveSession: vi.fn(),
  HOME_URL: '/src/features/dashboard/dashboard.html',
}));

let campos;
let botao;
let enviar;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_URL', 'http://localhost:8000/api');
  vi.stubEnv('MODE', 'production');
  botao = { disabled: false, textContent: 'Entrar' };
  campos = {
    'form-login': {
      querySelector: () => botao,
      addEventListener: (evento, callback) => { if (evento === 'submit') enviar = callback; },
    },
    usuario: { value: ' operador ' },
    senha: { value: ' senha com espaços ' },
    'alternar-senha': { addEventListener: vi.fn() },
    'erro-login': { textContent: '', classList: { add: vi.fn(), remove: vi.fn() } },
    'usuarios-demo': { hidden: true },
  };
  vi.stubGlobal('document', { getElementById: (id) => campos[id] });
  vi.stubGlobal('location', { search: '', replace: vi.fn() });
  // Um token antigo não deve acompanhar a tentativa de autenticação.
  vi.stubGlobal('sessionStorage', { getItem: vi.fn(() => 'token-antigo') });
  vi.stubGlobal('fetch', vi.fn());
  await import('./login.js');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('envio do formulário de login', () => {
  it('mostra as contas de demonstração somente no modo demo', async () => {
    expect(campos['usuarios-demo'].hidden).toBe(true);
    vi.stubEnv('MODE', 'demo');
    vi.resetModules();
    await import('./login.js');
    expect(campos['usuarios-demo'].hidden).toBe(false);
  });
  it('envia POST com o contrato do backend e inicia a sessão retornada', async () => {
    const resposta = { access_token: 'novo-token', token_type: 'bearer', perfil: 'OPERADOR', acesso_liberado: true };
    fetch.mockResolvedValue({ status: 200, ok: true, json: async () => resposta });
    const preventDefault = vi.fn();

    await enviar({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledExactlyOnceWith('http://localhost:8000/api/login', expect.objectContaining({
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'operador', senha: ' senha com espaços ' }),
    }));
    expect(saveSession).toHaveBeenCalledWith(resposta);
    expect(location.replace).toHaveBeenCalledWith(HOME_URL);
  });

  it.each([
    [401, 'Usuário ou senha inválidos.'],
    [503, 'O serviço está temporariamente indisponível. Tente novamente em alguns instantes.'],
  ])('mantém a falha HTTP %s no formulário e permite tentar novamente', async (status, mensagem) => {
    fetch.mockResolvedValue({ status, ok: false });
    await enviar({ preventDefault: vi.fn() });
    expect(campos['erro-login'].textContent).toBe(mensagem);
    expect(botao.disabled).toBe(false);
    expect(botao.textContent).toBe('Entrar');
    expect(saveSession).not.toHaveBeenCalled();
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('mostra a falha de conexão no formulário', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await enviar({ preventDefault: vi.fn() });
    expect(campos['erro-login'].textContent).toContain('Não foi possível conectar à API');
    expect(botao.disabled).toBe(false);
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('não envia credenciais vazias', async () => {
    campos.usuario.value = '   ';
    await enviar({ preventDefault: vi.fn() });
    expect(fetch).not.toHaveBeenCalled();
    expect(campos['erro-login'].textContent).toBe('Informe usuário e senha.');
  });
});
