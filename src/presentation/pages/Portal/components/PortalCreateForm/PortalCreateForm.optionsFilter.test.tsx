// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../../shared/styles/theme';
import { PortalStoreContext, type PortalStoreValue } from '../../../../../stores/usePortal';
import { NotificationProvider } from '../../../../../stores/NotificationContext';
import type { PortalFieldInfo, PortalLinkOption, PortalScreenInfo } from '../../../../../domain/entities/Portal';
import { usePortalCreateFormViewModel } from './PortalCreateForm.viewmodel';

vi.mock('../../../../shared/i18n/useT', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => value ?? '',
}));

/**
 * O filtro de opções no formulário do CONVIDADO: a raça pelo tipo, lida da projeção que ele vê, e o tipo
 * de notícia pelo prefixo da chave. O servidor só manda o filtro que o portal consegue responder — aqui
 * se prova que, recebido, ele filtra, limpa em cascata e segura o envio da escolha que não vale mais.
 */

const PET_TYPE: PortalFieldInfo = {
  key: 'petType',
  label: 'Pet type',
  type: 'select',
  options: [{ key: 'dog', label: 'Dog' }, { key: 'cat', label: 'Cat' }],
};

const BREED: PortalFieldInfo = {
  key: 'breedId',
  label: 'Breed',
  type: 'reference',
  reference: { collection: 'breeds', multi: false },
  optionsFilter: { where: [{ path: 'petType', op: 'eq', value: { field: 'petType' } }] },
};

const NEWS_TYPE: PortalFieldInfo = {
  key: 'newsType',
  label: 'News type',
  type: 'select',
  options: [{ key: 'br-politics', label: 'Politics' }, { key: 'us-sports', label: 'Sports' }],
  optionsFilter: { where: [{ path: 'key', op: 'startsWith', value: { field: 'region' } }] },
};

const BREEDS: PortalLinkOption[] = [
  { recordId: 'labrador', label: 'Labrador', data: { petType: 'dog' } },
  { recordId: 'siamese', label: 'Siamese', data: { petType: 'cat' } },
];

const screenWith = (fields: PortalFieldInfo[]): PortalScreenInfo => ({
  id: 'pets',
  collection: 'pets',
  titleSingular: 'Pet',
  titlePlural: 'Pets',
  icon: 'heart',
  documents: false,
  trackViews: false,
  actions: false,
  uploads: null,
  parent: { collection: 'owners' },
  fields: [],
  create: { fields, link: { collection: 'owners', label: 'Owner' } },
  edit: { fields, onlyOwn: false },
}) as PortalScreenInfo;

const setup = (fields: PortalFieldInfo[]) => {
  const submit = vi.fn(async () => ({ id: 'p1' }));
  const store = {
    listLinkOptions: vi.fn(async (collection: string) => (collection === 'breeds' ? BREEDS : [])),
    submit,
    update: vi.fn(),
  } as unknown as PortalStoreValue;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={baseDarkTheme}>
      <PortalStoreContext.Provider value={store}>
        <NotificationProvider>{children}</NotificationProvider>
      </PortalStoreContext.Provider>
    </ThemeProvider>
  );
  const hook = renderHook(() => usePortalCreateFormViewModel({
    screen: screenWith(fields),
    fixedLinkRecordId: 'ana',
    onCancel: () => undefined,
    onSubmitted: () => undefined,
  }), { wrapper });
  return { ...hook, submit };
};

const values = (options: Array<{ value: string }>) => options.map((option) => option.value);

describe('o filtro de opções no formulário do portal', () => {
  it('a referência oferece só as projeções que combinam, e nada com a origem vazia', async () => {
    const { result } = setup([PET_TYPE, BREED]);
    await waitFor(() => expect(result.current.referencesLoading).toBe(false));
    expect(values(result.current.referenceOptions(BREED))).toEqual([]);
    act(() => result.current.setValue('petType', 'cat'));
    expect(values(result.current.referenceOptions(BREED))).toEqual(['siamese']);
  });

  it('trocar o tipo limpa a raça que deixou de valer', async () => {
    const { result } = setup([PET_TYPE, BREED]);
    await waitFor(() => expect(result.current.referencesLoading).toBe(false));
    act(() => result.current.setValue('petType', 'dog'));
    act(() => result.current.setValue('breedId', 'labrador'));
    act(() => result.current.setValue('petType', 'cat'));
    expect(result.current.values.breedId).toBeNull();
  });

  it('a lista filtra pelo prefixo da chave', () => {
    const region: PortalFieldInfo = { key: 'region', label: 'Region', type: 'text' };
    const { result } = setup([region, NEWS_TYPE]);
    act(() => result.current.setValue('region', 'br'));
    expect(values(result.current.selectOptions(NEWS_TYPE))).toEqual(['br-politics']);
  });

  it('o filtro cuja origem não está no formulário não é aplicado', () => {
    const { result } = setup([NEWS_TYPE]);
    expect(values(result.current.selectOptions(NEWS_TYPE))).toEqual(['br-politics', 'us-sports']);
  });

  it('a escolha que o filtro não oferece não é enviada', async () => {
    const region: PortalFieldInfo = { key: 'region', label: 'Region', type: 'text' };
    const { result, submit } = setup([region, NEWS_TYPE]);
    act(() => result.current.setValue('newsType', 'us-sports'));
    act(() => result.current.setValue('region', 'br'));
    // O texto livre não é escolha de opção: mudar a região limpa o tipo que deixou de valer.
    expect(result.current.values.newsType).toBeNull();
    act(() => result.current.setValue('newsType', 'us-sports'));
    await act(async () => { await result.current.submit(); });
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.error).toBe('News type: field.option-not-offered');
  });
});
