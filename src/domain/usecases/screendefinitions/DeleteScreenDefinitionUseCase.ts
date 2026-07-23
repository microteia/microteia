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
    const screens = await repo.getAll(tenantId);
    const screen = screens.find((s) => s.id === screenKey);
    if (screen?.ownerPluginId) {
      throw new Error('Esta tela pertence a uma extensão. Remova a extensão para excluí-la.');
    }
    const hasRecords = await recordRepo.hasRecords(tenantId, screenKey);
    if (hasRecords) {
      throw new Error('Esta tela possui registros e não pode ser excluída. Desative-a ou exclua os registros antes.');
    }
    await repo.delete(tenantId, screenKey, actor);
  },
});
