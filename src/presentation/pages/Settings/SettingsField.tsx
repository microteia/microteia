import React from 'react';
import { Checkbox } from '../../components/ui/Checkbox';
import { Input } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { WidgetLayoutEditor } from './WidgetLayoutEditor';
import { settingsToJson, type SettingsProperty, type WidgetLayoutEntry } from '../../../domain/schema/settings';

interface SettingsFieldProps {
  property: SettingsProperty;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

/**
 * O editor de UMA propriedade, escolhido pelo `type` declarado. É o que torna a tela genérica: um
 * plugin declara `boolean` e ganha uma caixa de seleção sem escrever interface nenhuma.
 */
export const SettingsField: React.FC<SettingsFieldProps> = ({ property, value, disabled, onChange }) => {
  switch (property.type) {
    case 'boolean':
      return (
        <Checkbox
          checked={value === true}
          label={property.label}
          disabled={disabled}
          onChange={(checked) => onChange(checked)}
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={typeof value === 'number' ? String(value) : ''}
          disabled={disabled}
          min={property.min}
          max={property.max}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? next : 0);
          }}
        />
      );

    case 'select':
      return (
        <SearchSelect
          value={typeof value === 'string' ? value : ''}
          options={(property.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
          disabled={disabled}
          onChange={(next) => onChange(next)}
          placeholder="Selecione..."
        />
      );

    case 'widgets':
      return (
        <WidgetLayoutEditor
          surface={property.surface ?? property.key}
          value={value}
          disabled={disabled}
          onChange={(entries: WidgetLayoutEntry[]) => onChange(entries)}
        />
      );

    case 'json':
      return (
        <Input
          value={typeof value === 'string' ? value : settingsToJson(value as never).trim()}
          disabled={disabled}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value));
            } catch {
              onChange(event.target.value);
            }
          }}
        />
      );

    case 'text':
    default:
      return (
        <Input
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
};
