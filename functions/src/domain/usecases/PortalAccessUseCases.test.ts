import { describe, expect, it, vi } from 'vitest';
import {
  makeGetPortalContextUseCase,
  makeGetPortalDocumentUrlUseCase,
  makeInvitePortalUserUseCase,
  makeSubmitPortalRecordUseCase,
  makeAttachPortalDocumentUseCase,
  makeUpdatePortalRecordUseCase,
} from './PortalAccessUseCases';
import { makeProjectPortalRecordUseCase } from './PortalProjectionUseCases';
import { CITY_SCREENS, EXTENSION_CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import type { IPortalAccountService, PortalScreen } from '../repositories/IPortalRepository';

const TENANT = 'salvador';

const accountsWith = (existing: Record<string, string> = {}) => {
  const order: string[] = [];
  const accounts: IPortalAccountService = {
    findUserIdByEmail: vi.fn(async (email: string) =>
      (existing[email] ? { userId: existing[email], displayName: null } : null)),
    createAccount: vi.fn(async (email: string) => {
      order.push(`create:${email}`);
      return `uid-${email}`;
    }),
  };
  return { accounts, order };
};

describe('convite do portal', () => {
  it('grava a marca ANTES de criar a conta — é o que impede o bootstrap de abrir um escritório', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts, order } = accountsWith();
    const markInvite = fake.repo.markInvite;
    fake.repo.markInvite = async (email, tenantId) => {
      order.push(`mark:${email}`);
      await markInvite(email, tenantId);
    };

    const result = await makeInvitePortalUserUseCase(fake.repo, accounts).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: ' Ana@Acme.com ', subjectKey: 'companies/acme', invitedBy: 'fiscal',
    });

    expect(order).toEqual(['mark:ana@acme.com', 'create:ana@acme.com']);
    expect(result).toEqual({ userId: 'uid-ana@acme.com', created: true });
    expect(fake.users.get('uid-ana@acme.com')?.subjectKeys).toEqual(['companies/acme']);
  });

  it('o convite guarda o idioma de quem convidou — o do portal enquanto ninguém escolher outro', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const grant = vi.spyOn(fake.repo, 'grantSubject');
    const { accounts } = accountsWith({ 'ana@acme.com': 'ana' });

    await makeInvitePortalUserUseCase(fake.repo, accounts).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', subjectKey: 'companies/acme', invitedBy: 'fiscal', locale: 'pt-BR',
    });

    expect(grant).toHaveBeenCalledWith(TENANT, expect.objectContaining({ locale: 'pt-BR' }), 'companies/acme');
  });

  it('quem já tem conta é só vinculado', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    const { accounts } = accountsWith({ 'ana@acme.com': 'ana' });

    const result = await makeInvitePortalUserUseCase(fake.repo, accounts).execute({
      tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', subjectKey: 'companies/acme', invitedBy: 'fiscal',
    });

    expect(result.created).toBe(false);
    expect(accounts.createAccount).not.toHaveBeenCalled();
    expect(fake.invites).toEqual([]);
  });

  it('recusa sujeito que não é de uma tela-sujeito, ou que não existe', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('invoices/nf1', { number: 'NF-1' });
    const { accounts } = accountsWith();
    const invite = makeInvitePortalUserUseCase(fake.repo, accounts);
    const base = { tenantId: TENANT, tenantName: 'Salvador', email: 'ana@acme.com', invitedBy: 'fiscal' };

    await expect(invite.execute({ ...base, subjectKey: 'invoices/nf1' })).rejects.toThrow('@core.tenant/portal.subject.invalid');
    await expect(invite.execute({ ...base, subjectKey: 'companies/missing' })).rejects.toThrow('@core.tenant/portal.subject.invalid');
    await expect(invite.execute({ ...base, email: 'sem-arroba', subjectKey: 'companies/acme' })).rejects.toThrow('@core.tenant/portal.email.invalid');
  });
});

