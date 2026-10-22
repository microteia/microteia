import type { PortalDeclaration } from '../../../../../domain/schema/portal';

export type PortalSubjectKind = 'self' | 'field' | 'parent';

/** O que a aba "Portal" do Form Design edita — a declaração, desmontada em controles. */
export interface PortalFormState {
  enabled: boolean;
  subjectKind: PortalSubjectKind;
  subjectField: string;
  fields: string[];
  /** Só os registros em que esta condição vale saem — vazio = todos. */
  visibleWhen: string;
  documents: boolean;
  /** O convidado cria registros, preenchendo só `createFields`. */
  allowCreate: boolean;
  createFields: string[];
  /** O convidado anexa documentos, escolhendo entre `uploadTypes` — vazio = todos os do escritório. */
  allowUploads: boolean;
  uploadTypes: string[];
  /** O convidado altera `editFields`, quando `editWhen` vale, e só o que criou se `editOnlyOwn`. */
  allowEdit: boolean;
  editFields: string[];
  editWhen: string;
  editOnlyOwn: boolean;
  /** Avisar o escritório da atividade do convidado — ligado por padrão. */
  notifyOffice: boolean;
}

export const EMPTY_PORTAL_FORM: PortalFormState = {
  enabled: false,
  subjectKind: 'self',
  subjectField: '',
  fields: [],
  visibleWhen: '',
  documents: false,
  allowCreate: false,
  createFields: [],
  allowUploads: false,
  uploadTypes: [],
  allowEdit: false,
  editFields: [],
  editWhen: '',
  editOnlyOwn: false,
  notifyOffice: true,
};

export const toPortalForm = (portal: PortalDeclaration | null | undefined): PortalFormState => {
  if (!portal) return EMPTY_PORTAL_FORM;
  const subject = portal.subject;
  return {
    enabled: true,
    subjectKind: subject === 'self' || subject === 'parent' ? subject : 'field',
    subjectField: typeof subject === 'object' ? subject.field : '',
    fields: [...portal.fields],
    visibleWhen: portal.visibleWhen ?? '',
    documents: portal.documents === true,
    allowCreate: !!portal.create,
    createFields: [...(portal.create?.fields ?? [])],
    allowUploads: !!portal.uploads,
    uploadTypes: [...(portal.uploads?.types ?? [])],
    allowEdit: !!portal.edit,
    editFields: [...(portal.edit?.fields ?? [])],
    editWhen: portal.edit?.when ?? '',
    editOnlyOwn: portal.edit?.onlyOwn === true,
    notifyOffice: portal.notifyOffice !== false,
  };
};

/** `null` desliga: a tela sai do portal, e o servidor apaga o que tinha projetado dela. */
export const fromPortalForm = (form: PortalFormState): PortalDeclaration | null => {
  if (!form.enabled) return null;
  return {
    subject: form.subjectKind === 'field' ? { field: form.subjectField } : form.subjectKind,
    fields: form.fields,
    ...(form.visibleWhen.trim() ? { visibleWhen: form.visibleWhen.trim() } : {}),
    documents: form.documents,
    ...(form.allowCreate && form.subjectKind !== 'self' ? { create: { fields: form.createFields } } : {}),
    // Anexar exige ver: sem `documents`, o convidado não enxergaria o que enviou.
    ...(form.allowUploads && form.documents ? { uploads: { types: form.uploadTypes } } : {}),
    ...(form.allowEdit
      ? {
        edit: {
          // Só o que o convidado vê é editável: desmarcar um campo exposto o tira da edição também.
          fields: form.editFields.filter((key) => form.fields.includes(key)),
          ...(form.editWhen.trim() ? { when: form.editWhen.trim() } : {}),
          ...(form.editOnlyOwn ? { onlyOwn: true } : {}),
        },
      }
      : {}),
    ...(form.notifyOffice ? {} : { notifyOffice: false }),
  };
};
