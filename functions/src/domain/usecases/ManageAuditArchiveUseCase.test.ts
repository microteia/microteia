import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeManageAuditArchiveUseCase, auditRetentionChangeLogs } from './ManageAuditArchiveUseCase';
import { makeExportAuditArchiveUseCase, AUDIT_ARCHIVE_UNAVAILABLE } from './ExportAuditArchiveUseCase';
import type { CreateAuditLogInput } from './CreateAuditLogUseCase';
import type { DispatchNotificationRequest, DispatchNotificationResult } from './DispatchNotificationUseCase';
import { FakeAuditArchiveStore, FakeAuditLogDaySource, FakeAuditRetentionRepository } from '../repositories/fakeAuditArchive';
import { DomainError } from '../errors/DomainError';
import { DEFAULT_AUDIT_RETENTION_POLICY, EMPTY_AUDIT_ARCHIVE_STATE, auditArchivePath } from '../schema/auditRetention';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const ACTOR = { userId: 'u1', userName: 'Ana', photoURL: '' };

const setup = (nowIso = '2026-10-26T15:00:00Z') => {
  const retention = new FakeAuditRetentionRepository();
  const store = new FakeAuditArchiveStore();
  const logs = new FakeAuditLogDaySource();
  const audits: CreateAuditLogInput[] = [];
  const notices: DispatchNotificationRequest[] = [];
  const clock = { now: new Date(nowIso) };
  const shared = {
    retention,
    store,
    sha256,
    now: () => clock.now,
    audit: { execute: async (input: CreateAuditLogInput) => { audits.push(input); } },
    dispatch: { execute: async (request: DispatchNotificationRequest) => { notices.push(request); return {} as DispatchNotificationResult; } },
    warn: () => undefined,
  };
  const manage = makeManageAuditArchiveUseCase(shared);
  const exporter = makeExportAuditArchiveUseCase({ ...shared, logs });
  return { retention, store, logs, audits, notices, clock, manage, exporter };
};

const expectDomainError = async (promise: Promise<unknown>, code: string, message: string) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({ code, message });
};

describe('status', () => {
  it('o escritório que nunca configurou nada vê o padrão de sempre', async () => {
    const { manage } = setup();
    expect(await manage.status('t1')).toEqual({
      policy: DEFAULT_AUDIT_RETENTION_POLICY,
      archiveAvailable: true,
      protection: { bucketRetentionLocked: true, bucketRetentionDays: 3650, objectRetentionLock: false },
      state: EMPTY_AUDIT_ARCHIVE_STATE,
    });
  });

  it('sem bucket na instalação, o arquivo não está disponível e não há proteção a mostrar', async () => {
    const { manage, store } = setup();
    store.configured = false;
    expect(await manage.status('t1')).toMatchObject({ archiveAvailable: false, protection: null });
  });
});

describe('save', () => {
  it('recusa a política fora da faixa com o motivo, sem gravar', async () => {
    const { manage, retention } = setup();
    await expectDomainError(
      manage.save({ tenantId: 't1', actor: ACTOR, policy: { retentionDays: 10, archive: { enabled: false, retentionYears: 5 } } }),
      'invalid-argument',
      '@core.admin/audit.retention.days-invalid',
    );
    expect(retention.entries.size).toBe(0);
  });

  it('não liga o arquivo numa instalação sem bucket', async () => {
    const { manage, store } = setup();
    store.configured = false;
    await expectDomainError(
      manage.save({ tenantId: 't1', actor: ACTOR, policy: { retentionDays: 30, archive: { enabled: true, retentionYears: 5 } } }),
      'failed-precondition',
      AUDIT_ARCHIVE_UNAVAILABLE,
    );
  });

  it('mesmo sem bucket, a retenção da consulta pode ser mudada', async () => {
    const { manage, store } = setup();
    store.configured = false;
    const status = await manage.save({ tenantId: 't1', actor: ACTOR, policy: { retentionDays: 365, archive: { enabled: false, retentionYears: 5 } } });
    expect(status.policy.retentionDays).toBe(365);
  });

  it('ligar o arquivo marca o dia em que ele começa e fica na Auditoria com o autor', async () => {
    const { manage, retention, audits } = setup();
    const status = await manage.save({ tenantId: 't1', actor: ACTOR, policy: { retentionDays: 30, archive: { enabled: true, retentionYears: 10 } } });
    expect(status.state.startDay).toBe('2026-10-26');
    expect(retention.authors).toEqual([{ userId: 'u1', userName: 'Ana' }]);
    expect(audits).toEqual([expect.objectContaining({
      userId: 'u1', severity: 'LOW', title: '@core.admin/audit.archive.enabled.title', textParams: { day: '2026-10-26', years: '10' },
    })]);
  });

  it('salvar sem mudar nada não deixa linha na Auditoria nem reinicia o começo do arquivo', async () => {
    const { manage, retention, audits } = setup();
    retention.seed('t1', { archive: { enabled: true, retentionYears: 5 } }, { startDay: '2026-01-01' });
    const status = await manage.save({ tenantId: 't1', actor: ACTOR, policy: { retentionDays: 30, archive: { enabled: true, retentionYears: 5 } } });
    expect(status.state.startDay).toBe('2026-01-01');
    expect(audits).toEqual([]);
  });
});

