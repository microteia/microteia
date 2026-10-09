import { describe, expect, it } from 'vitest';
import { matchesAuditFilters, parseAuditBound } from './agentAuditLog';
import { agentToolByName } from '../../domain/schema/agent/agentOps';
import { PERMISSION_AUDIT_READ } from '../../domain/schema/access/kernelPermissions';

describe('search_audit_log', () => {
  // Era a permissão que um acesso podia receber sem ferramenta nenhuma que a usasse.
  it('é cobrada por audit.read e não grava', () => {
    const tool = agentToolByName('search_audit_log');
    expect(tool?.permission).toEqual({ kind: 'fixed', id: PERMISSION_AUDIT_READ });
    expect(tool?.writes).toBe(false);
  });

  it('um dia sem hora é o dia inteiro em UTC', () => {
    expect(parseAuditBound('2026-10-01', 'since')?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(parseAuditBound('2026-10-01', 'until')?.toISOString()).toBe('2026-10-01T23:59:59.999Z');
  });

  it('um instante ISO é aquele instante', () => {
    expect(parseAuditBound('2026-10-01T14:30:00-03:00', 'since')?.toISOString()).toBe('2026-10-01T17:30:00.000Z');
  });

  it('ausente não filtra; inválido é recusa', () => {
    expect(parseAuditBound(undefined, 'since')).toBeUndefined();
    expect(parseAuditBound('ontem', 'since')).toBeNull();
    expect(parseAuditBound('', 'until')).toBeNull();
    expect(parseAuditBound(20261001, 'until')).toBeNull();
  });

  it('os filtros informados combinam com E; os ausentes não restringem', () => {
    const entry = { action: 'UPDATE', severity: 'HIGH', type: 'AUDIT', entity: 'Workflow', entityId: 'w1', userId: 'u1' };
    expect(matchesAuditFilters(entry, {})).toBe(true);
    expect(matchesAuditFilters(entry, { action: 'UPDATE', userId: 'u1' })).toBe(true);
    expect(matchesAuditFilters(entry, { action: 'UPDATE', userId: 'u2' })).toBe(false);
    expect(matchesAuditFilters(entry, { severity: 'CRITICAL' })).toBe(false);
  });
});
