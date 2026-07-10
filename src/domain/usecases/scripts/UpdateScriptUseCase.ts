import type { Script } from '../../entities/Script';
import type { IScriptRepository } from '../../repositories/IScriptRepository';

export type UpdateScriptUseCase = {
  execute: (
    tenantId: string,
    id: string,
    data: Partial<Omit<Script, 'id' | 'tenantId' | 'createdAt'>>,
  ) => Promise<void>;
};

export const makeUpdateScriptUseCase = (repo: IScriptRepository): UpdateScriptUseCase => ({
  execute: (tenantId, id, data) => repo.updateScript(tenantId, id, data),
});
