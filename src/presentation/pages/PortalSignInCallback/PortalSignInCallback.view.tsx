import React from 'react';
import { Link } from 'react-router-dom';
import { usePortalSignInCallbackViewModel } from './PortalSignInCallback.viewmodel';
import { S } from './PortalSignInCallback.styles';
import { Spinner } from '../../components/ui/Spinner';
import { useLabel, useT } from '../../shared/i18n/useT';

export const PortalSignInCallbackView: React.FC = () => {
  const vm = usePortalSignInCallbackViewModel();
  const t = useT('core.tenant');
  const label = useLabel();

  return (
    <S.Page>
      <S.Card>
        <S.Title>{t('portal.title')}</S.Title>
        {vm.failure ? (
          <>
            <S.Error>{label(vm.failure)}</S.Error>
            <Link to={vm.signInPath}>{t('portal.signin.back')}</Link>
          </>
        ) : (
          <>
            <Spinner size={28} />
            <S.Text>{t('portal.signin.verifying')}</S.Text>
          </>
        )}
      </S.Card>
    </S.Page>
  );
};
