import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeExportAuditArchiveUseCase, AUDIT_ARCHIVE_CONFLICT, AUDIT_ARCHIVE_UNAVAILABLE } from './ExportAuditArchiveUseCase';
import type { CreateAuditLogInput } from './CreateAuditLogUseCase';
import type { DispatchNotificationRequest, DispatchNotificationResult } from './DispatchNotificationUseCase';
import { FakeAuditArchiveStore, FakeAuditLogDaySource, FakeAuditRetentionRepository } from '../repositories/fakeAuditArchive';
import { buildAuditArchiveDay, parseAuditArchiveDay, verifyAuditChain } from '../services/auditArchiveChain';
import { AUDIT_ARCHIVE_CATEGORY } from '../services/auditArchiveNotice';
import { auditArchivePath } from '../schema/auditRetention';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const ARCHIVING = { archive: { enabled: true, retentionYears: 5 } };

const setup = (nowIso: string) => {
  const retention = new FakeAuditRetentionRepository();
  const store = new FakeAuditArchiveStore();
  const logs = new FakeAuditLogDaySource();
  const audits: CreateAuditLogInput[] = [];
  const notices: DispatchNotificationRequest[] = [];
  const clock = { now: new Date(nowIso) };
  const useCase = makeExportAuditArchiveUseCase({
    retention,
    store,
    logs,
    sha256,
    now: () => clock.now,
    audit: { execute: async (input) => { audits.push(input); } },
    dispatch: { execute: async (request) => { notices.push(request); return {} as DispatchNotificationResult; } },
    warn: () => undefined,
  });
  const run = (outOfTime: () => boolean = () => false) => useCase.execute({ outOfTime });
  return { retention, store, logs, audits, notices, clock, run };
};

const parsedDay = (store: FakeAuditArchiveStore, tenantId: string, day: string) =>
  parseAuditArchiveDay(store.objects.get(auditArchivePath(tenantId, day))!.content)!;

