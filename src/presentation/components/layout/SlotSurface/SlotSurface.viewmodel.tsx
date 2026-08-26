import { useMemo } from 'react';
import { useOptionalAuthorization } from '../../../../stores/useAuthorization';
import {
  useSurfaceSlots,
  type SurfaceSlotDescriptor,
} from '../../../shared/settings/useSettingsCatalog';
import { useSurfaceSlotLayout } from '../../../shared/settings/useSettingValue';

export interface SlotSurfaceViewModel {
  slots: SurfaceSlotDescriptor[];
}

export const useSlotSurfaceViewModel = (surface: string): SlotSurfaceViewModel => {
  const registered = useSurfaceSlots(surface);
  const { entries } = useSurfaceSlotLayout(surface);
  // Fora do escritório não há autorização, e a ausência FECHA: um trecho que exige permissão não
  // aparece na tela de entrada, onde não há a quem concedê-la.
  const authorization = useOptionalAuthorization();

  const byKey = useMemo(() => new Map(registered.map((slot) => [slot.key, slot])), [registered]);

  const slots = useMemo<SurfaceSlotDescriptor[]>(
    () => entries
      .filter((entry) => entry.enabled)
      .map((entry) => byKey.get(entry.key))
      .filter((slot): slot is SurfaceSlotDescriptor => !!slot)
      .filter((slot) => !slot.requiredPermissions?.length
        || (!!authorization && authorization.canAny(slot.requiredPermissions))),
    [entries, byKey, authorization],
  );

  return { slots };
};
