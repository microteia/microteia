import { describe, expect, it } from 'vitest';
import {
  AUDIT_RETENTION_MAX_DAYS,
  DEFAULT_AUDIT_RETENTION_POLICY,
  auditArchivePath,
  auditDayOf,
  auditDayOfArchivePath,
  auditLogExpiresAt,
  auditRetentionPolicyIssue,
  auditRetentionPolicyOf,
  isAuditArchiveLocked,
  isAuditDay,
  isAuditDayStillComplete,
  lastClosedAuditDay,
  nextAuditDay,
  previousAuditDay,
} from './auditRetention';

describe('auditRetentionPolicyOf — a leitura tolerante', () => {
  it('sem documento é exatamente o que valia antes: 30 dias e arquivo desligado', () => {
    expect(auditRetentionPolicyOf(undefined)).toEqual(DEFAULT_AUDIT_RETENTION_POLICY);
    expect(DEFAULT_AUDIT_RETENTION_POLICY).toEqual({ retentionDays: 30, archive: { enabled: false, retentionYears: 5 } });
  });

  it('lê o que está na faixa', () => {
    expect(auditRetentionPolicyOf({ retentionDays: 365, archive: { enabled: true, retentionYears: 10 } }))
      .toEqual({ retentionDays: 365, archive: { enabled: true, retentionYears: 10 } });
  });

  it('o que está fora da faixa cai no padrão, campo a campo — nunca impede a gravação do log', () => {
    expect(auditRetentionPolicyOf({ retentionDays: 7, archive: { enabled: 'yes', retentionYears: 0 } }))
      .toEqual(DEFAULT_AUDIT_RETENTION_POLICY);
    expect(auditRetentionPolicyOf({ retentionDays: AUDIT_RETENTION_MAX_DAYS + 1 }).retentionDays).toBe(30);
    expect(auditRetentionPolicyOf({ retentionDays: 45.5 }).retentionDays).toBe(30);
  });
});

describe('auditRetentionPolicyIssue — a gravação estrita', () => {
  const valid = { retentionDays: 90, archive: { enabled: true, retentionYears: 5 } };

  it('aceita a política na faixa', () => {
    expect(auditRetentionPolicyIssue(valid)).toBeNull();
  });

  it('recusa reter menos que o piso, em vez de gravar um valor que seria lido como outro', () => {
    expect(auditRetentionPolicyIssue({ ...valid, retentionDays: 29 })).toBe('@core.admin/audit.retention.days-invalid');
  });

  it('recusa o arquivo malformado e os anos fora da faixa', () => {
    expect(auditRetentionPolicyIssue({ ...valid, archive: { retentionYears: 5 } }))
      .toBe('@core.admin/audit.retention.archive-invalid');
    expect(auditRetentionPolicyIssue({ ...valid, archive: { enabled: true, retentionYears: 31 } }))
      .toBe('@core.admin/audit.retention.years-invalid');
  });
});

describe('dias UTC', () => {
  it('reconhece só datas que existem', () => {
    expect(isAuditDay('2026-10-25')).toBe(true);
    expect(isAuditDay('2026-02-30')).toBe(false);
    expect(isAuditDay('2026-1-05')).toBe(false);
    expect(isAuditDay(20261025)).toBe(false);
  });

  it('o dia é o UTC, e não o do relógio local', () => {
    expect(auditDayOf(new Date('2026-10-25T23:30:00-03:00'))).toBe('2026-10-26');
  });

  it('atravessa mês e ano', () => {
    expect(nextAuditDay('2026-12-31')).toBe('2027-01-01');
    expect(previousAuditDay('2028-03-01')).toBe('2028-02-29');
  });

  it('o dia só fecha uma hora depois da meia-noite, para a linha carimbada às 23:59:59 chegar', () => {
    expect(lastClosedAuditDay(new Date('2026-10-26T00:30:00Z'))).toBe('2026-10-24');
    expect(lastClosedAuditDay(new Date('2026-10-26T01:00:00Z'))).toBe('2026-10-25');
  });

  it('um dia exportado com mais de 30 dias pode ter perdido linhas para o TTL', () => {
    expect(isAuditDayStillComplete('2026-10-01', new Date('2026-10-30T23:59:59Z'))).toBe(true);
    expect(isAuditDayStillComplete('2026-10-01', new Date('2026-10-31T00:00:00Z'))).toBe(false);
  });

  it('o vencimento soma os dias da política à criação', () => {
    expect(auditLogExpiresAt(new Date('2026-10-01T10:00:00Z'), 365).toISOString()).toBe('2027-10-01T10:00:00.000Z');
  });
});

describe('caminho do arquivo', () => {
  it('um arquivo por dia, numa pasta por ano', () => {
    expect(auditArchivePath('t1', '2026-10-25')).toBe('tenants/t1/2026/2026-10-25.jsonl');
  });

  it('só reconhece o arquivo diário do PRÓPRIO escritório, na pasta do próprio ano', () => {
    expect(auditDayOfArchivePath('t1', 'tenants/t1/2026/2026-10-25.jsonl')).toBe('2026-10-25');
    expect(auditDayOfArchivePath('t1', 'tenants/t2/2026/2026-10-25.jsonl')).toBeNull();
    expect(auditDayOfArchivePath('t1', 'tenants/t1/2025/2026-10-25.jsonl')).toBeNull();
    expect(auditDayOfArchivePath('t1', 'tenants/t1/2026/2026-10-25.json')).toBeNull();
  });
});

describe('isAuditArchiveLocked', () => {
  it('basta um dos dois bloqueios', () => {
    expect(isAuditArchiveLocked(null)).toBe(false);
    expect(isAuditArchiveLocked({ bucketRetentionLocked: false, bucketRetentionDays: 3650, objectRetentionLock: false })).toBe(false);
    expect(isAuditArchiveLocked({ bucketRetentionLocked: true, bucketRetentionDays: 3650, objectRetentionLock: false })).toBe(true);
    expect(isAuditArchiveLocked({ bucketRetentionLocked: false, bucketRetentionDays: null, objectRetentionLock: true })).toBe(true);
  });
});