describe('ExportAuditArchiveUseCase — o caminho feliz', () => {
  it('quem não ligou o arquivo não é visitado: nada é lido nem gravado', async () => {
    const { retention, store, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1');
    expect(await run()).toEqual({ tenants: 0, exported: 0, failed: 0, pending: false });
    expect(store.objects.size).toBe(0);
  });

  it('exporta, em ordem, cada dia fechado desde o dia em que foi ligado — inclusive o dia sem linha', async () => {
    const { retention, store, logs, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-23' });
    logs.add('t1', 'a', '2026-10-23T10:00:00.000Z');
    logs.add('t1', 'b', '2026-10-25T23:59:59.900Z');
    logs.add('t2', 'x', '2026-10-24T10:00:00.000Z');
    logs.add('t1', 'today', '2026-10-26T00:10:00.000Z');

    expect(await run()).toMatchObject({ tenants: 1, exported: 3, failed: 0 });
    expect(parsedDay(store, 't1', '2026-10-23').lines.map((line) => line.log.id)).toEqual(['a']);
    expect(parsedDay(store, 't1', '2026-10-24').header.count).toBe(0);
    expect(parsedDay(store, 't1', '2026-10-25').lines.map((line) => line.log.id)).toEqual(['b']);
    expect(store.objects.has(auditArchivePath('t1', '2026-10-26'))).toBe(false);

    const { state } = await retention.get('t1');
    expect(state).toMatchObject({ firstDay: '2026-10-23', lastDay: '2026-10-25', failure: null });
    expect(state.headHash).toBe(parsedDay(store, 't1', '2026-10-25').header.dayHash);
  });

  it('o que foi exportado fecha como cadeia, e a execução seguinte só acrescenta o dia novo', async () => {
    const { retention, store, logs, clock, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-24' });
    logs.add('t1', 'a', '2026-10-24T10:00:00.000Z');
    await run();
    clock.now = new Date('2026-10-27T01:30:00Z');
    expect(await run()).toMatchObject({ exported: 1 });

    const { state } = await retention.get('t1');
    const verification = await verifyAuditChain({
      tenantId: 't1',
      days: ['2026-10-24', '2026-10-25', '2026-10-26'],
      read: (day) => store.read(auditArchivePath('t1', day)),
      resume: null,
      expectedHead: { day: state.lastDay!, dayHash: state.headHash! },
      protection: null,
      outOfTime: () => false,
    }, sha256);
    expect(verification.status).toBe('intact');
  });

  it('antes da 01:00 UTC o dia de ontem ainda não fecha', async () => {
    const { retention, store, run } = setup('2026-10-26T00:59:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    expect(await run()).toMatchObject({ exported: 0 });
    expect(store.objects.size).toBe(0);
  });

  it('religado depois de um período desligado, continua do dia em que foi religado — com a lacuna declarada', async () => {
    const { retention, store, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25', firstDay: '2026-09-01', lastDay: '2026-09-02', headHash: 'f'.repeat(64) });
    await run();
    expect(store.objects.has(auditArchivePath('t1', '2026-09-03'))).toBe(false);
    expect(parsedDay(store, 't1', '2026-10-25').header).toMatchObject({ previousDay: '2026-09-02', previousDayHash: 'f'.repeat(64) });
  });

  it('com retenção por objeto, trava cada dia pelos anos da política, contados do fim do dia', async () => {
    const { retention, store, run } = setup('2026-10-26T03:00:00Z');
    store.bucketProtection = { bucketRetentionLocked: false, bucketRetentionDays: null, objectRetentionLock: true };
    retention.seed('t1', { archive: { enabled: true, retentionYears: 7 } }, { startDay: '2026-10-25' });
    await run();
    expect(store.objects.get(auditArchivePath('t1', '2026-10-25'))!.retainUntil!.toISOString()).toBe('2033-10-26T00:00:00.000Z');
  });

  it('sem retenção por objeto, o bucket decide — nenhuma trava é pedida por objeto', async () => {
    const { retention, store, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    await run();
    expect(store.objects.get(auditArchivePath('t1', '2026-10-25'))!.retainUntil).toBeNull();
  });

  it('o dia exportado com mais de 30 dias sai marcado como incompleto', async () => {
    const { retention, store, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-09-20', lastDay: '2026-09-25', headHash: 'a'.repeat(64) });
    await run();
    expect(parsedDay(store, 't1', '2026-09-26').header.complete).toBe(false);
    expect(parsedDay(store, 't1', '2026-09-27').header.complete).toBe(true);
  });

  it('sem tempo, para entre dois dias e deixa o resto para a próxima execução', async () => {
    const { retention, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-20' });
    let calls = 0;
    expect(await run(() => calls++ >= 2)).toMatchObject({ exported: 2, pending: true });
    expect((await retention.get('t1')).state.lastDay).toBe('2026-10-21');
    expect(await run()).toMatchObject({ exported: 4, pending: false });
  });
});

describe('ExportAuditArchiveUseCase — reexecução e conflito', () => {
  it('o dia já gravado com o mesmo conteúdo (a execução anterior caiu antes de salvar o estado) é aceito', async () => {
    const { retention, store, logs, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    logs.add('t1', 'a', '2026-10-25T10:00:00.000Z');
    const built = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-25', previous: null, logs: logs.logs, complete: true }, sha256);
    store.objects.set(auditArchivePath('t1', '2026-10-25'), { content: built.content, retainUntil: null });

    expect(await run()).toMatchObject({ exported: 1, failed: 0 });
    expect((await retention.get('t1')).state.headHash).toBe(built.header.dayHash);
  });

  it('o dia gravado por nós quando ainda estava completo é adotado, e não vira conflito', async () => {
    const { retention, store, logs, run } = setup('2026-11-25T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    logs.add('t1', 'a', '2026-10-25T10:00:00.000Z');
    const earlier = buildAuditArchiveDay({ tenantId: 't1', day: '2026-10-25', previous: null, logs: logs.logs, complete: true }, sha256);
    store.objects.set(auditArchivePath('t1', '2026-10-25'), { content: earlier.content, retainUntil: null });

    await run();
    const { state } = await retention.get('t1');
    expect(state.failure).toBeNull();
    expect(parsedDay(store, 't1', '2026-10-26').header.previousDayHash).toBe(earlier.header.dayHash);
  });

  it('um arquivo diferente no lugar não é sobrescrito: a exportação daquele escritório para e avisa', async () => {
    const { retention, store, logs, audits, notices, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-24' });
    retention.seed('t2', ARCHIVING, { startDay: '2026-10-25' });
    logs.add('t1', 'a', '2026-10-24T10:00:00.000Z');
    store.objects.set(auditArchivePath('t1', '2026-10-24'), { content: 'escrito por outra pessoa\n', retainUntil: null });

    expect(await run()).toMatchObject({ exported: 1, failed: 1 });
    expect(store.objects.get(auditArchivePath('t1', '2026-10-24'))!.content).toBe('escrito por outra pessoa\n');
    expect(store.objects.has(auditArchivePath('t1', '2026-10-25'))).toBe(false);
    expect(store.objects.has(auditArchivePath('t2', '2026-10-25'))).toBe(true);
    expect((await retention.get('t1')).state.failure).toMatchObject({ day: '2026-10-24', message: AUDIT_ARCHIVE_CONFLICT, attempts: 1 });
    expect(audits).toHaveLength(1);
    expect(notices).toHaveLength(1);
  });
});

describe('ExportAuditArchiveUseCase — a falha alerta e é refeita', () => {
  it('a falha vira linha CRITICAL na Auditoria e aviso a quem gerencia a retenção', async () => {
    const { retention, store, audits, notices, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    store.failPut = () => new Error('403 storage.objects.create denied');

    expect(await run()).toMatchObject({ exported: 0, failed: 1 });
    expect(audits[0]).toMatchObject({
      tenantId: 't1', severity: 'CRITICAL', type: 'ERROR', userId: 'system',
      textParams: { day: '2026-10-25', attempts: '1', error: '403 storage.objects.create denied' },
    });
    expect(notices[0]).toMatchObject({ category: AUDIT_ARCHIVE_CATEGORY, recipientPermissions: ['audit.manage'], link: 'audit-logs' });
  });

  it('as tentativas seguintes contam, mas só voltam a avisar depois de 24 h', async () => {
    const { retention, store, audits, clock, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    store.failPut = () => new Error('falhou');
    await run();
    clock.now = new Date('2026-10-26T04:00:00Z');
    await run();
    expect(audits).toHaveLength(1);
    expect((await retention.get('t1')).state.failure).toMatchObject({ attempts: 2, firstFailedAt: '2026-10-26T03:00:00.000Z' });

    clock.now = new Date('2026-10-27T03:00:00Z');
    await run();
    expect(audits).toHaveLength(2);
  });

  it('quando volta a funcionar, refaz o que faltou e limpa a falha', async () => {
    const { retention, store, run, clock } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    store.failPut = () => new Error('falhou');
    await run();
    store.failPut = null;
    clock.now = new Date('2026-10-27T03:00:00Z');
    expect(await run()).toMatchObject({ exported: 2, failed: 0 });
    expect((await retention.get('t1')).state).toMatchObject({ lastDay: '2026-10-26', failure: null });
  });

  it('bucket retirado da instalação com o arquivo ligado: falha que alerta, em vez de silêncio', async () => {
    const { retention, store, audits, run } = setup('2026-10-26T03:00:00Z');
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    store.configured = false;
    expect(await run()).toMatchObject({ failed: 1 });
    expect((await retention.get('t1')).state.failure?.message).toBe(AUDIT_ARCHIVE_UNAVAILABLE);
    expect(audits).toHaveLength(1);
  });

  it('um alerta que falha não derruba a exportação dos outros escritórios', async () => {
    const retention = new FakeAuditRetentionRepository();
    const store = new FakeAuditArchiveStore();
    retention.seed('t1', ARCHIVING, { startDay: '2026-10-25' });
    retention.seed('t2', ARCHIVING, { startDay: '2026-10-25' });
    store.failPut = (path) => (path.includes('/t1/') ? new Error('falhou') : null);
    const useCase = makeExportAuditArchiveUseCase({
      retention, store, logs: new FakeAuditLogDaySource(), sha256, now: () => new Date('2026-10-26T03:00:00Z'),
      audit: { execute: async () => { throw new Error('auditoria fora'); } },
      dispatch: { execute: async () => { throw new Error('aviso fora'); } },
      warn: () => undefined,
    });
    expect(await useCase.execute({ outOfTime: () => false })).toMatchObject({ exported: 1, failed: 1 });
  });
});
