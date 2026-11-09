import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import type { OptionsFilterSpec } from '../../schema/optionsFilter';
import { packageOptionsFilterIssues } from './pluginOptionsFilter';
import { packageIssues } from './pluginReferences';

const field = (key: string, extra: Partial<TemplateField> = {}): TemplateField =>
  ({ key, label: key, type: 'text', required: false, order: 0, ...extra }) as TemplateField;

const byPetType: OptionsFilterSpec = { where: [{ path: 'petType', op: 'eq', value: { field: 'petType' } }] };

const pkgWith = (petFields: TemplateField[], patchFields: TemplateField[] = []): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.pets', version: '1.0.0', kernel: '^2.104.0', name: 'Pets' },
  workflows: [],
  screens: [
    { key: 'pets', titleSingular: 'Pet', titlePlural: 'Pets', icon: 'heart', titleFieldKey: 'name', fields: petFields },
    {
      key: 'breeds',
      titleSingular: 'Breed',
      titlePlural: 'Breeds',
      icon: 'heart',
      titleFieldKey: 'name',
      fields: [field('name'), field('petType', { type: 'select' })],
    },
  ],
  screenPatches: patchFields.length > 0 ? [{ target: 'persons', fields: patchFields }] : undefined,
});

const messages = (pkg: MarketplacePlugin): string[] => packageOptionsFilterIssues(pkg).map((issue) => issue.message);

describe('o filtro de opções na autoria', () => {
  it('aceita a referência filtrada por um campo da própria tela', () => {
    expect(messages(pkgWith([
      field('name'),
      field('petType', { type: 'select' }),
      field('breedId', { type: 'reference', refEntity: 'breeds', optionsFilter: byPetType }),
      field('kind', { type: 'select', optionsFilter: { where: [{ path: 'key', op: 'startsWith', value: { literal: 'br-' } }] } }),
    ]))).toEqual([]);
  });

  it('recusa o filtro num tipo que não oferece opções, e a forma inválida', () => {
    expect(messages(pkgWith([
      field('petType', { type: 'select' }),
      field('note', { optionsFilter: byPetType }),
      field('breedId', { type: 'reference', refEntity: 'breeds', optionsFilter: { where: [] } }),
      field('other', { type: 'reference', refEntity: 'breeds', optionsFilter: { where: [{ path: 'petType', op: 'gt', value: { literal: 'x' } }] } as never }),
    ]))).toEqual([
      '@core.marketplace/issue.options-filter.type',
      '@core.marketplace/issue.options-filter.shape',
      '@core.marketplace/issue.options-filter.shape',
    ]);
  });

  it('recusa o caminho que a opção não tem', () => {
    expect(messages(pkgWith([
      field('petType', { type: 'select' }),
      field('breedId', { type: 'reference', refEntity: 'breeds', optionsFilter: { where: [{ path: 'size', op: 'eq', value: { field: 'petType' } }] } }),
      field('kind', { type: 'select', optionsFilter: { where: [{ path: 'color', op: 'eq', value: { literal: 'x' } }] } }),
    ]))).toEqual([
      '@core.marketplace/issue.options-filter.reference-path',
      '@core.marketplace/issue.options-filter.lookup-path',
    ]);
  });

  it('recusa a origem fora da tela e a que é o próprio campo', () => {
    expect(messages(pkgWith([
      field('breedId', { type: 'reference', refEntity: 'breeds', optionsFilter: byPetType }),
      field('kind', { type: 'select', optionsFilter: { where: [{ path: 'key', op: 'eq', value: { field: 'kind' } }] } }),
    ]))).toEqual([
      '@core.marketplace/issue.options-filter.source',
      '@core.marketplace/issue.options-filter.self',
    ]);
  });

  it('não cobra o que só o escritório conhece: tela apontada de fora e tela dona de um patch', () => {
    expect(messages(pkgWith(
      [field('petType', { type: 'select' }), field('ownerId', { type: 'reference', refEntity: 'persons', optionsFilter: { where: [{ path: 'anything', op: 'eq', value: { field: 'petType' } }] } })],
      [field('breedId', { type: 'reference', refEntity: 'breeds', optionsFilter: byPetType })],
    ))).toEqual([]);
  });

  it('entra na porta única da validação do pacote', () => {
    const pkg = pkgWith([field('note', { optionsFilter: byPetType })]);
    expect(packageIssues(pkg).map((issue) => issue.message)).toContain('@core.marketplace/issue.options-filter.type');
  });
});
