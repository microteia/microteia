import type { IHttpConnectionRepository } from '../../repositories/IHttpConnectionRepository';
import type { HttpConnection } from '../../schema/httpConnection';

export type SubscribeToHttpConnectionsUseCase = {
  execute: (tenantId: string, onChange: (connections: HttpConnection[]) => void, onError: () => void) => () => void;
};

export const makeSubscribeToHttpConnectionsUseCase = (repo: IHttpConnectionRepository): SubscribeToHttpConnectionsUseCase => ({
  execute: (tenantId, onChange, onError) => repo.subscribe(tenantId, onChange, onError),
});
