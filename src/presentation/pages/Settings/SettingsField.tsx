import React from 'react';
import { Checkbox } from '../../components/ui/Checkbox';
import { Input } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { TagInput } from '../../components/ui/TagInput';
import { WidgetLayoutEditor } from './WidgetLayoutEditor';
import { ContributionListEditor } from './ContributionListEditor';
import { SettingsOptionsSelect } from './SettingsOptionsSelect';
import {
  settingsToJson,
  stringListPattern,
  type ContributionLayoutEntry,
  type SettingsProperty,
  type WidgetLayoutEntry,
} from '../../../domain/schema/settings';
import { useLocale } from '../../../stores/useLocale';
import { localeDisplayName } from '../../../domain/schema/i18n/localeFormat';
import { useTheme, AUTOMATIC_THEME } from '../../../stores/useTheme';
import { useSettings } from '../../../stores/useSettings';
import { automaticTimeZone, timeZoneOptions } from '../../../domain/schema/i18n/timeZone';

import { useT, useLabel } from '../../shared/i18n/useT';
interface SettingsFieldProps {
  property: SettingsProperty;
  /** A extensão que declarou a propriedade — resolve uma coleção do próprio pacote em `optionsFrom`. */
  pluginId?: string;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

/**
 * O editor de UMA propriedade, escolhido pelo `type` declarado. É o que torna a tela genérica: um
 * plugin declara `boolean` e ganha uma caixa de seleção sem escrever interface nenhuma.
 */
export const SettingsField: React.FC<SettingsFieldProps> = ({ property, pluginId, value, disabled, onChange }) => {
  const t = useT('core.settings');
  const label = useLabel();
  const { available, locale, preferred } = useLocale();
  const { available: themes } = useTheme();
  const { values: settingsValues } = useSettings();

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
        <SettingsOptionsSelect
          property={property}
          pluginId={pluginId}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );

    /**
     * As opções são os idiomas INSTALADOS, não uma lista declarada: acrescentar um idioma é instalar
     * um pacote de tradução, nunca editar o núcleo. O idioma-fonte está sempre entre eles, então um
     * escritório sem nenhum pacote continua tendo o que escolher.
     */
    case 'locale': {
      /**
       * Sem NADA gravado em escopo nenhum (`preferred === null`), o campo mostra o idioma EM VIGOR,
       * e não o `default` declarado na propriedade. Sem isso a tela mente: `resolveSetting`
       * devolveria `en` enquanto o provedor está rodando no idioma negociado com o navegador, e o
       * escritório leria "Inglês" numa interface em português.
       *
       * Isto NÃO é dívida: é a leitura correta de um campo cujo valor efetivo, quando não gravado,
       * depende de negociação e não do `default`.
       */
      const effective = preferred === null ? locale : value;
      return (
        <SearchSelect
          value={typeof effective === 'string' ? effective : ''}
          options={available.map((option) => ({ value: option, label: localeDisplayName(option) }))}
          disabled={disabled}
          onChange={(next) => onChange(next)}
          placeholder={t('core.ui/action.select')}
        />
      );
    }

    /**
     * As opções são os temas INSTALADOS, mais "Automático". Acrescentar um tema é instalar uma
     * extensão, nunca editar o núcleo — o mesmo contrato do idioma.
     *
     * "Automático" é uma opção de verdade, e não a ausência de escolha, porque as duas se comportam
     * de forma diferente: ela SEGUE o aparelho, e continua seguindo quando o aparelho muda de claro
     * para escuro no fim da tarde. Sem ela não haveria caminho de volta depois do primeiro clique.
     */
    case 'theme':
      return (
        <SearchSelect
          value={typeof value === 'string' && value.trim() !== '' ? value : AUTOMATIC_THEME}
          options={[
            { value: AUTOMATIC_THEME, label: t('core.theme/theme.automatic') },
            ...themes.map((theme) => ({ value: theme.id, label: label(theme.name) })),
          ]}
          disabled={disabled}
          onChange={(next) => onChange(next)}
          placeholder={t('core.ui/action.select')}
        />
      );

    /**
     * As opções são os fusos IANA que a plataforma conhece, mais "Automático" — o valor vazio, que
     * segue o idioma do escritório. O fuso efetivo do automático aparece no rótulo: sem ele, quem
     * escolhe não sabe o que está deixando de escolher.
     */
    case 'timezone':
      return (
        <SearchSelect
          value={typeof value === 'string' ? value : ''}
          options={[
            { value: '', label: t('core.i18n/timezone.automatic', { zone: automaticTimeZone(settingsValues) }) },
            ...timeZoneOptions().map((zone) => ({ value: zone, label: zone })),
          ]}
          disabled={disabled}
          onChange={(next) => onChange(next)}
          placeholder={t('core.ui/action.select')}
        />
      );

    case 'stringList': {
      const pattern = stringListPattern(property);
      return (
        <TagInput
          value={Array.isArray(value) ? (value as string[]) : []}
          disabled={disabled}
          placeholder={property.itemPlaceholder ?? t('settings.list.item.placeholder')}
          hint={t('settings.list.hint')}
          validator={pattern ? (item) => pattern.test(item) : undefined}
          onChange={(items) => onChange(items)}
        />
      );
    }

    case 'widgets':
      return (
        <WidgetLayoutEditor
          surface={property.surface ?? property.key}
          value={value}
          disabled={disabled}
          onChange={(entries: WidgetLayoutEntry[]) => onChange(entries)}
        />
      );

    case 'contributions':
      return (
        <ContributionListEditor
          point={property.point ?? property.key}
          surface={property.surface}
          value={value}
          disabled={disabled}
          onChange={(entries: ContributionLayoutEntry[]) => onChange(entries)}
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
