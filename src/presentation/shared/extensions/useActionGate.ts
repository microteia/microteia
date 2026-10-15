import { useCallback } from 'react';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { recordExpressionValues } from '../../../domain/services/customFieldValues';
import { useExprViewer } from '../useExprViewer';
import { useActionReferences } from '../useActionReferences';
import { isActionHidden } from '../../../domain/schema/actionExpression';

export type ActionGate = (
  hiddenWhen: string | null | undefined,
  record: Record<string, unknown>,
  surface?: string,
  /** A coleção sobre a qual a ação age — o que `<entity>` vira em `hasPermission`. */
  entity?: string,
) => boolean;

/**
 * A expressão `hiddenWhen` de uma ação, avaliada por REGISTRO — o mesmo escopo que o cartão nativo
 * usa (os campos na raiz, mais `record`, `role`, `surface`, `user`, e as referências navegáveis).
 *
 * Existe porque uma extensão que desenha a própria superfície precisa honrar a declaração de quem
 * contribuiu a ação, e reescrever a avaliação do lado de lá produziria uma segunda semântica para a
 * mesma palavra. Sem expressão declarada, a ação aparece: ausência não é ocultação.
 */
export const useActionGate = (): ActionGate => {
  const { effectivePermissions } = useAuthorization();
  const viewer = useExprViewer();
  const references = useActionReferences();
  const { getScreenFieldsFor } = useScreenDefinitions();

  // Com a coleção dita, os campos chegam na forma do formulário, como no cartão nativo; sem ela, não
  // há esquema a que recorrer, e o registro vai como veio.
  return useCallback((hiddenWhen, record, surface = 'list', entity = '') => !isActionHidden(hiddenWhen, {
    values: entity ? recordExpressionValues(getScreenFieldsFor(entity), record) : record,
    record,
    isNew: false,
    isDirty: false,
    permissions: effectivePermissions,
    entity,
    surface,
    relation: 'none',
    user: viewer,
    references,
  }), [effectivePermissions, viewer, references, getScreenFieldsFor]);
};
