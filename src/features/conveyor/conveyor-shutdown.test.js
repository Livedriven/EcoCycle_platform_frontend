import { beforeEach, describe, expect, it, vi } from 'vitest';
import API from '../../shared/api.js';
import { can } from '../../shared/session.js';
import { desligarEsteira, estaDesligada, podeDesligar, STATUS_DESLIGADA } from './conveyor-shutdown.js';

vi.mock('../../shared/api.js', () => ({ default: { PATCH: vi.fn() } }));
vi.mock('../../shared/session.js', () => ({ can: vi.fn() }));

beforeEach(() => {
    vi.resetAllMocks();
    can.mockImplementation((acao, perfil) => acao === 'esteira.operar' && ['administrador', 'gerente', 'tecnico'].includes(perfil));
});

describe('desligamento manual da esteira', () => {
    it.each(['DESLIGADA', 'ESTEIRA DESLIGADA', ' desligada ', 'Parada'])('reconhece %s como desligada', (status) => {
        expect(estaDesligada(status)).toBe(true);
    });
    it.each(['LIGADA', 'Ativa', 'MANUTENCAO', '', null])('não trata %s como desligada', (status) => {
        expect(estaDesligada(status)).toBe(false);
    });
    it('oferece o botão só a quem opera esteiras e só com a esteira ligada', () => {
        const ligada = { id: 1, status_esteira: 'LIGADA' };
        expect(podeDesligar(ligada, 'tecnico')).toBe(true);
        expect(podeDesligar(ligada, 'gerente')).toBe(true);
        expect(podeDesligar(ligada, 'operador')).toBe(false);
        expect(podeDesligar(ligada, 'consulta')).toBe(false);
        expect(podeDesligar({ ...ligada, status_esteira: 'ESTEIRA DESLIGADA' }, 'administrador')).toBe(false);
        expect(podeDesligar(null, 'administrador')).toBe(false);
    });
    it('envia PATCH com o status DESLIGADA depois da confirmação', async () => {
        API.PATCH.mockResolvedValue({ id: 3, status_esteira: STATUS_DESLIGADA });
        const confirmar = vi.fn(() => true);
        await expect(desligarEsteira({ id: 3, nome_esteira: 'Esteira 3' }, confirmar))
            .resolves.toMatchObject({ status_esteira: 'DESLIGADA' });
        expect(confirmar.mock.calls[0][0]).toContain('Esteira 3');
        expect(API.PATCH).toHaveBeenCalledExactlyOnceWith('/esteiras/3', { status_esteira: 'DESLIGADA' }, { erroLocal: true });
    });
    it('não chama a API quando a pessoa cancela', async () => {
        await expect(desligarEsteira({ id: 3 }, () => false)).resolves.toBeNull();
        expect(API.PATCH).not.toHaveBeenCalled();
    });
    it('repassa a falha da API para a tela', async () => {
        API.PATCH.mockRejectedValue(new Error('HTTP 404'));
        await expect(desligarEsteira({ id: 9 }, () => true)).rejects.toThrow('HTTP 404');
    });
});
