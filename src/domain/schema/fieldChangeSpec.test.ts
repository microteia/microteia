import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import { prefixLookupValues, resolveOnChangePatch } from './fieldChangeSpec';
import type { RecordResolver } from './referenceScope';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
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
    const patch = resolveOnChangePatch(produtoField, fields, {}, 'p1', resolve);
    expect(patch).toEqual({ preco: 49.9, unidade: 'un' });
  });

  it('enxerga o valor recém-escolhido, não o estado anterior', () => {
    // O estado ainda tem o produto antigo; o valor novo é o que deve valer.
    const patch = resolveOnChangePatch(produtoField, fields, { produto: 'antigo' }, 'p1', resolve);
    expect(patch).toEqual({ preco: 49.9, unidade: 'un' });
  });

  it('nunca devolve a chave do próprio campo — brigaria com a digitação', () => {
    const autoref = field({
      key: 'nome',
      label: 'Nome',
      logic: { onChange: "object('nome', 'sobrescrito', 'apelido', 'ok')" },
    });
    const patch = resolveOnChangePatch(autoref, [autoref], {}, 'digitando', resolve);
    expect(patch).toEqual({ apelido: 'ok' });
  });

  it('devolve vazio quando não há expressão', () => {
    const simples = field({ key: 'x', label: 'X' });
    expect(resolveOnChangePatch(simples, [simples], {}, 'v', resolve)).toEqual({});
  });

  it('expressão inválida não lança e devolve vazio', () => {
    const quebrado = field({ key: 'x', label: 'X', logic: { onChange: 'funcaoInexistente(1)' } });
    expect(resolveOnChangePatch(quebrado, [quebrado], {}, 'v', resolve)).toEqual({});
  });

  it('expressão que não devolve objeto é ignorada', () => {
    const escalar = field({ key: 'x', label: 'X', logic: { onChange: "'texto'" } });
    expect(resolveOnChangePatch(escalar, [escalar], {}, 'v', resolve)).toEqual({});
  });

  it('registro não carregado não quebra — devolve vazio em vez de lixo', () => {
    const patch = resolveOnChangePatch(produtoField, fields, {}, 'desconhecido', resolve);
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
