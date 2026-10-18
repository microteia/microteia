import type { PortalDeclaration } from '../../../../../domain/schema/portal';

export type PortalSubjectKind = 'self' | 'field' | 'parent';

/** O que a aba "Portal" do Form Design edita — a declaração, desmontada em controles. */
export interface PortalFormState {
  enabled: boolean;
  subjectKind: PortalSubjectKind;
  subjectField: string;
  fields: string[];
  documents: boolean;
}

export const EMPTY_PORTAL_FORM: PortalFormState = {
  enabled: false,
  subjectKind: 'self',
  subjectField: '',
  fields: [],
  documents: false,
};

export const toPortalForm = (portal: PortalDeclaration | null | undefined): PortalFormState => {
  if (!portal) return EMPTY_PORTAL_FORM;
  const subject = portal.subject;
  return {
    enabled: true,
    subjectKind: subject === 'self' || subject === 'parent' ? subject : 'field',
    subjectField: typeof subject === 'object' ? subject.field : '',
    fields: [...portal.fields],
    documents: portal.documents === true,
  };
};

/** `null` desliga: a tela sai do portal, e o servidor apaga o que tinha projetado dela. */
export const fromPortalForm = (form: PortalFormState): PortalDeclaration | null => {
  if (!form.enabled) return null;
  return {
    subject: form.subjectKind === 'field' ? { field: form.subjectField } : form.subjectKind,
    fields: form.fields,
    documents: form.documents,
  };
};
