import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';
import { getDb, initFirebase } from '../functions/src/infrastructure/firebase/initFirebase';
import { FirestoreReportSnapshotRepository } from '../functions/src/data/repositories/FirestoreReportSnapshotRepository';
import type { ReportSnapshot } from '../functions/src/domain/schema/report/reportSnapshot';

/**
 * As fotos dos relatórios. Duas provas no mesmo emulador:
 * - as REGRAS: só o servidor toca — a foto conta com a visão da automação, e quem a lê passa pela
 *   callable, que cobra a leitura do relatório de origem;
 * - o REPOSITÓRIO de verdade: a série de UM relatório, as mais recentes até o teto, devolvidas na ordem
 *   em que foram tiradas.
 */
let env: RulesTestEnvironment;

const photo = (report: string, day: number): Omit<ReportSnapshot, 'id'> => ({
  report,
  takenAt: new Date(Date.UTC(2026, 10, day, 8)),
  definition: 'd1',
  rows: [{ status: 'open', total: day, count: day }],
  totals: { total: day },
  count: day,
  complete: true,
  truncated: false,
  takenBy: null,
  expiresAt: new Date(Date.UTC(2031, 10, day)),
});

beforeAll(async () => {
  env = await testEnv();
  process.env.GCLOUD_PROJECT = 'demo-microteia';
  initFirebase();
});
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { leitor: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: { [TENANT]: { leitor: ['reports.manage', 'automation.manage'] } },
    records: { [TENANT]: { 'report_snapshots/s1': { report: 'fila', rows: [] } } },
  });
});

describe('as fotos dos relatórios — regras', () => {
  it('ninguém do navegador lê nem grava — nem o dono, nem quem gerencia relatórios', async () => {
    for (const uid of ['dono', 'leitor']) {
      await assertFails(getDoc(doc(asUser(env, uid), `tenants/${TENANT}/report_snapshots/s1`)));
      await assertFails(setDoc(doc(asUser(env, uid), `tenants/${TENANT}/report_snapshots/nova`), { report: 'fila' }));
    }
  });
});

describe('as fotos dos relatórios — repositório no Firestore', () => {
  it('a série é de UM relatório, as mais recentes até o teto, na ordem em que foram tiradas', async () => {
    const repo = new FirestoreReportSnapshotRepository(getDb());
    for (const day of [3, 1, 5, 2, 4]) await repo.save(TENANT, photo('fila', day));
    await repo.save(TENANT, photo('outro', 6));

    const series = await repo.series(TENANT, 'fila', 3);
    expect(series.map((one) => one.takenAt.getUTCDate())).toEqual([3, 4, 5]);
    expect(series[0]).toMatchObject({ report: 'fila', definition: 'd1', count: 3, complete: true, takenBy: null });
    expect(series[0].rows).toEqual([{ status: 'open', total: 3, count: 3 }]);
    expect(series[0].takenAt).toBeInstanceOf(Date);
  });
});