describe('auditRetentionChangeLogs — a severidade é a do que se tira', () => {
  const on = { retentionDays: 90, archive: { enabled: true, retentionYears: 5 } };

  it('desligar o arquivo é CRITICAL', () => {
    const logs = auditRetentionChangeLogs('t1', ACTOR, on, { ...on, archive: { ...on.archive, enabled: false } }, EMPTY_AUDIT_ARCHIVE_STATE);
    expect(logs.map((log) => [log.title, log.severity])).toEqual([['@core.admin/audit.archive.disabled.title', 'CRITICAL']]);
  });

  it('encurtar um prazo é HIGH; alongar é LOW', () => {
    const shorter = auditRetentionChangeLogs('t1', ACTOR, on, { ...on, retentionDays: 60 }, EMPTY_AUDIT_ARCHIVE_STATE);
    const longer = auditRetentionChangeLogs('t1', ACTOR, on, { ...on, archive: { enabled: true, retentionYears: 10 } }, EMPTY_AUDIT_ARCHIVE_STATE);
    expect(shorter[0]).toMatchObject({ severity: 'HIGH', textParams: { beforeDays: '90', afterDays: '60', beforeYears: '5', afterYears: '5' } });
    expect(longer[0]).toMatchObject({ severity: 'LOW', textParams: { beforeYears: '5', afterYears: '10' } });
  });
});

describe('day — a consulta pela organização', () => {
  it('lê o dia arquivado, em páginas', async () => {
    const { manage, retention, logs, exporter, clock } = setup('2026-10-24T12:00:00Z');
    await manage.save({ tenantId: 't1', actor: ACTOR, policy: { retentionDays: 30, archive: { enabled: true, retentionYears: 5 } } });
    for (let index = 0; index < 5; index += 1) logs.add('t1', `l${index}`, `2026-10-24T1${index}:00:00.000Z`);
    clock.now = new Date('2026-10-25T02:00:00Z');
    await exporter.execute({ outOfTime: () => false });
    expect((await retention.get('t1')).state.lastDay).toBe('2026-10-24');

    const page = await manage.day({ tenantId: 't1', day: '2026-10-24', offset: 2, limit: 2 });
    expect(page).toMatchObject({ exported: true, offset: 2, total: 5 });
    expect(page.header?.count).toBe(5);
    expect(page.lines.map((line) => line.log.id)).toEqual(['l2', 'l3']);
  });

  it('o dia não exportado responde "não exportado", e não erro', async () => {
    const { manage } = setup();
    expect(await manage.day({ tenantId: 't1', day: '2026-10-20' })).toMatchObject({ exported: false, lines: [], total: 0 });
  });

  it('não lê o arquivo de outro escritório: o caminho sai do escritório da chamada', async () => {
    const { manage, store } = setup();
    store.objects.set(auditArchivePath('t2', '2026-10-20'), { content: 'x\n', retainUntil: null });
    expect(await manage.day({ tenantId: 't1', day: '2026-10-20' })).toMatchObject({ exported: false });
  });

  it('recusa um dia que não é data, e o arquivo ilegível', async () => {
    const { manage, store } = setup();
    await expectDomainError(manage.day({ tenantId: 't1', day: '../t2/2026' }), 'invalid-argument', '@core.admin/audit.archive.day-invalid');
    store.objects.set(auditArchivePath('t1', '2026-10-20'), { content: 'x\n', retainUntil: null });
    await expectDomainError(manage.day({ tenantId: 't1', day: '2026-10-20' }), 'failed-precondition', '@core.admin/audit.archive.unreadable');
  });
});

