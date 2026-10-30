import { describe, expect, it } from 'vitest';
import { asFieldLookupBinding, portalFieldInput } from './portalFieldInput';
import { buildFieldRulePresetCatalog, type FieldRulePreset } from './fieldRulePresets';
import { buildLookupProviderCatalog, DEFAULT_LOOKUP_ERROR, type LookupProviderSpec } from './lookupProviderSpec';

const CEP: FieldRulePreset = {
  key: 'com.acme/zip',
  label: 'Zip',
  mask: { templates: ['#####-###'], inputMode: 'numeric' },
  format: [{ op: 'digits' }],
};

const ZIP_PROVIDER: LookupProviderSpec = {
  key: 'com.acme/zip-lookup',
  label: '@com.acme/zip.label',
  input: [{ op: 'digits' }],
  request: { url: 'https://zip.example.com/{value}.json' },
  map: { street: 'logradouro', city: 'localidade' },
  failWhen: { path: 'erro', message: '@com.acme/zip.not-found' },
};

const catalogs = {
  presets: buildFieldRulePresetCatalog([CEP]),
  providers: buildLookupProviderCatalog([ZIP_PROVIDER]),
};

const upper = (value: string) => value.toUpperCase();

describe('portalFieldInput — máscara e busca externa do campo preenchível do portal', () => {
  it('o campo masked leva o MOLDE do preset, não a chave', () => {
    expect(portalFieldInput({ type: 'masked', mask: 'com.acme/zip' }, catalogs, upper))
      .toEqual({ mask: { templates: ['#####-###'], inputMode: 'numeric' } });
  });

  it('máscara só vale para campo masked, e chave desconhecida não sai', () => {
    expect(portalFieldInput({ type: 'text', mask: 'com.acme/zip' }, catalogs, upper)).toEqual({});
    expect(portalFieldInput({ type: 'masked', mask: 'com.acme/unknown' }, catalogs, upper)).toEqual({});
    expect(portalFieldInput({ type: 'masked' }, catalogs, upper)).toEqual({});
  });

  it('a busca leva o provedor inteiro e o vínculo, com as frases no idioma do convidado', () => {
    const binding = { provider: 'com.acme/zip-lookup', map: { street: 'addressStreet' } };

    const input = portalFieldInput({ type: 'masked', mask: 'com.acme/zip', onChangeLookup: binding }, catalogs, upper);

    expect(input.lookup?.binding).toEqual(binding);
    expect(input.lookup?.provider).toMatchObject({
      key: 'com.acme/zip-lookup',
      request: { url: 'https://zip.example.com/{value}.json' },
      map: { street: 'logradouro', city: 'localidade' },
      label: '@COM.ACME/ZIP.LABEL',
      errorMessage: DEFAULT_LOOKUP_ERROR.toUpperCase(),
      failWhen: { path: 'erro', message: '@COM.ACME/ZIP.NOT-FOUND' },
    });
  });

  it('provedor que nenhuma extensão ligada declara não sai — o campo fica sem busca, como antes', () => {
    expect(portalFieldInput({ type: 'text', onChangeLookup: { provider: 'com.other/lookup' } }, catalogs, upper)).toEqual({});
  });
});

describe('asFieldLookupBinding — o vínculo gravado na tela', () => {
  it('lê provedor, map e prefixo, descartando o que não é texto', () => {
    expect(asFieldLookupBinding({ provider: 'p', map: { street: 'addressStreet', bad: 3 }, targetPrefix: 'address' }))
      .toEqual({ provider: 'p', map: { street: 'addressStreet' }, targetPrefix: 'address' });
  });

  it('sem provedor, não há busca', () => {
    expect(asFieldLookupBinding({ map: { street: 'x' } })).toBeUndefined();
    expect(asFieldLookupBinding({ provider: '  ' })).toBeUndefined();
    expect(asFieldLookupBinding(null)).toBeUndefined();
    expect(asFieldLookupBinding('p')).toBeUndefined();
  });

  it('map vazio e prefixo em branco não viajam', () => {
    expect(asFieldLookupBinding({ provider: 'p', map: {}, targetPrefix: ' ' })).toEqual({ provider: 'p' });
  });
});
