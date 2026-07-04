import type { ScreenFieldOption } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type GetScreenFieldOptionsUseCase = {
  execute: (tenantId: string, screenKey: string) => Promise<ScreenFieldOption[]>;
};

export const makeGetScreenFieldOptionsUseCase = (repo: IScreenDefinitionRepository): GetScreenFieldOptionsUseCase => ({
  execute: (tenantId, screenKey) => repo.getFieldOptions(tenantId, screenKey),
});
