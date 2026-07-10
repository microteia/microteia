import type { IScriptRepository } from '../../repositories/IScriptRepository';

export type DeleteScriptUseCase = {
  execute: (tenantId: string, id: string) => Promise<void>;
};

export const makeDeleteScriptUseCase = (repo: IScriptRepository): DeleteScriptUseCase => ({
  execute: (tenantId, id) => repo.deleteScript(tenantId, id),
});
