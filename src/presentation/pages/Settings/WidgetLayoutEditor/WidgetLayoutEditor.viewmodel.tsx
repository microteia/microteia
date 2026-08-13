import { useCallback, useMemo } from 'react';
import { useSurfaceWidgets } from '../../../shared/settings/useSettingsCatalog';
import {
  MAX_WIDGET_SPAN,
  MIN_WIDGET_SPAN,
  resolveWidgetLayout,
  type WidgetLayoutEntry,
} from '../../../../domain/schema/settings';

export interface WidgetLayoutEditorProps {
  surface: string;
  value: unknown;
  disabled?: boolean;
  onChange: (entries: WidgetLayoutEntry[]) => void;
}

export interface WidgetLayoutItem extends WidgetLayoutEntry {
  title: string;
  description?: string;
  icon?: string;
  isFirst: boolean;
  isLast: boolean;
}

export interface WidgetLayoutEditorViewModel {
  items: WidgetLayoutItem[];
  spanOptions: number[];
  toggle: (key: string) => void;
  move: (key: string, direction: -1 | 1) => void;
  setSpan: (key: string, span: number) => void;
}

export const useWidgetLayoutEditorViewModel = (
  props: WidgetLayoutEditorProps,
): WidgetLayoutEditorViewModel => {
  const { surface, value, onChange } = props;
  const widgets = useSurfaceWidgets(surface);

  const entries = useMemo(() => resolveWidgetLayout(value, widgets), [value, widgets]);

  const items = useMemo<WidgetLayoutItem[]>(() => {
    const byKey = new Map(widgets.map((widget) => [widget.key, widget]));
    return entries.map((entry, index) => {
      const widget = byKey.get(entry.key);
      return {
        ...entry,
        title: widget?.title ?? entry.key,
        description: widget?.description,
        icon: widget?.icon,
        isFirst: index === 0,
        isLast: index === entries.length - 1,
      };
    });
  }, [entries, widgets]);

  const commit = useCallback((next: WidgetLayoutEntry[]) => {
    onChange(next.map(({ key, enabled, span }) => ({ key, enabled, span })));
  }, [onChange]);

  const toggle = useCallback((key: string) => {
    commit(entries.map((entry) => (entry.key === key ? { ...entry, enabled: !entry.enabled } : entry)));
  }, [entries, commit]);

  const move = useCallback((key: string, direction: -1 | 1) => {
    const index = entries.findIndex((entry) => entry.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }, [entries, commit]);

  const setSpan = useCallback((key: string, span: number) => {
    commit(entries.map((entry) => (entry.key === key ? { ...entry, span } : entry)));
  }, [entries, commit]);

  const spanOptions = useMemo(
    () => Array.from({ length: MAX_WIDGET_SPAN - MIN_WIDGET_SPAN + 1 }, (_, i) => MIN_WIDGET_SPAN + i),
    [],
  );

  return { items, spanOptions, toggle, move, setSpan };
};
