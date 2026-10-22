import { describe, expect, it } from 'vitest';
import {
  asPortalDeclaration,
  buildPortalEdit,
  buildPortalSubmission,
  canPortalUserEdit,
  evaluatePortalCondition,
  isPortalEditOpen,
  isPortalRecordVisible,
  portalEditFieldKeys,
  portalOwnerOf,
  parsePortalSubjectKey,
  portalDeclarationIssues,
  portalExposedTitle,
  portalFieldKeys,
  portalUploadTypes,
  portalSubjectKey,
  projectPortalData,
  resolvePortalSubjectKeys,
  type PortalScreenLike,
  type PortalSubjectDeps,
} from './portal';

const company: PortalScreenLike = {
  id: 'companies',
  collection: 'companies',
  titleFieldKey: 'name',
  fields: [{ key: 'name', type: 'text' }, { key: 'taxId', type: 'text' }],
  portal: { subject: 'self', fields: ['name'] },
};

const invoice: PortalScreenLike = {
  id: 'invoices',
  collection: 'invoices',
  titleFieldKey: 'number',
  fields: [
    { key: 'number', type: 'text' },
    { key: 'amount', type: 'currency' },
    { key: 'internalNote', type: 'text' },
    { key: 'companyId', type: 'reference', refEntity: 'companies' },
  ],
  portal: { subject: { field: 'companyId' }, fields: ['number', 'amount'] },
};

const item: PortalScreenLike = {
  id: 'invoiceItems',
  collection: 'invoiceItems',
  fields: [{ key: 'invoiceId', type: 'reference', refEntity: 'invoices' }],
  parentEntity: 'invoices',
  parentFieldKey: 'invoiceId',
  portal: { subject: 'parent', fields: [] },
};

const screens = new Map([company, invoice, item].map((screen) => [screen.id, screen]));

const depsWith = (records: Record<string, Record<string, unknown>>): PortalSubjectDeps => ({
  screenFor: (key) => screens.get(key),
  getRecord: async (collection, id) => records[`${collection}/${id}`],
});

describe('declaração do portal', () => {
  it('aceita as três formas de sujeito e descarta o que é malformado', () => {
    expect(asPortalDeclaration({ subject: 'self', fields: ['a', 'a', ' '] })).toEqual({
      subject: 'self', fields: ['a'], documents: false,
    });
    expect(asPortalDeclaration({ subject: { field: 'companyId' }, fields: [], documents: true })?.subject)
      .toEqual({ field: 'companyId' });
    expect(asPortalDeclaration({ subject: 'parent' })?.fields).toEqual([]);
    expect(asPortalDeclaration({ subject: 'everyone', fields: ['a'] })).toBeNull();
    expect(asPortalDeclaration({ subject: { field: '' } })).toBeNull();
    expect(asPortalDeclaration(null)).toBeNull();
  });

  it('a chave de sujeito ida e volta', () => {
    expect(parsePortalSubjectKey(portalSubjectKey('companies', 'abc'))).toEqual({ collection: 'companies', recordId: 'abc' });
    expect(parsePortalSubjectKey('companies')).toBeNull();
    expect(parsePortalSubjectKey('a/b/c')).toBeNull();
  });
});

describe('projeção', () => {
  it('só os campos declarados E existentes saem do escritório', () => {
    const projected = projectPortalData(
      { ...invoice, portal: { subject: 'self', fields: ['number', 'amount', 'removedField'] } },
      { number: 'NF-1', amount: 10, internalNote: 'segredo', companyId: 'c1' },
    );
    expect(projected).toEqual({ number: 'NF-1', amount: 10 });
    expect(portalFieldKeys({ ...invoice, portal: { subject: 'self', fields: ['removedField'] } })).toEqual([]);
  });
});

