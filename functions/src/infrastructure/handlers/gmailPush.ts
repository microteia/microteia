import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { getDI } from '../di/container';

/**
 * Cloud Function que recebe notificações do Gmail via Pub/Sub.
 * Esta função é acionada quando o Gmail envia uma notificação sobre
 * mudanças na caixa de entrada do usuário.
 */
export const gmailPush = onMessagePublished(
  { topic: 'gmail', region: 'us-central1' },
  async (event) => {
    console.log('Notificação do Gmail recebida!');
    
    // Log dos dados da mensagem
    const messageData = event.data.message.json;
    console.log('Dados da mensagem:', messageData);
    
    // O Gmail envia notificações com o seguinte formato:
    // {
    //   emailAddress: string,
    //   historyId: string
    // }
    
    if (!messageData) {
      console.warn('Mensagem Pub/Sub sem dados JSON.');
      return;
    }

    const { emailAddress, historyId } = messageData as {
      emailAddress?: string;
      historyId?: string;
    };

    if (!emailAddress || !historyId) {
      console.warn('Notificação do Gmail sem emailAddress ou historyId:', messageData);
      return;
    }

    console.log(`Email: ${emailAddress}, HistoryId: ${historyId}`);
    
    try {
      // Buscar todas as conexões Gmail com este email
      const di = getDI();
      const gmailConnectionRepo = di.getGmailConnectionRepository();
      const connections = await gmailConnectionRepo.getConnectionsByEmail(emailAddress);

      if (connections.length === 0) {
        console.warn(`Nenhuma conexão Gmail encontrada para ${emailAddress}`);
        return;
      }

      console.log(`Encontradas ${connections.length} conexão(ões) para ${emailAddress}`);

      // Processar notificação para cada tenant que possui este email
      for (const connection of connections) {
        console.log(`Processando notificação para tenant ${connection.tenantId}`);
        
        // TODO: Implementar lógica para processar a notificação
        // 1. Buscar mensagens novas usando a Gmail API (a partir do historyId)
        // 2. Processar/armazenar as novas mensagens
        // 3. Atualizar o historyId no Firestore
        
        console.log(`HistoryId anterior: ${connection.historyId}`);
        console.log(`Novo HistoryId: ${historyId}`);
      }
    } catch (error) {
      console.error('Erro ao processar notificação do Gmail:', error);
      throw error;
    }
  },
);
