import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';

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

const TERMS_NOT_ACCEPTED_ERROR = 'login.error.terms-required';

/** O erro do Firebase vira CHAVE, não frase: quem exibe é que traduz. */
const authErrorKey = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    switch ((error as { code: string }).code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'login.error.invalid-credentials';
      case 'auth/email-already-in-use':
        return 'login.error.email-in-use';
      case 'auth/weak-password':
        return 'login.error.weak-password';
      case 'auth/invalid-email':
        return 'login.error.invalid-email';
      case 'auth/too-many-requests':
        return 'login.error.too-many-requests';
      case 'auth/user-disabled':
        return 'login.error.user-disabled';
      default:
        return 'login.error.generic';
    }
  }
  return 'login.error.generic';
};

export const useLoginViewModel = (): LoginViewModel => {
  const {
    user, isEmailVerified,
    signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail,
    sendEmailVerification, sendPasswordResetEmail, checkEmailVerification, signOut,
  } = useAuth();
  const navigate = useNavigate();
  const t = useT('core.workspace');

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
    if (user && isEmailVerified) navigate('/app', { replace: true });
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

  const handleGoogleLogin = useCallback(async () => {
    if (!termsAccepted) {
      setError(t(TERMS_NOT_ACCEPTED_ERROR));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch {
      setError(t('login.error.google'));
    } finally {
      setLoading(false);
    }
  }, [signInWithGoogle, termsAccepted, t]);

  const handleFacebookLogin = useCallback(async () => {
    if (!termsAccepted) {
      setError(t(TERMS_NOT_ACCEPTED_ERROR));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithFacebook();
    } catch {
      setError(t('login.error.facebook'));
    } finally {
      setLoading(false);
    }
  }, [signInWithFacebook, termsAccepted, t]);

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
