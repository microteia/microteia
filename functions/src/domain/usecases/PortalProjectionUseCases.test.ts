import { describe, expect, it } from 'vitest';
import {
  makeProjectPortalDocumentUseCase,
  makeProjectPortalRecordUseCase,
  makeRefreshPortalAudienceUseCase,
  samePortalValue,
} from './PortalProjectionUseCases';
import { CITY_SCREENS, EXTENSION_CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';

const TENANT = 'salvador';

const setup = (screens = CITY_SCREENS) => {
  const fake = makeFakePortalRepository(screens);
  fake.records.set('companies/acme', { name: 'Acme', taxId: '123' });
  fake.records.set('companies/globex', { name: 'Globex', taxId: '456' });
  fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
  fake.users.set('bia', { userId: 'bia', email: 'bia@globex.com', displayName: 'Bia', subjectKeys: ['companies/globex'] });
  const project = makeProjectPortalRecordUseCase(fake.repo);
  const write = async (collection: string, id: string, data: Record<string, unknown> | null) => {
    if (data) fake.records.set(`${collection}/${id}`, data);
    else fake.records.delete(`${collection}/${id}`);
    return project.execute({ tenantId: TENANT, collection, recordId: id, data });
  };
  return { ...fake, project, write };
};

describe('projeção do portal', () => {
  it('só os campos declarados saem, e só para quem é da empresa', async () => {
    const { write, projections } = setup();
    await write('invoices', 'nf1', { number: 'NF-1', amount: 100, auditNote: 'suspeita', companyId: 'acme' });

    const projection = projections.get('invoices__nf1');
    expect(projection?.data).toEqual({ number: 'NF-1', amount: 100, companyId: 'acme' });
    expect(projection?.data).not.toHaveProperty('auditNote');
    expect(projection?.audience).toEqual(['ana']);
    expect(projection?.labels).toEqual({ companyId: 'Acme' });
    expect(projection?.parentKeys).toEqual(['companies/acme']);
    // O pai principal como campo simples: é por ele que o portal pede só os filhos do registro aberto.
    expect(projection?.parentKey).toBe('companies/acme');
  });

  it('carimba se a edição está aberta e quem criou pelo portal — só para desenhar o botão', async () => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, edit: { fields: ['amount'], when: 'status == "draft"' } } }
      : screen));
    const { write, projections } = setup(screens);
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', status: 'draft', createdBy: 'ana', createdVia: 'portal' });
    expect(projections.get('invoices__nf1')).toMatchObject({ editable: true, portalOwner: 'ana' });
    expect(projections.get('invoices__nf1')?.data).not.toHaveProperty('status');

    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', status: 'filed', createdBy: 'fiscal', createdVia: 'ui' });
    expect(projections.get('invoices__nf1')).toMatchObject({ editable: false, portalOwner: null });
  });

  it('o rótulo de referência só sai de tela do portal que expõe o título', async () => {
    const screens = CITY_SCREENS.map((screen) => {
      if (screen.id === 'invoices') {
        return {
          ...screen,
          fields: [...screen.fields, { key: 'inspectionId', label: 'Inspection', type: 'reference', refEntity: 'inspections', required: false }],
          portal: { ...screen.portal!, fields: [...screen.portal!.fields, 'inspectionId'] },
        };
      }
      return screen;
    }) as typeof CITY_SCREENS;
    const { write, projections, records } = setup(screens);
    records.set('inspections/i1', { title: 'Fiscal Joana — suspeita de fraude', companyId: 'acme' });
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', inspectionId: 'i1' });
    expect(projections.get('invoices__nf1')?.labels).toEqual({ companyId: 'Acme' });
  });

  it('ligar documentos traz os já compartilhados; desligar tira os que tinham saído', async () => {
    const withDocs = (documents: boolean) => CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, documents } }
      : screen));
    const off = setup(withDocs(false));
    off.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    off.documents.set('invoices/nf1/d1', { name: 'nota.pdf', portalShared: true, url: 'https://x' });
    await off.project.execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: off.records.get('invoices/nf1')! });
    expect(off.projectedDocuments.size).toBe(0);

    const on = makeProjectPortalRecordUseCase({ ...off.repo, getScreens: async () => withDocs(true) });
    await on.execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: off.records.get('invoices/nf1')!, syncDocuments: true });
    expect([...off.projectedDocuments.keys()]).toEqual(['invoices__nf1/d1']);

    await off.project.execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: off.records.get('invoices/nf1')!, syncDocuments: true });
    expect(off.projectedDocuments.size).toBe(0);
  });

  it('a coleção que não declara portal não é projetada', async () => {
    const { write, projections } = setup();
    expect(await write('inspections', 'i1', { title: 'Fiscalização', companyId: 'acme' })).toBe(false);
    expect(projections.size).toBe(0);
  });

  it('o registro que perde o vínculo some do portal', async () => {
    const { write, projections } = setup();
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    await write('invoices', 'nf1', { number: 'NF-1', companyId: null });
    expect(projections.has('invoices__nf1')).toBe(false);
  });

  it('o registro apagado some do portal', async () => {
    const { write, projections } = setup();
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    await write('invoices', 'nf1', null);
    expect(projections.has('invoices__nf1')).toBe(false);
  });

  it('o filho herda do pai — e muda de dono quando o pai muda', async () => {
    const { write, projections } = setup();
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    await write('invoiceItems', 'it1', { description: 'Serviço', invoiceId: 'nf1' });
    expect(projections.get('invoiceItems__it1')?.audience).toEqual(['ana']);
    expect(projections.get('invoiceItems__it1')?.parentKeys).toEqual(['invoices/nf1']);

    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'globex' });
    expect(projections.get('invoices__nf1')?.audience).toEqual(['bia']);
    expect(projections.get('invoiceItems__it1')?.audience).toEqual(['bia']);
  });
});

