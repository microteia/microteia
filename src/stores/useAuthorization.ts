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

/**
 * A autorização QUANDO ela pode não existir — a tela de entrada, os Termos, qualquer rota acima do
 * escritório. Devolve `null` ali, e quem recebe `null` deve tratar como "não pode nada": não há
 * usuário a quem conceder permissão, e assumir o contrário seria abrir por ausência de contexto.
 *
 * É uma porta separada de propósito. Se `useAuthorization` devolvesse `null` em vez de lançar, todo
 * consumidor dentro do escritório passaria a poder esquecer a checagem sem que nada reclamasse.
 */
export const useOptionalAuthorization = (): AuthorizationContextValue | null =>
  useContext(AuthorizationContext);
