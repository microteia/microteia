import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { defineString } from 'firebase-functions/params';
import { getDI } from '../di/container';

const googleClientId = defineString('GOOGLE_CLIENT_ID');
const googleClientSecret = defineString('GOOGLE_CLIENT_SECRET');
const googleRedirectUri = defineString('GOOGLE_REDIRECT_URI', { default: 'postmessage' });

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
        return email.toLowerCase().endsWith('.jus.br');
    };

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
      const createOrUpdatePushUC = di.getCreateOrUpdatePushUseCase();
      const tenantRepo = di.getTenantRepository();
      
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
        
        // Buscar dados do tenant para obter allowedSenders
        const tenant = await tenantRepo.getById(connection.tenantId);
        
        if (!tenant) {
          console.warn(`Tenant ${connection.tenantId} não encontrado`);
          continue;
        }
        
        const allowedSenders = tenant.allowedSenders ?? [];
        const allowedSubjects = tenant.allowedSubjects ?? [];
        
        if (allowedSenders.length === 0) {
          console.warn(`Tenant ${connection.tenantId} não possui remetentes permitidos configurados. Somente emails de tribunais (.jus.br) serão processados.`);
        }
        if (allowedSubjects.length === 0) {
          console.warn(`Tenant ${connection.tenantId} não possui assuntos permitidos configurados`);
        }
        console.log(`Remetentes permitidos para tenant ${connection.tenantId}:`, allowedSenders);
        console.log(`Assuntos permitidos para tenant ${connection.tenantId}:`, allowedSubjects);
        
        const startHistoryId = connection.historyId || historyId;
        console.log(`Buscando emails desde historyId: ${startHistoryId}`);

        // Flag para rastrear se alguma mensagem falhou neste tenant
        let hasFailedMessage = false;

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
                clientId: googleClientId.value(),
                clientSecret: googleClientSecret.value(),
                redirectUri: googleRedirectUri.value(),
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
            startHistoryId,
            "INBOX",
            allowedSubjects
          );

          console.log(`${newMessages.length} email(s) novo(s) encontrado(s)`);

          // Filtrar apenas emails de remetentes permitidos (tribunais)
          const courtMessages = newMessages.filter( (msg) => {
            const from = extractEmail(msg.from);
            return allowedSenders.length === 0
              ? isTrustedSource(from)
              : allowedSenders.some(sender => from.toLowerCase().includes(sender.toLowerCase()));
          });

          console.log(`${courtMessages.length} email(s) de tribunais encontrado(s)`);

          for (const message of courtMessages) {
            
            console.log(`Processando email ID: ${message.id}, Assunto: ${message.subject}`);
            
            // Fazer parsing do email
            const parsedData = await emailParserService.parse(
              message.bodyText || '',
              message.from,
              connection.tenantId,
              message.bodyHtml
            );

            // Verificar se parsing falhou completamente
            const parsingFailed = parsedData.parsingError && !parsedData.processNumber;

            // Determinar status e subject baseado no resultado do parsing
            const status = parsingFailed ? 'fault' : 'pending';
            const subject = parsingFailed 
              ? `[ERRO DE PARSING] ${message.subject}` 
              : message.subject;

            if (parsingFailed) {
              console.error('❌ ERRO CRÍTICO: Parsing falhou completamente para email:');
              console.error(`  Email ID: ${message.id}`);
              console.error(`  De: ${message.from}`);
              console.error(`  Assunto: ${message.subject}`);
              console.error(`  Erro: ${parsedData.parsingError}`);
              console.error(`  Body Text (primeiros 500 chars): ${(message.bodyText || '').substring(0, 500)}`);
              if (message.bodyHtml) {
                console.error(`  Body HTML (primeiros 500 chars): ${message.bodyHtml.substring(0, 500)}`);
              }
              
              // Marcar que esta mensagem falhou
              hasFailedMessage = true;
            }

            // Criar ou atualizar push (lógica unificada no Use Case)
            const result = await createOrUpdatePushUC.execute(connection.tenantId, {
              emailId: message.id,
              from: message.from,
              to: message.to,
              subject,
              receivedAt: message.receivedAt,
              emailBodyHtml: message.bodyHtml ?? '',
              emailBodyText: message.bodyText ?? '',
              processNumber: parsedData.processNumber ?? '',
              court: parsedData.court ?? '',
              activeParty: parsedData.activeParty ?? '',
              passiveParty: parsedData.passiveParty ?? '',
              legalClass: parsedData.legalClass ?? '',
              filingDate: parsedData.filingDate ?? new Date(),
              distributionType: parsedData.distributionType ?? '',
              processSubject: parsedData.processSubject ?? '',
              movements: parsedData.movements ?? [],
              status,
              parsedByAI: parsedData.parsedByAI ?? false,
              parsingError: parsedData.parsingError ?? '',
              createdBy: 'system',
            });

            if (result.wasUpdated) {
              console.log(`✓ Push ${result.push.id} atualizado com sucesso (reprocessamento)`);
            } else if (parsingFailed) {
              console.log(`⚠️ Push fictício criado: ${result.push.id} (status: fault)`);
            } else {
              console.log(`✓ Push criado: ${result.push.id} (Processo: ${result.push.processNumber || 'N/A'})`);
            }
          }

          // Atualizar historyId APENAS se nenhuma mensagem falhou
          if (hasFailedMessage) {
            console.warn(`⚠️ Pelo menos uma mensagem falhou. HistoryId NÃO será atualizado para permitir reprocessamento.`);
            console.warn(`Tenant: ${connection.tenantId}, Connection: ${connection.id}`);
            console.warn(`O usuário deve corrigir o problema e a próxima notificação tentará processar novamente.`);
          } else {
            await gmailConnectionRepo.updateHistoryId(connection.id, historyId);
            console.log(`✓ HistoryId atualizado para ${historyId} (todas as mensagens processadas com sucesso)`);
          }

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
