import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { AICredentials } from '../../domain/entities/AICredentials';
import type { ChatTool, IAIChatProviderService } from '../../domain/repositories/IAIChatProviderService';
import type { AssistantConversation } from '../../domain/repositories/IAssistantConversationRepository';
import type {
  AssistantConversationStatus,
  AssistantMessageRecord,
  AssistantPendingCall,
  AssistantStreamChunk,
  AssistantTurnRequest,
  AssistantTurnResult,
} from '../../domain/schema/assistant/assistantConversation';
import {
  ASSISTANT_COMPACT_RATIO,
  ASSISTANT_CONTEXT_TOKENS_SETTING,
  ASSISTANT_MAX_STEPS,
  ASSISTANT_MESSAGE_LOAD_LIMIT,
  ASSISTANT_MESSAGE_MAX_CHARS,
  ASSISTANT_USE_PERMISSION,
  ASSISTANT_WRITE_MODE_SETTING,
  assistantContextTokens,
  assistantTitleFrom,
  assistantWriteMode,
} from '../../domain/schema/assistant/assistantConversation';
import { ASSISTANT_CHAT_FUNCTION } from '../../domain/schema/assistant/assistantBackend';
import type { AgentToolDefinition } from '../../domain/schema/agent/agentOps';
import { agentToolByName } from '../../domain/schema/agent/agentOps';
import { assistantTools, toolNeedsApproval } from '../../domain/services/assistantTools';
import { runAssistantTurn, summarizeConversation } from '../../domain/services/assistantTurn';
import { toModelHistory } from '../../domain/services/assistantHistory';
import { assistantSystemPrompt } from '../../domain/services/assistantPrompt';
import { ChatProviderError } from '../../data/services/chat/chatHttp';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import type { AgentSession } from '../agent/authenticateAgent';
import { runAgentOperation } from '../agent/runAgentOperation';
import { agentCatalog } from '../agent/agentMessages';
import { agentLocale } from '../agent/agentLocale';
import { tenantTimeZone } from '../settings/tenantTimeZone';

const REGION = 'southamerica-east1';

const asChatTool = (tool: AgentToolDefinition): ChatTool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
});

const parseRequest = (data: unknown): AssistantTurnRequest => {
  const raw = (data ?? {}) as Record<string, unknown>;
  const tenantId = typeof raw.tenantId === 'string' ? raw.tenantId.trim() : '';
  const conversationId = typeof raw.conversationId === 'string' && raw.conversationId.trim() ? raw.conversationId.trim() : undefined;
  const message = typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim() : undefined;
  const command = raw.command === 'compact' ? 'compact' : undefined;
  const approvals = raw.approvals && typeof raw.approvals === 'object' && !Array.isArray(raw.approvals)
    ? Object.fromEntries(Object.entries(raw.approvals as Record<string, unknown>).map(([id, value]) => [id, value === true]))
    : undefined;

  if (!tenantId || (!message && !approvals && !command)) {
    throw new HttpsError('invalid-argument', '@core.assistant/error.invalid-request');
  }
  if (message && message.length > ASSISTANT_MESSAGE_MAX_CHARS) {
    throw new HttpsError('invalid-argument', '@core.assistant/error.message-too-long', { max: String(ASSISTANT_MESSAGE_MAX_CHARS) });
  }
  if (!conversationId && !message) throw new HttpsError('invalid-argument', '@core.assistant/error.invalid-request');
  return { tenantId, conversationId, message, approvals, command };
};

/**
 * A credencial padrão já lança a REFERÊNCIA certa quando falta conexão ou chave
 * (`@core.automation/ai.no-default-connection`); ela segue como está para a tela.
 */
const resolveChat = async (tenantId: string): Promise<{ credentials: AICredentials; provider: IAIChatProviderService }> => {
  let credentials: AICredentials;
  try {
    credentials = await getDI().getAIConnectionRepository().getDefaultCredentials(tenantId);
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : '';
    throw new HttpsError('failed-precondition', message.startsWith('@') ? message : '@core.automation/ai.no-default-connection');
  }
  const provider = getDI().getAIChatProvider(credentials.provider);
  if (!provider) {
    throw new HttpsError('failed-precondition', '@core.assistant/error.provider-unsupported', { provider: credentials.provider });
  }
  return { credentials, provider };
};

