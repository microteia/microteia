import { useCallback, useMemo, useState } from 'react';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useSurfaceTabs, type SurfaceTabDescriptor } from '../../../shared/settings/useSettingsCatalog';
import { useSurfaceTabLayout } from '../../../shared/settings/useSettingValue';

export interface TabSurfaceViewModel {
  tabs: SurfaceTabDescriptor[];
  activeTab: SurfaceTabDescriptor | null;
  activeKey: string;
  setActiveKey: (key: string) => void;
  /** Há abas registradas, mas nenhuma visível — desligadas ou fora do alcance de quem olha. */
  isAllHidden: boolean;
}

export interface TabSurfaceOptions {
  surface: string;
  /** Aba aberta ao montar. Chave desconhecida cai na primeira visível. */
  initialKey?: string;
}

export const useTabSurfaceViewModel = (options: TabSurfaceOptions): TabSurfaceViewModel => {
  const { surface, initialKey } = options;
  const registered = useSurfaceTabs(surface);
  const { entries } = useSurfaceTabLayout(surface);
  const { canAny } = useAuthorization();
  const [selectedKey, setSelectedKey] = useState<string | null>(initialKey ?? null);

  const byKey = useMemo(() => new Map(registered.map((tab) => [tab.key, tab])), [registered]);

  const tabs = useMemo<SurfaceTabDescriptor[]>(
    () => entries
      .filter((entry) => entry.enabled)
      .map((entry) => byKey.get(entry.key))
      .filter((tab): tab is SurfaceTabDescriptor => !!tab)
      .filter((tab) => !tab.requiredPermissions?.length || canAny(tab.requiredPermissions)),
    [entries, byKey, canAny],
  );

  // A aba escolhida pode ter sido desligada, perdida na troca de escritório ou vetada por falta de
  // permissão;
  // derivar a ativa em vez de guardá-la em estado é o que evita a tela em branco nesses casos.
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.key === selectedKey) ?? tabs[0] ?? null,
    [tabs, selectedKey],
  );

  const setActiveKey = useCallback((key: string) => setSelectedKey(key), []);

  return {
    tabs,
    activeTab,
    activeKey: activeTab?.key ?? '',
    setActiveKey,
    isAllHidden: registered.length > 0 && tabs.length === 0,
  };
};
