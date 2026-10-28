import React from 'react';
import { RiShieldKeyholeLine } from 'react-icons/ri';
import { useSecondFactorPanelViewModel } from './SecondFactorPanel.viewmodel';
import { S } from './SecondFactorPanel.styles';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { useT } from '../../../shared/i18n/useT';

/** O próprio segundo fator neste escritório — em Segurança e no Perfil. */
export const SecondFactorPanel: React.FC = () => {
  const vm = useSecondFactorPanelViewModel();
  const t = useT('core.access');

  return (
    <S.Panel>
      <S.Header>
        <RiShieldKeyholeLine />
        {t('mfa.panel.title')}
        {!vm.loading && (
          <S.State $active={vm.enrolled}>{t(vm.enrolled ? 'mfa.panel.state.active' : 'mfa.panel.state.inactive')}</S.State>
        )}
      </S.Header>
      {vm.loading ? <Spinner size={20} /> : (
        <>
          <S.Text>
            {vm.enrolled
              ? t('mfa.panel.enrolled', { since: vm.enrolledAt, left: vm.recoveryCodesLeft })
              : t('mfa.panel.not-enrolled')}
          </S.Text>
          {vm.required && <S.Text>{t('mfa.panel.required', { minutes: vm.reverifyMinutes })}</S.Text>}
          {vm.enrolled && !vm.required && <S.Text>{t('mfa.panel.not-required')}</S.Text>}
          <S.Actions>
            <Button type="button" variant={vm.enrolled ? 'secondary' : 'primary'} size="sm" onClick={vm.setUp}>
              {t(vm.enrolled ? 'mfa.panel.replace' : 'mfa.panel.set-up')}
            </Button>
            {vm.enrolled && (
              <Button type="button" variant="secondary" size="sm" onClick={vm.regenerateRecoveryCodes}>
                {t('mfa.panel.recovery-codes')}
              </Button>
            )}
          </S.Actions>
        </>
      )}
    </S.Panel>
  );
};
