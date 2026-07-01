import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { usePush } from '../../../stores/usePush';
import { usePushInteraction } from '../../../stores/usePushInteraction';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useDeadlineStore } from '../../../stores/useDeadlineStore';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useCaseLookup } from '../../../stores/useCaseLookup';
import { useTenant } from '../../../stores/useTenant';
import { setNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import type { Push } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface PushRow {
  push: Push;
  isRead: boolean;
  courtLabel: string;
  hasProcessData: boolean;
  isBodyVisible: boolean;
  isTrustedSource: boolean;
  sanitizedHtml?: string;
  plainText?: string;
  linkedDeadlineIds: string[];
  mostRecentDeadlineId?: string;
  caseId?: string;
  displayCourt?: string;
  displayActiveParty?: string;
  displayPassiveParty?: string;
  displayLegalClass?: string;
  displayFilingDate?: Date;
  casePhase?: string;
  caseStatus?: string;
  caseCauseValue?: number;
}

export interface PushesViewModel {
  rows: PushRow[];
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  unreadCount: number;
  createDeadlineModalPush: Push | null;
  setFilterTokens: (tokens: FilterToken[]) => void;
  handleMarkAsRead: (push: Push) => Promise<void>;
  handleUpdateStatus: (push: Push, status: 'pending' | 'reviewed' | 'archived') => Promise<void>;
  handleDelete: (push: Push) => Promise<void>;
  handleOpenDashboard: () => void;
  handleToggleBody: (pushId: string) => void;
  handleOpenCreateDeadlineModal: (push: Push) => void;
  handleCloseCreateDeadlineModal: () => void;
  handleOpenDeadline: (deadlineId: string) => void;
  handleOpenCase: (caseId: string) => void;
  getPhaseColor: (phase: string) => string;
  getStatusColor: (status: string) => string;
}

const STATUS_OPTIONS: FilterDef['options'] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'reviewed', label: 'Revisado' },
  { value: 'archived', label: 'Arquivado' },
  { value: 'fault', label: 'Falha' },
];

const READ_STATUS_OPTIONS: FilterDef['options'] = [
  { value: 'unread', label: 'Não lidos' },
  { value: 'read', label: 'Lidos' },
];

const PARSED_BY_OPTIONS: FilterDef['options'] = [
  { value: 'regex', label: 'Regex' },
  { value: 'ai', label: 'IA' },
];

const sanitizeHtml = (html: string): string => {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
    .replace(/<object[^>]*>.*?<\/object>/gis, '')
    .replace(/<embed[^>]*>/gi, '');
};
  const extractEmail = (from: string): string => {
    const angle = from.match(/<([^>]+)>/);
    if (angle) {
      return angle[1].toLowerCase();
    }
    const email = from.match(/[^\s<>]+@[^\s<>]+/);
    if (email) {
      return email[0].toLowerCase();
    }
    return from.toLowerCase();
  }
  const isTrustedSource = (from: string): boolean => {
  const email = extractEmail(from);
  return email.endsWith('.jus.br') || email.endsWith('@publicacoesonline.com.br');
  };