describe('vínculo para uma coleção com mais de uma tela', () => {
  it('o vínculo pela coleção chega à tela que está no portal, e não à âncora sem portal', async () => {
    const { write, projections } = setup(EXTENSION_CITY_SCREENS);
    await write('companies', 'acme', { name: 'Acme', taxId: '123' });
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    await write('invoiceItems', 'it1', { description: 'Serviço', invoiceId: 'nf1' });

    expect(projections.get('invoices__nf1')).toMatchObject({
      screenId: 'city_invoices',
      subjectKeys: ['companies/acme'],
      audience: ['ana'],
      labels: { companyId: 'Acme' },
      parentKeys: ['companies/acme'],
    });
    expect(projections.get('invoiceItems__it1')).toMatchObject({
      subjectKeys: ['companies/acme'],
      parentKeys: ['invoices/nf1'],
    });
  });

  it('o filho que aponta para a coleção muda de dono junto com o pai', async () => {
    const { write, projections } = setup(EXTENSION_CITY_SCREENS);
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    await write('invoiceItems', 'it1', { description: 'Serviço', invoiceId: 'nf1' });

    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'globex' });
    expect(projections.get('invoiceItems__it1')?.audience).toEqual(['bia']);
  });
});

describe('visibilidade por registro — visibleWhen', () => {
  const filtering = (screenId: string, visibleWhen: string) => CITY_SCREENS.map((screen) => (screen.id === screenId
    ? { ...screen, portal: { ...screen.portal!, visibleWhen } }
    : screen));

  it('só o registro que passa é projetado — e o que deixa de passar some', async () => {
    const { write, projections } = setup(filtering('invoices', 'kind == "revenue"'));
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', kind: 'revenue' });
    await write('invoices', 'nf2', { number: 'NF-2', companyId: 'acme', kind: 'expense' });
    expect(projections.has('invoices__nf1')).toBe(true);
    expect(projections.has('invoices__nf2')).toBe(false);
    expect(projections.get('invoices__nf1')?.data).not.toHaveProperty('kind');

    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', kind: 'expense' });
    expect(projections.has('invoices__nf1')).toBe(false);
  });

  it('o filho do registro escondido some junto — e volta com ele', async () => {
    const { write, projections } = setup(filtering('invoices', 'kind == "revenue"'));
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', kind: 'revenue' });
    await write('invoiceItems', 'it1', { description: 'Serviço', invoiceId: 'nf1' });
    expect(projections.has('invoiceItems__it1')).toBe(true);

    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', kind: 'expense' });
    expect(projections.has('invoiceItems__it1')).toBe(false);

    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', kind: 'revenue' });
    expect(projections.get('invoiceItems__it1')?.audience).toEqual(['ana']);
  });

  it('o filho pode ser filtrado sozinho — e o pai continua', async () => {
    const { write, projections } = setup(filtering('invoiceItems', 'internal != true'));
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    await write('invoiceItems', 'it1', { description: 'Serviço', invoiceId: 'nf1' });
    await write('invoiceItems', 'it2', { description: 'Correspondente', invoiceId: 'nf1', internal: true });
    expect(projections.has('invoices__nf1')).toBe(true);
    expect(projections.has('invoiceItems__it1')).toBe(true);
    expect(projections.has('invoiceItems__it2')).toBe(false);
  });

  it('na tela-sujeito, esconde o sujeito e tudo o que chega a ele', async () => {
    const { write, projections } = setup(filtering('companies', 'active == true'));
    await write('companies', 'acme', { name: 'Acme', active: true });
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    expect(projections.get('invoices__nf1')?.audience).toEqual(['ana']);

    await write('companies', 'acme', { name: 'Acme', active: false });
    expect(projections.has('companies__acme')).toBe(false);
    expect(projections.has('invoices__nf1')).toBe(false);
  });

  it('a condição inválida não projeta nada', async () => {
    const { write, projections } = setup(filtering('invoices', 'kind == '));
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme', kind: 'revenue' });
    expect(projections.has('invoices__nf1')).toBe(false);
  });
});

