import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { RECORD_SEARCH_FIELD } from '../../schema/recordSearch';
import { packageFieldSearchIssues } from './pluginFieldSearch';
import { packageIssues } from './pluginReferences';

const field = (key: string, extra: Partial<TemplateField> = {}): TemplateField =>
  ({ key, label: key, type: 'text', required: false, order: 0, ...extra }) as TemplateField;

const pkgWith = (fields: TemplateField[], patchFields: TemplateField[] = []): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.cases', version: '1.0.0', kernel: '^2.95.0', name: 'Cases' },
  workflows: [],
  screens: [{ key: 'cases', titleSingular: 'Case', titlePlural: 'Cases', icon: 'folder', titleFieldKey: 'title', fields }],
  screenPatches: patchFields.length > 0 ? [{ target: 'persons', fields: patchFields }] : undefined,
});

const messages = (pkg: MarketplacePlugin): string[] => packageFieldSearchIssues(pkg).map((issue) => issue.message);

describe('o campo pesquisável na autoria', () => {
  it('aceita texto, máscara, lista e referência', () => {
    expect(messages(pkgWith([
      field('title'),
      field('number', { type: 'masked', searchable: true }),
      field('area', { type: 'select', searchable: true }),
      field('parties', { type: 'reference', refEntity: 'persons', multi: true, searchable: true }),
    ]))).toEqual([]);
  });

  it('recusa um tipo que a busca não lê, na tela e no complemento', () => {
    const pkg = pkgWith([field('filedAt', { type: 'date', searchable: true })], [field('photo', { type: 'file', searchable: true })]);
    expect(messages(pkg)).toEqual([
      '@core.marketplace/issue.package.field.searchable.type',
      '@core.marketplace/issue.package.field.searchable.type',
    ]);
  });

  it('recusa o campo que usa a chave reservada aos termos', () => {
    expect(messages(pkgWith([field(RECORD_SEARCH_FIELD)]))).toEqual(['@core.marketplace/issue.package.field.reserved-key']);
  });

  it('chega à porta única da validação de pacote', () => {
    const issues = packageIssues(pkgWith([field('filedAt', { type: 'date', searchable: true })])).map((issue) => issue.message);
    expect(issues).toContain('@core.marketplace/issue.package.field.searchable.type');
  });
});
