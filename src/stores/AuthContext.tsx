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
          // Sempre espera o documento (com ao menos 1 tenant vinculado) via onSnapshot:
          // para quem já loga há tempos resolve quase instantaneamente; no primeiro
          // login, aguarda a Cloud Function onUserCreated terminar de provisionar a
          // conta (users/ + userProfiles/ + tenant próprio), que o client não cria mais.
          const profile = await userRepository.waitForProvisioning(u.id);
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
      if (!document.hidden && user) void authRepository.refreshEmailVerification().then(setIsEmailVerified);
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [user, authRepository]);

  const reloadUserProfile = useCallback(async () => {
    if (!user) return;
    await loadUserProfile(user.id);
  }, [user, loadUserProfile]);

  // authRepository.isEmailVerified() sozinho não basta: o Firebase Auth SDK só atualiza
  // emailVerified no usuário em memória depois de um reload() explícito — sem isso, ficaria
  // preso no valor com que a sessão começou, mesmo depois de clicar no link de verificação.
  const checkEmailVerification = useCallback(async () => {
    const verified = await authRepository.refreshEmailVerification();
    setIsEmailVerified(verified);
    return verified;
  }, [authRepository]);

  const effectivePhotoURL = useMemo(
    () => profilePhotoURL ?? user?.photoURL ?? null,
    [profilePhotoURL, user?.photoURL],
  );

  const effectiveName = useMemo(
    () => profileNickname ?? profileFullName ?? user?.displayName ?? user?.email ?? '',
    [profileNickname, profileFullName, user?.displayName, user?.email],
  );

  // As quatro ações abaixo setam `loading` de volta para true junto com `user`: elas
  // resolvem antes (e independente) do listener onAuthStateChanged, cujo resolveProfile
  // assíncrono é quem sabe esperar o provisionamento (waitForProvisioning) terminar.
  // Sem isso, ProtectedRoute veria loading=false (herdado de antes do login) + user
  // preenchido e liberaria TenantStoreProvider antes da Cloud Function onUserCreated
  // terminar — só no primeiro login (usuário novo), já que o loading global some
  // relativamente rápido em contas já provisionadas.
  const signInWithGoogle = async () => {
    const u = await signInWithGoogleUseCase.execute();
    setLoading(true);
    setUser(u);
    setIsEmailVerified(authRepository.isEmailVerified());
  };

  const signInWithFacebook = async () => {
    const u = await signInWithFacebookUseCase.execute();
    setLoading(true);
    setUser(u);
    setIsEmailVerified(authRepository.isEmailVerified());
  };

  const signInWithEmail = async (email: string, password: string) => {
    const u = await signInWithEmailUseCase.execute(email, password);
    setLoading(true);
    setUser(u);
    setIsEmailVerified(authRepository.isEmailVerified());
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const u = await signUpWithEmailUseCase.execute(email, password, displayName);
    setLoading(true);
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
