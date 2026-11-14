import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useRecords } from '../../../../stores/useRecords';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { useWorkflowStore } from '../../../../stores/useWorkflowStore';
import { useReportDefinitions } from '../../../../stores/useReportDefinitions';
import { useSchemaContext } from '../../../shared/useSchemaContext';
import { reportAccessPermissions, snapshotSourceSpec } from '../../../../domain/schema/report/reportSnapshot';
import { useTheme } from '../../../../stores/useTheme';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useCommandProviders, usePageContributions } from '../../../shared/useUiContributions';
import { navigablePages as selectNavigablePages } from '../../../shared/resolveUiContributions';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { useWorkspaceDock } from '../../../../stores/useWorkspaceDock';
import { useDockPanels } from '../../../shared/useDockPanels';
import type { CommandPaletteItem } from './providers/ICommandPaletteProvider';
import { useServerRecordSearch } from '../../../shared/useServerRecordSearch';
import { isOwnedByParentScreen, screenDataCollection, screenReadPermission } from '../../../../domain/services/screenDataCollection';

/** Por coleção: o ⌘K mostra oito registros ao todo, e a janela por tela não precisa ser maior. */
const PALETTE_SEARCH_LIMIT = 8;

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
  const { allRecords } = useRecords();
  const { definitions: screenDefinitions } = useScreenDefinitions();
  const { workflows } = useWorkflowStore();
  const { reports } = useReportDefinitions();
  const { themeId, available: installedThemes, setTheme } = useTheme();
  const { signOut, userRole } = useAuth();
  const { can, canAny } = useAuthorization();
  const providers = useCommandProviders();
  const pageContributions = usePageContributions();
  const label = useLabel();
  const t = useT('core.ui');
  const schema = useSchemaContext();

  /*
   * Os relatórios na forma que a paleta consome, com as permissões que cada um exige JÁ derivadas.
   *
   * O provedor é função pura chamada a cada tecla: derivar o esquema lá dentro seria refazer o plano
   * de hidratação a cada letra digitada, e ele não tem como pendurar um hook.
   */
  const paletteReports = useMemo(
    () => reports.flatMap((report) => {
      // A série cobra as permissões da ORIGEM; sem origem, não há o que oferecer.
      const permissions = reportAccessPermissions(report.spec, schema, snapshotSourceSpec(report.spec, reports));
      return permissions
        ? [{ key: report.key, title: report.title, covers: report.spec.dataset.table, permissions, enabled: report.enabled }]
        : [];
    }),
    [reports, schema],
  );

  // O ⌘K procura pelo TÍTULO — então ele precisa procurar pelo título que a pessoa lê, e não pela
  // referência declarada. Resolver aqui, e não na busca, mantém um caminho só para o rótulo.
  const navigablePages = useMemo(
    () => selectNavigablePages(pageContributions, canAny, userRole === 'SYSTEM')
      .map((metadata) => ({ ...metadata, title: label(metadata.title) })),
    [pageContributions, canAny, userRole, label],
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

  /**
   * As coleções que o ⌘K busca no servidor: as mesmas cujos registros ele mostra. Uma tela que a
   * pessoa não lê, uma filha de outra ou uma que se tirou do ⌘K não custam consulta nenhuma.
   */
  const searchCollections = useMemo(
    () => [...new Set(screenDefinitions
      .filter((def) => def.origin !== 'builtin'
        && def.enabled
        && !isOwnedByParentScreen(def)
        && !def.hideRecordsFromCommandPalette
        && can(screenReadPermission(def)))
      .map(screenDataCollection))],
    [screenDefinitions, can],
  );
  const serverSearch = useServerRecordSearch(query, searchCollections, PALETTE_SEARCH_LIMIT);
  const records = useMemo(() => {
    if (serverSearch.results.length === 0) return allRecords;
    const loaded = new Set(allRecords.map((record) => `${record.collection}/${record.id}`));
    const outside = serverSearch.results.filter((record) => !loaded.has(`${record.collection}/${record.id}`));
    return outside.length > 0 ? [...allRecords, ...outside] : allRecords;
  }, [allRecords, serverSearch.results]);

  const { open: openDock } = useWorkspaceDock();
  const visibleDockPanels = useDockPanels();
  const dockPanels = useMemo(
    () => visibleDockPanels.map((panel) => ({ key: panel.key, title: panel.title, icon: panel.icon })),
    [visibleDockPanels],
  );

  const appContext = useMemo(
    () => ({
      openTab,
      close,
      records,
      recordMatches: serverSearch.matches,
      screenDefinitions,
      workflows,
      reports: paletteReports,
      themeId,
      themes,
      setTheme,
      signOut,
      userRole,
      can,
      navigablePages,
      t,
      label,
      dockPanels,
      openDock,
    }),
    [openTab, close, records, serverSearch.matches, screenDefinitions, workflows, paletteReports, themeId, themes, setTheme, signOut, userRole, can, navigablePages, t, label, dockPanels, openDock],
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