describe('sujeito do registro', () => {
  it('a tela-sujeito é dona de si mesma', async () => {
    expect(await resolvePortalSubjectKeys(company, 'c1', {}, depsWith({}))).toEqual(['companies/c1']);
  });

  it('o campo de referência leva direto ao sujeito', async () => {
    expect(await resolvePortalSubjectKeys(invoice, 'i1', { companyId: 'c1' }, depsWith({}))).toEqual(['companies/c1']);
  });

  it('o filho herda pelo pai, atravessando a corrente', async () => {
    const deps = depsWith({ 'invoices/i1': { companyId: 'c9' } });
    expect(await resolvePortalSubjectKeys(item, 'x1', { invoiceId: 'i1' }, deps)).toEqual(['companies/c9']);
  });

  it('sem vínculo, sem sujeito — a resposta fechada', async () => {
    expect(await resolvePortalSubjectKeys(invoice, 'i1', {}, depsWith({}))).toEqual([]);
    const orphan = await resolvePortalSubjectKeys(item, 'x1', { invoiceId: 'missing' }, depsWith({}));
    expect(orphan).toEqual([]);
  });

  it('uma tela no caminho que não declara portal corta a corrente', async () => {
    const undeclared = { ...invoice, portal: null };
    const deps: PortalSubjectDeps = {
      screenFor: (key) => (key === 'invoices' ? undeclared : screens.get(key)),
      getRecord: async () => ({ companyId: 'c1' }),
    };
    expect(await resolvePortalSubjectKeys(item, 'x1', { invoiceId: 'i1' }, deps)).toEqual([]);
  });
});

describe('título exposto', () => {
  it('a lista só mostra o título quando o campo de título está entre os expostos', () => {
    expect(portalExposedTitle(company, { name: 'Acme' })).toBe('Acme');
    expect(portalExposedTitle({ ...company, portal: { subject: 'self', fields: ['taxId'] } }, { name: 'Acme' })).toBe('');
  });
});

describe('problemas da declaração', () => {
  const all = [company, invoice, item];
  const keys = (screen: PortalScreenLike, screens = all) =>
    portalDeclarationIssues(screen, screens).map((issue) => issue.message);

  it('declarações coerentes não têm problema — direto, por campo e pelo pai', () => {
    expect(keys(company)).toEqual([]);
    expect(keys(invoice)).toEqual([]);
    expect(keys({ ...item, portal: { subject: 'parent', fields: ['invoiceId'] } })).toEqual([]);
  });

  it('sem campo exposto, ou com campo que não existe mais', () => {
    expect(keys({ ...company, portal: { subject: 'self', fields: [] } })).toContain('@core.records/portal.issue.no-fields');
    expect(keys({ ...company, portal: { subject: 'self', fields: ['ghost'] } })).toContain('@core.records/portal.issue.field.unknown');
  });

  it('o campo do sujeito precisa ser referência', () => {
    expect(keys({ ...invoice, portal: { subject: { field: 'number' }, fields: ['number'] } }))
      .toContain('@core.records/portal.issue.subject.not-reference');
  });

  it('herdar do pai exige ter pai', () => {
    expect(keys({ ...company, portal: { subject: 'parent', fields: ['name'] } }))
      .toContain('@core.records/portal.issue.parent.missing');
  });

  it('apontar para uma tela fora do portal corta a corrente — e o escritório fica sabendo', () => {
    const withoutCompany = [{ ...company, portal: null }, invoice, item];
    expect(keys(invoice, withoutCompany)).toContain('@core.records/portal.issue.target.no-portal');
  });

  it('um ciclo entre telas não chega a sujeito nenhum', () => {
    const a: PortalScreenLike = {
      id: 'a', collection: 'a', fields: [{ key: 'b', type: 'reference', refEntity: 'b' }],
      portal: { subject: { field: 'b' }, fields: ['b'] },
    };
    const b: PortalScreenLike = {
      id: 'b', collection: 'b', fields: [{ key: 'a', type: 'reference', refEntity: 'a' }],
      portal: { subject: { field: 'a' }, fields: ['a'] },
    };
    expect(keys(a, [a, b])).toContain('@core.records/portal.issue.too-deep');
  });
});

