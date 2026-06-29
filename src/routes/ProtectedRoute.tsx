import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../stores/useAuth';
import { FullPageSpinner, Spinner } from '../presentation/components/ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isEmailVerified, loading } = useAuth();

  if (loading) {
    return (
      <FullPageSpinner>
        <Spinner size={40} />
      </FullPageSpinner>
    );
  }

  if (!user || !isEmailVerified) return <Navigate to="/login" replace />;

  return <>{children}</>;
};
