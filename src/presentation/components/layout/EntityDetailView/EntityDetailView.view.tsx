import React from 'react';
import {
  RiCheckLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiLinkM,
  RiPriceTag3Line,
  RiSaveLine,
} from 'react-icons/ri';
import { S } from './EntityDetailView.styles';
import { Button } from '../../ui/Button';
import { ActionParametersModal } from '../../ui/ActionParametersModal';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { NotesPanel, DocumentsPanel } from '../EntityDetailPanels';
import { getScreenIcon } from '../../../shared/screenIcons';
import type { EntityDocumentsController, EntityNotesController } from '../../../shared/entityScreen/types';
import type { ScreenActions } from '../../../shared/entityScreen/useScreenActions';

import { useT } from '../../../shared/i18n/useT';
/** `'data' | 'notes' | 'documents'` — ou a chave de uma aba extra declarada em `extraTabs`. */
export type EntityDetailTab = string;

/** Aba própria da tela, além de Dados/Anotações/Documentos (ex.: Processos, no Contrato). */
export interface EntityDetailExtraTab {
  key: string;
  label: string;
  content: React.ReactNode;
}

export interface EntityDetailTag {
  id: string;
  name: string;
  color: string;
}

export interface EntityDetailViewProps {
  isNew: boolean;
  isAdmin: boolean;

  avatar: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tags?: EntityDetailTag[];
  showTags?: boolean;

  copyLinkDone: boolean;
  onCopyLink: () => void;
  onClone: () => void;
  /** Telas sem deeplink/clone no detalhe (ex.: Prazos) escondem essas ações. */
  showCopyLink?: boolean;
  showClone?: boolean;
  headerActionsExtra?: React.ReactNode;
  /** Ações customizadas do escritório, configuradas em Form Design para esta tela. */
  screenActions?: ScreenActions;
  showTagsAction: boolean;
  onManageTags: () => void;
  onSave: () => void;
  isSaving: boolean;
  showDelete: boolean;
  onDelete: () => void;

  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
  showNotesTab: boolean;
  showDocsTab: boolean;
  extraTabs?: EntityDetailExtraTab[];
  notesController: EntityNotesController;
  docsController: EntityDocumentsController;

  dataContent: React.ReactNode;
  modals?: React.ReactNode;
}

export const EntityDetailView: React.FC<EntityDetailViewProps> = ({
  isNew,
  isAdmin,
  avatar,
  title,
  subtitle,
  tags,
  showTags = false,
  copyLinkDone,
  onCopyLink,
  onClone,
  showCopyLink = true,
  showClone = true,
  headerActionsExtra,
  screenActions,
  showTagsAction,
  onManageTags,
  onSave,
  isSaving,
  showDelete,
  onDelete,
  activeTab,
  setActiveTab,
  extraTabs,
  showNotesTab,
  showDocsTab,
  notesController,
  docsController,
  dataContent,
  modals,
}) => {
  const t = useT('core.ui');

  return (
  <S.Page>
    <S.Header>
      <S.HeaderLeft>
        <S.Avatar>{avatar}</S.Avatar>
        <S.HeaderInfo>
          <S.Title>{title}</S.Title>
          {subtitle && <S.SubTitle>{subtitle}</S.SubTitle>}
          {showTags && tags && tags.length > 0 && (
            <S.Tags>
              {tags.map((t) => (
                <S.TagPill key={t.id} $color={t.color}>
                  <S.TagDot $color={t.color} />
                  {t.name}
                </S.TagPill>
              ))}
            </S.Tags>
          )}
        </S.HeaderInfo>
      </S.HeaderLeft>

      <S.HeaderActions>
        {!isNew && showCopyLink && (
          <Button variant="ghost" size="sm" onClick={onCopyLink} title={t('core.records/action.copy-link')}>
            {copyLinkDone ? <RiCheckLine size={14} /> : <RiLinkM size={14} />}
          </Button>
        )}
        {!isNew && showClone && (
          <Button variant="ghost" size="sm" onClick={onClone} title={t('core.records/action.clone')}>
            <RiFileCopyLine size={14} />
          </Button>
        )}
        {!isNew && headerActionsExtra}
        {screenActions?.buttons.map((action) => (
          action.danger ? (
            <S.DeleteBtn key={action.key} onClick={action.onClick} disabled={action.disabled} title={action.title}>
              {getScreenIcon(action.iconKey, 14)}
            </S.DeleteBtn>
          ) : (
            <Button
              key={action.key}
              variant="ghost"
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title}
            >
              {action.active === undefined
                ? getScreenIcon(action.iconKey, 14)
                : <S.ToggleIcon $on={action.active}>{getScreenIcon(action.iconKey, 14)}</S.ToggleIcon>}
            </Button>
          )
        ))}
        {!isNew && showTagsAction && (
          <Button variant="ghost" size="sm" onClick={onManageTags} title={t('core.records/action.manage-tags')}>
            <RiPriceTag3Line size={14} />
          </Button>
        )}
        {(activeTab === 'data' || isNew) && (
          <S.SaveBtn onClick={onSave} disabled={isSaving} title={isSaving ? 'Salvando...' : 'Salvar'}>
            <RiSaveLine size={14} />
          </S.SaveBtn>
        )}
        {showDelete && (
          <S.DeleteBtn onClick={onDelete} title={t('action.delete')}>
            <RiDeleteBinLine size={14} />
          </S.DeleteBtn>
        )}
      </S.HeaderActions>
    </S.Header>

    {!isNew && (showNotesTab || showDocsTab || (extraTabs?.length ?? 0) > 0) && (
      <S.TabBar>
        <S.TabBtn $active={activeTab === 'data'} onClick={() => setActiveTab('data')}>{t('tab.data')}</S.TabBtn>
        {showNotesTab && (
          <S.TabBtn $active={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>{t('tab.notes')}</S.TabBtn>
        )}
        {showDocsTab && (
          <S.TabBtn $active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>{t('tab.documents')}</S.TabBtn>
        )}
        {extraTabs?.map((tab) => (
          <S.TabBtn key={tab.key} $active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </S.TabBtn>
        ))}
      </S.TabBar>
    )}

    <S.Content>
      {(activeTab === 'data' || isNew) && dataContent}
      {activeTab === 'notes' && !isNew && showNotesTab && (
        <NotesPanel controller={notesController} isAdmin={isAdmin} />
      )}
      {activeTab === 'documents' && !isNew && showDocsTab && (
        <DocumentsPanel controller={docsController} isAdmin={isAdmin} />
      )}
      {!isNew && extraTabs?.find((tab) => tab.key === activeTab)?.content}
    </S.Content>

    {modals}

    {screenActions && (
      <ConfirmModal
        isOpen={screenActions.pendingAction !== null}
        title={screenActions.pendingAction?.title ?? ''}
        message={screenActions.pendingAction?.confirmMessage ?? ''}
        variant={screenActions.pendingAction?.danger ? 'danger' : 'default'}
        confirmLabel={t('action.run')}
        loading={screenActions.runningActionId !== null}
        onConfirm={screenActions.confirmPendingAction}
        onCancel={screenActions.cancelPendingAction}
      />
    )}

    {screenActions && <ActionParametersModal controller={screenActions.parameterPrompt} />}
  </S.Page>
  );
};
