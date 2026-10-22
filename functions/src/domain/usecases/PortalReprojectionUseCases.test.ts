import { describe, expect, it } from 'vitest';
import { makeProjectPortalRecordUseCase } from './PortalProjectionUseCases';
import {
  PORTAL_REPROJECTION_MAX_ATTEMPTS,
  PORTAL_REPROJECTION_PAGE_SIZE,
  makeNudgePortalReprojectionsUseCase,
  makeEnsurePortalProjectionRevisionUseCase,
  makeRunPortalReprojectionRoundUseCase,
  makeStartPortalReprojectionUseCase,
  portalReprojectionScope,
} from './PortalReprojectionUseCases';
import { CITY_SCREENS, EXTENSION_CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import type { PortalScreen } from '../repositories/IPortalRepository';
import { PORTAL_PROJECTION_REVISION, PORTAL_REPROJECTION_STALL_MS } from '../schema/portalReprojection';

const TENANT = 'salvador';

const withPortal = (screenId: string, patch: Partial<NonNullable<PortalScreen['portal']>> | null) =>
  CITY_SCREENS.map((screen) => {
    if (screen.id !== screenId) return screen;
    return { ...screen, portal: patch === null ? null : { ...screen.portal!, ...patch } };
  });

/**
 * O escritório com o relógio na mão. `drain` faz o papel do gatilho: enquanto o job está em curso,
 * roda a rodada seguinte — e conta quantas foram.
 */
const setup = (screens: PortalScreen[] = CITY_SCREENS) => {
  const fake = makeFakePortalRepository(screens);
  fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
  let clock = 1_000_000;
  const now = () => clock;
  const project = makeProjectPortalRecordUseCase(fake.repo);
  const start = makeStartPortalReprojectionUseCase(fake.repo, now);
  const round = makeRunPortalReprojectionRoundUseCase(fake.repo, project, now);
  const drain = async (collection: string) => {
    let rounds = 0;
    while (fake.reprojections.get(collection)?.status === 'running' && rounds < 1000) {
      await round.execute(TENANT, collection);
      rounds += 1;
    }
    return rounds;
  };
  const advance = (ms: number) => { clock += ms; };
  return { ...fake, project, start, round, drain, now, advance };
};

describe('escopo da reprojeção', () => {
  it('a tela-sujeito alcança quem chega a ela, em qualquer profundidade', () => {
    expect(portalReprojectionScope(CITY_SCREENS, { screenId: 'companies', collections: ['companies'] }).sort())
      .toEqual(['companies', 'invoiceItems', 'invoices']);
  });

  it('o filho mudou: só ele — o pai e o avô não dependem dele', () => {
    expect(portalReprojectionScope(CITY_SCREENS, { screenId: 'invoiceItems', collections: ['invoiceItems'] }))
      .toEqual(['invoiceItems']);
  });

  it('quem mostra o título dela no rótulo entra — mas os dependentes de quem mostra, não', () => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'inspections'
      ? { ...screen, portal: { subject: { field: 'companyId' }, fields: ['title'] } }
      : screen.id === 'invoiceItems'
        ? {
          ...screen,
          fields: [...screen.fields, { key: 'inspectionId', label: 'Inspection', type: 'reference', refEntity: 'inspections' }],
          portal: { ...screen.portal!, fields: ['description', 'inspectionId'] },
        }
        : screen)) as PortalScreen[];
    expect(portalReprojectionScope(screens, { screenId: 'inspections', collections: ['inspections'] }).sort())
      .toEqual(['inspections', 'invoiceItems']);
  });

  it('o nome de antes entra junto: a coleção renomeada deixa projeções no nome velho', () => {
    expect(portalReprojectionScope(CITY_SCREENS, { screenId: 'invoiceItems', collections: ['oldItems', 'invoiceItems'] }).sort())
      .toEqual(['invoiceItems', 'oldItems']);
  });
});

