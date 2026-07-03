import { createContext, useContext } from 'react';
import type { User, UserRole } from '../domain/entities';

export interface AuthContextValue {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  isEmailVerified: boolean;
  effectivePhotoURL: string | null;
  effectiveName: string;
  reloadUserProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
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