const takeConversation = async (
  request: AssistantTurnRequest,
  ownerId: string,
  now: number,
): Promise<AssistantConversation> => {
  const repository = getDI().getAssistantConversationRepository();
  if (!request.conversationId) {
    return repository.create(request.tenantId, ownerId, assistantTitleFrom(request.message ?? ''), now);
  }
  const lease = await repository.acquire(request.tenantId, request.conversationId, ownerId, now);
  if (lease.ok) return lease.conversation;
  throw lease.reason === 'busy'
    ? new HttpsError('failed-precondition', '@core.assistant/error.busy')
    : new HttpsError('not-found', '@core.assistant/error.not-found');
};

const NEVER = new AbortController().signal;

/**
 * A conversa com o assistente — uma pergunta por chamada, respondida em streaming.
 *
 * As ferramentas são as do acesso de agente, chamadas DENTRO do processo com as permissões da pessoa
 * logada: não há token de agente, nem ida por HTTP ao `agentMcp`. A autorização é a mesma
 * (`runAgentOperation` cobra cada operação contra o conjunto concedido), e a sessão vem do login do
 * Firebase, com o segundo fator cobrado por `requirePermission`.
 *
 * O texto vai por `sendChunk` enquanto chega; o que fica vai para o Firestore nas fronteiras —
 * mensagem concluída, resultado de ferramenta. A tela que recarrega no meio encontra tudo o que já
 * terminou, e a que interrompe deixa gravado o parcial.
 */
