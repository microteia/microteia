import { describe, expect, it } from 'vitest';
import { packageFieldVisibilityIssues } from './pluginFieldVisibility';
import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';

const pkg = (kernel: string, fields: TemplateField[]): MarketplacePlugin => ({
  summary: 'S',
  manifest: { id: 'com.acme.items', version: '1.0.0', kernel, name: 'Items' },
  workflows: [],
  screens: [{ key: 'items', titleSingular: 'Item', titlePlural: 'Items', icon: 'apps', titleFieldKey: 'name', fields }],
} as unknown as MarketplacePlugin);

const field = (key: string, extra: Partial<TemplateField> = {}): TemplateField =>
  ({ key, label: key, type: 'text', required: false, order: 0, ...extra }) as TemplateField;

describe('visibleIn no pacote (#12)', () => {
  it('exige o kernel que o obedece', () => {
    const issues = packageFieldVisibilityIssues(pkg('^2.0.0', [field('name'), field('code', { visibleIn: ['card'] })]));
    expect(issues.map((issue) => issue.message)).toEqual(['@core.marketplace/issue.field.visible-in.kernel']);
    expect(packageFieldVisibilityIssues(pkg('^2.141.0', [field('code', { visibleIn: ['card'] })]))).toEqual([]);
  });

  it('sem visibleIn, nada é cobrado — nem o kernel', () => {
    expect(packageFieldVisibilityIssues(pkg('^2.0.0', [field('code', { hiddenInForm: true })]))).toEqual([]);
  });

  it('recusa a superfície desconhecida e a contradição com o atalho', () => {
    const issues = packageFieldVisibilityIssues(pkg('^2.141.0', [
      field('a', { visibleIn: ['portal'] as never }),
      field('b', { visibleIn: ['form'], hiddenInForm: true }),
    ]));
    expect(issues).toEqual([
      { message: '@core.marketplace/issue.field.visible-in.surface', messageParams: { screen: 'items', field: 'a', surface: 'portal' } },
      { message: '@core.marketplace/issue.field.visible-in.contradicts', messageParams: { screen: 'items', field: 'b', flag: 'hiddenInForm' } },
    ]);
  });
});
