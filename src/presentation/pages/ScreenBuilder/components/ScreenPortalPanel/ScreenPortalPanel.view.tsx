import React from 'react';
import { S } from './ScreenPortalPanel.styles';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { RadioGroup } from '../../../../components/ui/RadioButton';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { CodeEditor } from '../../../../components/ui/CodeEditor';
import { PortalReprojectionStatus } from '../../../../components/ui/PortalReprojectionStatus';
import { useT } from '../../../../shared/i18n/useT';
import { PORTAL_VIEW_REPEAT_MINUTES } from '../../../../../domain/schema/portal';
import type { PortalFormState, PortalSubjectKind } from './screenPortalForm';
import type { PortalTemplateFormState } from './portalTemplateForm';

export interface ScreenPortalPanelProps {
  form: PortalFormState;
  fieldOptions: Array<{ value: string; label: string }>;
  /** Os campos que o convidado pode preencher — todos, menos o do vínculo, que o servidor carimba. */
  createFieldOptions: Array<{ value: string; label: string }>;
  /** Os tipos de documento do escritório — o convidado só escolhe entre os marcados. */
  documentTypeOptions: Array<{ value: string; label: string }>;
  referenceFieldOptions: Array<{ value: string; label: string }>;
  /** Os campos que o convidado pode alterar — os expostos, menos o do vínculo. */
  editFieldOptions: Array<{ value: string; label: string }>;
  /** As ações do registro que podem rodar no portal, pela chave — rodam uma automação sem perguntar. */
  actionOptions: Array<{ value: string; label: string }>;
  /** Os campos de vínculo expostos — cada um pode levar o nome do registro apontado. */
  referenceTitleOptions: Array<{ value: string; label: string }>;
  hasParent: boolean;
  hasDocuments: boolean;
  /** Declarado por uma extensão: o escritório vê, e quem muda é ela. */
  readOnly: boolean;
  /** Já traduzidos. */
  issues: string[];
  /** A coleção da tela: o andamento da atualização do portal é o dela. */
  collection: string;
  onToggleEnabled: (enabled: boolean) => void;
  onSubjectKind: (kind: PortalSubjectKind) => void;
  onSubjectField: (fieldKey: string) => void;
  onToggleField: (fieldKey: string, exposed: boolean) => void;
  onVisibleWhen: (expression: string) => void;
  onToggleDocuments: (documents: boolean) => void;
  onToggleCreate: (allowCreate: boolean) => void;
  onToggleCreateField: (fieldKey: string, fillable: boolean) => void;
  onCreateWhen: (expression: string) => void;
  onToggleUploads: (allowUploads: boolean) => void;
  onToggleUploadType: (typeKey: string, allowed: boolean) => void;
  onToggleEdit: (allowEdit: boolean) => void;
  onToggleEditField: (fieldKey: string, editable: boolean) => void;
  onEditWhen: (expression: string) => void;
  onToggleEditOnlyOwn: (onlyOwn: boolean) => void;
  onToggleNotifyOffice: (notify: boolean) => void;
  onToggleAutomationInvites: (allowed: boolean) => void;
  onToggleDocumentLinks: (enabled: boolean) => void;
  onDocumentLinkMinutes: (minutes: string) => void;
  onToggleTrackViews: (enabled: boolean) => void;
  onToggleAction: (actionKey: string, offered: boolean) => void;
  onToggleReferenceTitle: (fieldKey: string, named: boolean) => void;
  onTemplateChange: (patch: Partial<PortalTemplateFormState>) => void;
  onTemplateCardCustom: (custom: boolean) => void;
  onTemplateDetailCustom: (custom: boolean) => void;
  onTemplateResetCard: () => void;
  onTemplateResetDetail: () => void;
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

  const layoutOptions = [
    { value: 'list', label: t('card-template.panel.layout.list') },
    { value: 'grid', label: t('card-template.panel.layout.grid') },
  ];
  const widthOptions = [
    { value: 'sm', label: t('card-template.panel.width.sm') },
    { value: 'md', label: t('card-template.panel.width.md') },
    { value: 'lg', label: t('card-template.panel.width.lg') },
  ];