export const assistantChat = onCall(
  { region: REGION, cors: true, timeoutSeconds: 540, memory: '512MiB' },
  async (request, response): Promise<AssistantTurnResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const input = parseRequest(request.data);
    const { tenantId } = input;
    const uid = request.auth.uid;

    const permissions = await requirePermission(tenantId, request.auth, ASSISTANT_USE_PERMISSION);
    if (!(await getDI().getInstalledExtensionCache().claimsFunction(tenantId, ASSISTANT_CHAT_FUNCTION))) {
      throw new HttpsError('failed-precondition', '@core.assistant/error.not-enabled');
    }
    const { credentials, provider } = await resolveChat(tenantId);
    const settings = await getDI().getTenantSettingsRepository().getTenantValues(tenantId);
    const writeMode = assistantWriteMode(settings[ASSISTANT_WRITE_MODE_SETTING]);
    const contextTokens = assistantContextTokens(settings[ASSISTANT_CONTEXT_TOKENS_SETTING]);

    const repository = getDI().getAssistantConversationRepository();
    const conversation = await takeConversation(input, uid, Date.now());
    const signal = response?.signal ?? NEVER;
    const emit = (chunk: AssistantStreamChunk): void => {
      // Quem fechou a aba não recebe mais nada; a gravação segue, e é ela que conta.
      response?.sendChunk(chunk).catch(() => undefined);
    };
    emit({ t: 'start', conversationId: conversation.id });

    let messageCount = conversation.messageCount;
    let contextStart = conversation.contextStart;
    let lastInputTokens = conversation.lastInputTokens;
    // Até o laço começar, uma falha devolve a conversa como estava — inclusive as chamadas que
    // esperavam aprovação. Depois que ele começa, elas já foram decididas e não podem rodar de novo.
    let status: AssistantConversationStatus = conversation.status === 'awaiting-approval' ? 'awaiting-approval' : 'idle';
    let pendingCalls: AssistantPendingCall[] = conversation.pendingCalls;
    const append = async (message: Omit<AssistantMessageRecord, 'seq' | 'createdAt'>): Promise<number> => {
      const seq = messageCount;
      messageCount += 1;
      await repository.appendMessage(tenantId, conversation.id, { ...message, seq, createdAt: Date.now() });
      return seq;
    };
    const chat = (chatRequest: Parameters<IAIChatProviderService['stream']>[1], chatSignal: AbortSignal) =>
      provider.stream(credentials, chatRequest, chatSignal);

    try {
      let history = toModelHistory(
        await repository.loadMessages(tenantId, conversation.id, contextStart, ASSISTANT_MESSAGE_LOAD_LIMIT),
      );

      const overBudget = lastInputTokens >= contextTokens * ASSISTANT_COMPACT_RATIO;
      if (input.command === 'compact' || (input.message && overBudget)) {
        if (history.length === 0 && input.command === 'compact') {
          throw new HttpsError('failed-precondition', '@core.assistant/error.nothing-to-compact');
        }
        emit({ t: 'compacting' });
        const summary = await summarizeConversation(chat, history, signal);
        if (summary) {
          const seq = await append({ role: 'user', kind: 'summary', parts: [{ type: 'text', text: summary }] });
          emit({ t: 'saved', seq });
          emit({ t: 'notice', message: '@core.assistant/notice.compacted' });
          contextStart = seq;
          lastInputTokens = 0;
          history = toModelHistory([{ seq, role: 'user', kind: 'summary', parts: [{ type: 'text', text: summary }], createdAt: Date.now() }]);
        }
      }

      if (!input.message && !input.approvals) return { conversationId: conversation.id, status };
      if (input.approvals && !input.message && pendingCalls.length === 0) {
        throw new HttpsError('failed-precondition', '@core.assistant/error.nothing-pending');
      }

      const session: AgentSession = {
        tenantId,
        userId: uid,
        grantId: '',
        grantName: '',
        permissions,
        ceiling: [],
        expiresAt: null,
        lastUsedAt: null,
      };
      const [bundles, locale, timeZone, tenant] = await Promise.all([
        getDI().getInstalledExtensionCache().messageBundles(tenantId),
        agentLocale(tenantId, uid),
        tenantTimeZone(tenantId, uid),
        getDI().getTenantRepository().getById(tenantId),
      ]);
      const catalog = agentCatalog(bundles, locale);
      const token = request.auth.token as Record<string, unknown>;
      const userName = typeof token.name === 'string' && token.name ? token.name : typeof token.email === 'string' ? token.email : uid;

      const resume = pendingCalls.length > 0 ? { pending: pendingCalls, approvals: input.approvals ?? {} } : undefined;
      status = 'idle';
      pendingCalls = [];
      const outcome = await runAssistantTurn(
        {
          chat,
          system: assistantSystemPrompt({
            officeName: tenant?.name ?? tenantId,
            userName,
            locale,
            timeZone,
            now: new Date(),
            writeMode,
          }),
          tools: assistantTools(permissions, writeMode).map(asChatTool),
          needsApproval: (name) => toolNeedsApproval(agentToolByName(name), writeMode),
          runTool: async (name, toolInput) => {
            try {
              const result = await runAgentOperation(name, toolInput, session, catalog);
              return { content: JSON.stringify(result.ok ? result.value : result.error), isError: !result.ok };
            } catch (failure) {
              console.error(`[assistantChat] Ferramenta ${name} falhou:`, failure);
              return { content: JSON.stringify({ error: 'tool-failed' }), isError: true };
            }
          },
          append: (message) => append(message),
          emit,
          signal,
          maxSteps: ASSISTANT_MAX_STEPS,
        },
        {
          history,
          userText: input.message,
          // Uma pergunta nova com chamadas esperando conta como recusa delas: a pessoa seguiu adiante.
          resume,
        },
      );
      status = outcome.status;
      pendingCalls = outcome.pendingCalls;
      if (outcome.lastInputTokens !== null) lastInputTokens = outcome.lastInputTokens;
      return { conversationId: conversation.id, status };
    } catch (failure) {
      if (failure instanceof ChatProviderError) {
        throw new HttpsError('unavailable', '@core.assistant/error.provider', { detail: failure.detail });
      }
      throw failure;
    } finally {
      await repository.update(tenantId, conversation.id, {
        status,
        leaseUntil: null,
        pendingCalls,
        contextStart,
        lastInputTokens,
        messageCount,
        updatedAt: Date.now(),
      });
    }
  },
);
