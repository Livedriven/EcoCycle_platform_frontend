import API from '../../shared/api.js';
import { montarLayout } from '../../shared/layout.js';
import { HOME_URL, requireLogin, decodeToken } from '../../shared/session.js';
import { formatIsoLocal, formatKg } from '../../shared/formatters.js';
import { validarProducao } from '../../shared/validators.js';

// Administrador, gerente e operador usam a mesma ação da matriz PERMISSOES.
const ACAO = 'producao.operar';
const SESSAO = montarLayout({ acao: ACAO });

// TODO(E2/E5): confirmar com a API o status que significa "Disponível" para o lote.
const STATUS_LOTE_DISPONIVEL = 'Recebido';
// Ao iniciar, o lote sai da lista de disponíveis (cada lote tem uma única produção).
const STATUS_LOTE_EM_PROCESSAMENTO = 'Em processamento';
// O backend registra LIGADA; fixtures antigos usam Ativa.
const STATUS_ESTEIRA_ATIVA = ['ATIVA', 'LIGADA'];
// Opções oferecidas pelo portal; o payload envia o campo turno.
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
    let lotesDisponiveis = [];

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
        lotesDisponiveis = lotes.filter((lote) => lote.status === STATUS_LOTE_DISPONIVEL);
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
            .filter((esteira) => STATUS_ESTEIRA_ATIVA.includes(String(esteira.status_esteira).trim().toUpperCase()))
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

        const lote = lotesDisponiveis.find((item) => String(item.id) === dados.id_lote);
        const idUsuario = Number(decodeToken(SESSAO.token)?.sub);
        if (!lote || !Number.isInteger(idUsuario) || idUsuario <= 0) {
            mostrarAviso('danger', 'Não foi possível identificar o lote ou o usuário da sessão. Entre novamente.');
            return;
        }
        // O ciclo começa sem saída nem rejeito; a entrada é o peso recebido do lote.
        const payload = {
            id_lote: Number(dados.id_lote),
            id_usuario: idUsuario,
            id_esteira: Number(dados.id_esteira),
            turno: dados.turno_producao,
            status_producao: 'Em processamento',
            quantidade_entrada_kg: Number(lote.pesoentrada_kg),
            quantidade_saida_kg: 0,
            rejeito_kg: 0,
            data_inicio: formatIsoLocal(),
            itens: []
        };

        enviando = true;
        btnIniciar.disabled = true;
        btnIniciar.textContent = 'Iniciando...';
        try {
            await API.POST('/producao', payload);
            if (!validarAcesso()) return;
            try {
                await API.PATCH(`/lotes/${payload.id_lote}`, { status_lote: STATUS_LOTE_EM_PROCESSAMENTO });
                mostrarAviso('success', 'Produção cadastrada com sucesso.');
            } catch (erro) {
                // A produção já existe: avisa sem desfazê-la.
                mostrarAviso('warning', 'Produção cadastrada, mas o status do lote não foi atualizado: ' + erro.message);
            }
            form.reset();
            campos.id_lote.querySelector('option[value="' + payload.id_lote + '"]')?.remove();
        } catch (erro) {
            mostrarAviso('danger', erro.message);
        } finally {
            enviando = false;
            btnIniciar.disabled = false;
            btnIniciar.textContent = 'Cadastrar produção';
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
