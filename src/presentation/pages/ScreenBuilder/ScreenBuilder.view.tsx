import React from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiArrowUpSLine,
  RiDeleteBinLine,
  RiDraggable,
  RiEyeLine,
  RiEyeOffLine,
  RiPencilLine,
} from 'react-icons/ri';
import { S } from './ScreenBuilder.styles';
import { useScreenBuilderViewModel } from './ScreenBuilder.viewmodel';
import type { ScreenBuilderViewModel, SelectedScreenState } from './ScreenBuilder.viewmodel';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Input, InputGroup, Label } from '../../components/ui/Input';
import { PrefixedNameInput } from '../../components/ui/PrefixedNameInput';
import { LabelInput } from '../../components/ui/LabelInput';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { MultiSearchSelect } from '../../components/ui/MultiSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ExpressionEditor } from '../../components/ui/ExpressionEditor';
import { ColorSwatchPicker } from '../../components/ui/ColorSwatchPicker';
import { ColorDot } from '../../components/ui/Badge';
import { getScreenIcon } from '../../shared/screenIcons';
import { ScreenPortalPanel } from './components/ScreenPortalPanel';
import { ScreenEditWindowPanel } from './components/ScreenEditWindowPanel';
import { ScreenMemberVisibilityPanel } from './components/ScreenMemberVisibilityPanel';
import { FieldSequencePanel } from './components/FieldSequencePanel';
import type { FieldDefinition } from '../../../domain/entities';

import { useT, useLabel } from '../../shared/i18n/useT';

const FieldRows: React.FC<{ vm: ScreenBuilderViewModel; screenKey: string; fields: FieldDefinition[] }> = ({ vm, screenKey, fields }) => {
  const t = useT('core.records');
  const label = useLabel();

  return (
  <S.FieldList>
    {fields.length === 0 && <S.EmptyHint>{t('screen.fields.empty')}</S.EmptyHint>}
    {fields.map((field, index) => (
      <S.FieldRow
        key={field.key}
        draggable
        $dragging={vm.draggedFieldKey === field.key}
        $dragOver={vm.dragOverFieldKey === field.key && vm.draggedFieldKey !== field.key}
        onDragStart={() => vm.handleFieldDragStart(field.key)}
        onDragOver={(e) => {
          e.preventDefault();
          vm.handleFieldDragOver(field.key);
        }}
        onDrop={(e) => {
          e.preventDefault();
          void vm.handleFieldDrop(screenKey, field.key);
        }}
        onDragEnd={vm.handleFieldDragEnd}
      >
        <S.DragHandle title={t('field.drag')}>
          <RiDraggable size={16} />
        </S.DragHandle>
        <S.FieldInfo>
          <S.FieldName>
            {label(field.label)}
            {field.required ? ' *' : ''}
            {vm.isTitleField(screenKey, field.key) ? ` (${t('field.title-marker')})` : ''}
          </S.FieldName>
          <S.FieldMeta>
            {vm.isNativeField(screenKey, field.key)
              ? `${t('field.origin.native')} · `
              : vm.isPluginField(screenKey, field.key)
                ? `${t('field.origin.plugin')} · `
                : ''}
            {vm.fieldTypeLabel(field.type)}
            {field.section ? ` · ${label(field.section)}` : ''}
            {` · fieldName: ${field.key}`}
            {vm.hasNativeOverride(screenKey, field.key) ? ` · ${t('field.adjusted')}` : ''}
          </S.FieldMeta>
        </S.FieldInfo>
        <S.CardActions>
          <S.IconButton
            title={t('action.move-up')}
            disabled={index === 0}
            onClick={() => void vm.moveField(screenKey, field.key, -1)}
          >
            <RiArrowUpSLine size={18} />
          </S.IconButton>
          <S.IconButton
            title={t('action.move-down')}
            disabled={index === fields.length - 1}
            onClick={() => void vm.moveField(screenKey, field.key, 1)}
          >
            <RiArrowDownSLine size={18} />
          </S.IconButton>
          <S.IconButton title={t('field.edit')} onClick={() => vm.openEditField(screenKey, field.key)}>
            <RiPencilLine size={16} />
          </S.IconButton>
          {vm.isNativeField(screenKey, field.key) ? (
            <S.IconButton
              title={t('field.restore')}
              disabled={!vm.hasNativeOverride(screenKey, field.key)}
              onClick={() => void vm.restoreNativeField(screenKey, field.key)}
            >
              <RiArrowGoBackLine size={16} />
            </S.IconButton>
          ) : (
            <S.DangerIconButton
              title={
                vm.isPluginField(screenKey, field.key)
                  ? t('field.managed.cannot-delete.short')
                  : t('field.delete')
              }
              disabled={vm.isTitleField(screenKey, field.key) || vm.isPluginField(screenKey, field.key)}
              onClick={() => vm.requestDeleteField(screenKey, field.key)}
            >
              <RiDeleteBinLine size={16} />
            </S.DangerIconButton>
          )}
        </S.CardActions>
      </S.FieldRow>
    ))}
  </S.FieldList>
  );
};

