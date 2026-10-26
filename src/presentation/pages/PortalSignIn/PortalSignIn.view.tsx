import React from 'react';
import { RiShieldCheckLine } from 'react-icons/ri';
import { usePortalSignInViewModel } from './PortalSignIn.viewmodel';
import { S } from './PortalSignIn.styles';
import { Button } from '../../components/ui/Button';
import { Input, InputGroup, Label } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { useT } from '../../shared/i18n/useT';

export const PortalSignInView: React.FC = () => {
  const vm = usePortalSignInViewModel();
  const t = useT('core.tenant');
  const busy = vm.status === 'sending' || vm.status === 'signing-in' || vm.status === 'signed-in' || vm.status === 'redirecting';
  const offersProviders = vm.providers.length > 0 && vm.mode === 'request';
  const offersEmail = vm.emailLinkEnabled || vm.mode === 'confirm';

  if (vm.processing) {
    return (
      <S.Page>
        <S.Card as="div">
          <S.Title>{t('portal.title')}</S.Title>
          <Spinner size={28} />
          <S.Text>{t('portal.signin.processing')}</S.Text>
        </S.Card>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Card onSubmit={(event) => void vm.submit(event)}>
        <S.Title>{t('portal.title')}</S.Title>
        {offersProviders && (
          <S.Providers>
            <S.Text>{t('portal.signin.providers')}</S.Text>
            {vm.providers.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="secondary"
                onClick={() => void vm.signInWithProvider(provider.id)}
                disabled={busy}
              >
                <RiShieldCheckLine size={16} />
                {t('portal.signin.with', { provider: provider.label })}
              </Button>
            ))}
            {vm.status === 'provider-failed' && <S.Error>{t('portal.signin.provider-failed')}</S.Error>}
          </S.Providers>
        )}
        {offersProviders && offersEmail && <S.Divider>{t('portal.signin.or')}</S.Divider>}
        {offersEmail && (
          <>
            <S.Text>{vm.mode === 'confirm' ? t('portal.signin.confirm') : t('portal.signin.request')}</S.Text>
            <InputGroup>
              <Label htmlFor="portal-email">{t('portal.email')}</Label>
              <Input
                id="portal-email"
                type="email"
                autoComplete="email"
                value={vm.email}
                onChange={(event) => vm.setEmail(event.target.value)}
                placeholder={t('portal.email.placeholder')}
                disabled={busy}
              />
            </InputGroup>
            {vm.status === 'sent' && <S.Success>{t('portal.signin.sent')}</S.Success>}
            {vm.status === 'failed' && <S.Error>{t('portal.signin.failed')}</S.Error>}
            <Button type="submit" disabled={busy || !vm.email.trim()}>
              {vm.mode === 'confirm' ? t('portal.signin.enter') : t('portal.signin.send')}
            </Button>
          </>
        )}
      </S.Card>
    </S.Page>
  );
};
