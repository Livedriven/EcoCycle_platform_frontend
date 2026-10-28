import API from '../../shared/api.js';
import { montarLayout } from '../../shared/layout.js';
import { HOME_URL, requireLogin } from '../../shared/session.js';
import { formatKg } from '../../shared/formatters.js';
import { validarProducao } from '../../shared/validators.js';

// Administrador, gerente e operador usam a mesma ação da matriz PERMISSOES.
const ACAO = 'producao.operar';
const SESSAO = montarLayout({ acao: ACAO });

// TODO(E2/E5): confirmar com a API o status que significa "Disponível" para o lote.
const STATUS_LOTE_DISPONIVEL = 'Recebido';
// TODO(E2/E5): confirmar quais esteiras podem receber produção (status_esteira ativo).
const STATUS_ESTEIRA_ATIVA = 'Ativa';
// TODO(E5): confirmar a lista de valores de turno_producao aceitos pela API.
const TURNOS = ['Manhã', 'Tarde', 'Noite'];

if (SESSAO) {
    iniciarTela();
}

function iniciarTela() {
    const bloco = document.getElementById('bloco-iniciar-producao');
    const estado = bloco.querySelector('.estado');
    const conteudo = bloco.querySelector('.conteudo');
    const form = document.getElementById('form-iniciar-producao');
    const aviso = document.getElementById('aviso-envio');
    const btnIniciar = document.getElementById('btn-iniciar');
    let enviando = false;

    function validarAcesso() {
        if (requireLogin(ACAO)) return true;
        bloco.hidden = true;
        return false;
    }

    bloco.hidden = false;
    const campos = {
        id_lote: document.getElementById('lote'),
        id_esteira: document.getElementById('esteira'),
        turno_producao: document.getElementById('turno')
    };
    const feedbacks = {
        id_lote: document.getElementById('erro-lote'),
        id_esteira: document.getElementById('erro-esteira'),
        turno_producao: document.getElementById('erro-turno')
    };

    TURNOS.forEach((turno) => campos.turno_producao.add(new Option(turno, turno)));

    carregarOpcoes();

    form.addEventListener('submit', enviar);
    document.getElementById('btn-cancelar').addEventListener('click', () => {
        location.href = HOME_URL;
    });
    Object.values(campos).forEach((campo) => {
        campo.addEventListener('change', () => limparErro(campo.name));
    });

    async function carregarOpcoes() {
        estado.textContent = 'Carregando lotes e esteiras...';
        try {
            const [lotes, fornecedores, esteiras] = await Promise.all([
                API.GET('/lotes'),
                API.GET('/fornecedores'),
                API.GET('/esteiras')
            ]);
            if (!validarAcesso()) return;
            preencherLotes(lotes, fornecedores);
            preencherEsteiras(esteiras);
            estado.textContent = '';
            conteudo.classList.remove('d-none');
        } catch (erro) {
            estado.replaceChildren();
            const alerta = document.createElement('div');
            alerta.className = 'alert alert-danger mb-0';
            alerta.textContent = erro.message;
            estado.appendChild(alerta);
        }
    }

    function preencherLotes(lotes, fornecedores) {
        const nomes = new Map(fornecedores.map((f) => [f.id, f.nome_fornecedor]));
        lotes
            .filter((lote) => lote.status === STATUS_LOTE_DISPONIVEL)
            .forEach((lote) => {
                const fornecedor = nomes.get(lote.id_fornecedor) || 'Fornecedor não identificado';
                const texto = 'Lote ' + lote.id + ' · ' + fornecedor + ' · ' + formatKg(lote.pesoentrada_kg);
                campos.id_lote.add(new Option(texto, lote.id));
            });
        if (campos.id_lote.options.length === 1) {
            campos.id_lote.options[0].textContent = 'Nenhum lote disponível';
            campos.id_lote.disabled = true;
        }
    }

    function preencherEsteiras(esteiras) {
        esteiras
            .filter((esteira) => esteira.status_esteira === STATUS_ESTEIRA_ATIVA)
            .forEach((esteira) => campos.id_esteira.add(new Option(esteira.nome_esteira, esteira.id)));
        if (campos.id_esteira.options.length === 1) {
            campos.id_esteira.options[0].textContent = 'Nenhuma esteira disponível';
            campos.id_esteira.disabled = true;
        }
    }

    async function enviar(evento) {
        evento.preventDefault();
        if (!validarAcesso() || enviando) return;
        esconderAviso();

        // Valores crus; a normalização para o payload acontece depois da validação.
        const dados = {
            id_lote: campos.id_lote.value,
            id_esteira: campos.id_esteira.value,
            turno_producao: campos.turno_producao.value
        };
        const validacao = validarProducao(dados, { turnos: TURNOS });
        mostrarErros(validacao.erros);
        if (!validacao.valido) return;

        // Sem id_usuario: a API identifica o usuário pelo token e autoriza
        // administrador, gerente e operador pela ação producao.operar.
        const payload = {
            id_lote: Number(dados.id_lote),
            id_esteira: Number(dados.id_esteira),
            turno_producao: dados.turno_producao,
            data_hora: agoraIso()
        };

        enviando = true;
        btnIniciar.disabled = true;
        btnIniciar.textContent = 'Iniciando...';
        try {
            await API.POST('/producao', payload);
            if (!validarAcesso()) return;
            mostrarAviso('success', 'Produção iniciada com sucesso.');
            form.reset();
            campos.id_lote.querySelector('option[value="' + payload.id_lote + '"]')?.remove();
        } catch (erro) {
            mostrarAviso('danger', erro.message);
        } finally {
            enviando = false;
            btnIniciar.disabled = false;
            btnIniciar.textContent = 'Iniciar produção';
        }
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

// Formato ISO local: 2026-08-03T07:15:00 (sem fuso e sem milissegundos).
function agoraIso() {
    const d = new Date();
    const dois = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate())
        + 'T' + dois(d.getHours()) + ':' + dois(d.getMinutes()) + ':' + dois(d.getSeconds());
}
