import React from 'react';
import { usePortalViewModel } from './Portal.viewmodel';
import { S } from './Portal.styles';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { PortalContent } from './components/PortalContent';
import { SidebarLayout } from './components/SidebarLayout';
import { TopLayout } from './components/TopLayout';
import { NotificationBanner } from '../../components/layout/NotificationBanner';
import { useT } from '../../shared/i18n/useT';

/**
 * O portal: os estados de antes do conteúdo (carregando, falha, escolher escritório) numa casca
 * simples, e depois o conteúdo dentro do LAYOUT que o escritório escolheu — o lateral, o de topo, ou
 * o de uma extensão. Trocar de layout não muda o que a página mostra, só onde cada coisa fica.
 *
 * O aviso passageiro fica FORA do layout, por cima dele: assim o layout de uma extensão escrito antes
 * dele também o mostra, sem mudar uma linha.
 */
export const PortalView: React.FC = () => {
  const vm = usePortalViewModel();
  const t = useT('core.tenant');

  if (vm.loading) {
    return <TopLayout><S.Centered><Spinner size={32} /></S.Centered></TopLayout>;
  }

  if (vm.error) {
    return (
      <TopLayout>
        <S.Centered>
          <S.Title>{t('portal.title')}</S.Title>
          <p>
            {vm.error === 'load-failed' || vm.error === 'context-failed'
              ? t('portal.load-failed')
              : vm.error === 'no-access'
                ? t('portal.no-access')
                : vm.error === 'no-access-identity'
                  ? t('portal.no-access.identity')
                  : vm.error === 'identity-required' ? t('portal.signin.identity-required') : t('portal.not-invited')}
          </p>
          {vm.signInAgain && (
            <Button size="sm" onClick={() => void vm.signOut()}>{t('portal.signin.again')}</Button>
          )}
          {vm.errorCode && <S.Muted>{t('portal.error.code', { code: vm.errorCode })}</S.Muted>}
          {vm.canRetry && <Button size="sm" onClick={vm.retry}>{t('portal.retry')}</Button>}
          {vm.signedInAs && <S.Muted>{t('portal.signed-in-as', { email: vm.signedInAs })}</S.Muted>}
        </S.Centered>
      </TopLayout>
    );
  }

  if (vm.showChooser) {
    return (
      <TopLayout>
        <S.Title>{t('portal.choose')}</S.Title>
        <S.List>
          {vm.memberships.map((membership) => (
            <S.Card key={membership.tenantId} onClick={() => vm.chooseTenant(membership.tenantId)}>
              <S.CardTitle>{membership.tenantName}</S.CardTitle>
            </S.Card>
          ))}
        </S.List>
      </TopLayout>
    );
  }

  const content = <PortalContent vm={vm} />;
  return (
    <>
      {vm.Layout
        ? <vm.Layout>{content}</vm.Layout>
        : vm.builtinLayout === 'top' ? <TopLayout>{content}</TopLayout> : <SidebarLayout>{content}</SidebarLayout>}
      <NotificationBanner persistErrors />
    </>
  );
};
