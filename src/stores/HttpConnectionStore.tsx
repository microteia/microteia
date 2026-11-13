import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuthorization } from './useAuthorization';
import { HttpConnectionsContext } from './useHttpConnections';
import { PERMISSION_AUTOMATION_MANAGE, PERMISSION_INTEGRATIONS_MANAGE } from '../domain/schema/access';
import { makeSubscribeToHttpConnectionsUseCase } from '../domain/usecases/httpconnections/SubscribeToHttpConnectionsUseCase';
import { makeSaveHttpConnectionUseCase, type SaveHttpConnectionInput } from '../domain/usecases/httpconnections/SaveHttpConnectionUseCase';
import { makeDeleteHttpConnectionUseCase } from '../domain/usecases/httpconnections/DeleteHttpConnectionUseCase';
import type { HttpConnection } from '../domain/schema/httpConnection';
import type { HttpConnectionRequirement } from '../domain/schema/httpConnectionRequirement';

/**
 * As credenciais de integração do escritório, AO VIVO. São lidas por três lugares que não se conhecem —
 * a aba de Credenciais, a lista de Extensões e o selo de pendências do menu —, e cadastrar a credencial
 * numa precisa apagar a pendência nas outras sem recarregar nada.
 *
 * Só assina quem as regras deixam ler: os outros ficam com `known: false`.
 */
export const HttpConnectionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { can } = useAuthorization();
  const { httpConnectionRepository } = useDI();

  const [connections, setConnections] = useState<HttpConnection[]>([]);
  const [known, setKnown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<HttpConnectionRequirement | null>(null);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToHttpConnectionsUseCase(httpConnectionRepository),
    save: makeSaveHttpConnectionUseCase(httpConnectionRepository),
    remove: makeDeleteHttpConnectionUseCase(httpConnectionRepository),
  }), [httpConnectionRepository]);

  const canRead = can(PERMISSION_INTEGRATIONS_MANAGE) || can(PERMISSION_AUTOMATION_MANAGE);
  const tenantId = currentTenant?.id ?? null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- trocar de escritório ou perder a permissão zera a lista anterior
    setConnections([]);
    setKnown(false);
    setFailed(false);
    setDraft(null);
    if (!tenantId || !canRead) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    return uc.subscribe.execute(
      tenantId,
      (list) => {
        setConnections(list);
        setKnown(true);
        setIsLoading(false);
      },
      () => {
        setKnown(false);
        setFailed(true);
        setIsLoading(false);
      },
    );
  }, [tenantId, canRead, uc.subscribe]);

  const save = useCallback(async (input: Omit<SaveHttpConnectionInput, 'tenantId' | 'existing'>) => {
    if (!tenantId) throw new Error('No tenant selected');
    return uc.save.execute({ ...input, tenantId, existing: connections });
  }, [tenantId, uc.save, connections]);

  const remove = useCallback(async (id: string) => {
    if (!tenantId) return;
    await uc.remove.execute(tenantId, id);
  }, [tenantId, uc.remove]);

  const requestDraft = useCallback((requirement: HttpConnectionRequirement) => setDraft(requirement), []);
  const clearDraft = useCallback(() => setDraft(null), []);

  const value = useMemo(() => ({
    connections, known, isLoading, failed, save, remove, draft, requestDraft, clearDraft,
  }), [connections, known, isLoading, failed, save, remove, draft, requestDraft, clearDraft]);

  return <HttpConnectionsContext.Provider value={value}>{children}</HttpConnectionsContext.Provider>;
};
