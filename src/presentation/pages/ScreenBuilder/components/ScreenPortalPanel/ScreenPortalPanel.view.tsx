import React from 'react';
import { S } from './ScreenPortalPanel.styles';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { RadioGroup } from '../../../../components/ui/RadioButton';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { useT } from '../../../../shared/i18n/useT';
import type { PortalFormState, PortalSubjectKind } from './screenPortalForm';

export interface ScreenPortalPanelProps {
  form: PortalFormState;
  fieldOptions: Array<{ value: string; label: string }>;
  /** Os campos que o convidado pode preencher — todos, menos o do vínculo, que o servidor carimba. */
  createFieldOptions: Array<{ value: string; label: string }>;
  referenceFieldOptions: Array<{ value: string; label: string }>;
  hasParent: boolean;
  hasDocuments: boolean;
  /** Declarado por uma extensão: o escritório vê, e quem muda é ela. */
  readOnly: boolean;
  /** Já traduzidos. */
  issues: string[];
  onToggleEnabled: (enabled: boolean) => void;
  onSubjectKind: (kind: PortalSubjectKind) => void;
  onSubjectField: (fieldKey: string) => void;
  onToggleField: (fieldKey: string, exposed: boolean) => void;
  onToggleDocuments: (documents: boolean) => void;
  onToggleCreate: (allowCreate: boolean) => void;
  onToggleCreateField: (fieldKey: string, fillable: boolean) => void;
}

/** A aba "Portal" da tela: o que sai do escritório, e para quem. Só desenha o que recebe. */
export const ScreenPortalPanel: React.FC<ScreenPortalPanelProps> = (props) => {
  const t = useT('core.records');
  const { form, readOnly } = props;

  const subjectOptions = [
    { value: 'self', label: t('portal.subject.self') },
    ...(props.referenceFieldOptions.length > 0 ? [{ value: 'field', label: t('portal.subject.field') }] : []),
    ...(props.hasParent ? [{ value: 'parent', label: t('portal.subject.parent') }] : []),
  ];

  return (
    <S.Panel>
      <InfoBanner variant="info" message={t('portal.panel.description')} />
      {readOnly && <InfoBanner variant="warning" message={t('portal.panel.managed')} />}

      <Checkbox
        checked={form.enabled}
        onChange={props.onToggleEnabled}
        label={t('portal.enabled')}
        disabled={readOnly}
      />

      {form.enabled && (
        <>
          <S.Section>
            <S.SectionTitle>{t('portal.subject.title')}</S.SectionTitle>
            <S.Hint>{t('portal.subject.hint')}</S.Hint>
            {readOnly ? (
              <S.Hint>{subjectOptions.find((option) => option.value === form.subjectKind)?.label}</S.Hint>
            ) : (
              <RadioGroup
                name="portal-subject"
                value={form.subjectKind}
                onChange={(value) => props.onSubjectKind(value as PortalSubjectKind)}
                options={subjectOptions}
              />
            )}
            {props.referenceFieldOptions.length === 0 && !props.hasParent && (
              <S.Hint>{t('portal.subject.only-self')}</S.Hint>
            )}
            {form.subjectKind === 'field' && (
              <SearchSelect
                options={props.referenceFieldOptions}
                value={form.subjectField}
                onChange={props.onSubjectField}
                placeholder={t('portal.subject.field.placeholder')}
                disabled={readOnly}
              />
            )}
          </S.Section>

          <S.Section>
            <S.SectionTitle>{t('portal.fields.title')}</S.SectionTitle>
            <S.Hint>{t('portal.fields.hint')}</S.Hint>
            <S.FieldGrid>
              {props.fieldOptions.map((option) => (
                <Checkbox
                  key={option.value}
                  checked={form.fields.includes(option.value)}
                  onChange={(exposed) => props.onToggleField(option.value, exposed)}
                  label={option.label}
                  disabled={readOnly}
                />
              ))}
            </S.FieldGrid>
          </S.Section>

          <S.Section>
            <Checkbox
              checked={form.documents}
              onChange={props.onToggleDocuments}
              label={t('portal.documents')}
              disabled={readOnly || !props.hasDocuments}
            />
            <S.Hint>{props.hasDocuments ? t('portal.documents.hint') : t('portal.documents.unavailable')}</S.Hint>
          </S.Section>

          <S.Section>
            <Checkbox
              checked={form.allowCreate && form.subjectKind !== 'self'}
              onChange={props.onToggleCreate}
              label={t('portal.create.enabled')}
              disabled={readOnly || form.subjectKind === 'self'}
            />
            <S.Hint>{form.subjectKind === 'self' ? t('portal.create.self-hint') : t('portal.create.hint')}</S.Hint>
            {form.allowCreate && form.subjectKind !== 'self' && (
              <S.FieldGrid>
                {props.createFieldOptions.map((option) => (
                  <Checkbox
                    key={option.value}
                    checked={form.createFields.includes(option.value)}
                    onChange={(fillable) => props.onToggleCreateField(option.value, fillable)}
                    label={option.label}
                    disabled={readOnly}
                  />
                ))}
              </S.FieldGrid>
            )}
          </S.Section>

          {props.issues.length > 0 && (
            <S.Issues>
              {props.issues.map((issue) => <InfoBanner key={issue} variant="warning" message={issue} />)}
            </S.Issues>
          )}
        </>
      )}
    </S.Panel>
  );
};
