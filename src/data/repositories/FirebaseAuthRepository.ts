import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  SAMLAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';
import type { AuthProvider, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../infrastructure/firebase/config';
import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { AuthProviderSpec } from '../../domain/schema/auth';
import { isPortalIdentityAccount } from '../../domain/schema/portalIdentity';
import type { User } from '../../domain/entities';

const mapUser = (fbUser: FirebaseUser): User => ({
  id: fbUser.uid,
  email: fbUser.email ?? '',
  displayName: fbUser.displayName ?? '@core.workspace/user.anonymous',
  photoURL: fbUser.photoURL,
});

/**
 * A espécie declarada vira o provedor do Firebase. `microsoft` e `apple` não têm classe própria — são
 * `OAuthProvider` com o id da casa —, e é o mesmo mecanismo que atende `oidc`: o que muda é só quem
 * escolhe o id. `password` não passa por aqui; ele é o formulário, e tem método próprio.
 */
const buildProvider = (spec: AuthProviderSpec): AuthProvider | null => {
  switch (spec.kind) {
    case 'google': return new GoogleAuthProvider();
    case 'facebook': return new FacebookAuthProvider();
    case 'github': return new GithubAuthProvider();
    case 'microsoft': return new OAuthProvider('microsoft.com');
    case 'apple': return new OAuthProvider('apple.com');
    case 'oidc': return spec.providerId ? new OAuthProvider(spec.providerId) : null;
    case 'saml': return spec.providerId ? new SAMLAuthProvider(spec.providerId) : null;
    default: return null;
  }
};

/**
 * Escopo e parâmetro só existem em provedor OAuth. `SAMLAuthProvider` não os aceita, e chamá-los ali
 * estouraria em runtime — daí a checagem por instância em vez de pela espécie: é o tipo que sabe.
 */
const configureProvider = (provider: AuthProvider, spec: AuthProviderSpec): AuthProvider => {
  if (!(provider instanceof OAuthProvider)
    && !(provider instanceof GoogleAuthProvider)
    && !(provider instanceof FacebookAuthProvider)
    && !(provider instanceof GithubAuthProvider)) {
    return provider;
  }
  for (const scope of spec.scopes ?? []) provider.addScope(scope);
  if (spec.customParameters) provider.setCustomParameters(spec.customParameters);
  return provider;
};

export class FirebaseAuthRepository implements IAuthRepository {
  async signInWithProvider(spec: AuthProviderSpec): Promise<User | null> {
    const provider = buildProvider(spec);
    if (!provider) throw new Error(`Unsupported auth provider: ${spec.kind}`);
    const configured = configureProvider(provider, spec);

    if (spec.flow === 'redirect') {
      await signInWithRedirect(auth, configured);
      return null;
    }
    const result = await signInWithPopup(auth, configured);
    return mapUser(result.user);
  }

  async consumeRedirectResult(): Promise<User | null> {
    const result = await getRedirectResult(auth);
    return result ? mapUser(result.user) : null;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return mapUser(result.user);
  }

  async signUpWithEmail(email: string, password: string, displayName: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    return mapUser(result.user);
  }

  async sendEmailVerification(): Promise<void> {
    if (!auth.currentUser) throw new Error('No authenticated user');
    await firebaseSendEmailVerification(auth.currentUser);
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await firebaseSendPasswordResetEmail(auth, email);
  }

  async sendSignInLink(email: string, continueUrl: string, locale?: string): Promise<void> {
    // O idioma da instância é global, e é também o da recuperação de senha e da verificação de
    // e-mail: ele é posto só para este envio e devolvido em seguida.
    const previous = auth.languageCode;
    if (locale) auth.languageCode = locale;
    try {
      await sendSignInLinkToEmail(auth, email, { url: continueUrl, handleCodeInApp: true });
    } finally {
      auth.languageCode = previous;
    }
  }

  isSignInLink(url: string): boolean {
    return isSignInWithEmailLink(auth, url);
  }

  async signInWithLink(email: string, url: string): Promise<User> {
    const result = await signInWithEmailLink(auth, email, url);
    return mapUser(result.user);
  }

  async signInWithToken(token: string): Promise<User> {
    const result = await signInWithCustomToken(auth, token);
    return mapUser(result.user);
  }

  isEmailVerified(): boolean {
    const current = auth.currentUser;
    return !!current && (current.emailVerified || isPortalIdentityAccount(current.uid));
  }

  async refreshEmailVerification(): Promise<boolean> {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    return this.isEmailVerified();
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, (fbUser) => {
      callback(fbUser ? mapUser(fbUser) : null);
    });
  }
}
