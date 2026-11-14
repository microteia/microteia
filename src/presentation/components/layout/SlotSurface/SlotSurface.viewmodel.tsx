import type { SurfaceSlotDescriptor } from '../../../shared/settings/useSettingsCatalog';
import { useVisibleSlots } from '../../../shared/useDockPanels';

export interface SlotSurfaceViewModel {
  slots: SurfaceSlotDescriptor[];
}

export const useSlotSurfaceViewModel = (surface: string): SlotSurfaceViewModel => ({
  slots: useVisibleSlots(surface),
});
