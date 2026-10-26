import { createContext, useContext } from 'react';
import type { User, UserRole } from '../domain/entities';
import type { AuthProviderSpec } from '../domain/schema/auth';

export interface AuthContextValue {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  isEmailVerified: boolean;
  /**
   * O erro com que um fluxo `redirect` voltou, como CHAVE de mensagem. Vive aqui, e não na tela de
   * entrada, porque acontece ANTES dela montar: a página inteira foi recarregada pelo provedor.
   */
  redirectErrorKey: string | null;
  clearRedirectError: () => void;
  effectivePhotoURL: string | null;
  effectiveName: string;
  reloadUserProfile: () => Promise<void>;
  signInWithProvider: (spec: AuthProviderSpec) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  /** O link de entrada sem senha — o caminho de quem é convidado do portal. */
  sendSignInLink: (email: string, continueUrl: string, locale?: string) => Promise<void>;
  isSignInLink: (url: string) => boolean;
  signInWithLink: (email: string, url: string) => Promise<void>;
  /** A sessão aberta pelo token que o servidor emitiu ao conferir a identidade do convidado. */
  signInWithToken: (token: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  checkEmailVerification: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
