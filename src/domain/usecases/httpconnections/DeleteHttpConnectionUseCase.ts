import type { IHttpConnectionRepository } from '../../repositories/IHttpConnectionRepository';

export type DeleteHttpConnectionUseCase = {
  execute: (tenantId: string, id: string) => Promise<void>;
};

export const makeDeleteHttpConnectionUseCase = (repo: IHttpConnectionRepository): DeleteHttpConnectionUseCase => ({
  execute: (tenantId, id) => repo.remove(tenantId, id),
});
