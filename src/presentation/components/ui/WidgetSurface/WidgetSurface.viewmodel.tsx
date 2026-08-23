import { useMemo } from 'react';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useSurfaceWidgets, type SurfaceWidgetDescriptor } from '../../../shared/settings/useSettingsCatalog';
import { useSurfaceLayout } from '../../../shared/settings/useSettingValue';

export interface SurfaceSlot {
  key: string;
  span: number;
  widget: SurfaceWidgetDescriptor;
}

export interface WidgetSurfaceViewModel {
  slots: SurfaceSlot[];
  /** Há widgets registrados, mas nenhum ligado — o vazio que se resolve nas Configurações. */
  isAllDisabled: boolean;
  hasWidgets: boolean;
}

export const useWidgetSurfaceViewModel = (surface: string): WidgetSurfaceViewModel => {
  const widgets = useSurfaceWidgets(surface);
  const { entries } = useSurfaceLayout(surface);
  const { canAny } = useAuthorization();

  const byKey = useMemo(
    () => new Map(widgets.map((widget) => [widget.key, widget])),
    [widgets],
  );

  const slots = useMemo<SurfaceSlot[]>(
    () => entries
      .filter((entry) => entry.enabled)
      .map((entry) => ({ entry, widget: byKey.get(entry.key) }))
      .filter((item): item is { entry: typeof item.entry; widget: SurfaceWidgetDescriptor } => !!item.widget)
      .filter(({ widget }) => !widget.requiredPermissions?.length || canAny(widget.requiredPermissions))
      .map(({ entry, widget }) => ({ key: entry.key, span: entry.span, widget })),
    [entries, byKey, canAny],
  );

  return {
    slots,
    hasWidgets: widgets.length > 0,
    isAllDisabled: widgets.length > 0 && slots.length === 0,
  };
};
