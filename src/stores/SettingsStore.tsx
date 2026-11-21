import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { SettingsContext } from './useSettings';
import {
  emptySettingsValues,
  SETTINGS_SCOPES,
  type SettingsScope,
  type SettingsValues,
  type SettingsValuesByScope,
} from '../domain/schema/settings';
import {
  makeSaveSettingsUseCase,
  makeSubscribeSettingsUseCase,
} from '../domain/usecases/settings/SettingsUseCases';

const EMPTY_VALUES: SettingsValuesByScope = emptySettingsValues();

/**
 * Assina os dois documentos de configuração do escritório (o padrão e o do usuário conectado). Não
 * há `visibilitychange` nem evento de store aqui: a assinatura é `onSnapshot`, então uma mudança
 * feita em outra aba — ou por outro administrador — chega sozinha.
 */
export const SettingsStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settingsRepository } = useDI();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [loaded, setLoaded] = useState<{ owner: string; values: SettingsValuesByScope; scopes: SettingsScope[] } | null>(null);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeSettingsUseCase(settingsRepository),
    save: makeSaveSettingsUseCase(settingsRepository),
  }), [settingsRepository]);

  const tenantId = currentTenant?.id ?? null;
  const userId = user?.id ?? null;
  const owner = `${tenantId ?? ''}:${userId ?? ''}`;

  /**
   * O dono do que está carregado viaja junto com os valores: trocar de escritório invalida o que
   * havia sem precisar de um `setState` de limpeza no efeito — o render deriva o vazio sozinho, e
   * nenhum valor de um escritório vaza para a tela do outro.
   */
  const values = loaded?.owner === owner ? loaded.values : EMPTY_VALUES;
  const isLoading = Boolean(tenantId && userId) && loaded?.owner !== owner;
  const allScopesLoaded = loaded?.owner === owner && SETTINGS_SCOPES.every((scope) => loaded.scopes.includes(scope));

  useEffect(() => {
    if (!tenantId || !userId) return;
    const current = `${tenantId}:${userId}`;
    const unsubscribe = uc.subscribe.execute(tenantId, userId, (scope, scopeValues) => {
      setLoaded((prev) => {
        const same = prev?.owner === current;
        return {
          owner: current,
          values: { ...(same ? prev.values : EMPTY_VALUES), [scope]: scopeValues },
          scopes: same && prev.scopes.includes(scope) ? prev.scopes : [...(same ? prev.scopes : []), scope],
        };
      });
    });
    return () => unsubscribe();
  }, [tenantId, userId, uc]);

  const replaceScope = useCallback(async (scope: SettingsScope, next: SettingsValues) => {
    if (!tenantId || !userId) return;
    const current = `${tenantId}:${userId}`;
    setLoaded((prev) => ({
      owner: current,
      values: { ...(prev?.owner === current ? prev.values : EMPTY_VALUES), [scope]: next },
      scopes: prev?.owner === current ? prev.scopes : [],
    }));
    await uc.save.execute(tenantId, userId, scope, next);
  }, [tenantId, userId, uc]);

  const setValue = useCallback(async (scope: SettingsScope, key: string, value: unknown) => {
    await replaceScope(scope, { ...values[scope], [key]: value });
  }, [replaceScope, values]);

  const clearValue = useCallback(async (scope: SettingsScope, key: string) => {
    const next = { ...values[scope] };
    delete next[key];
    await replaceScope(scope, next);
  }, [replaceScope, values]);

  const value = useMemo(() => ({
    values,
    isLoading,
    allScopesLoaded,
    setValue,
    clearValue,
    replaceScope,
  }), [values, isLoading, allScopesLoaded, setValue, clearValue, replaceScope]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
