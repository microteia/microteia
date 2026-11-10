import { describe, expect, it } from 'vitest';
import {
  RECORD_SEED_VIA,
  SCREEN_SEED_MAX_RECORDS,
  declaredScreenSeeds,
  isRecordSeedWrite,
  needsEmptinessCheck,
  planScreenSeed,
  readExtensionSeedState,
  resolveSeedData,
} from './screenSeed';

const A = { key: 'a', data: { name: 'A' } };
const B = { key: 'b', data: { name: 'B' } };
const C = { key: 'c', data: { name: 'C' } };

describe('planScreenSeed', () => {
  it('when-empty decide uma vez: coleção vazia recebe todas, e a decisão fica gravada', () => {
    expect(planScreenSeed('when-empty', [A, B], undefined, true)).toEqual({
      create: [A, B],
      entry: { planned: ['a', 'b'], delivered: [] },
    });
  });

  it('when-empty não toca numa coleção que já tem registros, e não pergunta de novo depois', () => {
    const plan = planScreenSeed('when-empty', [A, B], undefined, false);
    expect(plan).toEqual({ create: [], entry: { planned: [], delivered: [] } });
    expect(needsEmptinessCheck('when-empty', plan.entry)).toBe(false);
  });

  it('when-empty retomado termina o que decidiu, mesmo com a coleção já não vazia', () => {
    const plan = planScreenSeed('when-empty', [A, B, C], { planned: ['a', 'b'], delivered: ['a'] }, false);
    expect(plan.create).toEqual([B]);
  });

  it('when-empty não entrega a semente que uma versão nova acrescentou', () => {
    const plan = planScreenSeed('when-empty', [A, B, C], { planned: ['a', 'b'], delivered: ['a', 'b'] }, false);
    expect(plan.create).toEqual([]);
  });

  it('required entrega só as chaves que ainda não entregou: a apagada não volta, a nova entra', () => {
    const plan = planScreenSeed('required', [A, B, C], { planned: null, delivered: ['a', 'b'] }, true);
    expect(plan).toEqual({ create: [C], entry: { planned: null, delivered: ['a', 'b'] } });
  });

  it('required nunca pergunta se a coleção está vazia', () => {
    expect(needsEmptinessCheck('required', undefined)).toBe(false);
    expect(planScreenSeed('required', [A], undefined, false).create).toEqual([A]);
  });
});

describe('resolveSeedData', () => {
  const fields = [{ key: 'name', type: 'text' }, { key: 'species', type: 'select' }];
  const resolve = (ref: string) => `[${ref}]`;

  it('resolve a referência num campo de texto e deixa o resto intacto', () => {
    expect(resolveSeedData({ name: '@acme.pets/breed.persian', species: 'cat' }, fields, resolve)).toEqual({
      name: '[acme.pets/breed.persian]',
      species: 'cat',
    });
  });

  it('não trata como referência o que não é texto, nem frase com arroba', () => {
    expect(resolveSeedData({ name: 'suporte@acme.com', species: '@acme.pets/x' }, fields, resolve)).toEqual({
      name: 'suporte@acme.com',
      species: '@acme.pets/x',
    });
  });
});

describe('isRecordSeedWrite', () => {
  it('só a CRIAÇÃO marcada é semente', () => {
    expect(isRecordSeedWrite(null, { createdVia: RECORD_SEED_VIA })).toBe(true);
    expect(isRecordSeedWrite({ createdVia: RECORD_SEED_VIA }, { createdVia: RECORD_SEED_VIA, name: 'x' })).toBe(false);
    expect(isRecordSeedWrite(null, { createdVia: 'ui' })).toBe(false);
  });
});

describe('declaredScreenSeeds', () => {
  it('lê as sementes do pacote instalado, com o modo padrão e o id universal da tela', () => {
    const declared = declaredScreenSeeds({
      screens: [
        { key: 'breeds', sourceId: 'acme.breeds', fields: [{ key: 'name', type: 'text' }], seed: { records: [A] } },
        { key: 'pets', fields: [] },
        { key: 'broken', seed: { records: 'x' } },
      ],
    });
    expect(declared).toEqual([{
      sourceId: 'acme.breeds',
      templateKey: 'breeds',
      mode: 'when-empty',
      records: [A],
      fields: [{ key: 'name', type: 'text' }],
    }]);
  });

  it('ignora o que excede o teto em vez de derrubar a passada', () => {
    const records = Array.from({ length: SCREEN_SEED_MAX_RECORDS + 3 }, (_, index) => ({ key: `k${index}`, data: {} }));
    const [declared] = declaredScreenSeeds({ screens: [{ key: 's', seed: { mode: 'required', records } }] });
    expect(declared.records).toHaveLength(SCREEN_SEED_MAX_RECORDS);
    expect(declared.mode).toBe('required');
  });
});

describe('readExtensionSeedState', () => {
  it('documento ausente é "nada feito ainda"', () => {
    expect(readExtensionSeedState(undefined)).toEqual({ screens: {}, failures: {}, leaseUntil: null });
  });

  it('preserva a diferença entre planned nulo e vazio', () => {
    const state = readExtensionSeedState({
      screens: { s1: { planned: null, delivered: ['a'] }, s2: { planned: [], delivered: [] } },
      failures: { s1: [{ key: 'b', error: '@core.x/y', errorParams: { field: 'name' } }] },
      leaseUntil: 10,
    });
    expect(state.screens.s1.planned).toBeNull();
    expect(state.screens.s2.planned).toEqual([]);
    expect(state.failures.s1).toEqual([{ key: 'b', error: '@core.x/y', errorParams: { field: 'name' } }]);
    expect(state.leaseUntil).toBe(10);
  });
});
