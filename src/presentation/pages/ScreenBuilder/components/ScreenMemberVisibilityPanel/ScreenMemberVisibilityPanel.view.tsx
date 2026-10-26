import React from 'react';
import { S } from './ScreenMemberVisibilityPanel.styles';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { InputGroup, Label } from '../../../../components/ui/Input';
import { MultiSearchSelect } from '../../../../components/ui/MultiSearchSelect';
import type { MultiSearchSelectOption } from '../../../../components/ui/MultiSearchSelect';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';
import { useT } from '../../../../shared/i18n/useT';
import type { MemberVisibilityFormState } from './screenMemberVisibilityForm';

export interface ScreenMemberVisibilityPanelProps {
  form: MemberVisibilityFormState;
  /** Os campos da tela que referenciam um membro — os únicos que nomeiam alguém. */
  fieldOptions: MultiSearchSelectOption[];
  /** A supervisão: a derivada primeiro, depois as permissões do catálogo. */
  bypassOptions: SearchSelectOption[];
  /** O defeito que impede gravar, já traduzido; `null` quando não há. */
  issue: string | null;
  /** Quantos campos a regra lê — `MEMBER_VISIBILITY_MAX_FIELDS`. */
  maxFields: number;
  /** A tela veio de uma extensão: a declaração dela vence na próxima atualização. */
  fromExtension: boolean;
  onChange: (patch: Partial<MemberVisibilityFormState>) => void;
}

/** A aba "Visibilidade dos registros": quem lê cada registro. Só desenha o que recebe. */
export const ScreenMemberVisibilityPanel: React.FC<ScreenMemberVisibilityPanelProps> = ({
  form,
  fieldOptions,
  bypassOptions,
  issue,
  maxFields,
  fromExtension,
  onChange,
}) => {
  const t = useT('core.records');
  return (
    <S.Panel>
      <InfoBanner variant="info" message={t('member-visibility.panel.description')} />
      {fromExtension && <InfoBanner variant="warning" message={t('member-visibility.panel.from-extension')} />}
      {fieldOptions.length === 0 && !form.enabled && (
        <InfoBanner variant="warning" message={t('member-visibility.panel.no-member-fields')} />
      )}
      <Checkbox
        label={t('member-visibility.panel.enabled')}
        checked={form.enabled}
        disabled={fieldOptions.length === 0 && !form.enabled}
        onChange={(enabled) => onChange({ enabled })}
      />
      {form.enabled && (
        <>
          <InputGroup>
            <Label>{t('member-visibility.panel.fields')}</Label>
            <MultiSearchSelect
              options={fieldOptions}
              values={form.userFields}
              onChange={(userFields) => onChange({ userFields })}
              placeholder={t('member-visibility.panel.fields.placeholder')}
            />
            <S.Hint>{t('member-visibility.panel.fields.hint', { max: String(maxFields) })}</S.Hint>
          </InputGroup>
          <InputGroup>
            <Label>{t('member-visibility.panel.bypass')}</Label>
            <SearchSelect
              options={bypassOptions}
              value={form.bypassPermission}
              onChange={(bypassPermission) => onChange({ bypassPermission })}
            />
            <S.Hint>{t('member-visibility.panel.bypass.hint')}</S.Hint>
          </InputGroup>
          {issue && <InfoBanner variant="warning" message={issue} />}
        </>
      )}
    </S.Panel>
  );
};
