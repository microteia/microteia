import { describe, expect, it } from 'vitest';
import {
  PORTAL_LABEL_REFRESH_LIMIT,
  makeProjectPortalDocumentUseCase,
  makeProjectPortalRecordUseCase,
  makeRefreshPortalAudienceUseCase,
  makeRefreshPortalReferenceLabelsUseCase,
  samePortalValue,
} from './PortalProjectionUseCases';
import { CITY_SCREENS, EXTENSION_CITY_SCREENS, PUBLIC_CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import { makeFakeRecordDocumentLinks } from '../repositories/fakeRecordDocumentLinks';
import type { PortalScreen } from '../repositories/IPortalRepository';
import { PORTAL_PUBLIC_SUBJECT_KEY } from '../schema/portal';

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

describe('link curto de documento — a troca do token que pode ter saído', () => {
  const signed = (screens = CITY_SCREENS) => screens.map((screen) => (screen.id === 'invoices'
    ? {
      ...screen,
      fields: [...screen.fields, { key: 'receipt', label: 'Receipt', type: 'file' }],
      portal: { ...screen.portal!, fields: [...screen.portal!.fields, 'receipt'], documentLinks: { expiresInMinutes: 5 } },
    }
    : screen)) as typeof CITY_SCREENS;

  const setup = () => {
    const fake = makeFakePortalRepository(signed());
    fake.records.set('companies/acme', { name: 'Acme' });
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const files = makeFakeRecordDocumentLinks(fake.documents, TENANT);
    const project = makeProjectPortalRecordUseCase(fake.repo, files.links);
    const projectDocument = makeProjectPortalDocumentUseCase(fake.repo, files.links);
    return { ...fake, files, project, projectDocument };
  };
  const ref = (documentId: string) => ({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', documentId });

  it('a passada troca o token de todo documento que já foi compartilhado — inclusive o recolhido', async () => {
    const { documents, records, files, project } = setup();
    records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    files.attach('invoices', 'nf1', 'shared', { portalShared: true, portalSharedAt: 'antes' });
    files.attach('invoices', 'nf1', 'recolhido', { portalShared: false, portalSharedAt: 'antes' });
    files.attach('invoices', 'nf1', 'interno');
    const links = Object.fromEntries([...documents.entries()].map(([key, data]) => [key, String(data.url)]));

    await project.execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: records.get('invoices/nf1')!, syncDocuments: true });

    expect(files.opens(links['invoices/nf1/shared'])).toBe(false);
    expect(files.opens(links['invoices/nf1/recolhido'])).toBe(false);
    expect(files.opens(links['invoices/nf1/interno'])).toBe(true);
    expect(documents.get('invoices/nf1/interno')).toEqual(expect.objectContaining({ url: links['invoices/nf1/interno'] }));
    expect(files.opens(String(documents.get('invoices/nf1/shared')?.url))).toBe(true);
  });

  it('o registro que já não está no portal também tem o token trocado — o link guardado continuaria abrindo', async () => {
    const { documents, records, files, project } = setup();
    records.set('invoices/nf1', { number: 'NF-1', companyId: null });
    files.attach('invoices', 'nf1', 'd1', { portalShared: true, portalSharedAt: 'antes' });
    const before = String(documents.get('invoices/nf1/d1')?.url);
    await project.execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: records.get('invoices/nf1')!, syncDocuments: true });
    expect(files.opens(before)).toBe(false);
  });

  it('uma segunda passada não troca de novo: o token novo está selado', async () => {
    const { documents, records, files, project } = setup();
    records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    files.attach('invoices', 'nf1', 'd1', { portalShared: true, portalSharedAt: 'antes' });
    const input = { tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: records.get('invoices/nf1')!, syncDocuments: true };
    await project.execute(input);
    const rotated = String(documents.get('invoices/nf1/d1')?.url);
    await project.execute(input);
    expect(documents.get('invoices/nf1/d1')?.url).toBe(rotated);
  });

  it('a gravação comum do registro não troca nada — só a passada que a declaração abre', async () => {
    const { documents, records, files, project } = setup();
    records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    files.attach('invoices', 'nf1', 'd1', { portalShared: true, portalSharedAt: 'antes' });
    const before = String(documents.get('invoices/nf1/d1')?.url);
    await project.execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: records.get('invoices/nf1')! });
    expect(files.opens(before)).toBe(true);
  });

  it('a troca pendente é terminada com o MESMO token — duas trocas convergem', async () => {
    const { documents, files } = setup();
    files.attach('invoices', 'nf1', 'd1', { portalShared: true, portalSharedAt: 'antes', portalLinkSeal: 'escolhido' });
    await files.links.rotate(ref('d1'));
    expect(new URL(String(documents.get('invoices/nf1/d1')?.url)).searchParams.get('token')).toBe('escolhido');
  });

  it('compartilhado pela PRIMEIRA vez, o documento é selado sem troca — o token dele nunca saiu', async () => {
    const { documents, records, files, project, projectDocument } = setup();
    records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    await project.execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: records.get('invoices/nf1')! });
    files.attach('invoices', 'nf1', 'd1', { portalShared: true, portalSharedAt: 'agora' });
    const url = String(documents.get('invoices/nf1/d1')?.url);

    await projectDocument.execute({ ...ref('d1'), data: documents.get('invoices/nf1/d1')!, before: null });

    expect(documents.get('invoices/nf1/d1')?.url).toBe(url);
    expect(await files.links.pendingRotation(TENANT, 'invoices', 'nf1')).toEqual([]);
  });

  it('compartilhado DE NOVO, fica sem selo: o token pode ter saído antes, e a passada o troca', async () => {
    const { documents, files, projectDocument } = setup();
    files.attach('invoices', 'nf1', 'd1', { portalShared: true, portalSharedAt: 'agora' });
    await projectDocument.execute({
      ...ref('d1'), data: documents.get('invoices/nf1/d1')!, before: { portalShared: false, portalSharedAt: 'antes' },
    });
    expect(await files.links.pendingRotation(TENANT, 'invoices', 'nf1')).toEqual(['d1']);
  });

  it('o valor do campo de arquivo exposto não sai: ele é um link permanente', async () => {
    const { projections, records, project } = setup();
    records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme', receipt: 'https://files.test/x?token=t' });
    await project.execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: records.get('invoices/nf1')! });
    expect(projections.get('invoices__nf1')?.data).toEqual({ number: 'NF-1', companyId: 'acme' });
  });

  it('sem a declaração, nada muda: nem selo, nem troca, e o campo de arquivo sai como antes', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? {
        ...screen,
        fields: [...screen.fields, { key: 'receipt', label: 'Receipt', type: 'file' }],
        portal: { ...screen.portal!, fields: [...screen.portal!.fields, 'receipt'] },
      }
      : screen)) as typeof CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const files = makeFakeRecordDocumentLinks(fake.documents, TENANT);
    files.attach('invoices', 'nf1', 'd1', { portalShared: true, portalSharedAt: 'antes' });
    const document = { ...fake.documents.get('invoices/nf1/d1') };
    const data = { number: 'NF-1', companyId: 'acme', receipt: 'https://files.test/x?token=t' };
    fake.records.set('invoices/nf1', data);

    await makeProjectPortalRecordUseCase(fake.repo, files.links)
      .execute({ tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data, syncDocuments: true });
    await makeProjectPortalDocumentUseCase(fake.repo, files.links)
      .execute({ ...ref('d1'), data: fake.documents.get('invoices/nf1/d1')!, before: null });

    expect(fake.documents.get('invoices/nf1/d1')).toEqual(document);
    expect(fake.projections.get('invoices__nf1')?.data).toEqual(expect.objectContaining({ receipt: data.receipt }));
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

