import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { getDI } from '../di/container';

// Remetentes permitidos (tribunais de justiça)
// TODO: Expandir conforme necessário
const ALLOWED_SENDERS = [
  'pje@tjba.jus.br',          // TJ Bahia
  'contatopje@tjma.jus.br',   // TJ Maranhão
  'alexnaldocs@hotmail.com',  // Placeholder para testes
];

/**
 * Cloud Function que recebe notificações do Gmail via Pub/Sub.
 * Esta função é acionada quando o Gmail envia uma notificação sobre
 * mudanças na caixa de entrada do usuário.
 * 
 * Fluxo:
 * 1. Recebe notificação com emailAddress e historyId
 * 2. Busca todas as conexões Gmail com esse email
 * 3. Para cada tenant que possui o email:
 *    - Busca emails novos usando Gmail API (a partir do historyId)
 *    - Filtra apenas emails de tribunais permitidos
 *    - Extrai dados processuais do email
 *    - Cria registro na coleção pushes do tenant
 *    - Atualiza o historyId da conexão
 */
export const gmailPush = onMessagePublished(
  { topic: 'gmail', region: 'us-central1' },
  async (event) => {
    console.log('Notificação do Gmail recebida!');
    
    const messageData = event.data.message.json;
    console.log('Dados da mensagem:', messageData);
    
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
      const di = getDI();
      const gmailConnectionRepo = di.getGmailConnectionRepository();
      const gmailService = di.getGmailService();
      const emailParserService = di.getEmailParserService();
      const createPushUC = di.getCreatePushUseCase();
      
      // Buscar todas as conexões Gmail com este email
      const connections = await gmailConnectionRepo.getConnectionsByEmail(emailAddress);

      if (connections.length === 0) {
        console.warn(`Nenhuma conexão Gmail encontrada para ${emailAddress}`);
        return;
      }

      console.log(`Encontradas ${connections.length} conexão(ões) para ${emailAddress}`);

      // Processar notificação para cada tenant que possui este email
      for (const connection of connections) {
        console.log(`Processando notificação para tenant ${connection.tenantId}`);
        
        const startHistoryId = connection.historyId || historyId;
        console.log(`Buscando emails desde historyId: ${startHistoryId}`);

        try {
          // Buscar token de acesso da conexão
          const tokenData = await gmailConnectionRepo.getAccessToken(connection.id);
          
          if (!tokenData) {
            console.warn(`Token não encontrado para conexão ${connection.id}`);
            continue;
          }

          // Renovar token se expirado
          let currentAccessToken = tokenData.accessToken;
          if (tokenData.expiresAt < new Date()) {
            console.log(`Token expirado para conexão ${connection.id}, renovando...`);
            try {
              const authService = di.getGoogleAuthService();
              const config = {
                clientId: process.env.GMAIL_CLIENT_ID || '',
                clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
                redirectUri: process.env.GMAIL_REDIRECT_URI || '',
              };
              
              const refreshed = await authService.refreshAccessToken(tokenData.refreshToken, config);
              currentAccessToken = refreshed.accessToken;
              
              // Atualizar token no Firestore
              await gmailConnectionRepo.updateAccessToken(
                connection.id,
                refreshed.accessToken,
                refreshed.expiresAt,
                refreshed.refreshToken
              );
              
              console.log(`Token renovado com sucesso para conexão ${connection.id}`);
            } catch (error) {
              console.error(`Erro ao renovar token para conexão ${connection.id}:`, error);
              continue;
            }
          }

          // Buscar emails novos desde o último historyId
          const newMessages = await gmailService.getMessagesSince(
            currentAccessToken,
            startHistoryId
          );

          console.log(`${newMessages.length} email(s) novo(s) encontrado(s)`);

          // Filtrar apenas emails de remetentes permitidos (tribunais)
          const courtMessages = newMessages.filter(msg =>
            ALLOWED_SENDERS.some(sender => msg.from.toLowerCase().includes(sender.toLowerCase()))
          );

          console.log(`${courtMessages.length} email(s) de tribunais encontrado(s)`);

          for (const message of courtMessages) {
            // Verificar se já processamos este email
            const pushRepo = di.getPushRepository();
            const existing = await pushRepo.getByEmailId(connection.tenantId, message.id);
            
            if (existing) {
              console.log(`Email ${message.id} já processado, pulando`);
              continue;
            }

            // Fazer parsing do email
            const parsedData = await emailParserService.parse(
              message.bodyText || '',
              message.from,
              message.bodyHtml
            );

            // Criar push no tenant
            const push = await createPushUC.execute(connection.tenantId, {
              emailId: message.id,
              from: message.from,
              to: message.to,
              subject: message.subject,
              receivedAt: message.receivedAt,
              emailBodyHtml: message.bodyHtml,
              emailBodyText: message.bodyText,
              processNumber: parsedData.processNumber,
              court: parsedData.court,
              activeParty: parsedData.activeParty,
              passiveParty: parsedData.passiveParty,
              legalClass: parsedData.legalClass,
              filingDate: parsedData.filingDate,
              distributionType: parsedData.distributionType,
              processSubject: parsedData.processSubject,
              movements: parsedData.movements,
              status: 'pending',
              parsedByAI: parsedData.parsedByAI,
              parsingError: parsedData.parsingError,
              createdBy: 'system',
            });

            console.log(`Push criado: ${push.id} (Processo: ${push.processNumber || 'N/A'})`);
          }

          // Atualizar historyId da conexão para o novo valor
          await gmailConnectionRepo.updateHistoryId(connection.id, historyId);
          console.log(`HistoryId atualizado para ${historyId}`);

        } catch (error) {
          console.error(`Erro ao processar tenant ${connection.tenantId}:`, error);
          // Continua para próximo tenant mesmo se este falhar
        }
      }
      
      console.log('Processamento concluído');
    } catch (error) {
      console.error('Erro ao processar notificação do Gmail:', error);
      throw error;
    }
  },
);
