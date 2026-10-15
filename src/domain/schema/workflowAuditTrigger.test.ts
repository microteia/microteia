import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_AUDIT_EVENT,
  auditEventPayload,
  isAuditEventEligible,
} from './workflowAuditTrigger';
import { CORE_STEP_CATALOG, isStepExcludedFromTrigger } from './workflowStepCatalog';
import { findEventCatalogEntry, splitEntityEventName } from './eventCatalog';

describe('gatilho de auditoria — quem pode acordar uma automação', () => {
  it('o log causado por uma pessoa num escritório é elegível', () => {
    expect(isAuditEventEligible({ tenantId: 't1', userId: 'uid-123' })).toBe(true);
  });

  it('o log de máquina não é — é a trava que impede o laço', () => {
    expect(isAuditEventEligible({ tenantId: 't1', userId: 'system' })).toBe(false);
    expect(isAuditEventEligible({ tenantId: 't1', userId: 'workflow-engine' })).toBe(false);
  });

  it('o log sem escritório, ou sem autor, não é', () => {
    expect(isAuditEventEligible({ tenantId: 'SYSTEM', userId: 'uid-123' })).toBe(false);
    expect(isAuditEventEligible({ userId: 'uid-123' })).toBe(false);
    expect(isAuditEventEligible({ tenantId: 't1', userId: '' })).toBe(false);
  });
});

describe('gatilho de auditoria — payload e catálogo', () => {
  it('o payload é o log, sem o que é da infraestrutura', () => {
    const payload = auditEventPayload('log1', {
      tenantId: 't1',
      title: '@core.admin/audit.title',
      titleParams: { action: 'x' },
      severity: 'HIGH',
      action: 'DELETE',
      userId: 'uid-1',
      photoURL: 'https://x',
      expiresAt: new Date(),
      entityLink: 'view-x:1',
      linkRecordId: undefined,
    });
    expect(payload).toEqual({
      id: 'log1',
      title: '@core.admin/audit.title',
      titleParams: { action: 'x' },
      severity: 'HIGH',
      action: 'DELETE',
      userId: 'uid-1',
    });
  });

  it('o evento está no catálogo e não é confundido com evento de coleção', () => {
    const entry = findEventCatalogEntry(WORKFLOW_AUDIT_EVENT);
    expect(entry?.fields.map((field) => field.path)).toEqual(expect.arrayContaining(['id', 'severity', 'action', 'entity']));
    expect(entry?.root.hasOld).toBe(false);
    expect(splitEntityEventName(WORKFLOW_AUDIT_EVENT)).toBeNull();
  });

  it('só os passos que realimentariam o gatilho o declaram proibido', () => {
    const excluded = CORE_STEP_CATALOG
      .filter((step) => isStepExcludedFromTrigger(step, WORKFLOW_AUDIT_EVENT))
      .map((step) => step.id);
    expect(excluded.sort()).toEqual(['register-audit', 'remove']);
    expect(CORE_STEP_CATALOG.some((step) => isStepExcludedFromTrigger(step, 'records.saved'))).toBe(false);
  });
});
