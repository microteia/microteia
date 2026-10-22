import { describe, expect, it } from 'vitest';
import { portalReprojectionNotice } from './portalReprojectionNotice';
import { PORTAL_REPROJECTION_STALL_MS, readPortalReprojectionState } from '../schema/portalReprojection';

const NOW = 10_000_000;
const state = (patch: Record<string, unknown>) =>
  readPortalReprojectionState({ status: 'running', touchedAt: NOW, total: 10000, processed: 3200, ...patch });

describe('aviso da atualização do portal', () => {
  it('em curso, com o total contado ao abrir — ou só o que já foi, sem ele', () => {
    expect(portalReprojectionNotice(state({}), NOW)).toEqual({
      messageKey: 'portal.reprojection.running',
      counts: { processed: 3200, total: 10000, failed: 0 },
      variant: 'info',
    });
    expect(portalReprojectionNotice(state({ total: null }), NOW)?.messageKey).toBe('portal.reprojection.running.count');
  });

  it('o registro criado no meio da passada não faz o andamento passar do total', () => {
    expect(portalReprojectionNotice(state({ total: 100, processed: 120 }), NOW)?.counts.total).toBe(120);
  });

  it('parada: sem gravação há mais que o limite e sem reserva válida', () => {
    const old = NOW - PORTAL_REPROJECTION_STALL_MS - 1;
    expect(portalReprojectionNotice(state({ touchedAt: old }), NOW)?.messageKey).toBe('portal.reprojection.stalled');
    expect(portalReprojectionNotice(state({ touchedAt: old, leaseUntil: NOW + 1 }), NOW)?.messageKey)
      .toBe('portal.reprojection.running');
  });

  it('terminada: com falha, conta; sem falha, não diz nada — e sem job, nada', () => {
    expect(portalReprojectionNotice(state({ status: 'done', failed: 2 }), NOW)).toMatchObject({
      messageKey: 'portal.reprojection.failed',
      variant: 'warning',
    });
    expect(portalReprojectionNotice(state({ status: 'done' }), NOW)).toBeNull();
    expect(portalReprojectionNotice(null, NOW)).toBeNull();
  });
});