  return (
    <S.Panel>
      <InfoBanner variant="info" message={t('portal.panel.description')} />
      {readOnly && <InfoBanner variant="warning" message={t('portal.panel.managed')} />}
      {props.collection && <PortalReprojectionStatus collection={props.collection} />}

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
            <S.SectionTitle>{t('portal.reference-titles.title')}</S.SectionTitle>
            <S.Hint>{t('portal.reference-titles.hint')}</S.Hint>
            {props.referenceTitleOptions.length === 0 ? (
              <S.Hint>{t('portal.reference-titles.empty')}</S.Hint>
            ) : (
              <S.FieldGrid>
                {props.referenceTitleOptions.map((option) => (
                  <Checkbox
                    key={option.value}
                    checked={form.referenceTitles.includes(option.value)}
                    onChange={(named) => props.onToggleReferenceTitle(option.value, named)}
                    label={option.label}
                    disabled={readOnly}
                  />
                ))}
              </S.FieldGrid>
            )}
          </S.Section>

          <S.Section>
            <S.SectionTitle>{t('portal.visible-when')}</S.SectionTitle>
            <Input
              value={form.visibleWhen}
              onChange={(event) => props.onVisibleWhen(event.target.value)}
              placeholder={t('portal.visible-when.placeholder')}
              disabled={readOnly}
            />
            <S.Hint>{t('portal.visible-when.hint')}</S.Hint>
          </S.Section>

          <S.Section>
            <Checkbox
              checked={form.documents}
              onChange={props.onToggleDocuments}
              label={t('portal.documents')}
              disabled={readOnly || !props.hasDocuments}
            />
            <S.Hint>{props.hasDocuments ? t('portal.documents.hint') : t('portal.documents.unavailable')}</S.Hint>
            <Checkbox
              checked={form.allowUploads && form.documents}
              onChange={props.onToggleUploads}
              label={t('portal.uploads.enabled')}
              disabled={readOnly || !form.documents}
            />
            <S.Hint>{form.documents ? t('portal.uploads.hint') : t('portal.uploads.requires-documents')}</S.Hint>
            {form.allowUploads && form.documents && (
              <>
                <S.Hint>{t('portal.uploads.types-hint')}</S.Hint>
                <S.FieldGrid>
                  {props.documentTypeOptions.map((option) => (
                    <Checkbox
                      key={option.value}
                      checked={form.uploadTypes.includes(option.value)}
                      onChange={(allowed) => props.onToggleUploadType(option.value, allowed)}
                      label={option.label}
                      disabled={readOnly}
                    />
                  ))}
                </S.FieldGrid>
              </>
            )}
            <Checkbox
              checked={form.documentLinks}
              onChange={props.onToggleDocumentLinks}
              label={t('portal.document-links')}
              disabled={readOnly}
            />
            <S.Hint>{t('portal.document-links.hint')}</S.Hint>
            {form.documentLinks && (
              <>
                <S.SectionTitle>{t('portal.document-links.minutes')}</S.SectionTitle>
                <Input
                  type="number"
                  value={form.documentLinkMinutes}
                  onChange={(event) => props.onDocumentLinkMinutes(event.target.value)}
                  disabled={readOnly}
                />
              </>
            )}
          </S.Section>

          <S.Section>
            <Checkbox
              checked={form.trackViews}
              onChange={props.onToggleTrackViews}
              label={t('portal.track-views')}
              disabled={readOnly}
            />
            <S.Hint>{t('portal.track-views.hint', { minutes: PORTAL_VIEW_REPEAT_MINUTES })}</S.Hint>
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
              <>
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
                <S.SectionTitle>{t('portal.create.when')}</S.SectionTitle>
                <Input
                  value={form.createWhen}
                  onChange={(event) => props.onCreateWhen(event.target.value)}
                  placeholder={t('portal.create.when.placeholder')}
                  disabled={readOnly}
                />
                <S.Hint>{t('portal.create.when.hint')}</S.Hint>
              </>
            )}
          </S.Section>

          <S.Section>
            <Checkbox
              checked={form.allowEdit}
              onChange={props.onToggleEdit}
              label={t('portal.edit.enabled')}
              disabled={readOnly}
            />
            <S.Hint>{t('portal.edit.hint')}</S.Hint>
            {form.allowEdit && (
              <>
                {props.editFieldOptions.length === 0 ? (
                  <S.Hint>{t('portal.edit.no-exposed')}</S.Hint>
                ) : (
                  <S.FieldGrid>
                    {props.editFieldOptions.map((option) => (
                      <Checkbox
                        key={option.value}
                        checked={form.editFields.includes(option.value)}
                        onChange={(editable) => props.onToggleEditField(option.value, editable)}
                        label={option.label}
                        disabled={readOnly}
                      />
                    ))}
                  </S.FieldGrid>
                )}
                <S.SectionTitle>{t('portal.edit.when')}</S.SectionTitle>
                <Input
                  value={form.editWhen}
                  onChange={(event) => props.onEditWhen(event.target.value)}
                  placeholder={t('portal.edit.when.placeholder')}
                  disabled={readOnly}
                />
                <S.Hint>{t('portal.edit.when.hint')}</S.Hint>
                {form.subjectKind !== 'self' && (
                  <Checkbox
                    checked={form.editOnlyOwn}
                    onChange={props.onToggleEditOnlyOwn}
                    label={t('portal.edit.only-own')}
                    disabled={readOnly}
                  />
                )}
              </>
            )}
          </S.Section>

          <S.Section>
            <S.SectionTitle>{t('portal.actions.title')}</S.SectionTitle>
            <S.Hint>{t('portal.actions.hint')}</S.Hint>
            {props.actionOptions.length === 0 ? (
              <S.Hint>{t('portal.actions.empty')}</S.Hint>
            ) : (
              <S.FieldGrid>
                {props.actionOptions.map((option) => (
                  <Checkbox
                    key={option.value}
                    checked={form.actions.includes(option.value)}
                    onChange={(offered) => props.onToggleAction(option.value, offered)}
                    label={option.label}
                    disabled={readOnly}
                  />
                ))}
              </S.FieldGrid>
            )}
          </S.Section>

          <S.Section>
            <Checkbox
              checked={form.notifyOffice}
              onChange={props.onToggleNotifyOffice}
              label={t('portal.notify.enabled')}
              disabled={readOnly}
            />
            <S.Hint>{t('portal.notify.hint')}</S.Hint>
          </S.Section>

          <S.Section>
            <Checkbox
              checked={form.automationInvites && form.subjectKind === 'self'}
              onChange={props.onToggleAutomationInvites}
              label={t('portal.invites.automation')}
              disabled={readOnly || form.subjectKind !== 'self'}
            />
            <S.Hint>
              {form.subjectKind === 'self' ? t('portal.invites.automation.hint') : t('portal.invites.automation.self-only')}
            </S.Hint>
          </S.Section>

          <S.Section>
            <S.SectionTitle>{t('portal-template.title')}</S.SectionTitle>
            <S.Hint>{t('portal-template.hint')}</S.Hint>

            <S.SectionTitle>{t('portal-template.card.layout')}</S.SectionTitle>
            <RadioGroup
              name="portal-card-layout"
              value={form.template.cardLayout}
              onChange={(value) => props.onTemplateChange({ cardLayout: value as PortalTemplateFormState['cardLayout'] })}
              options={layoutOptions}
              direction="horizontal"
            />
            {form.template.cardLayout === 'grid' && (
              <RadioGroup
                name="portal-card-width"
                value={form.template.cardMinWidth}
                onChange={(value) => props.onTemplateChange({ cardMinWidth: value as PortalTemplateFormState['cardMinWidth'] })}
                options={widthOptions}
                direction="horizontal"
              />
            )}

            <Checkbox
              checked={form.template.cardCustom}
              onChange={props.onTemplateCardCustom}
              label={t('portal-template.card.custom')}
              disabled={readOnly}
            />
            {form.template.cardCustom && (
              <>
                <S.EditorHeader>
                  <S.Hint>{t('portal-template.card.custom.hint')}</S.Hint>
                  {!readOnly && (
                    <Button variant="secondary" size="sm" onClick={props.onTemplateResetCard}>
                      {t('portal-template.reset')}
                    </Button>
                  )}
                </S.EditorHeader>
                <CodeEditor
                  language="json"
                  value={form.template.cardSource}
                  onChange={(cardSource) => props.onTemplateChange({ cardSource })}
                  minHeight="220px"
                />
              </>
            )}

            <Checkbox
              checked={form.template.detailCustom}
              onChange={props.onTemplateDetailCustom}
              label={t('portal-template.detail.custom')}
              disabled={readOnly}
            />
            {form.template.detailCustom && (
              <>
                <S.EditorHeader>
                  <S.Hint>{t('portal-template.detail.custom.hint')}</S.Hint>
                  {!readOnly && (
                    <Button variant="secondary" size="sm" onClick={props.onTemplateResetDetail}>
                      {t('portal-template.reset')}
                    </Button>
                  )}
                </S.EditorHeader>
                <CodeEditor
                  language="json"
                  value={form.template.detailSource}
                  onChange={(detailSource) => props.onTemplateChange({ detailSource })}
                  minHeight="320px"
                />
              </>
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
