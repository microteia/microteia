import React from 'react';
import { FieldInput } from '../FieldInput';
import { SearchSelect } from '../SearchSelect';
import { filterTextOf } from '../../../shared/report/reportFilterFields';
import { useT, type TranslateFn } from '../../../shared/i18n/useT';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';

export interface FieldFilterInputProps {
  /** O campo do schema, já visto como valor de filtro (`filterFieldOf`). */
  field: FieldDefinition;
  value: CustomFieldValue;
  onChange: (value: CustomFieldValue) => void;
}

/** Um filtro booleano tem TRÊS respostas, e a terceira é não perguntar. */
const booleanOptions = (t: TranslateFn) => [
  { value: '', label: t('parameter.unset') },
  { value: 'true', label: t('boolean.yes') },
  { value: 'false', label: t('boolean.no') },
];

/**
 * O controle com que se informa o VALOR de um filtro sobre um campo do schema.
 *
 * É o `FieldInput` do formulário do registro — a mesma fonte de verdade por tipo de campo —, com uma
 * única divergência, e ela é da PERGUNTA e não do controle: no registro, um booleano é sim ou não, e
 * a caixa de marcar diz as duas; num filtro existe uma terceira resposta — "não filtre por isto" —
 * que uma caixa desmarcada não consegue distinguir de "não". Por isso ali vale a lista de três.
 */
export const FieldFilterInput: React.FC<FieldFilterInputProps> = ({ field, value, onChange }) => {
  const t = useT('core.ui');

  if (field.type === 'checkbox') {
    return (
      <SearchSelect
        options={booleanOptions(t)}
        value={filterTextOf(value)}
        onChange={(next) => onChange(next === '' ? null : next === 'true')}
      />
    );
  }

  return <FieldInput field={field} value={value} onChange={onChange} showLabel={false} />;
};
