import type { ScreenDefinition } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type GetScreenDefinitionsUseCase = {
  execute: (tenantId: string) => Promise<ScreenDefinition[]>;
};

export const makeGetScreenDefinitionsUseCase = (repo: IScreenDefinitionRepository): GetScreenDefinitionsUseCase => ({
  execute: (tenantId) => repo.getAll(tenantId),
});