describe('documento compartilhado', () => {
  const setup = async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.records.set('companies/acme', { name: 'Acme' });
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.users.set('bia', { userId: 'bia', email: 'bia@globex.com', displayName: 'Bia', subjectKeys: ['companies/globex'] });
    fake.records.set('invoices/nf1', { number: 'NF-1', companyId: 'acme' });
    await makeProjectPortalRecordUseCase(fake.repo).execute({
      tenantId: TENANT, collection: 'invoices', recordId: 'nf1', data: { number: 'NF-1', companyId: 'acme' },
    });
    fake.documents.set('invoices/nf1/d1', { name: 'nota.pdf', url: 'https://files/nota.pdf', portalShared: true });
    fake.documents.set('invoices/nf1/d2', { name: 'interno.pdf', url: 'https://files/interno.pdf', portalShared: false });
    return { fake, url: makeGetPortalDocumentUrlUseCase(fake.repo) };
  };

  it('entrega a URL a quem está no audience, só do documento compartilhado', async () => {
    const { url } = await setup();
    const input = { tenantId: TENANT, userId: 'ana', projectionId: 'invoices__nf1' };
    expect(await url.execute({ ...input, documentId: 'd1' })).toBe('https://files/nota.pdf');
    await expect(url.execute({ ...input, documentId: 'd2' })).rejects.toThrow('@core.tenant/portal.document.unavailable');
  });

  it('recusa quem é de outra empresa, com a mesma resposta', async () => {
    const { url } = await setup();
    await expect(url.execute({ tenantId: TENANT, userId: 'bia', projectionId: 'invoices__nf1', documentId: 'd1' }))
      .rejects.toThrow('@core.tenant/portal.document.unavailable');
  });
});