describe('criação pelo portal', () => {
  const orders: PortalScreenLike = {
    id: 'orders',
    collection: 'orders',
    fields: [
      { key: 'title', type: 'text', required: true },
      { key: 'notes', type: 'text' },
      { key: 'status', type: 'text', required: true, defaultValue: 'open' },
      { key: 'internal', type: 'text' },
      { key: 'companyId', type: 'reference', refEntity: 'companies', required: true },
    ],
    portal: { subject: { field: 'companyId' }, fields: ['title'], create: { fields: ['title', 'notes', 'companyId'] } },
  };

  it('o vínculo é carimbado pelo servidor, e o que não é preenchível some', () => {
    expect(buildPortalSubmission(orders, { title: 'Pedido', internal: 'x', companyId: 'outra' }, 'acme'))
      .toEqual({ title: 'Pedido', companyId: 'acme' });
  });

  it('a tela-sujeito não aceita criação — nem pela declaração', () => {
    expect(asPortalDeclaration({ subject: 'self', fields: ['a'], create: { fields: ['a'] } })?.create).toBeUndefined();
    expect(portalDeclarationIssues({ ...company, portal: { subject: 'self', fields: ['name'], create: { fields: ['name'] } } }, [company]).map((issue) => issue.message))
      .toContain('@core.records/portal.issue.create.self');
  });

  it('campo obrigatório sem padrão precisa estar entre os preenchíveis', () => {
    const missingTitle = { ...orders, portal: { ...orders.portal!, create: { fields: ['notes'] } } };
    const issues = portalDeclarationIssues(missingTitle, [company, missingTitle]);
    expect(issues).toContainEqual({ message: '@core.records/portal.issue.create.required-missing', messageParams: { field: 'title' } });
    expect(issues.some((issue) => issue.messageParams?.field === 'status')).toBe(false);
    expect(portalDeclarationIssues(orders, [company, orders])).toEqual([]);
  });
});

describe('anexos pelo portal', () => {
  const docs = [{ key: 'Recibo', label: 'Recibo' }, { key: 'Nota', label: 'Nota' }];
  const withUploads = (types: string[]): PortalScreenLike => ({
    ...invoice,
    portal: { ...invoice.portal!, documents: true, uploads: { types } },
  });

  it('o convidado escolhe entre os tipos do escritório — os restritos, ou todos', () => {
    expect(portalUploadTypes(withUploads([]), docs).map((one) => one.key)).toEqual(['Recibo', 'Nota']);
    expect(portalUploadTypes(withUploads(['Nota', 'Apagado']), docs).map((one) => one.key)).toEqual(['Nota']);
  });

  it('anexar exige ver os documentos', () => {
    const blind = { ...invoice, portal: { ...invoice.portal!, documents: false, uploads: { types: [] } } };
    expect(portalDeclarationIssues(blind, [company, blind]).map((issue) => issue.message))
      .toContain('@core.records/portal.issue.uploads.documents');
  });

  it('a declaração malformada não vira permissão', () => {
    expect(asPortalDeclaration({ subject: 'self', fields: ['a'] })?.uploads).toBeUndefined();
    expect(asPortalDeclaration({ subject: 'self', fields: ['a'], uploads: { types: ['X', 3] } })?.uploads).toEqual({ types: ['X'] });
  });
});

