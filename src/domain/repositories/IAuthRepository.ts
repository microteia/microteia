import type { User } from '../entities';

export interface IAuthRepository {
  signInWithGoogle(): Promise<User>;
  signInWithFacebook(): Promise<User>;
  signInWithEmail(email: string, password: string): Promise<User>;
  signUpWithEmail(email: string, password: string, displayName: string): Promise<User>;
  sendEmailVerification(): Promise<void>;
  sendPasswordResetEmail(email: string): Promise<void>;
  isEmailVerified(): boolean;
  refreshEmailVerification(): Promise<boolean>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
}
