import type { Script } from '../../entities/Script';
import type { IScriptRepository } from '../../repositories/IScriptRepository';

export type CreateScriptUseCase = {
  execute: (
    tenantId: string,
    data: Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) => Promise<Script>;
};

export const makeCreateScriptUseCase = (repo: IScriptRepository): CreateScriptUseCase => ({
  execute: (tenantId, data, id) => repo.createScript(tenantId, data, id),
});
