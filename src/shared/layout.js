// shared/layout.js
// Menu lateral de todas as telas protegidas, escrito pelo JS a partir de MENU.
// Para usar numa tela: o HTML tem <nav id="app-menu" class="menu">, e o JS da
// tela importa este arquivo no lugar do setup.js e chama montarLayout().
import './setup.js';
import { getUser } from './session.js';

const PAGINAS = '/src/features';

/**
 * Itens do menu. Para incluir uma tela, basta acrescentar um item aqui.
 *  - rotulo: texto do item
 *  - icone: só no primeiro nível (nome do Bootstrap Icons sem o "bi-")
 *  - href: caminho da tela; null = tela ainda não pronta (aparece desativada)
 *  - filhos: submenu que abre e fecha (collapse do Bootstrap)
 *  - perfis: se informado, só esses perfis veem o item (mesmas regras do rbac.cjs)
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
                    { rotulo: 'Cadastrar fornecedor', href: null, perfis: ['administrador'] }
                ]
            },
            {
                rotulo: 'Lotes', filhos: [
                    { rotulo: 'Consultar lotes', href: `${PAGINAS}/batches/batches.html` },
                    { rotulo: 'Cadastrar lote', href: null, perfis: ['administrador'] }
                ]
            },
            { rotulo: 'Iniciar produção', href: null, perfis: ['administrador'] }
        ]
    },
    { rotulo: 'Usuários', icone: 'people-fill', href: `${PAGINAS}/users/users.html`, perfis: ['administrador', 'gerente'] }
];

let contadorGrupos = 0;

function ehPaginaAtual(item) {
    return item.filhos ? item.filhos.some(ehPaginaAtual) : item.href === location.pathname;
}

/** Grupo só aparece se o perfil puder ver ao menos um filho. */
function podeVer(item, perfil) {
    if (item.perfis && !item.perfis.includes(perfil)) {
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

/** Escreve o menu lateral em #app-menu, de acordo com o perfil do usuário logado. */
export function montarLayout() {
    const menu = document.getElementById('app-menu');
    if (!menu) {
        return;
    }
    contadorGrupos = 0;
    menu.replaceChildren(...criarItens(MENU, 0, getUser()?.perfil));
}
