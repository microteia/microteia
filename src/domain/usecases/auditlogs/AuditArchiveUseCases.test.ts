import { describe, expect, it } from 'vitest';
import { makeVerifyAuditArchiveUseCase } from './AuditArchiveUseCases';
import type { IAuditArchiveRepository } from '../../repositories/IAuditArchiveRepository';
import type { AuditChainLink, AuditChainVerification } from '../../schema/auditRetention';

const result = (overrides: Partial<AuditChainVerification>): AuditChainVerification => ({
  status: 'intact', daysChecked: 0, firstDay: null, lastDay: null, headHash: null, gaps: [], incompleteDays: [],
  divergence: null, resume: null, protection: null, ...overrides,
});

const repository = (responses: AuditChainVerification[], calls: (AuditChainLink | null)[]): IAuditArchiveRepository => ({
  getStatus: async () => { throw new Error('não usado'); },
  savePolicy: async () => { throw new Error('não usado'); },
  readDay: async () => { throw new Error('não usado'); },
  verify: async (_tenantId, resume) => { calls.push(resume); return responses.shift()!; },
});

describe('makeVerifyAuditArchiveUseCase', () => {
  it('continua de onde o servidor parou até a cadeia inteira, somando o que cada rodada conferiu', async () => {
    const calls: (AuditChainLink | null)[] = [];
    const link = { day: '2026-10-08', dayHash: 'a'.repeat(64) };
    const progress: number[] = [];
    const verify = makeVerifyAuditArchiveUseCase(repository([
      result({ status: 'partial', daysChecked: 8, firstDay: '2026-10-01', lastDay: '2026-10-08', resume: link, incompleteDays: ['2026-10-01'] }),
      result({ status: 'intact', daysChecked: 4, firstDay: '2026-10-09', lastDay: '2026-10-12', gaps: [{ after: '2026-10-09', resumedAt: '2026-10-11' }] }),
    ], calls));

    const final = await verify.execute('t1', (partial) => progress.push(partial.daysChecked));
    expect(calls).toEqual([null, link]);
    expect(progress).toEqual([8]);
    expect(final).toMatchObject({
      status: 'intact', daysChecked: 12, firstDay: '2026-10-01', lastDay: '2026-10-12',
      incompleteDays: ['2026-10-01'], gaps: [{ after: '2026-10-09', resumedAt: '2026-10-11' }],
    });
  });

  it('para quando o servidor devolve o mesmo ponto de novo, em vez de girar para sempre', async () => {
    const calls: (AuditChainLink | null)[] = [];
    const link = { day: '2026-10-08', dayHash: 'a'.repeat(64) };
    const verify = makeVerifyAuditArchiveUseCase(repository([
      result({ status: 'partial', resume: link }),
      result({ status: 'partial', resume: link }),
      result({ status: 'partial', resume: link }),
    ], calls));
    expect((await verify.execute('t1')).status).toBe('partial');
    expect(calls).toHaveLength(2);
  });

  it('a divergência encerra na hora', async () => {
    const calls: (AuditChainLink | null)[] = [];
    const verify = makeVerifyAuditArchiveUseCase(repository([
      result({ status: 'diverged', divergence: { day: '2026-10-02', reason: 'missing-day' } }),
    ], calls));
    expect((await verify.execute('t1')).divergence).toEqual({ day: '2026-10-02', reason: 'missing-day' });
    expect(calls).toHaveLength(1);
  });
});