describe('verify', () => {
  const exportThreeDays = async () => {
    const context = setup('2026-10-21T12:00:00Z');
    await context.manage.save({ tenantId: 't1', actor: ACTOR, policy: { retentionDays: 30, archive: { enabled: true, retentionYears: 5 } } });
    context.logs.add('t1', 'a', '2026-10-21T10:00:00.000Z');
    context.logs.add('t1', 'b', '2026-10-23T10:00:00.000Z');
    context.clock.now = new Date('2026-10-24T02:00:00Z');
    await context.exporter.execute({ outOfTime: () => false });
    context.audits.length = 0;
    return context;
  };

  it('atesta a cadeia exportada, com a proteção do bucket na resposta', async () => {
    const { manage } = await exportThreeDays();
    const result = await manage.verify({ tenantId: 't1', actor: ACTOR, outOfTime: () => false });
    expect(result).toMatchObject({ status: 'intact', daysChecked: 3, firstDay: '2026-10-21', lastDay: '2026-10-23', divergence: null });
    expect(result.protection?.bucketRetentionLocked).toBe(true);
  });

  it('a divergência fica na Auditoria, atribuída a quem verificou, e avisa quem gerencia', async () => {
    const { manage, store, audits, notices } = await exportThreeDays();
    const path = auditArchivePath('t1', '2026-10-22');
    store.objects.delete(path);
    const result = await manage.verify({ tenantId: 't1', actor: ACTOR, outOfTime: () => false });
    expect(result.divergence).toEqual({ day: '2026-10-22', reason: 'missing-day' });
    expect(audits).toEqual([expect.objectContaining({
      userId: 'u1', severity: 'CRITICAL', text: '@core.admin/audit.archive.reason.missing-day', textParams: { day: '2026-10-22', line: '', logId: '' },
    })]);
    expect(notices[0]).toMatchObject({ recipientPermissions: ['audit.manage'], params: { day: '2026-10-22' } });
  });

  it('o fim cortado aparece pelo registro do escritório', async () => {
    const { manage, store } = await exportThreeDays();
    store.objects.delete(auditArchivePath('t1', '2026-10-23'));
    expect((await manage.verify({ tenantId: 't1', actor: ACTOR, outOfTime: () => false })).divergence)
      .toEqual({ day: '2026-10-23', reason: 'missing-tail' });
  });

  it('continua de um ponto válido; um ponto malformado é ignorado e a cadeia é conferida do começo', async () => {
    const { manage, retention } = await exportThreeDays();
    const { state } = await retention.get('t1');
    const fromHead = await manage.verify({ tenantId: 't1', actor: ACTOR, resume: { day: state.lastDay, dayHash: state.headHash }, outOfTime: () => false });
    expect(fromHead).toMatchObject({ status: 'intact', daysChecked: 0 });
    const forged = await manage.verify({ tenantId: 't1', actor: ACTOR, resume: { day: '2026-10-23', dayHash: 'nope' }, outOfTime: () => false });
    expect(forged.daysChecked).toBe(3);
  });

  it('sem bucket, não há o que verificar', async () => {
    const { manage, store } = setup();
    store.configured = false;
    await expectDomainError(manage.verify({ tenantId: 't1', actor: ACTOR, outOfTime: () => false }), 'failed-precondition', AUDIT_ARCHIVE_UNAVAILABLE);
  });
});