describe('edição pelo portal', () => {
  const editing = (edit: { fields: string[]; when?: string; onlyOwn?: boolean }): PortalScreenLike => ({
    ...invoice,
    portal: { ...invoice.portal!, fields: ['number', 'amount', 'companyId'], edit },
  });

  it('lê a declaração com desconfiança: campos repetidos somem, onlyOwn só quando true', () => {
    expect(asPortalDeclaration({ subject: 'self', fields: ['a'], edit: { fields: ['a', 'a', ''], when: ' x ', onlyOwn: 'yes' } })?.edit)
      .toEqual({ fields: ['a'], when: 'x' });
    expect(asPortalDeclaration({ subject: 'self', fields: ['a'], edit: { when: 'x' } })?.edit).toBeUndefined();
  });

  it('só é editável o que o convidado vê — e nunca o vínculo', () => {
    expect(portalEditFieldKeys(editing({ fields: ['amount', 'internalNote', 'companyId'] }))).toEqual(['amount']);
    expect(buildPortalEdit(editing({ fields: ['amount'] }), { amount: 5, companyId: 'globex', internalNote: 'x' }))
      .toEqual({ amount: 5 });
  });

  it('a condição abre, fecha — e a quebrada fecha', () => {
    const evaluate = (expression: string, data: Record<string, unknown>) => evaluatePortalCondition(expression, data);
    expect(isPortalEditOpen(editing({ fields: ['amount'] }), {}, evaluate)).toBe(true);
    expect(isPortalEditOpen(editing({ fields: ['amount'], when: 'status == "draft"' }), { status: 'draft' }, evaluate)).toBe(true);
    expect(isPortalEditOpen(editing({ fields: ['amount'], when: 'status == "draft"' }), { status: 'filed' }, evaluate)).toBe(false);
    expect(isPortalEditOpen(editing({ fields: ['amount'], when: 'status ==' }), { status: 'draft' }, evaluate)).toBe(false);
    expect(isPortalEditOpen(editing({ fields: ['internalNote'] }), {}, evaluate)).toBe(false);
  });

  it('o dono é quem criou PELO portal; onlyOwn só deixa ele', () => {
    expect(portalOwnerOf({ createdBy: 'ana', createdVia: 'portal' })).toBe('ana');
    expect(portalOwnerOf({ createdBy: 'ana', createdVia: 'ui' })).toBeNull();
    const own = editing({ fields: ['amount'], onlyOwn: true });
    expect(canPortalUserEdit(own, 'ana', { editable: true, portalOwner: 'ana' })).toBe(true);
    expect(canPortalUserEdit(own, 'bia', { editable: true, portalOwner: 'ana' })).toBe(false);
    expect(canPortalUserEdit(editing({ fields: ['amount'] }), 'bia', { editable: true, portalOwner: 'ana' })).toBe(true);
    expect(canPortalUserEdit(editing({ fields: ['amount'] }), 'ana', { editable: false, portalOwner: 'ana' })).toBe(false);
  });

  it('a declaração aponta campo escondido, vínculo e condição inválida', () => {
    const screen: PortalScreenLike = { ...invoice, portal: { ...invoice.portal!, edit: { fields: ['internalNote', 'amount'], when: 'a ==' } } };
    const messages = portalDeclarationIssues(screen, [company, screen]).map((issue) => issue.message);
    expect(messages).toContain('@core.records/portal.issue.edit.field.hidden');
    expect(messages).toContain('@core.records/portal.issue.edit.when-invalid');
    const empty: PortalScreenLike = { ...invoice, portal: { ...invoice.portal!, edit: { fields: [] } } };
    expect(portalDeclarationIssues(empty, [company, empty]).map((issue) => issue.message))
      .toContain('@core.records/portal.issue.edit.no-fields');
  });
});