describe('contexto do portal', () => {
  it('só as telas do portal, e só com os campos expostos', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });

    const context = await makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value.toUpperCase(),
    });

    expect(context.screens.map((screen) => screen.id)).toEqual(['companies', 'invoices', 'invoiceItems']);
    const invoices = context.screens.find((screen) => screen.id === 'invoices');
    expect(invoices?.fields.map((field) => field.key)).toEqual(['number', 'amount', 'companyId']);
    expect(invoices?.titlePlural).toBe('INVOICES');
    expect(invoices?.parent).toEqual({ collection: 'companies' });
    expect(context.screens.find((screen) => screen.id === 'companies')?.parent).toBeNull();
  });

  it('entrega só as views de extensão de coleções expostas', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const view = (collection: string) => ({ pluginId: 'com.acme', viewKey: `v-${collection}`, collection, surface: 'list' as const, source: 'x' });

    const context = await makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value,
      extensionViews: { views: [view('invoices'), view('inspections')], bundles: [{ locale: 'pt-BR', namespace: 'com.acme', messages: {} }] },
    });

    expect(context.views.map((one) => one.collection)).toEqual(['invoices']);
    expect(context.bundles).toHaveLength(1);
  });

  it('entrega os temas instalados, mesmo sem view de extensão', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const theme = { id: 'indigo', point: 'theme.definition', apiVersion: '1.0.0', pluginId: 'com.acme.theme', metadata: { id: 'indigo', name: 'Indigo', extends: 'dark' } };

    const context = await makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value,
      themes: [theme],
    });

    expect(context.views).toEqual([]);
    expect(context.themes).toEqual([theme]);
  });

  it('monta o menu: telas de topo e páginas de extensão, na ordem e sem o que o escritório escondeu', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.homeSettings.welcome = 'Bem-vindo';
    fake.homeSettings.menu = { order: ['page.com.acme.statement'], hidden: ['page.com.acme.hidden'] };
    const page = (key: string, order?: number) => ({
      pluginId: 'com.acme', viewKey: key, key, title: `@com.acme/${key}`, icon: 'file', surface: 'page' as const, source: 'x', order,
    });

    const context = await makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value.toUpperCase(),
      extensionViews: {
        views: [
          page('statement', 50), page('hidden'), page('schedule', 1),
          { pluginId: 'com.acme', viewKey: 'w', key: 'pending', surface: 'widget' as const, source: 'x' },
        ],
        bundles: [],
      },
    });

    // As notas e os itens têm pai exposto: não são raiz. A página que o escritório ordenou vem primeiro.
    expect(context.home.menu.map((entry) => entry.id)).toEqual(['page.com.acme.statement', 'companies', 'page.com.acme.schedule']);
    expect(context.home.menu[0]).toMatchObject({ kind: 'page', title: '@COM.ACME/STATEMENT', viewKey: 'statement' });
    expect(context.home.widgets.map((entry) => entry.id)).toEqual(['com.acme.pending']);
    expect(context.home.welcome).toBe('Bem-vindo');
    expect(context.home.view).toBeNull();
  });

  describe('opções de lista', () => {
    const select = (key: string, extra: Partial<PortalScreen['fields'][number]> = {}) =>
      ({ key, label: key, type: 'select', ...extra });
    const screensWith = (fields: PortalScreen['fields'], portal: NonNullable<PortalScreen['portal']>) =>
      CITY_SCREENS.map((screen) => (screen.id === 'invoices'
        ? { ...screen, fields: [...screen.fields, ...fields], portal: { ...screen.portal!, ...portal } }
        : screen));
    const contextOf = async (fake: ReturnType<typeof makeFakePortalRepository>) => {
      fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
      const context = await makeGetPortalContextUseCase(fake.repo).execute({
        tenantId: TENANT, userId: 'ana', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value.toUpperCase(),
      });
      return context.screens.find((screen) => screen.id === 'invoices')!;
    };

    it('o campo exposto leva as opções da lista do escritório, com rótulo traduzido e cor', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'invoiceKinds' })],
        { subject: { field: 'companyId' }, fields: ['number', 'kind'] },
      ));
      fake.lookups.set('invoiceKinds', [{ key: 'service', label: '@acme/kind.service', color: 'success' }, { key: 'goods', label: 'Goods' }]);

      const invoices = await contextOf(fake);

      expect(invoices.fields.find((field) => field.key === 'kind')?.options).toEqual([
        { key: 'service', label: '@ACME/KIND.SERVICE', color: 'success' },
        { key: 'goods', label: 'GOODS' },
      ]);
    });

    it('criar e alterar levam as opções também — inclusive de campo que só se preenche', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'invoiceKinds' }), select('presence', { lookupCollection: 'presences' })],
        { subject: { field: 'companyId' }, fields: ['number', 'presence'], create: { fields: ['kind'] }, edit: { fields: ['presence'] } },
      ));
      fake.lookups.set('invoiceKinds', [{ key: 'service', label: 'Service' }]);
      fake.lookups.set('presences', [{ key: 'online', label: 'Online' }]);

      const invoices = await contextOf(fake);

      expect(invoices.create?.fields.find((field) => field.key === 'kind')?.options).toEqual([{ key: 'service', label: 'SERVICE' }]);
      expect(invoices.edit?.fields.find((field) => field.key === 'presence')?.options).toEqual([{ key: 'online', label: 'ONLINE' }]);
    });

    it('só as listas dos campos expostos são lidas', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'invoiceKinds' }), select('risk', { lookupCollection: 'riskLevels' })],
        { subject: { field: 'companyId' }, fields: ['number', 'kind'] },
      ));
      const read = vi.spyOn(fake.repo, 'getLookupOptions');

      await contextOf(fake);

      expect(read.mock.calls.map(([, collection]) => collection)).toEqual(['invoiceKinds']);
    });

    it('nunca lê como lista a coleção de uma tela, nem uma do sistema', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'inspections' }), select('who', { lookupCollection: 'portalUsers' })],
        { subject: { field: 'companyId' }, fields: ['number', 'kind', 'who'] },
      ));
      const read = vi.spyOn(fake.repo, 'getLookupOptions');

      const invoices = await contextOf(fake);

      expect(read).not.toHaveBeenCalled();
      expect(invoices.fields.find((field) => field.key === 'kind')?.options).toBeUndefined();
    });

    it('as declaradas no campo vêm antes, e a cor delas só sai em lista colorida', async () => {
      const declared = [{ key: 'urgent', label: 'Urgent', color: 'danger' }];
      const fake = makeFakePortalRepository(screensWith(
        [
          select('kind', { lookupCollection: 'invoiceKinds', options: declared }),
          select('flag', { options: declared, optionsColored: true }),
        ],
        { subject: { field: 'companyId' }, fields: ['number', 'kind', 'flag'] },
      ));
      fake.lookups.set('invoiceKinds', [{ key: 'urgent', label: 'Repetida' }, { key: 'normal', label: 'Normal' }]);

      const invoices = await contextOf(fake);

      expect(invoices.fields.find((field) => field.key === 'kind')?.options).toEqual([
        { key: 'urgent', label: 'URGENT' },
        { key: 'normal', label: 'NORMAL' },
      ]);
      expect(invoices.fields.find((field) => field.key === 'flag')?.options).toEqual([{ key: 'urgent', label: 'URGENT', color: 'danger' }]);
    });

    it('a lista do kernel leva só o que está gravado — o kernel não traz opção nenhuma', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('docType', { lookupCollection: 'documentTypes' })],
        { subject: { field: 'companyId' }, fields: ['number', 'docType'] },
      ));

      expect((await contextOf(fake)).fields.find((field) => field.key === 'docType')?.options).toBeUndefined();

      fake.lookups.set('documentTypes', [{ key: 'Invoice', label: 'Invoice' }]);
      expect((await contextOf(fake)).fields.find((field) => field.key === 'docType')?.options)
        .toEqual([{ key: 'Invoice', label: 'INVOICE' }]);
    });

    it('a lista que falha ao ser lida não derruba o portal', async () => {
      const fake = makeFakePortalRepository(screensWith(
        [select('kind', { lookupCollection: 'invoiceKinds' })],
        { subject: { field: 'companyId' }, fields: ['number', 'kind'] },
      ));
      vi.spyOn(fake.repo, 'getLookupOptions').mockRejectedValue(new Error('unavailable'));

      const invoices = await contextOf(fake);

      expect(invoices.fields.find((field) => field.key === 'kind')?.options).toBeUndefined();
    });
  });

  it('quem não é convidado não recebe nada', async () => {
    const fake = makeFakePortalRepository(CITY_SCREENS);
    await expect(makeGetPortalContextUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'intruso', tenant: { name: 'Salvador', logoURL: null }, locale: 'pt-BR', resolve: (value) => value,
    })).rejects.toThrow('@core.tenant/portal.not-invited');
  });
});