/**
 * O domicílio aponta para o contribuinte, cuja tela NÃO vai ao portal (CPF, endereço, celular). O
 * título do domicílio é essa referência. A extensão de origem traz a tela com `dataCollection`, e a
 * instalação grava a âncora com o nome da coleção — listada antes, sem campos, com o título copiado.
 */
const TAXPAYER_SCREENS: PortalScreen[] = [
  {
    id: 'taxpayers', collection: 'taxpayers', titleFieldKey: 'name', titleSingular: 'taxpayers', titlePlural: 'taxpayers',
    icon: 'table', fields: [], portal: null,
  },
  {
    id: 'dte_taxpayers',
    collection: 'taxpayers',
    titleFieldKey: 'name',
    titleSingular: 'Taxpayer',
    titlePlural: 'Taxpayers',
    icon: 'user',
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'taxId', label: 'Tax id', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
    ],
    portal: null,
  },
  ...CITY_SCREENS,
  {
    id: 'registrations',
    collection: 'registrations',
    titleFieldKey: 'holderId',
    titleSingular: 'Registration',
    titlePlural: 'Registrations',
    icon: 'mail',
    fields: [
      { key: 'holderId', label: 'Holder', type: 'reference', refEntity: 'taxpayers' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'companyId', label: 'Company', type: 'reference', refEntity: 'companies' },
    ],
    portal: { subject: { field: 'companyId' }, fields: ['holderId', 'status'], referenceTitles: ['holderId'] },
  },
];

