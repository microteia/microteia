import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useAuth } from '../../../../stores/useAuth';
import { useTenant } from '../../../../stores/useTenant';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { useSettingValue } from '../../../shared/settings/useSettingValue';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import type { AssistantConversation } from '../../../../domain/repositories/IAssistantRepository';
import type {
  AssistantMessageRecord,
  AssistantStreamChunk,
  AssistantTurnRequest,
} from '../../../../domain/schema/assistant/assistantConversation';
import { ASSISTANT_WRITE_MODE_SETTING } from '../../../../domain/schema/assistant/assistantConversation';
import {
  makeDeleteAssistantConversationUseCase,
  makeRenameAssistantConversationUseCase,
  makeSendAssistantTurnUseCase,
  makeSubscribeToAssistantConversationsUseCase,
  makeSubscribeToAssistantMessagesUseCase,
} from '../../../../domain/usecases/assistant/AssistantUseCases';
import {
  ASSISTANT_SLASH_COMMANDS,
  EMPTY_DRAFT,
  applyAssistantChunk,
  buildAssistantItems,
  parseSlashCommand,
  type AssistantDraft,
  type AssistantItem,
  type AssistantToolStatus,
} from '../assistantItems';
import type { AssistantMessageLabels } from '../AssistantMessage';
import type { AssistantComposerCommand } from '../AssistantComposer/AssistantComposer.viewmodel';

export interface AssistantConversationOption {
  id: string;
  title: string;
  active: boolean;
}

export interface AssistantApprovalCall {
  id: string;
  label: string;
  input: string;
}

export interface AssistantPanelViewModel {
  title: string;
  hasConversation: boolean;
  conversations: AssistantConversationOption[];
  historyOpen: boolean;
  items: AssistantItem[];
  labels: AssistantMessageLabels;
  notices: string[];
  error: string | null;
  busy: boolean;
  compacting: boolean;
  showThinking: boolean;
  readOnly: boolean;
  approvals: AssistantApprovalCall[];
  commands: AssistantComposerCommand[];
  /** Callback ref da lista: o elemento fica num ref interno, lido só em efeito e em handler. */
  attachList: (element: HTMLDivElement | null) => void;
  renameOpen: boolean;
  renameValue: string;
  deleteOpen: boolean;
  deleting: boolean;
  toggleHistory: () => void;
  selectConversation: (id: string) => void;
  newConversation: () => void;
  send: (text: string) => void;
  stop: () => void;
  approve: () => void;
  reject: () => void;
  dismissError: () => void;
  onListScroll: () => void;
  openRename: () => void;
  changeRename: (value: string) => void;
  confirmRename: () => Promise<void>;
  cancelRename: () => void;
  openDelete: () => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

/** O quanto do fim da lista ainda conta como "no fim": quem subiu para ler não é arrastado de volta. */
const STICK_THRESHOLD_PX = 48;

const TOOL_KEY_PREFIX = 'core.assistant/tool.';

const prettyInput = (input: Record<string, unknown>): string => {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return '';
  }
};

