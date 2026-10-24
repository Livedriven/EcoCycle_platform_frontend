// shared/layout.js
// Topo (nome do usuário + "Sair"), menu lateral e rodapé de todas as telas protegidas.
// Para usar numa tela (todas, exceto login e páginas de erro): o HTML tem
// <div id="app-topo"></div> e <nav id="app-menu" class="menu">, e o JS da tela
// importa este arquivo no lugar do setup.js e chama montarLayout().
import './setup.js';
import API from './api.js';
import { requireLogin, logout, can, HOME_URL } from './session.js';
import { aplicarPermissoes } from './permissions.js';

const PAGINAS = '/src/features';

/**
 * Itens do menu. Para incluir uma tela, basta acrescentar um item aqui.
 *  - rotulo: texto do item
 *  - icone: só no primeiro nível (nome do Bootstrap Icons sem o "bi-")
 *  - href: caminho da tela; null = tela ainda não pronta (aparece desativada)
 *  - filhos: submenu que abre e fecha (collapse do Bootstrap)
 *  - acao: se informada (chave de PERMISSOES, em session.js), só quem pode executá-la vê o item
 */
export const MENU = [
    { rotulo: 'Dashboard', icone: 'grid-1x2-fill', href: `${PAGINAS}/dashboard/dashboard.html` },
    {
        rotulo: 'Produções', icone: 'buildings', filhos: [
            { rotulo: 'Produção do dia', href: `${PAGINAS}/production/production.html` },
            { rotulo: 'Materiais produzidos', href: `${PAGINAS}/materials/materials.html` }
        ]
    },
    { rotulo: 'Alertas', icone: 'bell-fill', href: `${PAGINAS}/alerts/alerts.html` },
    {
        rotulo: 'Equipamentos', icone: 'wrench-adjustable', filhos: [
            { rotulo: 'Status das esteiras', href: `${PAGINAS}/conveyor/conveyor.html` }
        ]
    },
    {
        rotulo: 'Operações', icone: 'layers', filhos: [
            {
                rotulo: 'Fornecedores', filhos: [
                    { rotulo: 'Consultar fornecedores', href: null },
                    { rotulo: 'Cadastrar fornecedor', href: null, acao: 'fornecedor.cadastrar' }
                ]
            },
            {
                rotulo: 'Lotes', filhos: [
                    { rotulo: 'Consultar lotes', href: `${PAGINAS}/batches/batches.html` },
                    { rotulo: 'Cadastrar lote', href: null, acao: 'lote.registrar' }
                ]
            },
            { rotulo: 'Iniciar produção', href: '/src/features/start-production/start-production.html', acao: 'producao.operar' }
        ]
    },
    // gerenciar usuários está fora do MVP: com a lista vazia em PERMISSOES, o item não aparece para ninguém
    { rotulo: 'Usuários', icone: 'people-fill', href: `${PAGINAS}/users/users.html`, acao: 'usuarios.gerenciar' }
];

let contadorGrupos = 0;

// Igual ao @media (max-width: 767.98px) do style.css e ao "md" do Bootstrap.
const TELA_GRANDE = window.matchMedia('(min-width: 768px)');
let ouvintesDoMenu = false;

function ehPaginaAtual(item) {
    return item.filhos ? item.filhos.some(ehPaginaAtual) : item.href === location.pathname;
}

/** Grupo só aparece se o perfil puder ver ao menos um filho. */
function podeVer(item, perfil) {
    if (item.acao && !can(item.acao, perfil)) {
        return false;
    }
    return item.filhos ? item.filhos.some((filho) => podeVer(filho, perfil)) : true;
}

function icone(nome, classeExtra = '') {
    const i = document.createElement('i');
    i.className = ('bi bi-' + nome + ' ' + classeExtra).trim();
    i.setAttribute('aria-hidden', 'true');
    return i;
}

function preencherRotulo(elemento, item) {
    if (item.icone) {
        elemento.append(icone(item.icone));
    }
    elemento.append(item.rotulo);
}

function criarLink(item, nivel) {
    const pronto = Boolean(item.href);
    const el = document.createElement(pronto ? 'a' : 'span');
    el.className = 'menu-link nivel-' + nivel;

    if (pronto) {
        el.href = item.href;
        if (ehPaginaAtual(item)) {
            el.classList.add('ativo');
            el.setAttribute('aria-current', 'page');
        }
    } else {
        el.classList.add('desativado');
        el.title = 'Em breve';
        el.setAttribute('aria-disabled', 'true');
    }

    preencherRotulo(el, item);
    return el;
}

