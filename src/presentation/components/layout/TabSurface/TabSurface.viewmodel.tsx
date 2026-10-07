import { useCallback, useMemo, useState } from 'react';
import type { SurfaceTabDescriptor } from '../../../shared/settings/useSettingsCatalog';
import { useVisibleSurfaceTabs } from '../../../shared/settings/useSettingValue';

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
  const { tabs, registeredCount } = useVisibleSurfaceTabs(surface);
  const [selectedKey, setSelectedKey] = useState<string | null>(initialKey ?? null);

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
    isAllHidden: registeredCount > 0 && tabs.length === 0,
  };
};
