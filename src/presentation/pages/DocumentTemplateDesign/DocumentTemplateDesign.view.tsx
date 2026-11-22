import React from 'react';
import {
  RiAddLine,
  RiArrowGoBackLine,
  RiArrowRightUpLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiFileSearchLine,
  RiFileWordLine,
  RiMagicLine,
  RiMarkdownLine,
  RiRefreshLine,
  RiSave3Line,
  RiUploadLine,
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { Input, Label } from '../../components/ui/Input';
import { PrefixedNameInput } from '../../components/ui/PrefixedNameInput';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ExtensionBadge } from '../../components/ui/ExtensionBadge';
import { useT } from '../../shared/i18n/useT';
import { AdvancedParametersEditor } from '../ViewWorkflow/components/AdvancedParametersEditor';
import { TemplatePreview } from './components/TemplatePreview';
import { useDocumentTemplateDesignViewModel } from './DocumentTemplateDesign.viewmodel';
import type { TemplateIssueLine } from './DocumentTemplateDesign.viewmodel';
import { S } from './DocumentTemplateDesign.styles';

const Issues: React.FC<{ lines: TemplateIssueLine[] }> = ({ lines }) => (
  <>
    {lines.map((one) => <S.Issue key={`${one.field}:${one.message}`} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
  </>
);

/**
 * A autoria de um modelo de documento, numa aba própria — irmã da autoria de relatório.
 *
 * As configurações em ABAS por assunto, e o conteúdo numa aba própria: o editor e — ao lado dele — a
 * prévia, com a altura inteira. Documento é vertical como a folha: o resultado fica AO LADO do texto
 * que o produz, e não embaixo, como a tabela larga do relatório.
 */
export const DocumentTemplateDesignView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useDocumentTemplateDesignViewModel(tabKey);
  const t = useT('core.documents');
  const { form } = vm;

  if (!vm.canManage) {
    return (
      <S.Page>
        <S.Notices>
          <InfoBanner variant="info" message={t('page.no-permission')} />
        </S.Notices>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.HeaderMain>
          <S.FormatIcon $format={form.format}>
            {form.format === 'docx' ? <RiFileWordLine size={18} /> : <RiMarkdownLine size={18} />}
          </S.FormatIcon>
          <S.HeaderText>
            <S.HeaderName>{vm.heading}</S.HeaderName>
            <S.HeaderMeta>
              {form.key && <S.MetaKey>{form.key}</S.MetaKey>}
              {vm.screenLabel && <><S.MetaSeparator /><span>{vm.screenLabel}</span></>}
              <S.MetaSeparator />
              <span>{t(`format.${form.format}`)}</span>
            </S.HeaderMeta>
          </S.HeaderText>
          {(vm.state === 'override' || vm.state === 'disabled') && !vm.isNew && (
            <S.Pill $tone={vm.state === 'disabled' ? 'warning' : 'primary'}>{t(`state.${vm.state}`)}</S.Pill>
          )}
          {vm.outdated && <S.Pill $tone="warning"><S.Dot />{t('state.outdated')}</S.Pill>}
          <ExtensionBadge owner={vm.extension} />
        </S.HeaderMain>

        {/* As ações no CABEÇALHO, à direita, no desenho da autoria de relatório; a do estado vai rotulada. */}
        <S.HeaderActions>
          {!vm.isNew && !vm.notFound && (
            <S.IconBtn onClick={vm.clone} title={t('template.clone')}>
              <RiFileCopyLine size={14} />
            </S.IconBtn>
          )}
          {vm.state === 'plugin' && (
            <S.IconBtn onClick={() => void vm.toggleDisabled()} title={t('template.disable')}>
              <RiEyeOffLine size={14} />
            </S.IconBtn>
          )}
          {vm.state === 'override' && (
            <S.IconBtn onClick={vm.askRemove} title={t('template.restore.short')}>
              <RiArrowGoBackLine size={14} />
            </S.IconBtn>
          )}
          {vm.state === 'tenant' && !vm.isNew && (
            <S.DeleteBtn onClick={vm.askRemove} title={t('template.delete')}>
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
          {vm.state === 'plugin' && (
            <Button variant="primary" size="sm" onClick={() => void vm.customize()}>
              <RiEdit2Line size={14} /> {t('template.customize')}
            </Button>
          )}
          {vm.state === 'disabled' && (
            <Button variant="primary" size="sm" onClick={() => void vm.toggleDisabled()}>
              <RiEyeLine size={14} /> {t('template.enable')}
            </Button>
          )}
          {vm.isEditable && (
            <S.SaveBtn
              onClick={() => void vm.save()}
              disabled={!vm.canSave}
              title={t(vm.isSaving ? 'core.ui/saving' : 'core.ui/action.save')}
            >
              <RiSave3Line size={14} />
            </S.SaveBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      {/* Os avisos valem para o modelo inteiro: ficam FORA das abas, e um só por estado. */}
      <S.Notices>
        {vm.notFound && <InfoBanner message={t('template.not-found')} />}
        {vm.clonedFrom && <InfoBanner variant="info" message={t('template.clone.hint', { title: vm.clonedFrom })} />}
        {!vm.isNew && vm.state === 'plugin' && <InfoBanner variant="info" message={t('state.plugin.hint')} />}
        {!vm.isNew && vm.state === 'override' && !vm.outdated && <InfoBanner variant="info" message={t('state.override.hint')} />}
        {!vm.isNew && vm.state === 'disabled' && <InfoBanner message={t('state.disabled.hint')} />}
        {vm.outdated && (
          <S.Notice>
            <InfoBanner message={t('state.outdated.hint')} />
            <S.NoticeActions>
              <Button variant="secondary" size="sm" onClick={vm.askRemove}>
                <RiArrowGoBackLine size={14} /> {t('template.restore')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void vm.keepCopy()}>
                <RiCheckLine size={14} /> {t('template.outdated.keep')}
              </Button>
            </S.NoticeActions>
          </S.Notice>
        )}
      </S.Notices>

      <S.TabBar role="tablist">
        {vm.tabs.map((tab) => (
          <S.TabBtn
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === vm.activeTab}
            aria-controls="document-template-panel"
            $active={tab.key === vm.activeTab}
            onClick={() => vm.setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.count > 0 && <S.TabCount $active={tab.key === vm.activeTab}>{tab.count}</S.TabCount>}
            {tab.issueCount > 0 && (
              <S.TabIssues
                $blocking={tab.hasBlockingIssue}
                title={t('tab.issues', { count: String(tab.issueCount) })}
              >
                {tab.issueCount}
              </S.TabIssues>
            )}
          </S.TabBtn>
        ))}
      </S.TabBar>

      {vm.activeTab !== 'content' && (
        <S.Settings id="document-template-panel" role="tabpanel">
          {vm.activeTab === 'general' && (
            <S.Sections>
              <S.Section>
                <S.Legend>{t('section.identity')}</S.Legend>
                <S.Field>
                  <Label>{t('field.title')}</Label>
                  <Input value={vm.titleText} disabled={vm.isReadOnly} onChange={(e) => vm.setForm({ title: e.target.value })} />
                  <Issues lines={vm.issuesFor('title')} />
                </S.Field>
                <S.Field>
                  <Label>{t('field.key')}</Label>
                  {vm.isNew ? (
                    <PrefixedNameInput
                      prefix={vm.artifactPrefix}
                      kind="artifact"
                      value={vm.keyRest}
                      onChange={vm.setKeyRest}
                      hasError={vm.issuesFor('key').length > 0}
                    />
                  ) : (
                    <Input value={form.key} disabled />
                  )}
                  <S.Hint>{t(vm.isNew ? 'field.key.hint' : 'field.key.locked')}</S.Hint>
                  <Issues lines={vm.issuesFor('key')} />
                </S.Field>
              </S.Section>

              <S.Section>
                <S.Legend>{t('section.source')}</S.Legend>
                <S.Field>
                  <Label>{t('field.source')}</Label>
                  <SearchSelect
                    options={vm.sourceOptions}
                    value={vm.isPayload ? 'payload' : 'record'}
                    disabled={vm.isReadOnly}
                    onChange={vm.setSource}
                  />
                  <S.Hint>{t(vm.isPayload ? 'field.source.payload.hint' : 'field.source.record.hint')}</S.Hint>
                  <Issues lines={vm.issuesFor('source')} />
                </S.Field>
                {!vm.isPayload && (
                  <S.Field>
                    <Label>{t('field.collection')}</Label>
                    <SearchSelect
                      options={vm.screenOptions}
                      value={form.collection}
                      disabled={vm.isReadOnly}
                      onChange={(collection) => vm.setForm({ collection })}
                    />
                    <S.Hint>{t('field.collection.hint')}</S.Hint>
                    <Issues lines={vm.issuesFor('collection')} />
                  </S.Field>
                )}
                <S.Field>
                  <Label>{t('field.format')}</Label>
                  <SearchSelect
                    options={vm.formatOptions}
                    value={form.format}
                    disabled={vm.isReadOnly}
                    onChange={(format) => vm.setForm({ format: format === 'docx' ? 'docx' : 'markdown' })}
                  />
                  <Issues lines={vm.issuesFor('format')} />
                </S.Field>
              </S.Section>
            </S.Sections>
          )}

          {vm.activeTab === 'output' && (
            <S.Sections>
              <S.Section>
                <S.Legend>{t('section.file')}</S.Legend>
                <S.Field>
                  <Label>{t('field.file-name')}</Label>
                  <Input
                    value={form.fileName ?? ''}
                    disabled={vm.isReadOnly}
                    placeholder={t('field.file-name.placeholder')}
                    onChange={(e) => vm.setForm({ fileName: e.target.value })}
                  />
                  <Issues lines={vm.issuesFor('fileName')} />
                </S.Field>
                <S.Field>
                  <Label>{t('field.document-type')}</Label>
                  <SearchSelect
                    options={vm.documentTypeOptions}
                    value={form.documentType ?? ''}
                    disabled={vm.isReadOnly}
                    onChange={(documentType) => vm.setForm({ documentType })}
                  />
                </S.Field>
              </S.Section>

              <S.Section>
                <S.Legend>{t('section.destination')}</S.Legend>
                <S.Field>
                  <Label>{t('field.destination')}</Label>
                  <SearchSelect
                    options={vm.destinationOptions}
                    value={form.destination ?? (vm.isPayload ? 'downloads' : 'record')}
                    disabled={vm.isReadOnly}
                    onChange={(destination) => vm.setForm({ destination: destination === 'downloads' ? 'downloads' : 'record' })}
                  />
                  <S.Hint>{t('field.destination.hint')}</S.Hint>
                  <Issues lines={vm.issuesFor('destination')} />
                </S.Field>
                {(form.destination === 'downloads' || vm.isPayload) && (
                  <S.Field>
                    <Label>{t('field.retention')}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={vm.retentionText}
                      disabled={vm.isReadOnly}
                      placeholder={t('field.retention.placeholder')}
                      onChange={(e) => vm.setRetentionText(e.target.value)}
                    />
                    <S.Hint>{t('field.retention.hint')}</S.Hint>
                    <Issues lines={vm.issuesFor('retentionDays')} />
                  </S.Field>
                )}
              </S.Section>
            </S.Sections>
          )}

          {vm.activeTab === 'data' && vm.isPayload && (
            <S.Sections>
              <S.Section>
                <S.Legend>{t('section.payload')}</S.Legend>
                <S.Hint>{t('section.payload.hint')}</S.Hint>
                <AdvancedParametersEditor
                  parameters={vm.payload.parameters}
                  errors={vm.payload.parameterErrors}
                  typeOptions={vm.payload.typeOptions}
                  entityOptions={vm.payload.entityOptions}
                  lookupOptions={vm.payload.lookupOptions}
                  onAdd={vm.payload.addParameter}
                  onUpdate={vm.payload.updateParameter}
                  onRemove={vm.payload.removeParameter}
                  onClone={vm.payload.cloneParameter}
                  onReplace={vm.payload.replaceParameters}
                />
                <Issues lines={vm.issuesFor('parameters')} />
              </S.Section>

              <S.Section>
                <S.SectionHeader>
                  <S.Legend>{t('field.sample')}</S.Legend>
                  {!vm.isReadOnly && vm.payload.parameters.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={vm.payload.fillSample}>
                      <RiMagicLine size={14} /> {t('field.sample.fill')}
                    </Button>
                  )}
                </S.SectionHeader>
                <S.Hint>{t('field.sample.hint')}</S.Hint>
                <S.SampleText
                  value={vm.payload.sampleText}
                  readOnly={vm.isReadOnly}
                  spellCheck={false}
                  placeholder={t('field.sample.placeholder')}
                  onChange={(e) => vm.payload.setSampleText(e.target.value)}
                />
                {vm.payload.sampleInvalid && <S.Issue $grammar={false}>{t('field.sample.invalid')}</S.Issue>}
                <Issues lines={vm.issuesFor('sample')} />
                <Issues lines={vm.issuesFor('datasets')} />
              </S.Section>
            </S.Sections>
          )}

          {vm.activeTab === 'data' && !vm.isPayload && (
            <S.DataTab>
              <S.SectionHeader>
                <S.Hint>{t('section.datasets.hint')}</S.Hint>
                {!vm.isReadOnly && (
                  <Button variant="secondary" size="sm" onClick={vm.addDataset}>
                    <RiAddLine size={14} /> {t('dataset.add')}
                  </Button>
                )}
              </S.SectionHeader>
              {(form.datasets ?? []).length === 0 && <S.Empty>{t('dataset.empty')}</S.Empty>}
              <S.DatasetSections>
                {(form.datasets ?? []).map((dataset, index) => (
                  <S.Section key={index}>
                    <S.SectionHeader>
                      <S.Legend>{dataset.name.trim() || t('dataset.title', { position: String(index + 1) })}</S.Legend>
                      {!vm.isReadOnly && (
                        <S.DangerAction variant="ghost" size="sm" title={t('dataset.remove')} onClick={() => vm.removeDataset(index)}>
                          <RiDeleteBinLine size={14} />
                        </S.DangerAction>
                      )}
                    </S.SectionHeader>
                    <S.Field>
                      <Label>{t('dataset.name')}</Label>
                      <Input value={dataset.name} disabled={vm.isReadOnly} onChange={(e) => vm.updateDataset(index, { name: e.target.value })} />
                    </S.Field>
                    <S.Pair>
                      <S.Field>
                        <Label>{t('dataset.from')}</Label>
                        <SearchSelect
                          options={vm.childScreenOptions}
                          value={dataset.from}
                          disabled={vm.isReadOnly}
                          onChange={(from) => vm.updateDataset(index, { from, via: '', orderBy: undefined, direction: undefined })}
                        />
                      </S.Field>
                      <S.Field>
                        <Label>{t('dataset.via')}</Label>
                        <SearchSelect
                          options={vm.datasetOptions[index]?.via ?? []}
                          value={dataset.via}
                          disabled={vm.isReadOnly}
                          onChange={(via) => vm.updateDataset(index, { via })}
                        />
                      </S.Field>
                    </S.Pair>
                    <S.Field>
                      <Label>{t('dataset.order-by')}</Label>
                      <S.OrderList>
                        {(vm.datasetOptions[index]?.order ?? []).map((order, position) => (
                          <S.OrderKey key={position}>
                            <SearchSelect
                              options={vm.datasetOptions[index]?.orderBy ?? []}
                              value={order.path}
                              disabled={vm.isReadOnly}
                              onChange={(path) => vm.updateOrderKey(index, position, { path })}
                            />
                            <SearchSelect
                              options={vm.orderDirectionOptions}
                              value={order.dir}
                              disabled={vm.isReadOnly}
                              onChange={(dir) => vm.updateOrderKey(index, position, { dir: dir === 'desc' ? 'desc' : 'asc' })}
                            />
                            {!vm.isReadOnly && (
                              <S.DangerAction variant="ghost" size="sm" title={t('dataset.order.remove')} onClick={() => vm.removeOrderKey(index, position)}>
                                <RiCloseLine size={14} />
                              </S.DangerAction>
                            )}
                          </S.OrderKey>
                        ))}
                        {!vm.isReadOnly && (
                          <S.OrderAdd>
                            <Button variant="ghost" size="sm" onClick={() => vm.addOrderKey(index)}>
                              <RiAddLine size={14} /> {t((vm.datasetOptions[index]?.order ?? []).length > 0 ? 'dataset.order.then' : 'dataset.order.add')}
                            </Button>
                          </S.OrderAdd>
                        )}
                      </S.OrderList>
                    </S.Field>
                    <Issues lines={vm.issuesFor(`datasets[${index}]`)} />
                  </S.Section>
                ))}
              </S.DatasetSections>
              <Issues lines={vm.issuesFor('parameters')} />
            </S.DataTab>
          )}
        </S.Settings>
      )}

      {vm.activeTab === 'content' && (
        <S.Workbench id="document-template-panel" role="tabpanel">
          <S.Pane>
            <S.PaneHeader>
              <S.Hint>{t('section.content.hint')}</S.Hint>
              {vm.canInsertStarter && (
                <Button variant="secondary" size="sm" onClick={vm.insertStarter}>
                  <RiMagicLine size={14} /> {t(vm.isPayload ? 'starter.insert.payload' : 'starter.insert')}
                </Button>
              )}
            </S.PaneHeader>
            {form.format === 'markdown' ? (
              <S.TemplateText
                value={form.body ?? ''}
                readOnly={vm.isReadOnly}
                spellCheck={false}
                placeholder={t('field.body.placeholder')}
                onChange={(e) => vm.setForm({ body: e.target.value })}
              />
            ) : (
              <S.DocxDrop>
                <S.DocxIcon><RiFileWordLine /></S.DocxIcon>
                <S.Hint>{t(form.content ? 'field.docx.loaded' : 'field.docx.empty')}</S.Hint>
                <S.Hint>{t('field.docx.hint')}</S.Hint>
                {!vm.isReadOnly && (
                  <S.FileLabel>
                    <RiUploadLine size={14} /> {t('field.docx.upload')}
                    <S.HiddenFile
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={vm.handleDocxFile}
                    />
                  </S.FileLabel>
                )}
              </S.DocxDrop>
            )}
            {vm.contentIssues.length > 0 && (
              <S.ContentIssues>
                <Issues lines={vm.contentIssues} />
              </S.ContentIssues>
            )}
          </S.Pane>

          <S.Pane>
            <S.PaneHeader>
              <S.Segmented role="tablist">
                <S.SegmentBtn
                  type="button"
                  role="tab"
                  aria-selected={vm.sidePanel === 'preview'}
                  $active={vm.sidePanel === 'preview'}
                  onClick={() => vm.setSidePanel('preview')}
                >
                  {t('panel.preview')}
                </S.SegmentBtn>
                <S.SegmentBtn
                  type="button"
                  role="tab"
                  aria-selected={vm.sidePanel === 'reference'}
                  $active={vm.sidePanel === 'reference'}
                  onClick={() => vm.setSidePanel('reference')}
                >
                  {t('panel.reference')}
                </S.SegmentBtn>
              </S.Segmented>
              {/* O botão mora ao lado do que ele produz, rotulado — como na autoria de relatório. */}
              <Button variant="secondary" size="sm" disabled={!vm.canPreview} onClick={vm.runPreview}>
                {vm.previewTemplate ? <RiRefreshLine size={14} /> : <RiFileSearchLine size={14} />} {t(vm.previewTemplate ? 'preview.refresh' : 'preview.open')}
              </Button>
            </S.PaneHeader>

            <S.SideBody>
              {vm.sidePanel === 'preview' && (
                vm.previewTemplate ? (
                  <>
                    {vm.previewStale && <S.Stale>{t('preview.stale')}</S.Stale>}
                    <TemplatePreview template={vm.previewTemplate} />
                  </>
                ) : (
                  <S.PreviewEmpty>{t('preview.empty')}</S.PreviewEmpty>
                )
              )}
              {vm.sidePanel === 'reference' && vm.helpGroups.map((group) => (
                <S.HelpGroup key={group.title}>
                  <S.HelpGroupTitle>{t(group.title)}</S.HelpGroupTitle>
                  {group.entries.map((entry) => (
                    <S.HelpEntry key={entry.text}>
                      {entry.code && <S.Code>{entry.code}</S.Code>}
                      <S.HelpText>{t(entry.text)}</S.HelpText>
                    </S.HelpEntry>
                  ))}
                  {group.linksFunctionReference && (
                    <S.HelpLink type="button" onClick={vm.openFunctionReference}>
                      {t('help.all-functions')} <RiArrowRightUpLine size={12} />
                    </S.HelpLink>
                  )}
                </S.HelpGroup>
              ))}
            </S.SideBody>
          </S.Pane>
        </S.Workbench>
      )}

      <ConfirmModal
        isOpen={vm.isRemoveOpen}
        title={t(vm.state === 'override' ? 'template.restore' : 'template.delete')}
        message={t(vm.state === 'override' ? 'template.restore.confirm' : 'template.delete.confirm')}
        variant={vm.state === 'override' ? 'default' : 'danger'}
        loading={vm.isRemoving}
        onConfirm={() => void vm.confirmRemove()}
        onCancel={vm.cancelRemove}
      />
      <ConfirmModal
        isOpen={vm.isStarterConfirmOpen}
        title={t('starter.insert')}
        message={t('starter.replace.confirm')}
        confirmLabel={t('starter.replace')}
        onConfirm={vm.confirmStarter}
        onCancel={vm.cancelStarter}
      />
    </S.Page>
  );
};
