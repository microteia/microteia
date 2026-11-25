import { useMemo } from 'react';
import { useAuthorization } from '../../stores/useAuthorization';
import { useLabel } from './i18n/useT';

export interface PermissionOption {
  value: string;
  label: string;
}

/**
 * As permissões do catálogo do escritório, com o nome QUALIFICADO — a ação sozinha não diz do quê
 * ("Editar" de quê?). É o seletor de "uma permissão existente" dos designers de porta (#33).
 *
 * `stored` é a gravada: a que o catálogo não conhece mais continua visível — sumir com ela do seletor
 * seria removê-la na próxima gravação sem ninguém ter pedido.
 */
export const usePermissionOptions = (stored?: string | null): PermissionOption[] => {
  const { catalog } = useAuthorization();
  const label = useLabel();
  return useMemo(() => {
    const options = catalog.list.map((permission) => {
      const resource = catalog.resourceLabels.get(permission.resource);
      return {
        value: permission.id,
        label: label('@core.access/role.qualified-name', {
          action: label(permission.name),
          resource: resource ? label(resource.name, resource.nameParams) : permission.resource,
        }),
      };
    });
    return stored && !options.some((option) => option.value === stored)
      ? [...options, { value: stored, label: stored }]
      : options;
  }, [catalog, label, stored]);
};
