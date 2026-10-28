import API from '../../shared/api.js';
import { montarLayout } from '../../shared/layout.js';
import { HOME_URL } from '../../shared/session.js';
import { validarCadastroFornecedor, montarPayloadFornecedor } from './supplier-payload.js';
import { buscarCep, validarCep } from './cep.js';
import { aplicarMascarasFornecedor } from './input-masks.js';

// Só administrador e gerente cadastram fornecedor (matriz PERMISSOES). Outros perfis vão para a página 403.
const SESSAO = montarLayout({ acao: 'fornecedor.cadastrar' });

if (SESSAO) {
    iniciarTela();
}

function iniciarTela() {
    const form = document.getElementById('form-fornecedor');
    const aviso = document.getElementById('aviso-envio');
    const btnSalvar = document.getElementById('btn-salvar');
    // As chaves são as mesmas do payload e das chaves de erro de validarFornecedor.
    const campos = {
        id_fornecedor: document.getElementById('codigo-fornecedor'),
        nome_fornecedor: document.getElementById('nome'),
        cnpj_fornecedor: document.getElementById('cnpj'),
        telefone_fornecedor: document.getElementById('telefone'),
        email_fornecedor: document.getElementById('email'),
        endereco_fornecedor: document.getElementById('endereco')
    };
    const feedbacks = {
        id_fornecedor: document.getElementById('erro-codigo-fornecedor'),
        nome_fornecedor: document.getElementById('erro-nome'),
        cnpj_fornecedor: document.getElementById('erro-cnpj'),
        telefone_fornecedor: document.getElementById('erro-telefone'),
        email_fornecedor: document.getElementById('erro-email'),
        endereco_fornecedor: document.getElementById('erro-endereco')
    };

    // Busca por CEP: só ajuda a preencher o endereço. O CEP não vai no payload.
    const inputCep = document.getElementById('cep');
    const btnCep = document.getElementById('btn-buscar-cep');
    const erroCep = document.getElementById('erro-cep');
    const statusCep = document.getElementById('status-cep');
    let enderecoDoCep = '';

    aplicarMascarasFornecedor({
        cnpj: campos.cnpj_fornecedor,
        telefone: campos.telefone_fornecedor,
        cep: inputCep
    });

    btnCep.addEventListener('click', consultarCep);
    inputCep.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter') {
            evento.preventDefault();
            consultarCep();
        }
    });
    inputCep.addEventListener('input', () => {
        limparErroCep();
        mostrarStatusCep('');
    });

    form.addEventListener('submit', enviar);
    document.getElementById('btn-cancelar').addEventListener('click', () => {
        location.href = HOME_URL;
    });
    Object.entries(campos).forEach(([nome, campo]) => {
        campo.addEventListener('input', () => limparErro(nome));
    });

    async function enviar(evento) {
        evento.preventDefault();
        esconderAviso();

        // Valores crus: o validador aceita CNPJ e telefone com ou sem máscara.
        const dados = {};
        Object.entries(campos).forEach(([nome, campo]) => {
            dados[nome] = campo.value;
        });
        const validacao = validarCadastroFornecedor(dados);
        mostrarErros(validacao.erros);
        if (!validacao.valido) return;

        const payload = montarPayloadFornecedor(dados);

        btnSalvar.disabled = true;
        btnSalvar.textContent = 'Salvando...';
        try {
            await API.POST('/fornecedores', payload);
            mostrarAviso('success', 'Fornecedor "' + payload.nome_fornecedor + '" cadastrado com sucesso.');
            form.reset();
            limparErroCep();
            mostrarStatusCep('');
            enderecoDoCep = '';
            campos.nome_fornecedor.focus();
        } catch (erro) {
            mostrarAviso('danger', traduzirErro(erro));
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar fornecedor';
        }
    }

    async function consultarCep() {
        limparErroCep();
        mostrarStatusCep('');

        const validacao = validarCep(inputCep.value);
        if (!validacao.valido) {
            inputCep.classList.add('is-invalid');
            erroCep.textContent = validacao.mensagem;
            inputCep.focus();
            return;
        }

        btnCep.disabled = true;
        btnCep.textContent = 'Buscando...';
        const resultado = await buscarCep(inputCep.value);
        btnCep.disabled = false;
        btnCep.textContent = 'Buscar CEP';

        // Falha na consulta não bloqueia nada: o endereço continua editável à mão.
        if (!resultado.ok) {
            const mensagem = resultado.motivo === 'nao-encontrado'
                ? 'CEP não encontrado. Preencha o endereço manualmente.'
                : 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.';
            mostrarStatusCep(mensagem, 'text-danger');
            campos.endereco_fornecedor.focus();
            return;
        }

        // Não apaga o que a pessoa digitou: só substitui se estiver vazio ou se for o texto do CEP anterior.
        const atual = campos.endereco_fornecedor.value.trim();
        if (atual && atual !== enderecoDoCep) {
            mostrarStatusCep('O endereço já está preenchido e não foi alterado. Apague-o para usar o endereço deste CEP.', 'text-body-secondary');
            return;
        }

        campos.endereco_fornecedor.value = resultado.endereco;
        enderecoDoCep = resultado.endereco;
        limparErro('endereco_fornecedor');
        mostrarStatusCep('Endereço preenchido. Complete com o número e o complemento.', 'text-success');
        campos.endereco_fornecedor.focus();
    }

    function limparErroCep() {
        inputCep.classList.remove('is-invalid');
        erroCep.textContent = '';
    }

    function mostrarStatusCep(mensagem, classe = '') {
        statusCep.className = ('form-text ' + classe).trim();
        statusCep.textContent = mensagem;
    }

    // TODO(E2): confirmar o status que a API devolve para CNPJ já cadastrado (aqui, 409).
    function traduzirErro(erro) {
        return erro.message === 'HTTP 409'
            ? 'Já existe um fornecedor cadastrado com este CNPJ.'
            : erro.message;
    }

    function mostrarErros(erros) {
        Object.keys(campos).forEach((nome) => {
            if (erros[nome]) {
                campos[nome].classList.add('is-invalid');
                feedbacks[nome].textContent = erros[nome];
            } else {
                limparErro(nome);
            }
        });
        const primeiro = Object.keys(campos).find((nome) => erros[nome]);
        if (primeiro) campos[primeiro].focus();
    }

    function limparErro(nome) {
        campos[nome].classList.remove('is-invalid');
        feedbacks[nome].textContent = '';
    }

    function mostrarAviso(tipo, mensagem) {
        aviso.className = 'alert alert-' + tipo;
        aviso.textContent = mensagem;
    }

    function esconderAviso() {
        aviso.className = 'd-none';
        aviso.textContent = '';
    }
}