describe('audiência do portal', () => {
  it('convidar refaz quem vê, sem tocar no que é visto', async () => {
    const { write, projections, users, repo } = setup();
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });

    users.set('caio', { userId: 'caio', email: 'caio@acme.com', displayName: 'Caio', subjectKeys: ['companies/acme'] });
    const changed = await makeRefreshPortalAudienceUseCase(repo).execute(TENANT, ['companies/acme']);

    expect(changed).toBe(1);
    expect(projections.get('invoices__nf1')?.audience).toEqual(['ana', 'caio']);
  });

  it('revogar tira a pessoa do audience', async () => {
    const { write, projections, users, repo } = setup();
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    users.delete('ana');
    await makeRefreshPortalAudienceUseCase(repo).execute(TENANT, ['companies/acme']);
    expect(projections.get('invoices__nf1')?.audience).toEqual([]);
  });
});

describe('documento no portal', () => {
  it('sai só se compartilhado e se o registro já estiver no portal', async () => {
    const { write, repo, projectedDocuments } = setup();
    const projectDocument = makeProjectPortalDocumentUseCase(repo);
    const input = { tenantId: TENANT, collection: 'invoices', recordId: 'nf1', documentId: 'd1' };

    await projectDocument.execute({ ...input, data: { name: 'nota.pdf', portalShared: true } });
    expect(projectedDocuments.size).toBe(0);

    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    await projectDocument.execute({ ...input, data: { name: 'nota.pdf', portalShared: true } });
    expect(projectedDocuments.get('invoices__nf1/d1')?.name).toBe('nota.pdf');

    await projectDocument.execute({ ...input, data: { name: 'nota.pdf', portalShared: false } });
    expect(projectedDocuments.size).toBe(0);
  });
});

describe('igualdade da projeção gravada', () => {
  const stamp = (ms: number) => ({ ms, isEqual: (other: unknown) => (other as { ms?: number }).ms === ms });

  it('data como o Firestore devolve se compara pelo valor, e a chave com undefined vale ausente', () => {
    expect(samePortalValue({ at: stamp(1), note: undefined }, { at: stamp(1) })).toBe(true);
    expect(samePortalValue({ at: stamp(1) }, { at: stamp(2) })).toBe(false);
    expect(samePortalValue({ tags: ['a', 'b'] }, { tags: ['b', 'a'] })).toBe(false);
  });

  it('o campo que falta no documento gravado obriga a regravar, mesmo que o padrão dele seja igual', async () => {
    const fake = setup();
    await fake.write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    const stored = { ...fake.projections.get('invoices__nf1')! } as Record<string, unknown>;
    delete stored.parentKeys;
    let writes = 0;
    const repo = {
      ...fake.repo,
      getStoredProjection: async () => ({ projection: fake.projections.get('invoices__nf1')!, stored }),
      writeProjection: async (...args: Parameters<typeof fake.repo.writeProjection>) => {
        writes += 1;
        return fake.repo.writeProjection(...args);
      },
    };
    await makeProjectPortalRecordUseCase(repo).execute({
      tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: { number: 'NF-1', companyId: 'acme' },
    });
    expect(writes).toBe(1);
  });
});
