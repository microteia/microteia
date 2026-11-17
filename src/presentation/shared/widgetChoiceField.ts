import { useCallback } from 'react';
import { useLookups } from '../../stores/useLookups';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useInstalledExtensions } from '../../stores/useInstalledExtensions';
import { useAuthorization } from '../../stores/useAuthorization';
import { resolveSettingsOptionsScreen } from '../../domain/usecases/plugins/settingsOptionsScreen';
import { screenDataCollection, screenReadPermission } from '../../domain/services/screenDataCollection';
import type { FieldDefinition } from '../../domain/entities';
import type { WidgetFilter } from '../../domain/schema/ui/widgetSpec';
import { filterFieldOf } from './report/reportFilterFields';

const EMPTY_PACKAGE_SCREENS: never[] = [];

/**
 * O CAMPO com que um filtro de escolha da barra pergunta — um `reference` para `record`, um `select`
 * com `lookupCollection` para `lookup` —, visto como filtro (`filterFieldOf`).
 *
 * Campo, e não um seletor próprio da barra: o controle é o mesmo do formulário e do filtro do
 * relatório, com a busca no servidor, o título do registro e a cor da opção. Um segundo seletor seria
 * um segundo lugar onde essas três coisas podem divergir.
 *
 * `null` quando não há o que oferecer: a tela não existe neste escritório (a extensão dona não está
 * instalada), quem olha não pode lê-la, ou a lista não é conhecida. O filtro some da barra, e o
 * relatório segue com o padrão dele — um seletor vazio diria "não há clientes", e o que há é outra coisa.
 */
export const useWidgetChoiceField = (
  pluginId: string | undefined,
): ((filter: WidgetFilter, label: string) => FieldDefinition | null) => {
  const { availableLookups, loading: lookupsLoading } = useLookups();
  const { dynamicScreens } = useScreenDefinitions();
  const { installedOf } = useInstalledExtensions();
  const { can } = useAuthorization();
  const packageScreens = pluginId ? installedOf(pluginId)?.package.screens ?? EMPTY_PACKAGE_SCREENS : EMPTY_PACKAGE_SCREENS;

  return useCallback((filter: WidgetFilter, label: string): FieldDefinition | null => {
    const collection = typeof filter.collection === 'string' ? filter.collection.trim() : '';
    if (collection === '') return null;
    const base = { key: filter.key, label, required: false, order: 0, origin: 'plugin' as const };

    let field: FieldDefinition | null = null;
    if (filter.control === 'lookup') {
      const known = lookupsLoading || availableLookups.some((lookup) => lookup.collection === collection);
      field = known ? { ...base, type: 'select', lookupCollection: collection } : null;
    } else if (filter.control === 'record') {
      const screen = resolveSettingsOptionsScreen(collection, packageScreens, dynamicScreens);
      field = screen && can(screenReadPermission(screen))
        ? { ...base, type: 'reference', refEntity: screenDataCollection(screen) }
        : null;
    }
    return field ? { ...filterFieldOf(field), multi: filter.multi !== false } : null;
  }, [availableLookups, lookupsLoading, packageScreens, dynamicScreens, can]);
};
