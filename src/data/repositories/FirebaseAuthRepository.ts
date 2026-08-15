import {
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../infrastructure/firebase/config';
import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { User } from '../../domain/entities';

const mapUser = (fbUser: FirebaseUser): User => ({
  id: fbUser.uid,
  email: fbUser.email ?? '',
  displayName: fbUser.displayName ?? '@core.workspace/user.anonymous',
  photoURL: fbUser.photoURL,
});

export class FirebaseAuthRepository implements IAuthRepository {
  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return mapUser(result.user);
  }

  async signInWithFacebook(): Promise<User> {
    const provider = new FacebookAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return mapUser(result.user);
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

  isEmailVerified(): boolean {
    return auth.currentUser?.emailVerified ?? false;
  }

  async refreshEmailVerification(): Promise<boolean> {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    return auth.currentUser.emailVerified;
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
