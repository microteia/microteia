import type { DeletionActor } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';
import type { IRecordRepository } from '../../repositories/IRecordRepository';
import { ownerSet } from '../plugins/screenModule';

export type DeleteScreenDefinitionUseCase = {
  execute: (tenantId: string, screenKey: string, actor: DeletionActor) => Promise<void>;
};

/**
 * Só uma tela `design` sem dono é excluível: `builtin` vem do kernel, `plugin` vem da extensão, e uma
 * tela do tenant ADOTADA por uma extensão instalada é declarada por ela — excluí-la a quebraria.
 */
export const makeDeleteScreenDefinitionUseCase = (
  repo: IScreenDefinitionRepository,
  recordRepo: IRecordRepository,
): DeleteScreenDefinitionUseCase => ({
  execute: async (tenantId, screenKey, actor) => {
    const screens = await repo.getAll(tenantId);
    const screen = screens.find((s) => s.id === screenKey);
    if (screen?.origin === 'builtin') {
      throw new Error('Esta tela faz parte do sistema e não pode ser excluída.');
    }
    if (screen?.origin === 'plugin' || (screen && ownerSet(screen).length > 0)) {
      throw new Error('Esta tela pertence a uma extensão. Remova a extensão para excluí-la.');
    }
    const hasRecords = await recordRepo.hasRecords(tenantId, screenKey);
    if (hasRecords) {
      throw new Error('Esta tela possui registros e não pode ser excluída. Desative-a ou exclua os registros antes.');
    }
    await repo.delete(tenantId, screenKey, actor);
  },
});
