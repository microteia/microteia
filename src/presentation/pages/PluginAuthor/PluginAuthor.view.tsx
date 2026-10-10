import React from 'react';
import {
  RiDownloadLine, RiCheckLine, RiLockLine, RiAddLine, RiDeleteBinLine, RiErrorWarningLine, RiSaveLine,
  RiArrowRightSLine, RiArrowDownSLine, RiCodeSSlashLine, RiImageAddLine, RiPuzzle2Line,
} from 'react-icons/ri';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { CodeEditor } from '../../components/ui/CodeEditor';
import { Modal } from '../../components/ui/Modal';
import { getScreenIcon } from '../../shared/screenIcons';
import { CodeViewEditorModal } from './CodeViewEditorModal';
import { usePluginAuthorViewModel, type ArtifactKind } from './PluginAuthor.viewmodel';
import { S } from './PluginAuthor.styles';

import { useT, useLabel } from '../../shared/i18n/useT';
import { LabelInput } from '../../components/ui/LabelInput';

const GROUP_ICON: Record<ArtifactKind, string> = {
  screens: 'layoutGrid',
  screenPatches: 'edit',
  actions: 'cursor',
  workflows: 'flowChart',
  scripts: 'codeBox',
};

export const PluginAuthorView: React.FC<{ tabKey?: string }> = ({ tabKey }) => {
  const vm = usePluginAuthorViewModel(tabKey);
  const t = useT('core.marketplace');
  const label = useLabel();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Title>{t(vm.editing ? 'page.plugin-author-edit' : 'page.plugin-author')}</S.Title>
          <S.Subtitle>{t('author.subtitle')}</S.Subtitle>
        </S.HeaderLeft>
        <S.HeaderActions>
          <S.ActionBtn onClick={vm.download} disabled={vm.busy || !vm.canExport} title={t('author.download')}>
            <RiDownloadLine size={16} />
          </S.ActionBtn>
          <S.SaveBtn onClick={vm.save} disabled={vm.busy || !vm.canSave} title={t(vm.busy ? 'author.saving' : vm.editing ? 'author.save-changes' : 'author.save-to-mine')}>
            <RiSaveLine size={16} />
          </S.SaveBtn>
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        {vm.locked && <InfoBanner message={t('author.imported-locked.banner')} variant="info" />}
        {!vm.locked && !vm.canManage && (
          <InfoBanner message={t('author.admin-only')} variant="info" />
        )}
        {!vm.locked && (<>

        <S.Section>
          <S.SectionTitle>{t('author.identification')}</S.SectionTitle>
          <S.Card>
            <S.FormGrid>
              <S.Field>
                {t('author.field.id')}
                <S.Input
                  placeholder={t('author.field.id.placeholder')}
                  value={vm.form.id}
                  readOnly={vm.editing}
                  onChange={(e) => vm.updateForm({ id: e.target.value })}
                />
                <S.Hint>{t(vm.editing ? 'author.id.locked' : 'author.id.hint')}</S.Hint>
              </S.Field>
              <S.Field>
                {t('author.field.name')}
                <LabelInput as={S.Input} placeholder={t('author.field.name.placeholder')} value={vm.form.name} onChange={(name) => vm.updateForm({ name })} />
              </S.Field>
              <S.Field>
                {t('author.field.version')}
                <LabelInput as={S.Input} placeholder="1.0.0" value={vm.form.version} onChange={(version) => vm.updateForm({ version })} />
              </S.Field>
              <S.Field>
                {t('author.field.category')}
                <LabelInput as={S.Input} placeholder={t('author.field.category.placeholder')} value={vm.form.category} onChange={(category) => vm.updateForm({ category })} />
              </S.Field>
              <S.FieldBlock>
                {t('author.field.icon')}
                <SearchSelect
                  options={vm.iconOptions}
                  value={vm.form.icon}
                  onChange={(icon) => vm.updateForm({ icon })}
                  placeholder={t('author.field.icon.placeholder')}
                />
              </S.FieldBlock>
              <S.FieldBlock>
                {t('author.field.image')}
                <S.ImageRow>
                  {vm.form.image
                    ? <S.ImagePreview src={vm.form.image} alt="" />
                    : <S.ImagePlaceholder>{vm.form.icon ? getScreenIcon(vm.form.icon, 22) : <RiPuzzle2Line size={22} />}</S.ImagePlaceholder>}
                  <S.ImagePick>
                    <RiImageAddLine size={15} /> {t(vm.form.image ? 'author.image.replace' : 'author.image.choose')}
                    <S.HiddenFile
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => void vm.onImageFile(e)}
                    />
                  </S.ImagePick>
                  {vm.form.image && (
                    <S.ActionBtn type="button" onClick={vm.clearImage} title={t('author.image.remove')}>
                      <RiDeleteBinLine size={15} />
                    </S.ActionBtn>
                  )}
                </S.ImageRow>
                <S.Hint>{t('author.image.hint', { limit: vm.imageLimitKb })}</S.Hint>
              </S.FieldBlock>
              <S.FieldWide>
                {t('author.field.summary')}
                <LabelInput as={S.Input} placeholder={t('author.field.summary.placeholder')} value={vm.form.summary} onChange={(summary) => vm.updateForm({ summary })} />
              </S.FieldWide>
              <S.FieldWide>
                {t('author.field.description')}
                <LabelInput as={S.Textarea} multiline value={vm.form.description} onChange={(description) => vm.updateForm({ description })} />
              </S.FieldWide>
            </S.FormGrid>
          </S.Card>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('author.content')}</S.SectionTitle>
          <S.TreeContainer>
            {/* Item fixo: Código de inicialização */}
            <S.TreeItem
              type="button"
              onClick={vm.openStartupEditor}
              title={t('author.startup.edit')}
            >
              <S.TreeItemIcon><RiCodeSSlashLine size={16} /></S.TreeItemIcon>
              <S.TreeItemLabel>{t('author.startup')}</S.TreeItemLabel>
              {vm.startupError && <S.ViewWarn title={t('author.compile-error')}><RiErrorWarningLine size={14} /></S.ViewWarn>}
            </S.TreeItem>

            {vm.groups.map((group) => {
              const selectedInGroup = group.options.filter((o) => o.selected).length;
              const isExpanded = vm.expandedGroups.has(group.kind);
              return (
                <S.TreeGroup key={group.kind}>
                  <S.TreeGroupHead
                    onClick={() => vm.toggleGroup(group.kind)}
                    title={isExpanded ? t('author.group.collapse') : t('author.group.expand')}
                  >
                    <S.TreeToggle>
                      {isExpanded ? <RiArrowDownSLine size={16} /> : <RiArrowRightSLine size={16} />}
                    </S.TreeToggle>
                    <S.TreeGroupIcon>{getScreenIcon(GROUP_ICON[group.kind], 16)}</S.TreeGroupIcon>
                    <S.TreeGroupLabel>{group.title}</S.TreeGroupLabel>
                    <S.TreeGroupCount>{selectedInGroup}/{group.options.length}</S.TreeGroupCount>
                  </S.TreeGroupHead>
                  {isExpanded && (
                    <>
                      {group.options.length === 0 ? (
                        <S.TreeEmpty>{t('author.group.empty')}</S.TreeEmpty>
                      ) : (
                        group.options.map((option) => (
                          <S.TreeItem
                            key={option.id}
                            type="button"
                            $selected={option.selected}
                            disabled={!vm.canManage || option.locked}
                            onClick={() => vm.toggle(group.kind, option.id)}
                            title={
                              option.locked ? t('author.option.locked')
                                : option.carried ? t('author.option.carried')
                                  : undefined
                            }
                          >
                            <S.TreeItemIcon>{getScreenIcon(option.icon ?? GROUP_ICON[group.kind], 16)}</S.TreeItemIcon>
                            <S.TreeItemLabel>{option.label}</S.TreeItemLabel>
                            {option.locked ? (
                              <S.Required><RiLockLine size={11} /> {t('author.option.required')}</S.Required>
                            ) : option.carried ? (
                              <S.Carried><RiCheckLine size={11} /> {t('author.option.included')}</S.Carried>
                            ) : (
                              <S.Check $on={option.selected}>{option.selected && <RiCheckLine size={14} />}</S.Check>
                            )}
                          </S.TreeItem>
                        ))
                      )}
                    </>
                  )}
                </S.TreeGroup>
              );
            })}

            <S.TreeGroup>
              <S.TreeGroupHead
                onClick={() => vm.toggleGroup('codeViews')}
                title={t(vm.expandedGroups.has('codeViews') ? 'author.group.collapse' : 'author.group.expand')}
              >
                <S.TreeToggle>
                  {vm.expandedGroups.has('codeViews') ? <RiArrowDownSLine size={16} /> : <RiArrowRightSLine size={16} />}
                </S.TreeToggle>
                <S.TreeGroupIcon>{getScreenIcon('codeBox', 16)}</S.TreeGroupIcon>
                <S.TreeGroupLabel>{t('author.code-views')}</S.TreeGroupLabel>
                <S.TreeGroupCount>{vm.codeViews.length}</S.TreeGroupCount>
                <S.TreeGroupAction
                  onClick={(e) => {
                    e.stopPropagation();
                    vm.addView();
                  }}
                  disabled={!vm.canManage}
                  title={t('author.view.add')}
                >
                  <RiAddLine size={14} />
                </S.TreeGroupAction>
              </S.TreeGroupHead>
              {vm.expandedGroups.has('codeViews') && (
                <>
                  {vm.codeViews.length === 0 ? (
                    <S.TreeEmpty>{t('author.code-views.empty')}</S.TreeEmpty>
                  ) : (
                    vm.codeViews.map((view) => (
                      <S.TreeItem
                        key={view.id}
                        type="button"
                        onClick={() => vm.openView(view.id)}
                      >
                        <S.TreeItemIcon>{getScreenIcon(view.icon, 16)}</S.TreeItemIcon>
                        <S.TreeItemLabel>{label(view.title)}</S.TreeItemLabel>
                        {view.hasError && <S.ViewWarn title={t('author.compile-error')}><RiErrorWarningLine size={14} /></S.ViewWarn>}
                        <S.TreeItemAction
                          role="button"
                          aria-label={t('author.view.remove')}
                          title={t('author.view.remove')}
                          onClick={(e) => { e.stopPropagation(); vm.removeView(view.id); }}
                        >
                          <RiDeleteBinLine size={14} />
                        </S.TreeItemAction>
                      </S.TreeItem>
                    ))
                  )}
                </>
              )}
            </S.TreeGroup>
          </S.TreeContainer>
        </S.Section>

        {vm.dependencyNotice && vm.selectedCount > 0 && (
          <S.Section>
            <InfoBanner message={vm.dependencyNotice} variant="info" />
          </S.Section>
        )}

        {vm.sizeAdvisory && vm.selectedCount > 0 && (
          <S.Section>
            <InfoBanner message={vm.sizeAdvisory} />
          </S.Section>
        )}

        {vm.issues.length > 0 && vm.selectedCount > 0 && (
          <S.Section>
            <S.SectionTitle>{t('author.issues')}</S.SectionTitle>
            <S.Issues>
              {vm.issues.map((issue) => (
                <S.Issue key={issue}>{issue}</S.Issue>
              ))}
            </S.Issues>
          </S.Section>
        )}

        <S.StatusBar>
          <S.Count>{t('author.selected', { count: vm.selectedCount })}</S.Count>
        </S.StatusBar>
        </>)}
      </S.Content>

      {/* Modal de edição do código de inicialização */}
      {vm.startupEditorOpen && (
        <Modal 
          title={t('author.startup')} 
          onClose={vm.closeStartupEditor} 
          size="xlarge"
          maximizable
          maximized={vm.startupMaximized}
          onToggleMaximize={vm.toggleStartupMaximized}
        >
          <S.StartupDescription>{t('author.startup.description')}</S.StartupDescription>
          {vm.startupError && <InfoBanner message={t('author.compile-error.detail', { error: vm.startupError })} variant="warning" />}
          <S.EditorContainer>
            <CodeEditor 
              value={vm.startup} 
              onChange={vm.setStartup} 
              minHeight={vm.startupMaximized ? "calc(100vh - 240px)" : "calc(85vh - 200px)"} 
              extraLib={vm.extensionTypeDefs} 
            />
          </S.EditorContainer>
        </Modal>
      )}

      <CodeViewEditorModal
        isOpen={vm.editorOpen}
        view={vm.selectedView}
        iconOptions={vm.iconOptions}
        onChange={vm.updateSelectedView}
        onClose={vm.closeEditor}
        extensionTypeDefs={vm.extensionTypeDefs}
      />
    </S.Page>
  );
};
