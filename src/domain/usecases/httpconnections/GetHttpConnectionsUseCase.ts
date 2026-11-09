import type { IHttpConnectionRepository } from '../../repositories/IHttpConnectionRepository';
import type { HttpConnection } from '../../schema/httpConnection';

export type GetHttpConnectionsUseCase = {
  execute: (tenantId: string) => Promise<HttpConnection[]>;
};

export const makeGetHttpConnectionsUseCase = (repo: IHttpConnectionRepository): GetHttpConnectionsUseCase => ({
  execute: (tenantId) => repo.list(tenantId),
});
