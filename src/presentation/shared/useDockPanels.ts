import { useCallback, useContext, useMemo } from 'react';
import { InstalledExtensionStoreContext } from '../../stores/useInstalledExtensions';
import { useOptionalAuthorization } from '../../stores/useAuthorization';
import { WORKSPACE_SLOT_SURFACES } from '../../domain/schema/ui/uiExtensionPoints';
import { backendFunctionAvailability } from '../../domain/usecases/plugins/backendFunctionAvailability';
import { useSurfaceSlots, type SurfaceSlotDescriptor } from './settings/useSettingsCatalog';
import { useSurfaceSlotLayout } from './settings/useSettingValue';

/**
 * Se a function de que um trecho depende está no ar. Lê o store pelo CONTEXTO, e não pelo hook que
 * lança: as regiões do shell também aparecem na tela de entrada, onde não há extensões carregadas —
 * e ali a ausência fecha, como a da autorização.
 */
export const useBackendFunctionReady = (): ((functionName: string | undefined) => boolean) => {
  const store = useContext(InstalledExtensionStoreContext);
  return useCallback(
    (functionName) => !functionName
      || (!!store && backendFunctionAvailability(store.installed, store.appliedBackend, functionName) === 'ready'),
    [store],
  );
};

/**
 * Os trechos de uma região que esta pessoa pode ver AGORA: ligados na configuração, permitidos pela
 * autorização e com a function de que dependem no ar. É a mesma conta para a fileira de trechos e
 * para o dock — duas cópias dela divergiriam exatamente no filtro novo.
 */
export const useVisibleSlots = (surface: string): SurfaceSlotDescriptor[] => {
  const registered = useSurfaceSlots(surface);
  const { entries } = useSurfaceSlotLayout(surface);
  const authorization = useOptionalAuthorization();
  const functionReady = useBackendFunctionReady();

  const byKey = useMemo(() => new Map(registered.map((slot) => [slot.key, slot])), [registered]);

  return useMemo(
    () => entries
      .filter((entry) => entry.enabled)
      .map((entry) => byKey.get(entry.key))
      .filter((slot): slot is SurfaceSlotDescriptor => !!slot)
      .filter((slot) => !slot.requiredPermissions?.length
        || (!!authorization && authorization.canAny(slot.requiredPermissions)))
      .filter((slot) => functionReady(slot.requiresFunction)),
    [entries, byKey, authorization, functionReady],
  );
};

/** Os painéis do dock que esta pessoa pode abrir. */
export const useDockPanels = (): SurfaceSlotDescriptor[] => useVisibleSlots(WORKSPACE_SLOT_SURFACES.dockRight);
