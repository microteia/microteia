import { createContext, useContext } from 'react';
import type { SettingsScope, SettingsValues, SettingsValuesByScope } from '../domain/schema/settings';

/**
 * Os VALORES de configuração do escritório e do usuário conectado. A declaração (quais chaves
 * existem, de que tipo, com que padrão) NÃO vive aqui: ela é contribuída por plugins e resolvida na
 * camada de apresentação. Este store guarda só o que foi gravado, por escopo — o que mantém a
 * hierarquia de camadas de pé e permite gravar um documento inteiro na edição em JSON.
 */
export interface SettingsContextValue {
  values: SettingsValuesByScope;
  isLoading: boolean;
  /** O usuário pode gravar no escopo do escritório (é administrador do tenant). */
  setValue: (scope: SettingsScope, key: string, value: unknown) => Promise<void>;
  /** Remove a chave daquele escopo, fazendo o valor voltar a ser herdado. */
  clearValue: (scope: SettingsScope, key: string) => Promise<void>;
  /** Substitui o documento inteiro de um escopo — o que a edição em JSON grava. */
  replaceScope: (scope: SettingsScope, values: SettingsValues) => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsStoreProvider');
  return ctx;
};
