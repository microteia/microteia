import React from 'react';
import { RiErrorWarningLine } from 'react-icons/ri';
import { useAppErrorBoundaryViewModel } from './AppErrorBoundary.viewmodel';
import { S } from './AppErrorBoundary.styles';
import { ErrorBoundary } from '../ErrorBoundary';
import { Button } from '../../ui/Button';

export const AppErrorBoundaryView: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const vm = useAppErrorBoundaryViewModel();

  return (
    <ErrorBoundary
      onError={vm.handleError}
      fallback={
        <S.Fallback>
          <RiErrorWarningLine size={40} />
          <S.Title>Ocorreu um erro inesperado</S.Title>
          <S.Text>A equipe técnica já foi notificada. Tente recarregar a página.</S.Text>
          <Button variant="primary" onClick={vm.handleReload}>Recarregar</Button>
        </S.Fallback>
      }
    >
      {children}
    </ErrorBoundary>
  );
};
