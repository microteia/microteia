import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PORTAL_SIGN_IN_PATH } from '../Portal/portalPaths';
import { useAuth } from '../../../stores/useAuth';
import { authErrorKey, authProviderSpecOf } from '../../../domain/schema/auth';
import { useAuthProviders, type AuthProviderDescriptor } from '../../shared/auth/useAuthProviders';

import { useT } from '../../shared/i18n/useT';

export type LoginMode = 'login' | 'signup' | 'forgot-password' | 'verify-email';

export interface LoginViewModel {
  mode: LoginMode;
  loading: boolean;
  error: string;
  successMessage: string;
  emailField: string;
  passwordField: string;
  displayNameField: string;
  confirmPasswordField: string;
  termsAccepted: boolean;
  /**
   * Os meios de entrada EXTERNOS — tudo que não é o formulário desta tela. Cada um vira um botão, e a
   * tela não sabe se por trás dele há um Google, um Azure ou o servidor SAML do escritório.
   */
  externalProviders: AuthProviderDescriptor[];
  /**
   * O formulário de e-mail e senha aparece. É a contribuição `password` que decide: uma instalação de
   * login único não a declara, e a tela deixa de oferecer formulário, cadastro e recuperação de senha
   * — os três, porque os três só existem para quem tem senha aqui.
   */
  hasPasswordProvider: boolean;
  /** Não há um único meio de entrada declarado: a tela diz isso, em vez de ficar em branco. */
  hasNoProvider: boolean;
  handleEmailChange: (val: string) => void;
  handlePasswordChange: (val: string) => void;
  handleDisplayNameChange: (val: string) => void;
  handleConfirmPasswordChange: (val: string) => void;
  handleTermsAcceptedChange: (val: boolean) => void;
  handleEmailLogin: () => Promise<void>;
  handleEmailSignUp: () => Promise<void>;
  handleProviderLogin: (key: string) => Promise<void>;
  handleForgotPassword: () => Promise<void>;
  handleResendVerification: () => Promise<void>;
  handleCheckVerification: () => Promise<void>;
  handleCancelVerification: () => Promise<void>;
  goToSignUp: () => void;
  goToLogin: () => void;
  goToForgotPassword: () => void;
  /** Quem é convidado do portal entra por link no e-mail, sem senha. */
  goToPortalSignIn: () => void;
}

const TERMS_NOT_ACCEPTED_ERROR = 'login.error.terms-required';

