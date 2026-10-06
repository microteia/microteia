import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../stores/useAuth';
import { FullPageSpinner, Spinner } from '../presentation/components/ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isEmailVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <FullPageSpinner>
        <Spinner size={40} />
      </FullPageSpinner>
    );
  }

  // O destino viaja no `state`, e não na URL: o consentimento de OAuth chega com uma consulta longa
  // que não cabe num parâmetro sem ser codificada duas vezes. Sem levá-lo, quem chega deslogado a
  // uma rota qualquer cai no painel depois de entrar — e, no caso do OAuth, o pedido some sem aviso:
  // a autorização simplesmente nunca acontece, e nada na tela diz por quê.
  if (!user || !isEmailVerified) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
};
