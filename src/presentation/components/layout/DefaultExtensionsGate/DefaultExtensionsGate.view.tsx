import React from 'react';
import { RiPuzzle2Line } from 'react-icons/ri';
import { useDefaultExtensionsGateViewModel } from './DefaultExtensionsGate.viewmodel';
import { S } from './DefaultExtensionsGate.styles';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { useT } from '../../../shared/i18n/useT';

/**
 * A primeira entrada de um escritório novo que recebe extensões padrão: a pessoa espera, vendo o que
 * está sendo instalado, em vez de cair numa tela que ainda está se montando.
 */
export const DefaultExtensionsGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const vm = useDefaultExtensionsGateViewModel();
  const t = useT('core.marketplace');

  if (!vm.active) return <>{children}</>;

  return (
    <S.Page>
      <S.Card role="status" aria-live="polite">
        <S.Header><RiPuzzle2Line size={22} /><S.Title>{t('onboarding.title')}</S.Title></S.Header>
        <S.Lead>{t('onboarding.lead')}</S.Lead>
        {vm.failure ? (
          <>
            <S.Error role="alert">{t('onboarding.failed', { ...vm.failure.params, name: vm.failure.name })}</S.Error>
            <S.Actions>
              <Button type="button" variant="ghost" onClick={() => void vm.skip()}>{t('onboarding.skip')}</Button>
              <Button type="button" onClick={vm.retry}>{t('onboarding.retry')}</Button>
            </S.Actions>
          </>
        ) : (
          <S.Progress>
            <Spinner size={18} />
            {t('onboarding.progress', { done: String(vm.done + 1), total: String(vm.total), name: vm.currentName })}
          </S.Progress>
        )}
      </S.Card>
    </S.Page>
  );
};
