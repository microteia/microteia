import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useNews } from '../../../../stores/useNews';
import { usePersonStore } from '../../../../stores/usePersonStore';
import { useCaseStore } from '../../../../stores/useCaseStore';
import { useContractStore } from '../../../../stores/useContractStore';
import { useFinancialStore } from '../../../../stores/useFinancialStore';
import { useCustomRecords } from '../../../../stores/useCustomRecords';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { useTheme } from '../../../../stores/useTheme';
import { useAuth } from '../../../../stores/useAuth';
import { useTenant } from '../../../../stores/useTenant';
import { COMMAND_PALETTE_PROVIDERS } from './providers/CommandPaletteRegistry';
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
  const { news } = useNews();
  const { persons } = usePersonStore();
  const { cases } = useCaseStore();
  const { contracts } = useContractStore();
  const { financials } = useFinancialStore();
  const { allRecords: customRecords } = useCustomRecords();
  const { definitions: screenDefinitions } = useScreenDefinitions();
  const { mode, setTheme } = useTheme();
  const { signOut, userRole } = useAuth();
  const { tenantRole } = useTenant();

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
      news,
      persons,
      cases,
      contracts,
      financials,
      customRecords,
      screenDefinitions,
      mode,
      setTheme,
      signOut,
      userRole,
      tenantRole,
    }),
    [openTab, close, news, persons, cases, contracts, financials, customRecords, screenDefinitions, mode, setTheme, signOut, userRole, tenantRole],
  );

  const groups = useMemo<CommandPaletteGroup[]>(() => {
    const result: CommandPaletteGroup[] = [];
    for (const provider of COMMAND_PALETTE_PROVIDERS) {
      const items = provider.getItems(query, appContext);
      if (items.length > 0) {
        result.push({ name: provider.group, items });
      }
    }
    return result;
  }, [query, appContext]);

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
