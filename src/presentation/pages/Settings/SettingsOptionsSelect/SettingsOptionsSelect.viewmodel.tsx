import { useCallback, useMemo } from 'react';
import { isMultiSelectProperty, type SettingsProperty } from '../../../../domain/schema/settings';
import { useSettingOptions, type SettingOption } from '../../../shared/settings/useSettingOptions';
import { useT } from '../../../shared/i18n/useT';

export interface SettingsOptionsSelectProps {
  property: SettingsProperty;
  pluginId?: string;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

/**
 * `colored` é o seletor do formulário para um `select` com `lookupCollection` — o que mostra a cor da
 * opção e marca a que não existe mais. `search` é o de um `reference`, e também o da lista fechada.
 */
export type SettingsOptionsControl = 'colored' | 'search';

export interface SettingsOptionsSelectViewModel {
  control: SettingsOptionsControl;
  multi: boolean;
  options: SettingOption[];
  single: string;
  values: string[];
  disabled: boolean;
  notice: string | null;
  placeholder: string;
  changeSingle: (value: string) => void;
  changeMulti: (values: string[]) => void;
}

export const useSettingsOptionsSelectViewModel = ({
  property,
  pluginId,
  value,
  disabled,
  onChange,
}: SettingsOptionsSelectProps): SettingsOptionsSelectViewModel => {
  const t = useT('core.settings');
  const { status, options, sourceTitle } = useSettingOptions(property, pluginId);
  const multi = isMultiSelectProperty(property);

  const values = useMemo(
    () => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []),
    [value],
  );

  const notice = useMemo(() => {
    if (status === 'forbidden') return t('settings.options.forbidden', { screen: sourceTitle });
    if (status === 'unavailable') return t('settings.options.unavailable');
    return null;
  }, [status, sourceTitle, t]);

  const changeSingle = useCallback((next: string) => onChange(next), [onChange]);
  const changeMulti = useCallback((next: string[]) => onChange(next), [onChange]);

  return {
    control: property.optionsFrom?.kind === 'lookup' ? 'colored' : 'search',
    multi,
    options,
    single: typeof value === 'string' ? value : '',
    values,
    disabled: disabled || status !== 'ready',
    notice,
    placeholder: t('core.ui/action.select'),
    changeSingle,
    changeMulti,
  };
};
