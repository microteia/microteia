import { useMemo } from 'react';
import { useAuth } from '../../stores/useAuth';
import { useTenant } from '../../stores/useTenant';
import type { ExprViewer } from '../../domain/schema/actionExpression';

/**
 * Quem está olhando, na forma que as expressões de UI consomem (`user.id`, `user.name`, `user.role`).
 * Ponto único: o selo do menu, as ações do cartão e as do cabeçalho do registro precisam do MESMO
 * usuário, e uma declaração que funcione num lugar tem de funcionar nos três.
 */
export const useExprViewer = (): ExprViewer => {
  const { user, effectiveName } = useAuth();
  const { tenantRole } = useTenant();
  return useMemo(
    () => ({ id: user?.id ?? '', name: effectiveName, role: tenantRole ?? '' }),
    [user, effectiveName, tenantRole],
  );
};
