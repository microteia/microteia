// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthorizationContext } from '../../../../stores/useAuthorization';
import type { AuthorizationContextValue } from '../../../../stores/useAuthorization';
import { WorkspaceContext } from '../../../../stores/useWorkspace';
import type { WorkspaceContextValue } from '../../../../stores/useWorkspace';
import { useArtifactPrefixBadgeViewModel } from './ArtifactPrefixBadge.viewmodel';

const setup = (permissions: string[], inWorkspace = true) => {
  const openTab = vi.fn();
  const authorization = { can: (permission: string) => permissions.includes(permission) } as unknown as AuthorizationContextValue;
  const workspace = { openTab } as unknown as WorkspaceContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthorizationContext.Provider value={authorization}>
      {inWorkspace ? <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider> : children}
    </AuthorizationContext.Provider>
  );
  return { openTab, wrapper };
};

describe('o selo do prefixo', () => {
  it('quem pode trocar o prefixo ganha o atalho, e ele abre a seção do prefixo em Configurações', () => {
    const { openTab, wrapper } = setup(['tenant.change-prefix']);
    const { result } = renderHook(() => useArtifactPrefixBadgeViewModel('abcd', 'collection'), { wrapper });

    expect(result.current).toMatchObject({ head: 'abcd_', canChange: true });
    result.current.openPrefixSettings();
    expect(openTab).toHaveBeenCalledWith('settings:tenant:customization');
  });

  it('sem a permissão, só o prefixo — com o separador do tipo de nome', () => {
    const { wrapper } = setup([]);
    const { result } = renderHook(() => useArtifactPrefixBadgeViewModel('abcd', 'artifact'), { wrapper });

    expect(result.current).toMatchObject({ head: 'abcd-', canChange: false });
  });

  it('sem prefixo definido, quem pode é convidado a defini-lo', () => {
    const { wrapper } = setup(['tenant.change-prefix']);
    const { result } = renderHook(() => useArtifactPrefixBadgeViewModel(null, 'collection'), { wrapper });

    expect(result.current).toMatchObject({ head: null, canChange: true });
  });

  it('fora do workspace não há para onde levar: sem atalho', () => {
    const { wrapper } = setup(['tenant.change-prefix'], false);
    const { result } = renderHook(() => useArtifactPrefixBadgeViewModel('abcd', 'collection'), { wrapper });

    expect(result.current.canChange).toBe(false);
  });
});
