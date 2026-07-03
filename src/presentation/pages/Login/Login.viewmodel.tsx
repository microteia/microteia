import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';

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
  handleEmailChange: (val: string) => void;
  handlePasswordChange: (val: string) => void;
  handleDisplayNameChange: (val: string) => void;
  handleConfirmPasswordChange: (val: string) => void;
  handleTermsAcceptedChange: (val: boolean) => void;
  handleEmailLogin: () => Promise<void>;
  handleEmailSignUp: () => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleFacebookLogin: () => Promise<void>;
  handleForgotPassword: () => Promise<void>;
  handleResendVerification: () => Promise<void>;
  handleCheckVerification: () => Promise<void>;
  handleCancelVerification: () => Promise<void>;
  goToSignUp: () => void;
  goToLogin: () => void;
  goToForgotPassword: () => void;
}

const TERMS_NOT_ACCEPTED_ERROR = 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.';

const mapAuthError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    switch ((error as { code: string }).code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'E-mail ou senha incorretos.';
      case 'auth/email-already-in-use':
        return 'Este e-mail já está cadastrado.';
      case 'auth/weak-password':
        return 'A senha deve ter pelo menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'E-mail inválido.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde antes de tentar novamente.';
      case 'auth/user-disabled':
        return 'Esta conta foi desabilitada.';
      default:
        return 'Ocorreu um erro. Tente novamente.';
    }
  }
  return 'Ocorreu um erro. Tente novamente.';
};

export const useLoginViewModel = (): LoginViewModel => {
  const {
    user, isEmailVerified,
    signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail,
    sendEmailVerification, sendPasswordResetEmail, checkEmailVerification, signOut,
  } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [emailField, setEmailField] = useState('');
  const [passwordField, setPasswordField] = useState('');
  const [displayNameField, setDisplayNameField] = useState('');
  const [confirmPasswordField, setConfirmPasswordField] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (user && isEmailVerified) navigate('/', { replace: true });
  }, [user, isEmailVerified, navigate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- switching to verify-email mode synchronously in response to auth state is architecturally required
    if (user && !isEmailVerified) setMode('verify-email');
  }, [user, isEmailVerified]);

  const clearMessages = useCallback(() => {
    setError('');
    setSuccessMessage('');
  }, []);

  const goToSignUp = useCallback(() => {
    clearMessages();
    setPasswordField('');
    setConfirmPasswordField('');
    setTermsAccepted(false);
    setMode('signup');
  }, [clearMessages]);

  const goToLogin = useCallback(() => {
    clearMessages();
    setPasswordField('');
    setConfirmPasswordField('');
    setTermsAccepted(false);
    setMode('login');
  }, [clearMessages]);

  const goToForgotPassword = useCallback(() => {
    clearMessages();
    setPasswordField('');
    setConfirmPasswordField('');
    setTermsAccepted(false);
    setMode('forgot-password');
  }, [clearMessages]);

  const handleEmailLogin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(emailField, passwordField);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [signInWithEmail, emailField, passwordField]);

  const handleEmailSignUp = useCallback(async () => {
    if (!termsAccepted) {
      setError(TERMS_NOT_ACCEPTED_ERROR);
      return;
    }
    if (!displayNameField.trim()) {
      setError('Informe seu nome completo.');
      return;
    }
    if (passwordField !== confirmPasswordField) {
      setError('As senhas não coincidem.');
      return;
    }
    if (passwordField.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signUpWithEmail(emailField, passwordField, displayNameField.trim());
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [signUpWithEmail, emailField, passwordField, confirmPasswordField, displayNameField, termsAccepted]);

  const handleGoogleLogin = useCallback(async () => {
    if (!termsAccepted) {
      setError(TERMS_NOT_ACCEPTED_ERROR);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch {
      setError('Erro ao fazer login com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [signInWithGoogle, termsAccepted]);

  const handleFacebookLogin = useCallback(async () => {
    if (!termsAccepted) {
      setError(TERMS_NOT_ACCEPTED_ERROR);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithFacebook();
    } catch {
      setError('Erro ao fazer login com Facebook. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [signInWithFacebook, termsAccepted]);

  const handleForgotPassword = useCallback(async () => {
    if (!emailField.trim()) {
      setError('Informe seu e-mail.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(emailField);
      setSuccessMessage('Se este e-mail estiver cadastrado, você receberá um link em instantes.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [sendPasswordResetEmail, emailField]);

  const handleResendVerification = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await sendEmailVerification();
      setSuccessMessage('E-mail reenviado!');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [sendEmailVerification]);

  const handleCheckVerification = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const verified = await checkEmailVerification();
      if (!verified) {
        setError('Ainda não identificamos a verificação. Clique no link do e-mail e tente novamente.');
      }
    } catch {
      setError('Não foi possível verificar agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [checkEmailVerification]);

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
    handleEmailChange: setEmailField,
    handlePasswordChange: setPasswordField,
    handleDisplayNameChange: setDisplayNameField,
    handleConfirmPasswordChange: setConfirmPasswordField,
    handleTermsAcceptedChange: setTermsAccepted,
    handleEmailLogin,
    handleEmailSignUp,
    handleGoogleLogin,
    handleFacebookLogin,
    handleForgotPassword,
    handleResendVerification,
    handleCheckVerification,
    handleCancelVerification,
    goToSignUp,
    goToLogin,
    goToForgotPassword,
  };
};