const ScreenDetailPane: React.FC<{ vm: ScreenBuilderViewModel; screen: SelectedScreenState }> = ({ vm, screen }) => {
  const t = useT('core.records');

  return (
  <S.DetailCard $disabled={!screen.enabled}>
    <S.ScreenCardHeader>
      <S.ScreenIcon>{getScreenIcon(screen.icon)}</S.ScreenIcon>
      <S.ScreenInfo>
        <S.ScreenName>
          {screen.title}
          {vm.isManagedScreen(screen.key) && (
            <S.PluginBadge title={vm.managedScreenOwner(screen.key) ?? undefined}>{t('badge.extension')}</S.PluginBadge>
          )}
          {!screen.enabled && <S.DisabledBadge>{t('badge.disabled')}</S.DisabledBadge>}
        </S.ScreenName>
        <S.ScreenMeta>{screen.meta}</S.ScreenMeta>
      </S.ScreenInfo>
      {screen.kind === 'dynamic' && (
        <S.CardActions>
          <S.IconButton
            title={t('action.move-up')}
            disabled={!screen.canMoveUp}
            onClick={() => void vm.moveScreen(screen.key, -1)}
          >
            <RiArrowUpSLine size={18} />
          </S.IconButton>
          <S.IconButton
            title={t('action.move-down')}
            disabled={!screen.canMoveDown}
            onClick={() => void vm.moveScreen(screen.key, 1)}
          >
            <RiArrowDownSLine size={18} />
          </S.IconButton>
          <S.IconButton
            title={t(screen.enabled ? 'screen.disable' : 'screen.enable')}
            onClick={() => void vm.toggleScreenEnabled(screen.key)}
          >
            {screen.enabled ? <RiEyeLine size={16} /> : <RiEyeOffLine size={16} />}
          </S.IconButton>
          <S.IconButton title={t('screen.edit')} onClick={() => vm.openEditScreen(screen.key)}>
            <RiPencilLine size={16} />
          </S.IconButton>
          <S.DangerIconButton
            title={t(vm.isManagedScreen(screen.key) ? 'screen.managed.cannot-delete.short' : 'screen.delete')}
            disabled={vm.isManagedScreen(screen.key)}
            onClick={() => vm.requestDeleteScreen(screen.key)}
          >
            <RiDeleteBinLine size={16} />
          </S.DangerIconButton>
        </S.CardActions>
      )}
      {screen.kind === 'builtin' && (
        <S.CardActions>
          <S.IconButton title={t('screen.children.configure')} onClick={() => vm.openEditScreen(screen.key)}>
            <RiPencilLine size={16} />
          </S.IconButton>
        </S.CardActions>
      )}
    </S.ScreenCardHeader>
    <FieldRows vm={vm} screenKey={screen.key} fields={screen.fields} />
    <S.CardFooter>
      <Button variant="secondary" size="sm" onClick={() => vm.openCreateField(screen.key)}>
        <RiAddLine size={16} />
        {t('field.add')}
      </Button>
    </S.CardFooter>
  </S.DetailCard>
  );
};

