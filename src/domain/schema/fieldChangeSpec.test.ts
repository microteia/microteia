import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import { lookupTargetMap, prefixLookupValues, resolveLookupPatch, resolveOnChangePatch } from './fieldChangeSpec';
import type { RecordResolver } from './referenceScope';
import { EMPTY_FIELD_UI_STATE } from './fieldUiScope';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
  origin: 'design',
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

const produtoField = field({
  key: 'produto',
  label: 'Produto',
  type: 'reference',
  refEntity: 'produtos',
  logic: { onChange: "object('preco', produto.preco, 'unidade', produto.unidade)" },
});

const fields: FieldDefinition[] = [
  produtoField,
  field({ key: 'preco', label: 'Preço', type: 'currency' }),
  field({ key: 'unidade', label: 'Unidade' }),
];

const resolve: RecordResolver = (refEntity, id) =>
  refEntity === 'produtos' && id === 'p1' ? { preco: 49.9, unidade: 'un' } : null;

describe('resolveOnChangePatch', () => {
  it('lê os campos do registro referenciado e devolve o objeto a mesclar', () => {
    const patch = resolveOnChangePatch(produtoField, fields, {}, 'p1', resolve, EMPTY_FIELD_UI_STATE);
    expect(patch).toEqual({ preco: 49.9, unidade: 'un' });
  });

  it('enxerga o valor recém-escolhido, não o estado anterior', () => {
    // O estado ainda tem o produto antigo; o valor novo é o que deve valer.
    const patch = resolveOnChangePatch(produtoField, fields, { produto: 'antigo' }, 'p1', resolve, EMPTY_FIELD_UI_STATE);
    expect(patch).toEqual({ preco: 49.9, unidade: 'un' });
  });

  it('nunca devolve a chave do próprio campo — brigaria com a digitação', () => {
    const autoref = field({
      key: 'nome',
      label: 'Nome',
      logic: { onChange: "object('nome', 'sobrescrito', 'apelido', 'ok')" },
    });
    const patch = resolveOnChangePatch(autoref, [autoref], {}, 'digitando', resolve, EMPTY_FIELD_UI_STATE);
    expect(patch).toEqual({ apelido: 'ok' });
  });

  it('devolve vazio quando não há expressão', () => {
    const simples = field({ key: 'x', label: 'X' });
    expect(resolveOnChangePatch(simples, [simples], {}, 'v', resolve, EMPTY_FIELD_UI_STATE)).toEqual({});
  });

  it('expressão inválida não lança e devolve vazio', () => {
    const quebrado = field({ key: 'x', label: 'X', logic: { onChange: 'funcaoInexistente(1)' } });
    expect(resolveOnChangePatch(quebrado, [quebrado], {}, 'v', resolve, EMPTY_FIELD_UI_STATE)).toEqual({});
  });

  it('expressão que não devolve objeto é ignorada', () => {
    const escalar = field({ key: 'x', label: 'X', logic: { onChange: "'texto'" } });
    expect(resolveOnChangePatch(escalar, [escalar], {}, 'v', resolve, EMPTY_FIELD_UI_STATE)).toEqual({});
  });

  it('enxerga a situação do formulário — `isNew` no escopo', () => {
    const semeia = field({
      key: 'gatilho',
      label: 'Gatilho',
      logic: { onChange: "object('origem', if(isNew, 'criacao', 'edicao'))" },
    });
    expect(resolveOnChangePatch(semeia, [semeia], {}, 'v', resolve, { isNew: true, isDirty: true }))
      .toEqual({ origem: 'criacao' });
    expect(resolveOnChangePatch(semeia, [semeia], {}, 'v', resolve, { isNew: false, isDirty: true }))
      .toEqual({ origem: 'edicao' });
  });

  it('registro não carregado não quebra — devolve vazio em vez de lixo', () => {
    const patch = resolveOnChangePatch(produtoField, fields, {}, 'desconhecido', resolve, EMPTY_FIELD_UI_STATE);
    expect(patch).toEqual({});
  });
});

