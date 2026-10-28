// Consulta de CEP usada só pela tela de cadastrar fornecedor.
// O ViaCEP é um serviço externo, não a API da plataforma (E2): por isso não passa pelo api.js,
// que enviaria o token JWT e prefixaria a URL com API_URL. Aqui nenhum cabeçalho é enviado.
const URL_VIACEP = 'https://viacep.com.br/ws/';

export function normalizarCep(cep) {
    return String(cep ?? '').replace(/\D/g, '');
}

// 30140071 -> 30140-071 (aceita digitação parcial).
export function formatarCep(cep) {
    const digitos = normalizarCep(cep).slice(0, 8);
    return digitos.length > 5 ? digitos.slice(0, 5) + '-' + digitos.slice(5) : digitos;
}

// Mesmo contrato do validators.js: { valido, mensagem }.
export function validarCep(cep) {
    return normalizarCep(cep).length === 8
        ? { valido: true, mensagem: '' }
        : { valido: false, mensagem: 'Informe um CEP com 8 dígitos.' };
}

// Formato do mock: "Rua das Acácias - Distrito Industrial, Contagem/MG".
// Número e complemento ficam para a pessoa completar.
export function montarEndereco(dados) {
    const logradouro = String(dados.logradouro ?? '').trim();
    const bairro = String(dados.bairro ?? '').trim();
    const cidade = [dados.localidade, dados.uf].map((parte) => String(parte ?? '').trim()).filter(Boolean).join('/');

    let rua = logradouro;
    if (bairro) rua = rua ? rua + ' - ' + bairro : bairro;
    return [rua, cidade].filter(Boolean).join(', ');
}

/**
 * Busca o endereço de um CEP. Nunca lança erro: devolve
 *  { ok: true, endereco }
 *  { ok: false, motivo: 'invalido' | 'nao-encontrado' | 'indisponivel' }
 */
export async function buscarCep(cep, { timeoutMs = 5000 } = {}) {
    if (!validarCep(cep).valido) return { ok: false, motivo: 'invalido' };

    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeoutMs);
    try {
        const resposta = await fetch(URL_VIACEP + normalizarCep(cep) + '/json/', { signal: controlador.signal });
        if (!resposta.ok) return { ok: false, motivo: 'indisponivel' };

        const dados = await resposta.json();
        if (dados.erro) return { ok: false, motivo: 'nao-encontrado' };

        const endereco = montarEndereco(dados);
        return endereco ? { ok: true, endereco } : { ok: false, motivo: 'nao-encontrado' };
    } catch {
        // Sem rede, tempo esgotado ou resposta que não é JSON.
        return { ok: false, motivo: 'indisponivel' };
    } finally {
        clearTimeout(timer);
    }
}