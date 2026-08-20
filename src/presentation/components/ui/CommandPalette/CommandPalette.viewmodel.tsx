import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { usePersonRecords } from '../../../shared/useCollectionRecords';
import { useCaseRecords, useContractRecords } from '../../../shared/useCollectionRecords';
import { useRecords } from '../../../../stores/useRecords';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { useWorkflowStore } from '../../../../stores/useWorkflowStore';
import { useTheme } from '../../../../stores/useTheme';
import { useAuth } from '../../../../stores/useAuth';
import { useTenant } from '../../../../stores/useTenant';
import { useCommandProviders, usePageContributions } from '../../../shared/useUiContributions';
import { navigablePages as selectNavigablePages } from '../../../shared/resolveUiContributions';
import { useLabel, useT } from '../../../shared/i18n/useT';
import type { CommandPaletteItem } from './providers/ICommandPaletteProvider';

export interface CommandPaletteGroup {
  name: string;
  items: CommandPaletteItem[];
}

export interface CommandPaletteViewModel {
  query: string;
  groups: CommandPaletteGroup[];
  selectedId: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleQueryChange: (q: string) => void;
  handleSelect: (item: CommandPaletteItem) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleClose: () => void;
}

export const useCommandPaletteViewModel = (): CommandPaletteViewModel => {
  const { close } = useCommandPalette();
  const { openTab } = useWorkspace();
  const persons = usePersonRecords();
  const cases = useCaseRecords();
  const contracts = useContractRecords();
  const { allRecords } = useRecords();
  const { definitions: screenDefinitions } = useScreenDefinitions();
  const { workflows } = useWorkflowStore();
  const { themeId, available: installedThemes, setTheme } = useTheme();
  const { signOut, userRole } = useAuth();
  const { tenantRole } = useTenant();
  const providers = useCommandProviders();
  const pageContributions = usePageContributions();
  const label = useLabel();
  const t = useT('core.ui');

  // O ⌘K procura pelo TÍTULO — então ele precisa procurar pelo título que a pessoa lê, e não pela
  // referência declarada. Resolver aqui, e não na busca, mantém um caminho só para o rótulo.
  const navigablePages = useMemo(
    () => selectNavigablePages(pageContributions, userRole)
      .map((metadata) => ({ ...metadata, title: label(metadata.title) })),
    [pageContributions, userRole, label],
  );

  // Mesmo motivo das telas: o ⌘K procura pelo nome que a pessoa lê, não pela referência declarada.
  const themes = useMemo(
    () => installedThemes.map((theme) => ({ ...theme, name: label(theme.name) })),
    [installedThemes, label],
  );

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const appContext = useMemo(
    () => ({
      openTab,
      close,
      persons,
      cases,
      contracts,
      records: allRecords,
      screenDefinitions,
      workflows,
      themeId,
      themes,
      setTheme,
      signOut,
      userRole,
      tenantRole,
      navigablePages,
      t,
      label,
    }),
    [openTab, close, persons, cases, contracts, allRecords, screenDefinitions, workflows, themeId, themes, setTheme, signOut, userRole, tenantRole, navigablePages, t, label],
  );

  const groups = useMemo<CommandPaletteGroup[]>(() => {
    const result: CommandPaletteGroup[] = [];
    for (const provider of providers) {
      // O título de um item também é referência: resolver aqui deixa a BUSCA comparando com o que
      // a pessoa lê, e não com a chave — o mesmo que já vale para as páginas navegáveis acima.
      const items = provider.getItems(query, appContext)
        .map((item) => ({ ...item, title: label(item.title, item.titleParams) }));
      if (items.length > 0) {
        result.push({ name: label(provider.group), items });
      }
    }
    return result;
  }, [query, appContext, providers, label]);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const effectiveSelectedId = useMemo<string | null>(() => {
    if (selectedId && allItems.find((i) => i.id === selectedId)) return selectedId;
    return allItems[0]?.id ?? null;
  }, [allItems, selectedId]);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    setSelectedId(null);
  }, []);

  const handleSelect = useCallback((item: CommandPaletteItem) => {
    item.onSelect();
  }, []);

  const handleClose = useCallback(() => {
    close();
  }, [close]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = allItems.findIndex((i) => i.id === effectiveSelectedId);
        if (e.key === 'ArrowDown') {
          setSelectedId(allItems[idx < allItems.length - 1 ? idx + 1 : 0]?.id ?? null);
        } else {
          setSelectedId(allItems[idx > 0 ? idx - 1 : allItems.length - 1]?.id ?? null);
        }
        return;
      }
      if (e.key === 'Enter') {
        const item = allItems.find((i) => i.id === effectiveSelectedId);
        if (item) item.onSelect();
      }
    },
    [allItems, effectiveSelectedId, close],
  );

  return {
    query,
    groups,
    selectedId: effectiveSelectedId,
    inputRef,
    handleQueryChange,
    handleSelect,
    handleKeyDown,
    handleClose,
  };
};
