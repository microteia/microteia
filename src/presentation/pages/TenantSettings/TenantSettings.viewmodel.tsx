import { useMemo } from 'react';

export interface TenantSettingsViewModel {
  /** A aba pedida pela chave da aba do workspace (`tenant-settings:members`), quando há uma. */
  initialTabKey: string | undefined;
}

/**
 * O que sobrou da tela depois que as abas viraram contribuições: traduzir o endereço da aba do
 * workspace na chave da aba da superfície. Quem sabe que abas existem é o `TabSurface`; quem sabe
 * quais delas o papel de quem olha pode ver é a metadata de cada uma.
 */
export const useTenantSettingsViewModel = (tabKey?: string): TenantSettingsViewModel => {
  const initialTabKey = useMemo(() => {
    const prefix = 'tenant-settings:';
    if (!tabKey || !tabKey.startsWith(prefix)) return undefined;
    return tabKey.slice(prefix.length) || undefined;
  }, [tabKey]);

  return { initialTabKey };
};