/** Botão que abre/fecha o submenu + a lista dos filhos. Abre sozinho se a página atual estiver dentro. */
function criarGrupo(item, nivel, perfil) {
    const id = 'menu-grupo-' + (++contadorGrupos);
    const aberto = ehPaginaAtual(item);

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'menu-link menu-grupo nivel-' + nivel + (aberto ? '' : ' collapsed');
    botao.dataset.bsToggle = 'collapse';
    botao.dataset.bsTarget = '#' + id;
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-controls', id);
    preencherRotulo(botao, item);
    botao.append(icone('caret-down-fill', 'seta ms-auto'));

    const submenu = document.createElement('div');
    submenu.id = id;
    submenu.className = 'collapse menu-sub' + (aberto ? ' show' : '');
    submenu.append(...criarItens(item.filhos, nivel + 1, perfil));

    return [botao, submenu];
}

function criarItens(itens, nivel, perfil) {
    return itens
        .filter((item) => podeVer(item, perfil))
        .flatMap((item) => (item.filhos ? criarGrupo(item, nivel, perfil) : [criarLink(item, nivel)]));
}

/** "administrador" -> "Administrador" */
function nomeDoPerfil(perfil) {
    return perfil.charAt(0).toUpperCase() + perfil.slice(1);
}

/**
 * Logout: avisa o mock/API para recusar o token daqui em diante e encerra a
 * sessão local. Se a API não responder, sai do mesmo jeito.
 */
async function sair(botao) {
    botao.disabled = true;
    botao.textContent = 'Saindo...';
    try {
        await API.POST('/logout');
    } catch {
        // sem API, o token ainda vale até o exp, mas some do navegador
    }
    logout();
}

/* ---------- Abrir e fechar o menu lateral ----------
 * Tela grande: o menu fica ao lado do conteúdo e recolhe para a esquerda
 *   (classe "menu-recolhido" no body). Começa aberto e lembra a escolha.
 * Celular: o menu desliza por cima do conteúdo (classe "menu-aberto" no body).
 *   Começa fechado a cada página.
 */

const CHAVE_RECOLHIDO = 'menu-recolhido';

// localStorage pode estar bloqueado (aba anônima, cookies desligados): aí só não lembra.
function lerRecolhido() {
    try {
        return localStorage.getItem(CHAVE_RECOLHIDO) === 'sim';
    } catch {
        return false;
    }
}

function gravarRecolhido(recolhido) {
    try {
        localStorage.setItem(CHAVE_RECOLHIDO, recolhido ? 'sim' : 'nao');
    } catch {
        // sem armazenamento, o menu volta aberto na próxima página
    }
}

function menuEstaAberto() {
    return TELA_GRANDE.matches
        ? !document.body.classList.contains('menu-recolhido')
        : document.body.classList.contains('menu-aberto');
}

/** Deixa o botão do topo (ícone e leitores de tela) de acordo com o estado do menu. */
function atualizarBotaoMenu() {
    const botao = document.querySelector('.btn-menu');
    if (!botao) {
        return;
    }
    const aberto = menuEstaAberto();
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    botao.querySelector('.bi').className = 'bi bi-' + (aberto ? 'layout-sidebar-inset' : 'layout-sidebar');
}

/**
 * Abre/fecha o menu no modo da tela atual. No celular, ao abrir, o foco vai para o
 * primeiro item. Ao fechar, se o foco estava dentro do menu, volta para o botão
 * (o menu fechado some e o foco se perderia).
 */
function definirMenu(aberto) {
    const menu = document.getElementById('app-menu');
    const focoNoMenu = menu?.contains(document.activeElement);

    if (TELA_GRANDE.matches) {
        document.body.classList.toggle('menu-recolhido', !aberto);
        gravarRecolhido(!aberto);
    } else {
        document.body.classList.toggle('menu-aberto', aberto);
        if (aberto) {
            menu?.querySelector('.menu-link')?.focus();
        }
    }
    atualizarBotaoMenu();

    if (!aberto && focoNoMenu) {
        document.querySelector('.btn-menu')?.focus();
    }
}

