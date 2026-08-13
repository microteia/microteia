import { useCallback } from 'react';
import { useTenant } from '../../../stores/useTenant';
import { useExprViewer } from '../useExprViewer';
import { isActionHidden } from '../../../domain/schema/actionExpression';

export type ActionGate = (
  hiddenWhen: string | null | undefined,
  record: Record<string, unknown>,
  surface?: string,
) => boolean;

/**
 * A expressão `hiddenWhen` de uma ação, avaliada por REGISTRO — o mesmo escopo que o cartão nativo
 * usa (os campos na raiz, mais `record`, `role`, `surface`, `user`).
 *
 * Existe porque uma extensão que desenha a própria superfície precisa honrar a declaração de quem
 * contribuiu a ação, e reescrever a avaliação do lado de lá produziria uma segunda semântica para a
 * mesma palavra. Sem expressão declarada, a ação aparece: ausência não é ocultação.
 */
export const useActionGate = (): ActionGate => {
  const { tenantRole } = useTenant();
  const viewer = useExprViewer();

  return useCallback((hiddenWhen, record, surface = 'list') => !isActionHidden(hiddenWhen, {
    values: record,
    record,
    isNew: false,
    isDirty: false,
    role: tenantRole ?? '',
    surface,
    relation: 'none',
    user: viewer,
  }), [tenantRole, viewer]);
};
