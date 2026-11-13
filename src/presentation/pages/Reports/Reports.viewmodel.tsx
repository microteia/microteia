import { useCallback, useMemo, useState } from 'react';
import { useReportDefinitions } from '../../../stores/useReportDefinitions';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useSchemaContext } from '../../shared/useSchemaContext';
import { useLabel, useT } from '../../shared/i18n/useT';
import { useExtensionName } from '../../shared/extensions/useExtensionName';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import { PERMISSION_REPORTS_MANAGE, PERMISSION_REPORTS_PERSONAL } from '../../../domain/schema/access';
import { reportAccessPermissions, snapshotSourceSpec } from '../../../domain/schema/report/reportSnapshot';
import { buildReportDesignTabKey, buildReportTabKey } from '../../../shared/constants/reportKeys';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';

export interface ReportsListItem {
  id: string;
  /** O id do DOCUMENTO — o que a exclusão precisa. */
  documentId: string;
  title: string;
  description: string | null;
  icon: string;
  /** Relatório de PACOTE não se edita nem se exclui: o dono dele é a extensão. */
  managed: boolean;
  /** O nome da extensão que trouxe o relatório; `null` quando ele é do escritório. */
  extension: string | null;
  /** O que o relatório cobre, mostrado como a linha de baixo do item. */
  covers: string;
  /** Só esta pessoa o vê — mora nos relatórios pessoais. */
  personal: boolean;
  /** Editar e excluir: o pessoal é sempre de quem o vê; o do escritório, de quem gerencia. */
  canEdit: boolean;
  /** Levar para os relatórios do escritório: só o pessoal, e só para quem gerencia relatórios. */
  canShare: boolean;
}

export interface ReportsViewModel {
  title: string;
  reports: ReportsListItem[];
  isEmpty: boolean;
  isLoading: boolean;

  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  savedFiltersScreenKey: string;

  open: (reportKey: string) => void;
  /** Quem gerencia relatórios cria e edita; quem só lê, não vê os gestos. */
  canManage: boolean;
  /** Criar: quem gerencia relatórios OU quem pode criar os pessoais. */
  canCreate: boolean;
  toShare: ReportsListItem | null;
  askShare: (report: ReportsListItem) => void;
  cancelShare: () => void;
  confirmShare: () => Promise<void>;
  isSharing: boolean;
  create: () => void;
  edit: (reportKey: string) => void;

  toDelete: ReportsListItem | null;
  askDelete: (report: ReportsListItem) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;

  labels: {
    create: string;
    edit: string;
    remove: string;
    filterPlaceholder: string;
    filterSearch: string;
    empty: string;
    createFirst: string;
    deleteTitle: string;
    deleteMessage: string;
    deleteConfirm: string;
    personal: string;
    share: string;
    shareTitle: string;
    shareMessage: string;
    shareConfirm: string;
  };
}

/**
 * A lista de relatórios do escritório.
 *
 * Ela esconde o relatório que esta pessoa não poderia executar, e a pergunta é a MESMA que o
 * servidor faz: a leitura de cada coleção que o relatório toca, inclusive as alcançadas por
 * referência. Mostrar um relatório que a callable vai recusar seria oferecer uma porta fechada.
 */
export const useReportsViewModel = (): ReportsViewModel => {
  const { reports, isLoading, deleteReport, shareReport } = useReportDefinitions();
  const { canAll, can } = useAuthorization();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();
  const schema = useSchemaContext();
  const label = useLabel();
  const extensionOf = useExtensionName();
  const t = useT('core.reports');

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [toDelete, setToDelete] = useState<ReportsListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toShare, setToShare] = useState<ReportsListItem | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const canManage = can(PERMISSION_REPORTS_MANAGE);

  const visible = useMemo(
    () => reports
      .filter((report) => report.enabled !== false)
      .filter((report) => {
        const permissions = reportAccessPermissions(report.spec, schema, snapshotSourceSpec(report.spec, reports));
        return permissions !== null && canAll(permissions);
      })
      .map((report) => ({
        id: report.key,
        documentId: report.id,
        title: label(report.title),
        description: report.description ? label(report.description) : null,
        icon: report.icon ?? 'fileChart',
        managed: report.managed === true,
        extension: extensionOf(report.ownerPluginId),
        covers: report.spec.dataset.table,
        personal: !!report.ownerId,
        canEdit: report.managed !== true && (!!report.ownerId || canManage),
        canShare: !!report.ownerId && canManage,
      })),
    [reports, canAll, schema, label, extensionOf, canManage],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: t('core.ui/filter.search'), type: 'text', placeholder: t('list.filter.search') },
  ], [t]);

  const filtered = useMemo(() => {
    const search = (filterTokens.find((token) => token.key === 'search')?.values[0] ?? '').toLowerCase();
    if (!search) return visible;
    return visible.filter((report) => `${report.title} ${report.covers}`.toLowerCase().includes(search));
  }, [visible, filterTokens]);

  const open = useCallback((reportKey: string) => openTab(buildReportTabKey(reportKey)), [openTab]);
  const create = useCallback(() => openTab('report-design'), [openTab]);
  const edit = useCallback(
    (reportKey: string) => openTab(buildReportDesignTabKey(reportKey)),
    [openTab],
  );

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await deleteReport(toDelete.documentId);
      notify(t('delete.done'), 'success');
      setToDelete(null);
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : String(caught);
      notify(label(raw, errorParamsOf(caught)), 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [toDelete, deleteReport, notify, t, label]);

  // A chave pessoal pode já ser de um relatório do escritório: aí o repositório recusa, e a mensagem diz
  // qual chave — renomear é gesto de quem sabe o que o relatório responde.
  const confirmShare = useCallback(async () => {
    if (!toShare) return;
    setIsSharing(true);
    try {
      await shareReport(toShare.documentId, toShare.id);
      notify(t('share.done'), 'success');
      setToShare(null);
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : String(caught);
      notify(label(raw, errorParamsOf(caught)), 'error');
    } finally {
      setIsSharing(false);
    }
  }, [toShare, shareReport, notify, t, label]);

  return {
    title: t('page.reports'),
    reports: filtered,
    isEmpty: filtered.length === 0,
    isLoading,
    filterDefs,
    filterTokens,
    setFilterTokens,
    savedFiltersScreenKey: 'reports',
    open,
    canManage,
    canCreate: canManage || can(PERMISSION_REPORTS_PERSONAL),
    toShare,
    askShare: setToShare,
    cancelShare: () => setToShare(null),
    confirmShare,
    isSharing,
    create,
    edit,
    toDelete,
    askDelete: setToDelete,
    cancelDelete: () => setToDelete(null),
    confirmDelete,
    isDeleting,
    labels: {
      create: t('list.create'),
      edit: t('list.edit'),
      personal: t('list.personal'),
      share: t('share.action'),
      shareTitle: t('share.title'),
      shareMessage: t('share.message'),
      shareConfirm: t('share.confirm'),
      remove: t('design.remove'),
      filterPlaceholder: t('list.filter.placeholder'),
      filterSearch: t('list.filter.search'),
      empty: t('list.empty'),
      createFirst: t('list.create-first'),
      deleteTitle: t('design.delete'),
      deleteMessage: t('design.delete.confirm', { name: toDelete?.title ?? '' }),
      deleteConfirm: t('core.ui/action.delete'),
    },
  };
};
