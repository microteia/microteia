import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { defineString } from 'firebase-functions/params';
import { getDI } from '../di/container';

const googleClientId = defineString('GOOGLE_CLIENT_ID');
const googleClientSecret = defineString('GOOGLE_CLIENT_SECRET');
const googleRedirectUri = defineString('GOOGLE_REDIRECT_URI', { default: 'postmessage' });
const googleGmailTopic = defineString('GOOGLE_GMAIL_TOPIC');

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export const renewGmailWatches = onMessagePublished(
  { topic: 'gmail-watch-renewal', region: 'southamerica-east1' },
  async () => {
    console.log('Iniciando renovação de Gmail watches...');

    try {
      const di = getDI();
      const gmailConnectionRepo = di.getGmailConnectionRepository();
      const gmailWatchService = di.getGmailWatchService();
      const authService = di.getGoogleAuthService();
      const tenantRepo = di.getTenantRepository();

      const config = {
        clientId: googleClientId.value(),
        clientSecret: googleClientSecret.value(),
        redirectUri: googleRedirectUri.value(),
      };
      const topicName = googleGmailTopic.value();

      const connections = await gmailConnectionRepo.getAllConnections();
      console.log(`Total de conexões Gmail encontradas: ${connections.length}`);

      const now = Date.now();
      let processedCount = 0;
      let renewedCount = 0;
      let errorCount = 0;

      for (const connection of connections) {
        if (!connection.expiration) {
          console.warn(`Conexão ${connection.id} não possui campo expiration. Pulando.`);
          continue;
        }

        const expirationMs = parseInt(connection.expiration, 10);
        if (isNaN(expirationMs)) {
          console.warn(`Conexão ${connection.id} possui expiration inválido: ${connection.expiration}. Pulando.`);
          continue;
        }

        const timeUntilExpiration = expirationMs - now;

        if (timeUntilExpiration > FORTY_EIGHT_HOURS_MS) {
          continue;
        }

        processedCount++;
        console.log(`Processando conexão ${connection.id} (tenant: ${connection.tenantId}, email: ${connection.email})`);
        console.log(`Watch expira em ${Math.round(timeUntilExpiration / (60 * 60 * 1000))} horas`);

        try {
          const tokenData = await gmailConnectionRepo.getAccessToken(connection.id);

          if (!tokenData) {
            console.error(`❌ Token não encontrado para conexão ${connection.id}`);
            console.error(`Conexão:`, JSON.stringify(connection, null, 2));
            errorCount++;
            continue;
          }

          let currentAccessToken = tokenData.accessToken;
          if (tokenData.expiresAt < new Date()) {
            console.log(`Token expirado para conexão ${connection.id}, renovando token...`);
            try {
              const refreshed = await authService.refreshAccessToken(tokenData.refreshToken, config);
              currentAccessToken = refreshed.accessToken;

              await gmailConnectionRepo.updateAccessToken(
                connection.id,
                refreshed.accessToken,
                refreshed.expiresAt,
                refreshed.refreshToken
              );

              console.log(`✓ Token renovado com sucesso para conexão ${connection.id}`);
            } catch (tokenError) {
              console.error(`❌ Erro ao renovar token para conexão ${connection.id}:`, tokenError);
              console.error(`Conexão:`, JSON.stringify(connection, null, 2));

              const tenant = await tenantRepo.getById(connection.tenantId);
              if (tenant) {
                console.error(`Tenant:`, JSON.stringify(tenant, null, 2));
              } else {
                console.error(`Tenant ${connection.tenantId} não encontrado`);
              }

              errorCount++;
              continue;
            }
          }

          try {
            const watchResult = await gmailWatchService.registerWatch(
              currentAccessToken,
              topicName,
              config
            );

            await gmailConnectionRepo.updateExpiration(connection.id, watchResult.expiration);

            const newExpirationMs = parseInt(watchResult.expiration, 10);
            const hoursUntilExpiration = Math.round((newExpirationMs - now) / (60 * 60 * 1000));

            console.log(`✓ Watch renovado com sucesso para conexão ${connection.id}`);
            console.log(`  Novo expiration: ${watchResult.expiration} (expira em ~${hoursUntilExpiration}h)`);
            renewedCount++;
          } catch (watchError) {
            console.error(`❌ Erro ao renovar watch para conexão ${connection.id}:`, watchError);
            console.error(`Conexão:`, JSON.stringify(connection, null, 2));

            const tenant = await tenantRepo.getById(connection.tenantId);
            if (tenant) {
              console.error(`Tenant:`, JSON.stringify(tenant, null, 2));
            } else {
              console.error(`Tenant ${connection.tenantId} não encontrado`);
            }

            errorCount++;
          }
        } catch (error) {
          console.error(`❌ Erro inesperado ao processar conexão ${connection.id}:`, error);
          console.error(`Conexão:`, JSON.stringify(connection, null, 2));

          try {
            const tenant = await tenantRepo.getById(connection.tenantId);
            if (tenant) {
              console.error(`Tenant:`, JSON.stringify(tenant, null, 2));
            } else {
              console.error(`Tenant ${connection.tenantId} não encontrado`);
            }
          } catch (tenantError) {
            console.error(`Erro ao buscar dados do tenant:`, tenantError);
          }

          errorCount++;
        }
      }

      console.log('='.repeat(80));
      console.log('Renovação de Gmail watches concluída');
      console.log(`Total de conexões: ${connections.length}`);
      console.log(`Conexões que expiram em 48h: ${processedCount}`);
      console.log(`Watches renovados com sucesso: ${renewedCount}`);
      console.log(`Erros: ${errorCount}`);
      console.log('='.repeat(80));
    } catch (error) {
      console.error('❌ Erro crítico ao processar renovação de watches:', error);
      throw error;
    }
  }
);
