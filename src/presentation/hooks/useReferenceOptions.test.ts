// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TenantMember } from '../../domain/entities';

const members: Partial<TenantMember>[] = [];

vi.mock('../../stores/useRecords', () => ({
  useRecords: () => ({ recordsByCollection: {} }),
}));

vi.mock('../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ dynamicScreens: [] }),
}));

vi.mock('../../stores/useTenant', () => ({
  useTenant: () => ({ members }),
}));

const { useReferenceOptions } = await import('./useReferenceOptions');

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
