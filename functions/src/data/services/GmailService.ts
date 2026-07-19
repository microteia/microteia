import { google, gmail_v1 } from 'googleapis';

export function decodePartData(part: gmail_v1.Schema$MessagePart): string {
  if (!part.body?.data) return '';
  const raw = Buffer.from(part.body.data, 'base64');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    return raw.toString('latin1');
  }
}

function collectBodies(
  part: gmail_v1.Schema$MessagePart | undefined,
  out: { html: string; text: string },
): void {
  if (!part) return;
  const mime = part.mimeType ?? '';
  if (mime === 'text/html' && !out.html && part.body?.data) {
    out.html = decodePartData(part);
  } else if (mime === 'text/plain' && !out.text && part.body?.data) {
    out.text = decodePartData(part);
  }
  for (const child of part.parts ?? []) {
    collectBodies(child, out);
  }
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: Date;
  bodyHtml?: string;
  bodyText?: string;
}

export interface IGmailService {
  getMessagesSince(
    accessToken: string,
    historyId: string,
    labelId?: string,
    allowedSubjects?: string[],
  ): Promise<GmailMessage[]>;
}

export class GmailService implements IGmailService {
  async getMessagesSince(
    accessToken: string,
    startHistoryId: string,
    labelId?: string,
    allowedSubjects?: string[],
  ): Promise<GmailMessage[]> {
    const gmail = google.gmail({ version: 'v1' });
    
    try {
      const label = labelId ?? 'INBOX';
      // Buscar histórico de mudanças desde o último historyId
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        labelId: label,
        access_token: accessToken,
      });

      const history = historyResponse.data.history || [];
      const messageIds = new Set<string>();

      // Coletar IDs únicos de mensagens adicionadas
      for (const item of history) {
        if (item.messagesAdded) {
          for (const msgAdded of item.messagesAdded) {
            if (msgAdded.message?.id) {
              messageIds.add(msgAdded.message.id);
            }
          }
        }
      }

      if (messageIds.size === 0) {
        return [];
      }

      // Buscar detalhes completos de cada mensagem
      const messages: GmailMessage[] = [];
      
      for (const messageId of messageIds) {
        try {
          const msgResponse = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
            access_token: accessToken,
          });

          const msg = msgResponse.data;
          const headers = msg.payload?.headers || [];
          
          const from = headers.find(h => h.name === 'From')?.value || '';
          const to = headers.find(h => h.name === 'To')?.value || '';
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          const dateStr = headers.find(h => h.name === 'Date')?.value || '';

          if (allowedSubjects && allowedSubjects.length > 0) {
            const subjectLower = subject.toLowerCase();
            const matchesFilter = allowedSubjects.some(filter =>
              subjectLower.includes(filter.toLowerCase())
            );
            if (!matchesFilter) {
              console.log(`Mensagem [${messageId} ${subject}] não corresponde ao filtro de assunto, ignorando. Filtros permitidos: [${allowedSubjects.join(', ')}]`);
              continue; // Pula mensagens que não correspondem ao filtro de assunto
            }
          }
          
          // Extrair corpo do email respeitando o charset declarado em cada parte MIME.
          // Percorre partes aninhadas (multipart/alternative dentro de multipart/mixed).
          const collected = { html: '', text: '' };
          collectBodies(msg.payload, collected);
          const bodyHtml = collected.html;
          const bodyText = collected.text;

          messages.push({
            id: msg.id || '',
            threadId: msg.threadId || '',
            snippet: msg.snippet || '',
            from,
            to,
            subject,
            receivedAt: dateStr ? new Date(dateStr) : new Date(),
            bodyHtml,
            bodyText,
          });
        } catch (error) {
          // Mensagem pode ter sido deletada entre listar historyId e buscar detalhes
          // Isso é normal, ignoramos silenciosamente e continuamos
          const isNotFound = error && typeof error === 'object' && 'code' in error && error.code === 404;
          
          if (isNotFound) {
            continue;
          }
          
          // Se for outro tipo de erro, propaga
          console.error(`Erro ao buscar mensagem ${messageId}:`, error);
          throw error;
        }
      }

      return messages;
    } catch (error) {
      console.error('Erro ao buscar mensagens do Gmail:', error);
      throw error;
    }
  }
}
