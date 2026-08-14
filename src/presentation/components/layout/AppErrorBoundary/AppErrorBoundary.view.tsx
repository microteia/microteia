import React from 'react';
import { RiErrorWarningLine } from 'react-icons/ri';
import { useAppErrorBoundaryViewModel } from './AppErrorBoundary.viewmodel';
import { S } from './AppErrorBoundary.styles';
import { ErrorBoundary } from '../ErrorBoundary';
import { Button } from '../../ui/Button';

import { useT } from '../../../shared/i18n/useT';
export const AppErrorBoundaryView: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const vm = useAppErrorBoundaryViewModel();
  const t = useT('core.ui');

  return (
    <ErrorBoundary
      onError={vm.handleError}
      fallback={
        <S.Fallback>
          <RiErrorWarningLine size={40} />
          <S.Title>{t('error.unexpected.title')}</S.Title>
          <S.Text>{t('error.unexpected.text')}</S.Text>
          <Button variant="primary" onClick={vm.handleReload}>{t('error.reload')}</Button>
        </S.Fallback>
      }
    >
      {children}
    </ErrorBoundary>
  );
};