describe('o convidado cria um registro', () => {
  const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
    ? { ...screen, portal: { ...screen.portal!, create: { fields: ['number', 'amount'] } } }
    : screen));

  const setup = () => {
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const written: Array<{ collection: string; data: Record<string, unknown>; userId: string }> = [];
    const write = vi.fn(async (input: { collection: string; data: Record<string, unknown>; userId: string }) => {
      written.push(input);
      return { ok: true as const, id: 'new-1' };
    });
    return { fake, written, submit: makeSubmitPortalRecordUseCase(fake.repo, write) };
  };

  it('grava só os campos preenchíveis, com o vínculo carimbado pelo servidor', async () => {
    const { submit, written } = setup();
    const result = await submit.execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'acme',
      data: { number: 'NF-9', amount: 50, auditNote: 'forjado', companyId: 'globex' },
    });
    expect(result).toEqual({ id: 'new-1' });
    expect(written[0]).toEqual({ tenantId: TENANT, collection: 'invoices', userId: 'ana', data: { number: 'NF-9', amount: 50, companyId: 'acme' } });
  });

  it('recusa vincular a uma empresa que não é do convidado', async () => {
    const { submit, written } = setup();
    await expect(submit.execute({ tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'globex', data: { number: 'X' } }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
    expect(written).toEqual([]);
  });

  it('recusa quem não é convidado, e a tela que não aceita criação', async () => {
    const { submit } = setup();
    await expect(submit.execute({ tenantId: TENANT, userId: 'intruso', collection: 'invoices', linkRecordId: 'acme', data: {} }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
    await expect(submit.execute({ tenantId: TENANT, userId: 'ana', collection: 'companies', linkRecordId: 'acme', data: {} }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
  });

  it('pelo pai, só vincula a uma projeção em que o convidado está', async () => {
    const childScreens = screens.map((screen) => (screen.id === 'invoiceItems'
      ? { ...screen, portal: { ...screen.portal!, create: { fields: ['description'] } } }
      : screen));
    const fake = makeFakePortalRepository(childScreens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: false, portalOwner: null,
    });
    const write = vi.fn(async () => ({ ok: true as const, id: 'it-1' }));
    const submit = makeSubmitPortalRecordUseCase(fake.repo, write);

    await submit.execute({ tenantId: TENANT, userId: 'ana', collection: 'invoiceItems', linkRecordId: 'nf1', data: { description: 'Serviço' } });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ data: { description: 'Serviço', invoiceId: 'nf1' } }));
    await expect(submit.execute({ tenantId: TENANT, userId: 'ana', collection: 'invoiceItems', linkRecordId: 'nf2', data: {} }))
      .rejects.toThrow('@core.tenant/portal.create.denied');
  });

  it('o vínculo pela coleção chega à tela do portal, mesmo com a âncora sem portal listada antes', async () => {
    const extensionScreens = EXTENSION_CITY_SCREENS.map((screen) => (screen.id === 'city_invoices'
      ? { ...screen, portal: { ...screen.portal!, create: { fields: ['number'] } } }
      : screen));
    const fake = makeFakePortalRepository(extensionScreens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const write = vi.fn(async () => ({ ok: true as const, id: 'nf-9' }));

    await makeSubmitPortalRecordUseCase(fake.repo, write).execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'acme', data: { number: 'NF-9' },
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ data: { number: 'NF-9', companyId: 'acme' } }));
  });

  it('a recusa da validação sobe com os parâmetros, para ser traduzida', async () => {
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    const write = vi.fn(async () => ({ ok: false as const, error: '@core.automation/mutation.upsert.invalid', errorParams: { detail: 'number' } }));
    await expect(makeSubmitPortalRecordUseCase(fake.repo, write).execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', linkRecordId: 'acme', data: {},
    })).rejects.toMatchObject({ name: 'PortalSubmissionInvalid', params: { detail: 'number' } });
  });
});

