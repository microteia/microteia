// @vitest-environment jsdom
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EntityRecord, TenantMember } from '../../domain/entities';

const members: Partial<TenantMember>[] = [];
const recordsByCollection: Record<string, EntityRecord[]> = {};

vi.mock('../../stores/useRecords', () => ({
  useRecords: () => ({ recordsByCollection, knownRecordsByCollection: recordsByCollection }),
}));

vi.mock('../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ dynamicScreens: [] }),
}));

vi.mock('../../stores/useTenant', () => ({
  useTenant: () => ({ members }),
}));

vi.mock('../../stores/useLookups', () => ({
  useLookups: () => ({ getOptions: () => [] }),
}));

const { useReferenceOptions } = await import('./useReferenceOptions');
const { LocaleContext } = await import('../../stores/useLocale');
const { CORE_RECORDS } = await import('../../plugins/marketplace/localePtBr/coreRecords');

const memberOptions = (list: Partial<TenantMember>[]) => {
  members.splice(0, members.length, ...list);
  return renderHook(() => useReferenceOptions()).result.current.members;
};

/**
 * `members` não é tela: não há `subtitleFieldKey` que uma extensão declare. Dois membros com o mesmo
 * nome só se distinguem pelo e-mail, e é o hook que o põe na segunda linha da opção.
 */
describe('opções de referência a members', () => {
  it('leva o e-mail como segunda linha, mantendo o userId como valor', () => {
    expect(memberOptions([{ userId: 'u1', displayName: 'Ana', email: 'ana@x.com' }]))
      .toEqual([{ value: 'u1', label: 'Ana', meta: 'ana@x.com' }]);
  });

  it('deixa a segunda linha indefinida quando o membro não tem e-mail', () => {
    expect(memberOptions([{ userId: 'u1', displayName: 'Ana', email: '' }]))
      .toEqual([{ value: 'u1', label: 'Ana', meta: undefined }]);
  });

  it('usa o e-mail como rótulo quando falta o nome de exibição', () => {
    expect(memberOptions([{ userId: 'u1', displayName: '', email: 'ana@x.com' }]))
      .toEqual([{ value: 'u1', label: 'ana@x.com', meta: 'ana@x.com' }]);
  });

  it('continua ordenando pelo rótulo', () => {
    const options = memberOptions([
      { userId: 'u2', displayName: 'Bruno', email: 'b@x.com' },
      { userId: 'u1', displayName: '', email: 'a@x.com' },
    ]);
    expect(options.map((o) => o.value)).toEqual(['u1', 'u2']);
  });
});

/**
 * O "sem título" sai do catálogo, e não como a referência `@core.records/record.untitled`: o seletor
 * de referência não passa o rótulo por `useLabel`, e mostrava a referência crua.
 */
describe('opções de referência a registros', () => {
  const inPortuguese = ({ children }: { children: ReactNode }) => createElement(LocaleContext.Provider, {
    value: {
      locale: 'pt-BR',
      preferred: 'pt-BR',
      available: ['en', 'pt-BR'],
      catalog: { locale: 'pt-BR', messages: { 'core.records/record.untitled': CORE_RECORDS['record.untitled'] } },
      setLocale: () => {},
    },
  }, children);

  it('o registro sem título recebe a mensagem no idioma do escritório, nunca a referência do catálogo', () => {
    recordsByCollection.soltos = [{ id: 'r1' } as EntityRecord];
    const options = renderHook(() => useReferenceOptions(), { wrapper: inPortuguese }).result.current.soltos;
    delete recordsByCollection.soltos;

    expect(options).toEqual([{ value: 'r1', label: 'Sem título', meta: undefined }]);
  });
});