function criarBotaoMenu() {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn-menu';
    botao.setAttribute('aria-controls', 'app-menu');
    botao.append(icone('layout-sidebar'));
    botao.addEventListener('click', () => definirMenu(!menuEstaAberto()));
    return botao;
}

/** Fundo escuro atrás do menu aberto: clicar nele fecha o menu. */
function criarFundoDoMenu() {
    const fundo = document.createElement('div');
    fundo.className = 'menu-fundo';
    fundo.setAttribute('aria-hidden', 'true');
    fundo.addEventListener('click', () => definirMenu(false));
    return fundo;
}

/**
 * Esc fecha o menu do celular (o da tela grande não cobre nada, então fica).
 * Ao trocar de tamanho de tela, o menu do celular volta fechado e o botão
 * passa a mostrar o estado do outro modo.
 */
function ouvirMenu() {
    if (ouvintesDoMenu) {
        return;
    }
    ouvintesDoMenu = true;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !TELA_GRANDE.matches && menuEstaAberto()) {
            definirMenu(false);
        }
    });
    TELA_GRANDE.addEventListener('change', () => {
        document.body.classList.remove('menu-aberto');
        atualizarBotaoMenu();
    });
}

/* ---------- Topo e rodapé ---------- */

function criarTopo(sessao) {
    const topo = document.createElement('header');
    topo.className = 'topo';
    topo.classList.add('p-3');

    const esquerda = document.createElement('div');
    esquerda.className = 'topo-esquerda';
    const marca = document.createElement('a');
    marca.className = 'topo-marca';
    marca.href = HOME_URL;
    marca.textContent = 'EcoCycle';
    esquerda.append(criarBotaoMenu(), marca);

    const usuario = document.createElement('div');
    usuario.className = 'topo-usuario';
    const nome = document.createElement('span');
    nome.className = 'topo-nome';
    nome.textContent = sessao.nome;
    nome.title = sessao.nome;
    const perfil = document.createElement('span');
    perfil.className = 'topo-perfil';
    perfil.textContent = '· ' + nomeDoPerfil(sessao.perfil);

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn btn-outline-light btn-sm ms-2';
    botao.textContent = 'Sair';
    botao.addEventListener('click', () => sair(botao));

    usuario.append(nome, perfil, botao);
    topo.append(esquerda, usuario);
    return topo;
}

function criarRodape() {
    const rodape = document.createElement('footer');
    rodape.className = 'rodape';

    const marca = document.createElement('span');
    const nome = document.createElement('strong');
    nome.className = 'rodape-marca';
    nome.textContent = 'EcoCycle';
    marca.append(nome, ' © ' + new Date().getFullYear());

    const descricao = document.createElement('span');
    descricao.textContent = 'Gestão de reciclagem de plástico e metal';

    const linha = document.createElement('div');
    linha.className = 'rodape-linha';
    linha.append(marca, descricao);
    rodape.append(linha);
    return rodape;
}

function criarMenu(perfil) {
    contadorGrupos = 0;
    return criarItens(MENU, 0, perfil);
}

/**
 * Prepara uma tela protegida: confere a sessão (sem sessão válida, vai ao login)
 * e escreve o topo em #app-topo, o menu lateral em #app-menu e o rodapé no fim
 * de .conteudo-pagina (o HTML não precisa de nada para o rodapé). O botão à
 * esquerda do topo abre e fecha o menu em qualquer tamanho de tela.
 * Com { acao } (chave de PERMISSOES), a tela é só de quem pode executá-la: os
 * outros perfis vão para a página 403.
 * Devolve a sessão { token, nome, perfil, exp }, ou null se redirecionou.
 */
export function montarLayout({ acao } = {}) {
    const sessao = requireLogin(acao);
    if (!sessao) {
        return null;
    }
    document.getElementById('app-topo')?.replaceChildren(criarTopo(sessao));
    document.getElementById('app-menu')?.replaceChildren(...criarMenu(sessao.perfil));
    document.querySelector('.menu-fundo')?.remove();
    document.body.append(criarFundoDoMenu());
    document.body.classList.remove('menu-aberto');
    document.body.classList.toggle('menu-recolhido', lerRecolhido());
    atualizarBotaoMenu();
    ouvirMenu();
    const conteudo = document.querySelector('.conteudo-pagina');
    conteudo?.querySelector(':scope > .rodape')?.remove();
    conteudo?.append(criarRodape());
    aplicarPermissoes();
    return sessao;
}
