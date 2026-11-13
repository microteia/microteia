import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ASSISTANT_TITLE_MAX_CHARS } from '../../domain/schema/assistant/assistantConversation';
import { getDI } from '../di/container';
import { requireMemberSession } from './shared/requirePermission';

const REGION = 'southamerica-east1';

interface AssistantConversationRequest {
  tenantId: string;
  conversationId: string;
  action: 'rename' | 'delete';
  title?: string;
}

/**
 * Renomear e apagar uma conversa do assistente. Callable, e não escrita direta do cliente, porque a
 * regra fecha a coleção para escrita: a conversa tem trava, contadores e uma subcoleção, e apagar
 * pelo cliente deixaria as mensagens órfãs.
 *
 * Só exige ser DONO, e não `assistant.use`: quem perdeu a permissão continua podendo limpar o que é
 * seu — o mesmo critério dos relatórios pessoais.
 */
export const assistantConversation = onCall(
  { region: REGION, cors: true },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const raw = (request.data ?? {}) as Partial<AssistantConversationRequest>;
    const tenantId = typeof raw.tenantId === 'string' ? raw.tenantId.trim() : '';
    const conversationId = typeof raw.conversationId === 'string' ? raw.conversationId.trim() : '';
    if (!tenantId || !conversationId || (raw.action !== 'rename' && raw.action !== 'delete')) {
      throw new HttpsError('invalid-argument', '@core.assistant/error.invalid-request');
    }

    await requireMemberSession(tenantId, request.auth);
    const repository = getDI().getAssistantConversationRepository();
    const conversation = await repository.get(tenantId, conversationId);
    if (!conversation || conversation.ownerId !== request.auth.uid) {
      throw new HttpsError('not-found', '@core.assistant/error.not-found');
    }

    if (raw.action === 'delete') {
      await repository.remove(tenantId, conversationId);
      return { ok: true };
    }

    const title = typeof raw.title === 'string' ? raw.title.replace(/\s+/g, ' ').trim() : '';
    if (!title || title.length > ASSISTANT_TITLE_MAX_CHARS) {
      throw new HttpsError('invalid-argument', '@core.assistant/error.title-invalid', { max: String(ASSISTANT_TITLE_MAX_CHARS) });
    }
    await repository.update(tenantId, conversationId, { title, updatedAt: Date.now() });
    return { ok: true };
  },
);