describe('a passada anda por rodadas', () => {
  const seedInvoices = (records: Map<string, Record<string, unknown>>, count: number, data: (index: number) => Record<string, unknown>) => {
    for (let index = 0; index < count; index += 1) {
      records.set(`invoices/nf${String(index).padStart(5, '0')}`, { number: `NF-${index}`, companyId: 'acme', ...data(index) });
    }
  };

  it('uma coleção grande é percorrida página a página, até o fim, e só o que passa no filtro sai', async () => {
    const fake = setup(withPortal('invoices', { visibleWhen: 'kind == "revenue"' }));
    const total = PORTAL_REPROJECTION_PAGE_SIZE * 2 + 37;
    seedInvoices(fake.records, total, (index) => ({ kind: index % 2 === 0 ? 'revenue' : 'expense' }));

    await fake.start.execute(TENANT, ['invoices']);
    const rounds = await fake.drain('invoices');

    expect(rounds).toBe(3);
    expect(fake.reprojections.get('invoices')).toMatchObject({ status: 'done', total, processed: total, failed: 0, cursor: null });
    expect([...fake.projections.values()].filter((one) => one.collection === 'invoices')).toHaveLength(Math.ceil(total / 2));
  });

  it('o filtro novo numa tela que já estava no portal apaga o que passou a ficar dentro', async () => {
    const fake = setup();
    seedInvoices(fake.records, 10, (index) => ({ kind: index < 3 ? 'revenue' : 'expense' }));
    for (const [key, data] of fake.records) {
      const [collection, id] = key.split('/');
      if (collection === 'invoices') await fake.project.execute({ tenantId: TENANT, collection, recordId: id, data });
    }
    expect(fake.projections.size).toBe(10);

    const filtered = makeFakePortalRepository(withPortal('invoices', { visibleWhen: 'kind == "revenue"' }));
    const repo = { ...fake.repo, getScreens: filtered.repo.getScreens };
    await makeStartPortalReprojectionUseCase(repo, fake.now).execute(TENANT, ['invoices']);
    await makeRunPortalReprojectionRoundUseCase(repo, makeProjectPortalRecordUseCase(repo), fake.now).execute(TENANT, 'invoices');
    expect(fake.projections.size).toBe(3);
  });

  it('a tela que sai do portal leva as projeções dela junto, página a página', async () => {
    const fake = setup();
    seedInvoices(fake.records, PORTAL_REPROJECTION_PAGE_SIZE + 5, () => ({}));
    for (const [key, data] of fake.records) {
      const [collection, id] = key.split('/');
      if (collection === 'invoices') await fake.project.execute({ tenantId: TENANT, collection, recordId: id, data });
    }

    const gone = makeFakePortalRepository(withPortal('invoices', null));
    const repo = { ...fake.repo, getScreens: gone.repo.getScreens };
    await makeStartPortalReprojectionUseCase(repo, fake.now).execute(TENANT, ['invoices']);
    const round = makeRunPortalReprojectionRoundUseCase(repo, makeProjectPortalRecordUseCase(repo), fake.now);
    while (fake.reprojections.get('invoices')?.status === 'running') await round.execute(TENANT, 'invoices');

    expect(fake.projections.size).toBe(0);
  });

  it('dentro da passada, a projeção não cascateia — os filhos têm a passada deles', async () => {
    const fake = setup();
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    fake.records.set('invoiceItems/it1', { description: 'Serviço', invoiceId: 'nf1' });
    let referencing = 0;
    const repo = { ...fake.repo, getRecordsReferencing: async (...args: Parameters<typeof fake.repo.getRecordsReferencing>) => {
      referencing += 1;
      return fake.repo.getRecordsReferencing(...args);
    } };
    await makeStartPortalReprojectionUseCase(repo, fake.now).execute(TENANT, ['invoices']);
    await makeRunPortalReprojectionRoundUseCase(repo, makeProjectPortalRecordUseCase(repo), fake.now).execute(TENANT, 'invoices');
    expect(fake.projections.has('invoices__nf1')).toBe(true);
    expect(referencing).toBe(0);
  });
});

describe('revisão da forma de projetar', () => {
  it('a coleção projetada por uma revisão anterior ganha uma passada — uma vez — e ela grava o que faltava', async () => {
    const fake = setup(EXTENSION_CITY_SCREENS);
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    fake.records.set('invoiceItems/it1', { description: 'Serviço', invoiceId: 'nf1' });
    const ensure = makeEnsurePortalProjectionRevisionUseCase(fake.repo, fake.now);

    const opened = await ensure.execute(TENANT);
    expect(opened.sort()).toEqual(['companies', 'invoiceItems', 'invoices']);
    for (const collection of opened) await fake.drain(collection);

    expect(fake.projections.get('invoices__nf1')?.audience).toEqual(['ana']);
    expect(fake.projections.get('invoiceItems__it1')?.audience).toEqual(['ana']);
    expect(fake.reprojections.get('invoices')).toMatchObject({ status: 'done', revision: PORTAL_PROJECTION_REVISION });
    expect(await ensure.execute(TENANT)).toEqual([]);
  });

  it('a passada aberta pela declaração já nasce na revisão atual, e a da revisão antiga é refeita', async () => {
    const fake = setup();
    await fake.start.execute(TENANT, ['invoices']);
    await fake.drain('invoices');
    const before = fake.reprojections.get('invoices')!;
    fake.reprojections.set('companies', { ...before, revision: PORTAL_PROJECTION_REVISION - 1 });

    const opened = await makeEnsurePortalProjectionRevisionUseCase(fake.repo, fake.now).execute(TENANT);
    expect(opened.sort()).toEqual(['companies', 'invoiceItems']);
    expect(fake.reprojections.get('invoices')).toEqual(before);
  });
});

