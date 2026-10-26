import type { MemberVisibilitySpec } from '../../../../../domain/schema/memberVisibility';
import { MEMBER_VISIBILITY_MAX_FIELDS } from '../../../../../domain/schema/memberVisibility';

/** O que a aba "Visibilidade dos registros" do Form Design edita — `memberVisibility`, em controles. */
export interface MemberVisibilityFormState {
  enabled: boolean;
  userFields: string[];
  /** Vazio = a supervisão derivada, `<coleção>.read-all`. */
  bypassPermission: string;
}

export const EMPTY_MEMBER_VISIBILITY_FORM: MemberVisibilityFormState = {
  enabled: false,
  userFields: [],
  bypassPermission: '',
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A declaração gravada, como a aba a mostra. */
export const toMemberVisibilityForm = (stored: unknown): MemberVisibilityFormState => {
  if (!isPlainObject(stored)) return EMPTY_MEMBER_VISIBILITY_FORM;
  return {
    enabled: true,
    userFields: Array.isArray(stored.userFields)
      ? stored.userFields.filter((field): field is string => typeof field === 'string')
      : [],
    bypassPermission: typeof stored.bypassPermission === 'string' ? stored.bypassPermission : '',
  };
};

/** O que gravar: `null` desliga — e apaga, porque a gravação da tela é um `updateDoc`. */
export const fromMemberVisibilityForm = (form: MemberVisibilityFormState): MemberVisibilitySpec | null =>
  form.enabled
    ? { userFields: [...form.userFields], ...(form.bypassPermission ? { bypassPermission: form.bypassPermission } : {}) }
    : null;

export type MemberVisibilityFormIssue = 'fields-required' | 'fields-too-many';

/**
 * O defeito que impede gravar, ou `null`. A aba só oferece campos de referência a membro, então das
 * recusas do `check` sobram as duas que a pessoa consegue cometer: nenhum campo, ou campos demais.
 */
export const memberVisibilityFormIssue = (form: MemberVisibilityFormState): MemberVisibilityFormIssue | null => {
  if (!form.enabled) return null;
  if (form.userFields.length === 0) return 'fields-required';
  if (form.userFields.length > MEMBER_VISIBILITY_MAX_FIELDS) return 'fields-too-many';
  return null;
};
