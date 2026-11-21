import { useCallback, useMemo, useState } from 'react';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useWorkspace } from '../../../stores/useWorkspace';
import { PERMISSION_DOCUMENT_TEMPLATES_MANAGE } from '../../../domain/schema/access';
import {
  DOCUMENT_TEMPLATE_DESIGN_TAB,
  buildDocumentTemplateCloneTabKey,
  buildDocumentTemplateDesignTabKey,
} from '../../../shared/constants/documentTemplateKeys';
import type { DocumentTemplateRow } from '../../shared/documents/useDocumentTemplateCatalog';
import {
  DOCUMENT_TEMPLATE_ROW_STATES,
  useDocumentTemplateCatalog,
} from '../../shared/documents/useDocumentTemplateCatalog';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import { useT } from '../../shared/i18n/useT';

export interface DocumentTemplatesViewModel {
  canManage: boolean;
  /** Há modelos, filtrados ou não — distingue "nenhum modelo" de "nenhum passa pelo filtro". */
  hasAny: boolean;
  /** As linhas que passam pelo filtro. */
  rows: DocumentTemplateRow[];
  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  savedFiltersScreenKey: string;
  create: () => void;
  open: (row: DocumentTemplateRow) => void;
  customize: (row: DocumentTemplateRow) => Promise<void>;
  clone: (row: DocumentTemplateRow) => void;
  toggleDisabled: (row: DocumentTemplateRow) => Promise<void>;
  /** A linha cuja versão do escritório se pede para apagar — excluir, ou restaurar o original. */
  toRemove: DocumentTemplateRow | null;
  isRemoving: boolean;
  askRemove: (row: DocumentTemplateRow) => void;
  cancelRemove: () => void;
  confirmRemove: () => Promise<void>;
}

const OUTDATED_FILTER = 'outdated';

/**
 * A lista dos modelos — a mesma forma das outras listagens do produto. Editar acontece numa ABA por
 * modelo; aqui ficam só os gestos que mudam o estado de uma chave sem abrir o conteúdo dela.
 */
export const useDocumentTemplatesViewModel = (): DocumentTemplatesViewModel => {
  const t = useT('core.documents');
  const { can } = useAuthorization();
  const { openTab } = useWorkspace();
  const catalog = useDocumentTemplateCatalog();
  const { rows } = catalog;

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [toRemove, setToRemove] = useState<DocumentTemplateRow | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const filterDefs = useMemo<FilterDef[]>(() => {
    const screens = [...new Set(rows.map((row) => row.screenLabel))].sort((left, right) => left.localeCompare(right));
    return [
      { key: 'search', label: t('core.ui/filter.search'), type: 'text', placeholder: t('template.search') },
      {
        key: 'state',
        label: t('filter.state'),
        type: 'multiselect',
        options: [
          ...DOCUMENT_TEMPLATE_ROW_STATES.map((state) => ({ value: state, label: t(`state.${state}`) })),
          { value: OUTDATED_FILTER, label: t('state.outdated') },
        ],
      },
      { key: 'screen', label: t('field.collection'), type: 'multiselect', options: screens.map((screen) => ({ value: screen, label: screen })) },
    ];
  }, [rows, t]);

  const visibleRows = useMemo(() => {
    const valuesOf = (key: string) => filterTokens.find((token) => token.key === key)?.values ?? [];
    const needle = (valuesOf('search')[0] ?? '').trim().toLocaleLowerCase();
    const states = valuesOf('state');
    const screens = valuesOf('screen');
    return rows.filter((row) =>
      (!needle || [row.title, row.screenLabel, row.key, row.extension ?? '']
        .some((text) => text.toLocaleLowerCase().includes(needle)))
      && (states.length === 0 || states.includes(row.state) || (row.outdated && states.includes(OUTDATED_FILTER)))
      && (screens.length === 0 || screens.includes(row.screenLabel)));
  }, [rows, filterTokens]);

  const create = useCallback(() => openTab(DOCUMENT_TEMPLATE_DESIGN_TAB), [openTab]);

  const open = useCallback(
    (row: DocumentTemplateRow) => openTab(buildDocumentTemplateDesignTabKey(row.key)),
    [openTab],
  );

  /** A cópia é gravada ANTES de abrir: a aba que abre já é a de um modelo editável. */
  const customize = useCallback(
    async (row: DocumentTemplateRow) => {
      if (await catalog.customize(row.key)) openTab(buildDocumentTemplateDesignTabKey(row.key));
    },
    [catalog, openTab],
  );

  const clone = useCallback(
    (row: DocumentTemplateRow) => openTab(buildDocumentTemplateCloneTabKey(row.key)),
    [openTab],
  );

  const toggleDisabled = useCallback((row: DocumentTemplateRow) => catalog.toggleDisabled(row.key), [catalog]);

  const askRemove = useCallback((row: DocumentTemplateRow) => setToRemove(row), []);
  const cancelRemove = useCallback(() => setToRemove(null), []);

  const confirmRemove = useCallback(async () => {
    if (!toRemove) return;
    setIsRemoving(true);
    try {
      await catalog.remove(toRemove.key);
    } finally {
      setIsRemoving(false);
      setToRemove(null);
    }
  }, [toRemove, catalog]);

  return {
    canManage: can(PERMISSION_DOCUMENT_TEMPLATES_MANAGE),
    hasAny: rows.length > 0,
    rows: visibleRows,
    filterDefs,
    filterTokens,
    setFilterTokens,
    savedFiltersScreenKey: 'document-templates',
    create,
    open,
    customize,
    clone,
    toggleDisabled,
    toRemove,
    isRemoving,
    askRemove,
    cancelRemove,
    confirmRemove,
  };
};
