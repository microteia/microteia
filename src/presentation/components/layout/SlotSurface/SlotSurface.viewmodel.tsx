import { useMemo } from 'react';
import { useAuthorization } from '../../../../stores/useAuthorization';
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
  const { canAny } = useAuthorization();

  const byKey = useMemo(() => new Map(registered.map((slot) => [slot.key, slot])), [registered]);

  const slots = useMemo<SurfaceSlotDescriptor[]>(
    () => entries
      .filter((entry) => entry.enabled)
      .map((entry) => byKey.get(entry.key))
      .filter((slot): slot is SurfaceSlotDescriptor => !!slot)
      .filter((slot) => !slot.requiredPermissions?.length || canAny(slot.requiredPermissions)),
    [entries, byKey, canAny],
  );

  return { slots };
};