const withRegistrationPortal = (portal: Partial<NonNullable<PortalScreen['portal']>>) =>
  TAXPAYER_SCREENS.map((screen) => (screen.id === 'registrations' ? { ...screen, portal: { ...screen.portal!, ...portal } } : screen));

describe('nome de referência para tela fora do portal — referenceTitles (EV-24)', () => {
  const setupTaxpayers = (screens = TAXPAYER_SCREENS) => {
    const env = setup(screens);
    env.records.set('taxpayers/t1', { name: 'Maria Souza', taxId: '111.222.333-44', phone: '71 9999-0000' });
    const started: string[][] = [];
    const refresh = makeRefreshPortalReferenceLabelsUseCase(env.repo, env.project, {
      execute: async (_tenant, collections) => { started.push([...collections]); },
    });
    const rename = async (collection: string, id: string, data: Record<string, unknown> | null) => {
      const before = env.records.get(`${collection}/${id}`) ?? null;
      await env.write(collection, id, data);
      return refresh.execute({ tenantId: TENANT, collection, recordId: id, before, after: data });
    };
    return { ...env, started, rename };
  };

  it('a referência declarada leva só o TÍTULO do apontado — e ele vira o título do registro', async () => {
    const { write, projections } = setupTaxpayers();
    await write('registrations', 'd1', { holderId: 't1', status: 'active', companyId: 'acme' });

    const projection = projections.get('registrations__d1');
    expect(projection?.title).toBe('Maria Souza');
    expect(projection?.labels).toEqual({ holderId: 'Maria Souza' });
    expect(JSON.stringify(projection)).not.toContain('111.222.333-44');
    expect(JSON.stringify(projection)).not.toContain('9999');
  });

  it('sem a declaração, o nome não sai — e o título fica vazio, nunca o id', async () => {
    const { write, projections } = setupTaxpayers(withRegistrationPortal({ referenceTitles: null }));
    await write('registrations', 'd1', { holderId: 't1', status: 'active', companyId: 'acme' });

    const projection = projections.get('registrations__d1');
    expect(projection?.title).toBe('');
    expect(projection?.labels).toEqual({});
    expect(projection?.data).toEqual({ holderId: 't1', status: 'active' });
  });

  it('declarado num campo que não está exposto, nada sai', async () => {
    const { write, projections } = setupTaxpayers(withRegistrationPortal({ fields: ['status'] }));
    await write('registrations', 'd1', { holderId: 't1', status: 'active', companyId: 'acme' });

    const projection = projections.get('registrations__d1');
    expect(projection?.title).toBe('');
    expect(projection?.labels).toEqual({});
  });

  it('o título que é referência a uma tela do portal usa o título que ela já expõe, sem declaração', async () => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices' ? { ...screen, titleFieldKey: 'companyId' } : screen));
    const { write, projections } = setup(screens);
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    expect(projections.get('invoices__nf1')?.title).toBe('Acme');
  });

  it('o apontado cujo título é outra referência não vira id no rótulo', async () => {
    const screens = TAXPAYER_SCREENS.map((screen) => (screen.id === 'dte_taxpayers'
      ? { ...screen, titleFieldKey: 'guardianId', fields: [...screen.fields, { key: 'guardianId', label: 'Guardian', type: 'reference', refEntity: 'taxpayers' }] }
      : screen));
    const { write, records, projections } = setupTaxpayers(screens);
    records.set('taxpayers/t1', { name: 'Maria Souza', guardianId: 't2' });
    await write('registrations', 'd1', { holderId: 't1', companyId: 'acme' });
    expect(projections.get('registrations__d1')).toMatchObject({ title: '', labels: { holderId: '' } });
  });

  it('renomear o apontado refaz o rótulo e o título de quem o mostra', async () => {
    const { write, rename, projections } = setupTaxpayers();
    await write('registrations', 'd1', { holderId: 't1', status: 'active', companyId: 'acme' });
    await write('registrations', 'd2', { holderId: 't1', status: 'closed', companyId: 'acme' });

    const refreshed = await rename('taxpayers', 't1', { name: 'Maria S. Lima', taxId: '111.222.333-44' });
    expect(refreshed).toBe(2);
    expect(projections.get('registrations__d1')).toMatchObject({ title: 'Maria S. Lima', labels: { holderId: 'Maria S. Lima' } });
    expect(projections.get('registrations__d2')?.title).toBe('Maria S. Lima');
  });

  it('gravar o apontado sem mudar o título não relê quem aponta para ele', async () => {
    const { write, rename } = setupTaxpayers();
    await write('registrations', 'd1', { holderId: 't1', companyId: 'acme' });
    expect(await rename('taxpayers', 't1', { name: 'Maria Souza', phone: '71 0000-1111' })).toBe(0);
  });

  it('o rótulo de uma tela do portal também acompanha o nome — a empresa renomeada', async () => {
    const { write, rename, projections } = setupTaxpayers();
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    await rename('companies', 'acme', { name: 'Acme Ltda', taxId: '123' });
    expect(projections.get('invoices__nf1')?.labels).toEqual({ companyId: 'Acme Ltda' });
  });

  it('apagar o apontado tira o nome — sem deixar o id no lugar', async () => {
    const { write, rename, projections } = setupTaxpayers();
    await write('registrations', 'd1', { holderId: 't1', companyId: 'acme' });
    await rename('taxpayers', 't1', null);
    expect(projections.get('registrations__d1')).toMatchObject({ title: '', labels: { holderId: '' } });
  });

  it('acima do teto, a coleção de quem aponta ganha uma passada em vez de uma invocação sem tamanho', async () => {
    const { records, rename, started } = setupTaxpayers();
    for (let index = 0; index <= PORTAL_LABEL_REFRESH_LIMIT; index += 1) {
      records.set(`registrations/d${index}`, { holderId: 't1', companyId: 'acme' });
    }
    expect(await rename('taxpayers', 't1', { name: 'Maria S. Lima' })).toBe(0);
    expect(started).toEqual([['registrations']]);
  });

  it('a coleção que ninguém mostra não lê nada', async () => {
    const { rename, started } = setupTaxpayers();
    expect(await rename('companies', 'acme', { name: 'Acme', taxId: '999' })).toBe(0);
    expect(started).toEqual([]);
  });
});

