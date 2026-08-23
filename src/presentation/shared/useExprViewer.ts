import { useMemo } from 'react';
import { useAuth } from '../../stores/useAuth';
import { useAuthorization } from '../../stores/useAuthorization';
import type { ExprViewer } from '../../domain/schema/actionExpression';

/**
 * Quem está olhando, na forma que as expressões de UI consomem (`user.id`, `user.name`,
 * `user.permissions`). Ponto único: o selo do menu, as ações do cartão e as do cabeçalho do registro
 * precisam do MESMO usuário, e uma declaração que funcione num lugar tem de funcionar nos três.
 */
export const useExprViewer = (): ExprViewer => {
  const { user, effectiveName } = useAuth();
  const { effectivePermissions } = useAuthorization();
  return useMemo(
    () => ({ id: user?.id ?? '', name: effectiveName, permissions: effectivePermissions }),
    [user, effectiveName, effectivePermissions],
  );
};
