import { describe, expect, it } from 'vitest';
import {
  asPortalDeclaration,
  parsePortalSubjectKey,
  portalFieldKeys,
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