describe('prefixLookupValues', () => {
  it('prefixa as chaves com o destino informado', () => {
    expect(prefixLookupValues({ street: 'Av. Paulista', city: 'São Paulo' }, 'address')).toEqual({
      'address.street': 'Av. Paulista',
      'address.city': 'São Paulo',
    });
  });

  it('sem prefixo, devolve as chaves originais', () => {
    const values = { street: 'Av. Paulista' };
    expect(prefixLookupValues(values, '')).toBe(values);
    expect(prefixLookupValues(values, null)).toBe(values);
  });
});

describe('resolveLookupPatch', () => {
  const VIACEP_VALUES = { street: 'Av. Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' };
  const FLAT_FIELDS = new Set(['enderecoCep', 'enderecoLogradouro', 'enderecoBairro', 'enderecoMunicipio', 'enderecoUf']);

  it('com map, leva cada valor ao campo achatado declarado', () => {
    const patch = resolveLookupPatch(
      {
        provider: 'viacep',
        map: { street: 'enderecoLogradouro', neighborhood: 'enderecoBairro', city: 'enderecoMunicipio', state: 'enderecoUf' },
      },
      VIACEP_VALUES,
      'enderecoCep',
      FLAT_FIELDS,
    );
    expect(patch).toEqual({
      enderecoLogradouro: 'Av. Paulista',
      enderecoBairro: 'Bela Vista',
      enderecoMunicipio: 'São Paulo',
      enderecoUf: 'SP',
    });
  });

  it('com map, descarta a chave do provedor que ele não menciona e ignora o prefixo', () => {
    const patch = resolveLookupPatch(
      { provider: 'viacep', targetPrefix: 'address', map: { city: 'enderecoMunicipio' } },
      VIACEP_VALUES,
      'enderecoCep',
      FLAT_FIELDS,
    );
    expect(patch).toEqual({ enderecoMunicipio: 'São Paulo' });
  });

  it('não escreve destino que a tela não tem mais, nem o campo que disparou a busca', () => {
    const patch = resolveLookupPatch(
      { provider: 'viacep', map: { street: 'apagadoDepois', city: 'enderecoCep', state: 'enderecoUf' } },
      VIACEP_VALUES,
      'enderecoCep',
      FLAT_FIELDS,
    );
    expect(patch).toEqual({ enderecoUf: 'SP' });
  });

  it('chave mapeada que o provedor não devolveu não vira campo vazio', () => {
    const patch = resolveLookupPatch(
      { provider: 'viacep', map: { complement: 'enderecoLogradouro', state: 'enderecoUf' } },
      VIACEP_VALUES,
      'enderecoCep',
      FLAT_FIELDS,
    );
    expect(patch).toEqual({ enderecoUf: 'SP' });
  });

  it('sem map, mantém o prefixo com ponto de quem já usa — inclusive sem conferir os campos', () => {
    expect(resolveLookupPatch({ provider: 'viacep', targetPrefix: 'address' }, { street: 'Av. Paulista' }, 'address.zipCode', new Set()))
      .toEqual({ 'address.street': 'Av. Paulista' });
    expect(resolveLookupPatch({ provider: 'viacep' }, { street: 'Av. Paulista' }, 'cep', new Set()))
      .toEqual({ street: 'Av. Paulista' });
  });

  it('map vazio ou só com entradas em branco volta ao prefixo, em vez de não preencher nada', () => {
    expect(resolveLookupPatch({ provider: 'viacep', targetPrefix: 'address', map: {} }, { street: 'X' }, 'cep', new Set()))
      .toEqual({ 'address.street': 'X' });
    expect(resolveLookupPatch({ provider: 'viacep', map: { street: '  ' } }, { street: 'X' }, 'cep', new Set()))
      .toEqual({ street: 'X' });
  });
});

describe('lookupTargetMap', () => {
  it('apara chave e destino e descarta o que não é texto', () => {
    expect(lookupTargetMap({ provider: 'p', map: { ' street ': ' rua ', city: 3 as unknown as string } }))
      .toEqual({ street: 'rua' });
  });

  it('devolve null sem map, com map nulo ou que não é objeto', () => {
    expect(lookupTargetMap({ provider: 'p' })).toBeNull();
    expect(lookupTargetMap({ provider: 'p', map: null })).toBeNull();
    expect(lookupTargetMap({ provider: 'p', map: ['a'] as unknown as Record<string, string> })).toBeNull();
    expect(lookupTargetMap(undefined)).toBeNull();
  });
});
