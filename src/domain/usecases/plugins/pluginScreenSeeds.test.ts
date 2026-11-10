import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../entities/MarketplacePlugin';
import type { ScreenSeed } from '../../schema/screenSeed';
import { SCREEN_SEED_MAX_RECORDS } from '../../schema/screenSeed';
import { packageScreenSeedIssues } from './pluginScreenSeeds';
import { packageIssues } from './pluginReferences';

const field = (key: string, extra: Partial<TemplateField> = {}): TemplateField =>
  ({ key, label: key, type: 'text', required: false, order: 0, ...extra }) as TemplateField;

const BREED_FIELDS: TemplateField[] = [
  field('name', { required: true, unique: true }),
  field('species', { type: 'select', options: [{ key: 'dog', label: 'Dog' }, { key: 'cat', label: 'Cat' }] }),
  field('size', { type: 'select', lookupCollection: 'sizes' }),
  field('weight', { type: 'number' }),
  field('since', { type: 'date' }),
  field('owner', { type: 'reference', refEntity: 'persons' }),
  field('total', { type: 'number', aggregation: { from: 'x', via: 'y', op: 'count' } as TemplateField['aggregation'] }),
];

const pkgWith = (seed: ScreenSeed | Record<string, unknown>, extra: Partial<ScreenModuleTemplate> = {}, kernel = '^2.106.0'): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.pets',
    version: '1.0.0',
    kernel,
    name: 'Pets',
    contributes: [{
      point: 'i18n.messages',
      apiVersion: 1,
      id: 'en',
      metadata: { locale: 'en', namespace: 'com.acme.pets', messages: { 'breed.persian': 'Persian' } },
    }],
  } as unknown as MarketplacePlugin['manifest'],
  workflows: [],
  lookups: [{ collection: 'sizes', label: 'Sizes', options: [{ key: 'small', label: 'Small' }] }],
  screens: [{
    key: 'breeds',
    titleSingular: 'Breed',
    titlePlural: 'Breeds',
    icon: 'heart',
    titleFieldKey: 'name',
    fields: BREED_FIELDS,
    seed: seed as ScreenSeed,
    ...extra,
  }],
});

const codes = (pkg: MarketplacePlugin): string[] =>
  packageScreenSeedIssues(pkg).map((issue) => issue.message.replace('@core.marketplace/issue.screen-seed.', ''));

describe('a semente de tela na autoria', () => {
  it('aceita o catálogo bem formado — opção do campo, opção da lista do pacote e referência traduzível', () => {
    const pkg = pkgWith({
      mode: 'required',
      records: [
        { key: 'labrador', data: { name: 'Labrador', species: 'dog', size: 'small', weight: 30, since: '2020-01-01' } },
        { key: 'persian', data: { name: '@com.acme.pets/breed.persian', species: 'cat' } },
      ],
    });
    expect(codes(pkg)).toEqual([]);
    expect(packageIssues(pkg)).toEqual([]);
  });

  it('pacote sem semente não paga nada', () => {
    expect(codes(pkgWith(undefined as unknown as ScreenSeed, {}, '^1.0.0'))).toEqual([]);
  });

  it('recusa forma, modo, chave inválida e chave repetida', () => {
    expect(codes(pkgWith({ records: 'x' }))).toEqual(['shape']);
    expect(codes(pkgWith({ mode: 'always', records: [] }))).toEqual(['mode']);
    expect(codes(pkgWith({ records: [{ key: 'a/b', data: { name: 'A' } }] }))).toEqual(['key']);
    expect(codes(pkgWith({ records: [{ key: 'a', data: { name: 'A' } }, { key: 'a', data: { name: 'B' } }] }))).toEqual(['duplicate']);
  });

  it('recusa o catálogo acima do teto', () => {
    const records = Array.from({ length: SCREEN_SEED_MAX_RECORDS + 1 }, (_, index) => ({ key: `k${index}`, data: { name: `N${index}` } }));
    expect(codes(pkgWith({ records }))).toEqual(['too-many']);
  });

  it('confere cada valor contra o campo da tela', () => {
    expect(codes(pkgWith({
      records: [
        { key: 'a', data: { name: 'A', color: 'red' } },
        { key: 'b', data: { name: 'B', weight: '30' } },
        { key: 'c', data: { name: 'C', since: '01/02/2020' } },
        { key: 'd', data: { name: 'D', species: 'bird' } },
        { key: 'e', data: { name: 'E', size: 'huge' } },
        { key: 'f', data: { name: 'F', owner: 'abc' } },
        { key: 'g', data: { name: 'G', total: 3 } },
      ],
    }))).toEqual(['field-unknown', 'field-type', 'field-type', 'option', 'option', 'field-unsupported', 'field-unwritable']);
  });

  it('cobra o obrigatório sem valor padrão', () => {
    expect(codes(pkgWith({ records: [{ key: 'a', data: { species: 'dog' } }] }))).toEqual(['required']);
  });

  it('referência de mensagem só em campo de texto, e só a que o pacote traz', () => {
    expect(codes(pkgWith({ records: [{ key: 'a', data: { name: '@com.acme.pets/breed.missing' } }] }))).toEqual(['message-missing']);
    expect(codes(pkgWith({ records: [{ key: 'a', data: { name: 'A', species: '@com.acme.pets/breed.persian' } }] }))).toEqual(['message-field']);
  });

  it('recusa duas sementes com o mesmo valor numa chave declarada', () => {
    expect(codes(pkgWith({ records: [{ key: 'a', data: { name: 'Labrador' } }, { key: 'b', data: { name: 'Labrador ' } }] })))
      .toEqual(['key-repeated']);
    // A normalização declarada vale aqui como valeria na reserva.
    const caseless = pkgWith(
      { records: [{ key: 'a', data: { name: 'Labrador', weight: 1 } }, { key: 'b', data: { name: 'labrador', weight: 2 } }] },
      { keys: [{ name: 'by-name', kind: 'unique', fields: ['name'], normalize: { caseInsensitive: true } }] },
    );
    expect(codes(caseless)).toEqual(['key-repeated']);
  });

  it('exige o kernel que entrega a semente', () => {
    expect(codes(pkgWith({ records: [{ key: 'a', data: { name: 'A' } }] }, {}, '^2.100.0'))).toEqual(['kernel']);
  });
});
