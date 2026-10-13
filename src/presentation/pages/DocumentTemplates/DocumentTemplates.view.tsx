import React from 'react';
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiDeleteBinLine,
  RiFileTextLine,
  RiMagicLine,
  RiQuestionLine,
  RiUploadLine,
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { Input, Label } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useDocumentTemplatesViewModel } from './DocumentTemplates.viewmodel';
import type { DocumentTemplateRowState } from './DocumentTemplates.viewmodel';
import { S } from './DocumentTemplates.styles';
import { useT } from '../../shared/i18n/useT';

const STATE_TONE: Record<DocumentTemplateRowState, 'muted' | 'primary' | 'warning' | 'success'> = {
  plugin: 'muted',
  override: 'primary',
  disabled: 'warning',
  tenant: 'success',
};

export const DocumentTemplatesView: React.FC = () => {
  const vm = useDocumentTemplatesViewModel();
  const t = useT('core.documents');

  if (!vm.canManage) {
    return (
      <S.Page>
        <S.Header>
          <S.HeaderTitle><RiFileTextLine size={20} />{t('page.templates')}</S.HeaderTitle>
        </S.Header>
        <S.Editor>
          <InfoBanner variant="info" message={t('page.no-permission')} />
        </S.Editor>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.HeaderTitle><RiFileTextLine size={20} />{t('page.templates')}</S.HeaderTitle>
        <Button variant="primary" size="sm" onClick={vm.startNew}>
          <RiAddLine size={14} /> {t('template.new')}
        </Button>
      </S.Header>

      <S.Body>
        <S.List>
          {vm.rows.length === 0 && <S.Empty>{t('template.empty')}</S.Empty>}
          {vm.rows.map((row) => (
            <S.Row key={row.key} $active={!vm.isNew && vm.selectedKey === row.key} onClick={() => vm.selectRow(row.key)}>
              <S.RowTitle>{row.title}</S.RowTitle>
              <S.RowMeta>
                <span>{row.screenLabel}</span>
                <S.Tag $tone="muted">{t(`format.${row.format}`)}</S.Tag>
                <S.Tag $tone={STATE_TONE[row.state]}>{t(`state.${row.state}`)}</S.Tag>
              </S.RowMeta>
            </S.Row>
          ))}
        </S.List>

        <S.Editor>
          {!vm.isNew && !vm.selectedKey ? (
            <InfoBanner variant="info" message={t('template.pick')} />
          ) : (
            <>
              {vm.selectedState === 'plugin' && <InfoBanner variant="info" message={t('state.plugin.hint')} />}
              {vm.selectedState === 'override' && <InfoBanner variant="info" message={t('state.override.hint')} />}
              {vm.selectedState === 'disabled' && <InfoBanner message={t('state.disabled.hint')} />}

              <S.Toolbar>
                {vm.isEditable && (
                  <Button variant="primary" size="sm" disabled={!vm.canSave} onClick={() => void vm.handleSave()}>
                    {t(vm.isSaving ? 'core.ui/saving' : 'core.ui/action.save')}
                  </Button>
                )}
                {vm.selectedState === 'plugin' && (
                  <Button variant="secondary" size="sm" onClick={vm.handleCustomize}>{t('template.customize')}</Button>
                )}
                {(vm.selectedState === 'plugin' || vm.selectedState === 'disabled') && (
                  <Button variant="secondary" size="sm" onClick={() => void vm.handleToggleDisabled()}>
                    {t(vm.selectedState === 'disabled' ? 'template.enable' : 'template.disable')}
                  </Button>
                )}
                {vm.selectedState === 'override' && (
                  <Button variant="secondary" size="sm" onClick={vm.requestDelete}>{t('template.restore')}</Button>
                )}
                {vm.selectedState === 'tenant' && !vm.isNew && (
                  <Button variant="danger" size="sm" onClick={vm.requestDelete}>
                    <RiDeleteBinLine size={14} /> {t('template.delete')}
                  </Button>
                )}
              </S.Toolbar>

              <S.Section>
                <S.SectionTitle>{t('section.general')}</S.SectionTitle>
                <S.Grid>
                  <S.Field>
                    <Label>{t('field.title')}</Label>
                    <Input value={vm.form.title} disabled={vm.isReadOnly} onChange={(e) => vm.setForm({ title: e.target.value })} />
                    {vm.issuesFor('title').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                  </S.Field>
                  <S.Field>
                    <Label>{t('field.key')}</Label>
                    <Input value={vm.form.key} disabled={!vm.isNew} onChange={(e) => vm.setForm({ key: e.target.value })} />
                    <S.Hint>{t(vm.isNew ? 'field.key.hint' : 'field.key.locked')}</S.Hint>
                    {vm.issuesFor('key').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                  </S.Field>
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
                </S.Grid>
              </S.Section>

              <S.Section>
                <S.SectionHeader>
                  <S.SectionTitle>{t('section.content')}</S.SectionTitle>
                  {vm.canInsertStarter && (
                    <Button variant="secondary" size="sm" onClick={vm.insertStarter}>
                      <RiMagicLine size={14} /> {t('starter.insert')}
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
                      <>
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
                      </>
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

              <S.Section>
                <S.SectionTitle>{t('section.datasets')}</S.SectionTitle>
                <S.Hint>{t('section.datasets.hint')}</S.Hint>
                {(vm.form.datasets ?? []).map((dataset, index) => (
                  <S.DatasetRow key={index}>
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
                        onChange={(from) => vm.updateDataset(index, { from, via: '', orderBy: undefined })}
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
                    <S.Field>
                      <Label>{t('dataset.order-by')}</Label>
                      <SearchSelect
                        options={vm.datasetOptions[index]?.orderBy ?? []}
                        value={dataset.orderBy ?? ''}
                        disabled={vm.isReadOnly}
                        onChange={(orderBy) => vm.updateDataset(index, { orderBy: orderBy || undefined })}
                      />
                    </S.Field>
                    {!vm.isReadOnly && (
                      <Button variant="ghost" size="sm" title={t('dataset.remove')} onClick={() => vm.removeDataset(index)}>
                        <RiDeleteBinLine size={14} />
                      </Button>
                    )}
                  </S.DatasetRow>
                ))}
                {vm.issuesFor('datasets').map((one) => <S.Issue key={one.message} $grammar={one.isGrammar}>{one.message}</S.Issue>)}
                {!vm.isReadOnly && (
                  <Button variant="secondary" size="sm" onClick={vm.addDataset}>
                    <RiAddLine size={14} /> {t('dataset.add')}
                  </Button>
                )}
              </S.Section>
            </>
          )}
        </S.Editor>
      </S.Body>

      <ConfirmModal
        isOpen={vm.isDeleteOpen}
        title={t(vm.selectedState === 'override' ? 'template.restore' : 'template.delete')}
        message={t(vm.selectedState === 'override' ? 'template.restore.confirm' : 'template.delete.confirm')}
        variant={vm.selectedState === 'override' ? 'default' : 'danger'}
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
