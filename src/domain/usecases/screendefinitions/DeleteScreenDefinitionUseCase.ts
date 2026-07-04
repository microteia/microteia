import type { DeletionActor } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';

export type DeleteScreenDefinitionUseCase = {
  execute: (tenantId: string, screenKey: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteScreenDefinitionUseCase = (
  repo: IScreenDefinitionRepository,
  recordRepo: ICustomRecordRepository,
): DeleteScreenDefinitionUseCase => ({
  execute: async (tenantId, screenKey, actor) => {
    const hasRecords = await recordRepo.hasRecords(tenantId, screenKey);
    if (hasRecords) {
      throw new Error('Esta tela possui registros e não pode ser excluída. Desative-a ou exclua os registros antes.');
    }
    await repo.delete(tenantId, screenKey, actor);
  },
});
