import React from 'react';
import { FcGoogle } from 'react-icons/fc';
import { RiMailSendLine, RiArrowLeftLine } from 'react-icons/ri';
import { useLoginViewModel } from './Login.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Input, Label } from '../../components/ui/Input';
import { S } from './Login.styles';

export const LoginView: React.FC = () => {
  const vm = useLoginViewModel();

  if (vm.mode === 'verify-email') {
    return (
      <S.Page>
        <S.Card>
          <S.Logo>
            <img src="/logo.png" alt="Microteia" style={{ width: '80px', height: '80px' }} />
          </S.Logo>
          <S.VerifyEmailIcon>
            <RiMailSendLine />
          </S.VerifyEmailIcon>
          <S.Title>Verifique seu e-mail</S.Title>
          <S.VerifyEmailText>
            Enviamos um link de verificação para <strong>{vm.emailField}</strong>.
            Clique nele para ativar sua conta. Olhe a caixa de entrada e a pasta de spam.
          </S.VerifyEmailText>
          <S.ButtonGroup>
            <Button $fullWidth size="lg" onClick={vm.handleCheckVerification} $isLoading={vm.loading} disabled={vm.loading}>
              {vm.loading ? <Spinner size={18} /> : null}
              Já verifiquei
            </Button>
            <Button $fullWidth size="lg" variant="ghost" onClick={vm.handleResendVerification} $isLoading={vm.loading} disabled={vm.loading}>
              Reenviar e-mail
            </Button>
            <Button $fullWidth size="lg" variant="ghost" onClick={vm.handleCancelVerification} $isLoading={vm.loading} disabled={vm.loading}>
              Usar outro método
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
            <RiArrowLeftLine /> Voltar
          </S.BackLink>
          <S.Logo>
            <img src="/logo.png" alt="Microteia" style={{ width: '80px', height: '80px' }} />
          </S.Logo>
          <S.Title>Redefinir senha</S.Title>
          <S.Subtitle>
            Informe seu e-mail para receber o link de redefinição.
          </S.Subtitle>
          <S.Form>
            <S.InputGroup>
              <Label htmlFor="reset-email">E-mail</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="seu@email.com"
                value={vm.emailField}
                onChange={(e) => vm.handleEmailChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <Button $fullWidth size="lg" onClick={vm.handleForgotPassword} $isLoading={vm.loading} disabled={vm.loading}>
              {vm.loading ? <Spinner size={18} /> : null}
              Enviar link
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
            <RiArrowLeftLine /> Voltar
          </S.BackLink>
          <S.Logo>
            <img src="/logo.png" alt="Microteia" style={{ width: '80px', height: '80px' }} />
          </S.Logo>
          <S.Title>Criar conta</S.Title>
          <S.Form>
            <S.InputGroup>
              <Label htmlFor="signup-name">Nome completo</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="Seu nome"
                value={vm.displayNameField}
                onChange={(e) => vm.handleDisplayNameChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <S.InputGroup>
              <Label htmlFor="signup-email">E-mail</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="seu@email.com"
                value={vm.emailField}
                onChange={(e) => vm.handleEmailChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <S.InputGroup>
              <Label htmlFor="signup-password">Senha</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={vm.passwordField}
                onChange={(e) => vm.handlePasswordChange(e.target.value)}
                disabled={vm.loading}
              />
            </S.InputGroup>
            <S.InputGroup>
              <Label htmlFor="signup-confirm">Confirmar senha</Label>
              <Input
                id="signup-confirm"
                type="password"
                placeholder="Repita a senha"
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
                Li e aceito os{' '}
                <S.TermsLink href="/license?from=login" target="_blank" rel="noopener noreferrer">
                  Termos de Uso e a Política de Privacidade
                </S.TermsLink>
                .
              </S.TermsText>
            </S.TermsRow>
            <Button $fullWidth size="lg" onClick={vm.handleEmailSignUp} $isLoading={vm.loading} disabled={vm.loading || !vm.termsAccepted}>
              {vm.loading ? <Spinner size={18} /> : null}
              Criar conta
            </Button>
          </S.Form>
          {vm.error && <S.ErrorMessage>{vm.error}</S.ErrorMessage>}
          <S.SwitchModeText>
            Já tem conta?{' '}
            <S.SwitchModeLink onClick={vm.goToLogin}>Entrar</S.SwitchModeLink>
          </S.SwitchModeText>
        </S.Card>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Card>
        <S.Logo>
          <img src="/logo.png" alt="Microteia" style={{ width: '80px', height: '80px' }} />
        </S.Logo>
        <S.Title>Microteia</S.Title>
        <S.Subtitle>
          Plataforma de aplicações de negócio. Crie sistemas personalizados de forma declarativa e extensível.
        </S.Subtitle>
        <S.Form>
          <S.InputGroup>
            <Label htmlFor="login-email">E-mail</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="seu@email.com"
              value={vm.emailField}
              onChange={(e) => vm.handleEmailChange(e.target.value)}
              disabled={vm.loading}
            />
          </S.InputGroup>
          <S.InputGroup>
            <Label htmlFor="login-password">Senha</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="Sua senha"
              value={vm.passwordField}
              onChange={(e) => vm.handlePasswordChange(e.target.value)}
              disabled={vm.loading}
            />
            <S.ForgotPasswordLink onClick={vm.goToForgotPassword}>
              Esqueci minha senha
            </S.ForgotPasswordLink>
          </S.InputGroup>
          <Button $fullWidth size="lg" onClick={vm.handleEmailLogin} $isLoading={vm.loading} disabled={vm.loading}>
            {vm.loading ? <Spinner size={18} /> : null}
            Entrar
          </Button>
        </S.Form>

        <S.Divider>ou</S.Divider>

        <S.TermsRow>
          <S.TermsCheckbox
            checked={vm.termsAccepted}
            onChange={(e) => vm.handleTermsAcceptedChange(e.target.checked)}
            disabled={vm.loading}
          />
          <S.TermsText>
            Li e aceito os{' '}
            <S.TermsLink href="/license?from=login" target="_blank" rel="noopener noreferrer">
              Termos de Uso e a Política de Privacidade
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
          {vm.loading ? 'Entrando...' : 'Continuar com Google'}
        </Button>

        {vm.error && <S.ErrorMessage>{vm.error}</S.ErrorMessage>}

        <S.SwitchModeText>
          Não tem conta?{' '}
          <S.SwitchModeLink onClick={vm.goToSignUp}>Criar conta</S.SwitchModeLink>
        </S.SwitchModeText>
      </S.Card>
    </S.Page>
  );
};
