import React from 'react';
import { S } from './FieldSequencePanel.styles';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { Input, InputGroup, Label } from '../../../../components/ui/Input';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';
import { useT } from '../../../../shared/i18n/useT';
import type { FieldSequenceFormState } from './fieldSequenceForm';
import type { RecordSequenceReset, RecordSequenceScope } from '../../../../../domain/schema/recordSequence';

export interface FieldSequencePanelProps {
  form: FieldSequenceFormState;
  /** O campo já numera: a configuração não muda mais, porque mudar poderia repetir número emitido. */
  locked: boolean;
  /** Campo `number`: guarda o inteiro — sem formato e sem recomeço anual. */
  numeric: boolean;
  /** A tela pertence a um registro-pai, e por isso pode contar dentro dele. */
  hasParent: boolean;
  preview: string;
  scopeOptions: SearchSelectOption[];
  resetOptions: SearchSelectOption[];
  onChange: (patch: Partial<FieldSequenceFormState>) => void;
}

/** A seção "Numeração" do campo: o número que o registro recebe ao ser salvo. Só desenha o que recebe. */
export const FieldSequencePanel: React.FC<FieldSequencePanelProps> = (props) => {
  const { form, locked, numeric, hasParent, onChange } = props;
  const t = useT('core.records');
  return (
    <S.Panel>
      <Checkbox
        label={t('field.sequence.enabled')}
        checked={form.enabled}
        disabled={locked}
        onChange={(enabled) => onChange({ enabled })}
      />
      <S.Hint>{t('field.sequence.description')}</S.Hint>
      {locked && <InfoBanner variant="info" message={t('field.sequence.locked')} />}
      {form.enabled && (
        <>
          <S.Row>
            {!numeric && (
              <InputGroup>
                <Label>{t('field.sequence.pattern')}</Label>
                <Input
                  value={form.pattern}
                  disabled={locked}
                  onChange={(event) => onChange({ pattern: event.target.value })}
                />
                <S.Hint>{t('field.sequence.pattern.hint')}</S.Hint>
              </InputGroup>
            )}
            {!numeric && (
              <InputGroup>
                <Label>{t('field.sequence.reset')}</Label>
                <SearchSelect
                  options={props.resetOptions}
                  value={form.resetBy}
                  disabled={locked}
                  onChange={(value) => onChange({ resetBy: value as RecordSequenceReset })}
                />
              </InputGroup>
            )}
            {hasParent && (
              <InputGroup>
                <Label>{t('field.sequence.scope')}</Label>
                <SearchSelect
                  options={props.scopeOptions}
                  value={form.scope}
                  disabled={locked}
                  onChange={(value) => onChange({ scope: value as RecordSequenceScope })}
                />
              </InputGroup>
            )}
          </S.Row>
          {props.preview && <S.Preview>{t('field.sequence.preview', { value: props.preview })}</S.Preview>}
        </>
      )}
    </S.Panel>
  );
};