describe('visibilidade por registro — visibleWhen', () => {
  const filtered = (screen: PortalScreenLike, visibleWhen: string): PortalScreenLike => ({
    ...screen,
    portal: { ...screen.portal!, visibleWhen },
  });

  it('lê a condição aparada, e a vazia é ausente', () => {
    expect(asPortalDeclaration({ subject: 'self', fields: ['a'], visibleWhen: ' a == 1 ' })?.visibleWhen).toBe('a == 1');
    expect(asPortalDeclaration({ subject: 'self', fields: ['a'], visibleWhen: '  ' })).not.toHaveProperty('visibleWhen');
  });

  it('sem condição, todos passam; a falsa e a quebrada escondem', () => {
    expect(isPortalRecordVisible(invoice, {})).toBe(true);
    expect(isPortalRecordVisible(filtered(invoice, 'kind == "revenue"'), { kind: 'revenue' })).toBe(true);
    expect(isPortalRecordVisible(filtered(invoice, 'kind == "revenue"'), { kind: 'expense' })).toBe(false);
    expect(isPortalRecordVisible(filtered(invoice, 'kind =='), { kind: 'revenue' })).toBe(false);
  });

  it('o campo que o registro não tem vale vazio — não fecha por não existir', () => {
    expect(isPortalRecordVisible(filtered(invoice, 'officeOnly != true'), {})).toBe(true);
    expect(isPortalRecordVisible(filtered(invoice, 'officeOnly != true'), { officeOnly: true })).toBe(false);
    expect(isPortalRecordVisible(filtered(invoice, 'kind == "revenue"'), {})).toBe(false);
  });

  it('o registro escondido fica sem sujeito — e corta a corrente de quem chega por ele', async () => {
    const hiddenInvoices = filtered(invoice, 'kind == "revenue"');
    const deps: PortalSubjectDeps = {
      screenFor: (key) => (key === 'invoices' ? hiddenInvoices : screens.get(key)),
      getRecord: async (collection, id) => ({
        'invoices/nf1': { companyId: 'acme', kind: 'revenue' },
        'invoices/nf2': { companyId: 'acme', kind: 'expense' },
      } as Record<string, Record<string, unknown>>)[`${collection}/${id}`],
    };
    expect(await resolvePortalSubjectKeys(hiddenInvoices, 'nf2', { companyId: 'acme', kind: 'expense' }, deps)).toEqual([]);
    expect(await resolvePortalSubjectKeys(item, 'i1', { invoiceId: 'nf1' }, deps)).toEqual(['companies/acme']);
    expect(await resolvePortalSubjectKeys(item, 'i2', { invoiceId: 'nf2' }, deps)).toEqual([]);
  });

  it('o sujeito escondido não recebe nada; sem filtro, nem é lido', async () => {
    const reads: string[] = [];
    const hiddenCompanies = filtered(company, 'active == true');
    const deps = (target: PortalScreenLike): PortalSubjectDeps => ({
      screenFor: (key) => (key === 'companies' ? target : screens.get(key)),
      getRecord: async (collection, id) => {
        reads.push(`${collection}/${id}`);
        return { active: id === 'acme' };
      },
    });
    expect(await resolvePortalSubjectKeys(invoice, 'nf1', { companyId: ['acme', 'globex'] }, deps(hiddenCompanies)))
      .toEqual(['companies/acme']);
    reads.length = 0;
    expect(await resolvePortalSubjectKeys(invoice, 'nf1', { companyId: 'globex' }, deps(company))).toEqual(['companies/globex']);
    expect(reads).toEqual([]);
  });

  it('a declaração confere a sintaxe e os campos citados — os de sistema valem', () => {
    const issuesOf = (visibleWhen: string) => {
      const screen = filtered(invoice, visibleWhen);
      return portalDeclarationIssues(screen, [company, screen]);
    };
    expect(issuesOf('internalNote == "" and createdVia != "portal"')).toEqual([]);
    expect(issuesOf('kind ==').map((issue) => issue.message)).toEqual(['@core.records/portal.issue.visible-when.invalid']);
    expect(issuesOf('kind == "revenue" and isEmpty(companyId.city)')).toEqual([
      { message: '@core.records/portal.issue.visible-when.field.unknown', messageParams: { field: 'kind' } },
    ]);
  });

  it('a condição de edição também aponta o campo que a tela não tem', () => {
    const screen: PortalScreenLike = { ...invoice, portal: { ...invoice.portal!, edit: { fields: ['amount'], when: 'stage == "draft"' } } };
    expect(portalDeclarationIssues(screen, [company, screen])).toContainEqual(
      { message: '@core.records/portal.issue.edit.when.field.unknown', messageParams: { field: 'stage' } },
    );
  });
});