describe('concorrência e falha', () => {
  it('a reserva válida impede a rodada duplicada; vencida, libera', async () => {
    const fake = setup();
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    await fake.start.execute(TENANT, ['invoices']);
    fake.reprojections.set('invoices', { ...fake.reprojections.get('invoices')!, leaseUntil: fake.now() + 60_000 });

    await fake.round.execute(TENANT, 'invoices');
    expect(fake.projections.size).toBe(0);

    fake.advance(60_001);
    await fake.round.execute(TENANT, 'invoices');
    expect(fake.projections.size).toBe(1);
  });

  it('a declaração mudou no meio: a rodada da passada velha é descartada ao fechar', async () => {
    const fake = setup();
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    await fake.start.execute(TENANT, ['invoices']);
    const repo = { ...fake.repo, listRecords: async (...args: Parameters<typeof fake.repo.listRecords>) => {
      await fake.start.execute(TENANT, ['invoices']);
      return fake.repo.listRecords(...args);
    } };
    await makeRunPortalReprojectionRoundUseCase(repo, fake.project, fake.now).execute(TENANT, 'invoices');
    expect(fake.reprojections.get('invoices')).toMatchObject({ status: 'running', generation: 2, round: 0, processed: 0 });
  });

  it('a rodada que estoura solta a reserva e sobe, para o gatilho reentregar do mesmo cursor', async () => {
    const fake = setup();
    await fake.start.execute(TENANT, ['invoices']);
    const repo = { ...fake.repo, listRecords: async () => { throw new Error('unavailable'); } };
    await expect(makeRunPortalReprojectionRoundUseCase(repo, fake.project, fake.now).execute(TENANT, 'invoices'))
      .rejects.toThrow('unavailable');
    expect(fake.reprojections.get('invoices')).toMatchObject({ status: 'running', leaseUntil: null, cursor: null });
  });

  it('o registro que falha não segura a página; a passada recomeça e, esgotada, para com a contagem', async () => {
    const fake = setup();
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    fake.records.set('invoices/nf2', { number: 'NF-2', companyId: 'acme' });
    const repo = { ...fake.repo, getProjection: async (tenantId: string, id: string) => {
      if (id === 'invoices__nf2') throw new Error('boom');
      return fake.repo.getProjection(tenantId, id);
    } };
    await makeStartPortalReprojectionUseCase(repo, fake.now).execute(TENANT, ['invoices']);
    const round = makeRunPortalReprojectionRoundUseCase(repo, makeProjectPortalRecordUseCase(repo), fake.now);
    let rounds = 0;
    while (fake.reprojections.get('invoices')?.status === 'running' && rounds < 10) {
      await round.execute(TENANT, 'invoices');
      rounds += 1;
    }
    expect(rounds).toBe(PORTAL_REPROJECTION_MAX_ATTEMPTS);
    expect(fake.projections.has('invoices__nf1')).toBe(true);
    expect(fake.reprojections.get('invoices')).toMatchObject({ status: 'done', failed: 1, failedIds: ['nf2'] });
  });

  it('a passada parada é acordada e continua do cursor; a que anda não é tocada', async () => {
    const fake = setup();
    await fake.start.execute(TENANT, ['invoices', 'companies']);
    fake.reprojections.set('invoices', { ...fake.reprojections.get('invoices')!, cursor: 'nf00100', leaseUntil: fake.now() + 1 });
    fake.advance(PORTAL_REPROJECTION_STALL_MS + 1);
    fake.reprojections.set('companies', { ...fake.reprojections.get('companies')!, touchedAt: fake.now() });

    expect(await makeNudgePortalReprojectionsUseCase(fake.repo, fake.now).execute(TENANT)).toBe(1);
    expect(fake.reprojections.get('invoices')).toMatchObject({ cursor: 'nf00100', leaseUntil: null, touchedAt: fake.now() });
  });
});
