import { createContext, useContext } from 'react';
import type { PermissionCatalog } from '../domain/schema/access';

/**
 * A ÚNICA porta de autorização da aplicação.
 *
 * Nenhuma tela pergunta quem é o usuário: todas perguntam o que ele pode. É a inversão que permite
 * ao escritório inventar um perfil novo sem que uma linha de código mude — e a razão de este
 * contexto não expor perfil nenhum, nem o nome de um.
 */
export interface AuthorizationContextValue {
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
  /** O que os perfis do usuário marcaram, sem as dependências. */
  explicitPermissions: string[];
  /** O fecho transitivo — o que de fato vale. */
  effectivePermissions: string[];
  catalog: PermissionCatalog;
  /** Acesso irrestrito: administrador global (`SYSTEM`) ou dono do escritório. */
  isUnrestricted: boolean;
  isLoading: boolean;
}

export const AuthorizationContext = createContext<AuthorizationContextValue | null>(null);

export const useAuthorization = (): AuthorizationContextValue => {
  const ctx = useContext(AuthorizationContext);
  if (!ctx) throw new Error('useAuthorization must be used within AuthorizationStoreProvider');
  return ctx;
};
