// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition } from '../../../../domain/entities';
import { lookupProviderContribution } from '../../../../domain/schema/dataExtensionPoints';
import { useFieldChangeEffects } from './useFieldChangeEffects';

/**
 * O formulário do escritório depois de a espera e a corrida da busca externa passarem a ser
 * partilhadas com o portal (`useExternalLookupRunner`): o comportamento de antes, intacto.
 */

const notify = vi.fn();
const ZIP_PROVIDER = lookupProviderContribution({
  key: 'com.acme/zip-lookup',
  label: 'Zip',
  input: [{ op: 'digits' }],
  request: { url: 'https://zip.example.com/{value}.json' },
  map: { street: 'logradouro', city: 'localidade' },
});

vi.mock('../../../../stores/useNotification', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../../stores/useKernel', () => ({
  useContributions: () => [{ ...ZIP_PROVIDER, pluginId: 'com.acme' }],
}));

const field = (key: string, extra: Partial<FieldDefinition> = {}) =>
  ({ key, label: key, type: 'text', ...extra }) as FieldDefinition;

const respond = (body: unknown) => ({ ok: true, text: async () => JSON.stringify(body) }) as unknown as Response;

const run = (fields: FieldDefinition[]) => {
  const merged: Array<Record<string, unknown>> = [];
  const { result } = renderHook(() => useFieldChangeEffects({
    fields,
    values: {},
    resolveRecord: () => null,
    onMergeValues: (patch) => { merged.push(patch); },
    isNew: true,
  }));
  return { result, merged };
};

const elapse = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useFieldChangeEffects — busca externa do formulário do escritório', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => respond({ logradouro: 'Rua Chile', localidade: 'Salvador' })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    notify.mockReset();
  });

  it('com map, a resposta vai para os campos declarados que a tela tem', async () => {
    const { result, merged } = run([
      field('zip', { logic: { onChangeLookup: { provider: 'com.acme/zip-lookup', map: { street: 'addressStreet', city: 'gone' } } } }),
      field('addressStreet'),
    ]);

    act(() => result.current.runFieldChangeEffects('zip', '40010-000'));
    expect(result.current.isFieldLoading('zip')).toBe(false);
    await elapse(400);

    expect(fetch).toHaveBeenCalledWith('https://zip.example.com/40010000.json', expect.anything());
    expect(merged).toEqual([{ addressStreet: 'Rua Chile' }]);
  });

  it('com prefixo, as chaves do provedor vão prefixadas, como sempre foram', async () => {
    const { result, merged } = run([
      field('zip', { logic: { onChangeLookup: { provider: 'com.acme/zip-lookup', targetPrefix: 'address' } } }),
      field('address', { type: 'object' as FieldDefinition['type'] }),
    ]);

    act(() => result.current.runFieldChangeEffects('zip', '40010000'));
    await elapse(400);

    expect(merged).toEqual([{ 'address.street': 'Rua Chile', 'address.city': 'Salvador' }]);
  });

  it('a expressão onChange continua mesclando na hora, antes da busca', async () => {
    const { result, merged } = run([
      field('zip', { logic: { onChange: "object('zipTyped', value)" } }),
      field('zipTyped'),
    ]);

    act(() => result.current.runFieldChangeEffects('zip', '123'));

    expect(merged).toEqual([{ zipTyped: '123' }]);
    await elapse(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('provedor que nenhuma extensão declara não dispara nada', async () => {
    const { result } = run([field('zip', { logic: { onChangeLookup: { provider: 'com.other/lookup' } } })]);

    act(() => result.current.runFieldChangeEffects('zip', '40010000'));
    await elapse(400);

    expect(fetch).not.toHaveBeenCalled();
  });
});
