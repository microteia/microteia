import React from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiFileTextLine,
} from 'react-icons/ri';
import { S } from './panels.styles';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { MarkdownEditor } from '../../ui/MarkdownEditor';
import { MarkdownContent } from '../../ui/MarkdownContent';
import type { EntityNotesController } from '../../../shared/entityScreen/types';
import { useT, useLocaleFormat } from '../../../shared/i18n/useT';

interface NotesPanelProps {
  controller: EntityNotesController;
  /** Pode excluir uma anotação — a permissão de exclusão da coleção do registro. */
  canDelete: boolean;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ controller: vm, canDelete }) => {
  const t = useT('core.ui');
  const { formatLongDate } = useLocaleFormat();

  return (
  <>
    <S.TabSectionHeader>
      {!vm.isNoteEditorOpen && (
        <Button variant="secondary" size="sm" onClick={vm.openNoteEditor}>
          <RiAddLine size={14} />
          {t('notes.new')}
        </Button>
      )}
    </S.TabSectionHeader>

    {vm.isNoteEditorOpen && (
      <S.NoteEditorCard>
        <S.NoteEditorTitleRow>
          <Input
            value={vm.newNoteTitle}
            onChange={(e) => vm.setNewNoteTitle(e.target.value)}
            placeholder={t('notes.title.placeholder')}
          />
        </S.NoteEditorTitleRow>
        <MarkdownEditor
          value={vm.newNoteText}
          onChange={vm.setNewNoteText}
          placeholder={t('notes.content.placeholder')}
        />
        <S.NoteEditorActions>
          <Button variant="ghost" size="sm" onClick={vm.closeNoteEditor}>
            <RiCloseLine size={14} />
            {t('action.cancel')}
          </Button>
          <Button size="sm" onClick={() => void vm.handleAddNote()} disabled={vm.isAddingNote || !vm.newNoteTitle.trim() || !vm.newNoteText.trim()}>
            <RiAddLine size={14} />
            {vm.isAddingNote ? t('notes.adding') : t('notes.add')}
          </Button>
        </S.NoteEditorActions>
      </S.NoteEditorCard>
    )}

    {vm.notesLoading ? (
      <S.SpinnerWrap><Spinner /></S.SpinnerWrap>
    ) : vm.notes.length === 0 ? (
      <S.EmptyState>
        <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
        <div>{t('notes.empty')}</div>
      </S.EmptyState>
    ) : (
      <S.NoteList>
        {vm.notes.map((note) => {
          const isExpanded = vm.expandedNoteIds.has(note.id);
          return (
            <S.NoteCard key={note.id}>
              <S.NoteCardTop>
                <S.NoteCardClickArea onClick={() => vm.toggleNoteExpanded(note.id)}>
                  <S.NoteAvatar>
                    {note.createdByPhotoUrl
                      ? <S.AvatarImg src={note.createdByPhotoUrl} alt={note.createdByName} />
                      : (note.createdByName || 'U').charAt(0).toUpperCase()}
                  </S.NoteAvatar>
                  <S.NoteBody>
                    <S.NoteTitle>{note.title || t('notes.untitled')}</S.NoteTitle>
                    <S.NoteDate>
                      {note.createdByName} · {formatLongDate(note.createdAt)}
                    </S.NoteDate>
                  </S.NoteBody>
                  <S.NoteExpandIcon $expanded={isExpanded}>
                    <RiArrowDownSLine size={18} />
                  </S.NoteExpandIcon>
                </S.NoteCardClickArea>
                {canDelete && (
                  <Button variant="ghost" size="sm" onClick={() => vm.requestDeleteNote(note)} title={t('notes.delete')}>
                    <RiDeleteBinLine size={13} />
                  </Button>
                )}
              </S.NoteCardTop>
              {isExpanded && (
                <>
                  <S.NoteDivider />
                  <S.NoteContent>
                    <MarkdownContent>{note.text}</MarkdownContent>
                  </S.NoteContent>
                </>
              )}
            </S.NoteCard>
          );
        })}
      </S.NoteList>
    )}

    <ConfirmModal
      isOpen={!!vm.noteToDelete}
      onConfirm={() => void vm.confirmDeleteNote()}
      onCancel={vm.cancelDeleteNote}
      title={t('notes.delete.title')}
      message={t('notes.delete.message')}
      confirmLabel={t('action.delete')}
      variant="danger"
    />
  </>
  );
};
