import { useMemo } from 'react';
import { useAuth } from '../../../../stores/useAuth';
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
  const { userRole } = useAuth();

  const byKey = useMemo(
    () => new Map(widgets.map((widget) => [widget.key, widget])),
    [widgets],
  );

  const slots = useMemo<SurfaceSlot[]>(() => {
    const role = userRole;
    return entries
      .filter((entry) => entry.enabled)
      .map((entry) => ({ entry, widget: byKey.get(entry.key) }))
      .filter((item): item is { entry: typeof item.entry; widget: SurfaceWidgetDescriptor } => !!item.widget)
      .filter(({ widget }) => !widget.requiredRole || role === widget.requiredRole || role === 'SYSTEM')
      .map(({ entry, widget }) => ({ key: entry.key, span: entry.span, widget }));
  }, [entries, byKey, userRole]);

  return {
    slots,
    hasWidgets: widgets.length > 0,
    isAllDisabled: widgets.length > 0 && slots.length === 0,
  };
};
