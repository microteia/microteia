import type { EntityRecord } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';
import type { RecordQuerySpec } from '../../services/recordListQuery';

export type SubscribeToRecordQueryUseCase = {
  execute: (
    tenantId: string,
    spec: RecordQuerySpec,
    onUpdate: (records: EntityRecord[]) => void,
    onError?: (collection: string, error: Error) => void,
  ) => () => void;
};

export const makeSubscribeToRecordQueryUseCase = (repo: IRecordRepository): SubscribeToRecordQueryUseCase => ({
  execute: (tenantId, spec, onUpdate, onError) => repo.subscribeQuery(tenantId, spec, onUpdate, onError),
});
