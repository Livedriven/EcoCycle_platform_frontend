import { Modal } from 'bootstrap';
import { formatDateTime, formatKg } from '../../shared/formatters.js';

function adicionarCampo(lista, rotulo, valor) {
    const grupo = document.createElement('div');
    grupo.className = 'col-sm-6';

    const termo = document.createElement('dt');
    termo.className = 'fw-semibold mb-1';
    termo.textContent = rotulo;

    const descricao = document.createElement('dd');
    descricao.className = 'mb-0 text-body-secondary';
    descricao.textContent = valor ?? 'Não informado';

    grupo.append(termo, descricao);
    lista.append(grupo);
}

/**
 * Cria o controlador do modal de detalhes. Recebe uma produção já enriquecida
 * pela página, portanto abrir os dados não faz navegação nem recarrega a tela.
 */
export function criarDetalhesProducao() {
    const modalElemento = document.getElementById('modal-detalhe-producao');
    const destino = document.getElementById('detalhe-producao');

    if (!modalElemento || !destino) {
        throw new Error('O modal de detalhes da produção não foi encontrado.');
    }

    const modal = Modal.getOrCreateInstance(modalElemento);

    return {
        abrir(producao) {
            const campos = document.createElement('dl');
            campos.className = 'row g-3 mb-0';

            adicionarCampo(campos, 'ID da produção', producao.id);
            adicionarCampo(campos, 'Data e hora', formatDateTime(producao.data_hora));
            adicionarCampo(campos, 'Lote', producao.id_lote);
            adicionarCampo(campos, 'Status do lote', producao.status);
            adicionarCampo(campos, 'Esteira', producao.nome_esteira || 'Não informada');
            adicionarCampo(campos, 'Turno', producao.turno);
            adicionarCampo(campos, 'Material', producao.tipo_material);
            adicionarCampo(campos, 'Peso produzido', formatKg(producao.peso_kg));

            destino.replaceChildren(campos);
            modal.show();
        }
    };
}
