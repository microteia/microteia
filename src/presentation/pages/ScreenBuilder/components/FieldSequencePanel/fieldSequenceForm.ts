import type { CustomFieldType } from '../../../../../domain/entities';
import type {
  AutoValueSpec,
  RecordSequenceIssueCode,
  RecordSequenceReset,
  RecordSequenceScope,
} from '../../../../../domain/schema/recordSequence';
import {
  formatRecordSequenceValue,
  readAutoValueSequence,
  recordSequenceIssues,
} from '../../../../../domain/schema/recordSequence';

/** O que a seção "Numeração" do campo edita — `autoValue.sequence`, desmontado em controles. */
export interface FieldSequenceFormState {
  enabled: boolean;
  pattern: string;
  scope: RecordSequenceScope;
  resetBy: RecordSequenceReset;
}

/** O protocolo é o caso dominante: ano, barra e seis dígitos, recomeçando a cada ano. */
export const EMPTY_FIELD_SEQUENCE_FORM: FieldSequenceFormState = {
  enabled: false,
  pattern: 'YYYY/000000',
  scope: 'tenant',
  resetBy: 'year',
};

/** Os tipos que guardam um número: `text` o formatado, `number` o inteiro. */
export const fieldTypeSupportsSequence = (type: CustomFieldType): boolean => type === 'text' || type === 'number';

/** A declaração gravada, como a seção a mostra. O sorteio (`autoValue` sem `sequence`) não liga a seção. */
export const toFieldSequenceForm = (autoValue: unknown): FieldSequenceFormState => {
  const sequence = readAutoValueSequence(autoValue);
  if (!sequence) return EMPTY_FIELD_SEQUENCE_FORM;
  const pattern = (autoValue as { pattern?: unknown }).pattern;
  return { enabled: true, pattern: typeof pattern === 'string' ? pattern : '', ...sequence };
};

/**
 * O `autoValue` a gravar, ou `null` para não numerar. O campo `number` guarda o inteiro: não leva
 * padrão e não recomeça por ano — recomeçar repetiria o número, já que não há `YYYY` que o distinga.
 */
export const fromFieldSequenceForm = (
  form: FieldSequenceFormState,
  type: CustomFieldType,
): AutoValueSpec | null => {
  if (!form.enabled) return null;
  if (type === 'number') return { pattern: '', sequence: { scope: form.scope, resetBy: 'never' } };
  return { pattern: form.pattern.trim(), sequence: { scope: form.scope, resetBy: form.resetBy } };
};

/** O mesmo portão do `check` do pacote — a primeira recusa, ou `null`. */
export const fieldSequenceFormIssue = (
  form: FieldSequenceFormState,
  type: CustomFieldType,
  hasParent: boolean,
): RecordSequenceIssueCode | null => {
  const autoValue = fromFieldSequenceForm(form, type);
  if (!autoValue) return null;
  return recordSequenceIssues([{ key: 'field', type, autoValue }], { hasParent })[0]?.code ?? null;
};

/** O primeiro número que a configuração produz — o exemplo que a seção mostra. */
export const fieldSequencePreview = (
  form: FieldSequenceFormState,
  type: CustomFieldType,
  year: number,
): string => {
  const autoValue = fromFieldSequenceForm(form, type);
  if (!autoValue) return '';
  return String(formatRecordSequenceValue({
    field: 'field',
    counterId: '',
    counter: { collection: '', field: '', parent: '', period: '' },
    pattern: autoValue.pattern,
    numeric: type === 'number',
    year,
  }, 1));
};
