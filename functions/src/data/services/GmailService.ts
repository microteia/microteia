import { google } from 'googleapis';

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
  ): Promise<GmailMessage[]>;
}

export class GmailService implements IGmailService {
  async getMessagesSince(
    accessToken: string,
    startHistoryId: string,
  ): Promise<GmailMessage[]> {
    const gmail = google.gmail({ version: 'v1' });
    
    try {
      // Buscar histórico de mudanças desde o último historyId
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
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
          
          let bodyHtml = '';
          let bodyText = '';

          // Extrair corpo do email (pode estar em partes)
          const parts = msg.payload?.parts || [];
          for (const part of parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
              bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.mimeType === 'text/plain' && part.body?.data) {
              bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
          }

          // Se não houver partes, tenta o corpo direto
          if (!bodyHtml && !bodyText && msg.payload?.body?.data) {
            const decoded = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
            if (msg.payload.mimeType === 'text/html') {
              bodyHtml = decoded;
            } else {
              bodyText = decoded;
            }
          }

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
          // Isso é normal, apenas logamos e continuamos para próxima mensagem
          const isNotFound = error && typeof error === 'object' && 'code' in error && error.code === 404;
          
          if (isNotFound) {
            console.warn(`Mensagem ${messageId} não encontrada (provavelmente deletada), pulando...`);
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
