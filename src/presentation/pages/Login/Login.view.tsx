import React from 'react';
import { FcGoogle } from 'react-icons/fc';
import { RiMailSendLine, RiArrowLeftLine } from 'react-icons/ri';
import { useLoginViewModel } from './Login.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Input, Label } from '../../components/ui/Input';
import { S } from './Login.styles';

import { useT } from '../../shared/i18n/useT';

export const LoginView: React.FC = () => {
  const vm = useLoginViewModel();
  const t = useT('core.workspace');

  if (vm.mode === 'verify-email') {
    return (
      <S.Page>
        <S.Card>
          <S.Logo>
            {/* eslint-disable-next-line no-restricted-syntax -- "Microteia" é a MARCA: não traduz em idioma nenhum. */}
            <img src="/logo.png" alt="Microteia" style={{ width: '80px', height: '80px' }} />
          </S.Logo>
          <S.VerifyEmailIcon>
            <RiMailSendLine />
          </S.VerifyEmailIcon>
          <S.Title>{t('login.verify.title')}</S.Title>
          <S.VerifyEmailText>{t('login.verify.text', { email: vm.emailField })}</S.VerifyEmailText>
          <S.ButtonGroup>
            <Button $fullWidth size="lg" onClick={vm.handleCheckVerification} $isLoading={vm.loading} disabled={vm.loading}>
              {vm.loading ? <Spinner size={18} /> : null}
              {t('login.verify.done')}
            </Button>
            <Button $fullWidth size="lg" variant="ghost" onClick={vm.handleResendVerification} $isLoading={vm.loading} disabled={vm.loading}>
              {t('login.verify.resend')}
            </Button>
            <Button $fullWidth size="lg" variant="ghost" onClick={vm.handleCancelVerification} $isLoading={vm.loading} disabled={vm.loading}>
              {t('login.verify.other-method')}
            </Button>
          </S.ButtonGroup>
          {vm.successMessage && <S.SuccessMessage>{vm.successMessage}</S.SuccessMessage>}
          {vm.error && <S.ErrorMessage>{vm.error}</S.ErrorMessage>}
        </S.Card>
      </S.Page>
    );
  }

  if (vm.mode === 'forgot-password') {
    return (
      <S.Page>
        <S.Card>
          <S.BackLink onClick={vm.goToLogin}>
            <RiArrowLeftLine /> {t('action.back')}
          </S.BackLink>
          <S.Logo>
            {/* eslint-disable-next-line no-restricted-syntax -- "Microteia" é a MARCA: não traduz em idioma nenhum. */}
            <img src="/logo.png" alt="Microteia" style={{ width: '80px', height: '80px' }} />
          </S.Logo>
          <S.Title>{t('login.reset.title')}</S.Title>
          <S.Subtitle>{t('login.reset.subtitle')}</S.Subtitle>
          <S.Form>
            <S.InputGroup>
              <Label htmlFor="reset-email">{t('login.field.email')}</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder={t('login.field.email.placeholder')}
                value={vm.emailField}
                onChange={(e) => vm.handleEmailChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <Button $fullWidth size="lg" onClick={vm.handleForgotPassword} $isLoading={vm.loading} disabled={vm.loading}>
              {vm.loading ? <Spinner size={18} /> : null}
              {t('login.reset.send')}
            </Button>
          </S.Form>
          {vm.successMessage && <S.SuccessMessage>{vm.successMessage}</S.SuccessMessage>}
          {vm.error && <S.ErrorMessage>{vm.error}</S.ErrorMessage>}
        </S.Card>
      </S.Page>
    );
  }

  if (vm.mode === 'signup') {
    return (
      <S.Page>
        <S.Card>
          <S.BackLink onClick={vm.goToLogin}>
            <RiArrowLeftLine /> {t('action.back')}
          </S.BackLink>
          <S.Logo>
            {/* eslint-disable-next-line no-restricted-syntax -- "Microteia" é a MARCA: não traduz em idioma nenhum. */}
            <img src="/logo.png" alt="Microteia" style={{ width: '80px', height: '80px' }} />
          </S.Logo>
          <S.Title>{t('login.signup.title')}</S.Title>
          <S.Form>
            <S.InputGroup>
              <Label htmlFor="signup-name">{t('login.field.full-name')}</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder={t('login.field.full-name.placeholder')}
                value={vm.displayNameField}
                onChange={(e) => vm.handleDisplayNameChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <S.InputGroup>
              <Label htmlFor="signup-email">{t('login.field.email')}</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder={t('login.field.email.placeholder')}
                value={vm.emailField}
                onChange={(e) => vm.handleEmailChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <S.InputGroup>
              <Label htmlFor="signup-password">{t('login.field.password')}</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder={t('login.field.password.placeholder')}
                value={vm.passwordField}
                onChange={(e) => vm.handlePasswordChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <S.InputGroup>
              <Label htmlFor="signup-confirm">{t('login.field.confirm')}</Label>
              <Input
                id="signup-confirm"
                type="password"
                placeholder={t('login.field.confirm.placeholder')}
                value={vm.confirmPasswordField}
                onChange={(e) => vm.handleConfirmPasswordChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <S.TermsRow>
              <S.TermsCheckbox
                checked={vm.termsAccepted}
                onChange={(e) => vm.handleTermsAcceptedChange(e.target.checked)}
                disabled={vm.loading}
              />
              <S.TermsText>
                {t('login.terms.prefix')}{' '}
                <S.TermsLink href="/license?from=login" target="_blank" rel="noopener noreferrer">
                  {t('login.terms.link')}
                </S.TermsLink>
                .
              </S.TermsText>
            </S.TermsRow>
            <Button $fullWidth size="lg" onClick={vm.handleEmailSignUp} $isLoading={vm.loading} disabled={vm.loading || !vm.termsAccepted}>
              {vm.loading ? <Spinner size={18} /> : null}
              {t('login.signup.title')}
            </Button>
          </S.Form>
          {vm.error && <S.ErrorMessage>{vm.error}</S.ErrorMessage>}
          <S.SwitchModeText>
            {t('login.switch.have-account')}{' '}
            <S.SwitchModeLink onClick={vm.goToLogin}>{t('login.signin')}</S.SwitchModeLink>
          </S.SwitchModeText>
        </S.Card>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Card>
        <S.Logo>
          {/* eslint-disable-next-line no-restricted-syntax -- "Microteia" é a MARCA: não traduz em idioma nenhum. */}
            <img src="/logo.png" alt="Microteia" style={{ width: '80px', height: '80px' }} />
        </S.Logo>
        {/* eslint-disable-next-line no-restricted-syntax -- "Microteia" é a MARCA: não traduz em idioma nenhum. */}
        <S.Title>Microteia</S.Title>
        <S.Subtitle>{t('login.tagline')}</S.Subtitle>
        <S.Form>
          <S.InputGroup>
            <Label htmlFor="login-email">{t('login.field.email')}</Label>
            <Input
              id="login-email"
              type="email"
              placeholder={t('login.field.email.placeholder')}
              value={vm.emailField}
              onChange={(e) => vm.handleEmailChange(e.target.value)}
              disabled={vm.loading}
            />
          </S.InputGroup>
          <S.InputGroup>
            <Label htmlFor="login-password">{t('login.field.password')}</Label>
            <Input
              id="login-password"
              type="password"
              placeholder={t('login.field.password.your')}
              value={vm.passwordField}
              onChange={(e) => vm.handlePasswordChange(e.target.value)}
              disabled={vm.loading}
            />
            <S.ForgotPasswordLink onClick={vm.goToForgotPassword}>
              {t('login.forgot-password')}
            </S.ForgotPasswordLink>
          </S.InputGroup>
          <Button $fullWidth size="lg" onClick={vm.handleEmailLogin} $isLoading={vm.loading} disabled={vm.loading}>
            {vm.loading ? <Spinner size={18} /> : null}
            {t('login.signin')}
          </Button>
        </S.Form>

        <S.Divider>{t('login.divider')}</S.Divider>

        <S.TermsRow>
          <S.TermsCheckbox
            checked={vm.termsAccepted}
            onChange={(e) => vm.handleTermsAcceptedChange(e.target.checked)}
            disabled={vm.loading}
          />
          <S.TermsText>
            {t('login.terms.prefix')}{' '}
            <S.TermsLink href="/license?from=login" target="_blank" rel="noopener noreferrer">
              {t('login.terms.link')}
            </S.TermsLink>
            .
          </S.TermsText>
        </S.TermsRow>

        <Button
          $fullWidth
          size="lg"
          variant="secondary"
          onClick={vm.handleGoogleLogin}
          $isLoading={vm.loading}
          disabled={vm.loading || !vm.termsAccepted}
        >
          {vm.loading ? <Spinner size={18} /> : <FcGoogle size={20} />}
          {vm.loading ? t('login.signing-in') : t('login.google')}
        </Button>

        {vm.error && <S.ErrorMessage>{vm.error}</S.ErrorMessage>}

        <S.SwitchModeText>
          {t('login.switch.no-account')}{' '}
          <S.SwitchModeLink onClick={vm.goToSignUp}>{t('login.signup.title')}</S.SwitchModeLink>
        </S.SwitchModeText>
      </S.Card>
    </S.Page>
  );
};
