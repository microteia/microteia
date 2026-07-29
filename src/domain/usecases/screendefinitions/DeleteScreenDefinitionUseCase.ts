import type { DeletionActor } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';
import type { IRecordRepository } from '../../repositories/IRecordRepository';

export type DeleteScreenDefinitionUseCase = {
  execute: (tenantId: string, screenKey: string, actor: DeletionActor) => Promise<void>;
};

/** Só uma tela `design` é excluível: `builtin` vem do kernel e `plugin`, da extensão. */
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
    if (screen?.origin === 'plugin') {
      throw new Error('Esta tela pertence a uma extensão. Remova a extensão para excluí-la.');
    }
    const hasRecords = await recordRepo.hasRecords(tenantId, screenKey);
    if (hasRecords) {
      throw new Error('Esta tela possui registros e não pode ser excluída. Desative-a ou exclua os registros antes.');
    }
    await repo.delete(tenantId, screenKey, actor);
  },
});