export const usePushesViewModel = (): PushesViewModel => {
  const { pushes, updateStatus, deletePush } = usePush();
  const { getInteraction, markAsRead, unreadCount } = usePushInteraction();
  const { openTab } = useWorkspace();
  const { deadlines } = useDeadlineStore();
  const { cases } = useCaseStore();
  const { phaseConfigs, statusConfigs } = useCaseLookup();
  const { currentTenant } = useTenant();
  const theme = useTheme();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(new Set());
  const [createDeadlineModalPush, setCreateDeadlineModalPush] = useState<Push | null>(null);

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

    return filtered.map((push) => {
      const isBodyVisible = expandedBodies.has(push.id);
      const trusted = isTrustedSource(push.from);

      // Buscar prazos vinculados a este push
      const linkedDeadlines = deadlines.filter((d) => d.pushIds?.includes(push.id));
      const linkedDeadlineIds = linkedDeadlines.map((d) => d.id);
      const mostRecentDeadlineId = linkedDeadlines.length > 0
        ? linkedDeadlines.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].id
        : undefined;

      // Buscar o case correspondente ao número do processo
      const matchingCase = push.processNumber
        ? cases.find((c) => c.caseNumber === push.processNumber)
        : undefined;

      // Campos com fallback para dados do Case quando vazios no Push
      const displayCourt = push.court || matchingCase?.court || undefined;
      const displayActiveParty = push.activeParty || matchingCase?.personName || undefined;
      const displayPassiveParty = push.passiveParty ||
        (matchingCase?.opposingParties && matchingCase.opposingParties.length > 0
          ? matchingCase.opposingParties.map(p => p.name).join(', ')
          : undefined);
      const displayLegalClass = push.legalClass || matchingCase?.type || undefined;
      const displayFilingDate = push.filingDate || matchingCase?.filedAt || undefined;

      return {
        push,
        isRead: getInteraction(push.id)?.isRead ?? false,
        courtLabel: displayCourt || 'Não identificado',
        hasProcessData: Boolean(push.processNumber),
        isBodyVisible,
        isTrustedSource: trusted,
        sanitizedHtml: trusted && push.emailBodyHtml ? sanitizeHtml(push.emailBodyHtml) : undefined,
        plainText: push.emailBodyText || push.emailBodyHtml?.replace(/<[^>]*>/g, ''),
        linkedDeadlineIds,
        mostRecentDeadlineId,
        caseId: matchingCase?.id,
        displayCourt,
        displayActiveParty,
        displayPassiveParty,
        displayLegalClass,
        displayFilingDate,
        casePhase: matchingCase?.phase,
        caseStatus: matchingCase?.status,
        caseCauseValue: matchingCase?.causeValue ?? undefined,
      };
    });
  }, [pushes, tokenMap, getInteraction, expandedBodies, deadlines, cases]);

  const handleMarkAsRead = useCallback(async (push: Push) => {
    await markAsRead(push.id);
  }, [markAsRead]);

  const handleUpdateStatus = useCallback(async (push: Push, status: 'pending' | 'reviewed' | 'archived') => {
    if (!currentTenant) return;
    await updateStatus(push.id, status);
  }, [updateStatus, currentTenant]);

  const handleDelete = useCallback(async (push: Push) => {
    await deletePush(push.id);
  }, [deletePush]);

  const handleOpenDashboard = useCallback(() => {
    openTab('dashboard-pushes');
  }, [openTab]);

  const handleToggleBody = useCallback((pushId: string) => {
    setExpandedBodies((prev) => {
      const next = new Set(prev);
      if (next.has(pushId)) {
        next.delete(pushId);
      } else {
        next.add(pushId);
      }
      return next;
    });
  }, []);

  const handleOpenCreateDeadlineModal = useCallback((push: Push) => {
    setCreateDeadlineModalPush(push);
  }, []);

  const handleCloseCreateDeadlineModal = useCallback(() => {
    setCreateDeadlineModalPush(null);
  }, []);

  const handleOpenDeadline = useCallback((deadlineId: string) => {
    // Buscar o deadline para pegar o caseId
    const deadline = deadlines.find((d) => d.id === deadlineId);
    if (deadline?.caseId) {
      // Configurar filtro de processo e abrir página de Deadlines
      setNavigationIntent('deadlines', [{ key: 'case', values: [deadline.caseId] }]);
      openTab('deadlines');
    }
  }, [deadlines, openTab]);

  const handleOpenCase = useCallback((caseId: string) => {
    openTab(`view-case:${caseId}`);
  }, [openTab]);

  const getPhaseColor = useCallback((phase: string): string => {
    const config = phaseConfigs.find((p) => p.key === phase);
    const colorValue = config?.color ?? 'textSecondary';
    return colorValue.startsWith('#') ? colorValue : (theme.colors as Record<string, string>)[colorValue] ?? theme.colors.textSecondary;
  }, [phaseConfigs, theme]);

  const getStatusColor = useCallback((status: string): string => {
    const config = statusConfigs.find((s) => s.key === status);
    const colorValue = config?.color ?? 'textSecondary';
    return colorValue.startsWith('#') ? colorValue : (theme.colors as Record<string, string>)[colorValue] ?? theme.colors.textSecondary;
  }, [statusConfigs, theme]);

  return {
    rows,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'pushes',
    unreadCount,
    createDeadlineModalPush,
    setFilterTokens,
    handleMarkAsRead,
    handleUpdateStatus,
    handleDelete,
    handleOpenDashboard,
    handleToggleBody,
    handleOpenCreateDeadlineModal,
    handleCloseCreateDeadlineModal,
    handleOpenDeadline,
    handleOpenCase,
    getPhaseColor,
    getStatusColor,
  };
};