export const useLoginViewModel = (): LoginViewModel => {
  const {
    user, isEmailVerified, entryErrorKey, clearEntryError,
    signInWithProvider, signInWithEmail, signUpWithEmail,
    sendEmailVerification, sendPasswordResetEmail, checkEmailVerification, signOut,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT('core.workspace');
  const providers = useAuthProviders();

  const [mode, setMode] = useState<LoginMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [emailField, setEmailField] = useState('');
  const [passwordField, setPasswordField] = useState('');
  const [displayNameField, setDisplayNameField] = useState('');
  const [confirmPasswordField, setConfirmPasswordField] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const externalProviders = useMemo(
    () => providers.filter((provider) => provider.kind !== 'password'),
    [providers],
  );
  const hasPasswordProvider = providers.some((provider) => provider.kind === 'password');

  /**
   * Para onde ir depois de entrar: de volta ao que a pessoa tentou abrir, ou o painel.
   *
   * O `from` é posto pelo `ProtectedRoute`, e só é seguido quando é um caminho DESTE app — um
   * destino vindo de fora transformaria a tela de login numa página de redirecionamento aberta.
   */
  const afterLogin = useMemo(() => {
    const from = (location.state as { from?: unknown } | null)?.from;
    return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/app';
  }, [location.state]);

  useEffect(() => {
    if (user && isEmailVerified) navigate(afterLogin, { replace: true });
  }, [user, isEmailVerified, navigate, afterLogin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- switching to verify-email mode synchronously in response to auth state is architecturally required
    if (user && !isEmailVerified) setMode('verify-email');
  }, [user, isEmailVerified]);

  // O erro de entrada nasce fora desta tela — na volta de um `redirect`, ou na recusa da conta nova pelo
  // servidor —, e ela é o único lugar onde ele pode ser lido. É consumido para não sobreviver à próxima
  // tentativa, e devolve a tela ao modo de entrada: a conta recusada que estava esperando a confirmação
  // do e-mail já não existe.
  useEffect(() => {
    if (!entryErrorKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o erro chega do AuthContext, não de um evento desta tela
    setError(t(entryErrorKey));
    setMode('login');
    clearEntryError();
  }, [entryErrorKey, clearEntryError, t]);

  const clearMessages = useCallback(() => {
    setError('');
    setSuccessMessage('');
  }, []);

  const resetFields = useCallback(() => {
    setPasswordField('');
    setConfirmPasswordField('');
    setTermsAccepted(false);
  }, []);

  const goToSignUp = useCallback(() => {
    clearMessages();
    resetFields();
    setMode('signup');
  }, [clearMessages, resetFields]);

  const goToLogin = useCallback(() => {
    clearMessages();
    resetFields();
    setMode('login');
  }, [clearMessages, resetFields]);

  const goToForgotPassword = useCallback(() => {
    clearMessages();
    resetFields();
    setMode('forgot-password');
  }, [clearMessages, resetFields]);

  const handleEmailLogin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(emailField, passwordField);
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }, [signInWithEmail, emailField, passwordField, t]);

  const handleEmailSignUp = useCallback(async () => {
    if (!termsAccepted) {
      setError(t(TERMS_NOT_ACCEPTED_ERROR));
      return;
    }
    if (!displayNameField.trim()) {
      setError(t('login.error.name-required'));
      return;
    }
    if (passwordField !== confirmPasswordField) {
      setError(t('login.error.password-mismatch'));
      return;
    }
    if (passwordField.length < 6) {
      setError(t('login.error.weak-password'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signUpWithEmail(emailField, passwordField, displayNameField.trim());
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }, [signUpWithEmail, emailField, passwordField, confirmPasswordField, displayNameField, termsAccepted, t]);

  /**
   * Um handler só para todo provedor externo. Os dois que havia (`handleGoogleLogin`,
   * `handleFacebookLogin`) eram a mesma função com uma chave de erro diferente — e o segundo nem
   * chegava à tela, o que é o sintoma de um caminho escrito à mão que ninguém percorre.
   */
  const handleProviderLogin = useCallback(async (key: string) => {
    const provider = externalProviders.find((candidate) => candidate.key === key);
    if (!provider) return;
    if (!termsAccepted) {
      setError(t(TERMS_NOT_ACCEPTED_ERROR));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithProvider(authProviderSpecOf(provider));
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }, [externalProviders, signInWithProvider, termsAccepted, t]);

  const handleForgotPassword = useCallback(async () => {
    if (!emailField.trim()) {
      setError(t('login.error.email-required'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(emailField);
      setSuccessMessage(t('login.reset.sent'));
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }, [sendPasswordResetEmail, emailField, t]);

  const handleResendVerification = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await sendEmailVerification();
      setSuccessMessage(t('login.verify.resent'));
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }, [sendEmailVerification, t]);

  const handleCheckVerification = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const verified = await checkEmailVerification();
      if (!verified) {
        setError(t('login.error.not-verified-yet'));
      }
    } catch {
      setError(t('login.error.verify-failed'));
    } finally {
      setLoading(false);
    }
  }, [checkEmailVerification, t]);

  const handleCancelVerification = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await signOut();
    } catch {
      // signOut falhou, força o modo mesmo assim
    } finally {
      setLoading(false);
      setMode('login');
    }
  }, [signOut]);

  return {
    mode,
    loading,
    error,
    successMessage,
    emailField,
    passwordField,
    displayNameField,
    confirmPasswordField,
    termsAccepted,
    externalProviders,
    hasPasswordProvider,
    hasNoProvider: providers.length === 0,
    handleEmailChange: setEmailField,
    handlePasswordChange: setPasswordField,
    handleDisplayNameChange: setDisplayNameField,
    handleConfirmPasswordChange: setConfirmPasswordField,
    handleTermsAcceptedChange: setTermsAccepted,
    handleEmailLogin,
    handleEmailSignUp,
    handleProviderLogin,
    handleForgotPassword,
    handleResendVerification,
    handleCheckVerification,
    handleCancelVerification,
    goToSignUp,
    goToLogin,
    goToForgotPassword,
    goToPortalSignIn: () => navigate(PORTAL_SIGN_IN_PATH),
  };
};
