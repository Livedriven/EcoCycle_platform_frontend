import API from '../../shared/api.js';
import { montarLayout } from '../../shared/layout.js';
import { can, HOME_URL } from '../../shared/session.js';
import { formatKg } from '../../shared/formatters.js';
import { limitesDataEntrada, validarLote } from '../../shared/validators.js';

// Administrador, gerente e operador registram lote (matriz PERMISSOES). Consulta vai para a página 403.
const SESSAO = montarLayout({ acao: 'lote.registrar' });

const CADASTRO_FORNECEDOR_URL = '/src/features/suppliers/new-supplier.html';

if (SESSAO) {
    iniciarTela();
}

function iniciarTela() {
    const bloco = document.getElementById('bloco-cadastrar-lote');
    const estado = bloco.querySelector('.estado');
    const conteudo = bloco.querySelector('.conteudo');
    const form = document.getElementById('form-lote');
    const aviso = document.getElementById('aviso-envio');
    const btnSalvar = document.getElementById('btn-salvar');
    const ajudaFornecedor = document.getElementById('ajuda-fornecedor');
    // As chaves são as mesmas do payload e das chaves de erro de validarLote.
    const campos = {
        id_fornecedor: document.getElementById('fornecedor'),
        pesoentrada_kg: document.getElementById('peso'),
        data_entrada: document.getElementById('data')
    };
    const feedbacks = {
        id_fornecedor: document.getElementById('erro-fornecedor'),
        pesoentrada_kg: document.getElementById('erro-peso'),
        data_entrada: document.getElementById('erro-data')
    };

    form.addEventListener('submit', enviar);
    document.getElementById('btn-cancelar').addEventListener('click', () => {
        location.href = HOME_URL;
    });
    Object.entries(campos).forEach(([nome, campo]) => {
        campo.addEventListener('input', () => limparErro(nome));
    });

    carregarFornecedores();

    async function carregarFornecedores() {
        conteudo.classList.add('d-none');
        estado.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando fornecedores...</span></div></div>';
        try {
            const fornecedores = await API.GET('/fornecedores');
            preencherFornecedores(Array.isArray(fornecedores) ? fornecedores : []);
            definirLimitesDaData();
            estado.replaceChildren();
            conteudo.classList.remove('d-none');
        } catch (erro) {
            mostrarErroDeCarga(erro.message);
        }
    }

    function preencherFornecedores(fornecedores) {
        campos.id_fornecedor.length = 1;
        [...fornecedores]
            .sort((a, b) => String(a.nome_fornecedor).localeCompare(String(b.nome_fornecedor), 'pt-BR'))
            .forEach((f) => campos.id_fornecedor.add(new Option(f.nome_fornecedor, f.id)));

        if (fornecedores.length > 0) return;

        // Sem fornecedor não há lote possível: bloqueia o formulário e indica o caminho.
        campos.id_fornecedor.disabled = true;
        campos.id_fornecedor.options[0].textContent = 'Nenhum fornecedor cadastrado';
        btnSalvar.disabled = true;
        if (can('fornecedor.cadastrar')) {
            const link = document.createElement('a');
            link.href = CADASTRO_FORNECEDOR_URL;
            link.textContent = 'Cadastrar fornecedor';
            ajudaFornecedor.append('Cadastre um fornecedor antes de registrar o lote. ', link);
        } else {
            ajudaFornecedor.textContent = 'Peça a um administrador ou gerente para cadastrar o fornecedor.';
        }
    }

    // O calendário só oferece de ontem até hoje; a validação repete a regra, pois dá para digitar por cima.
    function definirLimitesDaData() {
        const { min, max } = limitesDataEntrada();
        campos.data_entrada.min = min;
        campos.data_entrada.max = max;
    }

    async function enviar(evento) {
        evento.preventDefault();
        esconderAviso();

        // Valores crus; a conversão para o payload acontece depois da validação.
        const dados = {};
        Object.entries(campos).forEach(([nome, campo]) => {
            dados[nome] = campo.value;
        });
        const validacao = validarLote(dados);
        mostrarErros(validacao.erros);
        if (!validacao.valido) return;

        // A data vem do calendário (só o dia) e a hora é a do cadastro, no formato do mock.
        // Sem id_usuario (a API pega do token) e sem status (a API define o status inicial do lote).
        // TODO(E2): confirmar o nome do campo do fornecedor (id_fornecedor) e se a API quer só a data.
        const payload = {
            id_fornecedor: Number(dados.id_fornecedor),
            pesoentrada_kg: Number(dados.pesoentrada_kg),
            data_entrada: dados.data_entrada + 'T' + horaAtual()
        };
        const nomeFornecedor = campos.id_fornecedor.selectedOptions[0].textContent;

        btnSalvar.disabled = true;
        btnSalvar.textContent = 'Salvando...';
        try {
            const criado = await API.POST('/lotes', payload);
            const codigo = criado && criado.id ? 'Lote ' + criado.id : 'Lote';
            mostrarAviso('success', codigo + ' cadastrado com sucesso: ' + nomeFornecedor + ', ' + formatKg(payload.pesoentrada_kg) + '.');
            form.reset();
            campos.id_fornecedor.focus();
        } catch (erro) {
            // TODO(E2): combinar a mensagem para data ou peso recusados (hoje o api.js mostra só "HTTP 400").
            mostrarAviso('danger', erro.message);
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar lote';
        }
    }

    function horaAtual() {
        const agora = new Date();
        const dois = (n) => String(n).padStart(2, '0');
        return dois(agora.getHours()) + ':' + dois(agora.getMinutes()) + ':' + dois(agora.getSeconds());
    }

    function mostrarErroDeCarga(mensagem) {
        const caixa = document.createElement('div');
        caixa.className = 'text-center py-4';
        const texto = document.createElement('p');
        texto.className = 'text-danger mb-3';
        texto.textContent = mensagem;
        const tentar = document.createElement('button');
        tentar.type = 'button';
        tentar.className = 'btn btn-outline-primary';
        tentar.textContent = 'Tentar novamente';
        tentar.addEventListener('click', carregarFornecedores);
        caixa.append(texto, tentar);
        estado.replaceChildren(caixa);
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
