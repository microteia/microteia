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
import { NotesPanel, DocumentsPanel } from '../EntityDetailPanels';
import type { EntityDocumentsController, EntityNotesController } from '../../../shared/entityScreen/types';

export type EntityDetailTab = 'data' | 'notes' | 'documents';

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
  showTagsAction,
  onManageTags,
  onSave,
  isSaving,
  showDelete,
  onDelete,
  activeTab,
  setActiveTab,
  showNotesTab,
  showDocsTab,
  notesController,
  docsController,
  dataContent,
  modals,
}) => (
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
          <Button variant="ghost" size="sm" onClick={onCopyLink} title="Copiar link">
            {copyLinkDone ? <RiCheckLine size={14} /> : <RiLinkM size={14} />}
          </Button>
        )}
        {!isNew && showClone && (
          <Button variant="ghost" size="sm" onClick={onClone} title="Clonar">
            <RiFileCopyLine size={14} />
          </Button>
        )}
        {!isNew && headerActionsExtra}
        {!isNew && showTagsAction && (
          <Button variant="ghost" size="sm" onClick={onManageTags} title="Gerenciar etiquetas">
            <RiPriceTag3Line size={14} />
          </Button>
        )}
        {(activeTab === 'data' || isNew) && (
          <S.SaveBtn onClick={onSave} disabled={isSaving} title={isSaving ? 'Salvando...' : 'Salvar'}>
            <RiSaveLine size={14} />
          </S.SaveBtn>
        )}
        {showDelete && (
          <S.DeleteBtn onClick={onDelete} title="Excluir">
            <RiDeleteBinLine size={14} />
          </S.DeleteBtn>
        )}
      </S.HeaderActions>
    </S.Header>

    {!isNew && (showNotesTab || showDocsTab) && (
      <S.TabBar>
        <S.TabBtn $active={activeTab === 'data'} onClick={() => setActiveTab('data')}>Dados</S.TabBtn>
        {showNotesTab && (
          <S.TabBtn $active={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>Anotações</S.TabBtn>
        )}
        {showDocsTab && (
          <S.TabBtn $active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>Documentos</S.TabBtn>
        )}
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
    </S.Content>

    {modals}
  </S.Page>
);