/**
 * A comunicação aponta para o domicílio, que está no portal e tem por título o contribuinte — outra
 * referência, a uma tela FORA do portal, cujo nome o domicílio já mostra por `referenceTitles`.
 */
const DOMICILE_SCREENS: PortalScreen[] = [
  ...TAXPAYER_SCREENS.filter((screen) => screen.collection === 'taxpayers'),
  {
    id: 'domiciles',
    collection: 'domiciles',
    titleFieldKey: 'holderId',
    titleSingular: 'Domicile',
    titlePlural: 'Domiciles',
    icon: 'home',
    fields: [
      { key: 'holderId', label: 'Holder', type: 'reference', refEntity: 'taxpayers' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
    portal: { subject: 'self', fields: ['holderId', 'status'], referenceTitles: ['holderId'] },
  },
  {
    id: 'notices',
    collection: 'notices',
    titleFieldKey: 'subject',
    titleSingular: 'Notice',
    titlePlural: 'Notices',
    icon: 'mail',
    fields: [
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'domicileId', label: 'Domicile', type: 'reference', refEntity: 'domiciles' },
    ],
    portal: { subject: { field: 'domicileId' }, fields: ['subject', 'domicileId'] },
  },
];

const withScreen = (screens: PortalScreen[], id: string, patch: (screen: PortalScreen) => PortalScreen) =>
  screens.map((screen) => (screen.id === id ? patch(screen) : screen));

describe('referência a um registro cujo título é outra referência (EV-40)', () => {
  const setupDomiciles = (screens = DOMICILE_SCREENS) => {
    const env = setup(screens);
    env.users.set('carla', { userId: 'carla', email: 'carla@x.com', displayName: 'Carla', subjectKeys: ['domiciles/dom1'] });
    env.records.set('taxpayers/t1', { name: 'Maria Souza', taxId: '111.222.333-44', phone: '71 9999-0000' });
    env.records.set('taxpayers/t2', { name: 'João Lima', taxId: '555.666.777-88' });
    const started: string[][] = [];
    const refresh = makeRefreshPortalReferenceLabelsUseCase(env.repo, env.project, {
      execute: async (_tenant, collections) => { started.push([...collections]); },
    });
    const change = async (collection: string, id: string, data: Record<string, unknown> | null) => {
      const before = env.records.get(`${collection}/${id}`) ?? null;
      await env.write(collection, id, data);
      return refresh.execute({ tenantId: TENANT, collection, recordId: id, before, after: data });
    };
    return { ...env, started, change };
  };

  it('a comunicação mostra o domicílio pelo nome que ele mesmo mostra — o do titular', async () => {
    const { write, projections } = setupDomiciles();
    await write('domiciles', 'dom1', { holderId: 't1', status: 'active' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });

    expect(projections.get('domiciles__dom1')?.title).toBe('Maria Souza');
    const notice = projections.get('notices__n1');
    expect(notice).toMatchObject({ title: 'Intimação', labels: { domicileId: 'Maria Souza' }, audience: ['carla'] });
    expect(JSON.stringify(notice)).not.toContain('111.222.333-44');
  });

  it('o título que é a referência ao domicílio também ganha o nome', async () => {
    const screens = withScreen(DOMICILE_SCREENS, 'notices', (screen) => ({ ...screen, titleFieldKey: 'domicileId' }));
    const { write, projections } = setupDomiciles(screens);
    await write('domiciles', 'dom1', { holderId: 't1' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });
    expect(projections.get('notices__n1')?.title).toBe('Maria Souza');
  });

  it('o domicílio que não expõe o próprio título não o empresta a quem aponta para ele', async () => {
    const screens = withScreen(DOMICILE_SCREENS, 'domiciles', (screen) => ({
      ...screen, portal: { subject: 'self', fields: ['status'] },
    }));
    const { write, projections } = setupDomiciles(screens);
    await write('domiciles', 'dom1', { holderId: 't1', status: 'active' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });
    expect(projections.get('notices__n1')?.labels).toEqual({ domicileId: '' });
  });

  it('o domicílio sem `referenceTitles` não tem nome a mostrar, e a comunicação também não', async () => {
    const screens = withScreen(DOMICILE_SCREENS, 'domiciles', (screen) => ({
      ...screen, portal: { ...screen.portal!, referenceTitles: null },
    }));
    const { write, projections } = setupDomiciles(screens);
    await write('domiciles', 'dom1', { holderId: 't1' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });
    expect(projections.get('domiciles__dom1')?.title).toBe('');
    expect(projections.get('notices__n1')?.labels).toEqual({ domicileId: '' });
  });

  it('declarada na comunicação, a referência leva o título do domicílio como o escritório o lê', async () => {
    const screens = withScreen(DOMICILE_SCREENS, 'domiciles', (screen) => ({
      ...screen, portal: { subject: 'self', fields: ['status'] },
    })).map((screen) => (screen.id === 'notices' ? { ...screen, portal: { ...screen.portal!, referenceTitles: ['domicileId'] } } : screen));
    const { write, projections } = setupDomiciles(screens);
    await write('domiciles', 'dom1', { holderId: 't1' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });
    expect(projections.get('notices__n1')?.labels).toEqual({ domicileId: 'Maria Souza' });
  });

  it('só um salto a mais: o titular cujo título é outra referência não vira id', async () => {
    const screens = withScreen(DOMICILE_SCREENS, 'dte_taxpayers', (screen) => ({
      ...screen,
      titleFieldKey: 'guardianId',
      fields: [...screen.fields, { key: 'guardianId', label: 'Guardian', type: 'reference', refEntity: 'taxpayers' }],
    }));
    const { write, records, projections } = setupDomiciles(screens);
    records.set('taxpayers/t1', { name: 'Maria Souza', guardianId: 't2' });
    await write('domiciles', 'dom1', { holderId: 't1' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });
    expect(projections.get('notices__n1')?.labels).toEqual({ domicileId: '' });
  });

  it('renomear o titular refaz o domicílio e as comunicações que apontam para ele', async () => {
    const { write, change, projections } = setupDomiciles();
    await write('domiciles', 'dom1', { holderId: 't1' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });
    await write('notices', 'n2', { subject: 'Aviso', domicileId: 'dom1' });

    expect(await change('taxpayers', 't1', { name: 'Maria S. Lima', taxId: '111.222.333-44' })).toBe(3);
    expect(projections.get('domiciles__dom1')?.title).toBe('Maria S. Lima');
    expect(projections.get('notices__n1')?.labels).toEqual({ domicileId: 'Maria S. Lima' });
    expect(projections.get('notices__n2')?.labels).toEqual({ domicileId: 'Maria S. Lima' });
  });

  it('trocar o titular do domicílio refaz as comunicações dele', async () => {
    const { write, change, projections } = setupDomiciles();
    await write('domiciles', 'dom1', { holderId: 't1' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });

    expect(await change('domiciles', 'dom1', { holderId: 't2' })).toBe(1);
    expect(projections.get('notices__n1')?.labels).toEqual({ domicileId: 'João Lima' });
  });

  it('gravar o domicílio sem trocar o titular, ou o titular sem mudar o nome, não relê ninguém', async () => {
    const { write, change } = setupDomiciles();
    await write('domiciles', 'dom1', { holderId: 't1', status: 'active' });
    await write('notices', 'n1', { subject: 'Intimação', domicileId: 'dom1' });
    expect(await change('domiciles', 'dom1', { holderId: 't1', status: 'closed' })).toBe(0);
    expect(await change('taxpayers', 't1', { name: 'Maria Souza', phone: '71 0000-1111' })).toBe(0);
  });

  it('acima do teto pelo segundo salto, a coleção das comunicações ganha uma passada', async () => {
    const { records, change, started } = setupDomiciles();
    records.set('domiciles/dom1', { holderId: 't1' });
    for (let index = 0; index <= PORTAL_LABEL_REFRESH_LIMIT; index += 1) {
      records.set(`notices/n${index}`, { subject: `Aviso ${index}`, domicileId: 'dom1' });
    }
    expect(await change('taxpayers', 't1', { name: 'Maria S. Lima' })).toBe(1);
    expect(started).toEqual([['notices']]);
  });

  it('o teto vale também para o registro do meio — o titular de muitos domicílios', async () => {
    const { records, change, started } = setupDomiciles();
    for (let index = 0; index <= PORTAL_LABEL_REFRESH_LIMIT; index += 1) {
      records.set(`domiciles/dom${index}`, { holderId: 't1' });
    }
    await change('taxpayers', 't1', { name: 'Maria S. Lima' });
    expect(started).toEqual([['domiciles', 'notices']]);
  });
});

describe('registro público — subject: public (EV-43)', () => {
  it('sai para todo convidado sem lista de uids: `public`, `audience` vazio e o sujeito que nenhum convite tem', async () => {
    const { write, projections } = setup(PUBLIC_CITY_SCREENS);
    await write('outages', 'o1', { description: 'Sistema fora do ar das 8h às 10h', kind: 'outage', companyId: 'acme', internalTicket: 'INC-9' });

    expect(projections.get('outages__o1')).toMatchObject({
      public: true,
      audience: [],
      subjectKeys: [PORTAL_PUBLIC_SUBJECT_KEY],
      data: { description: 'Sistema fora do ar das 8h às 10h', companyId: 'acme' },
      parentKeys: [],
      parentKey: '',
      editable: false,
    });
    // O título da empresa é dos convidados DELA: numa tela pública, sairia para todos.
    expect(projections.get('outages__o1')?.labels).toEqual({});
  });

  it('a projeção que não é pública não ganha o campo — e não é regravada por ele', async () => {
    const { write, projections } = setup(PUBLIC_CITY_SCREENS);
    await write('invoices', 'nf1', { number: 'NF-1', companyId: 'acme' });
    expect(projections.get('invoices__nf1')).not.toHaveProperty('public');
  });

  it('o filtro continua escolhendo as linhas: o que deixa de passar some', async () => {
    const { write, projections } = setup(PUBLIC_CITY_SCREENS);
    await write('outages', 'o1', { description: 'Manutenção', kind: 'outage' });
    expect(projections.has('outages__o1')).toBe(true);
    await write('outages', 'o1', { description: 'Manutenção', kind: 'internal' });
    expect(projections.has('outages__o1')).toBe(false);
  });

  it('não se propaga: a filha de um registro público não chega a convidado nenhum', async () => {
    const { write, projections } = setup(PUBLIC_CITY_SCREENS);
    await write('outages', 'o1', { description: 'Manutenção', kind: 'outage' });
    await write('outageNotes', 'n1', { text: 'Detalhe interno', outageId: 'o1' });
    expect(projections.has('outageNotes__n1')).toBe(false);
  });

  it('convidar alguém não refaz o público: ele não depende de convite', async () => {
    const { write, projections, users, repo } = setup(PUBLIC_CITY_SCREENS);
    await write('outages', 'o1', { description: 'Manutenção', kind: 'outage' });
    users.set('caio', { userId: 'caio', email: 'caio@acme.com', displayName: 'Caio', subjectKeys: ['companies/acme'] });
    await makeRefreshPortalAudienceUseCase(repo).execute(TENANT, ['companies/acme']);
    expect(projections.get('outages__o1')?.audience).toEqual([]);
  });
});
