import { sincronizacao } from './api.js';

// Os resultados ficam no IndexedDB até a pessoa dispensá-los explicitamente.
export function montarAvisosSincronizacao() {
    const conteudo = document.querySelector('.conteudo-pagina');
    if (!conteudo || document.getElementById('avisos-sincronizacao')) return;
    const painel = document.createElement('aside');
    painel.id = 'avisos-sincronizacao';
    painel.setAttribute('aria-label', 'Conexão e confirmação de envios');
    painel.setAttribute('aria-live', 'polite');
    painel.className = 'mb-3';
    painel.hidden = true;
    conteudo.prepend(painel);
    let assinatura;

    function alerta(tipo, mensagem) {
        const caixa = document.createElement('div');
        caixa.className = `alert alert-${tipo} mb-2`;
        const texto = document.createElement('span');
        texto.textContent = mensagem;
        caixa.append(texto);
        return caixa;
    }

    sincronizacao.assinar((estado) => {
        const novaAssinatura = JSON.stringify(estado);
        if (assinatura === novaAssinatura) return;
        assinatura = novaAssinatura;
        const avisos = [];
        if (estado.erroArmazenamento) avisos.push(alerta('danger', estado.erroArmazenamento));
        if (estado.offline) avisos.push(alerta('warning', 'Sem conexão. Novos cadastros e atualizações estão bloqueados. A fila retoma os envios que ainda não foram tentados quando a conexão voltar.'));
        if (estado.pendentes.length) {
            const nomes = estado.pendentes.map((r) => r.descricao).join('; ');
            avisos.push(alerta('info', `Envios em andamento ou aguardando conexão: ${nomes}. A fila funciona com a página aberta e uma sessão ativa do mesmo usuário.`));
        }
        if (estado.cache.length) {
            const data = new Date(Math.min(...estado.cache.map((r) => r.data))).toLocaleString('pt-BR');
            avisos.push(alerta('warning', `Exibindo dados salvos neste navegador. Cópia mais antiga: ${data}. Os dados podem estar desatualizados.`));
        }
        for (const resultado of estado.resultados) {
            const caixa = alerta(resultado.tipo, resultado.mensagem);
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'btn btn-sm btn-outline-secondary ms-3';
            botao.textContent = 'Entendi';
            botao.setAttribute('aria-label', 'Dispensar aviso: ' + resultado.mensagem);
            botao.addEventListener('click', async () => {
                botao.disabled = true;
                try { await sincronizacao.dispensar(resultado.id); }
                catch { botao.disabled = false; }
            });
            caixa.append(botao);
            avisos.push(caixa);
        }
        painel.replaceChildren(...avisos);
        painel.hidden = avisos.length === 0;
    });
    sincronizacao.iniciar();
}