export const useAssistantPanelViewModel = (): AssistantPanelViewModel => {
  const { assistantRepository } = useDI();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const t = useT('core.assistant');
  const label = useLabel();
  const writeMode = useSettingValue(ASSISTANT_WRITE_MODE_SETTING);

  const tenantId = currentTenant?.id ?? '';
  const userId = user?.id ?? '';

  const uc = useMemo(() => ({
    subscribeConversations: makeSubscribeToAssistantConversationsUseCase(assistantRepository),
    subscribeMessages: makeSubscribeToAssistantMessagesUseCase(assistantRepository),
    send: makeSendAssistantTurnUseCase(assistantRepository),
    rename: makeRenameAssistantConversationUseCase(assistantRepository),
    remove: makeDeleteAssistantConversationUseCase(assistantRepository),
  }), [assistantRepository]);

  const [conversationsState, setConversationsState] = useState<{ tenantId: string; list: AssistantConversation[] }>({ tenantId: '', list: [] });
  // A conversa escolhida vale para o escritório em que foi escolhida: trocar de escritório volta à vazia.
  const [selection, setSelection] = useState<{ tenantId: string; id: string } | null>(null);
  const [messagesState, setMessagesState] = useState<{ id: string; records: AssistantMessageRecord[] } | null>(null);
  const [draft, setDraft] = useState<AssistantDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renameState, setRenameState] = useState<{ open: boolean; value: string }>({ open: false, value: '' });
  const [deleteState, setDeleteState] = useState<{ open: boolean; deleting: boolean }>({ open: false, deleting: false });

  const abortRef = useRef<AbortController | null>(null);
  const textBufferRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const attachList = useCallback((element: HTMLDivElement | null) => {
    listRef.current = element;
  }, []);
  const stickRef = useRef(true);

  const selectedId = selection?.tenantId === tenantId ? selection.id : null;
  const conversations = useMemo(
    () => (conversationsState.tenantId === tenantId ? conversationsState.list : []),
    [conversationsState, tenantId],
  );
  const records = useMemo(
    () => (selectedId && messagesState?.id === selectedId ? messagesState.records : []),
    [selectedId, messagesState],
  );
  const conversation = useMemo(
    () => conversations.find((one) => one.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  useEffect(() => {
    if (!tenantId || !userId) return;
    return uc.subscribeConversations.execute(tenantId, userId, (list) => setConversationsState({ tenantId, list }));
  }, [tenantId, userId, uc]);

  useEffect(() => {
    if (!tenantId || !selectedId) return;
    return uc.subscribeMessages.execute(tenantId, selectedId, (list) => setMessagesState({ id: selectedId, records: list }));
  }, [tenantId, selectedId, uc]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  // Os pedaços de texto chegam um por token; a tela se redesenha uma vez por quadro, não por token.
  const flushText = useCallback(() => {
    frameRef.current = null;
    const text = textBufferRef.current;
    textBufferRef.current = '';
    if (text) setDraft((current) => applyAssistantChunk(current, { t: 'text', d: text }));
  }, []);

  const onChunk = useCallback((chunk: AssistantStreamChunk) => {
    if (chunk.t === 'text') {
      textBufferRef.current += chunk.d;
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(flushText);
      return;
    }
    // O texto que chegou antes deste pedaço entra antes dele: um `saved` fecha o segmento que ele terminou.
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    flushText();
    switch (chunk.t) {
      case 'start':
        setSelection({ tenantId, id: chunk.conversationId });
        break;
      case 'compacting':
        setCompacting(true);
        break;
      case 'notice':
        setCompacting(false);
        setNotices((current) => [...current, label(chunk.message, chunk.params)]);
        break;
      default:
        setDraft((current) => applyAssistantChunk(current, chunk));
    }
  }, [flushText, label, tenantId]);

  const describeFailure = useCallback((failure: unknown): string => {
    const message = failure instanceof Error ? failure.message : String(failure);
    return message.startsWith('@')
      ? label(message, errorParamsOf(failure))
      : t('panel.action-failed', { detail: message });
  }, [label, t]);

  const runTurn = useCallback(async (request: Omit<AssistantTurnRequest, 'tenantId'>, pendingUser: string | null) => {
    if (!tenantId || abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    stickRef.current = true;
    setBusy(true);
    setError(null);
    setNotices([]);
    setDraft({ ...EMPTY_DRAFT, pendingUser });
    try {
      await uc.send.execute({ tenantId, ...request }, onChunk, controller.signal);
    } catch (failure) {
      if (!controller.signal.aborted) setError(describeFailure(failure));
    } finally {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      flushText();
      // O segmento ainda aberto (interrompido, ou cortado por erro) é gravado pelo servidor e chega
      // pelo snapshot; mantê-lo aqui o mostraria duas vezes.
      setDraft((current) => ({ ...current, segments: current.segments.filter((segment) => segment.seq !== null) }));
      abortRef.current = null;
      setBusy(false);
      setCompacting(false);
    }
  }, [tenantId, uc, onChunk, describeFailure, flushText]);

  const resetView = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setNotices([]);
    setError(null);
    setHistoryOpen(false);
    stickRef.current = true;
  }, []);

  const newConversation = useCallback(() => {
    if (busy) return;
    setSelection(null);
    resetView();
  }, [busy, resetView]);

  const selectConversation = useCallback((id: string) => {
    if (busy) return;
    setSelection({ tenantId, id });
    resetView();
  }, [busy, tenantId, resetView]);

  const send = useCallback((text: string) => {
    const parsed = parseSlashCommand(text);
    if (!parsed) {
      void runTurn({ conversationId: selectedId ?? undefined, message: text }, text);
      return;
    }
    switch (parsed.command) {
      case 'new':
        newConversation();
        break;
      case 'compact':
        if (selectedId) void runTurn({ conversationId: selectedId, command: 'compact' }, null);
        else setNotices([t('command.compact.nothing')]);
        break;
      case 'help':
        setNotices([t('command.help.text')]);
        break;
      default:
        setNotices([t('command.unknown', { command: parsed.name })]);
    }
  }, [runTurn, selectedId, newConversation, t]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const pendingApprovals = useMemo(
    () => (conversation?.status === 'awaiting-approval' && !busy
      ? conversation.pendingCalls.filter((call) => call.needsApproval)
      : []),
    [conversation, busy],
  );

  const decide = useCallback((approved: boolean) => {
    if (!selectedId || !conversation) return;
    const approvals = Object.fromEntries(
      conversation.pendingCalls.filter((call) => call.needsApproval).map((call) => [call.id, approved]),
    );
    void runTurn({ conversationId: selectedId, approvals }, null);
  }, [selectedId, conversation, runTurn]);

  // A chave de catálogo não aceita `_`: o nome da ferramenta (`search_records`) vira `search-records`.
  const toolLabel = useCallback((name: string) => {
    const key = name.replace(/_/g, '-');
    const text = t(`tool.${key}`);
    return text === `${TOOL_KEY_PREFIX}${key}` ? name : text;
  }, [t]);

  const labels = useMemo<AssistantMessageLabels>(() => ({
    toolLabel,
    statusLabel: (status: AssistantToolStatus) => t(`tool.status.${status}`),
    interrupted: t('message.interrupted'),
    summaryTitle: t('summary.title'),
  }), [toolLabel, t]);

  const items = useMemo(
    () => buildAssistantItems({
      records,
      draft,
      status: conversation?.status ?? 'idle',
      pendingCalls: conversation?.pendingCalls ?? [],
      busy,
    }),
    [records, draft, conversation, busy],
  );

  // Acompanha o fim da conversa enquanto ela cresce — a menos que a pessoa tenha subido para ler.
  useEffect(() => {
    const element = listRef.current;
    if (element && stickRef.current) element.scrollTop = element.scrollHeight;
  }, [items, notices, compacting]);

  const onListScroll = useCallback(() => {
    const element = listRef.current;
    if (!element) return;
    stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD_PX;
  }, []);

  const lastItem = items[items.length - 1];
  const showThinking = busy && !compacting && !(lastItem?.kind === 'assistant' && lastItem.streaming)
    && !(lastItem?.kind === 'tool' && lastItem.status === 'running');

  const openRename = useCallback(() => {
    if (conversation) setRenameState({ open: true, value: conversation.title });
  }, [conversation]);
  const changeRename = useCallback((value: string) => setRenameState((current) => ({ ...current, value })), []);
  const cancelRename = useCallback(() => setRenameState({ open: false, value: '' }), []);
  const confirmRename = useCallback(async () => {
    if (!selectedId) return;
    try {
      await uc.rename.execute(tenantId, selectedId, renameState.value);
      setRenameState({ open: false, value: '' });
    } catch (failure) {
      setRenameState({ open: false, value: '' });
      setError(describeFailure(failure));
    }
  }, [selectedId, uc, tenantId, renameState.value, describeFailure]);

  const openDelete = useCallback(() => setDeleteState({ open: true, deleting: false }), []);
  const cancelDelete = useCallback(() => setDeleteState({ open: false, deleting: false }), []);
  const confirmDelete = useCallback(async () => {
    if (!selectedId) return;
    setDeleteState({ open: true, deleting: true });
    try {
      await uc.remove.execute(tenantId, selectedId);
      setSelection(null);
      resetView();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setDeleteState({ open: false, deleting: false });
    }
  }, [selectedId, uc, tenantId, resetView, describeFailure]);

  const commands = useMemo<AssistantComposerCommand[]>(
    () => ASSISTANT_SLASH_COMMANDS.map((name) => ({ name, description: t(`command.${name}`) })),
    [t],
  );

  const conversationOptions = useMemo<AssistantConversationOption[]>(
    () => conversations.map((one) => ({ id: one.id, title: one.title || t('panel.new'), active: one.id === selectedId })),
    [conversations, selectedId, t],
  );

  return {
    title: conversation?.title || t('panel.new'),
    hasConversation: !!selectedId,
    conversations: conversationOptions,
    historyOpen,
    items,
    labels,
    notices,
    error,
    busy,
    compacting,
    showThinking,
    readOnly: writeMode === 'off',
    approvals: pendingApprovals.map((call) => ({ id: call.id, label: toolLabel(call.name), input: prettyInput(call.input) })),
    commands,
    attachList,
    renameOpen: renameState.open,
    renameValue: renameState.value,
    deleteOpen: deleteState.open,
    deleting: deleteState.deleting,
    toggleHistory: () => setHistoryOpen((open) => !open),
    selectConversation,
    newConversation,
    send,
    stop,
    approve: () => decide(true),
    reject: () => decide(false),
    dismissError: () => setError(null),
    onListScroll,
    openRename,
    changeRename,
    confirmRename,
    cancelRename,
    openDelete,
    confirmDelete,
    cancelDelete,
  };
};
