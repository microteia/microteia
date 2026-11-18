import { useCallback, useMemo } from 'react';
import { useT, useLabel } from '../../../../shared/i18n/useT';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';
import type { QueryOrderBy } from '../../../../../domain/schema/querySpec';
import { RECORD_WINDOW_DEFAULT } from '../../../../../domain/repositories/IRecordRepository';
import {
  LIST_ORDER_MAX_KEYS,
  LIST_ORDER_RECORD_PATHS,
  isListOrderField,
} from '../../../../../domain/schema/ui/listOrder';
import type { ListOrderFieldInfo } from '../../../../../domain/schema/ui/listOrder';
import { addListOrderKey } from './screenListOrderForm';

export interface ListOrderPanelField extends ListOrderFieldInfo {
  label: string;
}

export interface ScreenListOrderPanelProps {
  keys: readonly QueryOrderBy[];
  fields: readonly ListOrderPanelField[];
  /** Os problemas da declaração, já como frase. */
  issues: readonly string[];
  /** A tela veio de uma extensão: a ordem que ela declarar vence na próxima atualização. */
  fromExtension: boolean;
  onChange: (keys: QueryOrderBy[]) => void;
}

export interface ListOrderRow {
  /** Chave de render: a posição, porque duas linhas podem estar sem campo ao mesmo tempo. */
  id: string;
  path: string;
  dir: QueryOrderBy['dir'];
}

export interface ScreenListOrderPanelViewModel {
  rows: ListOrderRow[];
  pathOptions: SearchSelectOption[];
  directionOptions: SearchSelectOption[];
  canAdd: boolean;
  hasKeys: boolean;
  windowHint: string;
  issues: readonly string[];
  fromExtension: boolean;
  add: () => void;
  setPath: (index: number, path: string) => void;
  setDir: (index: number, dir: string) => void;
  remove: (index: number) => void;
}

export const useScreenListOrderPanelViewModel = ({
  keys,
  fields,
  issues,
  fromExtension,
  onChange,
}: ScreenListOrderPanelProps): ScreenListOrderPanelViewModel => {
  const t = useT('core.records');
  const label = useLabel();

  const pathOptions = useMemo<SearchSelectOption[]>(() => {
    const systemLabels: Record<string, string> = {
      createdAt: t('list-order.panel.created-at'),
      updatedAt: t('list-order.panel.updated-at'),
    };
    return [
      ...fields.filter(isListOrderField).map((field) => ({ value: field.key, label: label(field.label) || field.key })),
      ...LIST_ORDER_RECORD_PATHS.map((path) => ({ value: path, label: systemLabels[path] ?? path })),
    ];
  }, [fields, label, t]);

  const directionOptions = useMemo<SearchSelectOption[]>(() => [
    { value: 'asc', label: t('list-order.panel.asc') },
    { value: 'desc', label: t('list-order.panel.desc') },
  ], [t]);

  const rows = useMemo<ListOrderRow[]>(
    () => keys.map((key, index) => ({ id: String(index), path: key.path, dir: key.dir })),
    [keys],
  );

  const add = useCallback(
    () => onChange(addListOrderKey(keys, pathOptions.map((option) => option.value))),
    [keys, pathOptions, onChange],
  );
  const setPath = useCallback(
    (index: number, path: string) => onChange(keys.map((key, position) => (position === index ? { ...key, path } : key))),
    [keys, onChange],
  );
  const setDir = useCallback(
    (index: number, dir: string) => onChange(keys.map((key, position) =>
      position === index ? { ...key, dir: dir === 'asc' ? 'asc' : 'desc' } : key)),
    [keys, onChange],
  );
  const remove = useCallback(
    (index: number) => onChange(keys.filter((_, position) => position !== index)),
    [keys, onChange],
  );

  return {
    rows,
    pathOptions,
    directionOptions,
    canAdd: keys.length < LIST_ORDER_MAX_KEYS,
    hasKeys: keys.length > 0,
    windowHint: t('list-order.panel.window', { count: String(RECORD_WINDOW_DEFAULT) }),
    issues,
    fromExtension,
    add,
    setPath,
    setDir,
    remove,
  };
};