describe('o convidado anexa um documento', () => {
  const TYPES = [{ key: 'Recibo', label: 'Recibo' }, { key: 'Nota', label: 'Nota' }];

  const setup = (uploads: { types: string[] } | null = { types: ['Nota'] }, documents = true) => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, documents, uploads } }
      : screen));
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: false, portalOwner: null,
    });
    fake.staged.set('ana/up1', { data: Buffer.from('pdf'), contentType: 'application/pdf' });
    const attach = vi.fn(async () => ({ id: 'doc-1' }));
    const useCase = makeAttachPortalDocumentUseCase(fake.repo, { documentTypes: async () => TYPES, attach });
    const input = { tenantId: TENANT, userId: 'ana', userName: 'Ana', collection: 'invoices', recordId: 'nf1', uploadId: 'up1', name: 'nota.pdf', type: 'Nota' };
    return { fake, attach, useCase, input };
  };

  it('anexa com um tipo permitido, e limpa a espera', async () => {
    const { useCase, input, attach, fake } = setup();
    expect(await useCase.execute(input)).toEqual({ id: 'doc-1' });
    expect(attach).toHaveBeenCalledWith(expect.objectContaining({ type: 'Nota', contentType: 'application/pdf', userId: 'ana' }));
    expect(fake.staged.size).toBe(0);
  });

  it('o tipo é escolhido entre os da tela — nunca um novo, nem um que a tela não oferece', async () => {
    const { useCase, input, attach } = setup();
    await expect(useCase.execute({ ...input, type: 'Inventado' })).rejects.toThrow('@core.tenant/portal.upload.type-invalid');
    await expect(useCase.execute({ ...input, type: 'Recibo' })).rejects.toThrow('@core.tenant/portal.upload.type-invalid');
    expect(attach).not.toHaveBeenCalled();
  });

  it('ver documentos não dá o direito de anexar', async () => {
    const { useCase, input } = setup(null);
    await expect(useCase.execute(input)).rejects.toThrow('@core.tenant/portal.upload.denied');
  });

  it('o registro de outra pessoa é recusado', async () => {
    const { useCase, input, fake } = setup();
    fake.users.set('bia', { userId: 'bia', email: 'bia@globex.com', displayName: 'Bia', subjectKeys: ['companies/globex'] });
    fake.staged.set('bia/up1', { data: Buffer.from('x'), contentType: 'application/pdf' });
    await expect(useCase.execute({ ...input, userId: 'bia' })).rejects.toThrow('@core.tenant/portal.upload.denied');
  });

  it('sem o arquivo na espera, recusa — e grande demais, recusa e limpa', async () => {
    const { useCase, input, fake } = setup();
    await expect(useCase.execute({ ...input, uploadId: 'nada' })).rejects.toThrow('@core.tenant/portal.upload.missing');
    fake.staged.set('ana/big', { data: Buffer.alloc(21 * 1024 * 1024), contentType: 'application/pdf' });
    await expect(useCase.execute({ ...input, uploadId: 'big' })).rejects.toThrow('@core.tenant/portal.upload.too-large');
    expect(fake.staged.has('ana/big')).toBe(false);
  });
});

