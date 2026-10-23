import { describe, expect, it } from 'vitest';
import { portalReprojectionSummary } from './portalReprojectionNotice';
import { PORTAL_REPROJECTION_STALL_MS, readPortalReprojectionState } from '../schema/portalReprojection';

const NOW = 10_000_000;
const state = (patch: Record<string, unknown>) =>
  readPortalReprojectionState({ status: 'running', touchedAt: NOW, openedAt: NOW - 1000, total: 10000, processed: 3200, ...patch });
const summary = (entries: Record<string, Record<string, unknown>>) =>
  portalReprojectionSummary(new Map(Object.entries(entries).map(([key, patch]) => [key, state(patch)])), NOW);

describe('aviso da atualização do portal', () => {
  it('um andamento só, somando a leva inteira — a que anda, as da fila e as que já terminaram nela', () => {
    expect(summary({
      cases: { status: 'done', total: 400, processed: 400, touchedAt: NOW - 500 },
      movements: { total: 2000, processed: 600 },
      persons: { status: 'queued', total: 600, processed: 0 },
    }).progress).toEqual({ messageKey: 'portal.reprojection.progress', processed: 1000, total: 3000, ratio: 1000 / 3000 });
  });

  it('a passada terminada antes da leva não entra na soma', () => {
    expect(summary({
      old: { status: 'done', total: 900, processed: 900, touchedAt: NOW - 5000 },
      movements: { total: 100, processed: 50 },
    }).progress).toMatchObject({ processed: 50, total: 100 });
  });

  it('sem nada andando, ou só coleções vazias, não há andamento', () => {
    expect(summary({ cases: { status: 'done', total: 400, processed: 400 } }).progress).toBeNull();
    expect(summary({ empty: { status: 'queued', total: 0, processed: 0 } }).progress).toBeNull();
  });

  it('sem o total de alguma, conta só o que já foi; o criado no meio não passa do total', () => {
    expect(summary({ a: { total: null } }).progress).toMatchObject({ messageKey: 'portal.reprojection.progress.count', ratio: null });
    expect(summary({ a: { total: 100, processed: 120 } }).progress).toMatchObject({ total: 120, ratio: 1 });
  });

  it('por coleção, só o que pede atenção: a parada e a que terminou com falha', () => {
    const old = NOW - PORTAL_REPROJECTION_STALL_MS - 1;
    expect(summary({
      stalled: { touchedAt: old },
      leased: { touchedAt: old, leaseUntil: NOW + 1 },
      failed: { status: 'done', failed: 2 },
      fine: { status: 'done' },
    }).warnings).toEqual([
      { collection: 'stalled', messageKey: 'portal.reprojection.stalled', counts: { processed: 3200, failed: 0 } },
      { collection: 'failed', messageKey: 'portal.reprojection.failed', counts: { processed: 3200, failed: 2 } },
    ]);
  });
});
