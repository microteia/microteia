import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../entities/MarketplacePlugin';
import { lookupProviderContribution } from '../../schema/dataExtensionPoints';
import { LOOKUP_TARGET_MAP_SINCE_KERNEL } from '../../schema/fieldChangeSpec';
import type { FieldLookupBinding } from '../../schema/fieldRules';
import type { LookupProviderSpec } from '../../schema/lookupProviderSpec';
import { packageFieldLookupIssues } from './pluginFieldLookups';
import { packageIssues } from './pluginReferences';

const CEP_PROVIDER: LookupProviderSpec = {
  key: 'com.acme.cep/cep',
  label: 'CEP',
  request: { url: 'https://cep.example.com/{value}' },
  map: { street: 'logradouro', neighborhood: 'bairro', city: 'localidade', state: 'uf' },
};

const FLAT_MAP = {
  street: 'enderecoLogradouro',
  neighborhood: 'enderecoBairro',
  city: 'enderecoMunicipio',
  state: 'enderecoUf',
};

const field = (key: string, extra: Partial<TemplateField> = {}): TemplateField =>
  ({ key, label: key, type: 'text', order: 0, ...extra }) as TemplateField;

const cepWith = (binding: Omit<FieldLookupBinding, 'provider'> & { provider?: string }): TemplateField =>
  field('enderecoCep', { logic: { onChangeLookup: { provider: 'viacep', ...binding } } });

const screenWith = (cep: TemplateField, ...others: TemplateField[]): ScreenModuleTemplate => ({
  key: 'contribuintes',
  titleSingular: 'Contribuinte',
  titlePlural: 'Contribuintes',
  icon: 'person',
  titleFieldKey: 'nome',
  fields: [
    field('nome'),
    cep,
    field('enderecoLogradouro'),
    field('enderecoBairro'),
    field('enderecoMunicipio'),
    field('enderecoUf'),
    ...others,
  ],
});

const pkgWith = (screen: ScreenModuleTemplate, extra: Partial<MarketplacePlugin> = {}, kernel = `^${LOOKUP_TARGET_MAP_SINCE_KERNEL}`): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.dte',
    version: '1.0.0',
    kernel,
    name: 'DTE',
    contributes: [lookupProviderContribution(CEP_PROVIDER)],
  },
  workflows: [],
  screens: [screen],
  ...extra,
});

const messages = (pkg: MarketplacePlugin): string[] => packageFieldLookupIssues(pkg).map((issue) => issue.message);

describe('o destino da busca externa declarado com map', () => {
  it('aceita o endereço achatado, com provedor de dependência que daqui não se vê', () => {
    expect(messages(pkgWith(screenWith(cepWith({ map: FLAT_MAP }))))).toEqual([]);
  });

  it('aceita o provedor do próprio pacote quando cada chave mapeada é uma que ele devolve', () => {
    expect(messages(pkgWith(screenWith(cepWith({ provider: CEP_PROVIDER.key, map: FLAT_MAP }))))).toEqual([]);
  });

  it('não confere quem continua no targetPrefix nem quem não declara busca — instala como instalava', () => {
    const legacy = pkgWith(screenWith(cepWith({ targetPrefix: 'address' })), {}, '^2.0.0');
    expect(messages(legacy)).toEqual([]);
    expect(messages(pkgWith(screenWith(field('enderecoCep')), {}, '^2.0.0'))).toEqual([]);
  });

  it('recusa destino que não é campo da tela, com a chave e o destino no recado', () => {
    const issues = packageFieldLookupIssues(pkgWith(screenWith(cepWith({ map: { street: 'endereco.logradouro' } }))));
    expect(issues).toEqual([{
      message: '@core.marketplace/issue.package.field.lookup.map-target',
      messageParams: { screen: 'contribuintes', field: 'enderecoCep', output: 'street', target: 'endereco.logradouro' },
    }]);
  });

  it('recusa mapear de volta para o campo que dispara a busca', () => {
    expect(messages(pkgWith(screenWith(cepWith({ map: { street: 'enderecoCep' } })))))
      .toEqual(['@core.marketplace/issue.package.field.lookup.map-self']);
  });

  it('recusa destino calculado, derivado ou agregado — a plataforma o sobrescreveria', () => {
    const screen = screenWith(
      cepWith({ map: { street: 'resumo', city: 'idade', state: 'total' } }),
      field('resumo', { logic: { compute: 'concat(nome, "!")' } }),
      field('idade', { logic: { derive: 'today()' } }),
      field('total', { type: 'number', aggregation: { from: 'itens', via: 'pai', op: 'count' } } as Partial<TemplateField>),
    );
    expect(messages(pkgWith(screen))).toEqual([
      '@core.marketplace/issue.package.field.lookup.map-readonly',
      '@core.marketplace/issue.package.field.lookup.map-readonly',
      '@core.marketplace/issue.package.field.lookup.map-readonly',
    ]);
  });

  it('recusa chave que o provedor do pacote não devolve, listando as que ele devolve', () => {
    const issues = packageFieldLookupIssues(pkgWith(screenWith(
      cepWith({ provider: CEP_PROVIDER.key, map: { complement: 'enderecoLogradouro' } }),
    )));
    expect(issues).toEqual([{
      message: '@core.marketplace/issue.package.field.lookup.map-output',
      messageParams: {
        screen: 'contribuintes',
        field: 'enderecoCep',
        provider: CEP_PROVIDER.key,
        output: 'complement',
        outputs: 'street, neighborhood, city, state',
      },
    }]);
  });

  it('recusa map junto de targetPrefix: só um dos dois manda', () => {
    expect(messages(pkgWith(screenWith(cepWith({ targetPrefix: 'endereco', map: FLAT_MAP })))))
      .toEqual(['@core.marketplace/issue.package.field.lookup.map-prefix']);
  });

  it('recusa map vazio, em lista, ou com destino em branco ou que não é texto', () => {
    const shapes: unknown[] = [{}, ['enderecoUf'], { street: '' }, { street: 3 }, 'enderecoUf'];
    for (const map of shapes) {
      expect(messages(pkgWith(screenWith(cepWith({ map: map as Record<string, string> })))))
        .toEqual(['@core.marketplace/issue.package.field.lookup.map-shape']);
    }
  });

  it(`exige kernel ^${LOOKUP_TARGET_MAP_SINCE_KERNEL} uma vez por pacote, porque um anterior gravaria as chaves cruas`, () => {
    const issues = packageFieldLookupIssues(pkgWith(screenWith(cepWith({ map: FLAT_MAP })), {}, '^2.40.0'));
    expect(issues).toEqual([{
      message: '@core.marketplace/issue.package.field.lookup.map-kernel',
      messageParams: { screen: 'contribuintes', field: 'enderecoCep', minimum: LOOKUP_TARGET_MAP_SINCE_KERNEL },
    }]);
  });

  it('num complemento de tela, o destino fora dos campos do complemento passa sem veredito', () => {
    const pkg = pkgWith(screenWith(field('enderecoCep')), {
      screenPatches: [{
        target: 'persons',
        targetKind: 'collection',
        fields: [cepWith({ map: { street: 'addressStreet', city: 'enderecoCep' } })],
      }],
    });
    expect(messages(pkg)).toEqual(['@core.marketplace/issue.package.field.lookup.map-self']);
  });

  it('chega à porta única do pacote', () => {
    const pkg = pkgWith(screenWith(cepWith({ map: { street: 'naoExiste' } })));
    expect(packageIssues(pkg).map((issue) => issue.message))
      .toContain('@core.marketplace/issue.package.field.lookup.map-target');
  });
});
