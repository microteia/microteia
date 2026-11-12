import React, { Suspense, lazy } from 'react';
import { RiCodeBoxLine, RiSave3Line, RiDeleteBinLine, RiArrowRightSLine, RiDatabase2Line, RiPlayLine } from 'react-icons/ri';
import { S } from './ViewScript.styles';
import { useViewScriptViewModel } from './ViewScript.viewmodel';
import { Input, Label } from '../../components/ui/Input';
import { LabelInput } from '../../components/ui/LabelInput';
import { PrefixedNameInput } from '../../components/ui/PrefixedNameInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { RunModal } from '../../components/ui/RunModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { AdvancedParametersEditor } from '../ViewWorkflow/components/AdvancedParametersEditor';
import type { AdvancedParametersEditorProps } from '../ViewWorkflow/components/AdvancedParametersEditor/AdvancedParametersEditor.viewmodel';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';
import { useT } from '../../shared/i18n/useT';

const CodeEditor = lazy(() =>
  import('../../components/ui/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

export const ViewScriptView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const t = useT('core.automation');
  const vm = useViewScriptViewModel(tabKey);

  return (
    <S.Page>
      <S.Header>
        <S.HeaderTitle>
          <RiCodeBoxLine size={20} />
          {vm.isNew ? t('script.new') : vm.displayName || t('script.fallback-name')}
        </S.HeaderTitle>
        <S.HeaderActions>
          <S.RunBtn onClick={vm.openRunModal} title={t('script.run')}>
            <RiPlayLine size={14} />
          </S.RunBtn>
          <S.SaveBtn
            onClick={() => void vm.handleSave()}
            disabled={!vm.canSave}
            title={vm.isSaving ? t('core.ui/action.saving') : t('core.ui/action.save')}
          >
            <RiSave3Line size={14} />
          </S.SaveBtn>
          {!vm.isNew && (
            <S.DeleteBtn onClick={vm.handleDelete} title={t('script.delete')}>
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('general')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('general')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>{t('core.records/screen.tab.general')}</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('general') && (
            <S.SectionBody>
              <S.Field>
                <Label>{t('core.ui/field.name')}</Label>
                <LabelInput
                  value={vm.formData.name}
                  onChange={(name) => vm.setFormData({ name })}
                  placeholder={t('script.name.placeholder')}
                />
              </S.Field>
              <S.Field>
                <Label>{t('core.ui/field.identifier')}</Label>
                {vm.isNew ? (
                  <PrefixedNameInput
                    prefix={vm.artifactPrefix}
                    kind="artifact"
                    value={vm.formData.scriptId}
                    onChange={(scriptId) => vm.setFormData({ scriptId })}
                    placeholder={vm.suggestedScriptId || t('script.id.placeholder')}
                    hasError={!!vm.scriptIdError}
                  />
                ) : (
                  <Input value={vm.formData.scriptId} disabled />
                )}
                <S.SectionHint>
                  {vm.isNew ? t('script.id.hint') : t('script.id.locked')}
                </S.SectionHint>
                {vm.scriptIdError && <S.FieldError>{vm.scriptIdError}</S.FieldError>}
              </S.Field>
              <S.Field>
                <Label>{t('core.ui/field.description')}</Label>
                <LabelInput
                  multiline
                  value={vm.formData.description}
                  onChange={(description) => vm.setFormData({ description })}
                  placeholder={t('script.description.placeholder')}
                  rows={2}
                />
              </S.Field>
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('inputs')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('inputs')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>{t('script.inputs')}</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('inputs') && (
            <S.SectionBody>
              <S.SectionHint>
                {t('script.inputs.hint')}
              </S.SectionHint>
              <AdvancedParametersEditor
                parameters={vm.formData.inputParams}
                errors={vm.inputParamErrors}
                typeOptions={vm.typeOptions}
                entityOptions={vm.entityOptions}
                lookupOptions={vm.lookupOptions}
                onAdd={vm.addInputParam}
                onUpdate={vm.updateInputParam}
                onRemove={vm.removeInputParam}
                onClone={vm.cloneInputParam}
                onReplace={vm.replaceInputParams}
              />
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('code')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('code')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>{t('script.code')}</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('code') && (
            <S.SectionBody>
              <InfoBanner
                variant="info"
                message={t('script.code.notice')}
              />
              <S.DocLink type="button" onClick={vm.openDataFunctionReference}>
                <RiDatabase2Line size={14} /> {t('script.data-functions.link')}
              </S.DocLink>
              <Suspense fallback={<S.EditorLoading>{t('core.ui/code-editor.loading')}</S.EditorLoading>}>
                <CodeEditor
                  value={vm.formData.sourceTs}
                  onChange={(sourceTs) => vm.setFormData({ sourceTs })}
                  extraLib={vm.scriptTypeDefs}
                />
              </Suspense>
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('queryDoc')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('queryDoc')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>{t('script.query-doc')}</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('queryDoc') && (
            <S.SectionBody>
              <S.Doc>
                <S.DocLead>{t('script.query-doc.lead')}</S.DocLead>

                <S.Signature>{t('script.query-doc.signature')}</S.Signature>

                <S.DocGroup>
                  <S.DocGroupTitle>{t('script.query-doc.settings')}</S.DocGroupTitle>
                  <S.ParamList>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>table</S.ParamName>
                        <S.Pill $required>{t('core.ui/field.required')}</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>{t('script.query-doc.table')}</S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>where</S.ParamName>
                        <S.Pill>{t('core.ui/field.optional')}</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>{t('script.query-doc.where')}</S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>orderBy</S.ParamName>
                        <S.Pill>{t('core.ui/field.optional')}</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>{t('script.query-doc.order-by')}</S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>limit</S.ParamName>
                        <S.Pill>{t('core.ui/field.optional')}</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>{t('script.query-doc.limit')}</S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>projections</S.ParamName>
                        <S.Pill>{t('core.ui/field.optional')}</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>{t('script.query-doc.projections')}</S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>page</S.ParamName>
                        <S.Pill>{t('core.ui/field.optional')}</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>{t('script.query-doc.page')}</S.ParamDesc>
                    </S.ParamRow>
                  </S.ParamList>
                </S.DocGroup>

                <S.DocGroup>
                  <S.DocGroupTitle>{t('script.query-doc.operators')}</S.DocGroupTitle>
                  <S.OpGrid>
                    <S.OpChip><S.OpName>eq</S.OpName><S.OpLabel>{t('script.query-doc.op.eq')}</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>neq</S.OpName><S.OpLabel>{t('script.query-doc.op.neq')}</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>lt</S.OpName><S.OpLabel>{t('script.query-doc.op.lt')}</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>lte</S.OpName><S.OpLabel>{t('script.query-doc.op.lte')}</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>gt</S.OpName><S.OpLabel>{t('script.query-doc.op.gt')}</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>gte</S.OpName><S.OpLabel>{t('script.query-doc.op.gte')}</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>in</S.OpName><S.OpLabel>{t('script.query-doc.op.in')}</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>contains</S.OpName><S.OpLabel>{t('script.query-doc.op.contains')}</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>exists</S.OpName><S.OpLabel>{t('script.query-doc.op.exists')}</S.OpLabel></S.OpChip>
                  </S.OpGrid>
                  <S.DocLead>{t('script.query-doc.op.note')}</S.DocLead>
                </S.DocGroup>

                <S.DocGroup>
                  <S.DocGroupTitle>{t('script.query-doc.examples')}</S.DocGroupTitle>
                  <S.Examples>
                    <S.Example>
                      <S.ExampleTitle>{t('script.query-doc.example.recent')}</S.ExampleTitle>
                      <S.Pre>{`const r = await query({
  table: 'products',
  where: [{ path: 'status', op: 'eq', value: 'active' }],
  orderBy: [{ path: 'createdAt', dir: 'desc' }],
  limit: 10,
});
log(r.count);`}</S.Pre>
                    </S.Example>
                    <S.Example>
                      <S.ExampleTitle>{t('script.query-doc.example.count')}</S.ExampleTitle>
                      <S.Pre>{`const r = await query({
  table: 'products',
  where: [{ path: 'price', op: 'gte', value: 10000 }],
});
return { highValueTotal: r.count };`}</S.Pre>
                    </S.Example>
                    <S.Example>
                      <S.ExampleTitle>{t('script.query-doc.example.city')}</S.ExampleTitle>
                      <S.Pre>{`const r = await query({
  table: 'suppliers',
  where: [
    { path: 'address.city', op: 'eq', value: 'Lisbon' },
    { path: 'email', op: 'exists' },
  ],
  projections: ['name', 'email'],
});
const names = r.results.map((item) => item.name);`}</S.Pre>
                    </S.Example>
                  </S.Examples>
                </S.DocGroup>

                <S.DocGroup>
                  <S.DocGroupTitle>{t('script.query-doc.limits')}</S.DocGroupTitle>
                  <S.NoteList>
                    <S.Note>{t('script.query-doc.limit.await')}</S.Note>
                    <S.Note>{t('script.query-doc.limit.count')}</S.Note>
                    <S.Note>{t('script.query-doc.limit.scan')}</S.Note>
                    <S.Note>{t('script.query-doc.limit.has-more')}</S.Note>
                  </S.NoteList>
                </S.DocGroup>
              </S.Doc>
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('outputs')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('outputs')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>{t('script.outputs')}</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('outputs') && (
            <S.SectionBody>
              <S.SectionHint>
                {t('script.outputs.hint')}
              </S.SectionHint>
              <AdvancedParametersEditor
                variant="output"
                parameters={vm.formData.outputParams as unknown as WorkflowParameter[]}
                errors={vm.outputParamErrors}
                typeOptions={vm.typeOptions}
                entityOptions={vm.entityOptions}
                lookupOptions={vm.lookupOptions}
                onAdd={vm.addOutputParam}
                onUpdate={vm.updateOutputParam as unknown as AdvancedParametersEditorProps['onUpdate']}
                onRemove={vm.removeOutputParam}
                onClone={vm.cloneOutputParam}
                onReplace={vm.replaceOutputParams as unknown as AdvancedParametersEditorProps['onReplace']}
              />
            </S.SectionBody>
          )}
        </S.Section>

        {!vm.isNew && (
          <S.Section>
            <S.SectionHeader type="button" onClick={() => vm.toggleSection('versions')}>
              <S.SectionChevron $open={!vm.isSectionCollapsed('versions')}><RiArrowRightSLine size={18} /></S.SectionChevron>
              <S.SectionTitle>{t('tab.versions')}</S.SectionTitle>
            </S.SectionHeader>
            {!vm.isSectionCollapsed('versions') && (
              <S.SectionBody>
                {vm.versionsError && (
                  <InfoBanner variant="warning" message={t('versions.load-failed', { detail: vm.versionsError })} />
                )}
                {vm.versions.length === 0 ? (
                  <S.SectionHint>{t('versions.empty-script')}</S.SectionHint>
                ) : (
                  vm.versions.map((version) => (
                    <S.VersionRow key={version.version}>
                      <div>
                        <S.VersionTitle>
                          {version.title}
                          {version.isCurrent && <S.VersionCurrent>{t('versions.current')}</S.VersionCurrent>}
                        </S.VersionTitle>
                        <S.SectionHint>{version.origin}</S.SectionHint>
                      </div>
                      {!version.isCurrent && (
                        <S.AddBtn
                          type="button"
                          disabled={vm.restoringVersion !== null}
                          onClick={() => vm.restoreVersion(version.version)}
                        >
                          {t('versions.restore')}
                        </S.AddBtn>
                      )}
                    </S.VersionRow>
                  ))
                )}
              </S.SectionBody>
            )}
          </S.Section>
        )}
      </S.Content>

      {vm.runModalOpen && (
        <RunModal
          title={t('script.run.title', { name: vm.formData.name || t('script.fallback-name') })}
          parameters={vm.formData.inputParams}
          runLabel={t('script.run.label')}
          onClose={vm.closeRunModal}
          onRun={vm.runScriptForModal}
        />
      )}

      <ConfirmModal
        isOpen={!!vm.scriptToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title={t('script.delete.title')}
        message={t('script.delete.message', { name: vm.scriptToDelete?.name ?? '' })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
      />
    </S.Page>
  );
};
