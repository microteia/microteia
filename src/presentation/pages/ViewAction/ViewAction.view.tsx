import React from 'react';
import { RiCursorLine, RiSave3Line, RiDeleteBinLine } from 'react-icons/ri';
import { S } from './ViewAction.styles';
import { useViewActionViewModel } from './ViewAction.viewmodel';
import { Input, Label } from '../../components/ui/Input';
import { LabelInput } from '../../components/ui/LabelInput';
import { Checkbox } from '../../components/ui/Checkbox';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { ExpressionEditor } from '../../components/ui/ExpressionEditor';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';

import { useT } from '../../shared/i18n/useT';

export const ViewActionView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewActionViewModel(tabKey);
  const t = useT('core.automation');

  if (!vm.isAdmin) {
    return (
      <S.Page>
        <S.Header>
          <S.HeaderTitle><RiCursorLine size={20} />{t('page.view-action')}</S.HeaderTitle>
        </S.Header>
        <S.Content>
          <InfoBanner variant="info" message={t('action.admin-only')} />
        </S.Content>
      </S.Page>
    );
  }

  if (vm.notFound) {
    return (
      <S.Page>
        <S.Header>
          <S.HeaderTitle><RiCursorLine size={20} />{t('page.view-action')}</S.HeaderTitle>
        </S.Header>
        <S.Content>
          <InfoBanner message={t('action.not-found')} />
        </S.Content>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.HeaderTitle>
          <RiCursorLine size={20} />
          {vm.isNew ? t('page.new-action') : (vm.displayTitle || t('page.view-action'))}
        </S.HeaderTitle>
        <S.HeaderActions>
          <S.SaveBtn
            onClick={() => void vm.handleSave()}
            disabled={!vm.canSave}
            title={t(vm.isSaving ? 'core.ui/saving' : 'core.ui/action.save')}
          >
            <RiSave3Line size={14} />
          </S.SaveBtn>
          {!vm.isNew && (
            <S.DeleteBtn onClick={vm.handleDelete} title={t('action.delete')}>
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        <S.Section>
          <S.SectionTitle>{t('core.records/screen.tab.general')}</S.SectionTitle>
          <S.SectionBody>
            <S.Field>
              <Label>{t('core.marketplace/author.field.id')}</Label>
              <Input
                value={vm.isNew ? vm.formData.actionId : vm.actionId}
                onChange={(e) => vm.setFormData({ actionId: e.target.value })}
                placeholder={vm.suggestedActionId || t('action.id.placeholder')}
                disabled={!vm.isNew}
              />
              <S.SectionHint>
                {t(vm.isNew ? 'action.id.hint' : 'action.id.locked')}
              </S.SectionHint>
              {vm.actionIdError && <S.FieldError>{vm.actionIdError}</S.FieldError>}
            </S.Field>
            <S.Field>
              <Label>{t('action.key')}</Label>
              <Input
                value={vm.formData.key}
                onChange={(e) => vm.setFormData({ key: e.target.value })}
                placeholder={t('action.key.placeholder')}
              />
              <S.SectionHint>{t('action.key.hint')}</S.SectionHint>
            </S.Field>
            <S.Field>
              <Label>{t('action.title')}</Label>
              <LabelInput
                value={vm.formData.title}
                onChange={(title) => vm.setFormData({ title })}
                placeholder={t('action.title.placeholder')}
              />
            </S.Field>
            <S.Field>
              <Label>{t('core.records/screen.icon')}</Label>
              <SearchSelect
                options={vm.iconOptions}
                value={vm.formData.icon}
                onChange={(icon) => vm.setFormData({ icon })}
                placeholder={t('core.records/screen.icon.placeholder')}
              />
            </S.Field>
            <S.Field>
              <Label>{t('action.command')}</Label>
              <SearchSelect
                options={vm.commandOptions}
                value={vm.formData.command}
                onChange={(command) => vm.setFormData({ command })}
                placeholder={t('action.command.placeholder')}
              />
              <S.SectionHint>{t('action.command.hint')}</S.SectionHint>
            </S.Field>
            {!vm.formData.command && (
            <S.Field>
              <Label>{t('action.workflow')}</Label>
              <SearchSelect
                options={vm.workflowOptions}
                value={vm.formData.workflowId}
                onChange={(workflowId) => vm.setFormData({ workflowId })}
                placeholder={t('action.workflow.placeholder')}
              />
              <S.SectionHint>{t('action.workflow.hint')}</S.SectionHint>
            </S.Field>
            )}
            <S.Field>
              <Checkbox
                label={t('action.enabled')}
                checked={vm.formData.enabled}
                onChange={() => vm.setFormData({ enabled: !vm.formData.enabled })}
              />
              <Checkbox
                label={t('action.danger')}
                checked={vm.formData.danger}
                onChange={() => vm.setFormData({ danger: !vm.formData.danger })}
              />
            </S.Field>
          </S.SectionBody>
        </S.Section>

        {!vm.formData.command && (
          <S.Section>
            <S.SectionTitle>{t('action.prompt.section')}</S.SectionTitle>
            <S.SectionBody>
              <S.Field>
                <Checkbox
                  label={t('action.prompt.label')}
                  checked={vm.formData.promptParameters}
                  onChange={() => vm.setFormData({ promptParameters: !vm.formData.promptParameters })}
                />
                <S.SectionHint>{t('action.prompt.hint')}</S.SectionHint>
              </S.Field>
              {vm.formData.promptParameters && (
                vm.promptableParameters.length === 0 ? (
                  <InfoBanner message={t('action.prompt.nothing')} />
                ) : (
                  <>
                    <S.SectionHint>{t('action.prompt.defaults.hint')}</S.SectionHint>
                    {vm.promptableParameters.map((param) => (
                      <S.Field key={param.key}>
                        <Label>
                          {param.label}
                          {param.required && ' *'}
                        </Label>
                        <ExpressionEditor
                          value={vm.formData.parameterDefaults[param.key] ?? ''}
                          onChange={(expression) => vm.setParameterDefault(param.key, expression)}
                          placeholder={`ex: ${param.key}`}
                          workflowVariables={vm.expressionVariables}
                        />
                      </S.Field>
                    ))}
                  </>
                )
              )}
            </S.SectionBody>
          </S.Section>
        )}

        <S.Section>
          <S.SectionTitle>{t('core.records/field.expression-behaviour')}</S.SectionTitle>
          <S.SectionBody>
            <S.SectionHint>{t('action.expression.hint')}</S.SectionHint>
            <S.Field>
              <Label>{t('action.hidden-when')}</Label>
              <ExpressionEditor
                value={vm.formData.hiddenWhen}
                onChange={(hiddenWhen) => vm.setFormData({ hiddenWhen })}
                placeholder={t('action.hidden-when.placeholder')}
                workflowVariables={vm.expressionVariables}
              />
            </S.Field>
            <S.Field>
              <Label>{t('action.disabled-when')}</Label>
              <ExpressionEditor
                value={vm.formData.disabledWhen}
                onChange={(disabledWhen) => vm.setFormData({ disabledWhen })}
                placeholder={t('action.disabled-when.placeholder')}
                workflowVariables={vm.expressionVariables}
              />
            </S.Field>
            <S.Field>
              <Label>{t('action.active-when')}</Label>
              <S.SectionHint>{t('action.active-when.hint')}</S.SectionHint>
              <ExpressionEditor
                value={vm.formData.activeWhen}
                onChange={(activeWhen) => vm.setFormData({ activeWhen })}
                placeholder={t('action.active-when.placeholder')}
                workflowVariables={vm.expressionVariables}
              />
            </S.Field>
          </S.SectionBody>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('action.confirm.section')}</S.SectionTitle>
          <S.SectionBody>
            <S.Field>
              <Label>{t('action.confirm.label')}</Label>
              <LabelInput
                multiline
                value={vm.formData.confirmMessage}
                onChange={(confirmMessage) => vm.setFormData({ confirmMessage })}
                placeholder={t('action.confirm.placeholder')}
                rows={2}
              />
            </S.Field>
          </S.SectionBody>
        </S.Section>
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.actionToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title={t('action.delete')}
        message={t('action.delete.message', { title: vm.actionToDelete?.title ?? '' })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
      />
    </S.Page>
  );
};