export const ScreenBuilderView: React.FC = () => {
  const t = useT('core.records');
  const label = useLabel();
  const vm = useScreenBuilderViewModel();

  if (!vm.isAdmin) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>{t('page.screen-builder')}</S.Title>
        </S.Header>
        <S.BannerWrapper>
          <InfoBanner
            variant="info"
            message={t('screen-builder.admin-only')}
          />
        </S.BannerWrapper>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.screen-builder')}</S.Title>
        <Button onClick={vm.openCreateScreen} title={t('screen.modal.new')}>
          <RiAddLine size={18} />
        </Button>
      </S.Header>

      <S.Content>
        <S.Sidebar>
          <S.SidebarSection>
            <S.SectionTitle>{t('screen-builder.custom')}</S.SectionTitle>
            <S.SectionHint>{t('screen-builder.custom.hint')}</S.SectionHint>
            {vm.dynamicListEntries.length === 0 && (
              <S.EmptyHint>{t('screen-builder.custom.empty')}</S.EmptyHint>
            )}
            <S.ScreenList>
              {vm.dynamicListEntries.map((entry) => (
                <S.ScreenListItem
                  key={entry.key}
                  type="button"
                  $active={vm.selectedKey === entry.key}
                  onClick={() => vm.selectScreen(entry.key)}
                >
                  <S.ScreenListIcon>{getScreenIcon(entry.icon)}</S.ScreenListIcon>
                  <S.ScreenListInfo>
                    <S.ScreenListName>
                      {entry.title}
                      {entry.disabled && <S.DisabledBadge>{t('badge.disabled')}</S.DisabledBadge>}
                    </S.ScreenListName>
                    <S.ScreenListMeta>{entry.meta}</S.ScreenListMeta>
                  </S.ScreenListInfo>
                </S.ScreenListItem>
              ))}
            </S.ScreenList>
          </S.SidebarSection>

          <S.SidebarSection>
            <S.SectionTitle>{t('screen-builder.builtin')}</S.SectionTitle>
            <S.SectionHint>{t('screen-builder.builtin.hint')}</S.SectionHint>
            <S.ScreenList>
              {vm.builtinListEntries.map((entry) => (
                <S.ScreenListItem
                  key={entry.key}
                  type="button"
                  $active={vm.selectedKey === entry.key}
                  onClick={() => vm.selectScreen(entry.key)}
                >
                  <S.ScreenListIcon>{getScreenIcon(entry.icon)}</S.ScreenListIcon>
                  <S.ScreenListInfo>
                    <S.ScreenListName>{entry.title}</S.ScreenListName>
                    <S.ScreenListMeta>{entry.meta}</S.ScreenListMeta>
                  </S.ScreenListInfo>
                </S.ScreenListItem>
              ))}
            </S.ScreenList>
          </S.SidebarSection>
        </S.Sidebar>

        <S.Detail>
          {vm.selectedScreen ? (
            <ScreenDetailPane vm={vm} screen={vm.selectedScreen} />
          ) : (
            <S.EmptyHint>{t('screen-builder.pick-screen')}</S.EmptyHint>
          )}
        </S.Detail>
      </S.Content>

      {vm.screenModalOpen && (
        <Modal
          title={vm.screenModalTitle}
          onClose={vm.closeScreenModal}
          size="xlarge"
        >
          {vm.screenModalTabs.length > 1 && (
            <S.ModalTabs>
              {vm.screenModalTabs.map((tab) => (
                <S.ModalTabBtn
                  key={tab.key}
                  $active={vm.screenModalTab === tab.key}
                  onClick={() => vm.setScreenModalTab(tab.key)}
                >
                  {tab.label}
                </S.ModalTabBtn>
              ))}
            </S.ModalTabs>
          )}
          <S.ModalForm>
            {/* Título, ícone, abas e ações são fixos nas telas do sistema — lá não há aba "Geral". */}
            {vm.screenModalTab === 'general' && !vm.screenModalIsBuiltin && (
              <>
                <InputGroup>
                  <Label>{t('screen.title-singular')}</Label>
                  <LabelInput
                    value={vm.screenForm.titleSingular}
                    onChange={(titleSingular) => vm.updateScreenForm({ titleSingular })}
                    placeholder={t('screen.title-singular.placeholder')}
                  />
                </InputGroup>
                <InputGroup>
                  <Label>{t('screen.title-plural')}</Label>
                  <LabelInput
                    value={vm.screenForm.titlePlural}
                    onChange={(titlePlural) => vm.updateScreenForm({ titlePlural })}
                    placeholder={t('screen.title-plural.placeholder')}
                  />
                </InputGroup>
                <InputGroup>
                  <Label>{t('screen.key')}</Label>
                  {vm.screenModalIsEdit ? (
                    <Input value={vm.screenForm.screenKey} disabled />
                  ) : (
                    <PrefixedNameInput
                      prefix={vm.artifactPrefix}
                      kind="collection"
                      value={vm.screenForm.screenKey}
                      onChange={(screenKey) => vm.updateScreenForm({ screenKey })}
                      placeholder={t('screen.key.placeholder')}
                    />
                  )}
                  <S.FieldHint>
                    {t(vm.screenModalIsEdit ? 'screen.key.locked' : 'screen.key.hint')}
                  </S.FieldHint>
                </InputGroup>
                <InputGroup>
                  <Label>{t('screen.icon')}</Label>
                  <SearchSelect
                    options={vm.iconOptions}
                    value={vm.screenForm.icon}
                    onChange={(value) => vm.updateScreenForm({ icon: value })}
                    placeholder={t('screen.icon.placeholder')}
                  />
                </InputGroup>
                {vm.screenModalIsEdit && (
                  <>
                    {vm.titleFieldOptions.length > 0 && (
                      <InputGroup>
                        <Label>{t('screen.title-field')}</Label>
                        <SearchSelect
                          options={vm.titleFieldOptions}
                          value={vm.screenForm.titleFieldKey}
                          onChange={(value) => vm.updateScreenForm({ titleFieldKey: value })}
                          placeholder={t('screen.title-field.placeholder')}
                        />
                      </InputGroup>
                    )}
                    <InputGroup>
                      <Label>{t('screen.subtitle-field')}</Label>
                      <SearchSelect
                        options={vm.subtitleFieldOptions}
                        value={vm.screenForm.subtitleFieldKey}
                        onChange={(value) => vm.updateScreenForm({ subtitleFieldKey: value })}
                        placeholder={t('screen.subtitle-field.placeholder')}
                      />
                    </InputGroup>
                    {vm.imageFieldOptions.length > 1 && (
                      <InputGroup>
                        <Label>{t('screen.image-field')}</Label>
                        <SearchSelect
                          options={vm.imageFieldOptions}
                          value={vm.screenForm.imageFieldKey}
                          onChange={(value) => vm.updateScreenForm({ imageFieldKey: value })}
                          placeholder={t('screen.image-field.placeholder')}
                        />
                        <S.FieldHint>{t('screen.image-field.hint')}</S.FieldHint>
                      </InputGroup>
                    )}
                  </>
                )}
                <S.RulesDivider>{t('screen.tabs')}</S.RulesDivider>
                <S.CheckboxCell>
                  <Checkbox
                    label={t('screen.enable-notes')}
                    checked={vm.screenForm.hasNotes}
                    onChange={(next) => vm.updateScreenForm({ hasNotes: next })}
                  />
                </S.CheckboxCell>
                <S.CheckboxCell>
                  <Checkbox
                    label={t('screen.enable-documents')}
                    checked={vm.screenForm.hasDocuments}
                    onChange={(next) => vm.updateScreenForm({ hasDocuments: next })}
                  />
                </S.CheckboxCell>
                <S.CheckboxCell>
                  <Checkbox
                    label={t('screen.enable-tags')}
                    checked={vm.screenForm.hasTags}
                    onChange={(next) => vm.updateScreenForm({ hasTags: next })}
                  />
                </S.CheckboxCell>
                {vm.screenForm.hasTags && (
                  <>
                    <InputGroup>
                      <Label>{t('screen.tag-collection')}</Label>
                      <Input
                        value={vm.screenForm.tagCollection}
                        onChange={(e) => vm.updateScreenForm({ tagCollection: e.target.value })}
                        placeholder={vm.suggestedTagCollection}
                      />
                      <S.FieldHint>
                        {vm.suggestedTagCollection
                          ? t('screen.tag-collection.hint.suggested', { name: vm.suggestedTagCollection })
                          : t('screen.tag-collection.hint')}
                      </S.FieldHint>
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('screen.tag-collection.share')}</Label>
                      <SearchSelect
                        options={vm.tagListOptions}
                        value={vm.screenForm.tagCollection}
                        onChange={(value) => vm.updateScreenForm({ tagCollection: value })}
                        placeholder={t('screen.tag-collection.share.placeholder')}
                      />
                    </InputGroup>
                  </>
                )}
                {vm.screenModalIsEdit && (
                  <S.CheckboxCell>
                    <Checkbox
                      label={t('screen.enabled')}
                      checked={vm.screenForm.enabled}
                      onChange={(next) => vm.updateScreenForm({ enabled: next })}
                    />
                  </S.CheckboxCell>
                )}
              </>
            )}

            {vm.screenModalTab === 'children' && (
              <>
                <S.FullRow>
                  <InfoBanner
                    variant="info"
                    message={t('screen.children.hint')}
                  />
                </S.FullRow>
                {vm.childCandidates.map((candidate) => {
                  const linkField = vm.screenForm.childLinks[candidate.key];
                  const isChild = linkField !== undefined;
                  return (
                    <React.Fragment key={candidate.key}>
                      <S.CheckboxCell>
                        <Checkbox
                          label={candidate.label}
                          checked={isChild}
                          onChange={() => vm.toggleChildScreen(candidate.key)}
                        />
                      </S.CheckboxCell>
                      {isChild && candidate.fieldOptions.length > 1 ? (
                        <InputGroup>
                          <Label>{t('screen.link-field', { label: candidate.label })}</Label>
                          <SearchSelect
                            options={candidate.fieldOptions}
                            value={linkField}
                            onChange={(value) => vm.setChildLinkField(candidate.key, value)}
                            placeholder={t('field.pick')}
                          />
                        </InputGroup>
                      ) : <div />}
                    </React.Fragment>
                  );
                })}
              </>
            )}

            {vm.screenModalTab === 'portal' && (
              <ScreenPortalPanel
                form={vm.screenForm.portal}
                fieldOptions={vm.portalPanel.fieldOptions}
                createFieldOptions={vm.portalPanel.createFieldOptions}
                documentTypeOptions={vm.portalPanel.documentTypeOptions}
                referenceFieldOptions={vm.portalPanel.referenceFieldOptions}
                editFieldOptions={vm.portalPanel.editFieldOptions}
                actionOptions={vm.portalPanel.actionOptions}
                hasParent={vm.portalPanel.hasParent}
                hasDocuments={vm.portalPanel.hasDocuments}
                readOnly={vm.portalPanel.readOnly}
                issues={vm.portalPanel.issues}
                collection={vm.portalPanel.collection}
                onToggleEnabled={vm.setPortalEnabled}
                onSubjectKind={vm.setPortalSubjectKind}
                onSubjectField={vm.setPortalSubjectField}
                onToggleField={vm.togglePortalField}
                onVisibleWhen={vm.setPortalVisibleWhen}
                onToggleDocuments={vm.setPortalDocuments}
                onToggleCreate={vm.setPortalAllowCreate}
                onToggleCreateField={vm.togglePortalCreateField}
                onToggleUploads={vm.setPortalAllowUploads}
                onToggleUploadType={vm.togglePortalUploadType}
                onToggleEdit={vm.setPortalAllowEdit}
                onToggleEditField={vm.togglePortalEditField}
                onEditWhen={vm.setPortalEditWhen}
                onToggleEditOnlyOwn={vm.setPortalEditOnlyOwn}
                onToggleNotifyOffice={vm.setPortalNotifyOffice}
                onToggleAutomationInvites={vm.setPortalAutomationInvites}
                onToggleDocumentLinks={vm.setPortalDocumentLinks}
                onDocumentLinkMinutes={vm.setPortalDocumentLinkMinutes}
                onToggleTrackViews={vm.setPortalTrackViews}
                onToggleAction={vm.togglePortalAction}
              />
            )}
            {vm.screenModalTab === 'editWindow' && (
              <ScreenEditWindowPanel
                form={vm.screenForm.editWindow}
                fromExtension={vm.editWindowFromExtension}
                onChange={vm.updateEditWindowForm}
              />
            )}
            {vm.screenModalTab === 'memberVisibility' && (
              <ScreenMemberVisibilityPanel
                form={vm.screenForm.memberVisibility}
                fieldOptions={vm.memberVisibilityPanel.fieldOptions}
                bypassOptions={vm.memberVisibilityPanel.bypassOptions}
                issue={vm.memberVisibilityPanel.issue}
                maxFields={vm.memberVisibilityPanel.maxFields}
                fromExtension={vm.editWindowFromExtension}
                onChange={vm.updateMemberVisibilityForm}
              />
            )}
            {vm.screenModalTab === 'actions' && (
              <>
                <InputGroup>
                  <Label>{t('screen.detail-actions')}</Label>
                  <MultiSearchSelect
                    options={vm.actionOptions}
                    values={vm.screenForm.viewActionIds}
                    onChange={vm.setScreenViewActionIds}
                    placeholder={t('screen.actions.none')}
                  />
                </InputGroup>
                <InputGroup>
                  <Label>{t('screen.card-actions')}</Label>
                  <MultiSearchSelect
                    options={vm.actionOptions}
                    values={vm.screenForm.cardActionIds}
                    onChange={vm.setScreenCardActionIds}
                    placeholder={t('screen.actions.none')}
                  />
                </InputGroup>
                {vm.gestureRows.length > 0 && (
                  <S.FullRow>
                    <InputGroup>
                      <Label>{t('screen.gestures')}</Label>
                      <S.FieldList>
                        {vm.gestureRows.map((row) => (
                          <S.FieldRow key={row.key}>
                            <S.FieldInfo>
                              <Checkbox
                                label={row.label}
                                checked={row.enabled}
                                onChange={() => vm.toggleListAction(row.key)}
                                disabled={!vm.screenModalIsBuiltin && row.requiresTags && !vm.screenForm.hasTags}
                              />
                            </S.FieldInfo>
                            <S.PluginBadge>{t('screen.gestures.badge')}</S.PluginBadge>
                            <S.CardActions>
                              <S.IconButton
                                title={t('action.move-up')}
                                disabled={!row.canMoveUp}
                                onClick={() => vm.moveListAction(row.key, -1)}
                              >
                                <RiArrowUpSLine size={18} />
                              </S.IconButton>
                              <S.IconButton
                                title={t('action.move-down')}
                                disabled={!row.canMoveDown}
                                onClick={() => vm.moveListAction(row.key, 1)}
                              >
                                <RiArrowDownSLine size={18} />
                              </S.IconButton>
                            </S.CardActions>
                          </S.FieldRow>
                        ))}
                      </S.FieldList>
                      <S.FieldHint>{t('screen.gestures.hint')}</S.FieldHint>
                    </InputGroup>
                  </S.FullRow>
                )}
              </>
            )}

            <S.ModalActions>
              <Button variant="secondary" onClick={vm.closeScreenModal}>{t('core.ui/action.cancel')}</Button>
              <Button onClick={() => void vm.handleSaveScreen()} disabled={vm.savingScreen} $isLoading={vm.savingScreen}>{t('core.ui/action.save')}</Button>
            </S.ModalActions>
          </S.ModalForm>
        </Modal>
      )}

      {vm.fieldModalOpen && (
        <Modal title={t(vm.fieldModalIsNative ? 'field.modal.native' : vm.fieldModalIsEdit ? 'field.modal.edit' : 'field.modal.new')} onClose={vm.closeFieldModal} size="xlarge">
          <S.ModalTabs>
            <S.ModalTabBtn $active={vm.fieldModalTab === 'general'} onClick={() => vm.setFieldModalTab('general')}>
              {t('screen.tab.general')}
            </S.ModalTabBtn>
            <S.ModalTabBtn $active={vm.fieldModalTab === 'advanced'} onClick={() => vm.setFieldModalTab('advanced')}>
              {t('field.tab.advanced')}
            </S.ModalTabBtn>
          </S.ModalTabs>
          <S.ModalForm>
            {vm.fieldModalIsNative && (
              <S.FullRow>
                <InfoBanner
                  variant="info"
                  message={t('field.native.banner')}
                />
              </S.FullRow>
            )}
            {vm.fieldModalTab === 'general' && (
              <>
            <InputGroup>
              <Label>{t('field.label')}</Label>
              <LabelInput
                value={vm.fieldForm.label}
                onChange={(label) => vm.updateFieldForm({ label })}
                placeholder={t('field.label.placeholder')}
              />
            </InputGroup>
            {!vm.fieldModalIsNative && (
              <>
            <InputGroup>
              <Label>{t('field.key')}</Label>
              <Input
                value={vm.fieldForm.fieldKey}
                onChange={(e) => vm.updateFieldForm({ fieldKey: e.target.value })}
                placeholder={t('field.key.placeholder')}
                disabled={vm.fieldModalIsEdit}
                title={t(vm.fieldModalIsEdit ? 'field.key.locked' : 'field.key.hint')}
              />
              {!vm.fieldModalIsEdit && (
                <S.FieldHint>{t('field.key.hint')}</S.FieldHint>
              )}
            </InputGroup>
            {!vm.fieldModalIsEdit && (
              <InputGroup>
                <Label>{t('field.type')}</Label>
                <SearchSelect
                  options={vm.typeOptions}
                  value={vm.fieldForm.type}
                  onChange={(value) => vm.updateFieldForm({ type: value as typeof vm.fieldForm.type })}
                  placeholder={t('field.type.placeholder')}
                />
              </InputGroup>
            )}
            {vm.fieldForm.type === 'masked' && (
              <InputGroup>
                <Label>{t('field.mask')}</Label>
                <SearchSelect
                  options={vm.maskOptions}
                  value={vm.fieldForm.mask}
                  onChange={(value) => vm.updateFieldForm({ mask: value as typeof vm.fieldForm.mask })}
                  placeholder={t('field.mask.placeholder')}
                />
              </InputGroup>
            )}
            {vm.fieldForm.type === 'reference' && (
              <>
                <InputGroup>
                  <Label>{t('field.linked-screen')}</Label>
                  <SearchSelect
                    options={vm.refEntityOptions}
                    value={vm.fieldForm.refEntity}
                    onChange={(value) => vm.updateFieldForm({ refEntity: value })}
                    placeholder={t('field.linked-screen.placeholder')}
                  />
                </InputGroup>
                {!vm.fieldModalIsEdit && (
                  <S.CheckboxCell>
                    <Checkbox
                      label={t('field.multi')}
                      checked={vm.fieldForm.multi}
                      onChange={(next) => vm.updateFieldForm({ multi: next })}
                    />
                  </S.CheckboxCell>
                )}
              </>
            )}
            {vm.fieldForm.type === 'file' && (
              <>
                <InputGroup>
                  <Label>{t('field.file.extensions')}</Label>
                  <Input
                    value={vm.fieldForm.fileExtensions}
                    onChange={(e) => vm.updateFieldForm({ fileExtensions: e.target.value })}
                    placeholder={t('field.file.extensions.placeholder')}
                  />
                  <S.FieldHint>{t('field.file.extensions.hint')}</S.FieldHint>
                </InputGroup>
                <InputGroup>
                  <Label>{t('field.file.max-size')}</Label>
                  <Input
                    type="number"
                    value={vm.fieldForm.fileMaxSizeMb}
                    onChange={(e) => vm.updateFieldForm({ fileMaxSizeMb: e.target.value })}
                    placeholder={vm.fileMaxSizeDefault}
                  />
                  <S.FieldHint>{t('field.file.max-size.hint', { max: vm.fileMaxSizeDefault })}</S.FieldHint>
                </InputGroup>
              </>
            )}
            {vm.fieldForm.type === 'select' && (
              <>
                <S.CheckboxRow>
                  <Checkbox
                    label={t('field.colored-options')}
                    checked={vm.fieldForm.optionsColored}
                    onChange={(next) => vm.updateFieldForm({ optionsColored: next })}
                  />
                </S.CheckboxRow>
                <InputGroup $fullWidth>
                  <Label>{t('field.options')}</Label>
                  {vm.fieldForm.optionsColored && (
                    <ColorSwatchPicker
                      colors={vm.tagColors}
                      value={vm.fieldForm.optionColorInput}
                      onChange={(color) => vm.updateFieldForm({ optionColorInput: color })}
                    />
                  )}
                  <S.OptionInputRow>
                    <Input
                      value={vm.fieldForm.optionInput}
                      onChange={(e) => vm.updateFieldForm({ optionInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          vm.addStaticOption();
                        }
                      }}
                      placeholder={t('field.options.placeholder')}
                    />
                    <Button variant="secondary" onClick={vm.addStaticOption}>{t('core.ui/action.add')}</Button>
                  </S.OptionInputRow>
                  {vm.fieldForm.staticOptions.length > 0 && (
                    <S.OptionChips>
                      {vm.fieldForm.staticOptions.map((option) => (
                        <S.Chip key={option.label}>
                          {option.color && <ColorDot color={option.color} />}
                          {label(option.label)}
                          <S.ChipRemove type="button" onClick={() => vm.removeStaticOption(option.label)}>×</S.ChipRemove>
                        </S.Chip>
                      ))}
                    </S.OptionChips>
                  )}
                </InputGroup>
                <S.CheckboxCell>
                  <Checkbox
                    label={t('field.allow-new-options')}
                    checked={vm.fieldForm.optionsAllowUserAdd}
                    onChange={(next) => vm.updateFieldForm({ optionsAllowUserAdd: next })}
                  />
                </S.CheckboxCell>
                {vm.fieldForm.optionsAllowUserAdd && (
                  <>
                    <InputGroup>
                      <Label>{t('field.lookup')}</Label>
                      <Input
                        value={vm.fieldForm.lookupCollection}
                        onChange={(e) => vm.updateFieldForm({ lookupCollection: e.target.value })}
                        placeholder={vm.suggestedLookupCollection}
                      />
                      <S.FieldHint>
                        {vm.suggestedLookupCollection
                          ? t('field.lookup-collection.hint.suggested', { name: vm.suggestedLookupCollection })
                          : t('field.lookup-collection.hint')}
                      </S.FieldHint>
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('field.lookup.share')}</Label>
                      <SearchSelect
                        options={vm.lookupOptions}
                        value={vm.fieldForm.lookupCollection}
                        onChange={(value) => vm.updateFieldForm({ lookupCollection: value })}
                        placeholder={t('field.lookup.placeholder')}
                      />
                    </InputGroup>
                  </>
                )}
                {!vm.fieldModalIsEdit && (
                  <S.CheckboxCell>
                    <Checkbox
                      label={t('field.multi')}
                      checked={vm.fieldForm.multi}
                      onChange={(next) => vm.updateFieldForm({ multi: next })}
                    />
                  </S.CheckboxCell>
                )}
              </>
            )}
              </>
            )}
            <InputGroup>
              <Label>{t('field.section')}</Label>
              <LabelInput
                value={vm.fieldForm.section}
                onChange={(section) => vm.updateFieldForm({ section })}
                placeholder={t('field.section.placeholder')}
              />
            </InputGroup>
            <InputGroup>
              <Label>{t('field.placeholder')}</Label>
              <LabelInput
                value={vm.fieldForm.placeholder}
                onChange={(placeholder) => vm.updateFieldForm({ placeholder })}
                placeholder={t('field.placeholder.placeholder')}
              />
            </InputGroup>
            <S.RulesDivider>{t('field.behaviour')}</S.RulesDivider>
            <S.CheckboxCell>
              <Checkbox
                label={t('field.required')}
                checked={vm.fieldModalIsTitleField ? true : vm.fieldForm.required}
                disabled={vm.fieldModalIsTitleField}
                onChange={(next) => vm.updateFieldForm({ required: next })}
              />
            </S.CheckboxCell>
            {vm.fieldSupportsFilter && (
              <S.CheckboxCell>
                <Checkbox
                  label={t('field.filterable')}
                  checked={vm.fieldForm.filterable}
                  onChange={(next) => vm.updateFieldForm({ filterable: next })}
                />
              </S.CheckboxCell>
            )}
            {vm.fieldSupportsUnique && (
              <S.CheckboxCell>
                <Checkbox
                  label={t('key.field.unique')}
                  checked={vm.fieldForm.unique}
                  onChange={(next) => vm.updateFieldForm({ unique: next })}
                />
              </S.CheckboxCell>
            )}
            {vm.fieldSupportsContact && (
              <InputGroup>
                <Label>{t('field.contact')}</Label>
                <SearchSelect
                  options={vm.contactOptions}
                  value={vm.fieldForm.contact}
                  onChange={vm.setFieldContact}
                  placeholder={t('field.contact.none')}
                />
                <S.FieldHint>{t('field.contact.hint')}</S.FieldHint>
              </InputGroup>
            )}
            <S.CheckboxCell>
              <Checkbox
                label={t('field.show-in-list')}
                checked={vm.fieldForm.showInList}
                onChange={(next) => vm.updateFieldForm({ showInList: next })}
              />
            </S.CheckboxCell>
            {vm.fieldForm.showInList ? (
              <InputGroup>
                <Label>{t('field.card-label')}</Label>
                <Input
                  value={vm.fieldForm.listLabel}
                  onChange={(e) => vm.updateFieldForm({ listLabel: e.target.value })}
                  placeholder={t('field.card-label.placeholder')}
                />
              </InputGroup>
            ) : <div />}
            {vm.fieldSupportsSequence && (
              <>
                <S.RulesDivider>{t('field.sequence.title')}</S.RulesDivider>
                <FieldSequencePanel
                  form={vm.fieldForm.sequence}
                  locked={vm.sequencePanel.locked}
                  numeric={vm.sequencePanel.numeric}
                  hasParent={vm.sequencePanel.hasParent}
                  preview={vm.sequencePanel.preview}
                  scopeOptions={vm.sequencePanel.scopeOptions}
                  resetOptions={vm.sequencePanel.resetOptions}
                  onChange={vm.updateFieldSequence}
                />
              </>
            )}
              </>
            )}

            {vm.fieldModalTab === 'advanced' && (
              <>
                {vm.fieldSupportsRules && (
                  <>
                    <S.RulesDivider>{t('field.rules')}</S.RulesDivider>
                    <InputGroup>
                      <Label>{t('core.automation/parameter.format-preset')}</Label>
                      <SearchSelect
                        options={vm.formatPresetOptions}
                        value={vm.fieldForm.ruleFormatPreset}
                        onChange={(value) => vm.updateFieldForm({ ruleFormatPreset: value as typeof vm.fieldForm.ruleFormatPreset })}
                        placeholder={t('core.automation/parameter.preset.none')}
                      />
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('core.automation/parameter.validate-preset')}</Label>
                      <SearchSelect
                        options={vm.validateCheckOptions}
                        value={vm.fieldForm.ruleValidateCheck}
                        onChange={(value) => vm.updateFieldForm({ ruleValidateCheck: value as typeof vm.fieldForm.ruleValidateCheck })}
                        placeholder={t('core.automation/parameter.preset.none')}
                      />
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('field.format-regex')}</Label>
                      <Input
                        value={vm.fieldForm.ruleFormatPattern}
                        onChange={(e) => vm.updateFieldForm({ ruleFormatPattern: e.target.value })}
                        placeholder={t('core.automation/parameter.format.search.placeholder')}
                      />
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('field.format.replace')}</Label>
                      <Input
                        value={vm.fieldForm.ruleFormatReplacement}
                        onChange={(e) => vm.updateFieldForm({ ruleFormatReplacement: e.target.value })}
                        placeholder={t('core.automation/parameter.format.replace.placeholder')}
                      />
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('field.validate-regex')}</Label>
                      <Input
                        value={vm.fieldForm.ruleValidatePattern}
                        onChange={(e) => vm.updateFieldForm({ ruleValidatePattern: e.target.value })}
                        placeholder={t('core.automation/parameter.validate.placeholder')}
                      />
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('core.automation/parameter.min-length')}</Label>
                      <Input
                        type="number"
                        value={vm.fieldForm.ruleValidateMinLength}
                        onChange={(e) => vm.updateFieldForm({ ruleValidateMinLength: e.target.value })}
                      />
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('core.automation/parameter.max-length')}</Label>
                      <Input
                        type="number"
                        value={vm.fieldForm.ruleValidateMaxLength}
                        onChange={(e) => vm.updateFieldForm({ ruleValidateMaxLength: e.target.value })}
                      />
                    </InputGroup>
                    <InputGroup>
                      <Label>{t('core.automation/parameter.error-message')}</Label>
                      <Input
                        value={vm.fieldForm.ruleValidateMessage}
                        onChange={(e) => vm.updateFieldForm({ ruleValidateMessage: e.target.value })}
                        placeholder={t('field.validate-message.placeholder')}
                      />
                    </InputGroup>
                  </>
                )}
                {vm.aggregationFromOptions.length > 1 && (
                  <>
                    <S.RulesDivider>{t('field.aggregation')}</S.RulesDivider>
                    <S.FullRow>
                      <InfoBanner
                        message={t('field.aggregation.banner')}
                        variant="info"
                      />
                    </S.FullRow>
                    <InputGroup>
                      <Label>{t('field.aggregation.from')}</Label>
                      <SearchSelect
                        options={vm.aggregationFromOptions}
                        value={vm.fieldForm.aggregationFrom}
                        onChange={(value) => vm.updateFieldForm({ aggregationFrom: value, aggregationVia: '', aggregationField: '', aggregationOrderBy: [] })}
                        placeholder={t('field.aggregation.none')}
                      />
                    </InputGroup>
                    {vm.fieldForm.aggregationFrom !== '' && (
                      <>
                        <InputGroup>
                          <Label>{t('field.aggregation.link')}</Label>
                          <SearchSelect
                            options={vm.aggregationViaOptions}
                            value={vm.fieldForm.aggregationVia}
                            onChange={(value) => vm.updateFieldForm({ aggregationVia: value })}
                            placeholder={t('field.aggregation.link.placeholder')}
                          />
                        </InputGroup>
                        <InputGroup>
                          <Label>{t('field.aggregation.operation')}</Label>
                          <SearchSelect
                            options={vm.aggregationOpOptions}
                            value={vm.fieldForm.aggregationOp}
                            onChange={(value) => vm.updateFieldForm({ aggregationOp: value as typeof vm.fieldForm.aggregationOp })}
                            placeholder={t('field.aggregation.operation.placeholder')}
                          />
                        </InputGroup>
                        {vm.fieldForm.aggregationOp !== 'count' && (
                          <InputGroup>
                            <Label>{t(vm.fieldForm.aggregationOp === 'latest' ? 'field.aggregation.target.latest' : 'field.aggregation.target')}</Label>
                            <SearchSelect
                              options={vm.aggregationFieldOptions}
                              value={vm.fieldForm.aggregationField}
                              onChange={(value) => vm.updateFieldForm({ aggregationField: value })}
                              placeholder={t('field.pick')}
                            />
                          </InputGroup>
                        )}
                        {vm.fieldForm.aggregationOp === 'latest' && (
                          <S.FullRow>
                            <InputGroup>
                              <Label>{t('field.aggregation.order')}</Label>
                              <S.FieldHint>{t('field.aggregation.order.hint')}</S.FieldHint>
                              {vm.fieldForm.aggregationOrderBy.map((order, index) => (
                                <S.OptionInputRow key={`${index}-${order.path}`}>
                                  <SearchSelect
                                    options={vm.aggregationOrderOptions}
                                    value={order.path}
                                    onChange={(value) => vm.updateAggregationOrder(index, { path: value })}
                                    placeholder={t('field.aggregation.order.field')}
                                  />
                                  <SearchSelect
                                    options={vm.aggregationDirOptions}
                                    value={order.dir}
                                    onChange={(value) => vm.updateAggregationOrder(index, { dir: value })}
                                  />
                                  <S.DangerIconButton
                                    type="button"
                                    title={t('field.aggregation.order.remove')}
                                    onClick={() => vm.removeAggregationOrder(index)}
                                  >
                                    <RiDeleteBinLine size={16} />
                                  </S.DangerIconButton>
                                </S.OptionInputRow>
                              ))}
                              <S.OptionInputRow>
                                <Button variant="secondary" onClick={vm.addAggregationOrder}>{t('field.aggregation.order.add')}</Button>
                              </S.OptionInputRow>
                            </InputGroup>
                          </S.FullRow>
                        )}
                        <S.FullRow>
                          <InputGroup>
                            <Label>{t('field.aggregation.filter')}</Label>
                            <ExpressionEditor
                              value={vm.fieldForm.aggregationFilter}
                              onChange={(value) => vm.updateFieldForm({ aggregationFilter: value })}
                              workflowVariables={vm.aggregationFilterVariables}
                              placeholder={t('field.aggregation.filter.placeholder')}
                            />
                          </InputGroup>
                        </S.FullRow>
                      </>
                    )}
                  </>
                )}
                <S.RulesDivider>{t('field.expression-behaviour')}</S.RulesDivider>
                <S.FullRow>
                  <InfoBanner
                    message={t('field.expression.banner')}
                    variant="info"
                  />
                  <InputGroup>
                    <Label>{t('field.expression.compute')}</Label>
                    <ExpressionEditor
                      value={vm.fieldForm.logicCompute}
                      onChange={(value) => vm.updateFieldForm({ logicCompute: value })}
                      workflowVariables={vm.fieldExpressionVariables}
                      placeholder={t('field.expression.compute.placeholder')}
                    />
                  </InputGroup>
                  <InputGroup>
                    <Label>{t('field.expression.derive')}</Label>
                    <ExpressionEditor
                      value={vm.fieldForm.logicDerive}
                      onChange={(value) => vm.updateFieldForm({ logicDerive: value })}
                      workflowVariables={vm.fieldExpressionVariables}
                      placeholder={t('field.expression.derive.placeholder')}
                    />
                    <S.FieldHint>{t('field.expression.derive.hint')}</S.FieldHint>
                  </InputGroup>
                  <InputGroup>
                    <Label>{t('field.expression.validate')}</Label>
                    <ExpressionEditor
                      value={vm.fieldForm.logicValidate}
                      onChange={(value) => vm.updateFieldForm({ logicValidate: value })}
                      workflowVariables={vm.fieldExpressionVariables}
                      placeholder={t('field.expression.validate.placeholder')}
                    />
                  </InputGroup>
                </S.FullRow>
                <InputGroup>
                  <Label>{t('field.expression.disabled')}</Label>
                  <ExpressionEditor
                    value={vm.fieldForm.logicDisabledWhen}
                    onChange={(value) => vm.updateFieldForm({ logicDisabledWhen: value })}
                    workflowVariables={vm.fieldUiExpressionVariables}
                    placeholder={t('field.expression.disabled.placeholder')}
                  />
                </InputGroup>
                <S.FullRow>
                  <InputGroup>
                    <Label>{t('field.expression.on-change')}</Label>
                    <ExpressionEditor
                      value={vm.fieldForm.logicOnChange}
                      onChange={(value) => vm.updateFieldForm({ logicOnChange: value })}
                      workflowVariables={vm.fieldUiExpressionVariables}
                      placeholder={t('field.expression.on-change.placeholder')}
                    />
                  </InputGroup>
                </S.FullRow>
                <InputGroup>
                  <Label>{t('field.provider')}</Label>
                  <SearchSelect
                    options={vm.lookupProviderOptions}
                    value={vm.fieldForm.lookupProvider}
                    onChange={vm.selectLookupProvider}
                    placeholder={t('core.automation/parameter.preset.none')}
                  />
                </InputGroup>
                {vm.selectedLookupProvider && (
                  <>
                    <S.FullRow>
                      <InfoBanner
                        variant="info"
                        message={t('field.provider.banner', { host: vm.selectedLookupProvider.host ?? t('field.provider.fallback'), keys: vm.selectedLookupProvider.outputKeys.join(', ') })}
                      />
                    </S.FullRow>
                    {vm.lookupTargetRows.map((row) => (
                      <InputGroup key={row.output}>
                        <Label>{t('field.provider.map', { key: row.output })}</Label>
                        <SearchSelect
                          options={vm.lookupTargetOptions}
                          value={row.target}
                          onChange={(value) => vm.setLookupTarget(row.output, value)}
                          placeholder={t('core.automation/parameter.preset.none')}
                        />
                      </InputGroup>
                    ))}
                    {!vm.lookupMapped && (
                      <InputGroup>
                        <Label>{t('field.provider.target')}</Label>
                        <Input
                          value={vm.fieldForm.lookupTargetPrefix}
                          onChange={(e) => vm.updateFieldForm({ lookupTargetPrefix: e.target.value })}
                          placeholder={t('field.provider.target.placeholder')}
                        />
                      </InputGroup>
                    )}
                  </>
                )}
                <InputGroup>
                  <Label>{t('field.expression.hidden')}</Label>
                  <ExpressionEditor
                    value={vm.fieldForm.logicHiddenWhen}
                    onChange={(value) => vm.updateFieldForm({ logicHiddenWhen: value })}
                    workflowVariables={vm.fieldUiExpressionVariables}
                    placeholder={t('field.expression.hidden.placeholder')}
                  />
                </InputGroup>
              </>
            )}
            <S.ModalActions>
              <Button variant="secondary" onClick={vm.closeFieldModal}>{t('core.ui/action.cancel')}</Button>
              <Button onClick={() => void vm.handleSaveField()} disabled={vm.savingField} $isLoading={vm.savingField}>{t('core.ui/action.save')}</Button>
            </S.ModalActions>
          </S.ModalForm>
        </Modal>
      )}

      <ConfirmModal
        isOpen={vm.deleteScreenTarget !== null}
        title={t('screen.delete')}
        message={t('screen.delete.message', { name: label(vm.deleteScreenTarget?.titlePlural) })}
        variant="danger"
        confirmLabel={t('core.ui/action.delete')}
        loading={vm.deletingScreen}
        onConfirm={() => void vm.confirmDeleteScreen()}
        onCancel={vm.cancelDeleteScreen}
      />

      <ConfirmModal
        isOpen={vm.deleteFieldTarget !== null}
        title={t('field.delete')}
        message={t('field.delete.message', { name: label(vm.deleteFieldTarget?.field.label) })}
        variant="danger"
        confirmLabel={t('core.ui/action.delete')}
        loading={vm.deletingField}
        onConfirm={() => void vm.confirmDeleteField()}
        onCancel={vm.cancelDeleteField}
      />
    </S.Page>
  );
};
