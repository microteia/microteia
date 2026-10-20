import React from 'react';
import {
  RiAddLine,
  RiArrowGoBackLine,
  RiArrowRightUpLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiBracesLine,
  RiCloseLine,
  RiFileList3Line,
  RiFileSearchLine,
  RiFileTextLine,
  RiFileWordLine,
  RiMagicLine,
  RiMarkdownLine,
  RiQuestionLine,
  RiSaveLine,
  RiSettings3Line,
  RiUploadLine,
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { Input, Label } from '../../components/ui/Input';
import { PrefixedNameInput } from '../../components/ui/PrefixedNameInput';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { ExtensionBadge } from '../../components/ui/ExtensionBadge';
import { useDocumentTemplatesViewModel } from './DocumentTemplates.viewmodel';
import type { DocumentTemplateRowState } from './DocumentTemplates.viewmodel';
import { S } from './DocumentTemplates.styles';
import type { PillTone } from './DocumentTemplates.styles';
import { useT } from '../../shared/i18n/useT';
import { AdvancedParametersEditor } from '../ViewWorkflow/components/AdvancedParametersEditor';
import { TemplatePreviewDialog } from './components/TemplatePreviewDialog';

const STATE_TONE: Record<DocumentTemplateRowState, PillTone> = {
  plugin: 'neutral',
  override: 'primary',
  disabled: 'warning',
  tenant: 'neutral',
};

const FormatGlyph: React.FC<{ format: 'markdown' | 'docx' }> = ({ format }) =>
  (format === 'docx' ? <RiFileWordLine /> : <RiMarkdownLine />);

export const DocumentTemplatesView: React.FC = () => {
  const vm = useDocumentTemplatesViewModel();
  const t = useT('core.documents');

  const header = (
    <S.Header>
      <S.HeaderText>
        <S.Title>{t('page.templates')}</S.Title>
        <S.Subtitle>{t('page.templates.subtitle')}</S.Subtitle>
      </S.HeaderText>
      {vm.canManage && (
        <Button variant="primary" size="sm" onClick={vm.startNew}>
          <RiAddLine size={16} /> {t('template.new')}
        </Button>
      )}
    </S.Header>
  );

  if (!vm.canManage) {
    return (
      <S.Page>
        {header}
        <S.EditorInner>
          <InfoBanner variant="info" message={t('page.no-permission')} />
        </S.EditorInner>
      </S.Page>
    );
  }

  const state = vm.selectedState;
  const row = vm.selectedRow;

  return (
    <S.Page>
      {header}

      <S.Body>
        <S.Sidebar>
          <S.SidebarFilter>
            <CompositeFilter
              defs={vm.filterDefs}
              tokens={vm.filterTokens}
              onChange={vm.setFilterTokens}
              placeholder={t('template.search')}
              screenKey={vm.savedFiltersScreenKey}
            />
          </S.SidebarFilter>
          <S.List>
            {vm.rows.length === 0 && <S.ListEmpty>{t('template.empty')}</S.ListEmpty>}
            {vm.rows.length > 0 && vm.visibleRows.length === 0 && <S.ListEmpty>{t('template.search.empty')}</S.ListEmpty>}
            {vm.visibleRows.map((item) => (
              <S.Row key={item.key} type="button" $active={!vm.isNew && vm.selectedKey === item.key} onClick={() => vm.selectRow(item.key)}>
                <S.FormatIcon $format={item.format}><FormatGlyph format={item.format} /></S.FormatIcon>
                <S.RowBody>
                  <S.RowTop>
                    <S.RowTitle>{item.title}</S.RowTitle>
                    <ExtensionBadge owner={item.extension} />
                  </S.RowTop>
                  <S.RowMeta>{item.screenLabel} · {t(`format.${item.format}`)}</S.RowMeta>
                  {(item.state === 'override' || item.state === 'disabled' || item.outdated) && (
                    <S.Pills>
                      {(item.state === 'override' || item.state === 'disabled') && (
                        <S.Pill $tone={STATE_TONE[item.state]}>{t(`state.${item.state}`)}</S.Pill>
                      )}
                      {item.outdated && <S.Pill $tone="warning"><S.Dot />{t('state.outdated')}</S.Pill>}
                    </S.Pills>
                  )}
                </S.RowBody>
              </S.Row>
            ))}
          </S.List>
        </S.Sidebar>

        <S.Editor>
          {!vm.isNew && !vm.selectedKey ? (
            <S.EmptyEditor>
              <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
              <S.EmptyText>{t('template.pick')}</S.EmptyText>
              <Button variant="secondary" size="sm" onClick={vm.startNew}>
                <RiAddLine size={14} /> {t('template.new')}
              </Button>
            </S.EmptyEditor>
          ) : (
            <S.EditorInner>
              <S.Hero>
                <S.HeroMain>
                  <S.FormatIcon $format={vm.form.format} $size="lg"><FormatGlyph format={vm.form.format} /></S.FormatIcon>
                  <S.HeroText>
                    <S.HeroTitle>{vm.form.title.trim() || t('template.new')}</S.HeroTitle>
                    <S.HeroMeta>
                      {vm.form.key && <S.MetaKey>{vm.form.key}</S.MetaKey>}
                      {row && <><S.MetaSeparator /><span>{row.screenLabel}</span></>}
                      <S.MetaSeparator />
                      <span>{t(`format.${vm.form.format}`)}</span>
                      {row?.extension && <><S.MetaSeparator /><span>{t('template.from-extension', { extension: row.extension })}</span></>}
                    </S.HeroMeta>
                    {state && (
                      <S.Pills>
                        {state === 'plugin'
                          ? <ExtensionBadge owner={row?.extension ?? null} />
                          : <S.Pill $tone={STATE_TONE[state]}>{t(`state.${state}`)}</S.Pill>}
                        {row?.outdated && <S.Pill $tone="warning"><S.Dot />{t('state.outdated')}</S.Pill>}
                      </S.Pills>
                    )}
                  </S.HeroText>
                </S.HeroMain>

                <S.Actions>
                  {state === 'override' && (
                    <Button variant="ghost" size="sm" onClick={vm.requestDelete}>
                      <RiArrowGoBackLine size={14} /> {t('template.restore.short')}
                    </Button>
                  )}
                  {state === 'plugin' && (
                    <Button variant="ghost" size="sm" onClick={() => void vm.handleToggleDisabled()}>
                      <RiEyeOffLine size={14} /> {t('template.disable')}
                    </Button>
                  )}
                  {state === 'tenant' && !vm.isNew && (
                    <S.DangerAction variant="ghost" size="sm" onClick={vm.requestDelete}>
                      <RiDeleteBinLine size={14} /> {t('template.delete')}
                    </S.DangerAction>
                  )}
                  {!vm.isNew && (
                    <Button variant="secondary" size="sm" onClick={vm.handleClone}>
                      <RiFileCopyLine size={14} /> {t('template.clone')}
                    </Button>
                  )}
                  {state === 'plugin' && (
                    <Button variant="primary" size="sm" onClick={vm.handleCustomize}>
                      <RiEdit2Line size={14} /> {t('template.customize')}
                    </Button>
                  )}
                  {state === 'disabled' && (
                    <Button variant="primary" size="sm" onClick={() => void vm.handleToggleDisabled()}>
                      <RiEyeLine size={14} /> {t('template.enable')}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" disabled={!vm.canPreview} onClick={vm.openPreview}>
                    <RiFileSearchLine size={14} /> {t('preview.open')}
                  </Button>
                  {vm.isEditable && (
                    <Button variant="primary" size="sm" disabled={!vm.canSave} onClick={() => void vm.handleSave()}>
                      <RiSaveLine size={14} /> {t(vm.isSaving ? 'core.ui/saving' : 'core.ui/action.save')}
                    </Button>
                  )}
                </S.Actions>
              </S.Hero>

              {vm.isNew && vm.clonedFrom && <InfoBanner variant="info" message={t('template.clone.hint', { title: vm.clonedFrom })} />}
              {state === 'plugin' && <InfoBanner variant="info" message={t('state.plugin.hint')} />}
              {state === 'override' && !row?.outdated && <InfoBanner variant="info" message={t('state.override.hint')} />}
              {state === 'disabled' && <InfoBanner message={t('state.disabled.hint')} />}
              {row?.outdated && (
                <S.Notice>
                  <InfoBanner message={t('state.outdated.hint')} />
                  <S.NoticeActions>
                    <Button variant="secondary" size="sm" onClick={vm.requestDelete}>
                      <RiArrowGoBackLine size={14} /> {t('template.restore')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void vm.handleKeepCopy()}>
                      <RiCheckLine size={14} /> {t('template.outdated.keep')}
                    </Button>
                  </S.NoticeActions>
                </S.Notice>
              )}

              <S.Section>
                <S.SectionHeading>
                  <S.SectionIcon><RiSettings3Line size={16} /></S.SectionIcon>
                  <S.SectionText>
                    <S.SectionTitle>{t('section.general')}</S.SectionTitle>
                    <S.Hint>{t('section.general.hint')}</S.Hint>
                  </S.SectionText>
                </S.SectionHeading>
                <S.Grid>
                  <S.Field>
                    <Label>{t('field.title')}</Label>
                    <Input value={vm.form.title} disabled={vm.isReadOnly} onChange={(e) => vm.setForm({ title: e.target.value })} />
                    {vm.issuesFor('title').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
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
                      <Input value={vm.form.key} disabled />
                    )}
                    <S.Hint>{t(vm.isNew ? 'field.key.hint' : 'field.key.locked')}</S.Hint>
                    {vm.issuesFor('key').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                  </S.Field>
                  <S.Field>
                    <Label>{t('field.source')}</Label>
                    <SearchSelect
                      options={vm.sourceOptions}
                      value={vm.isPayload ? 'payload' : 'record'}
                      disabled={vm.isReadOnly}
                      onChange={vm.setSource}
                    />
                    <S.Hint>{t(vm.isPayload ? 'field.source.payload.hint' : 'field.source.record.hint')}</S.Hint>
                  </S.Field>
                  {!vm.isPayload && (
                    <S.Field>
                      <Label>{t('field.collection')}</Label>
                      <SearchSelect
                        options={vm.screenOptions}
                        value={vm.form.collection}
                        disabled={vm.isReadOnly}
                        onChange={(collection) => vm.setForm({ collection })}
                      />
                      <S.Hint>{t('field.collection.hint')}</S.Hint>
                      {vm.issuesFor('collection').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                    </S.Field>
                  )}
                  <S.Field>
                    <Label>{t('field.format')}</Label>
                    <SearchSelect
                      options={vm.formatOptions}
                      value={vm.form.format}
                      disabled={vm.isReadOnly}
                      onChange={(format) => vm.setForm({ format: format === 'docx' ? 'docx' : 'markdown' })}
                    />
                  </S.Field>
                  <S.Field>
                    <Label>{t('field.file-name')}</Label>
                    <Input
                      value={vm.form.fileName ?? ''}
                      disabled={vm.isReadOnly}
                      placeholder={t('field.file-name.placeholder')}
                      onChange={(e) => vm.setForm({ fileName: e.target.value })}
                    />
                    {vm.issuesFor('fileName').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                  </S.Field>
                  <S.Field>
                    <Label>{t('field.document-type')}</Label>
                    <SearchSelect
                      options={vm.documentTypeOptions}
                      value={vm.form.documentType ?? ''}
                      disabled={vm.isReadOnly}
                      onChange={(documentType) => vm.setForm({ documentType })}
                    />
                  </S.Field>
                  <S.Field>
                    <Label>{t('field.destination')}</Label>
                    <SearchSelect
                      options={vm.destinationOptions}
                      value={vm.form.destination ?? (vm.isPayload ? 'downloads' : 'record')}
                      disabled={vm.isReadOnly}
                      onChange={(destination) => vm.setForm({ destination: destination === 'downloads' ? 'downloads' : 'record' })}
                    />
                    <S.Hint>{t('field.destination.hint')}</S.Hint>
                    {vm.issuesFor('destination').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                  </S.Field>
                  {(vm.form.destination === 'downloads' || vm.isPayload) && (
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
                      {vm.issuesFor('retentionDays').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                    </S.Field>
                  )}
                </S.Grid>
              </S.Section>

              {vm.isPayload && (
                <S.Section>
                  <S.SectionHeading>
                    <S.SectionIcon><RiBracesLine size={16} /></S.SectionIcon>
                    <S.SectionText>
                      <S.SectionTitle>{t('section.payload')}</S.SectionTitle>
                      <S.Hint>{t('section.payload.hint')}</S.Hint>
                    </S.SectionText>
                  </S.SectionHeading>
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
                  {vm.issuesFor('parameters').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                  <S.SectionHeader>
                    <S.Field>
                      <Label>{t('field.sample')}</Label>
                      <S.Hint>{t('field.sample.hint')}</S.Hint>
                    </S.Field>
                    {!vm.isReadOnly && vm.payload.parameters.length > 0 && (
                      <Button variant="secondary" size="sm" onClick={vm.payload.fillSample}>
                        <RiMagicLine size={14} /> {t('field.sample.fill')}
                      </Button>
                    )}
                  </S.SectionHeader>
                  <S.SampleText
                    value={vm.payload.sampleText}
                    readOnly={vm.isReadOnly}
                    spellCheck={false}
                    placeholder={t('field.sample.placeholder')}
                    onChange={(e) => vm.payload.setSampleText(e.target.value)}
                  />
                  {vm.payload.sampleInvalid && <S.Issue $grammar={false}>{t('field.sample.invalid')}</S.Issue>}
                  {vm.issuesFor('sample').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                </S.Section>
              )}

              <S.Section>
                <S.SectionHeader>
                  <S.SectionHeading>
                    <S.SectionIcon><RiFileTextLine size={16} /></S.SectionIcon>
                    <S.SectionText>
                      <S.SectionTitle>{t('section.content')}</S.SectionTitle>
                      <S.Hint>{t('section.content.hint')}</S.Hint>
                    </S.SectionText>
                  </S.SectionHeading>
                  {vm.canInsertStarter && (
                    <Button variant="secondary" size="sm" onClick={vm.insertStarter}>
                      <RiMagicLine size={14} /> {t(vm.isPayload ? 'starter.insert.payload' : 'starter.insert')}
                    </Button>
                  )}
                </S.SectionHeader>
                <S.ContentLayout>
                  <S.ContentMain>
                    {vm.form.format === 'markdown' ? (
                      <S.TemplateText
                        value={vm.form.body ?? ''}
                        readOnly={vm.isReadOnly}
                        spellCheck={false}
                        placeholder={t('field.body.placeholder')}
                        onChange={(e) => vm.setForm({ body: e.target.value })}
                      />
                    ) : (
                      <S.DocxDrop>
                        <S.DocxIcon><RiFileWordLine /></S.DocxIcon>
                        <S.Hint>{t(vm.form.content ? 'field.docx.loaded' : 'field.docx.empty')}</S.Hint>
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
                    {[...vm.issuesFor('body'), ...vm.issuesFor('content'), ...vm.issuesFor('outputs')].map((one) => (
                      <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>
                    ))}
                  </S.ContentMain>

                  <S.Help aria-label={t('help.title')}>
                    <S.HelpTitle><RiQuestionLine size={14} /> {t('help.title')}</S.HelpTitle>
                    {vm.helpGroups.map((group) => (
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
                  </S.Help>
                </S.ContentLayout>
              </S.Section>

              {!vm.isPayload && (
                <S.Section>
                  <S.SectionHeader>
                    <S.SectionHeading>
                      <S.SectionIcon><RiFileList3Line size={16} /></S.SectionIcon>
                      <S.SectionText>
                        <S.SectionTitle>{t('section.datasets')}</S.SectionTitle>
                        <S.Hint>{t('section.datasets.hint')}</S.Hint>
                      </S.SectionText>
                    </S.SectionHeading>
                    {!vm.isReadOnly && (
                      <Button variant="secondary" size="sm" onClick={vm.addDataset}>
                        <RiAddLine size={14} /> {t('dataset.add')}
                      </Button>
                    )}
                  </S.SectionHeader>
                  {(vm.form.datasets ?? []).length > 0 && (
                    <S.DatasetList>
                      {(vm.form.datasets ?? []).map((dataset, index) => (
                        <S.Dataset key={index}>
                          <S.DatasetRow>
                            <S.Field>
                              <Label>{t('dataset.name')}</Label>
                              <Input value={dataset.name} disabled={vm.isReadOnly} onChange={(e) => vm.updateDataset(index, { name: e.target.value })} />
                            </S.Field>
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
                            {!vm.isReadOnly && (
                              <S.DangerAction variant="ghost" size="sm" title={t('dataset.remove')} onClick={() => vm.removeDataset(index)}>
                                <RiDeleteBinLine size={14} />
                              </S.DangerAction>
                            )}
                          </S.DatasetRow>
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
                        </S.Dataset>
                      ))}
                    </S.DatasetList>
                  )}
                  {vm.issuesFor('datasets').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                </S.Section>
              )}
            </S.EditorInner>
          )}
        </S.Editor>
      </S.Body>

      {vm.isPreviewOpen && <TemplatePreviewDialog template={vm.form} onClose={vm.closePreview} />}

      <ConfirmModal
        isOpen={vm.isDeleteOpen}
        title={t(state === 'override' ? 'template.restore' : 'template.delete')}
        message={t(state === 'override' ? 'template.restore.confirm' : 'template.delete.confirm')}
        variant={state === 'override' ? 'default' : 'danger'}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
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
