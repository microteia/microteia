import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { useNotification } from '../../../../stores/useNotification';
import { useDI } from '../../../../infrastructure/di/useDI';
import { makeGetGmailConnectionsUseCase } from '../../../../domain/usecases/gmailconnections/GetGmailConnectionsUseCase';
import { makeCreateGmailConnectionUseCase } from '../../../../domain/usecases/gmailconnections/CreateGmailConnectionUseCase';
import { makeDeleteGmailConnectionUseCase } from '../../../../domain/usecases/gmailconnections/DeleteGmailConnectionUseCase';
import { makeUpdateGmailTokenUseCase } from '../../../../domain/usecases/gmailconnections/UpdateGmailTokenUseCase';
import { makeUpdateGmailConnectionAuthorizedAtUseCase } from '../../../../domain/usecases/gmailconnections/UpdateGmailConnectionAuthorizedAtUseCase';
import type { GmailConnection } from '../../../../domain/entities';

export interface PushTabViewModel {
  loading: boolean;
  connections: GmailConnection[];
  error: string | null;
  isAuthorizing: boolean;
  confirmDelete: { open: boolean; id: string; email: string };
  handleAuthorize: () => Promise<void>;
  handleDelete: (id: string) => void;
  runDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const usePushTabViewModel = (): PushTabViewModel => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { notify } = useNotification();
  const { gmailConnectionRepository } = useDI();

  const getGmailConnectionsUC = useMemo(
    () => makeGetGmailConnectionsUseCase(gmailConnectionRepository),
    [gmailConnectionRepository],
  );
  const createGmailConnectionUC = useMemo(
    () => makeCreateGmailConnectionUseCase(gmailConnectionRepository),
    [gmailConnectionRepository],
  );
  const updateGmailTokenUC = useMemo(
    () => makeUpdateGmailTokenUseCase(gmailConnectionRepository),
    [gmailConnectionRepository],
  );
  const updateGmailConnectionAuthorizedAtUC = useMemo(
    () => makeUpdateGmailConnectionAuthorizedAtUseCase(gmailConnectionRepository),
    [gmailConnectionRepository],
  );
  const deleteGmailConnectionUC = useMemo(
    () => makeDeleteGmailConnectionUseCase(gmailConnectionRepository),
    [gmailConnectionRepository],
  );

  const [connections, setConnections] = useState<GmailConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: '', email: '' });

  useEffect(() => {
    if (!currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async operation is architecturally required
    setLoading(true);
    const loadGmail = async () => {
      try {
        const result = await getGmailConnectionsUC.execute(currentTenant.id);
        setConnections(result);
      } catch {
        setError('Erro ao carregar conexões Gmail.');
      } finally {
        setLoading(false);
      }
    };
    void loadGmail();
  }, [currentTenant, getGmailConnectionsUC]);

  const handleAuthorize = useCallback(async () => {
    if (!currentTenant || !user) return;
    setIsAuthorizing(true);
    setError(null);
    try {
      const client = (
        window as typeof window & {
          google?: {
            accounts: {
              oauth2: {
                initCodeClient: (config: {
                  client_id: string;
                  scope: string;
                  ux_mode?: 'popup' | 'redirect';
                  callback: (response: { code?: string; error?: string }) => void;
                }) => { requestCode: () => void };
              };
            };
          };
        }
      ).google;

      if (!client?.accounts?.oauth2) {
        notify('Google Identity Services não está disponível. Verifique a conexão.', 'error');
        setIsAuthorizing(false);
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
      if (!clientId) {
        notify('Client ID do Google não configurado.', 'error');
        setIsAuthorizing(false);
        return;
      }

      const codeClient = client.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope:
          'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
        ux_mode: 'popup',
        callback: async (response) => {
          if (response.error) {
            notify(`Erro na autorização: ${response.error}`, 'error');
            setIsAuthorizing(false);
            return;
          }

          if (!response.code) {
            notify('Código de autorização não recebido.', 'error');
            setIsAuthorizing(false);
            return;
          }

          try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const exchangeCode = httpsCallable<
              { code: string; tenantId: string },
              {
                email: string;
                accessToken: string;
                refreshToken: string;
                expiresIn: number;
                scopes: string[];
              }
            >(functions, 'exchangeGmailCode');

            const result = await exchangeCode({
              code: response.code,
              tenantId: currentTenant.id,
            });

            const { email, accessToken, refreshToken, expiresIn, scopes } = result.data;

            const expiresAt = new Date(Date.now() + expiresIn * 1000);
            const tokenData = {
              accessToken,
              refreshToken,
              expiresAt,
            };

            const existingConnection = connections.find((c) => c.email === email);

            if (existingConnection) {
              await updateGmailTokenUC.execute(currentTenant.id, existingConnection.id, tokenData);
              await updateGmailConnectionAuthorizedAtUC.execute(currentTenant.id, existingConnection.id);
              notify('Autorização Gmail atualizada com sucesso!', 'success');
              // Atualiza a conexão localmente com o novo authorizedAt
              setConnections((prev) =>
                prev.map((c) =>
                  c.id === existingConnection.id ? { ...c, authorizedAt: new Date() } : c,
                ),
              );
            } else {
              const created = await createGmailConnectionUC.execute(
                currentTenant.id,
                {
                  email,
                  scopes,
                  authorizedBy: user.id,
                  authorizedByName: user.displayName,
                },
                tokenData,
              );
              setConnections((prev) => [created, ...prev]);
              notify('Conta Gmail autorizada com sucesso!', 'success');
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro desconhecido';
            notify(`Erro ao processar autorização: ${message}`, 'error');
          } finally {
            setIsAuthorizing(false);
          }
        },
      });

      codeClient.requestCode();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      notify(`Erro ao iniciar autorização Gmail: ${message}`, 'error');
      setIsAuthorizing(false);
    }
  }, [currentTenant, user, notify, createGmailConnectionUC, updateGmailTokenUC, updateGmailConnectionAuthorizedAtUC, connections]);

  const handleDelete = useCallback(
    (id: string) => {
      const conn = connections.find((c) => c.id === id);
      if (conn) setConfirmDelete({ open: true, id, email: conn.email });
    },
    [connections],
  );

  const runDelete = useCallback(async () => {
    if (!currentTenant) return;
    const { id } = confirmDelete;
    try {
      await deleteGmailConnectionUC.execute(currentTenant.id, id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
      notify('Conexão Gmail removida.', 'success');
    } catch {
      setError('Erro ao excluir conexão.');
    } finally {
      setConfirmDelete({ open: false, id: '', email: '' });
    }
  }, [currentTenant, confirmDelete, deleteGmailConnectionUC, notify]);

  const cancelDelete = useCallback(() => {
    setConfirmDelete({ open: false, id: '', email: '' });
  }, []);

  return {
    loading,
    connections,
    error,
    isAuthorizing,
    confirmDelete,
    handleAuthorize,
    handleDelete,
    runDelete,
    cancelDelete,
  };
};
