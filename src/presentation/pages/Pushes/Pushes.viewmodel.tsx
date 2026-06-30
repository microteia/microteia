import { useState, useMemo, useCallback } from 'react';
import { usePush } from '../../../stores/usePush';
import { usePushInteraction } from '../../../stores/usePushInteraction';
import { useWorkspace } from '../../../stores/useWorkspace';
import type { Push, PushStatus } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface PushRow {
  push: Push;
  isRead: boolean;
  courtLabel: string;
  hasProcessData: boolean;
}

export interface PushesViewModel {
  rows: PushRow[];
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  unreadCount: number;
  setFilterTokens: (tokens: FilterToken[]) => void;
  handleViewPush: (push: Push) => void;
  handleMarkAsRead: (push: Push) => Promise<void>;
  handleUpdateStatus: (push: Push, status: PushStatus) => Promise<void>;
  handleDelete: (push: Push) => Promise<void>;
}

const STATUS_OPTIONS: FilterDef['options'] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'reviewed', label: 'Revisado' },
  { value: 'archived', label: 'Arquivado' },
];

const READ_STATUS_OPTIONS: FilterDef['options'] = [
  { value: 'unread', label: 'Não lidos' },
  { value: 'read', label: 'Lidos' },
];

const PARSED_BY_OPTIONS: FilterDef['options'] = [
  { value: 'regex', label: 'Regex' },
  { value: 'ai', label: 'IA' },
];

export const usePushesViewModel = (): PushesViewModel => {
  const { pushes, updateStatus, deletePush } = usePush();
  const { getInteraction, markAsRead, unreadCount } = usePushInteraction();
  const { openTab } = useWorkspace();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Pesquisar em assunto, processo...' },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'readStatus', label: 'Leitura', type: 'select', options: READ_STATUS_OPTIONS },
    { key: 'court', label: 'Tribunal', type: 'text', placeholder: 'TJBA, TJMA...' },
    { key: 'parsedBy', label: 'Processado por', type: 'select', options: PARSED_BY_OPTIONS },
  ], []);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const rows = useMemo<PushRow[]>(() => {
    let filtered = [...pushes];

    // Filtro de busca
    const search = tokenMap['search']?.[0]?.toLowerCase();
    if (search) {
      filtered = filtered.filter((p) =>
        p.subject.toLowerCase().includes(search) ||
        p.processNumber?.toLowerCase().includes(search) ||
        p.court?.toLowerCase().includes(search) ||
        p.from.toLowerCase().includes(search)
      );
    }

    // Filtro de status
    const status = tokenMap['status'];
    if (status?.length) {
      filtered = filtered.filter((p) => status.includes(p.status));
    }

    // Filtro de leitura
    const readStatus = tokenMap['readStatus']?.[0];
    if (readStatus) {
      filtered = filtered.filter((p) => {
        const interaction = getInteraction(p.id);
        const isRead = interaction?.isRead ?? false;
        return readStatus === 'read' ? isRead : !isRead;
      });
    }

    // Filtro de tribunal
    const court = tokenMap['court']?.[0]?.toLowerCase();
    if (court) {
      filtered = filtered.filter((p) => p.court?.toLowerCase().includes(court));
    }

    // Filtro de parsed by
    const parsedBy = tokenMap['parsedBy']?.[0];
    if (parsedBy) {
      filtered = filtered.filter((p) =>
        parsedBy === 'ai' ? p.parsedByAI : !p.parsedByAI
      );
    }

    return filtered.map((push) => ({
      push,
      isRead: getInteraction(push.id)?.isRead ?? false,
      courtLabel: push.court || 'Não identificado',
      hasProcessData: Boolean(push.processNumber),
    }));
  }, [pushes, tokenMap, getInteraction]);

  const handleViewPush = useCallback((push: Push) => {
    openTab({
      id: `push-${push.id}`,
      type: 'push',
      title: push.subject,
      data: { pushId: push.id },
    });
    void markAsRead(push.id);
  }, [openTab, markAsRead]);

  const handleMarkAsRead = useCallback(async (push: Push) => {
    await markAsRead(push.id);
  }, [markAsRead]);

  const handleUpdateStatus = useCallback(async (push: Push, status: PushStatus) => {
    await updateStatus(push.id, status);
  }, [updateStatus]);

  const handleDelete = useCallback(async (push: Push) => {
    await deletePush(push.id);
  }, [deletePush]);

  return {
    rows,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'pushes',
    unreadCount,
    setFilterTokens,
    handleViewPush,
    handleMarkAsRead,
    handleUpdateStatus,
    handleDelete,
  };
};
