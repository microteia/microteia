import { describe, expect, it } from 'vitest';
import { makeAuditRetentionDaysOf } from './auditRetentionDays';
import { FakeAuditRetentionRepository } from '../../domain/repositories/fakeAuditArchive';

describe('makeAuditRetentionDaysOf', () => {
  it('sem política, os 30 dias de sempre', async () => {
    const retentionDaysOf = makeAuditRetentionDaysOf(() => new FakeAuditRetentionRepository(), () => undefined);
    expect(await retentionDaysOf('t1')).toBe(30);
  });

  it('com política, a do escritório — e a releitura só depois de 5 minutos', async () => {
    const repository = new FakeAuditRetentionRepository();
    repository.seed('t1', { retentionDays: 365 });
    let clock = 0;
    const retentionDaysOf = makeAuditRetentionDaysOf(() => repository, () => undefined, () => clock);
    expect(await retentionDaysOf('t1')).toBe(365);

    repository.seed('t1', { retentionDays: 90 });
    clock = 4 * 60_000;
    expect(await retentionDaysOf('t1')).toBe(365);
    clock = 5 * 60_000 + 1;
    expect(await retentionDaysOf('t1')).toBe(90);
  });

  it('a política ilegível nunca impede a auditoria: vale o padrão', async () => {
    const repository = new FakeAuditRetentionRepository();
    repository.get = async () => { throw new Error('indisponível'); };
    const warnings: string[] = [];
    const retentionDaysOf = makeAuditRetentionDaysOf(() => repository, (message) => warnings.push(message));
    expect(await retentionDaysOf('t1')).toBe(30);
    expect(warnings).toHaveLength(1);
  });

  it('o escritório-fantasma SYSTEM não custa leitura', async () => {
    const repository = new FakeAuditRetentionRepository();
    let reads = 0;
    const read = repository.get.bind(repository);
    repository.get = async (tenantId) => { reads += 1; return read(tenantId); };
    const retentionDaysOf = makeAuditRetentionDaysOf(() => repository, () => undefined);
    expect(await retentionDaysOf('SYSTEM')).toBe(30);
    expect(reads).toBe(0);
  });
});