describe('o convidado altera um registro', () => {
  const setup = (
    edit: { fields: string[]; when?: string; onlyOwn?: boolean } | null,
    record: Record<string, unknown> = {},
    visibleWhen?: string,
  ) => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, ...(edit ? { edit } : {}), ...(visibleWhen ? { visibleWhen } : {}) } }
      : screen));
    const fake = makeFakePortalRepository(screens);
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
    fake.users.set('bia', { userId: 'bia', email: 'bia@acme.com', displayName: 'Bia', subjectKeys: ['companies/acme'] });
    fake.records.set('invoices/nf1', { number: '1', amount: 10, auditNote: 'x', companyId: 'acme', status: 'draft', ...record });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana', 'bia'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: true, portalOwner: null,
    });
    const write = vi.fn(async () => ({ ok: true as const, id: 'nf1' }));
    const useCase = makeUpdatePortalRecordUseCase(fake.repo, write);
    const input = { tenantId: TENANT, userId: 'ana', collection: 'invoices', recordId: 'nf1', data: {} as Record<string, unknown> };
    return { fake, write, useCase, input };
  };

  it('grava só os campos editáveis — o vínculo e o que não está exposto são descartados', async () => {
    const { useCase, input, write } = setup({ fields: ['amount'] });
    await useCase.execute({ ...input, data: { amount: 20, companyId: 'globex', auditNote: 'hack' } });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ recordId: 'nf1', data: { amount: 20 } }));
  });

  it('a tela sem edição declarada recusa', async () => {
    const { useCase, input, write } = setup(null);
    await expect(useCase.execute({ ...input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
    expect(write).not.toHaveBeenCalled();
  });

  it('a condição vale sobre o registro INTEIRO de agora, e a inválida fecha', async () => {
    const open = setup({ fields: ['amount'], when: 'status == "draft"' });
    await open.useCase.execute({ ...open.input, data: { amount: 20 } });
    expect(open.write).toHaveBeenCalled();

    const closed = setup({ fields: ['amount'], when: 'status == "draft"' }, { status: 'filed' });
    await expect(closed.useCase.execute({ ...closed.input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');

    const broken = setup({ fields: ['amount'], when: 'status ==' });
    await expect(broken.useCase.execute({ ...broken.input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
  });

  it('o registro que deixou de passar no visibleWhen é recusado, mesmo com a projeção ainda de pé', async () => {
    const visible = setup({ fields: ['amount'] }, { kind: 'revenue' }, 'kind == "revenue"');
    await visible.useCase.execute({ ...visible.input, data: { amount: 20 } });
    expect(visible.write).toHaveBeenCalled();

    const hidden = setup({ fields: ['amount'] }, { kind: 'expense' }, 'kind == "revenue"');
    await expect(hidden.useCase.execute({ ...hidden.input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
    expect(hidden.write).not.toHaveBeenCalled();
  });

  it('com onlyOwn, só quem criou o registro pelo portal altera', async () => {
    const { useCase, input, write } = setup({ fields: ['amount'], onlyOwn: true }, { createdBy: 'ana', createdVia: 'portal' });
    await useCase.execute({ ...input, data: { amount: 20 } });
    expect(write).toHaveBeenCalledTimes(1);
    await expect(useCase.execute({ ...input, userId: 'bia', data: { amount: 30 } })).rejects.toThrow('@core.tenant/portal.edit.denied');

    const office = setup({ fields: ['amount'], onlyOwn: true }, { createdBy: 'ana', createdVia: 'ui' });
    await expect(office.useCase.execute({ ...office.input, data: { amount: 20 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
  });

  it('quem não vê o registro é recusado', async () => {
    const { useCase, input, fake } = setup({ fields: ['amount'] });
    fake.users.set('caio', { userId: 'caio', email: 'caio@globex.com', displayName: 'Caio', subjectKeys: ['companies/globex'] });
    await expect(useCase.execute({ ...input, userId: 'caio', data: { amount: 1 } })).rejects.toThrow('@core.tenant/portal.edit.denied');
  });

  it('a recusa da validação sobe com os parâmetros, para ser traduzida', async () => {
    const { useCase, input, write } = setup({ fields: ['amount'] });
    write.mockResolvedValueOnce({ ok: false as const, error: '@core.automation/mutation.upsert.invalid', errorParams: { detail: 'amount' } } as never);
    await expect(useCase.execute({ ...input, data: { amount: -1 } }))
      .rejects.toMatchObject({ name: 'PortalSubmissionInvalid', params: { detail: 'amount' } });
  });
});

describe('o convite vale no instante, não quando o audience for refeito', () => {
  it('sujeito revogado: o audience ainda o lista, e mesmo assim tudo é recusado', async () => {
    const screens = CITY_SCREENS.map((screen) => (screen.id === 'invoices'
      ? { ...screen, portal: { ...screen.portal!, documents: true, uploads: { types: [] }, edit: { fields: ['amount'] } } }
      : screen));
    const fake = makeFakePortalRepository(screens);
    // Ana perdeu a Acme e ficou só com a Globex; o gatilho ainda não refez o audience da nota.
    fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/globex'] });
    fake.records.set('invoices/nf1', { number: '1', amount: 1, companyId: 'acme' });
    fake.projections.set('invoices__nf1', {
      collection: 'invoices', recordId: 'nf1', screenId: 'invoices', subjectKeys: ['companies/acme'],
      audience: ['ana'], title: '', data: {}, labels: {}, parentKeys: ['companies/acme'], parentKey: 'companies/acme', editable: true, portalOwner: null,
    });
    fake.documents.set('invoices/nf1/d1', { name: 'x.pdf', portalShared: true, url: 'https://x' });
    fake.staged.set('ana/up1', { data: Buffer.from('pdf'), contentType: 'application/pdf' });
    const write = vi.fn(async () => ({ ok: true as const, id: 'nf1' }));
    const attach = vi.fn(async () => ({ id: 'doc' }));

    await expect(makeUpdatePortalRecordUseCase(fake.repo, write).execute({
      tenantId: TENANT, userId: 'ana', collection: 'invoices', recordId: 'nf1', data: { amount: 2 },
    })).rejects.toThrow('@core.tenant/portal.edit.denied');
    await expect(makeGetPortalDocumentUrlUseCase(fake.repo).execute({
      tenantId: TENANT, userId: 'ana', projectionId: 'invoices__nf1', documentId: 'd1',
    })).rejects.toThrow('@core.tenant/portal.document.unavailable');
    await expect(makeAttachPortalDocumentUseCase(fake.repo, { documentTypes: async () => [{ key: 'Nota', label: 'Nota' }], attach }).execute({
      tenantId: TENANT, userId: 'ana', userName: 'Ana', collection: 'invoices', recordId: 'nf1', uploadId: 'up1', name: 'a.pdf', type: 'Nota',
    })).rejects.toThrow('@core.tenant/portal.upload.denied');
    expect(write).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
    // A recusa também limpa a espera — o arquivo não fica ocupando o escritório.
    expect(fake.staged.size).toBe(0);
  });
});

