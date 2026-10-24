import type { EditWindowSpec } from '../../../../../domain/schema/editWindow';
import { editWindowIssue } from '../../../../../domain/schema/editWindow';

/** O que a aba "Prazo para alteração" do Form Design edita — `editWindow`, desmontado em controles. */
export interface EditWindowFormState {
  enabled: boolean;
  /** Texto, porque é o que o campo devolve; vira número só ao gravar. */
  minutes: string;
  locksDelete: boolean;
}

export const EMPTY_EDIT_WINDOW_FORM: EditWindowFormState = { enabled: false, minutes: '15', locksDelete: false };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A declaração gravada, como a aba a mostra. */
export const toEditWindowForm = (stored: unknown): EditWindowFormState => {
  if (!isPlainObject(stored)) return EMPTY_EDIT_WINDOW_FORM;
  return {
    enabled: true,
    minutes: typeof stored.minutes === 'number' ? String(stored.minutes) : '',
    locksDelete: stored.delete === true,
  };
};

/** O que gravar: `null` desliga — e apaga, porque a gravação da tela é um `updateDoc`. */
export const fromEditWindowForm = (form: EditWindowFormState): EditWindowSpec | null =>
  form.enabled
    ? { minutes: Number(form.minutes.trim()), ...(form.locksDelete ? { delete: true } : {}) }
    : null;

/** O mesmo portão do `check` do pacote: `minutes` inteiro e positivo. */
export const editWindowFormIsValid = (form: EditWindowFormState): boolean => {
  const value = fromEditWindowForm(form);
  return value === null || (form.minutes.trim() !== '' && editWindowIssue(value) === null);
};
