import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { makeSignInWithGoogleUseCase } from '../domain/usecases/auth/SignInWithGoogleUseCase';
import { makeSignInWithFacebookUseCase } from '../domain/usecases/auth/SignInWithFacebookUseCase';
import { makeSignInWithEmailUseCase } from '../domain/usecases/auth/SignInWithEmailUseCase';
import { makeSignUpWithEmailUseCase } from '../domain/usecases/auth/SignUpWithEmailUseCase';
import { makeSendEmailVerificationUseCase } from '../domain/usecases/auth/SendEmailVerificationUseCase';
import { makeSendPasswordResetEmailUseCase } from '../domain/usecases/auth/SendPasswordResetEmailUseCase';
import { makeSignOutUseCase } from '../domain/usecases/auth/SignOutUseCase';
import type { User, UserRole } from '../domain/entities';
import { AuthContext } from './useAuth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authRepository, userRepository, userProfileRepository } = useDI();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [profileNickname, setProfileNickname] = useState<string | null>(null);
  const [profileFullName, setProfileFullName] = useState<string | null>(null);

  const signInWithGoogleUseCase = useMemo(() => makeSignInWithGoogleUseCase(authRepository), [authRepository]);
  const signInWithFacebookUseCase = useMemo(() => makeSignInWithFacebookUseCase(authRepository), [authRepository]);
  const signInWithEmailUseCase = useMemo(() => makeSignInWithEmailUseCase(authRepository), [authRepository]);
  const signUpWithEmailUseCase = useMemo(() => makeSignUpWithEmailUseCase(authRepository), [authRepository]);
  const sendEmailVerificationUseCase = useMemo(() => makeSendEmailVerificationUseCase(authRepository), [authRepository]);
  const sendPasswordResetEmailUseCase = useMemo(() => makeSendPasswordResetEmailUseCase(authRepository), [authRepository]);
  const signOutUseCase = useMemo(() => makeSignOutUseCase(authRepository), [authRepository]);

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const profile = await userProfileRepository.getProfile(userId);
      setProfilePhotoURL(profile?.photoURL ?? null);
      setProfileNickname(profile?.nickname ?? null);
      setProfileFullName(profile?.fullName ?? null);
    } catch {
      // fallback silencioso — valores do Google/email continuam sendo usados
    }
  }, [userProfileRepository]);

  useEffect(() => {
    return authRepository.onAuthStateChanged((u) => {
      if (!u) {
        setUser(null);
        setUserRole(null);
        setIsEmailVerified(false);
        setProfilePhotoURL(null);
        setProfileNickname(null);
        setProfileFullName(null);
        setLoading(false);
        return;
      }

      setUser(u);
      setIsEmailVerified(authRepository.isEmailVerified());

      const resolveProfile = async () => {
        try {
          let profile = await userRepository.getCurrentUserProfile(u.id);
          if (!profile) {
            profile = await userRepository.createUserProfile(u.id, {
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
            });
          }
          setUserRole(profile.role);
          await loadUserProfile(u.id);
        } catch {
          setUserRole('USER');
        } finally {
          setLoading(false);
        }
      };

      resolveProfile();
    });
  }, [authRepository, userRepository, loadUserProfile]);

  useEffect(() => {
    const handle = () => {
      if (!document.hidden && user) setIsEmailVerified(authRepository.isEmailVerified());
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [user, authRepository]);

  const reloadUserProfile = useCallback(async () => {
    if (!user) return;
    await loadUserProfile(user.id);
  }, [user, loadUserProfile]);

  const checkEmailVerification = useCallback(() => {
    setIsEmailVerified(authRepository.isEmailVerified());
  }, [authRepository]);

  const effectivePhotoURL = useMemo(
    () => profilePhotoURL ?? user?.photoURL ?? null,
    [profilePhotoURL, user?.photoURL],
  );

  // Ordem de prioridade oficial do "nome efetivo" do usuário em todo o sistema:
  // apelido (userProfiles.nickname) > nome completo (userProfiles.fullName) >
  // nome do provedor de login (users.displayName) > email (users.email).
  const effectiveName = useMemo(
    () => profileNickname ?? profileFullName ?? user?.displayName ?? user?.email ?? '',
    [profileNickname, profileFullName, user?.displayName, user?.email],
  );

  const signInWithGoogle = async () => {
    const u = await signInWithGoogleUseCase.execute();
    setUser(u);
    setIsEmailVerified(authRepository.isEmailVerified());
  };

  const signInWithFacebook = async () => {
    const u = await signInWithFacebookUseCase.execute();
    setUser(u);
    setIsEmailVerified(authRepository.isEmailVerified());
  };

  const signInWithEmail = async (email: string, password: string) => {
    const u = await signInWithEmailUseCase.execute(email, password);
    setUser(u);
    setIsEmailVerified(authRepository.isEmailVerified());
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const u = await signUpWithEmailUseCase.execute(email, password, displayName);
    setUser(u);
    setIsEmailVerified(false);
    await sendEmailVerificationUseCase.execute();
  };

  const sendEmailVerification = async () => {
    await sendEmailVerificationUseCase.execute();
  };

  const sendPasswordResetEmail = async (email: string) => {
    await sendPasswordResetEmailUseCase.execute(email);
  };

  const signOut = async () => {
    await signOutUseCase.execute();
    setUser(null);
    setUserRole(null);
    setIsEmailVerified(false);
    setProfilePhotoURL(null);
    setProfileNickname(null);
  };

  return (
    <AuthContext.Provider value={{
      user, userRole, loading, isEmailVerified,
      effectivePhotoURL, effectiveName, reloadUserProfile,
      signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail,
      sendEmailVerification, sendPasswordResetEmail, checkEmailVerification,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
